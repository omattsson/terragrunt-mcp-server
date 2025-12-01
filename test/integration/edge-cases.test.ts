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

    it('should return summary when get_hcl_config_reference called without parameters', async () => {
      // Config parameter is now optional - returns usage info when missing
      const result = await toolHandler.executeTool('get_hcl_config_reference', {});

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.exampleUsage).toBeDefined();
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
      const commands = ['plan', 'apply', 'init', 'validate-inputs', 'run-all'];
      
      for (const cmd of commands) {
        const result = await toolHandler.executeTool('get_cli_command_help', {
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
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'run-all'
      });

      expect(result).toBeDefined();
      // run-all resolves to run command
      expect(result.command).toBe('run');
      expect(result.aliases).toContain('run-all');
    });

    it('should handle command with uppercase', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'PLAN'
      });

      expect(result).toBeDefined();
      // Should normalize to lowercase
      expect(result.command).toBe('plan');
    });

    it('should resolve hclfmt alias to hcl fmt', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'hclfmt'
      });

      expect(result).toBeDefined();
      expect(result.command).toBe('hcl fmt');
      expect(result.aliases).toContain('hclfmt');
    });

    it('should return comprehensive options for run command', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
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
      const result = await toolHandler.executeTool('get_cli_command_help', {
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
      const result = await toolHandler.executeTool('list_cli_commands', {});

      expect(result.categories).toBeDefined();
      expect(result.totalCommands).toBeGreaterThan(15);
    });

    it('should filter by category', async () => {
      const result = await toolHandler.executeTool('list_cli_commands', {
        category: 'backend'
      });

      expect(result.commands).toBeDefined();
      const names = result.commands.map((c: any) => c.name);
      expect(names).toContain('backend bootstrap');
    });

    it('should search commands', async () => {
      const result = await toolHandler.executeTool('list_cli_commands', {
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
        
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: longTopic
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.topic).toBe(longTopic);
        // Should handle gracefully, likely with error or empty result
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
        
        // Performance: should complete in reasonable time
        expect(duration).toBeLessThan(5000); // <5 seconds
      }, 10000);

      it('should handle special characters in topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state-management@#$%'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state-management@#$%');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // May return error or suggestions for unknown topic
        if (result.error) {
          expect(result.error).toBeDefined();
          expect(result.suggestion || result.suggestedTopics).toBeDefined();
        }
      });

      it('should handle unicode and emoji in topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management 🚀 配置'
        });

        expect(result).toBeDefined();
        expect(result.topic).toContain('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.confidence).toBeDefined();
      });

      it('should handle empty string topic with helpful error', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: ''
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(result.error).toContain('topic parameter is required');
        // Empty topic is rejected at validation layer
      });

      it('should handle whitespace-only topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: '   \t\n   '
        });

        expect(result).toBeDefined();
        expect(result.topic).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either normalize or return empty result
        if (result.error) {
          expect(result.suggestion || result.suggestedTopics).toBeDefined();
        }
      });

      it('should handle topic with only numbers and symbols', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: '12345!@#$%'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('12345!@#$%');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should return empty result with suggestions
        expect(result.confidence).toBeDefined();
      });
    });

    describe('Experience Level Edge Cases', () => {
      it('should handle invalid experience level gracefully', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management',
          level: 'expert' as any // Invalid level
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either ignore invalid level or return error
        // Either way, should not crash
      });

      it('should handle case variations in experience level', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management',
          level: 'Beginner' as any // Uppercase
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either normalize or handle gracefully
      });

      it('should handle null/undefined experience level', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management',
          level: undefined
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should return all recommendations without filtering
        if (result.recommendations.length > 0) {
          // May include mixed experience levels
          expect(result.confidence).toBeGreaterThan(0);
        }
      });

      it('should handle empty string experience level', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management',
          level: '' as any
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state_management');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        // Should either ignore empty string or return all recommendations
      });
    });

    describe('Sparse Documentation Scenarios', () => {
      it('should return fuzzy suggestions for unknown topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_managment' // Typo: missing 'e'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('state_managment');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        
        // Should provide fuzzy-matched suggestions
        expect(result.error || result.suggestion || result.suggestedTopics).toBeDefined();
        
        if (result.suggestedTopics) {
          expect(Array.isArray(result.suggestedTopics)).toBe(true);
          expect(result.suggestedTopics.length).toBeGreaterThan(0);
          // Should suggest 'state_management' as close match
        }
        
        // Confidence should be 0 for unknown topic
        expect(result.confidence).toBe(0);
      });

      it('should handle topic with minimal documentation', async () => {
        // Using a very specific/niche topic that likely has sparse data
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'testing'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('testing');
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'module_organization'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('module_organization');
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'dependencies'
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'completely_unknown_topic_xyz'
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('completely_unknown_topic_xyz');
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.recommendations.length).toBe(0);
        
        // Should provide helpful error and suggestions
        expect(result.error).toBeDefined();
        expect(result.suggestion || result.suggestedTopics).toBeDefined();
        expect(result.confidence).toBe(0);
      });

      it('should limit recommendations to reasonable number (max 20)', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
        });

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(Array.isArray(result.recommendations)).toBe(true);
        
        // Implementation limits to 20 recommendations
        expect(result.recommendations.length).toBeLessThanOrEqual(20);
      });

      it('should handle duplicate detection via frequency scoring', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
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
        
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'stat_managemnt' // Multiple typos
        });

        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(result.recommendations).toBeDefined();
        
        // Fuzzy matching should be fast
        expect(duration).toBeLessThan(2000); // <2 seconds
      }, 5000);

      it('should have fast performance for cached valid topic analysis', async () => {
        // First call to warm up cache
        await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
        });

        // Second call should be cached and fast
        const startTime = Date.now();
        
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
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
