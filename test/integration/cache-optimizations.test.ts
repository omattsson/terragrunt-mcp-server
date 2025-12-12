import { describe, it, expect, beforeEach } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('Cache Optimizations', () => {
  let docsManager: TerragruntDocsManager;

  beforeEach(async () => {
    docsManager = new TerragruntDocsManager();
    // Load docs once to populate cache
    await docsManager.fetchLatestDocs();
  }, 60000); // 60 second timeout for network fetch

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      // Reset stats
      docsManager.resetStats();
      
      const initialStats = docsManager.getCacheStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      expect(initialStats.searches).toBe(0);
      
      // Perform a search
      await docsManager.searchDocs('dependencies');
      
      const stats = docsManager.getCacheStats();
      expect(stats.searches).toBeGreaterThan(0);
      expect(stats.totalSearchTime).toBeGreaterThan(0);
    });

    it('should track cache size and memory usage', async () => {
      const stats = docsManager.getCacheStats();
      
      expect(stats.cacheSize).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.lastRefresh).toBeDefined();
    });

    it('should update stats on each operation', async () => {
      docsManager.resetStats();
      
      // Perform multiple searches
      await docsManager.searchDocs('dependencies');
      await docsManager.searchDocs('remote state');
      await docsManager.searchDocs('hooks');
      
      const stats = docsManager.getCacheStats();
      expect(stats.searches).toBe(3);
      expect(stats.totalSearchTime).toBeGreaterThan(0);
    });
  });

  describe('Search Cache (LRU)', () => {
    it('should cache search results', async () => {
      docsManager.resetStats();
      
      // First search - should miss cache
      await docsManager.searchDocs('dependencies');
      const firstStats = docsManager.getCacheStats();
      expect(firstStats.misses).toBe(1);
      
      // Second same search - should hit cache
      await docsManager.searchDocs('dependencies');
      const secondStats = docsManager.getCacheStats();
      expect(secondStats.hits).toBe(1);
    });

    it('should return consistent results from cache', async () => {
      const result1 = await docsManager.searchDocs('remote state');
      const result2 = await docsManager.searchDocs('remote state');
      
      // Results should be identical
      expect(result1.length).toBe(result2.length);
      expect(result1.map(d => d.url)).toEqual(result2.map(d => d.url));
    });

    it('should cache multiple different queries', async () => {
      const queries = ['dependencies', 'remote state', 'hooks', 'terraform', 'inputs'];
      
      // First pass - all misses
      for (const query of queries) {
        await docsManager.searchDocs(query);
      }
      
      // Second pass - all hits
      docsManager.resetStats();
      for (const query of queries) {
        await docsManager.searchDocs(query);
      }
      
      const stats = docsManager.getCacheStats();
      expect(stats.hits).toBe(queries.length);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Search Index Optimization', () => {
    it('should search faster with pre-built index', async () => {
      // First search builds the index (if not already built)
      const start1 = performance.now();
      await docsManager.searchDocs('dependencies');
      
      // Create a new manager to test index building from scratch
      const freshManager = new TerragruntDocsManager();
      await freshManager.fetchLatestDocs();
      
      // Search without cached results (different query)
      const start2 = performance.now();
      await freshManager.searchDocs('unique-query-not-cached');
      const duration2 = performance.now() - start2;
      
      // Even first search should be reasonably fast with index
      expect(duration2).toBeLessThan(100); // Should be under 100ms
    });

    it('should handle large search queries efficiently', async () => {
      const longQuery = 'terragrunt configuration dependencies remote state backend terraform';
      
      const start = performance.now();
      const results = await docsManager.searchDocs(longQuery);
      const duration = performance.now() - start;
      
      expect(results).toBeInstanceOf(Array);
      expect(duration).toBeLessThan(50); // Should be very fast with index
    });

    it('should handle case-insensitive searches', async () => {
      const resultsLower = await docsManager.searchDocs('terragrunt');
      const resultsUpper = await docsManager.searchDocs('TERRAGRUNT');
      const resultsMixed = await docsManager.searchDocs('TerraGrunt');
      
      // Should return same results regardless of case
      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
    });
  });

  describe('Performance Improvements', () => {
    it('should show improved search times with cache', async () => {
      const query = 'dependencies';
      const iterations = 10;
      const times: number[] = [];
      
      // Run multiple searches
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await docsManager.searchDocs(query);
        times.push(performance.now() - start);
      }
      
      // Later searches should be faster than first (due to cache)
      const firstTime = times[0];
      const avgCachedTime = times.slice(1).reduce((a, b) => a + b, 0) / (iterations - 1);
      
      expect(avgCachedTime).toBeLessThan(firstTime);
    });

    it('should maintain performance with multiple concurrent searches', async () => {
      const queries = Array.from({ length: 20 }, (_, i) => `query-${i}`);
      
      const start = performance.now();
      await Promise.all(queries.map(q => docsManager.searchDocs(q)));
      const duration = performance.now() - start;
      
      // All searches should complete reasonably quickly
      expect(duration).toBeLessThan(500);
    });
  });
});
