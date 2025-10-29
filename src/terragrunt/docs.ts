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

export interface TerragruntDoc {
  title: string;
  url: string;
  content: string;
  section: string;
  lastUpdated?: string;
}

interface IndexedDoc extends TerragruntDoc {
  titleLower: string;
  contentLower: string;
  sectionLower: string;
}

interface CacheMetadata {
  lastFetchTime: string;
  docsCount: number;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  searches: number;
  totalSearchTime: number;
  lastRefresh: Date | null;
  cacheSize: number;
  memoryUsage: number;
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
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  };

  constructor() {
    // Get the directory where this file is located
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Configurable cache TTL (default 24 hours)
    const ttlHours = process.env.TERRAGRUNT_CACHE_TTL_HOURS 
      ? parseInt(process.env.TERRAGRUNT_CACHE_TTL_HOURS, 10)
      : 24;
    this.cacheExpiry = ttlHours * 60 * 60 * 1000;
    
    // Enable compression by default (can disable with env var)
    this.useCompression = process.env.TERRAGRUNT_CACHE_COMPRESSION !== 'false';
    
    // Store cache in project root under .cache/terragrunt-docs
    this.cacheDir = path.join(__dirname, '..', '..', '.cache', 'terragrunt-docs');
    this.cacheFile = path.join(this.cacheDir, this.useCompression ? 'docs-cache.json.gz' : 'docs-cache.json');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.fixtureFile = path.join(__dirname, '..', '..', 'fixtures', 'terragrunt-docs-fixture.json');
    
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
    return {
      ...this.stats,
      cacheSize: this.docsCache.size,
      memoryUsage: process.memoryUsage().heapUsed,
      lastRefresh: this.lastFetchTime
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

      // Populate in-memory cache and build search index
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

      const docs = Array.from(this.docsCache.values());
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
    if (this.docsCache.size === 0) {
      const loaded = await this.loadCacheFromDisk();
      if (loaded && !this.shouldRefreshCache()) {
        return Array.from(this.docsCache.values());
      }
    }

    // Refresh if needed
    if (this.shouldRefreshCache()) {
      try {
        await this.refreshDocsCache();
      } catch (error) {
        console.error('All documentation fetch methods failed:', error);
        // If we have any docs in cache (even stale), return them
        if (this.docsCache.size > 0) {
          console.log('Returning stale cached docs');
          return Array.from(this.docsCache.values());
        }
        // Last resort: try fixture
        await this.loadFixture();
      }
    }
    
    return Array.from(this.docsCache.values());
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

      // Fetch each page with retry logic
      for (const page of docPages) {
        try {
          const doc = await this.retryWithBackoff(
            () => this.fetchDocumentPage(page),
            `Fetching ${page.url}`
          );
          if (doc) {
            this.docsCache.set(doc.url, doc);
          }
        } catch (_error) {
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

      // Extract main content from various possible containers
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

      if (!content) {
        console.warn(`No content found for ${page.url}`);
        return null;
      }

      return {
        title: page.title,
        url: page.url,
        content: this.cleanContent(content),
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
      const duration = performance.now() - startTime;
      this.stats.totalSearchTime += duration;
      this.stats.searches++;
      return cached;
    }
    
    this.stats.misses++;
    
    // Ensure docs are loaded
    await this.fetchLatestDocs();
    
    // Use indexed search if available, otherwise build index
    if (this.indexedDocs.length === 0 && this.docsCache.size > 0) {
      this.buildSearchIndex();
    }
    
    const lowercaseQuery = query.toLowerCase();

    // Search using pre-computed lowercase strings
    const results = this.indexedDocs.filter(doc =>
      doc.titleLower.includes(lowercaseQuery) ||
      doc.contentLower.includes(lowercaseQuery) ||
      doc.sectionLower.includes(lowercaseQuery)
    ).sort((a, b) => {
      // Prioritize title matches
      const aTitle = a.titleLower.includes(lowercaseQuery);
      const bTitle = b.titleLower.includes(lowercaseQuery);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;

      // Then prioritize section matches
      const aSection = a.sectionLower.includes(lowercaseQuery);
      const bSection = b.sectionLower.includes(lowercaseQuery);
      if (aSection && !bSection) return -1;
      if (!aSection && bSection) return 1;

      return 0;
    }).map(doc => ({
      title: doc.title,
      url: doc.url,
      content: doc.content,
      section: doc.section,
      lastUpdated: doc.lastUpdated
    }));
    
    // Cache the results
    this.searchCache.set(query, results);
    
    const duration = performance.now() - startTime;
    this.stats.totalSearchTime += duration;
    this.stats.searches++;
    
    return results;
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