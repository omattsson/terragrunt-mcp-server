import fetch from 'node-fetch';
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
  /** Time to fetch all docs from llms.txt and build indexes (renamed from metadataOnlyLoadTime) */
  fetchAndIndexTime?: number;
  /** Time spent in warmup phase (now a no-op with llms.txt since all content is pre-loaded) */
  warmupTime?: number;
  initialMemoryMB: number;
  metadataCount: number;
  /**
   * Legacy metric from the HTML-scraping era. Always 0 with the llms.txt model
   * because all documents are fetched upfront in a single request rather than
   * loaded on-demand.
   */
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

/**
 * Maps title patterns (case-insensitive regex) to Terragrunt doc sections.
 * Order matters: first match wins. More specific patterns should appear before general ones.
 */
export const SECTION_MAP: Array<{ pattern: RegExp; section: string; urlPrefix: string }> = [
  // Community pages
  { pattern: /^(Contributing|License|Support)$/i, section: 'community', urlPrefix: '/docs/community' },

  // Getting started
  { pattern: /^(Install|Overview|Quick Start|Terminology)$/i, section: 'getting-started', urlPrefix: '/docs/getting-started' },

  // Migration / tutorial: terralith-to-terragrunt guide
  { pattern: /^(Introduction|Setup|Step \d+[:\s].*|Wrap Up)$/i, section: 'migrate', urlPrefix: '/docs/migrate/terralith-to-terragrunt' },

  // Migration guides (general)
  { pattern: /^(Bare Include|CLI Redesign|Migrating|Terragrunt Stacks|Upgrading|Terragrunt 1\.0 Guarantees)$/i, section: 'migrate', urlPrefix: '/docs/migrate' },

  // Reference: CLI commands (stack subcommands)
  { pattern: /^(clean|generate|output|run)$/i, section: 'reference', urlPrefix: '/docs/reference/cli/commands/stack' },

  // Reference: CLI commands
  { pattern: /^(bootstrap|delete|migrate|catalog|graph|exec|find|fmt|validate|print|list|OpenTofu Shortcuts|render|scaffold)$/i, section: 'reference', urlPrefix: '/docs/reference/cli/commands' },
  { pattern: /^(Global Flags|CLI Rules)$/i, section: 'reference', urlPrefix: '/docs/reference/cli' },

  // Reference: experiments
  { pattern: /^Experiments$/i, section: 'reference', urlPrefix: '/docs/reference' },

  // Reference: HCL
  { pattern: /^(Attributes|Blocks|Functions)$/i, section: 'reference', urlPrefix: '/docs/reference/hcl' },

  // Reference: other
  { pattern: /^(Lock File Handling|Releases)$/i, section: 'reference', urlPrefix: '/docs/reference' },
  { pattern: /^(Formatting|Strict Controls)$/i, section: 'reference', urlPrefix: '/docs/reference/logging' },

  // Troubleshooting
  { pattern: /^(OpenTofu and Terraform Version Compatibility|Terragrunt Cache|Debugging|OpenTelemetry|Performance)$/i, section: 'troubleshooting', urlPrefix: '/docs/troubleshooting' },

  // Features (catch-all for remaining titles)
  { pattern: /./i, section: 'features', urlPrefix: '/docs/features' },
];

/**
 * Convert a title string to a URL-friendly slug.
 * e.g., "Keep Your Code DRY" → "keep-your-code-dry"
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[()]/g, '')           // Remove parentheses
    .replace(/[^a-z0-9]+/g, '-')   // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');       // Trim leading/trailing hyphens
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
  private loadedDocs: Set<string> = new Set();
  private lazyLoadingMetrics: LazyLoadingMetrics;
  private readonly startTime: number;
  
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
    // Update metadataCount dynamically
    const updatedMetrics: LazyLoadingMetrics = {
      ...this.lazyLoadingMetrics,
      metadataCount: this.metadataCache.size,
      // averageDocLoadTimeMs is no longer meaningful with single-fetch llms.txt model
      averageDocLoadTimeMs: 0
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

        // Non-retryable errors should propagate immediately
        if (lastError.name === 'NonRetryableError') {
          throw lastError;
        }
        
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

      // Also populate lazy-loading caches so loadDocContent() works in lazy mode
      if (this.lazyLoadingEnabled) {
        this.metadataCache.clear();
        this.contentCache.clear();
        this.loadedDocs.clear();
        docs.forEach(doc => {
          this.metadataCache.set(doc.url, {
            title: doc.title,
            url: doc.url,
            section: doc.section,
            lastUpdated: doc.lastUpdated
          });
          if (doc.content != null) {
            this.contentCache.set(doc.url, doc.content);
            this.loadedDocs.add(doc.url);
          }
        });
        this.buildMetadataIndex();
      }

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
    // Keep track of the chosen cache file so we can clean it up if it is corrupt.
    let cacheFileToLoad = this.cacheFile;

    try {
      // Try loading compressed cache first if compression is enabled
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
        // Dual-cache (metadata-indexed) mode: populate metadata and content caches.
        // NOTE: "lazy loading" is a historical term from the HTML-scraping era.
        // With llms.txt, all content is fetched upfront; the dual-cache architecture
        // is retained for efficient metadata-based searching.
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
          
          // Populate contentCache if document has content (empty string is valid)
          if (doc.content != null) {
            this.contentCache.set(doc.url, doc.content);
            this.loadedDocs.add(doc.url);
          }
        });
        
        // Detect stale lazy-mode disk caches created by the old HTML-scraping implementation
        // where most docs were saved with content: ''. Treat as cache miss to force a fresh
        // llms.txt fetch rather than serving empty content until TTL expiry.
        if (this.metadataCache.size > 0 && this.contentCache.size === 0) {
          console.warn('Disk cache has metadata but no content (likely a stale lazy-mode cache from the HTML-scraping era) — treating as cache miss');
          this.metadataCache.clear();
          this.contentCache.clear();
          this.loadedDocs.clear();
          this.lastFetchTime = null;
          this.stats.misses++;
          return false;
        }
        
        this.lastFetchTime = new Date(metadata.lastFetchTime);
        this.stats.hits++;
        
        // Build indexed metadata for optimized searches
        this.buildMetadataIndex();
        
        console.log(`Loaded metadata for ${docs.length} docs from disk cache (${this.contentCache.size} with content, lazy mode, age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        
        // Warmup is effectively a no-op with the llms.txt model since all content
        // is already in contentCache. Retained for API/metrics compatibility.
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

      // If the cache file is corrupt/partial (common during concurrent writes),
      // remove it so the next attempt can recover cleanly.
      if (error instanceof SyntaxError || (error instanceof Error && /Unexpected end of JSON input/i.test(error.message))) {
        await Promise.all([
          fs.unlink(cacheFileToLoad).catch(() => undefined),
          // Also try removing the alternative cache file path if it exists
          this.useCompression
            ? fs.unlink(this.cacheFile.replace('.gz', '')).catch(() => undefined)
            : fs.unlink(`${this.cacheFile}.gz`).catch(() => undefined),
          fs.unlink(this.metadataFile).catch(() => undefined)
        ]);
      }

      this.stats.misses++;
      return false;
    }
  }

  private async atomicWriteFile(filePath: string, data: string | Buffer, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const tmpPath = path.join(
      dir,
      `${base}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );

    try {
      if (typeof data === 'string') {
        await fs.writeFile(tmpPath, data, encoding);
      } else {
        await fs.writeFile(tmpPath, data);
      }
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      await fs.unlink(tmpPath).catch(() => undefined);
      throw err;
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
      const metadataJson = JSON.stringify(metadata, null, 2);
      
      // Compress if enabled
      if (this.useCompression) {
        const compressed = await gzipAsync(jsonData);
        // Write cache atomically to avoid partial reads during parallel operations/tests.
        await this.atomicWriteFile(this.cacheFile, Buffer.from(compressed));
        await this.atomicWriteFile(this.metadataFile, metadataJson, 'utf-8');
        console.log(`Saved ${docs.length} docs to disk cache (compressed: ${jsonData.length} → ${compressed.length} bytes, ${Math.round(compressed.length / jsonData.length * 100)}%)`);
      } else {
        await this.atomicWriteFile(this.cacheFile, jsonData, 'utf-8');
        await this.atomicWriteFile(this.metadataFile, metadataJson, 'utf-8');
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
      console.log('Refreshing Terragrunt documentation cache via llms.txt...');
      
      // Fetch all docs in a single HTTP request via llms.txt
      const docs = await this.fetchFromLlmsTxt();

      if (docs.length === 0) {
        throw new Error('fetchFromLlmsTxt returned no documents');
      }
      
      this.docsCache.clear();
      this.metadataCache.clear();
      this.contentCache.clear();
      this.loadedDocs.clear();
      this.searchCache.clear();
      this.indexedDocs = [];
      this.indexedMetadata = [];

      const refreshStartTime = performance.now();
      
      if (this.lazyLoadingEnabled) {
        // Dual-cache (metadata-indexed) mode: populate metadata and content caches
        // from llms.txt results. All content is fetched upfront in a single request;
        // "lazy loading" is a historical term retained for configuration compatibility.
        for (const doc of docs) {
          const metadata: DocMetadata = {
            title: doc.title,
            url: doc.url,
            section: doc.section,
            lastUpdated: doc.lastUpdated
          };
          this.metadataCache.set(doc.url, metadata);
          this.contentCache.set(doc.url, doc.content);
          this.loadedDocs.add(doc.url);
        }

        this.lastFetchTime = new Date();
        this.stats.lastRefresh = this.lastFetchTime;
        
        const endTime = performance.now();
        this.lazyLoadingMetrics.fetchAndIndexTime = endTime - refreshStartTime;
        
        // Build indexed metadata for optimized searches
        this.buildMetadataIndex();
        
        // No documents are lazily loaded during llms.txt refresh; all docs are fetched upfront
        this.lazyLoadingMetrics.docsLoadedLazily = 0;
        
        console.log(`Loaded ${this.metadataCache.size} docs from llms.txt in ${this.lazyLoadingMetrics.fetchAndIndexTime.toFixed(2)}ms (indexed mode)`);
        
        // Warmup is effectively a no-op with the llms.txt model since all content
        // is already in contentCache. Retained for API/metrics compatibility.
        await this.warmupCache(this.warmupStrategy);
        
        // Calculate startup time (including warmup)
        this.lazyLoadingMetrics.startupTimeMs = performance.now() - this.startTime;
        
      } else {
        // Traditional mode: populate docsCache directly
        for (const doc of docs) {
          this.docsCache.set(doc.url, doc);
        }

        this.lastFetchTime = new Date();
        this.stats.lastRefresh = this.lastFetchTime;
        
        // Build search index from fetched docs
        this.buildSearchIndex();
        
        console.log(`Cached ${this.docsCache.size} documentation pages from llms.txt`);
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



  /**
   * Look up full content for a specific document by URL.
   * With llms.txt, all content is fetched upfront so this is a pure cache lookup.
   */
  private async loadDocContent(url: string): Promise<TerragruntDoc> {
    const cachedContent = this.contentCache.get(url);
    const metadata = this.metadataCache.get(url);

    if (metadata && cachedContent !== undefined) {
      return { ...metadata, content: cachedContent };
    }

    if (cachedContent !== undefined && !metadata) {
      console.warn(`[LazyLoading] Inconsistent state: content exists for ${url} but metadata is missing`);
      return this.createEmptyDoc(url);
    }

    if (metadata && cachedContent === undefined) {
      // Metadata exists but content was not populated (e.g., partial disk cache).
      // Return doc with empty content rather than fetching HTML.
      return { ...metadata, content: '' };
    }

    // Fallback: check docsCache (populated by loadFixture or traditional mode).
    // This ensures fixture docs are usable even when lazy-loading caches are empty.
    const fixtureDoc = this.docsCache.get(url);
    if (fixtureDoc) {
      // Hydrate lazy-loading caches for future lookups
      this.metadataCache.set(url, {
        title: fixtureDoc.title,
        url: fixtureDoc.url,
        section: fixtureDoc.section,
        lastUpdated: fixtureDoc.lastUpdated
      });
      this.contentCache.set(url, fixtureDoc.content);
      this.loadedDocs.add(url);
      return fixtureDoc;
    }

    return this.createEmptyDoc(url);
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
      // Lazy loading mode: search indexed metadata (pre-computed lowercase fields),
      // then load full content on-demand for matched documents
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

  /**
   * Fetch and parse the llms.txt endpoint into TerragruntDoc[].
   * Uses TERRAGRUNT_LLMS_SOURCE env var to override the default URL.
   * The env var accepts an absolute URL (with scheme) or a path/filename
   * relative to the base URL (e.g., "llms-full.txt" or "/llms-full.txt").
   * Never throws — returns empty array and logs on failure.
   */
  async fetchFromLlmsTxt(): Promise<TerragruntDoc[]> {
    const defaultUrl = `${this.baseUrl}/llms-small.txt`;
    const source = process.env.TERRAGRUNT_LLMS_SOURCE;

    let url: string;
    if (!source) {
      url = defaultUrl;
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(source)) {
      // Absolute URL (has a scheme) — use as-is
      url = source;
    } else {
      // Relative path or filename — resolve against baseUrl
      const normalizedPath = source.startsWith('/') ? source : `/${source}`;
      url = `${this.baseUrl}${normalizedPath}`;
    }

    try {
      const markdown = await this.retryWithBackoff(async () => {
        const response = await fetch(url);
        if (!response.ok) {
          const status = response.status;
          const message = `HTTP ${status} ${response.statusText}`;
          // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            const err = new Error(message);
            err.name = 'NonRetryableError';
            throw err;
          }
          throw new Error(message);
        }
        return await response.text();
      }, `Fetching llms.txt from ${url}`);

      return this.parseLlmsMarkdown(markdown);
    } catch (error) {
      console.error(`Failed to fetch llms.txt from ${url}:`, error);
      return [];
    }
  }

  /**
   * Parse raw Markdown from llms.txt into individual TerragruntDoc entries.
   * Splits on H1 (`# `) boundaries; each H1 becomes one doc.
   *
   * @param markdown - Raw Markdown string (e.g., fetched from llms-small.txt)
   * @returns Array of TerragruntDoc objects with title, content, section, and url
   */
  parseLlmsMarkdown(markdown: string): TerragruntDoc[] {
    if (!markdown || !markdown.trim()) {
      return [];
    }

    // Strip optional <SYSTEM>...</SYSTEM> preamble
    const cleaned = markdown.replace(/^<SYSTEM>[\s\S]*?<\/SYSTEM>\s*/i, '');

    // Split on H1 boundaries while ignoring `# ` lines inside fenced code blocks.
    // This avoids corrupting sections when shell/HCL comments appear in code fences.
    const sectionChunks: string[] = [];
    const currentSectionLines: string[] = [];
    const lines = cleaned.split('\n');
    let inFence = false;

    for (const line of lines) {
      // Detect fenced code block boundaries (``` or ~~~, possibly with language spec)
      if (/^(```+|~~~+)/.test(line)) {
        inFence = !inFence;
      }

      // Start a new section on H1 only when not inside a fenced code block
      if (!inFence && line.startsWith('# ')) {
        if (currentSectionLines.length > 0) {
          sectionChunks.push(currentSectionLines.join('\n'));
          currentSectionLines.length = 0;
        }
      }

      currentSectionLines.push(line);
    }

    if (currentSectionLines.length > 0) {
      sectionChunks.push(currentSectionLines.join('\n'));
    }

    const sections = sectionChunks.filter(s => s.trim());

    const docs: TerragruntDoc[] = [];
    const seenSlugs = new Set<string>();
    const parseTimestamp = new Date().toISOString();

    for (const section of sections) {
      // Extract the H1 line
      const headerMatch = section.match(/^# (.+)$/m);
      if (!headerMatch) {
        continue; // Skip chunks that don't start with a proper H1
      }

      const title = headerMatch[1].trim();
      // Content is everything after the H1 line
      const content = section.slice(headerMatch[0].length).trim();

      // Infer section and URL prefix from SECTION_MAP
      const mapping = this.inferSection(title);
      const slug = slugifyTitle(title);

      // Handle duplicate slugs by appending a counter
      let uniqueSlug = slug;
      if (seenSlugs.has(slug)) {
        let counter = 2;
        while (seenSlugs.has(`${slug}-${counter}`)) {
          counter++;
        }
        uniqueSlug = `${slug}-${counter}`;
      }
      seenSlugs.add(uniqueSlug);

      const url = `${this.baseUrl}${mapping.urlPrefix}/${uniqueSlug}/`;

      docs.push({
        title,
        content,
        section: mapping.section,
        url,
        lastUpdated: parseTimestamp,
      });
    }

    return docs;
  }

  /**
   * Infer the doc section and URL prefix for a given title using SECTION_MAP.
   */
  private inferSection(title: string): { section: string; urlPrefix: string } {
    for (const entry of SECTION_MAP) {
      if (entry.pattern.test(title)) {
        return { section: entry.section, urlPrefix: entry.urlPrefix };
      }
    }
    // Fallback (shouldn't reach here since SECTION_MAP has a catch-all)
    return { section: 'general', urlPrefix: '/docs' };
  }
}