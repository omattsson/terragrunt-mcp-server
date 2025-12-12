/**
 * Integration tests for block comparison and pattern guidance tools
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Block Comparison and Pattern Guidance Tools', () => {
  let toolHandler: ToolHandler;

  beforeEach(() => {
    toolHandler = new ToolHandler();
  });

  describe('Tool Registration', () => {
    it('should register get_guidance tool', () => {
      const tools = toolHandler.getAvailableTools();
      const guidanceTool = tools.find(t => t.name === 'get_guidance');
      
      expect(guidanceTool).toBeDefined();
      expect(guidanceTool!.description).toContain('guidance');
      expect(guidanceTool!.inputSchema.properties.query).toBeDefined();
      expect(guidanceTool!.inputSchema.properties.type).toBeDefined();
      expect(guidanceTool!.inputSchema.properties.listAll).toBeDefined();
    });
  });

  describe('get_guidance tool', () => {
    describe('listing comparisons', () => {
      it('should list all available comparisons', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          listAll: true
        });
        
        expect(result.availableComparisons).toBeDefined();
        expect(result.availableComparisons.length).toBeGreaterThanOrEqual(5);
        expect(result.availableComparisons).toContain('dependency vs dependencies');
        expect(result.usage).toBeDefined();
      });
    });

    describe('comparing blocks', () => {
      it('should compare dependency vs dependencies', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies', type: 'comparison'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison).toBeDefined();
        expect(result.comparison.id).toBe('dependency-vs-dependencies');
        expect(result.comparison.summary).toContain('output');
      });

      it('should compare using natural language query', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'inputs vs locals'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison.id).toBe('inputs-vs-locals');
      });

      it('should include block details with syntax', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies', type: 'comparison'
        });
        
        expect(result.comparison.block1.name).toBe('dependency');
        expect(result.comparison.block1.syntax).toContain('dependency');
        expect(result.comparison.block1.keyFeatures.length).toBeGreaterThan(0);
        
        expect(result.comparison.block2.name).toBe('dependencies');
        expect(result.comparison.block2.syntax).toContain('dependencies');
      });

      it('should include key differences', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies'
        });
        
        expect(result.comparison.keyDifferences).toBeDefined();
        expect(result.comparison.keyDifferences.length).toBeGreaterThan(0);
        
        const diff = result.comparison.keyDifferences[0];
        expect(diff.aspect).toBeDefined();
        expect(diff.block1).toBeDefined();
        expect(diff.block2).toBeDefined();
      });

      it('should include when-to-use guidance', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies', type: 'comparison'
        });
        
        expect(result.comparison.whenToUse).toBeDefined();
        expect(result.comparison.whenToUse.useBlock1When.length).toBeGreaterThan(0);
        expect(result.comparison.whenToUse.useBlock2When.length).toBeGreaterThan(0);
      });

      it('should include common mistakes', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies', type: 'comparison'
        });
        
        expect(result.comparison.commonMistakes).toBeDefined();
        expect(result.comparison.commonMistakes.length).toBeGreaterThan(0);
      });

      it('should include related documentation links', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency vs dependencies', type: 'comparison'
        });
        
        expect(result.comparison.relatedDocs).toBeDefined();
        expect(result.comparison.relatedDocs.length).toBeGreaterThan(0);
        expect(result.comparison.relatedDocs[0]).toContain('terragrunt.gruntwork.io');
      });
    });

    describe('error handling', () => {
      it('should return available guidance when no query specified', async () => {
        const result = await toolHandler.executeTool('get_guidance', {});
        
        expect(result.availableBestPracticeTopics).toBeDefined();
        expect(result.availableComparisons).toBeDefined();
        expect(result.availablePatternTopics).toBeDefined();
      });

      it('should return suggestions for unknown block', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'unknown_block',
        });
        
        // Should return suggestions or empty result, not throw
        expect(result).toBeDefined();
        expect(result.suggestions || result.guidance || result.recommendations).toBeDefined();
      });

      it('should handle single block pattern query', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency', type: 'pattern'
        });
        
        // Should return guidance or suggestions
        expect(result).toBeDefined();
        expect(result.guidance || result.suggestions).toBeDefined();
      });
    });

    describe('all available comparisons', () => {
      it('should compare include patterns', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'include vs multiple includes'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison.id).toBe('include-single-vs-multiple');
      });

      it('should compare generate vs terraform.source', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'generate vs terraform.source',
          type: 'comparison'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison.id).toBe('generate-vs-terraform-source');
      });

      it('should compare before_hook vs after_hook', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'before_hook vs after_hook'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison.id).toBe('before-hook-vs-after-hook');
      });

      it('should compare remote_state vs dependency', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'remote_state vs dependency',
          type: 'comparison'
        });
        
        expect(result.found).toBe(true);
        expect(result.comparison.id).toBe('remote-state-vs-dependency');
      });
    });
  });

  describe('get_guidance tool', () => {
    describe('listing patterns', () => {
      it('should list all available patterns', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          listAll: true
        });
        
        expect(result.availableBestPracticeTopics).toBeDefined();
        expect(result.availablePatternTopics).toBeDefined();
        expect(result.availablePatternTopics.length).toBeGreaterThanOrEqual(3);
        expect(result.availableComparisons).toBeDefined();
        expect(result.usage).toBeDefined();
      });
    });

    describe('getting guidance', () => {
      it('should get guidance for dependency management', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'managing dependencies', type: 'pattern'
        });
        
        expect(result.found).toBe(true);
        expect(result.guidance).toBeDefined();
        expect(result.guidance.id).toBe('module-dependency-management');
      });

      it('should get guidance for configuration inheritance', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'configuration inheritance'
        });
        
        expect(result.found).toBe(true);
        expect(result.guidance.id).toBe('configuration-inheritance');
      });

      it('should get guidance for backend state', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'backend state management'
        });
        
        // Should return guidance (pattern guidance)
        expect(result).toBeDefined();
        expect(result.guidance || result.recommendations).toBeDefined();
      }, 30000);

      it('should include decision criteria', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'managing dependencies', type: 'pattern'
        });
        
        expect(result.guidance.decisionCriteria).toBeDefined();
        expect(result.guidance.decisionCriteria.length).toBeGreaterThan(0);
        
        const criterion = result.guidance.decisionCriteria[0];
        expect(criterion.criterion).toBeDefined();
        expect(criterion.recommendation).toBeDefined();
        expect(criterion.reason).toBeDefined();
      });

      it('should include patterns with examples', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'managing dependencies', type: 'pattern'
        });
        
        expect(result.guidance.patterns).toBeDefined();
        expect(result.guidance.patterns.length).toBeGreaterThan(0);
        
        const pattern = result.guidance.patterns[0];
        expect(pattern.name).toBeDefined();
        expect(pattern.description).toBeDefined();
        expect(pattern.example).toBeDefined();
        expect(pattern.pros).toBeDefined();
        expect(pattern.cons).toBeDefined();
      });

      it('should include related comparisons', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'managing dependencies', type: 'pattern'
        });
        
        expect(result.guidance.relatedComparisons).toBeDefined();
        expect(result.guidance.relatedComparisons.length).toBeGreaterThan(0);
        expect(result.guidance.relatedComparisons[0]).toContain('dependency');
      });
    });

    describe('keyword matching', () => {
      it('should find by keyword "dependency"', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependency order execution'
        });
        
        // Should return guidance (best practices or pattern guidance)
        expect(result).toBeDefined();
        expect(result.guidance || result.recommendations).toBeDefined();
      }, 30000);

      it('should find by keyword "include"', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'include dry parent'
        });
        
        expect(result.found).toBe(true);
        expect(result.guidance.id).toBe('configuration-inheritance');
      });

      it('should find by keyword "s3" or "backend"', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 's3 backend storage'
        });
        
        expect(result.found).toBe(true);
        expect(result.guidance.id).toBe('backend-state-management');
      });
    });

    describe('error handling', () => {
      it('should return available guidance when no query specified', async () => {
        const result = await toolHandler.executeTool('get_guidance', {});
        
        expect(result.availableBestPracticeTopics).toBeDefined();
        expect(result.availableComparisons).toBeDefined();
        expect(result.availablePatternTopics).toBeDefined();
      });

      it('should return suggestions for unknown scenario', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'quantum computing in terragrunt'
        });
        
        expect(result.found).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.suggestions).toBeDefined();
      });
    });
  });

  describe('Tool Integration', () => {
    it('should have consistent pattern-comparison references', async () => {
      // Get a pattern that references comparisons
      const guidanceResult = await toolHandler.executeTool('get_guidance', {
        query: 'managing dependencies', type: 'pattern'
      });
      
      expect(guidanceResult.found).toBe(true);
      
      // Verify referenced comparisons exist
      for (const compRef of guidanceResult.guidance.relatedComparisons) {
        const compResult = await toolHandler.executeTool('get_guidance', {
          query: compRef
        });
        
        // Either found or suggestions (comparison name format matches tool input)
        expect(compResult.found || compResult.suggestions).toBeTruthy();
      }
    });

    it('should provide comprehensive dependency coverage', async () => {
      // Both tools should cover dependency-related topics
      const comparison = await toolHandler.executeTool('get_guidance', {
        query: 'dependency vs dependencies'
      });
      
      const guidance = await toolHandler.executeTool('get_guidance', {
        query: 'managing dependencies', type: 'pattern'
      });
      
      expect(comparison.found).toBe(true);
      expect(guidance.found).toBe(true);
      
      // Guidance should reference the comparison
      expect(guidance.guidance.relatedComparisons).toContain('dependency vs dependencies');
    });
  });
});
