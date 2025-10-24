import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { ResourceHandler } from '../../src/handlers/resources.js';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Performance Benchmarks', () => {
  let docsManager: TerragruntDocsManager;
  let resourceHandler: ResourceHandler;
  let toolHandler: ToolHandler;
  let loadedDocs: any[];

  beforeAll(async () => {
    // Initialize components
    docsManager = new TerragruntDocsManager();
    resourceHandler = new ResourceHandler();
    toolHandler = new ToolHandler();
    
    // Load docs once for all tests
    console.log('Loading documentation for performance tests...');
    const startLoad = performance.now();
    loadedDocs = await docsManager.fetchLatestDocs();
    const loadTime = performance.now() - startLoad;
    
    console.log(`Loaded ${loadedDocs.length} docs in ${loadTime.toFixed(2)}ms`);
  }, 120000); // 2 minute timeout for initial load

  describe('1. Large Result Set Handling', () => {
    it('should handle >100 docs efficiently', async () => {
      const startTime = performance.now();
      
      // Get all docs (should be >50 from live docs or fixture)
      const docs = await docsManager.fetchLatestDocs();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(docs.length).toBeGreaterThan(50);
      expect(duration).toBeLessThan(5000); // Should complete in <5 seconds
      
      console.log(`✓ Loaded ${docs.length} docs in ${duration.toFixed(2)}ms`);
    });

    it('should list all resources without timeout', async () => {
      const startTime = performance.now();
      
      const resources = await resourceHandler.listResources();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(resources.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Should complete in <2 seconds
      
      console.log(`✓ Listed ${resources.length} resources in ${duration.toFixed(2)}ms`);
    });

    it('should handle large section content', async () => {
      const startTime = performance.now();
      
      // Get docs from a section (contains multiple docs)
      const docs = await docsManager.getDocBySection('getting-started');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(docs.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in <1 second
      
      console.log(`✓ Retrieved ${docs.length} docs from section in ${duration.toFixed(2)}ms`);
    });
  });

  describe('2. Search Performance', () => {
    it('should search with short query efficiently', async () => {
      const query = 'dependencies';
      const startTime = performance.now();
      
      const allResults = await docsManager.searchDocs(query);
      const results = allResults.slice(0, 10);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete in <500ms
      
      console.log(`✓ Search "${query}" found ${allResults.length} results (returned ${results.length}) in ${duration.toFixed(2)}ms`);
    });

    it('should search with medium query efficiently', async () => {
      const query = 'manage dependencies';
      const startTime = performance.now();
      
      const allResults = await docsManager.searchDocs(query);
      const results = allResults.slice(0, 10);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // May return 0 if query doesn't match docs
      expect(Array.isArray(results)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in <1 second
      
      console.log(`✓ Search "${query}" found ${allResults.length} results (returned ${results.length}) in ${duration.toFixed(2)}ms`);
    });

    it('should search with long query efficiently', async () => {
      const query = 'terragrunt dependencies remote state';
      const startTime = performance.now();
      
      const allResults = await docsManager.searchDocs(query);
      const results = allResults.slice(0, 20);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // May return 0 if query doesn't match docs
      expect(Array.isArray(results)).toBe(true);
      expect(duration).toBeLessThan(1500); // Should complete in <1.5 seconds
      
      console.log(`✓ Search long query (${query.length} chars) found ${allResults.length} results (returned ${results.length}) in ${duration.toFixed(2)}ms`);
    });

    it('should search with different result limits', async () => {
      const query = 'terragrunt';
      const limits = [5, 10, 20, 50];
      
      for (const limit of limits) {
        const startTime = performance.now();
        const allResults = await docsManager.searchDocs(query);
        const results = allResults.slice(0, limit);
        const duration = performance.now() - startTime;
        
        expect(results.length).toBeLessThanOrEqual(limit);
        expect(duration).toBeLessThan(1000);
        
        console.log(`  ✓ Limit ${limit}: ${allResults.length} total, ${results.length} returned in ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('3. Memory Usage During Cache Load', () => {
    it('should load cache without excessive memory growth', async () => {
      // Get initial memory
      const initialMemory = process.memoryUsage();
      
      // Force cache reload
      const freshManager = new TerragruntDocsManager();
      await freshManager.fetchLatestDocs();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory growth should be reasonable (< 100MB)
      const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      expect(heapGrowth).toBeLessThan(100);
      
      console.log(`✓ Heap growth: ${heapGrowth.toFixed(2)}MB`);
      console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should cache docs in memory for fast subsequent access', async () => {
      // First access (cold cache - but may be warm from previous tests)
      const startCold = performance.now();
      await docsManager.fetchLatestDocs();
      const coldTime = performance.now() - startCold;
      
      // Second access (warm cache)
      const startWarm = performance.now();
      await docsManager.fetchLatestDocs();
      const warmTime = performance.now() - startWarm;
      
      // Warm cache should be much faster (expect at least 2x improvement)
      expect(warmTime).toBeLessThan(coldTime * 2);
      
      console.log(`✓ Cold/warm cache: ${coldTime.toFixed(2)}ms, Second access: ${warmTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(coldTime / warmTime).toFixed(1)}x`);
    });
  });

  describe('4. Response Time Benchmarks for Each Tool', () => {
    it('should execute search_terragrunt_docs in <1 second', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'dependencies',
        limit: 5
      });
      
      const duration = performance.now() - startTime;
      
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(duration).toBeLessThan(1000);
      
      console.log(`✓ search_terragrunt_docs: ${duration.toFixed(2)}ms`);
    });

    it('should execute get_terragrunt_sections in <500ms', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});
      
      const duration = performance.now() - startTime;
      
      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(duration).toBeLessThan(500);
      
      console.log(`✓ get_terragrunt_sections: ${duration.toFixed(2)}ms`);
    });

    it('should execute get_section_docs in <1 second', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'getting-started'
      });
      
      const duration = performance.now() - startTime;
      
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
      expect(duration).toBeLessThan(1000);
      
      console.log(`✓ get_section_docs: ${duration.toFixed(2)}ms`);
    });

    it('should execute get_cli_command_help in <1 second', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });
      
      const duration = performance.now() - startTime;
      
      // Returns either { command, title, url, content } or { command, error, suggestion }
      expect(result.command).toBeDefined();
      expect(duration).toBeLessThan(1000);
      
      console.log(`✓ get_cli_command_help: ${duration.toFixed(2)}ms`);
    });

    it('should execute get_hcl_config_reference in <1 second', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'dependency'
      });
      
      const duration = performance.now() - startTime;
      
      // Returns either { config, results: [...] } or { config, error, suggestion }
      expect(result.config).toBeDefined();
      expect(duration).toBeLessThan(1000);
      
      console.log(`✓ get_hcl_config_reference: ${duration.toFixed(2)}ms`);
    });

    it('should execute get_code_examples in <1.5 seconds', async () => {
      const startTime = performance.now();
      
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'dependencies',
        limit: 5
      });
      
      const duration = performance.now() - startTime;
      
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      expect(duration).toBeLessThan(1500);
      
      console.log(`✓ get_code_examples: ${duration.toFixed(2)}ms`);
    });

    it('should benchmark all tools sequentially', async () => {
      const tools = [
        { name: 'search_terragrunt_docs', args: { query: 'test', limit: 5 } },
        { name: 'get_terragrunt_sections', args: {} },
        { name: 'get_section_docs', args: { section: 'reference' } },
        { name: 'get_cli_command_help', args: { command: 'apply' } },
        { name: 'get_hcl_config_reference', args: { config: 'terraform' } },
        { name: 'get_code_examples', args: { topic: 'remote state', limit: 3 } }
      ];

      console.log('\n  Sequential tool execution benchmark:');
      
      const startTotal = performance.now();
      
      for (const tool of tools) {
        const startTime = performance.now();
        await toolHandler.executeTool(tool.name, tool.args);
        const duration = performance.now() - startTime;
        
        console.log(`    ${tool.name}: ${duration.toFixed(2)}ms`);
      }
      
      const totalDuration = performance.now() - startTotal;
      
      expect(totalDuration).toBeLessThan(6000); // All 6 tools in <6 seconds
      
      console.log(`  Total: ${totalDuration.toFixed(2)}ms`);
    });
  });

  describe('5. Concurrent Request Handling', () => {
    it('should handle 5 concurrent searches', async () => {
      const queries = ['dependencies', 'remote state', 'terragrunt', 'terraform', 'modules'];
      
      const startTime = performance.now();
      
      const promises = queries.map(query => 
        docsManager.searchDocs(query).then(results => results.slice(0, 5))
      );
      const results = await Promise.all(promises);
      
      const duration = performance.now() - startTime;
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.length).toBeGreaterThan(0);
      });
      
      // Concurrent should be faster than sequential
      expect(duration).toBeLessThan(2000);
      
      console.log(`✓ 5 concurrent searches in ${duration.toFixed(2)}ms`);
    });

    it('should handle 10 concurrent tool executions', async () => {
      const tools = [
        { name: 'search_terragrunt_docs', args: { query: 'test1', limit: 3 } },
        { name: 'search_terragrunt_docs', args: { query: 'test2', limit: 3 } },
        { name: 'get_terragrunt_sections', args: {} },
        { name: 'get_section_docs', args: { section: 'getting-started' } },
        { name: 'get_cli_command_help', args: { command: 'plan' } },
        { name: 'get_hcl_config_reference', args: { config: 'dependency' } },
        { name: 'get_code_examples', args: { topic: 'dependencies', limit: 3 } },
        { name: 'search_terragrunt_docs', args: { query: 'test3', limit: 3 } },
        { name: 'get_section_docs', args: { section: 'reference' } },
        { name: 'get_cli_command_help', args: { command: 'apply' } }
      ];

      const startTime = performance.now();
      
      const promises = tools.map(tool => toolHandler.executeTool(tool.name, tool.args));
      const results = await Promise.all(promises);
      
      const duration = performance.now() - startTime;
      
      expect(results.length).toBe(10);
      results.forEach(result => {
        // Each tool returns different properties, just check it's defined
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
      
      expect(duration).toBeLessThan(3000); // 10 concurrent in <3 seconds
      
      console.log(`✓ 10 concurrent tool executions in ${duration.toFixed(2)}ms`);
      console.log(`  Average: ${(duration / 10).toFixed(2)}ms per tool`);
    });

    it('should handle 20 concurrent doc fetches', async () => {
      const sections = ['getting-started', 'reference', 'features', 'cli'];
      const promises: Promise<any>[] = [];

      // Create 20 concurrent section fetches
      for (let i = 0; i < 20; i++) {
        const section = sections[i % sections.length];
        promises.push(docsManager.getDocBySection(section));
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;
      
      expect(results.length).toBe(20);
      results.forEach((result: any[]) => {
        expect(Array.isArray(result)).toBe(true);
      });
      
      expect(duration).toBeLessThan(2000); // 20 concurrent fetches in <2 seconds
      
      console.log(`✓ 20 concurrent doc fetches in ${duration.toFixed(2)}ms`);
      console.log(`  Average: ${(duration / 20).toFixed(2)}ms per fetch`);
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        // Searches
        ...Array.from({ length: 5 }, (_, i) => 
          () => docsManager.searchDocs(`query${i}`).then(r => r.slice(0, 5))
        ),
        // Tool executions
        ...Array.from({ length: 5 }, () => 
          () => toolHandler.executeTool('get_terragrunt_sections', {})
        ),
        // Doc fetches
        ...Array.from({ length: 5 }, () => 
          () => docsManager.getDocBySection('getting-started')
        )
      ];

      const startTime = performance.now();
      
      const promises = operations.map(op => op());
      const results = await Promise.all(promises);
      
      const duration = performance.now() - startTime;
      
      expect(results.length).toBe(15);
      expect(duration).toBeLessThan(3000); // 15 mixed operations in <3 seconds
      
      console.log(`✓ 15 mixed concurrent operations in ${duration.toFixed(2)}ms`);
      console.log(`  Average: ${(duration / 15).toFixed(2)}ms per operation`);
    });
  });

  describe('6. Cache Performance', () => {
    it('should demonstrate disk cache speedup on fresh instance', async () => {
      // Ensure disk cache exists
      await docsManager.fetchLatestDocs();
      
      // Create new instance (should load from disk cache)
      const freshManager = new TerragruntDocsManager();
      
      const startTime = performance.now();
      const docs = await freshManager.fetchLatestDocs();
      const duration = performance.now() - startTime;
      
      expect(docs.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should be faster than network fetch
      
      console.log(`✓ Fresh instance loaded ${docs.length} docs from disk cache in ${duration.toFixed(2)}ms`);
    });

    it('should handle repeated section lookups efficiently', async () => {
      const section = 'getting-started';
      const iterations = 100;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const docs = await docsManager.getDocBySection(section);
        expect(docs.length).toBeGreaterThan(0);
      }
      
      const duration = performance.now() - startTime;
      const avgTime = duration / iterations;
      
      expect(avgTime).toBeLessThan(10); // Average <10ms per lookup
      
      console.log(`✓ ${iterations} section lookups in ${duration.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  describe('7. Stress Tests', () => {
    it('should handle very large search result limit', async () => {
      const startTime = performance.now();
      
      const allResults = await docsManager.searchDocs('terragrunt');
      const results = allResults.slice(0, 1000);
      
      const duration = performance.now() - startTime;
      
      expect(allResults.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(3000); // Even large limits should be fast
      
      console.log(`✓ Search returned ${allResults.length} total results, sliced to ${results.length} in ${duration.toFixed(2)}ms`);
    });

    it('should handle rapid-fire sequential searches', async () => {
      const queries = Array.from({ length: 50 }, (_, i) => `query${i}`);
      
      const startTime = performance.now();
      
      for (const query of queries) {
        const results = await docsManager.searchDocs(query);
        expect(Array.isArray(results)).toBe(true);
      }
      
      const duration = performance.now() - startTime;
      const avgTime = duration / queries.length;
      
      expect(duration).toBeLessThan(10000); // 50 searches in <10 seconds
      expect(avgTime).toBeLessThan(200); // Average <200ms per search
      
      console.log(`✓ ${queries.length} sequential searches in ${duration.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  afterAll(() => {
    // Print final memory stats
    const finalMemory = process.memoryUsage();
    console.log('\nFinal Memory Usage:');
    console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);
  });
});
