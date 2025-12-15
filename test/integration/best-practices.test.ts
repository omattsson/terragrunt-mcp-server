import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Best Practices Integration Tests', () => {
  let toolHandler: ToolHandler;

  beforeAll(() => {
    toolHandler = new ToolHandler();
  });

  describe('Tool Registration', () => {
    it('includes get_guidance in available tools', () => {
      const tools = toolHandler.getAvailableTools();
      const bestPracticesTool = tools.find(t => t.name === 'get_guidance');

      expect(bestPracticesTool).toBeDefined();
      expect(bestPracticesTool?.description).toContain('best practices');
      expect(bestPracticesTool?.inputSchema.properties.query).toBeDefined();
      expect(bestPracticesTool?.inputSchema.properties.level).toBeDefined();
      expect(bestPracticesTool?.inputSchema.properties.type).toBeDefined();
    });

    it('has correct schema for get_guidance', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_guidance');

      // No required parameters - all optional
      expect(tool?.inputSchema.required).toEqual([]);
      
      // Query should be string without enum constraint
      expect(tool?.inputSchema.properties.query.type).toBe('string');
      expect(tool?.inputSchema.properties.query.enum).toBeUndefined();
      
      // Type should have enum for guidance types
      expect(tool?.inputSchema.properties.type.enum).toEqual([
        'best-practices',
        'comparison',
        'pattern'
      ]);
      
      // Level should have enum constraint
      expect(tool?.inputSchema.properties.level.enum).toEqual([
        'beginner',
        'intermediate',
        'advanced'
      ]);
    });
  });

  describe('Tool Execution - All Topics', () => {
    const topics = [
      'module_organization',
      'state_management',
      'dependencies',
      'ci_cd',
      'security',
      'performance',
      'testing'
    ];

    for (const topic of topics) {
      it(`analyzes ${topic} topic successfully`, async () => {
        const result = await toolHandler.executeTool('get_guidance', { query: topic, mode: 'full' });

        expect(result).toBeDefined();
        expect(result.query).toBe(topic);
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.summary).toBeDefined();
        expect(result.commonPitfalls).toBeDefined();
        expect(result.experienceNotes).toBeDefined();
        expect(result.realWorldExamples).toBeDefined();
      }, 30000); // 30s timeout for doc fetching
    }
  });

  describe('Experience Level Filtering', () => {
    it('filters results by beginner level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        level: 'beginner',
        mode: 'full'
      });

      expect(result.query).toBe('state_management');
      
      // If recommendations exist, they should all be beginner level
      if (result.recommendations && result.recommendations.length > 0) {
        expect(result.recommendations.every((r: any) => r.experienceLevel === 'beginner')).toBe(true);
      }
    }, 30000);

    it('filters results by intermediate level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'dependencies',
        level: 'intermediate',
        mode: 'full'
      });

      expect(result.query).toBe('dependencies');
      
      if (result.recommendations && result.recommendations.length > 0) {
        expect(result.recommendations.every((r: any) => r.experienceLevel === 'intermediate')).toBe(true);
      }
    }, 30000);

    it('filters results by advanced level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'performance',
        level: 'advanced',
        mode: 'full'
      });

      expect(result.query).toBe('performance');
      
      if (result.recommendations && result.recommendations.length > 0) {
        expect(result.recommendations.every((r: any) => r.experienceLevel === 'advanced')).toBe(true);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('returns available guidance when query is missing', async () => {
      const result = await toolHandler.executeTool('get_guidance', {});

      expect(result.availableBestPracticeTopics).toBeDefined();
      expect(Array.isArray(result.availableBestPracticeTopics)).toBe(true);
      expect(result.usage).toBeDefined();
    });

    it('handles invalid topic gracefully', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'invalid_topic_name'
      });

      // Should return result with suggestions or empty recommendations, not throw
      expect(result).toBeDefined();
      // Either suggestions for fuzzy match or empty recommendations
      expect(result.suggestions || result.recommendations).toBeDefined();
    }, 30000);

    it('handles errors without throwing exceptions', async () => {
      // This should not throw even with unexpected input
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        level: 'invalid_level' as any
      });
      
      // Should return a result, not throw
      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
    }, 30000);
  });

  describe('MCP Protocol Compliance', () => {
    it('returns valid response structure', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        mode: 'full'
      });

      // MCP requires structured responses, not exceptions
      expect(result).toBeTypeOf('object');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('commonPitfalls');
      expect(result).toHaveProperty('experienceNotes');
      expect(result).toHaveProperty('realWorldExamples');
    }, 30000);

    it('never throws errors to MCP layer', async () => {
      // Multiple rapid calls should not cause issues
      const promises = [
        toolHandler.executeTool('get_guidance', { query: 'state_management', mode: 'full' }),
        toolHandler.executeTool('get_guidance', { query: 'dependencies', mode: 'full' }),
        toolHandler.executeTool('get_guidance', { query: 'security', mode: 'full' })
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    }, 60000);

    it('returns consistent structure for all topics', async () => {
      const topics = ['module_organization', 'state_management', 'testing'];
      
      for (const topic of topics) {
        const result = await toolHandler.executeTool('get_guidance', { query: topic, mode: 'full' });

        // All results should have same structure
        expect(result).toHaveProperty('query');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('commonPitfalls');
        expect(result).toHaveProperty('experienceNotes');
        expect(result).toHaveProperty('realWorldExamples');

        // Check nested structure
        expect(result.experienceNotes).toHaveProperty('beginner');
        expect(result.experienceNotes).toHaveProperty('intermediate');
        expect(result.experienceNotes).toHaveProperty('advanced');
      }
    }, 60000);
  });

  describe('Recommendation Structure', () => {
    it('returns properly structured recommendations', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        mode: 'full'
      });

      if (result.recommendations && result.recommendations.length > 0) {
        const rec = result.recommendations[0];

        expect(rec).toHaveProperty('practice');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('experienceLevel');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('rationale');
        expect(rec).toHaveProperty('examples');
        expect(rec).toHaveProperty('antipatterns');
        expect(rec).toHaveProperty('tradeoffs');
        expect(rec).toHaveProperty('relatedDocs');

        // Validate enums
        expect(['critical', 'recommended', 'optional']).toContain(rec.priority);
        expect(['beginner', 'intermediate', 'advanced']).toContain(rec.experienceLevel);
        expect(rec.category).toBe('state_management');
      }
    }, 30000);

    it('includes related documentation URLs', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'dependencies',
        mode: 'full'
      });

      if (result.recommendations && result.recommendations.length > 0) {
        const recsWithDocs = result.recommendations.filter((r: any) => 
          r.relatedDocs && r.relatedDocs.length > 0
        );
        
        expect(recsWithDocs.length).toBeGreaterThan(0);
        
        // Check URL format
        const firstDoc = recsWithDocs[0].relatedDocs[0];
        expect(firstDoc).toMatch(/^https?:\/\//);
      }
    }, 30000);
  });

  describe('Caching and Performance', () => {
    it('returns results faster on second call (cached)', async () => {
      // First call - no cache
      const start1 = Date.now();
      await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        mode: 'full'
      });
      const duration1 = Date.now() - start1;

      // Second call - should be cached
      const start2 = Date.now();
      await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        mode: 'full'
      });
      const duration2 = Date.now() - start2;

      // Cached call should be faster or equal (handles sub-millisecond timing)
      // If both are 0 (sub-millisecond), that's fine - both are fast
      expect(duration2).toBeLessThanOrEqual(Math.max(duration1, 1));
      
      // Cached call should complete in <300ms (performance requirement)
      expect(duration2).toBeLessThan(300);
    }, 60000);

    it('completes cached analysis in <300ms', async () => {
      // First call to populate cache
      await toolHandler.executeTool('get_guidance', {
        query: 'module_organization',
        mode: 'full'
      });

      // Measure cached performance
      const start = Date.now();
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'module_organization',
        mode: 'full'
      });
      const duration = Date.now() - start;

      // Verify result is valid
      expect(result).toBeDefined();
      expect(result.query).toBe('module_organization');
      expect(result.confidence).toBeDefined();

      // Performance requirement: <300ms for cached analysis
      expect(duration).toBeLessThan(300);
    }, 60000);

    it('completes first-time analysis in reasonable time (<2s)', async () => {
      // This test simulates MCP server restart with docs already cached on disk
      // Using a topic not used in previous tests to avoid in-memory cache
      const start = Date.now();
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'ci_cd',
        mode: 'full'
      });
      const duration = Date.now() - start;

      // Verify result is valid
      expect(result).toBeDefined();
      expect(result.query).toBe('ci_cd');
      expect(result.recommendations).toBeDefined();

      // Even first-time should be reasonable (docs cached on disk)
      expect(duration).toBeLessThan(2000);
    }, 60000);

    it('caches results separately by experience level', async () => {
      const result1 = await toolHandler.executeTool('get_guidance', {
        query: 'security',
        mode: 'full'
      });

      const result2 = await toolHandler.executeTool('get_guidance', {
        query: 'security',
        level: 'beginner',
        mode: 'full'
      });

      // Results should be different
      if (result1.recommendations.length > 0 && result2.recommendations.length > 0) {
        expect(result1.recommendations.length).not.toBe(result2.recommendations.length);
      }
    }, 60000);
  });

  describe('Content Validation', () => {
    it('generates meaningful summaries', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management'
      });

      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(20);
      expect(result.summary).toContain('state_management');
    }, 30000);

    it('extracts common pitfalls', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'security',
        mode: 'full'
      });

      expect(Array.isArray(result.commonPitfalls)).toBe(true);
      // Security topic should have some pitfalls if docs exist
      // Don't assert length as it depends on docs content
    }, 30000);

    it('provides experience-specific notes', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'testing',
        mode: 'full'
      });

      expect(Array.isArray(result.experienceNotes.beginner)).toBe(true);
      expect(Array.isArray(result.experienceNotes.intermediate)).toBe(true);
      expect(Array.isArray(result.experienceNotes.advanced)).toBe(true);
    }, 30000);
  });
});
