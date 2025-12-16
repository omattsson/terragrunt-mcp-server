/**
 * Mode Configuration System
 * 
 * Defines operational modes for the Terragrunt MCP Server to enable
 * tool subsetting and reduce token overhead for specific use cases.
 */

export enum ServerMode {
  CORE = 'core',           // Essential docs & references
  CONFIG = 'config',       // Configuration generation
  GUIDANCE = 'guidance',   // Best practices & troubleshooting
  FULL = 'full',          // All tools (default, backward compatible)
  OBSERVABILITY = 'observability'  // Metrics only
}

export interface ModeConfig {
  name: ServerMode;
  description: string;
  tools: string[];
  estimatedTokens: number;
  dependencies: DependencyType[];
}

/**
 * Dependency types that can be conditionally loaded based on mode
 */
export type DependencyType = 
  | 'all'              // Load all dependencies
  | 'docs'             // TerragruntDocsManager
  | 'functions'        // TerragruntFunctionsManager
  | 'cli'              // CLICommandsManager
  | 'templates'        // TemplatesManager
  | 'generator'        // TerragruntConfigGenerator
  | 'hcl'              // HCLBlocksManager
  | 'fileWriter'       // FileWriter
  | 'bestPractices'    // BestPracticesAnalyzer
  | 'errorPatterns'    // ErrorPatternMatcher
  | 'comparisons'      // BlockComparisonManager
  | 'advancedExamples' // AdvancedExamplesManager
  | 'metrics';         // MetricsManager

/**
 * Common dependencies shared across multiple modes.
 * 
 * BASE_DEPS is used only in the CORE and CONFIG modes (not in GUIDANCE).
 * - docs: TerragruntDocsManager provides base documentation access needed by most modes.
 * - hcl: HCLBlocksManager provides structured HCL block reference (used by get_hcl_config_reference tool),
 *   included in BASE_DEPS because it's lightweight and commonly needed across CORE and CONFIG modes.
 */
const BASE_DEPS: DependencyType[] = ['docs', 'hcl'];

/**
 * Mode configurations defining tools and dependencies for each mode
 */
export const MODE_CONFIGS: Record<ServerMode, ModeConfig> = {
  [ServerMode.CORE]: {
    name: ServerMode.CORE,
    description: 'Essential documentation search and reference tools',
    tools: ['search_docs', 'cli_reference', 'function_reference', 'get_hcl_config_reference'],
    estimatedTokens: 965,
    dependencies: [...BASE_DEPS, 'functions', 'cli', 'advancedExamples']
  },
  [ServerMode.CONFIG]: {
    name: ServerMode.CONFIG,
    description: 'Configuration generation and file writing',
    tools: ['build_config', 'get_hcl_config_reference'],
    estimatedTokens: 640,
    dependencies: [...BASE_DEPS, 'templates', 'generator', 'fileWriter']
  },
  [ServerMode.GUIDANCE]: {
    name: ServerMode.GUIDANCE,
    description: 'Best practices and error diagnosis',
    tools: ['get_guidance', 'diagnose_terragrunt_error'],
    estimatedTokens: 683,
    dependencies: ['docs', 'bestPractices', 'errorPatterns', 'comparisons']
  },
  [ServerMode.FULL]: {
    name: ServerMode.FULL,
    description: 'All tools (backward compatible default)',
    tools: [
      'search_docs',
      'cli_reference',
      'function_reference',
      'get_hcl_config_reference',
      'get_guidance',
      'build_config',
      'diagnose_terragrunt_error',
      'get_server_metrics'
    ],
    estimatedTokens: 2441,
    dependencies: ['all']
  },
  [ServerMode.OBSERVABILITY]: {
    name: ServerMode.OBSERVABILITY,
    description: 'Server metrics and monitoring',
    tools: ['get_server_metrics'],
    estimatedTokens: 155,
    dependencies: []
  }
};

/**
 * Parse server mode from command-line arguments
 * 
 * @param args - Command-line arguments (typically process.argv)
 * @returns Parsed ServerMode, defaults to FULL for backward compatibility
 */
export function parseModeFromArgs(args: string[]): ServerMode {
  const modeIndex = args.findIndex(arg => arg === '--mode' || arg === '-m');
  
  // No mode specified - use default
  if (modeIndex === -1 || modeIndex === args.length - 1) {
    return ServerMode.FULL;
  }
  
  const modeValue = args[modeIndex + 1].toLowerCase();
  
  // Validate mode value
  if (Object.values(ServerMode).includes(modeValue as ServerMode)) {
    return modeValue as ServerMode;
  }
  
  // Invalid mode - warn and use default
  console.error(`[Mode] Unknown mode '${modeValue}', defaulting to 'full'`);
  console.error(`[Mode] Valid modes: ${Object.values(ServerMode).join(', ')}`);
  return ServerMode.FULL;
}

/**
 * Get configuration for a specific mode
 * 
 * @param mode - Server mode
 * @returns Mode configuration
 */
export function getModeConfig(mode: ServerMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Check if a dependency should be loaded for a given mode
 * 
 * @param dependency - Dependency type to check
 * @param mode - Server mode
 * @returns true if dependency should be loaded
 */
export function shouldLoadDependency(dependency: DependencyType, mode: ServerMode): boolean {
  const config = MODE_CONFIGS[mode];
  return config.dependencies.includes('all') || config.dependencies.includes(dependency);
}

/**
 * Check if a tool should be available in a given mode
 * 
 * @param toolName - Tool name to check
 * @param mode - Server mode
 * @returns true if tool should be available
 */
export function shouldEnableTool(toolName: string, mode: ServerMode): boolean {
  const config = MODE_CONFIGS[mode];
  return config.tools.includes(toolName);
}
