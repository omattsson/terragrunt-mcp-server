import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { LRUCache } from 'lru-cache';
import { DocSearchIndex, buildSnippet } from './search-index.js';
import { TERRAGRUNT_DOC_MANIFEST } from './docs-manifest.js';

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

export interface CodeBlock {
  code: string;
  language: string;
}

/** A search result with its relevance score */
export interface RankedDoc {
  doc: TerragruntDoc;
  score: number;
}

interface CacheMetadata {
  lastFetchTime: string;
  docsCount: number;
  compressed?: boolean;
}

interface LoadingMetrics {
  startupTimeMs: number;
  /** Time to fetch all docs from llms.txt and build indexes */
  fetchAndIndexTime?: number;
  /** Time to build the full-text search index on the last load */
  searchIndexBuildTime?: number;
  initialMemoryMB: number;
  metadataCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  searches: number;
  totalSearchTime: number;
  lastRefresh: Date | null;
  cacheSize: number;
  memoryUsage: number;
  loading?: LoadingMetrics;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface FetchConfig {
  timeoutMs: number;
  maxBytes: number;
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonRetryableError(message: string): Error {
  const err = new Error(message);
  err.name = 'NonRetryableError';
  return err;
}

/**
 * Maps title patterns (case-insensitive regex) to Terragrunt doc sections.
 * Order matters: first match wins. More specific patterns should appear before general ones.
 */
export const SECTION_MAP: Array<{ pattern: RegExp; section: string; urlPrefix: string }> = [
  // Community pages
  { pattern: /^(Contributing|License|Support)$/i, section: 'community', urlPrefix: '/community' },

  // Getting started
  { pattern: /^(Install|Overview|Quick Start|Terminology)$/i, section: 'getting-started', urlPrefix: '/getting-started' },

  // Migration / tutorial: terralith-to-terragrunt guide
  { pattern: /^(Introduction|Setup|Step \d+[:\s].*|Wrap Up)$/i, section: 'migrate', urlPrefix: '/migrate/terralith-to-terragrunt' },

  // Migration guides (general)
  { pattern: /^(Bare Include|CLI Redesign|Migrating|Terragrunt Stacks|Upgrading|Terragrunt 1\.0 Guarantees)$/i, section: 'migrate', urlPrefix: '/migrate' },

  // Reference: CLI commands (stack subcommands)
  { pattern: /^(clean|generate|output|run)$/i, section: 'reference', urlPrefix: '/reference/cli/commands/stack' },

  // Reference: CLI commands
  { pattern: /^(bootstrap|delete|migrate|catalog|graph|exec|find|fmt|validate|print|list|OpenTofu Shortcuts|render|scaffold)$/i, section: 'reference', urlPrefix: '/reference/cli/commands' },
  { pattern: /^(Global Flags|CLI Rules)$/i, section: 'reference', urlPrefix: '/reference/cli' },

  // Reference: experiments
  { pattern: /^Experiments$/i, section: 'reference', urlPrefix: '/reference' },

  // Reference: HCL
  { pattern: /^(Attributes|Blocks|Functions)$/i, section: 'reference', urlPrefix: '/reference/hcl' },

  // Reference: other
  { pattern: /^(Lock File Handling|Releases)$/i, section: 'reference', urlPrefix: '/reference' },
  { pattern: /^(Formatting|Strict Controls)$/i, section: 'reference', urlPrefix: '/reference/logging' },

  // Troubleshooting
  { pattern: /^(OpenTofu and Terraform Version Compatibility|Terragrunt Cache|Debugging|OpenTelemetry|Performance)$/i, section: 'troubleshooting', urlPrefix: '/troubleshooting' },

  // Features (catch-all for remaining titles)
  { pattern: /./i, section: 'features', urlPrefix: '/features' },
];

const manifestTitleCounts = new Map<string, number>();
for (const [title] of TERRAGRUNT_DOC_MANIFEST) {
  manifestTitleCounts.set(title, (manifestTitleCounts.get(title) ?? 0) + 1);
}

/**
 * Manifest paths keyed two ways, so the parser can look up a page by the most
 * specific key first:
 * - `title\ndescription` for every entry (exact match on both heading and `>` line),
 * - `title` alone for titles that occur once in the manifest.
 */
const sourcePathsByTitleAndDescription = new Map<string, string>();
const sourcePathsByUniqueTitle = new Map<string, string>();
for (const [title, sourcePath, description] of TERRAGRUNT_DOC_MANIFEST) {
  sourcePathsByTitleAndDescription.set(`${title}\n${description ?? ''}`, sourcePath);
  if (manifestTitleCounts.get(title) === 1) {
    sourcePathsByUniqueTitle.set(title, sourcePath);
  }
}

/**
 * Detects the site preamble that starlight-llms-txt style generators put in
 * front of the first page: `# Terragrunt`, a site description and a line that
 * says "This is the abridged/full documentation". It is not a documentation page.
 */
const SITE_PREAMBLE_TITLE = 'Terragrunt';
const SITE_PREAMBLE_MARKER = /This is the (?:abridged|full) documentation/i;

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
  private readonly baseUrl = 'https://docs.terragrunt.com';
  private searchCache: LRUCache<string, RankedDoc[]>;
  private lastFetchTime: Date | null = null;
  private readonly cacheExpiry: number;
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private readonly metadataFile: string;
  private readonly fixtureFile: string;
  private readonly useCompression: boolean;
  
  // Indexed metadata and content caches (single-fetch llms.txt model)
  private metadataCache: Map<string, DocMetadata> = new Map();
  private searchIndex = new DocSearchIndex([]);
  private contentCache: Map<string, string> = new Map();
  private loadingMetrics: LoadingMetrics;
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
  private readonly fetchConfig: FetchConfig = {
    timeoutMs: positiveIntFromEnv('TERRAGRUNT_FETCH_TIMEOUT_MS', 10_000),
    maxBytes: positiveIntFromEnv('TERRAGRUNT_FETCH_MAX_BYTES', 16 * 1024 * 1024)
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
    
    // Store cache in project root under .cache/terragrunt-docs
    this.cacheDir = path.join(__dirname, '..', '..', '.cache', 'terragrunt-docs');
    this.cacheFile = path.join(this.cacheDir, this.useCompression ? 'docs-cache.json.gz' : 'docs-cache.json');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    this.fixtureFile = path.join(__dirname, '..', '..', 'fixtures', 'terragrunt-docs-fixture.json');
    
    // Initialize loading metrics
    this.loadingMetrics = {
      startupTimeMs: 0,
      initialMemoryMB: initialMemory,
      metadataCount: 0
    };
    
    // Initialize LRU cache for search results (max 100 searches, 5 min TTL)
    this.searchCache = new LRUCache<string, RankedDoc[]>({
      max: 100,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true
    });
  }

  /**
   * Get cache statistics for monitoring and optimization
   */
  getCacheStats(): CacheStats {
    const updatedMetrics: LoadingMetrics = {
      ...this.loadingMetrics,
      metadataCount: this.metadataCache.size
    };
    
    return {
      ...this.stats,
      cacheSize: this.metadataCache.size,
      memoryUsage: process.memoryUsage().heapUsed,
      lastRefresh: this.lastFetchTime,
      loading: updatedMetrics
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
      cacheSize: this.metadataCache.size,
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
          console.error(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${this.retryConfig.maxRetries + 1} attempts`);
  }

  private async loadFixture(): Promise<boolean> {
    try {
      console.error('Attempting to load fixture as fallback...');
      const fixtureExists = await fs.access(this.fixtureFile).then(() => true).catch(() => false);
      
      if (!fixtureExists) {
        console.warn('No fixture file found at:', this.fixtureFile);
        return false;
      }

      const fixtureContent = await fs.readFile(this.fixtureFile, 'utf-8');
      const docs: TerragruntDoc[] = JSON.parse(fixtureContent);

      this.metadataCache.clear();
      this.contentCache.clear();
      docs.forEach(doc => {
        this.metadataCache.set(doc.url, {
          title: doc.title,
          url: doc.url,
          section: doc.section,
          lastUpdated: doc.lastUpdated
        });
        if (doc.content != null) {
          this.contentCache.set(doc.url, doc.content);
        }
      });
      this.lastFetchTime = new Date(); // Mark as fresh to prevent immediate re-fetch
      
      // Build metadata index for fixture docs
      this.buildSearchIndex();

      console.error(`Loaded ${docs.length} docs from fixture (fallback mode)`);
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

  private async loadCacheFromDisk(options: { allowExpired?: boolean } = {}): Promise<boolean> {
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
        console.error('No disk cache found');
        this.stats.misses++;
        return false;
      }

      // Read metadata first
      const metadataContent = await fs.readFile(this.metadataFile, 'utf-8');
      const metadata: CacheMetadata = JSON.parse(metadataContent);

      // Check if cache is expired
      const cacheAge = Date.now() - new Date(metadata.lastFetchTime).getTime();
      if (cacheAge > this.cacheExpiry && !options.allowExpired) {
        console.error('Disk cache expired');
        this.stats.misses++;
        return false;
      }

      // Load docs from disk (with decompression if needed)
      let docsContent: string;
      const fileBuffer = await fs.readFile(cacheFileToLoad);
      
      if (cacheFileToLoad.endsWith('.gz')) {
        const decompressed = await gunzipAsync(fileBuffer);
        docsContent = decompressed.toString('utf-8');
        console.error(`Decompressed cache: ${fileBuffer.length} → ${decompressed.length} bytes`);
      } else {
        docsContent = fileBuffer.toString('utf-8');
      }
      
      const docs: TerragruntDoc[] = JSON.parse(docsContent);

      // Populate metadata and content caches from disk
      this.metadataCache.clear();
      this.contentCache.clear();
      docs.forEach(doc => {
        this.metadataCache.set(doc.url, {
          title: doc.title,
          url: doc.url,
          section: doc.section,
          lastUpdated: doc.lastUpdated
        });
        if (doc.content != null) {
          this.contentCache.set(doc.url, doc.content);
        }
      });
      
      // Detect stale disk caches from the old HTML-scraping era where docs
      // were saved with empty content. Treat as cache miss so we re-fetch.
      const hasNoContent = this.contentCache.size === 0 ||
        Array.from(this.contentCache.values()).every(c => c === '');
      if (this.metadataCache.size > 0 && hasNoContent) {
        console.warn('Disk cache has metadata but no meaningful content — treating as cache miss');
        this.metadataCache.clear();
        this.contentCache.clear();
        // Keep the search index consistent with the now-empty caches
        this.buildSearchIndex();
        this.lastFetchTime = null;
        this.stats.misses++;
        return false;
      }
      
      this.lastFetchTime = new Date(metadata.lastFetchTime);
      this.stats.hits++;
      
      // Build indexed metadata for optimized searches
      this.buildSearchIndex();
      
      // Calculate startup time
      this.loadingMetrics.startupTimeMs = performance.now() - this.startTime;
      
      console.error(`Loaded ${docs.length} docs from disk cache (${this.contentCache.size} with content, age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      
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
      
      // Assemble full docs from metadata + content caches
      docs = Array.from(this.metadataCache.values()).map(meta => {
        const content = this.contentCache.get(meta.url) || '';
        return { ...meta, content };
      });

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
        console.error(`Saved ${docs.length} docs to disk cache (compressed: ${jsonData.length} → ${compressed.length} bytes, ${Math.round(compressed.length / jsonData.length * 100)}%)`);
      } else {
        await this.atomicWriteFile(this.cacheFile, jsonData, 'utf-8');
        await this.atomicWriteFile(this.metadataFile, metadataJson, 'utf-8');
        console.error(`Saved ${docs.length} docs to disk cache`);
      }
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  async fetchLatestDocs(): Promise<TerragruntDoc[]> {
    // Try loading from disk cache first if in-memory cache is empty
    if (this.metadataCache.size === 0) {
      const loaded = await this.loadCacheFromDisk();
      if (loaded && !this.shouldRefreshCache()) {
        return this.assembleDocs();
      }
    }

    // Refresh if needed
    if (this.shouldRefreshCache()) {
      try {
        await this.refreshDocsCache();
      } catch (error) {
        console.error('All documentation fetch methods failed:', error);
        // If we have any docs in cache (even stale), return them
        if (this.metadataCache.size > 0) {
          console.error('Returning stale cached docs');
          return this.assembleDocs();
        }
        // Last resort: try fixture
        await this.loadFixture();
      }
    }
    
    return this.assembleDocs();
  }

  private shouldRefreshCache(): boolean {
    return !this.lastFetchTime ||
      Date.now() - this.lastFetchTime.getTime() > this.cacheExpiry;
  }

  private async refreshDocsCache(): Promise<void> {
    try {
      console.error('Refreshing Terragrunt documentation cache via llms.txt...');
      
      const refreshStartTime = performance.now();
      
      // Fetch all docs in a single HTTP request via llms.txt
      const docs = await this.fetchFromLlmsTxt();

      if (docs.length === 0) {
        throw new Error('fetchFromLlmsTxt returned no documents');
      }
      
      this.metadataCache.clear();
      this.contentCache.clear();
      
      // Populate metadata and content caches from llms.txt results
      for (const doc of docs) {
        this.metadataCache.set(doc.url, {
          title: doc.title,
          url: doc.url,
          section: doc.section,
          lastUpdated: doc.lastUpdated
        });
        this.contentCache.set(doc.url, doc.content);
      }

      this.lastFetchTime = new Date();
      this.stats.lastRefresh = this.lastFetchTime;
      
      // Build indexed metadata for optimized searches
      this.buildSearchIndex();
      
      const endTime = performance.now();
      this.loadingMetrics.fetchAndIndexTime = endTime - refreshStartTime;
      this.loadingMetrics.startupTimeMs = endTime - this.startTime;
      
      console.error(`Loaded ${this.metadataCache.size} docs from llms.txt in ${this.loadingMetrics.fetchAndIndexTime.toFixed(2)}ms`);
      
      // Save to disk after successful fetch
      await this.saveCacheToDisk();
    } catch (error) {
      console.error('Failed to refresh Terragrunt docs cache:', error);
      
      // Try loading from disk cache if available
      const diskCacheLoaded = await this.loadCacheFromDisk({ allowExpired: true });
      if (diskCacheLoaded) {
        console.error('Using stale disk cache due to fetch failure');
        return;
      }
      
      // Fall back to fixture as last resort
      const fixtureLoaded = await this.loadFixture();
      if (!fixtureLoaded) {
        throw new Error('Failed to load documentation from any source (network, disk cache, or fixture)', { cause: error });
      }
    }
  }



  /**
   * Assemble all docs from metadata + content caches.
   */
  private assembleDocs(): TerragruntDoc[] {
    return Array.from(this.metadataCache.values()).map(meta => ({
      ...meta,
      content: this.contentCache.get(meta.url) || ''
    }));
  }

  /**
   * Assemble a single doc from metadata + content caches.
   */
  private assembleDoc(url: string): TerragruntDoc {
    const metadata = this.metadataCache.get(url);
    if (!metadata) {
      return {
        title: 'Unknown',
        url,
        content: '',
        section: 'unknown',
        lastUpdated: new Date().toISOString()
      };
    }
    return { ...metadata, content: this.contentCache.get(url) || '' };
  }

  /**
   * Build the full-text search index from the metadata and content caches.
   * Called after every docs load; cached search results are dropped.
   */
  private buildSearchIndex(): void {
    const indexStart = performance.now();
    this.searchIndex = new DocSearchIndex(this.assembleDocs());
    this.searchCache.clear();
    this.loadingMetrics.searchIndexBuildTime = performance.now() - indexStart;
    console.error(`Built search index for ${this.searchIndex.size} documents in ${this.loadingMetrics.searchIndexBuildTime.toFixed(2)}ms`);
  }

  /**
   * Build a snippet of the content centred on the query's most specific word.
   */
  getSnippet(content: string, query: string, maxLength = 300): string {
    return buildSnippet(content, query, this.searchIndex, maxLength);
  }

  /**
   * Search the docs, best match first.
   */
  async searchDocs(query: string): Promise<TerragruntDoc[]> {
    return (await this.searchDocsRanked(query)).map(result => result.doc);
  }

  /**
   * Search the docs with relevance scores, best match first. Ranking is BM25
   * over the body plus title, URL, heading and section matches (see
   * DocSearchIndex). Only documents matching at least one query term are returned.
   */
  async searchDocsRanked(query: string): Promise<RankedDoc[]> {
    const startTime = performance.now();
    
    // Check LRU cache first, unless the docs are due for a refresh: cached
    // results would come from the old index and skip the refresh
    const cached = this.shouldRefreshCache() ? undefined : this.searchCache.get(query);
    if (cached) {
      this.stats.hits++;
      this.stats.searches++;
      return cached;
    }
    
    this.stats.misses++;
    
    // Ensure docs are loaded
    await this.fetchLatestDocs();

    let results: RankedDoc[];
    if (query === '') {
      // An empty query applies no filter: every doc, unranked
      results = this.assembleDocs().map(doc => ({ doc, score: 0 }));
    } else if (query.trim() === '') {
      // Whitespace has nothing to search for
      results = [];
    } else if (!/[a-z0-9]/i.test(query)) {
      // No words to rank (symbols such as "${" or "->", or a non-Latin script):
      // fall back to case-insensitive substring matching, unranked
      const needle = query.trim().toLowerCase();
      results = this.assembleDocs()
        .filter(doc => doc.content.toLowerCase().includes(needle) || doc.title.toLowerCase().includes(needle))
        .map(doc => ({ doc, score: 0 }));
    } else {
      results = this.searchIndex.search(query).map(hit => ({
        doc: this.assembleDoc(hit.url),
        score: hit.score
      }));
    }

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

  async getCodeExamples(topic: string): Promise<Array<{ doc: TerragruntDoc, examples: CodeBlock[] }>> {
    const results: Array<{ doc: TerragruntDoc, examples: CodeBlock[] }> = [];

    // Search docs that match the topic, best match first
    const relevantDocs = await this.searchDocs(topic);

    // Extract code examples from each relevant doc
    for (const doc of relevantDocs.slice(0, 10)) { // Limit to 10 docs
      const examples = this.extractCodeBlocks(doc.content);
      if (examples.length > 0) {
        results.push({ doc, examples });
      }
    }

    return results;
  }

  private extractCodeBlocks(content: string): CodeBlock[] {
    // First, try to extract fenced Markdown code blocks with language identifiers.
    // These are more accurate and carry language metadata.
    const fenced = this.extractFencedCodeBlocks(content);
    if (fenced.length > 0) {
      return fenced;
    }

    // Fallback: use plain-text regex patterns for legacy/fixture content
    // that doesn't have proper Markdown fencing.
    return this.extractCodeBlocksByPattern(content);
  }

  /**
   * Extract fenced code blocks (``` or ~~~) with optional language identifiers.
   * Supports both backtick and tilde fences, tolerates extra info on the fence
   * line (e.g., ```hcl title="example"), and handles \r\n line endings.
   * Returns CodeBlock[] with language metadata.
   */
  private extractFencedCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    // Match ```lang or ~~~lang fenced blocks, capturing the fence chars,
    // the optional language identifier, and the code body.
    // Tolerates extra text after the language on the opening fence line.
    const fenceRegex = /^((`{3,})|(~{3,}))(\w*)[^\n\r]*\r?\n([\s\S]*?)^(\2|\3)\s*$/gm;
    let match;

    while ((match = fenceRegex.exec(content)) !== null) {
      const language = match[4] || 'text';
      const code = match[5].trim();
      if (code.length > 0) {
        blocks.push({ code, language });
      }
    }

    // Remove duplicates (by code content) and limit to 5
    const seen = new Set<string>();
    const unique: CodeBlock[] = [];
    for (const block of blocks) {
      if (!seen.has(block.code)) {
        seen.add(block.code);
        unique.push(block);
      }
    }

    return unique.slice(0, 5);
  }

  /**
   * Fallback: extract code examples using HCL/Terragrunt-specific regex patterns.
   * Used for content without proper Markdown fenced code blocks.
   */
  private extractCodeBlocksByPattern(content: string): CodeBlock[] {
    const results: CodeBlock[] = [];
    
    // CLI command patterns → 'shell'
    const cliPatterns = [
      /terragrunt\s+\w+[^\n]*/gi,
    ];

    // HCL config block patterns → 'hcl'
    const hclPatterns = [
      /terraform\s*{[\s\S]*?}/gi,
      /remote_state\s*{[\s\S]*?}/gi,
      /dependency\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /include\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /inputs\s*=\s*{[\s\S]*?}/gi,
    ];

    const seen = new Set<string>();

    for (const pattern of cliPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          const code = m.trim();
          if (!seen.has(code)) {
            seen.add(code);
            results.push({ code, language: 'shell' });
          }
        }
      }
    }

    for (const pattern of hclPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const m of matches) {
          const code = m.trim();
          if (!seen.has(code)) {
            seen.add(code);
            results.push({ code, language: 'hcl' });
          }
        }
      }
    }

    return results.slice(0, 5);
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
        const { timeoutMs } = this.fetchConfig;
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
          if (!response.ok) {
            const status = response.status;
            const message = `HTTP ${status} ${response.statusText}`;
            // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
            if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
              throw nonRetryableError(message);
            }
            throw new Error(message);
          }
          return await this.readBodyWithLimit(response);
        } catch (error) {
          if (error instanceof Error && error.name === 'TimeoutError') {
            throw new Error(`Timed out after ${timeoutMs}ms`, { cause: error });
          }
          throw error;
        }
      }, `Fetching llms.txt from ${url}`);

      return this.parseLlmsMarkdown(markdown);
    } catch (error) {
      console.error(`Failed to fetch llms.txt from ${url}:`, error);
      return [];
    }
  }

  private async readBodyWithLimit(response: Response): Promise<string> {
    const { maxBytes } = this.fetchConfig;
    const tooLarge = () => nonRetryableError(`Response exceeds the ${maxBytes} bytes size cap (TERRAGRUNT_FETCH_MAX_BYTES)`);

    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw tooLarge();
    }
    if (!response.body) {
      return '';
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  /**
   * Parse raw Markdown from llms.txt into individual TerragruntDoc entries.
   * Splits on H1 (`# `) boundaries; each H1 becomes one doc.
   *
   * - A leading `<SYSTEM>...</SYSTEM>` block (old format) and a leading site
   *   preamble section (`# Terragrunt` plus "This is the abridged documentation",
   *   new format) are dropped; they are not pages.
   * - URLs come from `TERRAGRUNT_DOC_MANIFEST`: first by title and description,
   *   then by title alone when the title is unique in the manifest. Headings that
   *   are not in the manifest fall back to a `SECTION_MAP` guess and are reported
   *   once with `console.warn`.
   * - No two docs share a URL. If a manifest URL is already taken (for example two
   *   `# catalog` sections while the manifest knows only one), the later page
   *   takes a unique fallback URL, so it is never dropped when callers key a Map
   *   by `url`.
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
    const seenUrls = new Set<string>();
    const fallbackTitles: string[] = [];
    const parseTimestamp = new Date().toISOString();
    let isFirstPage = true;

    for (const section of sections) {
      // Extract the H1 line
      const headerMatch = section.match(/^# (.+)$/m);
      if (!headerMatch) {
        continue; // Skip chunks that don't start with a proper H1
      }

      const title = headerMatch[1].trim();
      // Content is everything after the H1 line
      const content = section.slice(headerMatch[0].length).trim();

      // Drop the site preamble, which only ever comes first.
      const isFirst = isFirstPage;
      isFirstPage = false;
      if (isFirst && title === SITE_PREAMBLE_TITLE && SITE_PREAMBLE_MARKER.test(content)) {
        continue;
      }

      const firstContentLine = content.split('\n').find(line => line.trim());
      const description = firstContentLine?.match(/^>\s*(.+)$/)?.[1].trim() ?? '';
      const sourcePath = sourcePathsByTitleAndDescription.get(`${title}\n${description}`)
        ?? sourcePathsByUniqueTitle.get(title);

      // Prefer the manifest URL unless another page already owns it.
      const manifestUrl = sourcePath ? `${this.baseUrl}${sourcePath}` : undefined;
      const mapping = this.inferSection(title);
      let url: string;
      let canonicalSection: string | undefined;
      if (sourcePath && manifestUrl && !seenUrls.has(manifestUrl)) {
        url = manifestUrl;
        canonicalSection = sourcePath.split('/')[1];
      } else {
        // Not in the manifest, or the manifest URL is taken: guess from SECTION_MAP
        // and make the URL unique with a counter.
        const slug = slugifyTitle(title);
        url = `${this.baseUrl}${mapping.urlPrefix}/${slug}/`;
        for (let counter = 2; seenUrls.has(url); counter++) {
          url = `${this.baseUrl}${mapping.urlPrefix}/${slug}-${counter}/`;
        }
        fallbackTitles.push(title);
      }
      seenUrls.add(url);

      docs.push({
        title,
        content,
        section: canonicalSection ?? mapping.section,
        url,
        lastUpdated: parseTimestamp,
      });
    }

    if (fallbackTitles.length > 0) {
      const shown = fallbackTitles.slice(0, 20).map(t => JSON.stringify(t)).join(', ');
      const more = fallbackTitles.length > 20 ? `, and ${fallbackTitles.length - 20} more` : '';
      console.warn(
        `${fallbackTitles.length} llms page(s) are not in the docs manifest (or share a manifest URL) and got a guessed URL: ${shown}${more}`,
      );
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
    return { section: 'general', urlPrefix: '' };
  }
}