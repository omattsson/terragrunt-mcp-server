/**
 * Unit tests for AdvancedExamplesManager
 * Issue #103: Enhancement - Add Advanced Code Example Responses
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedExamplesManager } from '../../src/terragrunt/advanced-examples.js';

describe('AdvancedExamplesManager', () => {
  let manager: AdvancedExamplesManager;

  beforeEach(() => {
    manager = new AdvancedExamplesManager();
  });

  describe('getExample', () => {
    it('should return an example by exact ID', () => {
      const example = manager.getExample('before-hook-validation');
      
      expect(example).toBeDefined();
      expect(example?.id).toBe('before-hook-validation');
      expect(example?.name).toBe('Pre-Apply Validation Hook');
      expect(example?.category).toBe('hooks');
    });

    it('should return undefined for non-existent ID', () => {
      const example = manager.getExample('non-existent-example');
      expect(example).toBeUndefined();
    });

    it('should return example with all required properties', () => {
      const example = manager.getExample('generate-backend');
      
      expect(example).toBeDefined();
      expect(example).toHaveProperty('id');
      expect(example).toHaveProperty('name');
      expect(example).toHaveProperty('description');
      expect(example).toHaveProperty('category');
      expect(example).toHaveProperty('complexity');
      expect(example).toHaveProperty('code');
      expect(example).toHaveProperty('useCases');
      expect(example).toHaveProperty('bestPractices');
      expect(example).toHaveProperty('pitfalls');
      expect(example).toHaveProperty('relatedExamples');
      expect(example).toHaveProperty('tags');
    });

    it('should handle examples from all categories', () => {
      const hookExample = manager.getExample('before-hook-validation');
      const generateExample = manager.getExample('generate-backend');
      const envExample = manager.getExample('env-hierarchy');
      const depExample = manager.getExample('dependency-basic');
      const dryExample = manager.getExample('include-root');

      expect(hookExample?.category).toBe('hooks');
      expect(generateExample?.category).toBe('generate');
      expect(envExample?.category).toBe('environment');
      expect(depExample?.category).toBe('dependencies');
      expect(dryExample?.category).toBe('dry-patterns');
    });
  });

  describe('listExamples', () => {
    it('should list all examples when no category specified', () => {
      const examples = manager.listExamples();
      
      expect(examples.length).toBeGreaterThan(0);
      // We defined 21 examples
      expect(examples.length).toBe(21);
    });

    it('should filter by hooks category', () => {
      const examples = manager.listExamples('hooks');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category === 'hooks')).toBe(true);
    });

    it('should filter by generate category', () => {
      const examples = manager.listExamples('generate');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category === 'generate')).toBe(true);
    });

    it('should filter by environment category', () => {
      const examples = manager.listExamples('environment');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category === 'environment')).toBe(true);
    });

    it('should filter by dependencies category', () => {
      const examples = manager.listExamples('dependencies');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category === 'dependencies')).toBe(true);
    });

    it('should filter by dry-patterns category', () => {
      const examples = manager.listExamples('dry-patterns');
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category === 'dry-patterns')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      // TypeScript would catch this, but test runtime behavior
      const examples = manager.listExamples('invalid-category' as any);
      expect(examples.length).toBe(0);
    });
  });

  describe('searchExamples', () => {
    it('should find examples by exact ID match', () => {
      const results = manager.searchExamples('before-hook-validation');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].example.id).toBe('before-hook-validation');
      expect(results[0].matchType).toBe('id');
      expect(results[0].score).toBe(1.0);
    });

    it('should find examples by partial ID match', () => {
      const results = manager.searchExamples('hook-validation');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchType).toBe('id');
      expect(results[0].score).toBe(0.9);
    });

    it('should find examples by name match', () => {
      const results = manager.searchExamples('Pre-Apply Validation');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].example.name).toContain('Validation');
    });

    it('should find examples by tag match', () => {
      const results = manager.searchExamples('slack');
      
      expect(results.length).toBeGreaterThan(0);
      const hasSlackTag = results.some(r => 
        r.example.tags.includes('slack')
      );
      expect(hasSlackTag).toBe(true);
    });

    it('should find examples by description match', () => {
      const results = manager.searchExamples('notifications after successful');
      
      expect(results.length).toBeGreaterThan(0);
      const hasNotificationExample = results.some(r =>
        r.example.description.toLowerCase().includes('notification')
      );
      expect(hasNotificationExample).toBe(true);
    });

    it('should find examples by use case match', () => {
      const results = manager.searchExamples('Validate input variables');
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return sorted results by score', () => {
      const results = manager.searchExamples('hook');
      
      expect(results.length).toBeGreaterThan(1);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should handle multi-term search', () => {
      const results = manager.searchExamples('error handling hooks');
      
      expect(results.length).toBeGreaterThan(0);
      // Should find the error handling hook example
      const hasErrorHook = results.some(r =>
        r.example.id === 'hook-error-handling'
      );
      expect(hasErrorHook).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = manager.searchExamples('xyznonexistent123');
      expect(results.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      const lowerResults = manager.searchExamples('backend');
      const upperResults = manager.searchExamples('BACKEND');
      const mixedResults = manager.searchExamples('BaCkEnD');
      
      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
    });
  });

  describe('getCategories', () => {
    it('should return all category information', () => {
      const categories = manager.getCategories();
      
      expect(categories.length).toBe(5);
      
      const categoryNames = categories.map(c => c.category);
      expect(categoryNames).toContain('hooks');
      expect(categoryNames).toContain('generate');
      expect(categoryNames).toContain('environment');
      expect(categoryNames).toContain('dependencies');
      expect(categoryNames).toContain('dry-patterns');
    });

    it('should include accurate example counts', () => {
      const categories = manager.getCategories();
      
      for (const cat of categories) {
        expect(cat.exampleCount).toBeGreaterThan(0);
        expect(cat.exampleCount).toBe(manager.listExamples(cat.category).length);
      }
    });

    it('should include category metadata', () => {
      const categories = manager.getCategories();
      
      for (const cat of categories) {
        expect(cat.name).toBeDefined();
        expect(cat.name.length).toBeGreaterThan(0);
        expect(cat.description).toBeDefined();
        expect(cat.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getExampleCount', () => {
    it('should return total number of examples', () => {
      const count = manager.getExampleCount();
      expect(count).toBe(21);
    });

    it('should match listExamples length', () => {
      const count = manager.getExampleCount();
      const examples = manager.listExamples();
      expect(count).toBe(examples.length);
    });
  });

  describe('formatExampleAsMarkdown', () => {
    it('should format example with all sections', () => {
      const example = manager.getExample('before-hook-validation')!;
      const markdown = manager.formatExampleAsMarkdown(example);
      
      expect(markdown).toContain('# Pre-Apply Validation Hook');
      expect(markdown).toContain('## Description');
      expect(markdown).toContain('## Code Example');
      expect(markdown).toContain('```hcl');
      expect(markdown).toContain('## Use Cases');
      expect(markdown).toContain('## Best Practices');
      expect(markdown).toContain('## Common Pitfalls');
      expect(markdown).toContain('## Related Examples');
      expect(markdown).toContain('## Tags');
    });

    it('should include category and complexity', () => {
      const example = manager.getExample('dependency-basic')!;
      const markdown = manager.formatExampleAsMarkdown(example);
      
      expect(markdown).toContain('**Category:** Dependency Patterns');
      expect(markdown).toContain('**Complexity:** basic');
      expect(markdown).toContain('**ID:** `dependency-basic`');
    });

    it('should include documentation link if present', () => {
      const example = manager.getExample('generate-backend')!;
      const markdown = manager.formatExampleAsMarkdown(example);
      
      expect(markdown).toContain('## Documentation');
      expect(markdown).toContain('[Official Docs]');
    });

    it('should include code block', () => {
      const example = manager.getExample('generate-provider')!;
      const markdown = manager.formatExampleAsMarkdown(example);
      
      expect(markdown).toContain('```hcl');
      expect(markdown).toContain('generate "provider"');
      expect(markdown).toContain('```');
    });

    it('should format pitfalls with warning emoji', () => {
      const example = manager.getExample('hook-error-handling')!;
      const markdown = manager.formatExampleAsMarkdown(example);
      
      expect(markdown).toContain('⚠️');
    });
  });

  describe('example content validation', () => {
    it('should have non-empty code for all examples', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        expect(example.code.length).toBeGreaterThan(50);
        expect(example.code).toContain('{'); // HCL should have blocks
      }
    });

    it('should have at least one use case per example', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        expect(example.useCases.length).toBeGreaterThan(0);
      }
    });

    it('should have at least one best practice per example', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        expect(example.bestPractices.length).toBeGreaterThan(0);
      }
    });

    it('should have at least one pitfall per example', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        expect(example.pitfalls.length).toBeGreaterThan(0);
      }
    });

    it('should have tags for all examples', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        expect(example.tags.length).toBeGreaterThan(0);
      }
    });

    it('should have valid complexity levels', () => {
      const examples = manager.listExamples();
      const validLevels = ['basic', 'intermediate', 'advanced'];
      
      for (const example of examples) {
        expect(validLevels).toContain(example.complexity);
      }
    });
  });

  describe('hooks category examples', () => {
    it('should include before_hook example', () => {
      const examples = manager.listExamples('hooks');
      const beforeHook = examples.find(e => e.id.includes('before'));
      
      expect(beforeHook).toBeDefined();
      expect(beforeHook?.code).toContain('before_hook');
    });

    it('should include after_hook example', () => {
      const examples = manager.listExamples('hooks');
      const afterHook = examples.find(e => e.id.includes('after'));
      
      expect(afterHook).toBeDefined();
      expect(afterHook?.code).toContain('after_hook');
    });

    it('should include error handling example', () => {
      const examples = manager.listExamples('hooks');
      const errorHook = examples.find(e => e.id.includes('error'));
      
      expect(errorHook).toBeDefined();
      expect(errorHook?.code).toContain('run_on_error');
    });
  });

  describe('generate category examples', () => {
    it('should include backend generation example', () => {
      const examples = manager.listExamples('generate');
      const backend = examples.find(e => e.id.includes('backend'));
      
      expect(backend).toBeDefined();
      expect(backend?.code).toContain('generate "backend"');
    });

    it('should include provider generation example', () => {
      const examples = manager.listExamples('generate');
      const provider = examples.find(e => e.id.includes('provider'));
      
      expect(provider).toBeDefined();
      expect(provider?.code).toContain('generate "provider"');
    });
  });

  describe('environment category examples', () => {
    it('should include hierarchy example', () => {
      const examples = manager.listExamples('environment');
      const hierarchy = examples.find(e => e.id.includes('hierarchy'));
      
      expect(hierarchy).toBeDefined();
      expect(hierarchy?.code).toContain('read_terragrunt_config');
    });

    it('should include merging example', () => {
      const examples = manager.listExamples('environment');
      const merging = examples.find(e => e.id.includes('merging'));
      
      expect(merging).toBeDefined();
      expect(merging?.code).toContain('merge(');
    });
  });

  describe('dependencies category examples', () => {
    it('should include basic dependency example', () => {
      const examples = manager.listExamples('dependencies');
      const basic = examples.find(e => e.id === 'dependency-basic');
      
      expect(basic).toBeDefined();
      expect(basic?.code).toContain('dependency "');
    });

    it('should include mock outputs example', () => {
      const examples = manager.listExamples('dependencies');
      const mock = examples.find(e => e.id.includes('mock'));
      
      expect(mock).toBeDefined();
      expect(mock?.code).toContain('mock_outputs');
    });
  });

  describe('dry-patterns category examples', () => {
    it('should include include example', () => {
      const examples = manager.listExamples('dry-patterns');
      const include = examples.find(e => e.id.includes('include'));
      
      expect(include).toBeDefined();
      expect(include?.code).toContain('include "');
    });

    it('should include read_terragrunt_config example', () => {
      const examples = manager.listExamples('dry-patterns');
      const readConfig = examples.find(e => 
        e.code.includes('read_terragrunt_config')
      );
      
      expect(readConfig).toBeDefined();
    });
  });

  describe('relatedExamples validation', () => {
    it('should have valid related example IDs', () => {
      const examples = manager.listExamples();
      const allIds = new Set(examples.map(e => e.id));
      
      for (const example of examples) {
        for (const related of example.relatedExamples) {
          expect(allIds.has(related.id)).toBe(true);
        }
      }
    });

    it('should have relationship descriptions', () => {
      const examples = manager.listExamples();
      
      for (const example of examples) {
        for (const related of example.relatedExamples) {
          expect(related.relationship.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
