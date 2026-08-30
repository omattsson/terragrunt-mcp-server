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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform { source = "..." }',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('terraform { source = "..." }');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle quotes in search query', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'dependency "vpc"',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle forward slashes in search query', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'path/to/module',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle backslashes in search query', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'C:\\Users\\path',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle ampersands and other HTML entities', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'flag1 && flag2',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle parentheses and brackets', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'func(param1, param2)',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle dollar signs (variable syntax)', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: '${var.name}',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle asterisks and wildcards', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform 🚀',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle non-ASCII characters in search', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'configuración terraform',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle Chinese characters', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: '配置 terraform',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle mixed unicode and ASCII', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform-модуль',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Limit Parameters at Boundaries', () => {
    it('should handle pageSize=0', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        pageSize: 0
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(0);
      expect(result.pagination.totalItems).toBeGreaterThan(0); // But total should show matches
    });

    it('should handle pageSize=1', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        pageSize: 1
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(1);
    });

    it('should handle default pageSize (no pageSize specified)', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform'
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Default pageSize should be 10
      expect(result.results.length).toBeLessThanOrEqual(10);
    });

    it('should handle pageSize=50 (max)', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        pageSize: 50
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(50);
    });

    it('should handle pageSize beyond available results', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        pageSize: 50
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Should return all available results on first page
      expect(result.pagination.hasMore).toBeDefined();
    });

    it('should handle negative pageSize (edge case)', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        pageSize: -5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      // Should handle gracefully - likely return empty or default behavior
    });
  });

  describe('Empty and Invalid Inputs', () => {
    it('should handle empty search query', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: '   ',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should handle missing required parameter (query)', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        limit: 5
      });

      expect(result).toBeDefined();
      // Should return error for missing required parameter
      expect(result.error).toBeDefined();
    });

    it('should handle invalid section name', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'nonexistent-section-12345'
      , detailLevel: 'full'
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
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'nonexistent-command-xyz'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('nonexistent-command-xyz');
      // Should return error with helpful information
      if (result.error) {
        expect(result.error).toContain('No CLI command documentation found');
        // New implementation provides hint and available commands
        expect(result.hint || result.suggestion).toBeDefined();
        expect(result.availableCommands).toBeDefined();
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: '',
        limit: 5
      , detailLevel: 'full'
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
    it('should support cli_reference without command (list mode)', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      expect(result).toBeDefined();
      // List mode should work without error
      expect(result.error).toBeUndefined();
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
    });

    it('should return summary when get_hcl_config_reference called without parameters', async () => {
      // Config parameter is now optional - returns usage info when missing
      const result = await toolHandler.executeTool('get_hcl_config_reference', {});

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.exampleUsage).toBeDefined();
    });

    it('should validate search_docs examples mode requires query parameter', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples',  detailLevel: 'full' });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('query parameter is required for examples mode');
    });

    it('should validate search_docs section mode requires section parameter', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section',  detailLevel: 'full' });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('section parameter is required for section mode');
    });

    it('should validate search_docs search mode requires query parameter', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('query parameter is required for search mode');
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'dependencies',
        limit: 0
      , detailLevel: 'full'
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      expect(result.examples.length).toBe(0);
    });

    it('should handle code examples with very high limit', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'terraform',
        limit: 100
      , detailLevel: 'full'
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      // Should return available examples, capped at reasonable limit
    });

    it('should handle code examples for rare/specific topics', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'hooks',
        limit: 5
      , detailLevel: 'full'
      });

      expect(result).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
      // May return 0 results if topic is too specific
    });
  });

  describe('Section Docs Edge Cases', () => {
    it('should handle section with special characters', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'getting-started'
      , detailLevel: 'full'
      });

      expect(result).toBeDefined();
      expect(result.section).toBe('getting-started');
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should handle section with uppercase', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'GETTING-STARTED'
      , detailLevel: 'full'
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: '  getting-started  '
      , detailLevel: 'full'
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
      const commands = ['plan', 'apply', 'init', 'hcl validate', 'browse', 'run-all'];
      
      for (const cmd of commands) {
        const result = await toolHandler.executeTool('cli_reference', {
          command: cmd
        });

        expect(result).toBeDefined();
        // command field should be the canonical name (run-all resolves to run)
        expect(result.command).toBeDefined();
        // Structured commands should have description and usage
        if (!result.error) {
          expect(result.description).toBeDefined();
          expect(result.usage).toBeDefined();
        }
      }
    });

    it('should handle command with hyphens', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run-all'
      });

      expect(result).toBeDefined();
      // Removed command names resolve to current migration guidance.
      expect(result.command).toBe('run');
      expect(result.aliases).not.toContain('run-all');
      expect(result.legacyNames).toContain('run-all');
    });

    it('should handle command with uppercase', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'PLAN'
      });

      expect(result).toBeDefined();
      // Should normalize to lowercase
      expect(result.command).toBe('plan');
    });

    it('should resolve removed hclfmt name to hcl fmt migration help', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'hclfmt'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('hcl fmt');
      expect(result.aliases).not.toContain('hclfmt');
      expect(result.legacyNames).toContain('hclfmt');
    });

    it('should return comprehensive options for run command', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('run');
      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThan(10);
      
      const flagNames = result.options.map((o: any) => o.flag);
      expect(flagNames).toContain('--all');
      expect(flagNames).toContain('--parallelism');
    });

    it('should provide formatted markdown help', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      expect(result.formattedHelp).toBeDefined();
      expect(result.formattedHelp).toContain('# plan');
      expect(result.formattedHelp).toContain('## Usage');
      expect(result.formattedHelp).toContain('```bash');
    });
  });

  describe('List CLI Commands Edge Cases', () => {
    it('should list all command categories', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      expect(result.categories).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeGreaterThan(15);
    });

    it('should filter by category', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'backend'
      });

      expect(result.commands).toBeDefined();
      const names = result.commands.map((c: any) => c.name);
      expect(names).toContain('backend bootstrap');
    });

    it('should search commands', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'format'
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('HCL Config Reference Edge Cases', () => {
    it('should handle common HCL blocks with structured responses', async () => {
      const configs = ['terraform', 'dependency', 'dependencies', 'remote_state', 'inputs'];
      
      for (const config of configs) {
        const result = await toolHandler.executeTool('get_hcl_config_reference', {
          config: config
        });

        expect(result).toBeDefined();
        expect(result.config).toBe(config);
        // New structured response from HCLBlocksManager
        expect(result.displayName).toBeDefined();
        expect(result.attributes).toBeDefined();
        expect(result.examples).toBeDefined();
      }
    });

    it('should handle config with underscores', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'remote_state'
      });

      expect(result).toBeDefined();
      expect(result.config).toBe('remote_state');
    });

    it('should handle config with hyphens via search', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'generate-config'
      });

      // May not find exact match, but should return something useful
      expect(result).toBeDefined();
    });
  });

  describe('Best Practices Analyzer Edge Cases', () => {
    describe('Unusual Topic Inputs', () => {
      it('should handle very long topic strings (>1000 chars) with acceptable performance', async () => {
        const longTopic = 'state_management'.repeat(100); // ~1500 chars
        const startTime = Date.now();
        
        const result = await toolHandler.executeTool('get_guidance', {
          query: longTopic
        , mode: 'full'
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.query).toBe(longTopic);
        // Should handle gracefully, likely with error or empty result
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
        
        // Performance: should complete in reasonable time
        expect(duration).toBeLessThan(5000); // <5 seconds
      }, 10000);

      it('should handle special characters in topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state-management@#$%'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Special chars may route to pattern guidance (no topic field) or best practices (has topic)
        expect(result.topic || result.found !== undefined || result.error).toBeTruthy();
        // Response may vary - pattern guidance, best practices, or error
        if (result.recommendations) {
          expect(Array.isArray(result.recommendations)).toBe(true);
        }
      });

      it('should handle unicode and emoji in topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management 🚀 配置'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toContain('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
      });

      it('should handle empty string topic with helpful error', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: ''
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.availableBestPracticeTopics || result.availableComparisons || result.availablePatternTopics).toBeDefined();
        // Empty query returns available guidance list
      });

      it('should handle whitespace-only topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: '   \t\n   '
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Whitespace-only query is normalized to empty, returns available guidance
        expect(result.availableBestPracticeTopics || result.availableComparisons || result.availablePatternTopics).toBeDefined();
      });

      it('should handle topic with only numbers and symbols', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: '12345!@#$%'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Numbers/symbols route to pattern guidance (no topic/confidence) or return error
        expect(result.found !== undefined || result.error || result.topic).toBeTruthy();
        // Response structure varies by routing
        if (result.recommendations) {
          expect(Array.isArray(result.recommendations)).toBe(true);
        }
      });
    });

    describe('Experience Level Edge Cases', () => {
      it('should handle invalid experience level gracefully', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management',
          level: 'expert' as any // Invalid level
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either ignore invalid level or return error
        // Either way, should not crash
      });

      it('should handle case variations in experience level', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management',
          level: 'Beginner' as any // Uppercase
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either normalize or handle gracefully
      });

      it('should handle null/undefined experience level', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management',
          level: undefined
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should return all recommendations without filtering
        if (result.recommendations.length > 0) {
          // May include mixed experience levels
          expect(result.confidence).toBeGreaterThan(0);
        }
      });

      it('should handle empty string experience level', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management',
          level: '' as any
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either ignore empty string or return all recommendations
      });
    });

    describe('Sparse Documentation Scenarios', () => {
      it('should return fuzzy suggestions for unknown topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_managment' // Typo: missing 'e'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Typo may match best practices (has topic) or route to patterns (no topic)
        // Should provide helpful response regardless of routing
        if (result.recommendations) {
          expect(Array.isArray(result.recommendations)).toBe(true);
          // Should provide fuzzy-matched suggestions or error
          expect(result.error || result.suggestion || result.suggestedTopics || result.topic).toBeDefined();
          
          if (result.suggestedTopics) {
            expect(Array.isArray(result.suggestedTopics)).toBe(true);
            expect(result.suggestedTopics.length).toBeGreaterThan(0);
          }
        } else {
          // Pattern guidance route
          expect(result.found !== undefined || result.error).toBeTruthy();
        }
      });

      it('should handle topic with minimal documentation', async () => {
        // Using a very specific/niche topic that likely has sparse data
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'testing'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('testing');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
        expect(typeof result.confidence).toBe('number');
        
        // For sparse topics, confidence may be lower
        if (result.recommendations.length > 0) {
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(100);
        }
      });

      it('should verify examples array structure for valid topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.realWorldExamples).toBeDefined();
        expect(Array.isArray(result.realWorldExamples)).toBe(true);
        
        // Examples may be empty or populated
        if (result.realWorldExamples.length > 0) {
          expect(typeof result.realWorldExamples[0]).toBe('string');
        }
      });

      it('should verify antipatterns array structure for valid topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.commonPitfalls).toBeDefined();
        expect(Array.isArray(result.commonPitfalls)).toBe(true);
        
        // Antipatterns may be empty or populated
        if (result.commonPitfalls.length > 0) {
          expect(typeof result.commonPitfalls[0]).toBe('string');
          expect(result.commonPitfalls[0].length).toBeGreaterThan(0);
        }
      });
    });

    describe('Pattern Extraction and Recommendation Quality', () => {
      it('should handle recommendations with all required fields', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        
        if (result.recommendations && result.recommendations.length > 0) {
          const firstRec = result.recommendations[0];
          
          // Verify required fields exist
          expect(firstRec.practice).toBeDefined();
          expect(firstRec.priority).toBeDefined();
          expect(firstRec.experienceLevel).toBeDefined();
          expect(firstRec.category).toBeDefined();
          expect(firstRec.rationale).toBeDefined();
          expect(firstRec.examples).toBeDefined();
          expect(firstRec.antipatterns).toBeDefined();
          expect(firstRec.tradeoffs).toBeDefined();
          expect(firstRec.relatedDocs).toBeDefined();
          
          // Verify field types
          expect(typeof firstRec.practice).toBe('string');
          expect(['critical', 'recommended', 'optional']).toContain(firstRec.priority);
          expect(['beginner', 'intermediate', 'advanced']).toContain(firstRec.experienceLevel);
          expect(Array.isArray(firstRec.examples)).toBe(true);
          expect(Array.isArray(firstRec.antipatterns)).toBe(true);
          expect(Array.isArray(firstRec.tradeoffs)).toBe(true);
          expect(Array.isArray(firstRec.relatedDocs)).toBe(true);
        }
      });

      it('should handle topic with very specific keywords', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'module_organization'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('module_organization');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
        
        // Should return relevant recommendations or empty result
        if (result.recommendations.length > 0) {
          expect(result.summary).toBeDefined();
          expect(result.summary.length).toBeGreaterThan(0);
        }
      });

      it('should verify experience notes structure', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependencies'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.experienceNotes).toBeDefined();
        expect(result.experienceNotes.beginner).toBeDefined();
        expect(result.experienceNotes.intermediate).toBeDefined();
        expect(result.experienceNotes.advanced).toBeDefined();
        
        expect(Array.isArray(result.experienceNotes.beginner)).toBe(true);
        expect(Array.isArray(result.experienceNotes.intermediate)).toBe(true);
        expect(Array.isArray(result.experienceNotes.advanced)).toBe(true);
      });
    });

    describe('Recommendation Generation Limits and Performance', () => {
      it('should return empty recommendations for completely unknown topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'completely_unknown_topic_xyz'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Unknown topic routes to pattern guidance (no topic/confidence) or best practices with error
        if (result.recommendations !== undefined) {
          // Best practices route
          expect(Array.isArray(result.recommendations)).toBe(true);
          expect(result.recommendations.length).toBe(0);
          expect(result.error).toBeDefined();
          expect(result.suggestion || result.suggestedTopics).toBeDefined();
        } else {
          // Pattern guidance route
          expect(result.found).toBe(false);
          expect(result.error).toBeDefined();
        }
      });

      it('should limit recommendations to reasonable number (max 20)', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        
        // Implementation limits to 20 recommendations
        expect(result.recommendations.length).toBeLessThanOrEqual(20);
      });

      it('should handle duplicate detection via frequency scoring', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        
        if (result.recommendations.length > 1) {
          // Check that practice texts are unique or scored appropriately
          const practiceTexts = result.recommendations.map((r: any) => r.practice);
          const uniqueTexts = new Set(practiceTexts);
          
          // Some similarity is OK due to ranking, but exact duplicates should be rare
          expect(uniqueTexts.size).toBeGreaterThan(0);
        }
      });

      it('should complete unknown topic fuzzy matching in reasonable time', async () => {
        const startTime = Date.now();
        
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'stat_managemnt' // Multiple typos
        , mode: 'full'
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        // Typo may route to best practices (has recommendations) or patterns (no recommendations)
        if (result.recommendations !== undefined) {
          expect(Array.isArray(result.recommendations)).toBe(true);
        } else {
          expect(result.found !== undefined || result.error).toBeTruthy();
        }
        
        // Fuzzy matching should be fast regardless of routing
        expect(duration).toBeLessThan(2000); // <2 seconds
      }, 5000);

      it('should have fast performance for cached valid topic analysis', async () => {
        // First call to warm up cache
        await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        // Second call should be cached and fast
        const startTime = Date.now();
        
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        
        // Cached results should be very fast
        expect(duration).toBeLessThan(300); // <300ms
      });
    });
  });
});
