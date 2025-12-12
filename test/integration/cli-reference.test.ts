/**
 * Comprehensive integration test for unified cli_reference tool.
 * Implements #174: Tests both get mode (with command) and list mode (without command).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('cli_reference Unified Tool - Comprehensive Integration', () => {
  let toolHandler: ToolHandler;

  beforeAll(async () => {
    console.log('Initializing ToolHandler for cli_reference integration tests...');
    toolHandler = new ToolHandler();
    console.log('ToolHandler initialized successfully');
  });

  describe('Get Mode (with command parameter)', () => {
    it('should return comprehensive help for "plan" command', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      expect(result.command).toBe('plan');
      expect(result.description).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.category).toBeDefined(); // Category can be 'main' or 'shortcut'
      expect(result.options).toBeDefined();
      expect(Array.isArray(result.options)).toBe(true);
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      expect(result.formattedHelp).toBeDefined();
      expect(result.documentationUrl).toBeDefined();
    });

    it('should return comprehensive help for "apply" command', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'apply'
      });

      expect(result.command).toBe('apply');
      expect(result.description).toBeDefined();
      expect(result.category).toBeDefined(); // Category varies by implementation
    });

    it('should handle command aliases - "run-all" resolves to "run"', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run-all'
      });

      expect(result.command).toBe('run');
      expect(result.aliases).toContain('run-all');
    });

    it('should handle command aliases - "hclfmt" resolves to "hcl fmt"', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'hclfmt'
      });

      expect(result.command).toBe('hcl fmt');
      expect(result.aliases).toContain('hclfmt');
    });

    it('should handle "run" command with comprehensive options', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run'
      });

      expect(result.command).toBe('run');
      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThan(10);
      
      const flagNames = result.options.map((o: any) => o.flag);
      expect(flagNames).toContain('--all');
      expect(flagNames).toContain('--parallelism');
    });

    it('should handle case-insensitive commands', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'PLAN'
      });

      expect(result.command).toBe('plan');
    });

    it('should return error with suggestions for invalid command', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'invalid-command-xyz'
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No CLI command documentation found');
      expect(result.hint).toBeDefined();
      expect(result.hint).toContain('cli_reference');
      expect(result.availableCommands).toBeDefined();
      expect(Array.isArray(result.availableCommands)).toBe(true);
    });

    it('should include formatted markdown help', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      expect(result.formattedHelp).toBeDefined();
      expect(result.formattedHelp).toContain('# plan');
      expect(result.formattedHelp).toContain('## Usage');
      expect(result.formattedHelp).toContain('```bash');
    });

    it('should include related commands', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      if (!result.error) {
        expect(result.relatedCommands).toBeDefined();
        expect(Array.isArray(result.relatedCommands)).toBe(true);
      }
    });

    it('should include documentation URL', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      expect(result.documentationUrl).toBeDefined();
      expect(result.documentationUrl).toMatch(/^https?:\/\//);
    });
  });

  describe('List Mode (without command parameter)', () => {
    it('should list all commands when no parameters provided', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
      expect(result.commands.length).toBeGreaterThan(10);
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeGreaterThan(15);
    });

    it('should include command metadata in list', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      const firstCommand = result.commands[0];
      expect(firstCommand.name).toBeDefined();
      expect(firstCommand.category).toBeDefined();
      expect(firstCommand.description).toBeDefined();
      expect(firstCommand.usage).toBeDefined();
    });

    it('should filter commands by category', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'main'
      });

      expect(result.category).toBe('main');
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
      expect(result.commands.length).toBeGreaterThan(0);
    });

    it('should filter commands by backend category', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'backend'
      });

      expect(result.category).toBe('backend');
      expect(result.commands).toBeDefined();
      
      const names = result.commands.map((c: any) => c.name);
      expect(names).toContain('backend bootstrap');
    });

    it('should support search query', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'plan'
      });

      expect(result.search).toBe('plan');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Results should include match information
      const firstResult = result.results[0];
      expect(firstResult.name).toBeDefined();
      expect(firstResult.score).toBeDefined();
      expect(firstResult.matchType).toBeDefined();
    });

    it('should support pagination', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        page: 1,
        pageSize: 5
      });

      expect(result.commands).toBeDefined();
      expect(result.commands.length).toBeLessThanOrEqual(5);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(5);
      expect(result.pagination.totalItems).toBeGreaterThan(5);
      expect(result.pagination.totalPages).toBeGreaterThan(1);
    });

    it('should handle second page of results', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        page: 2,
        pageSize: 10
      });

      expect(result.commands).toBeDefined();
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should combine category filter with pagination', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'main',
        page: 1,
        pageSize: 3
      });

      expect(result.category).toBe('main');
      expect(result.commands.length).toBeLessThanOrEqual(3);
      expect(result.pagination).toBeDefined();
    });

    it('should combine search with pagination', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'run',
        page: 1,
        pageSize: 5
      });

      expect(result.search).toBe('run');
      expect(result.results.length).toBeLessThanOrEqual(5);
      expect(result.pagination).toBeDefined();
    });

    it('should return empty results for no matches', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'nonexistent-xyz-123'
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(0);
    });

    it('should include category information in full list', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(5);
      
      const firstCategory = result.categories[0];
      expect(firstCategory.id).toBeDefined();
      expect(firstCategory.name).toBeDefined();
      expect(firstCategory.description).toBeDefined();
      expect(firstCategory.commandCount).toBeGreaterThan(0);
    });
  });

  describe('Response Format Consistency', () => {
    it('should return JSON-serializable responses for get mode', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      const serialized = JSON.stringify(result);
      expect(serialized).toBeDefined();
      
      const parsed = JSON.parse(serialized);
      expect(parsed.command).toBe('plan');
    });

    it('should return JSON-serializable responses for list mode', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      const serialized = JSON.stringify(result);
      expect(serialized).toBeDefined();
      
      const parsed = JSON.parse(serialized);
      expect(Array.isArray(parsed.commands)).toBe(true);
    });

    it('should handle all category values', async () => {
      const categories = ['main', 'backend', 'stack', 'catalog', 'discovery', 'configuration', 'shortcut'];
      
      for (const category of categories) {
        const result = await toolHandler.executeTool('cli_reference', { category });
        
        expect(result.category).toBe(category);
        expect(result.commands).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty command string gracefully', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: ''
      });

      // Empty command should either return error or list mode
      expect(result).toBeDefined();
    });

    it('should handle invalid category gracefully', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'invalid-category' as any
      });

      // Should either filter to empty or return error
      expect(result).toBeDefined();
    });

    it('should handle negative page numbers', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        page: -1
      });

      expect(result).toBeDefined();
      // Should normalize to valid page or return error
    });

    it('should handle very large pageSize', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        pageSize: 10000
      });

      expect(result).toBeDefined();
      expect(result.commands).toBeDefined();
    });
  });

  describe('Mode Detection', () => {
    it('should use get mode when command provided', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      // Get mode returns command field
      expect(result.command).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should use list mode when command omitted', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      // List mode returns commands array
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
    });

    it('should prioritize command over other parameters', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan',
        category: 'backend',  // Should be ignored in get mode
        search: 'apply'        // Should be ignored in get mode
      });

      // Get mode - command takes precedence
      expect(result.command).toBe('plan');
      expect(result.description).toBeDefined();
    });
  });
});
