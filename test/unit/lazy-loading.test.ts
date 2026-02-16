import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

// Mock environment variables for testing
const originalEnv = process.env;

describe('Single-Fetch Doc Loading', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
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
  });

  describe('Loading Metrics', () => {
    it('should track initial memory usage', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadingMetrics.initialMemoryMB).toBeGreaterThan(0);
    });

    it('should initialize metadataCount to zero', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadingMetrics.metadataCount).toBe(0);
    });

    it('should initialize startupTimeMs to zero', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadingMetrics.startupTimeMs).toBe(0);
    });
  });

  describe('assembleDoc', () => {
    it('should return doc with metadata and content from cache', () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.contentCache.set(url, 'Test content');

      const doc = manager.assembleDoc(url);
      expect(doc.content).toBe('Test content');
      expect(doc.title).toBe('Test Doc');
      expect(doc.section).toBe('test');
    });

    it('should return empty doc when metadata does not exist', () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/nonexistent';

      const result = manager.assembleDoc(url);
      
      expect(result.title).toBe('Unknown');
      expect(result.content).toBe('');
      expect(result.url).toBe(url);
      expect(result.section).toBe('unknown');
    });

    it('should return empty content when metadata exists but content is not cached', () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      // No content in contentCache

      const result = manager.assembleDoc(url);
      
      expect(result.content).toBe('');
      expect(result.title).toBe('Test Doc');
    });

    it('should return content when both metadata and content exist', () => {
      const manager = new TerragruntDocsManager() as any;
      const url = 'https://example.com/doc';
      const metadata = {
        title: 'Test Doc',
        url,
        section: 'test',
        lastUpdated: new Date().toISOString()
      };

      manager.metadataCache.set(url, metadata);
      manager.contentCache.set(url, 'Fetched content');

      const result = manager.assembleDoc(url);
      
      expect(result.title).toBe('Test Doc');
      expect(result.content).toBe('Fetched content');
    });
  });

  describe('assembleDocs', () => {
    it('should assemble all docs from metadata and content caches', () => {
      const manager = new TerragruntDocsManager() as any;
      
      manager.metadataCache.set('url1', { title: 'Doc 1', url: 'url1', section: 'test' });
      manager.metadataCache.set('url2', { title: 'Doc 2', url: 'url2', section: 'test' });
      manager.contentCache.set('url1', 'Content 1');
      manager.contentCache.set('url2', 'Content 2');

      const docs = manager.assembleDocs();
      
      expect(docs.length).toBe(2);
      expect(docs[0].title).toBe('Doc 1');
      expect(docs[0].content).toBe('Content 1');
      expect(docs[1].title).toBe('Doc 2');
      expect(docs[1].content).toBe('Content 2');
    });

    it('should return empty array when caches are empty', () => {
      const manager = new TerragruntDocsManager() as any;
      const docs = manager.assembleDocs();
      expect(docs).toEqual([]);
    });
  });

  describe('getCacheStats', () => {
    it('should include loading metrics in stats', () => {
      const manager = new TerragruntDocsManager() as any;
      const stats = manager.getCacheStats();
      
      expect(stats.loading).toBeDefined();
      expect(stats.loading.startupTimeMs).toBeDefined();
      expect(stats.loading.initialMemoryMB).toBeDefined();
      expect(stats.loading.metadataCount).toBeDefined();
    });

    it('should report cacheSize from metadataCache', () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });
      manager.metadataCache.set('doc2', { url: 'doc2', title: 'Doc 2', section: 'test' });

      const stats = manager.getCacheStats();
      
      expect(stats.cacheSize).toBe(2);
    });

    it('should dynamically update metadataCount in loading metrics', () => {
      const manager = new TerragruntDocsManager() as any;
      manager.metadataCache.set('doc1', { url: 'doc1', title: 'Doc 1', section: 'test' });

      const stats = manager.getCacheStats();
      
      expect(stats.loading.metadataCount).toBe(1);
    });
  });

  describe('Search', () => {
    it('should search indexed metadata', async () => {
      const manager = new TerragruntDocsManager() as any;
      
      // Mock fetchLatestDocs to prevent network access
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      manager.lastFetchTime = new Date();
      manager.searchCache.clear();
      
      // Add metadata and content
      manager.metadataCache.set('https://example.com/test', {
        url: 'https://example.com/test',
        title: 'Test Document',
        section: 'test',
        lastUpdated: new Date().toISOString()
      });
      manager.contentCache.set('https://example.com/test', 'Full content here');
      
      // Build indexed metadata for search
      manager.buildMetadataIndex();

      const results = await manager.searchDocs('Test');
      
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Test Document');
      expect(results[0].content).toBe('Full content here');
    });

    it('should prioritize title matches in search', async () => {
      const manager = new TerragruntDocsManager() as any;
      
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      manager.lastFetchTime = new Date();
      manager.searchCache.clear();
      
      manager.metadataCache.set('doc1', {
        url: 'doc1',
        title: 'Other Document',
        section: 'test-section',
      });
      manager.contentCache.set('doc1', 'content');
      
      manager.metadataCache.set('doc2', {
        url: 'doc2',
        title: 'Test in Title',
        section: 'other',
      });
      manager.contentCache.set('doc2', 'content');
      
      manager.buildMetadataIndex();

      const results = await manager.searchDocs('test');
      
      // Title match should come first
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Test in Title');
    });

    it('should only return matched documents', async () => {
      const manager = new TerragruntDocsManager() as any;
      
      manager.fetchLatestDocs = vi.fn().mockResolvedValue(undefined);
      manager.lastFetchTime = new Date();
      manager.searchCache.clear();
      
      manager.metadataCache.set('match', {
        url: 'match',
        title: 'Matching Doc',
        section: 'test',
      });
      manager.contentCache.set('match', 'content');
      
      manager.metadataCache.set('nomatch', {
        url: 'nomatch',
        title: 'Other Doc',
        section: 'other',
      });
      manager.contentCache.set('nomatch', 'content');
      
      manager.buildMetadataIndex();

      const results = await manager.searchDocs('Matching');
      
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Matching Doc');
    });
  });

  describe('Disk Cache', () => {
    it('should have loadCacheFromDisk method', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.loadCacheFromDisk).toBeDefined();
      expect(typeof manager.loadCacheFromDisk).toBe('function');
    });

    it('should have saveCacheToDisk method', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.saveCacheToDisk).toBeDefined();
      expect(typeof manager.saveCacheToDisk).toBe('function');
    });
  });

  describe('Performance Impact', () => {
    it('should track startup time', () => {
      const manager = new TerragruntDocsManager() as any;
      expect(manager.startTime).toBeGreaterThan(0);
    });
  });
});
