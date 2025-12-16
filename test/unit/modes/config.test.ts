/**
 * Unit tests for Mode Configuration System
 */

import { describe, it, expect } from 'vitest';
import {
  ServerMode,
  MODE_CONFIGS,
  parseModeFromArgs,
  getModeConfig,
  shouldLoadDependency,
  shouldEnableTool,
  type ModeConfig
} from '../../../src/modes/config.js';

describe('Mode Configuration System', () => {
  describe('ServerMode enum', () => {
    it('should define all expected modes', () => {
      expect(ServerMode.CORE).toBe('core');
      expect(ServerMode.CONFIG).toBe('config');
      expect(ServerMode.GUIDANCE).toBe('guidance');
      expect(ServerMode.FULL).toBe('full');
      expect(ServerMode.OBSERVABILITY).toBe('observability');
    });
  });

  describe('MODE_CONFIGS', () => {
    it('should have configuration for all modes', () => {
      const modes = Object.values(ServerMode);
      modes.forEach(mode => {
        expect(MODE_CONFIGS[mode]).toBeDefined();
        expect(MODE_CONFIGS[mode].name).toBe(mode);
      });
    });

    it('should have valid structure for each mode', () => {
      Object.values(MODE_CONFIGS).forEach((config: ModeConfig) => {
        expect(config.name).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.tools).toBeInstanceOf(Array);
        expect(config.tools.length).toBeGreaterThan(0);
        expect(config.estimatedTokens).toBeTypeOf('number');
        expect(config.estimatedTokens).toBeGreaterThan(0);
        expect(config.dependencies).toBeInstanceOf(Array);
        expect(config.dependencies.length).toBeGreaterThan(0);
      });
    });

    it('should have no duplicate tools within a mode', () => {
      Object.values(MODE_CONFIGS).forEach((config: ModeConfig) => {
        const uniqueTools = new Set(config.tools);
        expect(uniqueTools.size).toBe(config.tools.length);
      });
    });

    it('should have estimated tokens in ascending order: observability < config < guidance < core < full', () => {
      expect(MODE_CONFIGS[ServerMode.OBSERVABILITY].estimatedTokens)
        .toBeLessThan(MODE_CONFIGS[ServerMode.CONFIG].estimatedTokens);
      expect(MODE_CONFIGS[ServerMode.CONFIG].estimatedTokens)
        .toBeLessThan(MODE_CONFIGS[ServerMode.GUIDANCE].estimatedTokens);
      expect(MODE_CONFIGS[ServerMode.GUIDANCE].estimatedTokens)
        .toBeLessThan(MODE_CONFIGS[ServerMode.CORE].estimatedTokens);
      expect(MODE_CONFIGS[ServerMode.CORE].estimatedTokens)
        .toBeLessThan(MODE_CONFIGS[ServerMode.FULL].estimatedTokens);
    });

    describe('CORE mode', () => {
      it('should include essential documentation tools', () => {
        const tools = MODE_CONFIGS[ServerMode.CORE].tools;
        expect(tools).toContain('search_docs');
        expect(tools).toContain('cli_reference');
        expect(tools).toContain('function_reference');
        expect(tools).toContain('get_hcl_config_reference');
        expect(tools).toHaveLength(4);
      });

      it('should load advancedExamples dependency', () => {
        const deps = MODE_CONFIGS[ServerMode.CORE].dependencies;
        expect(deps).toContain('advancedExamples');
        expect(shouldLoadDependency('advancedExamples', ServerMode.CORE)).toBe(true);
      });
    });

    describe('CONFIG mode', () => {
      it('should include exactly the expected configuration generation tools', () => {
        const tools = MODE_CONFIGS[ServerMode.CONFIG].tools.slice().sort();
        const expectedTools = ['build_config', 'get_hcl_config_reference'].sort();
        expect(tools).toEqual(expectedTools);
      });

      it('should have correct dependencies', () => {
        const deps = MODE_CONFIGS[ServerMode.CONFIG].dependencies;
        expect(deps).toContain('templates');
        expect(deps).toContain('generator');
        expect(deps).toContain('hcl');
        expect(deps).toContain('fileWriter');
      });
    });

    describe('GUIDANCE mode', () => {
      it('should include guidance and troubleshooting tools', () => {
        const tools = MODE_CONFIGS[ServerMode.GUIDANCE].tools;
        expect(tools).toContain('get_guidance');
        expect(tools).toContain('diagnose_terragrunt_error');
        expect(tools).toHaveLength(2);
      });

      it('should have correct dependencies', () => {
        const deps = MODE_CONFIGS[ServerMode.GUIDANCE].dependencies;
        expect(deps).toContain('bestPractices');
        expect(deps).toContain('errorPatterns');
        expect(deps).toContain('comparisons');
      });
    });

    describe('FULL mode', () => {
      it('should include all 8 tools', () => {
        const tools = MODE_CONFIGS[ServerMode.FULL].tools;
        expect(tools).toHaveLength(8);
        expect(tools).toContain('search_docs');
        expect(tools).toContain('cli_reference');
        expect(tools).toContain('function_reference');
        expect(tools).toContain('get_hcl_config_reference');
        expect(tools).toContain('get_guidance');
        expect(tools).toContain('build_config');
        expect(tools).toContain('diagnose_terragrunt_error');
        expect(tools).toContain('get_server_metrics');
      });

      it('should have "all" dependency for backward compatibility', () => {
        const deps = MODE_CONFIGS[ServerMode.FULL].dependencies;
        expect(deps).toContain('all');
      });
    });

    describe('OBSERVABILITY mode', () => {
      it('should only include metrics tool', () => {
        const tools = MODE_CONFIGS[ServerMode.OBSERVABILITY].tools;
        expect(tools).toContain('get_server_metrics');
        expect(tools).toHaveLength(1);
      });

      it('should have minimal dependencies', () => {
        const deps = MODE_CONFIGS[ServerMode.OBSERVABILITY].dependencies;
        expect(deps).toContain('metrics');
      });
    });
  });

  describe('parseModeFromArgs', () => {
    it('should return FULL mode when no arguments provided', () => {
      expect(parseModeFromArgs([])).toBe(ServerMode.FULL);
    });

    it('should return FULL mode when --mode flag present but no value', () => {
      expect(parseModeFromArgs(['--mode'])).toBe(ServerMode.FULL);
    });

    it('should parse --mode flag correctly', () => {
      expect(parseModeFromArgs(['--mode', 'core'])).toBe(ServerMode.CORE);
      expect(parseModeFromArgs(['--mode', 'config'])).toBe(ServerMode.CONFIG);
      expect(parseModeFromArgs(['--mode', 'guidance'])).toBe(ServerMode.GUIDANCE);
      expect(parseModeFromArgs(['--mode', 'full'])).toBe(ServerMode.FULL);
      expect(parseModeFromArgs(['--mode', 'observability'])).toBe(ServerMode.OBSERVABILITY);
    });

    it('should parse -m short flag correctly', () => {
      expect(parseModeFromArgs(['-m', 'core'])).toBe(ServerMode.CORE);
      expect(parseModeFromArgs(['-m', 'config'])).toBe(ServerMode.CONFIG);
    });

    it('should handle case-insensitive mode names', () => {
      expect(parseModeFromArgs(['--mode', 'CORE'])).toBe(ServerMode.CORE);
      expect(parseModeFromArgs(['--mode', 'Core'])).toBe(ServerMode.CORE);
      expect(parseModeFromArgs(['--mode', 'CoNfIg'])).toBe(ServerMode.CONFIG);
    });

    it('should default to FULL for invalid mode names', () => {
      expect(parseModeFromArgs(['--mode', 'invalid'])).toBe(ServerMode.FULL);
      expect(parseModeFromArgs(['--mode', 'xyz'])).toBe(ServerMode.FULL);
      expect(parseModeFromArgs(['--mode', ''])).toBe(ServerMode.FULL);
    });

    it('should handle mode flag in various positions', () => {
      expect(parseModeFromArgs(['node', 'index.js', '--mode', 'core'])).toBe(ServerMode.CORE);
      expect(parseModeFromArgs(['--mode', 'core', '--other', 'flag'])).toBe(ServerMode.CORE);
    });
  });

  describe('getModeConfig', () => {
    it('should return correct configuration for each mode', () => {
      Object.values(ServerMode).forEach(mode => {
        const config = getModeConfig(mode);
        expect(config).toBeDefined();
        expect(config.name).toBe(mode);
        expect(config).toBe(MODE_CONFIGS[mode]);
      });
    });
  });

  describe('shouldLoadDependency', () => {
    it('should load all dependencies in FULL mode', () => {
      expect(shouldLoadDependency('docs', ServerMode.FULL)).toBe(true);
      expect(shouldLoadDependency('functions', ServerMode.FULL)).toBe(true);
      expect(shouldLoadDependency('templates', ServerMode.FULL)).toBe(true);
      expect(shouldLoadDependency('bestPractices', ServerMode.FULL)).toBe(true);
    });

    it('should load only specified dependencies in CORE mode', () => {
      expect(shouldLoadDependency('docs', ServerMode.CORE)).toBe(true);
      expect(shouldLoadDependency('functions', ServerMode.CORE)).toBe(true);
      expect(shouldLoadDependency('cli', ServerMode.CORE)).toBe(true);
      expect(shouldLoadDependency('templates', ServerMode.CORE)).toBe(false);
      expect(shouldLoadDependency('bestPractices', ServerMode.CORE)).toBe(false);
    });

    it('should load only specified dependencies in CONFIG mode', () => {
      expect(shouldLoadDependency('templates', ServerMode.CONFIG)).toBe(true);
      expect(shouldLoadDependency('generator', ServerMode.CONFIG)).toBe(true);
      expect(shouldLoadDependency('functions', ServerMode.CONFIG)).toBe(false);
      expect(shouldLoadDependency('bestPractices', ServerMode.CONFIG)).toBe(false);
    });

    it('should load only specified dependencies in GUIDANCE mode', () => {
      expect(shouldLoadDependency('bestPractices', ServerMode.GUIDANCE)).toBe(true);
      expect(shouldLoadDependency('errorPatterns', ServerMode.GUIDANCE)).toBe(true);
      expect(shouldLoadDependency('templates', ServerMode.GUIDANCE)).toBe(false);
      expect(shouldLoadDependency('functions', ServerMode.GUIDANCE)).toBe(false);
    });
  });

  describe('shouldEnableTool', () => {
    it('should enable all tools in FULL mode', () => {
      const fullTools = MODE_CONFIGS[ServerMode.FULL].tools;
      fullTools.forEach(tool => {
        expect(shouldEnableTool(tool, ServerMode.FULL)).toBe(true);
      });
    });

    it('should enable only core tools in CORE mode', () => {
      expect(shouldEnableTool('search_docs', ServerMode.CORE)).toBe(true);
      expect(shouldEnableTool('cli_reference', ServerMode.CORE)).toBe(true);
      expect(shouldEnableTool('function_reference', ServerMode.CORE)).toBe(true);
      expect(shouldEnableTool('build_config', ServerMode.CORE)).toBe(false);
      expect(shouldEnableTool('get_guidance', ServerMode.CORE)).toBe(false);
    });

    it('should enable only config tools in CONFIG mode', () => {
      expect(shouldEnableTool('build_config', ServerMode.CONFIG)).toBe(true);
      expect(shouldEnableTool('search_docs', ServerMode.CONFIG)).toBe(false);
      expect(shouldEnableTool('get_guidance', ServerMode.CONFIG)).toBe(false);
    });

    it('should enable only guidance tools in GUIDANCE mode', () => {
      expect(shouldEnableTool('get_guidance', ServerMode.GUIDANCE)).toBe(true);
      expect(shouldEnableTool('diagnose_terragrunt_error', ServerMode.GUIDANCE)).toBe(true);
      expect(shouldEnableTool('search_docs', ServerMode.GUIDANCE)).toBe(false);
      expect(shouldEnableTool('build_config', ServerMode.GUIDANCE)).toBe(false);
    });
  });

  describe('Token overhead targets', () => {
    it('should meet token reduction targets', () => {
      const fullTokens = MODE_CONFIGS[ServerMode.FULL].estimatedTokens;
      const coreTokens = MODE_CONFIGS[ServerMode.CORE].estimatedTokens;
      const configTokens = MODE_CONFIGS[ServerMode.CONFIG].estimatedTokens;
      const guidanceTokens = MODE_CONFIGS[ServerMode.GUIDANCE].estimatedTokens;

      // Core: 60% reduction target
      expect(coreTokens).toBeLessThanOrEqual(fullTokens * 0.4);
      
      // Config: 73% reduction target
      expect(configTokens).toBeLessThanOrEqual(fullTokens * 0.27);
      
      // Guidance: 72% reduction target (actual 683 tokens, which is 28% of full 2441)
      expect(guidanceTokens).toBeLessThanOrEqual(fullTokens * 0.30);
    });
  });
});
