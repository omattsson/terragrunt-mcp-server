import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

// Mock environment variables for testing
const originalEnv = process.env;

describe('Lazy Loading', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Configuration', () => {
    it('should enable lazy loading by default', () => {
      delete process.env.TERRAGRUNT_LAZY_LOADING;
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingEnabled).toBe(true);
    });

    it('should disable lazy loading when env var is false', () => {
      process.env.TERRAGRUNT_LAZY_LOADING = 'false';
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingEnabled).toBe(false);
    });

    it('should use minimal warmup strategy by default', () => {
      delete process.env.TERRAGRUNT_WARMUP_STRATEGY;
      const manager = new TerragruntDocsManager() as any;
      expect(manager.warmupStrategy).toBe('minimal');
    });

    it('should use configured warmup strategy', () => {
      process.env.TERRAGRUNT_WARMUP_STRATEGY = 'common';
      const manager = new TerragruntDocsManager() as any;
      expect(manager.warmupStrategy).toBe('common');
    });
  });

  describe('Metadata Cache', () => {
    it('should initialize empty metadata cache', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.metadataCache.size).toBe(0);
    });

    it('should initialize empty content cache', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.contentCache.size).toBe(0);
    });

    it('should initialize empty loading promises map', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadingPromises.size).toBe(0);
    });

    it('should initialize empty loaded docs set', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadedDocs.size).toBe(0);
    });
  });

  describe('Lazy Loading Metrics', () => {
    it('should initialize metrics with enabled flag', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingMetrics.enabled).toBe(true);
    });

    it('should track warmup strategy in metrics', () => {
      process.env.TERRAGRUNT_WARMUP_STRATEGY = 'full';
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingMetrics.warmupStrategy).toBe('full');
    });

    it('should initialize docsLoadedLazily counter to zero', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingMetrics.docsLoadedLazily).toBe(0);
    });

    it('should track initial memory usage', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingMetrics.initialMemoryMB).toBeGreaterThan(0);
    });
  });

  describe('loadDocContent', () => {
    it('should return cached content if already loaded', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };
      const content = 'Test content';

      manager.metadataCache.set(url, metadata);
      manager.contentCache.set(url, content);

      const doc = await manager.loadDocContent(url);
      expect(doc.content).toBe(content);
      expect(doc.title).toBe(metadata.title);
    });

    it('should deduplicate concurrent loads of same document', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);

      // Mock fetchSingleDocContent to return after delay
      let callCount = 0;
      manager.fetchSingleDocContent = vi.fn(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'Test content';
      });

      // Start multiple concurrent loads
      const promises = [
        manager.loadDocContent(url),
        manager.loadDocContent(url),
        manager.loadDocContent(url)
      ];

      const results = await Promise.all(promises);

      // Should only fetch once due to deduplication
      expect(callCount).toBe(1);
      expect(results[0].content).toBe('Test content');
      expect(results[1].content).toBe('Test content');
      expect(results[2].content).toBe('Test content');
    });

    it('should increment docsLoadedLazily counter', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.fetchSingleDocContent = vi.fn(async () => 'Test content');

      const initialCount = manager.lazyLoadingMetrics.docsLoadedLazily;
      await manager.loadDocContent(url);
      
      expect(manager.lazyLoadingMetrics.docsLoadedLazily).toBe(initialCount + 1);
    });

    it('should add URL to loadedDocs set', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.fetchSingleDocContent = vi.fn(async () => 'Test content');

      await manager.loadDocContent(url);
      
      expect(manager.loadedDocs.has(url)).toBe(true);
    });

    it('should store content in contentCache', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.fetchSingleDocContent = vi.fn(async () => 'Test content');

      await manager.loadDocContent(url);
      
      expect(manager.contentCache.get(url)).toBe('Test content');
    });

    it('should clean up loading promise after completion', async () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.fetchSingleDocContent = vi.fn(async () => 'Test content');

      await manager.loadDocContent(url);
      
      expect(manager.loadingPromises.has(url)).toBe(false);
    });
  });

  describe('getCommonSections', () => {
    it('should return list of common section URLs', () => {
      const manager = new TerragruntDocsManager() as any;
      const commonSections = manager.getCommonSections();
      
      expect(Array.isArray(commonSections)).toBe(true);
      expect(commonSections.length).toBeGreaterThan(0);
      expect(commonSections).toContain('getting-started');
    });

    it('should include essential documentation sections', () => {
      const manager = new TerragruntDocsManager() as any;
      const commonSections = manager.getCommonSections();
      
      expect(commonSections).toContain('getting-started');
      expect(commonSections).toContain('features/keep-your-terraform-code-dry');
      expect(commonSections).toContain('reference/config-blocks-and-attributes');
    });
  });

  describe('warmupCache', () => {
    it('should not load any docs with "none" strategy', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });
      manager.metadataCache.set('doc2', { url: 'doc2', title: 'Doc 2', section: 'test' });
      manager.loadDocContent = vi.fn();

      await manager.warmupCache('none');
      
      expect(manager.loadDocContent).not.toHaveBeenCalled();
    });

    it('should load first 3 docs with "minimal" strategy', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });
      manager.metadataCache.set('doc2', { url: 'doc2', title: 'Doc 2', section: 'test' });
      manager.metadataCache.set('doc3', { url: 'doc3', title: 'Doc 3', section: 'test' });
      manager.metadataCache.set('doc4', { url: 'doc4', title: 'Doc 4', section: 'test' });
      manager.loadDocContent = vi.fn().mockResolvedValue({ content: 'test' });

      await manager.warmupCache('minimal');
      
      expect(manager.loadDocContent).toHaveBeenCalledTimes(3);
    });

    it('should load common sections with "common" strategy', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('https://example.com/getting-started', {
        url: 'https://example.com/getting-started',
        title: 'Getting Started',
        section: 'getting-started'
      });
      manager.metadataCache.set('https://example.com/other', {
        url: 'https://example.com/other',
        title: 'Other',
        section: 'other'
      });
      manager.loadDocContent = vi.fn().mockResolvedValue({ content: 'test' });

      await manager.warmupCache('common');
      
      // Should only load docs matching common sections
      expect(manager.loadDocContent).toHaveBeenCalled();
      const calls = manager.loadDocContent.mock.calls;
      expect(calls.some((call: any) => call[0].includes('getting-started'))).toBe(true);
    });

    it('should load all docs with "full" strategy', async () => {
      const manager = new TerragruntDocsManager() as any;
      const docCount = 5;
      for (let i = 1; i <= docCount; i++) {
        manager.metadataCache.set(`doc${i}`, {
          url: `doc${i}`,
          title: `Doc ${i}`,
          section: 'test'
        });
      }
      manager.loadDocContent = vi.fn().mockResolvedValue({ content: 'test' });

      await manager.warmupCache('full');
      
      expect(manager.loadDocContent).toHaveBeenCalledTimes(docCount);
    });

    it('should track warmup time in metrics', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });
      manager.loadDocContent = vi.fn().mockResolvedValue({ content: 'test' });

      await manager.warmupCache('minimal');
      
      expect(manager.lazyLoadingMetrics.warmupTime).toBeGreaterThan(0);
    });
  });

  describe('getCacheStats with Lazy Loading', () => {
    it('should include lazy loading metrics in stats', () => {
      const manager = new TerragruntDocsManager() as any;
      const stats = manager.getCacheStats();
      
      expect(stats.lazyLoading).toBeDefined();
      expect(stats.lazyLoading.enabled).toBe(true);
    });

    it('should calculate loadedDocsRatio correctly', () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });
      manager.metadataCache.set('doc2', { url: 'doc2', title: 'Doc 2', section: 'test' });
      manager.loadedDocs.add('doc1');

      const stats = manager.getCacheStats();
      
      expect(stats.loadedDocsRatio).toBe(0.5); // 1 out of 2
    });

    it('should return 0 loadedDocsRatio when no metadata', () => {
      const manager = new TerragruntDocsManager() as any;
      const stats = manager.getCacheStats();
      
      expect(stats.loadedDocsRatio).toBe(0);
    });

    it('should include all lazy loading metrics fields', () => {
      const manager = new TerragruntDocsManager() as any;
      const stats = manager.getCacheStats();
      
      expect(stats.lazyLoading.enabled).toBeDefined();
      expect(stats.lazyLoading.startupTimeMs).toBeDefined();
      expect(stats.lazyLoading.initialMemoryMB).toBeDefined();
      expect(stats.lazyLoading.metadataCount).toBeDefined();
      expect(stats.lazyLoading.docsLoadedLazily).toBeDefined();
      expect(stats.lazyLoading.averageDocLoadTimeMs).toBeDefined();
      expect(stats.lazyLoading.warmupStrategy).toBeDefined();
    });
  });

  describe('Lazy Loading Search', () => {
    it('should search metadata when lazy loading enabled', async () => {
      process.env.TERRAGRUNT_LAZY_LOADING = 'true';
      process.env.TERRAGRUNT_WARMUP_STRATEGY = 'none';
      const manager = new TerragruntDocsManager() as any;
      
      // Mock fetchLatestDocs to prevent cache loading and warmup
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      
      // Set lastFetchTime to avoid refresh
      manager.lastFetchTime = new Date();
      
      // Clear search cache to avoid cached results
      manager.searchCache.clear();
      
      // Add metadata
      manager.metadataCache.set('https://example.com/test', {
        url: 'https://example.com/test',
        title: 'Test Document',
        section: 'test',
        lastUpdated: new Date().toISOString()
      });
      
      // Build indexed metadata for search
      manager.buildMetadataIndex();
      
      // Mock loadDocContent
      manager.loadDocContent = vi.fn().mockResolvedValue({
        url: 'https://example.com/test',
        title: 'Test Document',
        section: 'test',
        content: 'Full content here',
        lastUpdated: new Date().toISOString()
      });

      const results = await manager.searchDocs('Test');
      
      expect(results.length).toBe(1);
      expect(manager.loadDocContent).toHaveBeenCalledWith('https://example.com/test');
    });

    it('should prioritize title matches in lazy loading search', async () => {
      process.env.TERRAGRUNT_LAZY_LOADING = 'true';
      process.env.TERRAGRUNT_WARMUP_STRATEGY = 'none';
      const manager = new TerragruntDocsManager() as any;
      
      // Mock fetchLatestDocs to prevent cache loading and warmup
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      
      // Set lastFetchTime to avoid refresh
      manager.lastFetchTime = new Date();
      
      // Clear search cache to avoid cached results
      manager.searchCache.clear();
      
      manager.metadataCache.set('doc1', {
        url: 'doc1',
        title: 'Other Document',
        section: 'test-section',
      });
      
      manager.metadataCache.set('doc2', {
        url: 'doc2',
        title: 'Test in Title',
        section: 'other',
      });
      
      // Build indexed metadata for search
      manager.buildMetadataIndex();
      
      manager.loadDocContent = vi.fn().mockImplementation((url: string) => {
        const meta = manager.metadataCache.get(url);
        return Promise.resolve({ ...meta, content: 'content' });
      });

      const results = await manager.searchDocs('test');
      
      // Title match should come first
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Test in Title');
    });

    it('should only lazy load matched documents', async () => {
      process.env.TERRAGRUNT_LAZY_LOADING = 'true';
      process.env.TERRAGRUNT_WARMUP_STRATEGY = 'none';
      const manager = new TerragruntDocsManager() as any;
      
      // Mock fetchLatestDocs to prevent cache loading and warmup
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      
      // Set lastFetchTime to avoid refresh
      manager.lastFetchTime = new Date();
      
      // Clear search cache to avoid cached results
      manager.searchCache.clear();
      
      manager.metadataCache.set('match', {
        url: 'match',
        title: 'Matching Doc',
        section: 'test',
      });
      
      manager.metadataCache.set('nomatch', {
        url: 'nomatch',
        title: 'Other Doc',
        section: 'other',
      });
      
      // Build indexed metadata for search
      manager.buildMetadataIndex();
      
      manager.loadDocContent = vi.fn().mockImplementation((url: string) => {
        const meta = manager.metadataCache.get(url);
        return Promise.resolve({ ...meta, content: 'content' });
      });

      await manager.searchDocs('Matching');
      
      // Should only load the matching document
      expect(manager.loadDocContent).toHaveBeenCalledTimes(1);
      expect(manager.loadDocContent).toHaveBeenCalledWith('match');
    });
  });

  describe('Disk Cache with Lazy Loading', () => {
    it('should populate metadata cache when loading from disk in lazy mode', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.lazyLoadingEnabled = true;
      
      // This would need proper mocking of fs operations
      // Just checking the structure exists
      expect(manager.loadCacheFromDisk).toBeDefined();
    });

    it('should save combined metadata and content to disk', async () => {
      const manager = new TerragruntDocsManager() as any;
      manager.lazyLoadingEnabled = true;
      
      // This would need proper mocking of fs operations
      expect(manager.saveCacheToDisk).toBeDefined();
    });
  });

  describe('Performance Impact', () => {
    it('should track startup time', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.startTime).toBeGreaterThan(0);
    });

    it('should initialize with low metadata count', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.lazyLoadingMetrics.metadataCount).toBe(0);
    });
  });
});
