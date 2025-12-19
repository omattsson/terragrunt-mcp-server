import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { LRUCache } from 'lru-cache';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface DocMetadata {
  title: string;
  url: string;
  section: string;
  lastUpdated?: string;
}

export interface TerragruntDoc extends DocMetadata {
  content: string;
}

interface IndexedMetadata extends DocMetadata {
  titleLower: string;
  sectionLower: string;
  urlLower: string;
}

interface IndexedDoc extends TerragruntDoc {
  titleLower: string;
  contentLower: string;
  sectionLower: string;
}

type WarmupStrategy = 'none' | 'minimal' | 'common' | 'full';

interface CacheMetadata {
  lastFetchTime: string;
  docsCount: number;
  compressed?: boolean;
}

interface LazyLoadingMetrics {
  enabled: boolean;
  startupTimeMs: number;
  metadataOnlyLoadTime?: number;
  warmupTime?: number;
  initialMemoryMB: number;
  metadataCount: number;
  docsLoadedLazily: number;
  averageDocLoadTimeMs: number;
  warmupStrategy: WarmupStrategy;
}

interface CacheStats {
  hits: number;
  misses: number;
  searches: number;
  totalSearchTime: number;
  lastRefresh: Date | null;
  cacheSize: number;
  memoryUsage: number;
  lazyLoading?: LazyLoadingMetrics;
  loadedDocsRatio?: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class TerragruntDocsManager {
  private readonly baseUrl = 'https://terragrunt.gruntwork.io';
  private docsCache: Map<string, TerragruntDoc> = new Map();
  private indexedDocs: IndexedDoc[] = [];
  private searchCache: LRUCache<string, TerragruntDoc[]>;
  private lastFetchTime: Date | null = null;
  private readonly cacheExpiry: number;
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private readonly metadataFile: string;
  private readonly fixtureFile: string;
  private readonly useCompression: boolean;
  
  // Lazy loading state
  private readonly lazyLoadingEnabled: boolean;
  private readonly warmupStrategy: WarmupStrategy;
  private metadataCache: Map<string, DocMetadata> = new Map();
  private indexedMetadata: IndexedMetadata[] = [];
  private contentCache: Map<string, string> = new Map();
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private loadedDocs: Set<string> = new Set();
  private lazyLoadingMetrics: LazyLoadingMetrics;
  private readonly startTime: number;
  private totalDocLoadTimeMs: number = 0;
  
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    searches: 0,
    totalSearchTime: 0,
    lastRefresh: null,
    cacheSize: 0,
    memoryUsage: 0
  };
  private readonly retryConfig: RetryConfig = {
    maxRetries: parseInt(process.env.TERRAGRUNT_RETRY_MAX_RETRIES || '3', 10),
    initialDelayMs: parseInt(process.env.TERRAGRUNT_RETRY_INITIAL_DELAY || '1000', 10),
    maxDelayMs: parseInt(process.env.TERRAGRUNT_RETRY_MAX_DELAY || '10000', 10),
    backoffMultiplier: parseFloat(process.env.TERRAGRUNT_RETRY_BACKOFF_MULTIPLIER || '2')
  };

  constructor() {
    this.startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Get the directory where this file is located
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Configurable cache TTL (default 24 hours)
    const ttlHours = process.env.TERRAGRUNT_CACHE_TTL_HOURS 
      ? parseInt(process.env.TERRAGRUNT_CACHE_TTL_HOURS, 10)
      : 24;
    if (isNaN(ttlHours) || ttlHours < 0) {
      throw new Error('TERRAGRUNT_CACHE_TTL_HOURS must be a non-negative number');
    }
    this.cacheExpiry = ttlHours * 60 * 60 * 1000;
    
    // Enable compression by default (can disable with env var)
    this.useCompression = process.env.TERRAGRUNT_CACHE_COMPRESSION !== 'false';
    
    // Lazy loading configuration (opt-in)
    this.lazyLoadingEnabled = process.env.TERRAGRUNT_LAZY_LOADING === 'true';
    
    // Validate warmup strategy to avoid silent misconfiguration
    const rawWarmupStrategy = process.env.TERRAGRUNT_WARMUP_STRATEGY;
    const validWarmupStrategies: WarmupStrategy[] = ['none', 'minimal', 'common', 'full'];
    let warmupStrategy: WarmupStrategy = 'minimal';

    if (rawWarmupStrategy) {
      if (validWarmupStrategies.includes(rawWarmupStrategy as WarmupStrategy)) {
        warmupStrategy = rawWarmupStrategy as WarmupStrategy;
      } else {
        console.warn(
          `Invalid TERRAGRUNT_WARMUP_STRATEGY value "${rawWarmupStrategy}". ` +
          `Falling back to "minimal". Valid values are: ${validWarmupStrategies.join(', ')}.`
        );
      }
    }

    this.warmupStrategy = warmupStrategy;
    
    // Store cache in project root under .cache/terragrunt-docs
    this.cacheDir = path.join(__dirname, '..', '..', '.cache', 'terragrunt-docs');
    this.cacheFile = path.join(this.cacheDir, this.useCompression ? 'docs-cache.json.gz' : 'docs-cache.json');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.fixtureFile = path.join(__dirname, '..', '..', 'fixtures', 'terragrunt-docs-fixture.json');
    
    // Initialize lazy loading metrics
    this.lazyLoadingMetrics = {
      enabled: this.lazyLoadingEnabled,
      startupTimeMs: 0,
      initialMemoryMB: initialMemory,
      metadataCount: 0,
      docsLoadedLazily: 0,
      averageDocLoadTimeMs: 0,
      warmupStrategy: this.warmupStrategy
    };
    
    // Initialize LRU cache for search results (max 100 searches, 5 min TTL)
    this.searchCache = new LRUCache<string, TerragruntDoc[]>({
      max: 100,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });
  }

  /**
   * Get cache statistics for monitoring and optimization
   */
  getCacheStats(): CacheStats {
    // Update metadataCount and averageDocLoadTimeMs dynamically
    const updatedMetrics: LazyLoadingMetrics = {
      ...this.lazyLoadingMetrics,
      metadataCount: this.metadataCache.size,
      averageDocLoadTimeMs: this.lazyLoadingMetrics.docsLoadedLazily > 0
        ? this.totalDocLoadTimeMs / this.lazyLoadingMetrics.docsLoadedLazily
        : 0
    };
    
    return {
      ...this.stats,
      cacheSize: this.lazyLoadingEnabled ? this.metadataCache.size : this.docsCache.size,
      memoryUsage: process.memoryUsage().heapUsed,
      lastRefresh: this.lastFetchTime,
      lazyLoading: updatedMetrics,
      loadedDocsRatio: this.lazyLoadingEnabled
        ? (this.metadataCache.size > 0 ? this.loadedDocs.size / this.metadataCache.size : 0)
        : (this.docsCache.size > 0 ? 1 : 0)
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      searches: 0,
      totalSearchTime: 0,
      lastRefresh: this.lastFetchTime,
      cacheSize: this.docsCache.size,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.retryConfig.maxRetries) {
          console.warn(`${context} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}): ${lastError.message}`);
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${this.retryConfig.maxRetries + 1} attempts`);
  }

  private async loadFixture(): Promise<boolean> {
    try {
      console.log('Attempting to load fixture as fallback...');
      const fixtureExists = await fs.access(this.fixtureFile).then(() => true).catch(() => false);
      
      if (!fixtureExists) {
        console.warn('No fixture file found at:', this.fixtureFile);
        return false;
      }

      const fixtureContent = await fs.readFile(this.fixtureFile, 'utf-8');
      const docs: TerragruntDoc[] = JSON.parse(fixtureContent);

      this.docsCache.clear();
      docs.forEach(doc => this.docsCache.set(doc.url, doc));
      this.lastFetchTime = new Date(); // Mark as fresh to prevent immediate re-fetch
      
      // Build search index for fixture docs
      this.buildSearchIndex();

      console.log(`Loaded ${docs.length} docs from fixture (fallback mode)`);
      return true;
    } catch (error) {
      console.error('Failed to load fixture:', error);
      return false;
    }
  }

  /**
   * Validates that the fixture contains required function documentation for offline testing.
   * This ensures the fixture is comprehensive enough to support function extraction tests.
   * 
   * @returns Validation result with details about missing content
   */
  public async validateFixture(): Promise<{
    valid: boolean;
    hasFunctionDocs: boolean;
    functionDocsCount: number;
    totalDocs: number;
    missingPages: string[];
  }> {
    try {
      const fixtureExists = await fs.access(this.fixtureFile).then(() => true).catch(() => false);
      
      if (!fixtureExists) {
        return {
          valid: false,
          hasFunctionDocs: false,
          functionDocsCount: 0,
          totalDocs: 0,
          missingPages: ['Fixture file not found']
        };
      }

      const fixtureContent = await fs.readFile(this.fixtureFile, 'utf-8');
      const docs: TerragruntDoc[] = JSON.parse(fixtureContent);

      // Required pages for comprehensive function extraction
      const requiredPages = [
        'Functions', // Main functions reference page
      ];

      const foundPages = new Set<string>();
      let functionDocsCount = 0;

      docs.forEach(doc => {
        // Check for required pages
        if (requiredPages.includes(doc.title)) {
          foundPages.add(doc.title);
        }
        
        // Count function-related documentation
        if (
          doc.title.toLowerCase().includes('function') ||
          doc.section === 'reference' && doc.url.includes('/functions/')
        ) {
          functionDocsCount++;
        }
      });

      const missingPages = requiredPages.filter(page => !foundPages.has(page));
      const hasFunctionDocs = functionDocsCount > 0;
      const valid = missingPages.length === 0 && hasFunctionDocs;

      return {
        valid,
        hasFunctionDocs,
        functionDocsCount,
        totalDocs: docs.length,
        missingPages
      };
    } catch (error) {
      console.error('Failed to validate fixture:', error);
      return {
        valid: false,
        hasFunctionDocs: false,
        functionDocsCount: 0,
        totalDocs: 0,
        missingPages: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  private async loadCacheFromDisk(): Promise<boolean> {
    try {
      // Try loading compressed cache first if compression is enabled
      let cacheFileToLoad = this.cacheFile;
      let cacheExists = await fs.access(cacheFileToLoad).then(() => true).catch(() => false);
      
      // Fallback to uncompressed if compressed doesn't exist
      if (!cacheExists && this.useCompression) {
        const uncompressedPath = this.cacheFile.replace('.gz', '');
        cacheExists = await fs.access(uncompressedPath).then(() => true).catch(() => false);
        if (cacheExists) {
          cacheFileToLoad = uncompressedPath;
        }
      }
      
      const metadataExists = await fs.access(this.metadataFile).then(() => true).catch(() => false);

      if (!cacheExists || !metadataExists) {
        console.log('No disk cache found');
        this.stats.misses++;
        return false;
      }

      // Read metadata first
      const metadataContent = await fs.readFile(this.metadataFile, 'utf-8');
      const metadata: CacheMetadata = JSON.parse(metadataContent);

      // Check if cache is expired
      const cacheAge = Date.now() - new Date(metadata.lastFetchTime).getTime();
      if (cacheAge > this.cacheExpiry) {
        console.log('Disk cache expired');
        this.stats.misses++;
        return false;
      }

      // Load docs from disk (with decompression if needed)
      let docsContent: string;
      const fileBuffer = await fs.readFile(cacheFileToLoad);
      
      if (cacheFileToLoad.endsWith('.gz')) {
        const decompressed = await gunzipAsync(fileBuffer);
        docsContent = decompressed.toString('utf-8');
        console.log(`Decompressed cache: ${fileBuffer.length} → ${decompressed.length} bytes`);
      } else {
        docsContent = fileBuffer.toString('utf-8');
      }
      
      const docs: TerragruntDoc[] = JSON.parse(docsContent);

      if (this.lazyLoadingEnabled) {
        // Lazy loading mode: load metadata and populate contentCache with existing content
        this.metadataCache.clear();
        this.contentCache.clear();
        this.loadedDocs.clear();
        docs.forEach(doc => {
          const docMetadata: DocMetadata = {
            title: doc.title,
            url: doc.url,
            section: doc.section,
            lastUpdated: doc.lastUpdated
          };
          this.metadataCache.set(doc.url, docMetadata);
          
          // Populate contentCache if document has content
          if (doc.content) {
            this.contentCache.set(doc.url, doc.content);
            this.loadedDocs.add(doc.url);
          }
        });
        
        this.lastFetchTime = new Date(metadata.lastFetchTime);
        this.stats.hits++;
        
        // Build indexed metadata for optimized searches
        this.buildMetadataIndex();
        
        console.log(`Loaded metadata for ${docs.length} docs from disk cache (${this.contentCache.size} with content, lazy mode, age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        
        // Perform warmup if configured
        await this.warmupCache(this.warmupStrategy);
        
        // Calculate startup time after warmup completes
        const endTime = performance.now();
        this.lazyLoadingMetrics.startupTimeMs = endTime - this.startTime;
      } else {
        // Traditional mode: load full content and build search index
        this.docsCache.clear();
        this.indexedDocs = docs.map(doc => ({
          ...doc,
          titleLower: doc.title.toLowerCase(),
          contentLower: doc.content.toLowerCase(),
          sectionLower: doc.section.toLowerCase()
        }));
        
        docs.forEach(doc => this.docsCache.set(doc.url, doc));
        this.lastFetchTime = new Date(metadata.lastFetchTime);
        this.stats.hits++;

        console.log(`Loaded ${docs.length} docs from disk cache (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load cache from disk:', error);
      this.stats.misses++;
      return false;
    }
  }

  private async saveCacheToDisk(): Promise<void> {
    try {
      await this.ensureCacheDir();

      let docs: TerragruntDoc[];
      
      if (this.lazyLoadingEnabled && this.metadataCache.size > 0) {
        // Lazy loading mode: combine metadata with loaded content
        docs = Array.from(this.metadataCache.values()).map(meta => {
          const content = this.contentCache.get(meta.url) || '';
          return { ...meta, content };
        });
      } else {
        // Traditional mode
        docs = Array.from(this.docsCache.values());
      }

      const metadata: CacheMetadata = {
        lastFetchTime: this.lastFetchTime?.toISOString() || new Date().toISOString(),
        docsCount: docs.length,
        compressed: this.useCompression
      };

      const jsonData = JSON.stringify(docs, null, 2);
      
      // Compress if enabled
      if (this.useCompression) {
        const compressed = await gzipAsync(jsonData);
        await Promise.all([
          fs.writeFile(this.cacheFile, compressed),
          fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8')
        ]);
        console.log(`Saved ${docs.length} docs to disk cache (compressed: ${jsonData.length} → ${compressed.length} bytes, ${Math.round(compressed.length / jsonData.length * 100)}%)`);
      } else {
        await Promise.all([
          fs.writeFile(this.cacheFile, jsonData, 'utf-8'),
          fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8')
        ]);
        console.log(`Saved ${docs.length} docs to disk cache`);
      }
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  async fetchLatestDocs(): Promise<TerragruntDoc[]> {
    // Try loading from disk cache first if in-memory cache is empty
    const cacheSize = this.lazyLoadingEnabled ? this.metadataCache.size : this.docsCache.size;
    if (cacheSize === 0) {
      const loaded = await this.loadCacheFromDisk();
      if (loaded && !this.shouldRefreshCache()) {
        return this.lazyLoadingEnabled 
          ? Array.from(this.metadataCache.values()).map(meta => ({ ...meta, content: this.contentCache.get(meta.url) || '' }))
          : Array.from(this.docsCache.values());
      }
    }

    // Refresh if needed
    if (this.shouldRefreshCache()) {
      try {
        await this.refreshDocsCache();
      } catch (error) {
        console.error('All documentation fetch methods failed:', error);
        // If we have any docs in cache (even stale), return them
        const hasStaleCache = this.lazyLoadingEnabled ? this.metadataCache.size > 0 : this.docsCache.size > 0;
        if (hasStaleCache) {
          console.log('Returning stale cached docs');
          return this.lazyLoadingEnabled
            ? Array.from(this.metadataCache.values()).map(meta => ({ ...meta, content: this.contentCache.get(meta.url) || '' }))
            : Array.from(this.docsCache.values());
        }
        // Last resort: try fixture
        await this.loadFixture();
      }
    }
    
    return this.lazyLoadingEnabled
      ? Array.from(this.metadataCache.values()).map(meta => ({ ...meta, content: this.contentCache.get(meta.url) || '' }))
      : Array.from(this.docsCache.values());
  }

  private shouldRefreshCache(): boolean {
    return !this.lastFetchTime ||
      Date.now() - this.lastFetchTime.getTime() > this.cacheExpiry;
  }

  private async refreshDocsCache(): Promise<void> {
    try {
      console.log('Refreshing Terragrunt documentation cache...');
      
      // Use retry logic for fetching docs
      const docPages = await this.retryWithBackoff(
        () => this.getDocumentationPages(),
        'Fetching documentation pages'
      );
      
      this.docsCache.clear();
      this.metadataCache.clear();
      this.contentCache.clear();
      this.loadedDocs.clear();

      const refreshStartTime = performance.now();
      
      if (this.lazyLoadingEnabled) {
        // Lazy loading mode: only fetch metadata
        for (const page of docPages) {
          const metadata: DocMetadata = {
            title: page.title,
            url: page.url,
            section: page.section,
            lastUpdated: new Date().toISOString()
          };
          this.metadataCache.set(page.url, metadata);
        }

        this.lastFetchTime = new Date();
        this.stats.lastRefresh = this.lastFetchTime;
        
        const endTime = performance.now();
        this.lazyLoadingMetrics.metadataOnlyLoadTime = endTime - refreshStartTime;
        
        // Build indexed metadata for optimized searches
        this.buildMetadataIndex();
        
        console.log(`Lazy loaded metadata for ${this.metadataCache.size} docs in ${this.lazyLoadingMetrics.metadataOnlyLoadTime.toFixed(2)}ms`);
        
        // Validate that we got some metadata
        if (this.metadataCache.size === 0) {
          throw new Error('Failed to fetch any documentation metadata');
        }
        
        // Perform warmup if configured
        await this.warmupCache(this.warmupStrategy);
        
        // Calculate startup time
        this.lazyLoadingMetrics.startupTimeMs = performance.now() - this.startTime;
        
      } else {
        // Traditional mode: fetch full content
        for (const page of docPages) {
          try {
            const doc = await this.retryWithBackoff(
              () => this.fetchDocumentPage(page),
              `Fetching ${page.url}`
            );
            if (doc) {
              this.docsCache.set(doc.url, doc);
            }
          } catch {
            console.warn(`Skipping page ${page.url} after retries failed`);
          }
        }

        if (this.docsCache.size === 0) {
          throw new Error('No documentation pages were successfully fetched');
        }

        this.lastFetchTime = new Date();
        this.stats.lastRefresh = this.lastFetchTime;
        
        // Build search index from fetched docs
        this.buildSearchIndex();
        
        console.log(`Cached ${this.docsCache.size} documentation pages`);
      }
      
      // Save to disk after successful fetch
      await this.saveCacheToDisk();
    } catch (error) {
      console.error('Failed to refresh Terragrunt docs cache:', error);
      
      // Try loading from disk cache if available
      const diskCacheLoaded = await this.loadCacheFromDisk();
      if (diskCacheLoaded) {
        console.log('Using stale disk cache due to fetch failure');
        return;
      }
      
      // Fall back to fixture as last resort
      const fixtureLoaded = await this.loadFixture();
      if (!fixtureLoaded) {
        throw new Error('Failed to load documentation from any source (network, disk cache, or fixture)');
      }
    }
  }

  private async getDocumentationPages(): Promise<Array<{ url: string, title: string, section: string }>> {
    const response = await fetch(`${this.baseUrl}/docs/`);
    const html = await response.text();
    const $ = cheerio.load(html);

    const pages: Array<{ url: string, title: string, section: string }> = [];

    // Extract main documentation links from navigation
    $('nav a[href^="/docs/"], .sidebar a[href^="/docs/"], .menu a[href^="/docs/"]').each((_: any, element: any) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (href && title && !pages.some(p => p.url === `${this.baseUrl}${href}`)) {
        const section = this.extractSection(href);
        pages.push({
          url: `${this.baseUrl}${href}`,
          title,
          section
        });
      }
    });

    // Also extract links from content area
    $('.content a[href^="/docs/"], main a[href^="/docs/"]').each((_: any, element: any) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (href && title && !pages.some(p => p.url === `${this.baseUrl}${href}`)) {
        const section = this.extractSection(href);
        pages.push({
          url: `${this.baseUrl}${href}`,
          title,
          section
        });
      }
    });

    // Add some core documentation pages if not found
    const coreDocs = [
      { url: `${this.baseUrl}/docs/getting-started/quick-start/`, title: 'Quick Start', section: 'getting-started' },
      { url: `${this.baseUrl}/docs/reference/config-blocks-and-attributes/`, title: 'Configuration Reference', section: 'reference' },
      { url: `${this.baseUrl}/docs/reference/hcl/functions/`, title: 'Built-in Functions', section: 'reference' },
      { url: `${this.baseUrl}/docs/features/keep-your-terraform-code-dry/`, title: 'Keep Your Code DRY', section: 'features' },
      { url: `${this.baseUrl}/docs/features/execute-terraform-commands-on-multiple-modules-at-once/`, title: 'Multiple Modules', section: 'features' },
    ];

    for (const coreDoc of coreDocs) {
      if (!pages.some(p => p.url === coreDoc.url)) {
        pages.push(coreDoc);
      }
    }

    return pages;
  }

  private extractSection(href: string): string {
    const pathParts = href.split('/').filter(part => part);
    if (pathParts.length >= 2) {
      return pathParts[1]; // /docs/[section]/...
    }
    return 'general';
  }

  private async fetchDocumentPage(page: { url: string, title: string, section: string }): Promise<TerragruntDoc | null> {
    try {
      const response = await fetch(page.url);

      if (!response.ok) {
        console.warn(`Failed to fetch ${page.url}: ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove navigation and other non-content elements
      $('nav, .sidebar, .menu, .header, .footer, script, style').remove();

      const content = this.extractHtmlContent($);

      if (!content) {
        console.warn(`No content found for ${page.url}`);
        return null;
      }

      return {
        title: page.title,
        url: page.url,
        content,
        section: page.section,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch doc page ${page.url}:`, error);
      return null;
    }
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\t+/g, ' ')
      .trim();
  }

  /**
   * Extract and parse HTML content from a loaded cheerio instance.
   * Shared logic used by both fetchDocumentPage and fetchSingleDocContent.
   */
  private extractHtmlContent($: cheerio.CheerioAPI): string {
    let content = '';
    const contentSelectors = ['.content', '.markdown', 'main', '.post-content', '.doc-content', 'article'];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback to body if no content container found
    if (!content) {
      $('body nav, body .sidebar, body .menu, body .header, body .footer').remove();
      content = $('body').text().trim();
    }

    return this.cleanContent(content);
  }

  /**
   * Lazy load full content for a specific document by URL.
   * Implements promise deduplication to avoid concurrent fetches of the same document.
   */
  private async loadDocContent(url: string): Promise<TerragruntDoc> {
    // Check if already loaded
    const cachedContent = this.contentCache.get(url);
    if (cachedContent) {
      const metadata = this.metadataCache.get(url);
      if (metadata) {
        return { ...metadata, content: cachedContent };
      } else {
        // Inconsistent state: have content but no metadata
        console.warn(`[LazyLoading] Inconsistent state: content exists for ${url} but metadata is missing`);
        return this.createEmptyDoc(url);
      }
    }

    // Check if already loading (deduplication)
    const existingPromise = this.loadingPromises.get(url);
    if (existingPromise) {
      const content = await existingPromise;
      const metadata = this.metadataCache.get(url);
      return metadata ? { ...metadata, content } : this.createEmptyDoc(url);
    }

    // Start new load with timing
    const loadStartTime = performance.now();
    const loadPromise = this.fetchSingleDocContent(url);
    this.loadingPromises.set(url, loadPromise);

    try {
      const content = await loadPromise;
      const loadDuration = performance.now() - loadStartTime;
      
      this.contentCache.set(url, content);

      // Track metrics and loaded state only for successful loads (non-empty content)
      if (content) {
        this.loadedDocs.add(url);
        this.lazyLoadingMetrics.docsLoadedLazily++;
        this.totalDocLoadTimeMs += loadDuration;
      }
      // Return document with metadata
      const metadata = this.metadataCache.get(url);
      return metadata ? { ...metadata, content } : this.createEmptyDoc(url);
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  /**
   * Fetch content for a single document (metadata must exist)
   */
  private async fetchSingleDocContent(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove navigation and other non-content elements (consistent with fetchDocumentPage)
      $('nav, .sidebar, .menu, .header, .footer, script, style').remove();

      return this.extractHtmlContent($);
    } catch (error) {
      console.error(`Failed to lazy load content for ${url}:`, error);
      return '';
    }
  }

  /**
   * Create empty doc with minimal metadata
   */
  private createEmptyDoc(url: string): TerragruntDoc {
    return {
      title: 'Unknown',
      url,
      content: '',
      section: 'unknown',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get list of common sections to warmup for 'common' strategy
   */
  private getCommonSections(): string[] {
    return [
      'getting-started',
      'features/keep-your-terraform-code-dry',
      'features/keep-your-remote-state-configuration-dry',
      'features/keep-your-cli-flags-dry',
      'features/execute-terraform-commands-on-multiple-modules-at-once',
      'reference/config-blocks-and-attributes'
    ];
  }

  /**
   * Warmup cache based on configured strategy
   */
  private async warmupCache(strategy: WarmupStrategy): Promise<void> {
    if (strategy === 'none') {
      return;
    }

    const startTime = performance.now();
    let docsToLoad: string[] = [];

    switch (strategy) {
      case 'minimal':
        // Load the first 3 docs
        docsToLoad = Array.from(this.metadataCache.keys()).slice(0, 3);
        break;
      
      case 'common':
        // Load common sections
        const commonSections = this.getCommonSections();
        docsToLoad = Array.from(this.metadataCache.values())
          .filter(meta => commonSections.some(section => meta.url.includes(section)))
          .map(meta => meta.url);
        break;
      
      case 'full':
        // Load everything
        docsToLoad = Array.from(this.metadataCache.keys());
        break;
      
      default:
        console.warn(`Unexpected warmup strategy: ${strategy}, skipping warmup`);
        return;
    }

    const results = await Promise.allSettled(
      docsToLoad.map(url => this.loadDocContent(url))
    );

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    const duration = performance.now() - startTime;
    this.lazyLoadingMetrics.warmupTime = duration;
    console.log(
      `Warmed up ${successful}/${docsToLoad.length} docs` +
      (failed ? ` (${failed} failed)` : '') +
      ` in ${duration.toFixed(2)}ms with strategy '${strategy}'`
    );
  }

  /**
   * Build metadata index with pre-computed lowercase fields for optimized searches in lazy loading mode.
   */
  private buildMetadataIndex(): void {
    const metadata = Array.from(this.metadataCache.values());
    this.indexedMetadata = metadata.map(meta => ({
      ...meta,
      titleLower: meta.title.toLowerCase(),
      sectionLower: meta.section.toLowerCase(),
      urlLower: meta.url.toLowerCase()
    }));
    console.log(`Built metadata index for ${this.indexedMetadata.length} documents`);
  }

  /**
   * Build search index from cached docs.
   * Pre-computes lowercase strings to avoid repeated .toLowerCase() calls during searches.
   */
  private buildSearchIndex(): void {
    const docs = Array.from(this.docsCache.values());
    this.indexedDocs = docs.map(doc => ({
      ...doc,
      titleLower: doc.title.toLowerCase(),
      contentLower: doc.content.toLowerCase(),
      sectionLower: doc.section.toLowerCase()
    }));
    console.log(`Built search index for ${this.indexedDocs.length} documents`);
  }

  async searchDocs(query: string): Promise<TerragruntDoc[]> {
    const startTime = performance.now();
    
    // Check LRU cache first
    const cached = this.searchCache.get(query);
    if (cached) {
      this.stats.hits++;
      this.stats.searches++;
      return cached;
    }
    
    this.stats.misses++;
    
    // Ensure docs are loaded
    await this.fetchLatestDocs();
    
    const lowercaseQuery = query.toLowerCase();

    if (this.lazyLoadingEnabled && this.indexedMetadata.length > 0) {
      // Lazy loading mode: search indexed metadata (pre-computed lowercase fields)
      const metadataMatches = this.indexedMetadata.filter(indexed =>
        indexed.titleLower.includes(lowercaseQuery) ||
        indexed.sectionLower.includes(lowercaseQuery) ||
        indexed.urlLower.includes(lowercaseQuery)
      );

      // Lazy load content for matched documents, keeping metadata paired
      const resultsWithMeta = await Promise.all(
        metadataMatches.map(async meta => ({
          meta,
          doc: await this.loadDocContent(meta.url),
        }))
      );

      // Sort results using pre-computed lowercase fields from indexed metadata
      resultsWithMeta.sort((a, b) => {
        const aTitle = a.meta.titleLower.includes(lowercaseQuery);
        const bTitle = b.meta.titleLower.includes(lowercaseQuery);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;

        const aSection = a.meta.sectionLower.includes(lowercaseQuery);
        const bSection = b.meta.sectionLower.includes(lowercaseQuery);
        if (aSection && !bSection) return -1;
        if (!aSection && bSection) return 1;

        return 0;
      });

      const results = resultsWithMeta.map(entry => entry.doc);

      // Cache the results
      this.searchCache.set(query, results);
      
      const duration = performance.now() - startTime;
      this.stats.totalSearchTime += duration;
      this.stats.searches++;
      
      return results;
    } else {
      // Traditional mode: use indexed search
      if (this.indexedDocs.length === 0 && this.docsCache.size > 0) {
        this.buildSearchIndex();
      }
      
      const results = this.indexedDocs.filter(doc =>
        doc.titleLower.includes(lowercaseQuery) ||
        doc.contentLower.includes(lowercaseQuery) ||
        doc.sectionLower.includes(lowercaseQuery)
      ).sort((a, b) => {
        const aTitle = a.titleLower.includes(lowercaseQuery);
        const bTitle = b.titleLower.includes(lowercaseQuery);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;

        const aSection = a.sectionLower.includes(lowercaseQuery);
        const bSection = b.sectionLower.includes(lowercaseQuery);
        if (aSection && !bSection) return -1;
        if (!aSection && bSection) return 1;

        return 0;
      }) as TerragruntDoc[];
      
      // Cache the results
      this.searchCache.set(query, results);
      
      const duration = performance.now() - startTime;
      this.stats.totalSearchTime += duration;
      this.stats.searches++;
      
      return results;
    }
  }

  async getDocBySection(section: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    return docs.filter(doc => doc.section === section);
  }

  async getAvailableSections(): Promise<string[]> {
    const docs = await this.fetchLatestDocs();
    return Array.from(new Set(docs.map(doc => doc.section))).sort();
  }

  async getCliCommandHelp(command: string): Promise<TerragruntDoc | null> {
    const docs = await this.fetchLatestDocs();
    
    // Search in reference section for CLI commands
    const cliDocs = docs.filter(doc => 
      doc.section === 'reference' && 
      doc.url.includes('/cli/commands/')
    );

    // Try exact match first
    const exactMatch = cliDocs.find(doc => 
      doc.title.toLowerCase() === command.toLowerCase() ||
      doc.url.toLowerCase().includes(`/${command.toLowerCase()}/`) ||
      doc.url.toLowerCase().endsWith(`/${command.toLowerCase()}`)
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Try partial match
    const partialMatch = cliDocs.find(doc =>
      doc.title.toLowerCase().includes(command.toLowerCase()) ||
      doc.content.toLowerCase().includes(`${command} `)
    );

    return partialMatch || null;
  }

  async getHclConfigReference(blockOrAttribute: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    const query = blockOrAttribute.toLowerCase();

    // Search in reference section for HCL configuration
    const hclDocs = docs.filter(doc =>
      doc.section === 'reference' && (
        doc.url.includes('/hcl/blocks') ||
        doc.url.includes('/hcl/attributes') ||
        doc.url.includes('/hcl/functions') ||
        doc.url.includes('/config-blocks-and-attributes')
      )
    );

    // Find relevant docs
    return hclDocs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query)
    );
  }

  async getCodeExamples(topic: string): Promise<Array<{ doc: TerragruntDoc, examples: string[] }>> {
    const docs = await this.fetchLatestDocs();
    const query = topic.toLowerCase();
    const results: Array<{ doc: TerragruntDoc, examples: string[] }> = [];

    // Search docs that match the topic
    const relevantDocs = docs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query)
    );

    // Extract code examples from each relevant doc
    for (const doc of relevantDocs.slice(0, 10)) { // Limit to 10 docs
      const examples = this.extractCodeBlocks(doc.content);
      if (examples.length > 0) {
        results.push({ doc, examples });
      }
    }

    return results;
  }

  private extractCodeBlocks(content: string): string[] {
    const examples: string[] = [];
    
    // Match code blocks patterns in markdown-like content
    // Looking for common patterns like: "terragrunt", "terraform {", "remote_state {", etc.
    const codePatterns = [
      /terragrunt\s+\w+[^\n]*/gi,
      /terraform\s*{[\s\S]*?}/gi,
      /remote_state\s*{[\s\S]*?}/gi,
      /dependency\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /include\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /inputs\s*=\s*{[\s\S]*?}/gi,
    ];

    for (const pattern of codePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        examples.push(...matches.map(m => m.trim()));
      }
    }

    // Remove duplicates and limit
    return Array.from(new Set(examples)).slice(0, 5);
  }
}