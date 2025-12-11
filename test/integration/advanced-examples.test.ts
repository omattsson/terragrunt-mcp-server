/**
 * Integration tests for Advanced Code Examples feature
 * Issue #103: Enhancement - Add Advanced Code Example Responses
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Advanced Code Examples Integration', () => {
  let toolHandler: ToolHandler;

  beforeAll(() => {
    toolHandler = new ToolHandler();
  });

  describe('get_code_examples with advanced=true', () => {
    it('should return curated examples when searching by topic', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'before_hook',
        mode: 'full'
      });

      expect(result.source).toBe('advanced-examples');
      expect(result.example).toBeDefined();
      expect(result.example.code).toContain('before_hook');
      expect(result.example.useCases).toBeDefined();
      expect(result.example.bestPractices).toBeDefined();
    });

    it('should return examples filtered by category', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        category: 'hooks',
        mode: 'full'
      });

      expect(result.source).toBe('advanced-examples');
      expect(result.examples).toBeDefined();
      expect(result.examples.length).toBeGreaterThan(0);
      expect(result.totalExamples).toBeGreaterThan(0);
    });

    it('should return full example details with markdown', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'generate-backend',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.markdown).toBeDefined();
      expect(result.example.markdown).toContain('# Dynamic Backend Generation');
      expect(result.example.markdown).toContain('## Code Example');
    });

    it('should return other matches when multiple results exist', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'hook',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.otherMatches).toBeDefined();
      expect(result.totalMatches).toBeGreaterThan(1);
    });

    it('should filter search by category', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'generate',
        category: 'generate',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.category).toBe('generate');
    });

    it('should return overview when no topic or category specified', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true
      });

      expect(result.source).toBe('advanced-examples');
      expect(result.categories).toBeDefined();
      expect(result.totalExamples).toBe(21);
      expect(result.exampleUsage).toBeDefined();
    });

    it('should return error for non-matching search with suggestions', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'xyznonexistent123'
      });

      expect(result.error).toBeDefined();
      expect(result.availableCategories).toBeDefined();
    });
  });

  describe('get_code_examples with listCategories=true', () => {
    it('should list all categories with example counts', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        listCategories: true
      });

      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBe(5);
      expect(result.totalExamples).toBe(21);
      
      const categoryNames = result.categories.map((c: any) => c.category);
      expect(categoryNames).toContain('hooks');
      expect(categoryNames).toContain('generate');
      expect(categoryNames).toContain('environment');
      expect(categoryNames).toContain('dependencies');
      expect(categoryNames).toContain('dry-patterns');
    });
  });

  describe('get_code_examples backward compatibility', () => {
    it('should still work with topic only (doc scraping)', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'remote_state',
        mode: 'full'
      });

      // Should use documentation source
      expect(result.source).toBe('documentation');
      expect(result.examples).toBeDefined();
    });

    it('should require topic when advanced=false', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: false
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('topic parameter is required');
    });

    it('should suggest advanced examples when doc search fails', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'before_hook'  // This might not be in scraped docs
      });

      // If no results in docs, should suggest advanced
      if (result.error) {
        expect(result.suggestion).toContain('advanced=true');
      }
    });
  });

  describe('advanced examples content validation', () => {
    it('should have hooks examples with expected content', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        category: 'hooks',
        mode: 'full'
      });

      expect(result.examples.length).toBeGreaterThanOrEqual(4);
      
      const exampleIds = result.examples.map((e: any) => e.id);
      expect(exampleIds).toContain('before-hook-validation');
      expect(exampleIds).toContain('after-hook-notification');
      expect(exampleIds).toContain('hook-error-handling');
    });

    it('should have generate examples with expected content', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        category: 'generate',
        mode: 'full'
      });

      expect(result.examples.length).toBeGreaterThanOrEqual(4);
      
      const exampleIds = result.examples.map((e: any) => e.id);
      expect(exampleIds).toContain('generate-backend');
      expect(exampleIds).toContain('generate-provider');
    });

    it('should have environment examples with hierarchy patterns', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'env-hierarchy',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.code).toContain('read_terragrunt_config');
      expect(result.example.code).toContain('find_in_parent_folders');
    });

    it('should have dependency examples with mock outputs', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'dependency-mock-outputs',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.code).toContain('mock_outputs');
    });

    it('should have DRY pattern examples with includes', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'include',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.code).toContain('include "');
    });
  });

  describe('match quality', () => {
    it('should prioritize exact ID matches', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'before-hook-validation',
        mode: 'full'
      });

      expect(result.matchInfo.matchType).toBe('id');
      expect(result.matchInfo.score).toBe(1.0);
    });

    it('should find tag matches', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'slack',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.tags).toContain('slack');
    });

    it('should handle multi-word searches', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        advanced: true,
        topic: 'error handling hooks',
        mode: 'full'
      });

      expect(result.example).toBeDefined();
      expect(result.example.id).toBe('hook-error-handling');
    });
  });
});
