/**
 * Unit tests for BlockComparisonManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlockComparisonManager } from '../../src/terragrunt/comparisons.js';

describe('BlockComparisonManager', () => {
  let manager: BlockComparisonManager;

  beforeEach(() => {
    manager = new BlockComparisonManager();
  });

  describe('initialization', () => {
    it('should load all block comparisons on creation', () => {
      const comparisons = manager.getAvailableComparisons();
      expect(comparisons.length).toBeGreaterThanOrEqual(5);
    });

    it('should load all pattern guidance on creation', () => {
      const patterns = manager.getAvailablePatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(3);
    });

    it('should list comparison IDs', () => {
      const ids = manager.listComparisonIds();
      expect(ids).toContain('dependency-vs-dependencies');
      expect(ids).toContain('include-single-vs-multiple');
      expect(ids).toContain('inputs-vs-locals');
    });

    it('should list pattern IDs', () => {
      const ids = manager.listPatternIds();
      expect(ids).toContain('module-dependency-management');
      expect(ids).toContain('configuration-inheritance');
      expect(ids).toContain('backend-state-management');
    });
  });

  describe('compareBlocks', () => {
    describe('with separate block names', () => {
      it('should find comparison for dependency vs dependencies', () => {
        const result = manager.compareBlocks('dependency', 'dependencies');
        
        expect(result.found).toBe(true);
        expect(result.comparison).toBeDefined();
        expect(result.comparison!.id).toBe('dependency-vs-dependencies');
        expect(result.comparison!.blocks).toEqual(['dependency', 'dependencies']);
      });

      it('should find comparison regardless of block order', () => {
        const result1 = manager.compareBlocks('dependency', 'dependencies');
        const result2 = manager.compareBlocks('dependencies', 'dependency');
        
        expect(result1.found).toBe(true);
        expect(result2.found).toBe(true);
        expect(result1.comparison!.id).toBe(result2.comparison!.id);
      });

      it('should find comparison for inputs vs locals', () => {
        const result = manager.compareBlocks('inputs', 'locals');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('inputs-vs-locals');
      });

      it('should find comparison for generate vs terraform.source', () => {
        const result = manager.compareBlocks('generate', 'terraform.source');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('generate-vs-terraform-source');
      });

      it('should find comparison for before_hook vs after_hook', () => {
        const result = manager.compareBlocks('before_hook', 'after_hook');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('before-hook-vs-after-hook');
      });
    });

    describe('with natural language query', () => {
      it('should parse "dependency vs dependencies" query', () => {
        const result = manager.compareBlocks('dependency vs dependencies');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('dependency-vs-dependencies');
      });

      it('should parse "inputs versus locals" query', () => {
        const result = manager.compareBlocks('inputs versus locals');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('inputs-vs-locals');
      });

      it('should parse "generate compared to terraform.source" query', () => {
        const result = manager.compareBlocks('generate compared to terraform.source');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('generate-vs-terraform-source');
      });

      it('should parse "before_hook or after_hook" query', () => {
        const result = manager.compareBlocks('before_hook or after_hook');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('before-hook-vs-after-hook');
      });
    });

    describe('fuzzy matching', () => {
      it('should match with minor typos', () => {
        // "dependecy" is close to "dependency"
        const result = manager.compareBlocks('dependecy', 'dependencies');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('dependency-vs-dependencies');
      });

      it('should match case-insensitively', () => {
        const result = manager.compareBlocks('DEPENDENCY', 'DEPENDENCIES');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('dependency-vs-dependencies');
      });

      it('should handle underscores and hyphens', () => {
        const result = manager.compareBlocks('before-hook', 'after-hook');
        
        expect(result.found).toBe(true);
        expect(result.comparison!.id).toBe('before-hook-vs-after-hook');
      });
    });

    describe('error handling', () => {
      it('should return suggestions for single block query', () => {
        const result = manager.compareBlocks('dependency');
        
        expect(result.found).toBe(false);
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions!.length).toBeGreaterThan(0);
      });

      it('should return error for unknown blocks', () => {
        const result = manager.compareBlocks('unknown_block', 'another_unknown');
        
        expect(result.found).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.suggestions).toBeDefined();
      });

      it('should return error for blocks without comparison', () => {
        const result = manager.compareBlocks('dependency', 'generate');
        
        expect(result.found).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('comparison content', () => {
      it('should include all required fields in comparison', () => {
        const result = manager.compareBlocks('dependency', 'dependencies');
        
        const comparison = result.comparison!;
        expect(comparison.id).toBeDefined();
        expect(comparison.blocks).toHaveLength(2);
        expect(comparison.summary).toBeDefined();
        expect(comparison.block1Details).toBeDefined();
        expect(comparison.block2Details).toBeDefined();
        expect(comparison.keyDifferences).toBeDefined();
        expect(comparison.whenToUse).toBeDefined();
        expect(comparison.commonMistakes).toBeDefined();
        expect(comparison.relatedDocs).toBeDefined();
      });

      it('should have block details with syntax examples', () => {
        const result = manager.compareBlocks('dependency', 'dependencies');
        
        const { block1Details, block2Details } = result.comparison!;
        
        expect(block1Details.name).toBe('dependency');
        expect(block1Details.purpose).toBeDefined();
        expect(block1Details.syntax).toContain('dependency');
        expect(block1Details.keyFeatures.length).toBeGreaterThan(0);
        
        expect(block2Details.name).toBe('dependencies');
        expect(block2Details.purpose).toBeDefined();
        expect(block2Details.syntax).toContain('dependencies');
        expect(block2Details.keyFeatures.length).toBeGreaterThan(0);
      });

      it('should have key differences', () => {
        const result = manager.compareBlocks('dependency', 'dependencies');
        
        const { keyDifferences } = result.comparison!;
        expect(keyDifferences.length).toBeGreaterThan(0);
        
        const firstDiff = keyDifferences[0];
        expect(firstDiff.aspect).toBeDefined();
        expect(firstDiff.block1).toBeDefined();
        expect(firstDiff.block2).toBeDefined();
      });

      it('should have when-to-use guidance', () => {
        const result = manager.compareBlocks('dependency', 'dependencies');
        
        const { whenToUse } = result.comparison!;
        expect(whenToUse.useBlock1When.length).toBeGreaterThan(0);
        expect(whenToUse.useBlock2When.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getPatternGuidance', () => {
    describe('finding patterns', () => {
      it('should find guidance for "managing dependencies"', () => {
        const result = manager.getPatternGuidance('managing dependencies');
        
        expect(result.found).toBe(true);
        expect(result.guidance).toBeDefined();
        expect(result.guidance!.id).toBe('module-dependency-management');
      });

      it('should find guidance for "configuration inheritance"', () => {
        const result = manager.getPatternGuidance('configuration inheritance');
        
        expect(result.found).toBe(true);
        expect(result.guidance!.id).toBe('configuration-inheritance');
      });

      it('should find guidance for "backend state"', () => {
        const result = manager.getPatternGuidance('backend state');
        
        expect(result.found).toBe(true);
        expect(result.guidance!.id).toBe('backend-state-management');
      });

      it('should find guidance by keywords', () => {
        const result = manager.getPatternGuidance('dependency order execution');
        
        expect(result.found).toBe(true);
        expect(result.guidance!.id).toBe('module-dependency-management');
      });

      it('should find guidance by question-like query', () => {
        const result = manager.getPatternGuidance('how should I manage dependencies');
        
        expect(result.found).toBe(true);
        expect(result.guidance!.id).toBe('module-dependency-management');
      });
    });

    describe('guidance content', () => {
      it('should include all required fields', () => {
        const result = manager.getPatternGuidance('managing dependencies');
        
        const guidance = result.guidance!;
        expect(guidance.id).toBeDefined();
        expect(guidance.scenario).toBeDefined();
        expect(guidance.question).toBeDefined();
        expect(guidance.keywords).toBeDefined();
        expect(guidance.decisionCriteria).toBeDefined();
        expect(guidance.patterns).toBeDefined();
        expect(guidance.relatedComparisons).toBeDefined();
      });

      it('should have decision criteria', () => {
        const result = manager.getPatternGuidance('managing dependencies');
        
        const { decisionCriteria } = result.guidance!;
        expect(decisionCriteria.length).toBeGreaterThan(0);
        
        const firstCriterion = decisionCriteria[0];
        expect(firstCriterion.criterion).toBeDefined();
        expect(firstCriterion.recommendation).toBeDefined();
        expect(firstCriterion.reason).toBeDefined();
      });

      it('should have patterns with pros and cons', () => {
        const result = manager.getPatternGuidance('managing dependencies');
        
        const { patterns } = result.guidance!;
        expect(patterns.length).toBeGreaterThan(0);
        
        const firstPattern = patterns[0];
        expect(firstPattern.name).toBeDefined();
        expect(firstPattern.description).toBeDefined();
        expect(firstPattern.example).toBeDefined();
        expect(firstPattern.pros.length).toBeGreaterThan(0);
        expect(firstPattern.cons.length).toBeGreaterThan(0);
      });

      it('should reference related comparisons', () => {
        const result = manager.getPatternGuidance('managing dependencies');
        
        const { relatedComparisons } = result.guidance!;
        expect(relatedComparisons).toContain('dependency-vs-dependencies');
      });
    });

    describe('error handling', () => {
      it('should return suggestions for unknown scenario', () => {
        const result = manager.getPatternGuidance('quantum computing');
        
        expect(result.found).toBe(false);
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions!.length).toBeGreaterThan(0);
      });

      it('should return error message', () => {
        const result = manager.getPatternGuidance('unknown topic');
        
        expect(result.found).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('searchComparisons', () => {
    it('should find comparisons by block name', () => {
      const results = manager.searchComparisons('dependency');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.blocks.some(b => b.includes('dependency'))).toBe(true);
    });

    it('should find comparisons by keyword in summary', () => {
      const results = manager.searchComparisons('outputs');
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for unrelated query', () => {
      const results = manager.searchComparisons('quantum entanglement');
      
      expect(results.length).toBe(0);
    });

    it('should sort results by relevance score', () => {
      const results = manager.searchComparisons('dependency');
      
      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  describe('getComparisonById', () => {
    it('should return comparison for valid ID', () => {
      const comparison = manager.getComparisonById('dependency-vs-dependencies');
      
      expect(comparison).toBeDefined();
      expect(comparison!.id).toBe('dependency-vs-dependencies');
    });

    it('should return undefined for invalid ID', () => {
      const comparison = manager.getComparisonById('invalid-id');
      
      expect(comparison).toBeUndefined();
    });
  });

  describe('getPatternById', () => {
    it('should return pattern for valid ID', () => {
      const pattern = manager.getPatternById('module-dependency-management');
      
      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe('module-dependency-management');
    });

    it('should return undefined for invalid ID', () => {
      const pattern = manager.getPatternById('invalid-id');
      
      expect(pattern).toBeUndefined();
    });
  });

  describe('available comparisons', () => {
    it('should return human-readable comparison names', () => {
      const comparisons = manager.getAvailableComparisons();
      
      expect(comparisons).toContain('dependency vs dependencies');
      expect(comparisons).toContain('include vs multiple includes');
      expect(comparisons).toContain('inputs vs locals');
    });
  });

  describe('available patterns', () => {
    it('should return human-readable pattern scenarios', () => {
      const patterns = manager.getAvailablePatterns();
      
      expect(patterns.some(p => p.includes('dependencies'))).toBe(true);
      expect(patterns.some(p => p.includes('inheritance'))).toBe(true);
      expect(patterns.some(p => p.includes('state'))).toBe(true);
    });
  });
});
