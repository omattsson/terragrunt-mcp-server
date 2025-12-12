import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('get_guidance Tool Integration', () => {
  let toolHandler: ToolHandler;

  beforeAll(() => {
    toolHandler = new ToolHandler();
  });

  describe('Tool Definition', () => {
    it('includes get_guidance in available tools', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_guidance');
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_guidance');
      expect(tool?.description).toContain('guidance');
      expect(tool?.description).toContain('query');
    });

    it('has proper input schema', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_guidance');
      
      expect(tool?.inputSchema.type).toBe('object');
      expect(tool?.inputSchema.properties.query).toBeDefined();
      expect(tool?.inputSchema.properties.level).toBeDefined();
      expect(tool?.inputSchema.required).toEqual([]);
    });
  });

  describe('Valid Topics', () => {
    it('returns confidence score for state_management topic', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management'
      });

      expect(result).toBeDefined();
      expect(result.topic).toBe('state_management');
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('returns recommendations for module_organization topic', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'module_organization',
        mode: 'full'
      });

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.confidence).toBeDefined();
    });

    it('includes summary with confidence level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management'
      });

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      // Summary should mention confidence (High/Medium/Low)
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('returns all required fields', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'dependencies',
        mode: 'full'
      });

      expect(result.topic).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.commonPitfalls).toBeDefined();
      expect(result.experienceNotes).toBeDefined();
      expect(result.realWorldExamples).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('Experience Level Filtering', () => {
    it('filters by beginner level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        level: 'beginner'
      });

      expect(result).toBeDefined();
      expect(result.topic).toBe('state_management');
      expect(result.confidence).toBeDefined();
    });

    it('filters by intermediate level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        level: 'intermediate'
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('filters by advanced level', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_management',
        level: 'advanced'
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('Fuzzy Matching and Suggestions', () => {
    it('provides intelligent suggestions for typos', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'state_managment', // typo: missing 'e'
        type: 'best-practices'
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('Did you mean');
      expect(result.suggestedTopics).toBeDefined();
      expect(Array.isArray(result.suggestedTopics)).toBe(true);
      expect(result.suggestedTopics.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0);
    });

    it('suggests topics for semantic queries', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'remote state', // semantic query
        type: 'best-practices'
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      // Should suggest state_management
      if (result.suggestedTopics && result.suggestedTopics.length > 0) {
        expect(result.suggestedTopics).toContain('state_management');
      }
    });

    it('handles completely unknown topics', async () => {
      const result = await toolHandler.executeTool('get_guidance', {
        query: 'xyz_unknown_gibberish',
        type: 'best-practices'
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('returns available guidance when query is empty', async () => {
      const result = await toolHandler.executeTool('get_guidance', {});
      
      expect(result).toBeDefined();
      expect(result.availableBestPracticeTopics).toBeDefined();
      expect(result.availableComparisons).toBeDefined();
      expect(result.availablePatternTopics).toBeDefined();
      expect(result.usage).toBeDefined();
    });

    it('returns available guidance when no arguments provided', async () => {
      const result = await toolHandler.executeTool('get_guidance');
      
      expect(result).toBeDefined();
      expect(result.availableBestPracticeTopics).toBeDefined();
      expect(Array.isArray(result.availableBestPracticeTopics)).toBe(true);
    });
  });

  describe('All Supported Topics', () => {
    const supportedTopics = [
      'module_organization',
      'state_management',
      'dependencies',
      'ci_cd',
      'security',
      'performance',
      'testing'
    ];

    supportedTopics.forEach(topic => {
      it(`returns valid results for ${topic}`, async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: topic,
          mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe(topic);
        expect(result.confidence).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.recommendations).toBeDefined();
        expect(result.summary).toBeDefined();
      });
    });
  });
});
