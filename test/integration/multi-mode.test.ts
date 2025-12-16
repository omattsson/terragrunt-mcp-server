/**
 * Multi-Mode Architecture Integration Tests
 * 
 * Comprehensive integration tests validating mode-specific behavior,
 * tool availability, lazy loading, and performance characteristics.
 */

import { describe, it, expect } from 'vitest';
import { ServerMode, shouldLoadDependency, getModeConfig } from '../../src/modes/config.js';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Multi-Mode Architecture Integration Tests', () => {
  
  describe('Mode Configuration Integrity', () => {
    it('should have valid configuration for all modes', () => {
      const modes = Object.values(ServerMode);
      
      modes.forEach(mode => {
        const config = getModeConfig(mode);
        expect(config).toBeDefined();
        expect(config.name).toBe(mode);
        expect(config.tools).toBeInstanceOf(Array);
        expect(config.tools.length).toBeGreaterThan(0);
        expect(config.estimatedTokens).toBeGreaterThan(0);
        expect(config.dependencies).toBeInstanceOf(Array);
      });
    });

    it('should have no duplicate tools in mode configurations', () => {
      const modes = [ServerMode.FULL, ServerMode.CORE, ServerMode.CONFIG, ServerMode.GUIDANCE, ServerMode.OBSERVABILITY];
      
      modes.forEach(mode => {
        const config = getModeConfig(mode);
        const uniqueTools = new Set(config.tools);
        expect(uniqueTools.size).toBe(config.tools.length);
      });
    });
  });

  describe('Tool Availability by Mode', () => {
    it('CORE mode should expose only documentation tools', () => {
      const handler = new ToolHandler(undefined, ServerMode.CORE);
      const tools = handler.getAvailableTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('search_docs');
      expect(toolNames).toContain('cli_reference');
      expect(toolNames).toContain('function_reference');
      expect(toolNames).toContain('get_hcl_config_reference');
      expect(toolNames).not.toContain('build_config');
      expect(toolNames).not.toContain('diagnose_terragrunt_error');
      expect(tools.length).toBe(4);
    });

    it('CONFIG mode should expose only configuration tools', () => {
      const handler = new ToolHandler(undefined, ServerMode.CONFIG);
      const tools = handler.getAvailableTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('build_config');
      expect(toolNames).toContain('get_hcl_config_reference');
      expect(toolNames).not.toContain('search_docs');
      expect(toolNames).not.toContain('diagnose_terragrunt_error');
      expect(tools.length).toBe(2);
    });

    it('GUIDANCE mode should expose only troubleshooting tools', () => {
      const handler = new ToolHandler(undefined, ServerMode.GUIDANCE);
      const tools = handler.getAvailableTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('get_guidance');
      expect(toolNames).toContain('diagnose_terragrunt_error');
      expect(toolNames).not.toContain('search_docs');
      expect(toolNames).not.toContain('build_config');
      expect(tools.length).toBe(2);
    });

    it('OBSERVABILITY mode should expose only metrics tool', () => {
      const handler = new ToolHandler(undefined, ServerMode.OBSERVABILITY);
      const tools = handler.getAvailableTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('get_server_metrics');
      expect(toolNames).not.toContain('search_docs');
      expect(toolNames).not.toContain('build_config');
      expect(tools.length).toBe(1);
    });

    it('FULL mode should expose all tools', () => {
      const handler = new ToolHandler(undefined, ServerMode.FULL);
      const tools = handler.getAvailableTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('search_docs');
      expect(toolNames).toContain('cli_reference');
      expect(toolNames).toContain('function_reference');
      expect(toolNames).toContain('build_config');
      expect(toolNames).toContain('get_hcl_config_reference');
      expect(toolNames).toContain('get_guidance');
      expect(toolNames).toContain('diagnose_terragrunt_error');
      expect(toolNames).toContain('get_server_metrics');
      expect(tools.length).toBe(8);
    });
  });

  describe('Lazy Loading Verification', () => {
    it('OBSERVABILITY mode should load no managers', () => {
      const handler = new ToolHandler(undefined, ServerMode.OBSERVABILITY) as any;
      
      expect(handler.docsManager).toBeUndefined();
      expect(handler.functionsManager).toBeUndefined();
      expect(handler.cliCommandsManager).toBeUndefined();
      expect(handler.configGenerator).toBeUndefined();
      expect(handler.bestPracticesAnalyzer).toBeUndefined();
      expect(handler.errorPatternMatcher).toBeUndefined();
    });

    it('CORE mode should load only documentation managers', () => {
      const handler = new ToolHandler(undefined, ServerMode.CORE) as any;
      
      expect(handler.docsManager).toBeDefined();
      expect(handler.functionsManager).toBeDefined();
      expect(handler.cliCommandsManager).toBeDefined();
      expect(handler.advancedExamplesManager).toBeDefined();
      
      // Should NOT load these
      expect(handler.configGenerator).toBeUndefined();
      expect(handler.bestPracticesAnalyzer).toBeUndefined();
      expect(handler.errorPatternMatcher).toBeUndefined();
      expect(handler.templatesManager).toBeUndefined();
    });

    it('CONFIG mode should load only configuration managers', () => {
      const handler = new ToolHandler(undefined, ServerMode.CONFIG) as any;
      
      expect(handler.docsManager).toBeDefined();
      expect(handler.configGenerator).toBeDefined();
      expect(handler.templatesManager).toBeDefined();
      expect(handler.hclBlocksManager).toBeDefined();
      expect(handler.fileWriter).toBeDefined();
      
      // Should NOT load these
      expect(handler.functionsManager).toBeUndefined();
      expect(handler.cliCommandsManager).toBeUndefined();
      expect(handler.bestPracticesAnalyzer).toBeUndefined();
      expect(handler.errorPatternMatcher).toBeUndefined();
    });

    it('GUIDANCE mode should load only troubleshooting managers', () => {
      const handler = new ToolHandler(undefined, ServerMode.GUIDANCE) as any;
      
      expect(handler.docsManager).toBeDefined();
      expect(handler.bestPracticesAnalyzer).toBeDefined();
      expect(handler.errorPatternMatcher).toBeDefined();
      expect(handler.blockComparisonManager).toBeDefined();
      
      // Should NOT load these
      expect(handler.functionsManager).toBeUndefined();
      expect(handler.cliCommandsManager).toBeUndefined();
      expect(handler.configGenerator).toBeUndefined();
      expect(handler.templatesManager).toBeUndefined();
    });

    it('FULL mode should load all managers', () => {
      const handler = new ToolHandler(undefined, ServerMode.FULL) as any;
      
      expect(handler.docsManager).toBeDefined();
      expect(handler.functionsManager).toBeDefined();
      expect(handler.cliCommandsManager).toBeDefined();
      expect(handler.configGenerator).toBeDefined();
      expect(handler.bestPracticesAnalyzer).toBeDefined();
      expect(handler.errorPatternMatcher).toBeDefined();
      expect(handler.hclBlocksManager).toBeDefined();
      expect(handler.templatesManager).toBeDefined();
      expect(handler.fileWriter).toBeDefined();
      expect(handler.advancedExamplesManager).toBeDefined();
      expect(handler.blockComparisonManager).toBeDefined();
    });
  });

  describe('Tool Execution by Mode', () => {
    it('CORE mode should successfully execute search_docs', async () => {
      const handler = new ToolHandler(undefined, ServerMode.CORE);
      
      const result = await handler.executeTool('search_docs', {
        mode: 'list'
      });
      
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('CORE mode should reject build_config (not available)', async () => {
      const handler = new ToolHandler(undefined, ServerMode.CORE);
      
      const result = await handler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks'
        }
      });
      
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('MODE_RESTRICTION');
    });

    it('CONFIG mode should successfully execute build_config', async () => {
      const handler = new ToolHandler(undefined, ServerMode.CONFIG);
      
      const result = await handler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          key: 'terraform.tfstate',
          dynamodb_table: 'terraform-locks'
        }
      });
      
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('CONFIG mode should reject diagnose_terragrunt_error (not available)', async () => {
      const handler = new ToolHandler(undefined, ServerMode.CONFIG);
      
      const result = await handler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Test error'
      });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not available');
    });

    it('GUIDANCE mode should successfully execute diagnose_terragrunt_error', async () => {
      const handler = new ToolHandler(undefined, ServerMode.GUIDANCE);
      
      const result = await handler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('OBSERVABILITY mode should successfully execute get_server_metrics', async () => {
      const handler = new ToolHandler(undefined, ServerMode.OBSERVABILITY);
      
      const result = await handler.executeTool('get_server_metrics', {});
      
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('Mode Isolation', () => {
    it('different mode instances should not interfere with each other', () => {
      const coreHandler = new ToolHandler(undefined, ServerMode.CORE);
      const configHandler = new ToolHandler(undefined, ServerMode.CONFIG);
      const guidanceHandler = new ToolHandler(undefined, ServerMode.GUIDANCE);
      
      const coreTools = coreHandler.getAvailableTools().map(t => t.name);
      const configTools = configHandler.getAvailableTools().map(t => t.name);
      const guidanceTools = guidanceHandler.getAvailableTools().map(t => t.name);
      
      // Each mode should have distinct tool sets
      expect(coreTools).not.toEqual(configTools);
      expect(coreTools).not.toEqual(guidanceTools);
      expect(configTools).not.toEqual(guidanceTools);
      
      // Verify intentional tool sharing: get_hcl_config_reference is shared between CORE and CONFIG
      const coreConfigOverlap = coreTools.filter(t => configTools.includes(t));
      expect(coreConfigOverlap.length).toBeGreaterThan(0);
      expect(coreConfigOverlap).toContain('get_hcl_config_reference');
      
      // Verify no overlap between CORE and GUIDANCE
      const coreGuidanceOverlap = coreTools.filter(t => guidanceTools.includes(t));
      expect(coreGuidanceOverlap.length).toBe(0);
    });

    it('multiple instances of same mode should be identical', () => {
      const handler1 = new ToolHandler(undefined, ServerMode.CORE);
      const handler2 = new ToolHandler(undefined, ServerMode.CORE);
      
      const tools1 = handler1.getAvailableTools().map(t => t.name).sort();
      const tools2 = handler2.getAvailableTools().map(t => t.name).sort();
      
      expect(tools1).toEqual(tools2);
    });
  });

  describe('Dependency Loading Logic', () => {
    it('should correctly determine dependencies for each mode', () => {
      const testCases = [
        { mode: ServerMode.CORE, dep: 'docs', expected: true },
        { mode: ServerMode.CORE, dep: 'functions', expected: true },
        { mode: ServerMode.CORE, dep: 'templates', expected: false },
        { mode: ServerMode.CONFIG, dep: 'templates', expected: true },
        { mode: ServerMode.CONFIG, dep: 'generator', expected: true },
        { mode: ServerMode.CONFIG, dep: 'bestPractices', expected: false },
        { mode: ServerMode.GUIDANCE, dep: 'bestPractices', expected: true },
        { mode: ServerMode.GUIDANCE, dep: 'errorPatterns', expected: true },
        { mode: ServerMode.GUIDANCE, dep: 'templates', expected: false },
        { mode: ServerMode.OBSERVABILITY, dep: 'metrics', expected: true },
        { mode: ServerMode.OBSERVABILITY, dep: 'docs', expected: false },
        { mode: ServerMode.FULL, dep: 'docs', expected: true },
        { mode: ServerMode.FULL, dep: 'templates', expected: true },
      ];
      
      testCases.forEach(({ mode, dep, expected }) => {
        const result = shouldLoadDependency(dep as any, mode);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('specialized modes should have fewer tools than FULL mode', () => {
      const fullHandler = new ToolHandler(undefined, ServerMode.FULL);
      const fullTools = fullHandler.getAvailableTools();
      
      const modes = [ServerMode.CORE, ServerMode.CONFIG, ServerMode.GUIDANCE, ServerMode.OBSERVABILITY];
      
      modes.forEach(mode => {
        const handler = new ToolHandler(undefined, mode);
        const tools = handler.getAvailableTools();
        expect(tools.length).toBeLessThan(fullTools.length);
      });
    });

    it('OBSERVABILITY mode should have minimum tool count', () => {
      const modes = [ServerMode.FULL, ServerMode.CORE, ServerMode.CONFIG, ServerMode.GUIDANCE, ServerMode.OBSERVABILITY];
      const toolCounts = modes.map(mode => {
        const handler = new ToolHandler(undefined, mode);
        return handler.getAvailableTools().length;
      });
      
      const minCount = Math.min(...toolCounts);
      const obsHandler = new ToolHandler(undefined, ServerMode.OBSERVABILITY);
      expect(obsHandler.getAvailableTools().length).toBe(minCount);
    });

    it('FULL mode should have maximum tool count', () => {
      const modes = [ServerMode.FULL, ServerMode.CORE, ServerMode.CONFIG, ServerMode.GUIDANCE, ServerMode.OBSERVABILITY];
      const toolCounts = modes.map(mode => {
        const handler = new ToolHandler(undefined, mode);
        return handler.getAvailableTools().length;
      });
      
      const maxCount = Math.max(...toolCounts);
      const fullHandler = new ToolHandler(undefined, ServerMode.FULL);
      expect(fullHandler.getAvailableTools().length).toBe(maxCount);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle tool execution in wrong mode', async () => {
      const handler = new ToolHandler(undefined, ServerMode.OBSERVABILITY);
      
      const result = await handler.executeTool('search_docs', { mode: 'list' });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not available');
      expect(result.errorType).toBe('MODE_RESTRICTION');
    });

    it('should provide helpful error message with available modes', async () => {
      const handler = new ToolHandler(undefined, ServerMode.OBSERVABILITY);
      
      const result = await handler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks'
        }
      });
      
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('MODE_RESTRICTION');
      expect(result.error.toLowerCase()).toContain('mode');
    });
  });

  describe('Backward Compatibility', () => {
    it('should default to FULL mode when no mode specified', () => {
      const handler = new ToolHandler();
      const tools = handler.getAvailableTools();
      
      expect(tools.length).toBe(8); // All tools available
    });

    it('FULL mode should have identical tool set to default', () => {
      const defaultHandler = new ToolHandler();
      const fullHandler = new ToolHandler(undefined, ServerMode.FULL);
      
      const defaultTools = defaultHandler.getAvailableTools().map(t => t.name).sort();
      const fullTools = fullHandler.getAvailableTools().map(t => t.name).sort();
      
      expect(defaultTools).toEqual(fullTools);
    });
  });
});
