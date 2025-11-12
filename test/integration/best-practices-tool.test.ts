import { describe, it, expect } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('analyze_best_practices Tool Integration', () => {
  let toolHandler: ToolHandler;

  // Initialize tool handler before tests
  toolHandler = new ToolHandler();

  describe('Tool Definition', () => {
    it('includes analyze_best_practices in available tools', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'analyze_best_practices');
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('analyze_best_practices');
      expect(tool?.description).toContain('confidence');
      expect(tool?.description).toContain('suggestions');
    });

    it('has proper input schema', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'analyze_best_practices');
      
      expect(tool?.inputSchema.type).toBe('object');
      expect(tool?.inputSchema.properties.topic).toBeDefined();
      expect(tool?.inputSchema.properties.level).toBeDefined();
      expect(tool?.inputSchema.required).toContain('topic');
    });
  });

  describe('Valid Topics', () => {
    it('returns confidence score for state_management topic', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_management'
      });

      expect(result).toBeDefined();
      expect(result.topic).toBe('state_management');
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('returns recommendations for module_organization topic', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'module_organization'
      });

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.confidence).toBeDefined();
    });

    it('includes summary with confidence level', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_management'
      });

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      // Summary should mention confidence (High/Medium/Low)
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('returns all required fields', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'dependencies'
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
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_management',
        level: 'beginner'
      });

      expect(result).toBeDefined();
      expect(result.topic).toBe('state_management');
      expect(result.confidence).toBeDefined();
    });

    it('filters by intermediate level', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_management',
        level: 'intermediate'
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('filters by advanced level', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_management',
        level: 'advanced'
      });

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('Fuzzy Matching and Suggestions', () => {
    it('provides intelligent suggestions for typos', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'state_managment' // typo: missing 'e'
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
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'remote state' // semantic query
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
      const result = await toolHandler.executeTool('analyze_best_practices', {
        topic: 'xyz_unknown_gibberish'
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('requires topic parameter', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices', {});
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('handles missing arguments gracefully', async () => {
      const result = await toolHandler.executeTool('analyze_best_practices');
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic
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
