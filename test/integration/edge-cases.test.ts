import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('Specific Edge Cases - Tools & Input Validation', () => {
  let toolHandler: ToolHandler;
  let docsManager: TerragruntDocsManager;

  beforeAll(async () => {
    console.log('Loading documentation for edge case tests...');
    docsManager = new TerragruntDocsManager();
    await docsManager.fetchLatestDocs();
    toolHandler = new ToolHandler();
    console.log('Documentation loaded successfully');
  }, 120000); // 2 minute timeout for initial load

  describe('Search with Special Characters', () => {
    it('should handle special characters in search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform { source = "..." }',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('terraform { source = "..." }');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle quotes in search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'dependency "vpc"',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle forward slashes in search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'path/to/module',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle backslashes in search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'C:\\Users\\path',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle ampersands and other HTML entities', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'flag1 && flag2',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle parentheses and brackets', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'func(param1, param2)',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle dollar signs (variable syntax)', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: '${var.name}',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle asterisks and wildcards', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: '*.tf',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Very Long Search Queries', () => {
    it('should handle queries up to 1000 characters', async () => {
      const longQuery = 'terragrunt '.repeat(90); // ~990 chars
      
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: longQuery,
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.query).toBe(longQuery);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle queries over 1000 characters', async () => {
      const veryLongQuery = 'How to configure terragrunt dependencies with remote state backend using S3 and DynamoDB for state locking with multiple environments and modules '.repeat(10); // ~1400 chars
      
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: veryLongQuery,
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.query).toBe(veryLongQuery);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Very long queries might return 0 results - that's OK
    });

    it('should handle multi-line queries', async () => {
      const multiLineQuery = `
        terraform {
          source = "..."
        }
        dependency "vpc" {
          config_path = "../vpc"
        }
      `;
      
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: multiLineQuery,
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Unicode in Titles and Content', () => {
    it('should handle emoji in search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform 🚀',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle non-ASCII characters in search', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'configuración terraform',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle Chinese characters', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: '配置 terraform',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle mixed unicode and ASCII', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform-модуль',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Limit Parameters at Boundaries', () => {
    it('should handle limit=0', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 0
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(0);
      expect(result.total).toBeGreaterThan(0); // But total should show matches
    });

    it('should handle limit=1', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 1
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should handle default limit (no limit specified)', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform'
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Default limit should be 5
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle limit=20 (standard max)', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 20
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(20);
    });

    it('should handle limit beyond available results', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 1000
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Should return all available results, not 1000
      expect(result.results.length).toBeLessThan(1000);
      expect(result.hasMore).toBe(false);
    });

    it('should handle negative limit (edge case)', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: -5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Should handle gracefully - likely return empty or default behavior
    });
  });

  describe('Empty and Invalid Inputs', () => {
    it('should handle empty search query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: '',
        limit: 5
      });

      expect(result).toBeDefined();
      // Empty query might return all docs or error
      if (result.error) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }
    });

    it('should handle whitespace-only query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: '   ',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle missing required parameter (query)', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        limit: 5
      });

      expect(result).toBeDefined();
      // Should return error for missing required parameter
      expect(result.error).toBeDefined();
    });

    it('should handle invalid section name', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'nonexistent-section-12345'
      });

      expect(result).toBeDefined();
      expect(result.section).toBe('nonexistent-section-12345');
      // Invalid section returns error with available sections
      if (result.error) {
        expect(result.error).toContain('No documentation found for section');
        expect(result.availableSections).toBeDefined();
        expect(Array.isArray(result.availableSections)).toBe(true);
      } else {
        // Or returns empty docs array
        expect(result.docs).toBeDefined();
        expect(Array.isArray(result.docs)).toBe(true);
        expect(result.docs.length).toBe(0);
      }
    });

    it('should handle invalid CLI command', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'nonexistent-command-xyz'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('nonexistent-command-xyz');
      // Should either return error or empty result with suggestion
      if (result.error) {
        expect(result.error).toContain('No CLI command documentation found');
        expect(result.suggestion).toBeDefined();
      }
    });

    it('should handle invalid HCL config name', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'invalid_config_12345'
      });

      expect(result).toBeDefined();
      expect(result.config).toBe('invalid_config_12345');
      // Should either return error or empty results with suggestion
      if (result.error) {
        expect(result.error).toContain('No HCL configuration documentation found');
        expect(result.suggestion).toBeDefined();
      }
    });

    it('should handle empty topic for code examples', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: '',
        limit: 5
      });

      expect(result).toBeDefined();
      // Empty topic might return error
      if (result.error) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.examples).toBeDefined();
        expect(Array.isArray(result.examples)).toBe(true);
      }
    });
  });

  describe('Tool Parameter Validation', () => {
    it('should validate get_cli_command_help requires command parameter', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('command parameter is required');
    });

    it('should validate get_hcl_config_reference requires config parameter', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('config parameter is required');
    });

    it('should validate get_code_examples requires topic parameter', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('topic parameter is required');
    });

    it('should validate get_section_docs requires section parameter', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('section parameter is required');
    });

    it('should validate search_terragrunt_docs requires query parameter', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('query parameter is required');
    });
  });

  describe('Unknown Tool Handling', () => {
    it('should return error for unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool_xyz', {
        param: 'value'
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle null tool name gracefully', async () => {
      const result = await toolHandler.executeTool(null as any, {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('should handle undefined tool name gracefully', async () => {
      const result = await toolHandler.executeTool(undefined as any, {});

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('Code Examples Edge Cases', () => {
    it('should handle code examples with limit=0', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'dependencies',
        limit: 0
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      expect(result.examples.length).toBe(0);
    });

    it('should handle code examples with very high limit', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'terraform',
        limit: 100
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      // Should return available examples, capped at reasonable limit
    });

    it('should handle code examples for rare/specific topics', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'hooks',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      // May return 0 results if topic is too specific
    });
  });

  describe('Section Docs Edge Cases', () => {
    it('should handle section with special characters', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'getting-started'
      });

      expect(result).toBeDefined();
      expect(result.section).toBe('getting-started');
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should handle section with uppercase', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'GETTING-STARTED'
      });

      expect(result).toBeDefined();
      // May normalize to lowercase, return empty, or error
      if (result.error) {
        expect(result.error).toBeDefined();
        expect(result.availableSections).toBeDefined();
      } else {
        expect(result.docs).toBeDefined();
        expect(Array.isArray(result.docs)).toBe(true);
      }
    });

    it('should handle section with trailing/leading spaces', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: '  getting-started  '
      });

      expect(result).toBeDefined();
      // May trim spaces, return error, or return empty
      if (result.error) {
        expect(result.error).toBeDefined();
        expect(result.availableSections).toBeDefined();
      } else {
        expect(result.docs).toBeDefined();
        expect(Array.isArray(result.docs)).toBe(true);
      }
    });
  });

  describe('CLI Command Help Edge Cases', () => {
    it('should handle common CLI commands', async () => {
      const commands = ['plan', 'apply', 'init', 'validate', 'run-all'];
      
      for (const cmd of commands) {
        const result = await toolHandler.executeTool('get_cli_command_help', {
          command: cmd
        });

        expect(result).toBeDefined();
        expect(result.command).toBe(cmd);
        // Some commands may not have docs - that's OK
        if (!result.error) {
          expect(result.title).toBeDefined();
          expect(result.content).toBeDefined();
        }
      }
    });

    it('should handle command with hyphens', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'run-all'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('run-all');
    });

    it('should handle command with uppercase', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'PLAN'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('PLAN');
      // May normalize or not find - either is acceptable
    });
  });

  describe('HCL Config Reference Edge Cases', () => {
    it('should handle common HCL blocks', async () => {
      const configs = ['terraform', 'dependency', 'dependencies', 'remote_state', 'inputs'];
      
      for (const config of configs) {
        const result = await toolHandler.executeTool('get_hcl_config_reference', {
          config: config
        });

        expect(result).toBeDefined();
        expect(result.config).toBe(config);
        // Some configs may not have docs - that's OK
        if (!result.error) {
          expect(result.results).toBeDefined();
          expect(Array.isArray(result.results)).toBe(true);
        }
      }
    });

    it('should handle config with underscores', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'remote_state'
      });

      expect(result).toBeDefined();
      expect(result.config).toBe('remote_state');
    });

    it('should handle config with hyphens', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'generate-config'
      });

      expect(result).toBeDefined();
      expect(result.config).toBe('generate-config');
    });
  });
});
