/**
 * ToolHandler - MCP Tool Handler for Terragrunt Documentation Server
 * 
 * v0.5.0 - Consolidated Tool Architecture
 * ========================================
 * 
 * This handler implements 8 consolidated tools for comprehensive Terragrunt assistance:
 * 
 * 1. search_docs           - Unified documentation search (search/list/section/examples modes)
 * 2. function_reference    - Get/list built-in functions (unified get+list)
 * 3. cli_reference         - Get/list CLI commands (unified get+list)
 * 4. get_hcl_config_reference - HCL block documentation
 * 5. get_guidance          - Best practices, comparisons, and patterns
 * 6. build_config          - Generate/write/generate+write configurations (unified)
 * 7. diagnose_terragrunt_error - Error diagnosis and troubleshooting
 * 8. get_server_metrics    - Server observability and performance monitoring
 * 
 * Architecture Changes in v0.5.0:
 * - Consolidated 11 separate tools into 8 (7 core + 1 observability)
 * - Removed separate get/list tools in favor of mode-based routing
 * - Unified generate+write operations into single build_config tool
 * - Tool-only architecture (resources removed)
 * 
 * Migration from v0.4.x:
 * - get_terragrunt_function + list_terragrunt_functions → function_reference
 * - get_cli_command_help + list_cli_commands → cli_reference  
 * - generate_terragrunt_config + write_terragrunt_config → build_config
 */

import { TerragruntDocsManager } from '../terragrunt/docs.js';
import { TerragruntFunctionsManager } from '../terragrunt/functions.js';
import { BestPracticesAnalyzer } from '../terragrunt/best-practices.js';
import { TerragruntConfigGenerator } from '../terragrunt/generator.js';
import { ConfigTemplateLibrary, UseCase } from '../terragrunt/library.js';
import { TemplatesManager } from '../terragrunt/templates/index.js';
import { BuiltinTemplateLoader } from '../terragrunt/templates/loaders/builtin.js';
import { FilesystemTemplateLoader } from '../terragrunt/templates/loaders/filesystem.js';
import { CustomTemplateLoader } from '../terragrunt/templates/loaders/custom.js';
import { TemplateValidator } from '../terragrunt/templates/validator.js';
import { FileWriter } from '../terragrunt/file-writer.js';
import { ErrorPatternMatcher } from '../terragrunt/error-patterns.js';
import { CLICommandsManager } from '../terragrunt/cli-commands.js';
import { HCLBlocksManager } from '../terragrunt/hcl-blocks.js';
import { AdvancedExamplesManager } from '../terragrunt/advanced-examples.js';
import { BlockComparisonManager } from '../terragrunt/comparisons.js';
import { getFirstSentence } from '../terragrunt/utils.js';
import type { HCLBlock, HCLBlockCategory } from '../types/hcl-blocks.js';
import type { AdvancedExampleCategory } from '../types/advanced-examples.js';
import type { IMetricsManager, MetricsResponse } from '../types/metrics.js';
import type { PaginationMetadata } from '../types/mcp.js';
import { NullMetricsManager } from '../terragrunt/metrics.js';
import { ServerMode, shouldLoadDependency, shouldEnableTool } from '../modes/config.js';

export interface Tool {
    name: string;
    description: string;
    inputSchema: any;
}

/**
 * Type-safe arguments for unified search_docs tool
 * Mode parameter determines which additional parameters are required
 */
interface SearchDocsArgs {
    mode?: 'search' | 'list' | 'section' | 'examples';
    // Search mode parameters
    query?: string;
    page?: number;
    pageSize?: number;
    // Section mode parameters
    section?: string;
    // Examples mode parameters
    detailLevel?: 'summary' | 'full';
    limit?: number;
    advanced?: boolean;
    category?: AdvancedExampleCategory;
    listCategories?: boolean;
}

/**
 * Type-safe arguments for unified cli_reference tool
 * Presence of command parameter determines get vs list mode
 */
interface CLIReferenceArgs {
    // Get mode: specific command help
    command?: string;
    // List mode: filtering and pagination
    category?: 'main' | 'backend' | 'stack' | 'catalog' | 'discovery' | 'configuration' | 'shortcut';
    search?: string;
    page?: number;
    pageSize?: number;
}

/**
 * Type-safe arguments for unified function_reference tool
 * Presence of function_name parameter determines get vs list mode
 */
interface FunctionReferenceArgs {
    // Get mode: specific function details
    function_name?: string;
    mode?: 'summary' | 'full';
    include_examples?: boolean;
    // List mode: filtering and pagination
    category?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}

/**
 * Type-safe arguments for unified build_config tool.
 * Supports three operational modes with mode-specific required parameters:
 * 
 * 1. Generate-only: Generates configuration and returns it (does not write to disk).
 *    - Required: useCase, options
 *    - Optional: backend, tier, strictValidation, custom_template
 * 
 * 2. Write-only: Writes provided HCL content to disk (does not generate).
 *    - Required: content, path
 *    - Optional: overwrite, createBackup, createParentDirs, strictValidation
 * 
 * 3. Generate+Write: Generates configuration and writes it to disk in one operation.
 *    - Required: useCase, options, write=true, path
 *    - Optional: backend, tier, strictValidation, custom_template, overwrite, createBackup, createParentDirs
 * 
 * Routing precedence: If 'content' is provided, it takes precedence over 'useCase' (write-only mode is used).
 */
interface BuildConfigArgs {
    // Mode 2: Write-only mode parameter (takes precedence if provided)
    content?: string;
    
    // Mode 1 & 3: Generate parameters (required for generate modes)
    useCase?: 'remote_state' | 'provider_generation' | 'dependencies' | 'hooks' | 'inputs';
    options?: Record<string, string | number | boolean | undefined>;
    
    // Generate-specific optional parameters
    backend?: string;
    tier?: 'essential' | 'advanced' | 'complete';
    strictValidation?: boolean;
    custom_template?: {
        id: string;
        name: string;
        description: string;
        category: 'backend' | 'provider' | 'dependency' | 'hooks' | 'inputs' | 'advanced' | 'configuration';
        cloudProvider?: 'aws' | 'azure' | 'gcp' | 'multi';
        templateHcl: string;
        variables?: Array<{
            name: string;
            type: string;
            required: boolean;
            description?: string;
            defaultValue?: unknown;
            example?: string;
        }>;
        tags?: string[];
        example?: string;
    };
    
    // Write mode parameters (optional - enables write mode)
    write?: boolean;
    path?: string;
    overwrite?: boolean;
    createBackup?: boolean;
    createParentDirs?: boolean;
}

export class ToolHandler {
    private mode: ServerMode;
    private docsManager?: TerragruntDocsManager;
    private functionsManager?: TerragruntFunctionsManager;
    private bestPracticesAnalyzer?: BestPracticesAnalyzer;
    private errorPatternMatcher?: ErrorPatternMatcher;
    private cliCommandsManager?: CLICommandsManager;
    private hclBlocksManager?: HCLBlocksManager;
    private advancedExamplesManager?: AdvancedExamplesManager;
    private blockComparisonManager?: BlockComparisonManager;
    private functionsLoaded: boolean = false;
    private templatesManager?: TemplatesManager;
    private templateLibrary?: ConfigTemplateLibrary;
    private configGenerator?: TerragruntConfigGenerator;
    private fileWriter?: FileWriter;
    private metricsManager: IMetricsManager;

    constructor(metricsManager?: IMetricsManager, mode: ServerMode = ServerMode.FULL) {
        this.mode = mode;
        this.metricsManager = metricsManager || new NullMetricsManager();
        
        // Initialize managers based on mode
        this.initializeManagers();
    }
    
    /**
     * Lazy initialization of managers based on server mode.
     * Only instantiates managers needed for the current mode to reduce memory footprint.
     */
    private initializeManagers(): void {
        // DocsManager is required by multiple dependencies
        if (shouldLoadDependency('docs', this.mode)) {
            this.docsManager = new TerragruntDocsManager();
        }
        
        // Functions management
        if (shouldLoadDependency('functions', this.mode) && this.docsManager) {
            this.functionsManager = new TerragruntFunctionsManager(this.docsManager);
        }
        
        // Best practices and guidance
        if (shouldLoadDependency('bestPractices', this.mode) && this.docsManager) {
            this.bestPracticesAnalyzer = new BestPracticesAnalyzer(this.docsManager);
        }
        
        // Error diagnosis
        if (shouldLoadDependency('errorPatterns', this.mode) && this.docsManager) {
            this.errorPatternMatcher = new ErrorPatternMatcher(this.docsManager);
        }
        
        // CLI commands
        if (shouldLoadDependency('cli', this.mode)) {
            this.cliCommandsManager = new CLICommandsManager();
        }
        
        // HCL blocks
        if (shouldLoadDependency('hcl', this.mode)) {
            this.hclBlocksManager = new HCLBlocksManager();
        }
        
        // Advanced examples
        if (shouldLoadDependency('advancedExamples', this.mode)) {
            this.advancedExamplesManager = new AdvancedExamplesManager();
        }
        
        // Block comparisons
        if (shouldLoadDependency('comparisons', this.mode)) {
            this.blockComparisonManager = new BlockComparisonManager();
        }
        
        // Configuration generation subsystem
        if (shouldLoadDependency('templates', this.mode)) {
            // Initialize templates manager with builtin and filesystem loaders
            this.templatesManager = new TemplatesManager([
                new BuiltinTemplateLoader(),
                new FilesystemTemplateLoader()  // Defaults to ~/.terragrunt-mcp/templates/
            ]);
            
            this.templateLibrary = new ConfigTemplateLibrary(this.templatesManager);
            
            // NOTE: The 'generator' dependency REQUIRES 'docsManager' to be available.
            // This dependency is implicit and enforced here via the conditional check.
            // CONFIG mode dependencies include both 'docs' and 'generator' to satisfy this.
            if (shouldLoadDependency('generator', this.mode) && this.docsManager) {
                this.configGenerator = new TerragruntConfigGenerator(this.docsManager, this.templateLibrary);
            }
        }
        
        // File writer (independent of templates but often used together)
        if (shouldLoadDependency('fileWriter', this.mode)) {
            this.fileWriter = new FileWriter({
                enabled: process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED !== 'false',
                allowedDirectories: this.parseAllowedDirectories(),
                autoBackup: process.env.TERRAGRUNT_MCP_AUTO_BACKUP !== 'false',
                maxFileSize: parseInt(process.env.TERRAGRUNT_MCP_MAX_FILE_SIZE || '1048576', 10) || 1048576
            });
        }
    }
    
    /**
     * Parse allowed directories from environment variable
     */
    private parseAllowedDirectories(): string[] {
        const envDirs = process.env.TERRAGRUNT_MCP_ALLOWED_DIRS;
        if (envDirs) {
            return envDirs.split(',').map(dir => dir.trim());
        }
        // Default to current working directory
        return [process.cwd()];
    }
    
    /**
     * Check if a manager is available. Returns error response if not.
     * After calling this and checking for error, use non-null assertion (!) on the manager.
     */
    private checkManager<T>(manager: T | undefined, managerName: string): { error: string; errorType: string } | null {
        if (!manager) {
            return {
                error: `${managerName} is not available in ${this.mode} mode. This tool is disabled.`,
                errorType: 'MODE_RESTRICTION'
            };
        }
        return null;
    }

    /**
     * Calculate pagination metadata and slice results for a given page
     */
    private calculatePagination<T>(
        items: T[],
        page: number = 1,
        pageSize: number = 20
    ): { results: T[]; pagination: PaginationMetadata } {
        const totalItems = items.length;
        
        // Explicitly handle pageSize <= 0 to avoid division by zero and Infinity
        // Returns empty results with warning field to distinguish from legitimate empty result sets
        if (pageSize <= 0) {
            return {
                results: [],
                pagination: {
                    page,
                    pageSize,
                    totalPages: 1,
                    totalItems,
                    hasMore: false,
                    hasPrevious: false,
                    warning: `Invalid pageSize (${pageSize}). Must be positive integer. Returning empty results.`
                }
            };
        }
        
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        return {
            results: items.slice(startIndex, endIndex),
            pagination: {
                page,
                pageSize,
                totalPages,
                totalItems,
                hasMore: page < totalPages,
                hasPrevious: page > 1
            }
        };
    }

    getAvailableTools(): Tool[] {
        const allTools = [
            {
                name: 'search_docs',
                description: 'Search docs, list sections, or find code examples',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mode: {
                            type: 'string',
                            enum: ['search', 'list', 'section', 'examples'],
                            description: 'Operation mode',
                            default: 'search'
                        },
                        query: {
                            type: 'string',
                            description: 'Search query'
                        },
                        section: {
                            type: 'string',
                            description: 'Section name'
                        },
                        detailLevel: {
                            type: 'string',
                            enum: ['summary', 'full'],
                            description: 'Detail level',
                            default: 'summary'
                        },
                        page: {
                            type: 'number',
                            description: 'Page number',
                            default: 1
                        },
                        pageSize: {
                            type: 'number',
                            description: 'Results per page',
                            default: 10
                        },
                        limit: {
                            type: 'number',
                            description: 'Max results',
                            default: 5
                        },
                        advanced: {
                            type: 'boolean',
                            description: 'Return advanced examples',
                            default: false
                        },
                        category: {
                            type: 'string',
                            description: 'Filter by category',
                            enum: ['hooks', 'generate', 'environment', 'dependencies', 'dry-patterns']
                        },
                        listCategories: {
                            type: 'boolean',
                            description: 'List categories',
                            default: false
                        }
                    },
                    required: []
                }
            },
            {
                name: 'function_reference',
                description: 'Get function details or list all functions',
                inputSchema: {
                    type: 'object',
                    properties: {
                        function_name: {
                            type: 'string',
                            description: 'Function name'
                        },
                        mode: {
                            type: 'string',
                            enum: ['summary', 'full'],
                            description: 'Detail level',
                            default: 'summary'
                        },
                        include_examples: {
                            type: 'boolean',
                            description: 'Include examples',
                            default: true
                        },
                        category: {
                            type: 'string',
                            description: 'Category filter'
                        },
                        search: {
                            type: 'string',
                            description: 'Search query'
                        },
                        page: {
                            type: 'number',
                            description: 'Page number',
                            default: 1
                        },
                        pageSize: {
                            type: 'number',
                            description: 'Results per page',
                            default: 20
                        }
                    },
                    required: []
                }
            },
            {
                name: 'cli_reference',
                description: 'Get CLI command help or list commands',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'Command name'
                        },
                        category: {
                            type: 'string',
                            description: 'Category filter',
                            enum: ['main', 'backend', 'stack', 'catalog', 'discovery', 'configuration', 'shortcut']
                        },
                        search: {
                            type: 'string',
                            description: 'Search query'
                        },
                        page: {
                            type: 'number',
                            description: 'Page number',
                            default: 1
                        },
                        pageSize: {
                            type: 'number',
                            description: 'Commands per page',
                            default: 20
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_hcl_config_reference',
                description: 'Get HCL block docs with syntax and examples',
                inputSchema: {
                    type: 'object',
                    properties: {
                        config: {
                            type: 'string',
                            description: 'Block name'
                        },
                        category: {
                            type: 'string',
                            description: 'Category filter',
                            enum: ['core', 'modules', 'generation', 'execution', 'iam', 'terraform']
                        },
                        listBlocks: {
                            type: 'boolean',
                            description: 'List all blocks',
                            default: false
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_guidance',
                description: 'Get best practices, comparisons, or patterns',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Topic, comparison, or scenario'
                        },
                        type: {
                            type: 'string',
                            enum: ['best-practices', 'comparison', 'pattern'],
                            description: 'Guidance type'
                        },
                        mode: {
                            type: 'string',
                            enum: ['summary', 'full'],
                            description: 'Detail level',
                            default: 'summary'
                        },
                        level: {
                            type: 'string',
                            enum: ['beginner', 'intermediate', 'advanced'],
                            description: 'Experience level'
                        },
                        listAll: {
                            type: 'boolean',
                            description: 'List all available',
                            default: false
                        }
                    },
                    required: []
                }
            },
            {
                name: 'build_config',
                description: 'Generate or write Terragrunt configuration',
                inputSchema: {
                    type: 'object',
                    properties: {
                        useCase: {
                            type: 'string',
                            enum: ['remote_state', 'provider_generation', 'dependencies', 'hooks', 'inputs'],
                            description: 'Use case'
                        },
                        options: {
                            type: 'object',
                            description: 'Template variables',
                            additionalProperties: true
                        },
                        content: {
                            type: 'string',
                            description: 'HCL content to write'
                        },
                        backend: {
                            type: 'string',
                            description: 'Backend type'
                        },
                        tier: {
                            type: 'string',
                            enum: ['essential', 'advanced', 'complete'],
                            description: 'Template tier',
                            default: 'essential'
                        },
                        strictValidation: {
                            type: 'boolean',
                            description: 'Strict validation',
                            default: false
                        },
                        write: {
                            type: 'boolean',
                            description: 'Write to disk',
                            default: false
                        },
                        path: {
                            type: 'string',
                            description: 'File path'
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Allow overwrite',
                            default: false
                        },
                        createBackup: {
                            type: 'boolean',
                            description: 'Create backup',
                            default: true
                        },
                        createParentDirs: {
                            type: 'boolean',
                            description: 'Create parent dirs',
                            default: true
                        }
                    },
                    required: []
                }
            },
            {
                name: 'diagnose_terragrunt_error',
                description: 'Diagnose Terragrunt errors with solutions',
                inputSchema: {
                    type: 'object',
                    properties: {
                        error_message: {
                            type: 'string',
                            description: 'Error message'
                        },
                        command: {
                            type: 'string',
                            description: 'Command run'
                        },
                        version: {
                            type: 'string',
                            description: 'Terragrunt version'
                        },
                        os: {
                            type: 'string',
                            description: 'Operating system'
                        },
                        filePath: {
                            type: 'string',
                            description: 'File path'
                        },
                        module: {
                            type: 'string',
                            description: 'Module name'
                        },
                        backend: {
                            type: 'string',
                            description: 'Backend type'
                        },
                        maxMatches: {
                            type: 'number',
                            description: 'Max matches',
                            default: 3
                        },
                        minConfidence: {
                            type: 'number',
                            description: 'Min confidence',
                            default: 0.3
                        },
                        enableFuzzyMatching: {
                            type: 'boolean',
                            description: 'Fuzzy matching',
                            default: true
                        },
                        enrichWithDocs: {
                            type: 'boolean',
                            description: 'Enrich with docs',
                            default: false
                        },
                        includeDestructiveCommands: {
                            type: 'boolean',
                            description: 'Include destructive',
                            default: true
                        }
                    },
                    required: ['error_message']
                }
            },
            {
                name: 'get_server_metrics',
                description: 'Get server metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filter: {
                            type: 'string',
                            description: 'Filter pattern'
                        },
                        format: {
                            type: 'string',
                            enum: ['json', 'text'],
                            description: 'Output format',
                            default: 'json'
                        },
                        reset: {
                            type: 'boolean',
                            description: 'Reset after get',
                            default: false
                        }
                    },
                    required: []
                }
            }
        ];
        
        // Filter tools based on server mode
        return allTools.filter(tool => shouldEnableTool(tool.name, this.mode));
    }

    async executeTool(name: string, args?: any): Promise<any> {
        try {
            const result = await this.executeToolInternal(name, args);
            
            // Log metrics (skip for get_server_metrics to avoid recursion)
            if (name !== 'get_server_metrics') {
                this.metricsManager.logResponse('tool', name, result);
            }
            
            return result;
        } catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            const errorResult = {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
            this.metricsManager.logResponse('tool', name, errorResult);
            throw error;
        }
    }
    
    private async executeToolInternal(name: string, args?: any): Promise<any> {
        try {
            switch (name) {
                case 'search_docs':
                    return await this.searchDocs(args);

                case 'cli_reference':
                    return await this.cliReference(args);

                case 'function_reference':
                    return await this.functionReference(args);

                case 'get_hcl_config_reference':
                    return await this.getHclConfigReference(
                        args?.config,
                        args?.category,
                        args?.listBlocks ?? false
                    );

                case 'get_guidance':
                    return await this.getGuidance(
                        args?.query,
                        args?.type,
                        args?.mode ?? 'summary',
                        args?.level,
                        args?.listAll ?? false
                    );

                case 'build_config':
                    // Validate mutually exclusive parameters
                    if (args?.content && args?.useCase) {
                        return {
                            error: 'Cannot provide both content (write-only mode) and useCase (generate mode). Choose one mode: write-only requires content+path, generate modes require useCase+options.',
                            errorType: 'VALIDATION_ERROR'
                        };
                    }
                    
                    // Handle write-only mode (content provided directly)
                    if (args?.content) {
                        // Validate content is a string
                        if (typeof args.content !== 'string') {
                            return {
                                success: false,
                                path: '',
                                bytesWritten: 0,
                                created: false,
                                backedUp: false,
                                error: 'content parameter must be a string',
                                errorType: 'VALIDATION_ERROR'
                            };
                        }
                        
                        const targetPath = args?.path;
                        if (!targetPath) {
                            return {
                                success: false,
                                path: '',
                                bytesWritten: 0,
                                created: false,
                                backedUp: false,
                                error: 'path parameter is required when content is provided',
                                errorType: 'VALIDATION_ERROR'
                            };
                        }
                        
                        // Validate path is a string
                        if (typeof targetPath !== 'string') {
                            return {
                                success: false,
                                path: '',
                                bytesWritten: 0,
                                created: false,
                                backedUp: false,
                                error: 'path parameter must be a string',
                                errorType: 'VALIDATION_ERROR'
                            };
                        }
                        return await this.writeTerragruntConfig(
                            args.content,
                            targetPath,
                            args.overwrite ?? false,
                            args.createBackup ?? true,
                            args.createParentDirs ?? true
                        );
                    }
                    
                    // Handle generate mode (with optional write)
                    if (!args?.useCase) {
                        return { error: 'useCase parameter is required (or provide content for write-only mode)' };
                    }
                    if (!args?.options) {
                        return { error: 'options parameter is required' };
                    }
                    
                    // Validate write mode parameters early
                    if (args.write && !args.path) {
                        return { 
                            error: 'path parameter is required when write=true',
                            errorType: 'VALIDATION_ERROR'
                        };
                    }
                    if (args.write && args.path && typeof args.path !== 'string') {
                        return { 
                            error: 'path parameter must be a string',
                            errorType: 'VALIDATION_ERROR'
                        };
                    }
                    
                    return await this.buildConfig(
                        args.useCase,
                        args.backend,
                        args.tier,
                        args.options,
                        args.strictValidation ?? false,
                        args.custom_template,  // Still supported for backward compatibility despite schema removal
                        args.write ?? false,
                        args.path,
                        args.overwrite ?? false,
                        args.createBackup ?? true,
                        args.createParentDirs ?? true
                    );

                case 'diagnose_terragrunt_error':
                    if (!args?.error_message) {
                        return { error: 'error_message parameter is required' };
                    }
                    // Reconstruct nested objects from flattened parameters
                    // If nested form provided, use it; otherwise construct from flattened properties.
                    // This maintains backward compatibility with both old (nested) and new (flat) schemas.
                    // Precedence: If both nested and flattened forms are provided, nested takes priority.
                    // (Nested takes priority to preserve behavior of existing clients that still pass the old format.)
                    // Example:
                    //   Old schema: { context: { command, version, ... } }
                    //   New schema: { command, version, ... }
                    const context = this.reconstructNestedObject(args.context, {
                        command: args.command,
                        version: args.version,
                        os: args.os,
                        filePath: args.filePath,
                        module: args.module,
                        backend: args.backend
                    });
                    const options = this.reconstructNestedObject(args.options, {
                        maxMatches: args.maxMatches,
                        minConfidence: args.minConfidence,
                        enableFuzzyMatching: args.enableFuzzyMatching,
                        enrichWithDocs: args.enrichWithDocs,
                        includeDestructiveCommands: args.includeDestructiveCommands
                    });
                    return await this.diagnoseTerragruntError(
                        args.error_message,
                        context,
                        options
                    );

                case 'get_server_metrics':
                    return this.getServerMetrics(
                        args?.filter,
                        args?.format ?? 'json',
                        args?.reset ?? false
                    );

                default:
                    return {
                        error: `Unknown tool: ${name}`
                    };
            }
        } catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            return {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    private async searchTerragruntDocs(
        query: string,
        page: number = 1,
        pageSize: number = 10
    ): Promise<any> {
        const results = await this.docsManager!.searchDocs(query);

        // Apply pagination
        const { results: paginatedResults, pagination } = this.calculatePagination(
            results,
            page,
            pageSize
        );

        const response = {
            query,
            results: paginatedResults.map(doc => ({
                title: doc.title,
                url: doc.url,
                section: doc.section,
                snippet: doc.content.length > 300
                    ? doc.content.substring(0, 300) + '...'
                    : doc.content,
                lastUpdated: doc.lastUpdated
            })),
            pagination
        };

        // Log metrics for search operations
        this.metricsManager.logResponse('tool', `search_docs:${query}`, response);

        return response;
    }

    private async getTerragruntSections(): Promise<any> {
        const sections = await this.docsManager!.getAvailableSections();
        const docs = await this.docsManager!.fetchLatestDocs();

        return {
            sections: sections.map(section => ({
                name: section,
                docCount: docs.filter(doc => doc.section === section).length
            })),
            totalSections: sections.length,
            totalDocs: docs.length
        };
    }

    private async getSectionDocs(section: string, mode: 'summary' | 'full' = 'summary'): Promise<any> {
        const docs = await this.docsManager!.getDocBySection(section);

        if (docs.length === 0) {
            return {
                section,
                error: `No documentation found for section: ${section}`,
                availableSections: await this.docsManager!.getAvailableSections()
            };
        }

        // Summary mode: titles, URLs, and short snippets only
        if (mode === 'summary') {
            return {
                section,
                documentCount: docs.length,
                documents: docs.map(doc => ({
                    title: doc.title,
                    url: doc.url,
                    snippet: getFirstSentence(doc.content)
                }))
            };
        }

        // Full mode: complete content (original behavior)
        return {
            section,
            docs: docs.map(doc => ({
                title: doc.title,
                url: doc.url,
                content: doc.content.length > 500
                    ? doc.content.substring(0, 500) + '...'
                    : doc.content,
                lastUpdated: doc.lastUpdated
            })),
            totalDocs: docs.length
        };
    }

    /**
     * Unified documentation search router
     * Routes to appropriate method based on mode parameter
     */
    private async searchDocs(args: SearchDocsArgs): Promise<any> {
        // Check if DocsManager is available
        const docsCheck = this.checkManager(this.docsManager, 'DocsManager');
        if (docsCheck) return docsCheck;
        
        const mode = args?.mode ?? 'search';

        switch (mode) {
            case 'search':
                // Semantic search across all docs
                if (!args?.query) {
                    return { error: 'query parameter is required for search mode' };
                }
                return await this.searchTerragruntDocs(
                    args.query,
                    args?.page ?? 1,
                    args?.pageSize ?? 10
                );

            case 'list':
                // List available documentation sections
                return await this.getTerragruntSections();

            case 'section':
                // Get specific section content
                if (!args?.section) {
                    return { error: 'section parameter is required for section mode' };
                }
                return await this.getSectionDocs(
                    args.section,
                    args?.detailLevel ?? 'summary'
                );

            case 'examples':
                // Search for code examples
                const advancedCheck = this.checkManager(this.advancedExamplesManager, 'AdvancedExamplesManager');
                if (advancedCheck) return advancedCheck;
                
                return await this.getCodeExamples(
                    args?.query,
                    args?.detailLevel ?? 'summary',
                    args?.limit,
                    args?.advanced ?? false,
                    args?.category,
                    args?.listCategories ?? false
                );

            default:
                return { error: `Unknown mode: ${mode}. Valid modes are: search, list, section, examples` };
        }
    }

    /**
     * Unified CLI reference router
     * Routes to appropriate method based on command parameter presence.
     *
     * Behavior details (important for clients):
     * - Get mode: when `command` is a non-empty string.
     * - List mode: when `command` is omitted OR an empty/whitespace-only string.
     * - Pagination: `page` and `pageSize` are normalized to positive integers to avoid
     *   surprising slice behavior (e.g., negative pages).
     */
    private async cliReference(args: CLIReferenceArgs): Promise<any> {
        // Check if CLICommandsManager is available
        const cliCheck = this.checkManager(this.cliCommandsManager, 'CLICommandsManager');
        if (cliCheck) return cliCheck;
        
        // Normalize empty/whitespace command strings to list mode.
        const command = typeof args?.command === 'string' ? args.command.trim() : undefined;

        // Get mode: specific command help
        if (command) {
            return await this.getCliCommandHelp(command);
        }

        // List mode: all commands with optional filtering
        const page = this.normalizePositiveInt(args?.page, 1);
        const pageSize = this.normalizePositiveInt(args?.pageSize, 20);
        return await this.listCliCommands(args?.category, args?.search, page, pageSize);
    }

    /**
     * Unified router for function_reference tool.
     * Dual-mode operation:
     * - Get mode: when `function_name` is provided (non-empty string after trim).
     * - List mode: when `function_name` is omitted OR an empty/whitespace-only string.
     * - Pagination: `page` and `pageSize` are normalized to positive integers.
     */
    private async functionReference(args: FunctionReferenceArgs): Promise<any> {
        // Check if FunctionsManager is available
        const functionsCheck = this.checkManager(this.functionsManager, 'FunctionsManager');
        if (functionsCheck) return functionsCheck;
        
        // Normalize empty/whitespace function_name strings to list mode.
        const functionName = typeof args?.function_name === 'string' ? args.function_name.trim() : undefined;

        // Get mode: specific function details
        if (functionName) {
            return await this.getTerragruntFunction(
                functionName,
                args?.mode ?? 'summary',
                args?.include_examples ?? true
            );
        }

        // List mode: all functions with optional filtering
        const page = this.normalizePositiveInt(args?.page, 1);
        const pageSize = this.normalizePositiveInt(args?.pageSize, 20);
        return await this.listTerragruntFunctions(args?.category, args?.search, page, pageSize);
    }

    /**
     * Reconstruct nested object from flattened properties
     * Used for backward compatibility when migrating from nested to flat schemas
     * @param nestedValue - Existing nested object if provided by legacy clients still using old schema
     * @param flatProperties - Flattened properties to construct object from (new schema format)
     * @returns Nested object with undefined values filtered out
     */
    private reconstructNestedObject<T extends Record<string, any>>(
        nestedValue: T | undefined,
        flatProperties: Record<string, any>
    ): T {
        if (nestedValue) {
            return nestedValue;
        }
        return Object.fromEntries(
            // Filter out undefined values regardless of key
            Object.entries(flatProperties).filter(([key, v]) => v !== undefined)
        ) as T;
    }

    private normalizePositiveInt(value: unknown, defaultValue: number): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return defaultValue;
        }

        const intValue = Math.floor(value);
        return intValue >= 1 ? intValue : defaultValue;
    }

    private async getCliCommandHelp(command: string): Promise<any> {
        // First, try to get structured documentation from CLICommandsManager
        const structuredCmd = this.cliCommandsManager!.getCommand(command);
        
        if (structuredCmd) {
            // Return comprehensive structured documentation
            return {
                command: structuredCmd.name,
                aliases: structuredCmd.aliases,
                category: structuredCmd.category,
                description: structuredCmd.description,
                usage: structuredCmd.usage,
                details: structuredCmd.details,
                options: structuredCmd.options.map(opt => ({
                    flag: opt.flag,
                    shortFlag: opt.shortFlag,
                    type: opt.type,
                    description: opt.description,
                    defaultValue: opt.defaultValue,
                    envVar: opt.envVar,
                    required: opt.required,
                    example: opt.example
                })),
                examples: structuredCmd.examples.map(ex => ({
                    description: ex.description,
                    command: ex.command,
                    output: ex.output
                })),
                relatedCommands: structuredCmd.relatedCommands,
                notes: structuredCmd.notes,
                deprecated: structuredCmd.deprecated,
                documentationUrl: structuredCmd.documentationUrl,
                // Include formatted markdown help
                formattedHelp: this.cliCommandsManager!.formatCommandHelp(structuredCmd)
            };
        }

        // Fallback to docs manager for commands not in structured data
        const doc = await this.docsManager!.getCliCommandHelp(command);

        if (!doc) {
            // Provide helpful suggestions
            const searchResults = this.cliCommandsManager!.searchCommands(command);
            const suggestions = searchResults.slice(0, 3).map(r => r.command.name);
            const allCommands = this.cliCommandsManager!.getAllCommands().map(c => c.name);
            
            return {
                command,
                error: `No CLI command documentation found for: ${command}`,
                suggestions: suggestions.length > 0 ? suggestions : undefined,
                availableCommands: allCommands,
                hint: 'Use cli_reference without command parameter to see all available commands organized by category'
            };
        }

        return {
            command,
            title: doc.title,
            url: doc.url,
            content: doc.content,
            lastUpdated: doc.lastUpdated,
            source: 'documentation'
        };
    }

    /**
     * List all CLI commands, optionally filtered by category or search query
     */
    private async listCliCommands(
        category?: 'main' | 'backend' | 'stack' | 'catalog' | 'discovery' | 'configuration' | 'shortcut',
        search?: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<any> {
        if (search) {
            // Search for matching commands
            const results = this.cliCommandsManager!.searchCommands(search);
            const { results: paginatedResults, pagination } = this.calculatePagination(
                results,
                page,
                pageSize
            );
            
            return {
                search,
                results: paginatedResults.map(r => ({
                    name: r.command.name,
                    aliases: r.command.aliases,
                    category: r.command.category,
                    description: r.command.description,
                    usage: r.command.usage,
                    score: r.score,
                    matchType: r.matchType
                })),
                pagination
            };
        }

        if (category) {
            // Filter by category
            const commands = this.cliCommandsManager!.getCommandsByCategory(category);
            const { results: paginatedResults, pagination } = this.calculatePagination(
                commands,
                page,
                pageSize
            );
            
            return {
                category,
                commands: paginatedResults.map(cmd => ({
                    name: cmd.name,
                    aliases: cmd.aliases,
                    description: cmd.description,
                    usage: cmd.usage
                })),
                pagination
            };
        }

        // Return all commands organized by category
        const categories = this.cliCommandsManager!.getCategories();
        const allCommands = this.cliCommandsManager!.getAllCommands();
        const { results: paginatedCommands, pagination } = this.calculatePagination(
            allCommands,
            page,
            pageSize
        );
        
        return {
            commands: paginatedCommands.map(cmd => ({
                name: cmd.name,
                aliases: cmd.aliases,
                category: cmd.category,
                description: cmd.description,
                usage: cmd.usage
            })),
            categories: categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                description: cat.description,
                commandCount: cat.commands.length
            })),
            pagination
        };
    }

    private async getHclConfigReference(
        config?: string,
        category?: HCLBlockCategory,
        listBlocks?: boolean
    ): Promise<any> {
        // Check if HCLBlocksManager is available
        const hclCheck = this.checkManager(this.hclBlocksManager, 'HCLBlocksManager');
        if (hclCheck) return hclCheck;
        
        // List all blocks (optionally filtered by category)
        if (listBlocks) {
            const blocks = this.hclBlocksManager!.listBlocks(
                category
            );
            const categories = this.hclBlocksManager!.getCategories();
            
            return {
                blocks: blocks.map(block => ({
                    name: block.name,
                    displayName: block.displayName,
                    description: block.description,
                    category: block.category,
                    attributeCount: block.attributes.length,
                    exampleCount: block.examples.length,
                    docsUrl: block.docsUrl
                })),
                categories: categories.map(cat => ({
                    category: cat.category,
                    name: cat.name,
                    description: cat.description,
                    blockCount: cat.blockCount
                })),
                totalBlocks: blocks.length,
                message: category 
                    ? `Found ${blocks.length} HCL blocks in category '${category}'`
                    : `Found ${blocks.length} total HCL blocks across ${categories.length} categories`
            };
        }

        // Get specific block documentation
        if (config) {
            // First try structured block data (preferred)
            const block = this.hclBlocksManager!.getBlock(config);
            
            if (block) {
                // Return comprehensive structured documentation
                return this.formatBlockResponse(block);
            }

            // Try search if exact match not found
            const searchResults = this.hclBlocksManager!.searchBlocks(config);
            if (searchResults.length > 0) {
                // Return best match with suggestions
                const bestMatch = searchResults[0];
                const additionalProps: Record<string, unknown> = {
                    matchInfo: {
                        matchType: bestMatch.matchType,
                        score: bestMatch.score,
                        searchQuery: config
                    }
                };

                // Add suggestions if there are other close matches
                if (searchResults.length > 1) {
                    additionalProps.otherMatches = searchResults.slice(1, 4).map(r => ({
                        name: r.block.name,
                        displayName: r.block.displayName,
                        score: r.score,
                        matchType: r.matchType
                    }));
                }

                return this.formatBlockResponse(bestMatch.block, additionalProps);
            }

            // Fall back to scraped documentation as last resort
            const docs = await this.docsManager!.getHclConfigReference(config);
            if (docs.length > 0) {
                return {
                    config,
                    source: 'scraped-docs',
                    results: docs.map(doc => ({
                        title: doc.title,
                        url: doc.url,
                        content: doc.content.length > 800
                            ? doc.content.substring(0, 800) + '...'
                            : doc.content,
                        lastUpdated: doc.lastUpdated
                    })),
                    totalResults: docs.length,
                    note: 'Documentation from scraped sources. Use listBlocks=true to see all available structured HCL block definitions.'
                };
            }

            // No matches found
            return {
                config,
                error: `No HCL configuration documentation found for: ${config}`,
                suggestion: 'Use listBlocks=true to see all available HCL blocks, or try one of these common blocks: terraform, remote_state, locals, inputs, include, dependency, generate',
                availableBlocks: this.hclBlocksManager!.listBlocks().map(b => b.name)
            };
        }

        // No parameters - return summary with categories
        const categories = this.hclBlocksManager!.getCategories();
        return {
            message: 'Use config parameter to get documentation for a specific HCL block, or listBlocks=true to see all blocks',
            categories: categories.map(cat => ({
                category: cat.category,
                name: cat.name,
                description: cat.description,
                blockCount: cat.blockCount
            })),
            totalBlocks: this.hclBlocksManager!.getBlockCount(),
            exampleUsage: [
                { description: 'Get terraform block docs', params: { config: 'terraform' } },
                { description: 'List all blocks', params: { listBlocks: true } },
                { description: 'List core category', params: { listBlocks: true, category: 'core' } }
            ]
        };
    }

    /**
     * Format an HCL block into a comprehensive response object.
     * Centralizes the formatting logic to avoid code duplication between
     * exact match and search match response paths.
     */
    private formatBlockResponse(
        block: HCLBlock,
        additionalProps?: Record<string, unknown>
    ): Record<string, unknown> {
        const response: Record<string, unknown> = {
            config: block.name,
            displayName: block.displayName,
            description: block.description,
            category: block.category,
            syntax: block.syntax,
            attributes: block.attributes.map(attr => ({
                name: attr.name,
                type: attr.type,
                required: attr.required,
                description: attr.description,
                defaultValue: attr.defaultValue,
                example: attr.example,
                validValues: attr.validValues,
                nestedAttributes: attr.nestedAttributes?.map(nested => ({
                    name: nested.name,
                    type: nested.type,
                    required: nested.required,
                    description: nested.description,
                    defaultValue: nested.defaultValue,
                    example: nested.example,
                    validValues: nested.validValues
                }))
            })),
            examples: block.examples.map(ex => ({
                description: ex.description,
                code: ex.code
            })),
            relatedBlocks: block.relatedBlocks,
            docsUrl: block.docsUrl,
            markdown: this.hclBlocksManager!.formatBlockAsMarkdown(block)
        };

        // Merge any additional properties (e.g., matchInfo, otherMatches)
        if (additionalProps) {
            Object.assign(response, additionalProps);
        }

        return response;
    }

    /**
     * Truncates a code snippet to a maximum length with a helpful link to full documentation
     * @param code The code snippet to potentially truncate
     * @param maxLength Maximum length in characters (default: 1000)
     * @param docUrl URL to full documentation for truncation message
     * @returns Original code if under limit, or truncated code with link
     */
    private truncateCodeSnippet(code: string, maxLength: number, docUrl: string): string {
        if (!code || code.length <= maxLength) {
            return code;
        }
        // Truncate at the last complete line before maxLength for cleaner output
        const lastNewline = code.lastIndexOf('\n', maxLength);
        const truncationPoint = lastNewline > 0 ? lastNewline : maxLength;
        
        // Handle missing or empty docUrl gracefully
        const urlMessage = docUrl && docUrl.trim() !== '' 
            ? `See full example at ${docUrl}`
            : 'See full example in documentation';
        
        return code.substring(0, truncationPoint) + '\n\n# ... [Truncated. ' + urlMessage + ']';
    }

    private async getCodeExamples(
        query?: string,
        mode: 'summary' | 'full' = 'summary',
        limit: number = 5,
        advanced: boolean = false,
        category?: AdvancedExampleCategory,
        listCategories: boolean = false
    ): Promise<any> {
        // List advanced example categories
        if (listCategories) {
            const categories = this.advancedExamplesManager!.getCategories();
            return {
                categories: categories.map(cat => ({
                    category: cat.category,
                    name: cat.name,
                    description: cat.description,
                    exampleCount: cat.exampleCount
                })),
                totalExamples: this.advancedExamplesManager!.getExampleCount(),
                message: 'Use advanced=true with query or category to get curated examples'
            };
        }

        // Advanced examples mode
        if (advanced) {
            return this.getAdvancedCodeExamples(query, mode, limit, category);
        }

        // Original doc-scraped examples mode (requires query)
        if (!query) {
            return {
                error: 'query parameter is required for examples mode when advanced=false',
                suggestion: 'Use advanced=true to browse curated examples, or provide a query to search documentation'
            };
        }

        const results = await this.docsManager!.getCodeExamples(query);

        if (results.length === 0) {
            // Suggest advanced examples as alternative
            const advancedResults = this.advancedExamplesManager!.searchExamples(query);
            if (advancedResults.length > 0) {
                return {
                    query,
                    error: `No code examples found in documentation for: ${query}`,
                    suggestion: `Try advanced=true to see ${advancedResults.length} curated example(s) matching this query`,
                    advancedMatches: advancedResults.slice(0, 3).map(r => ({
                        id: r.example.id,
                        name: r.example.name,
                        category: r.example.category
                    }))
                };
            }
            return {
                query,
                error: `No code examples found for: ${query}`,
                suggestion: 'Try a broader search term, use search_docs, or try advanced=true for curated examples'
            };
        }

        // Summary mode: just titles, URLs, and counts
        if (mode === 'summary') {
            return {
                query,
                source: 'documentation',
                documentCount: results.length,
                documents: results.slice(0, limit).map(result => ({
                    title: result.doc.title,
                    url: result.doc.url,
                    section: result.doc.section,
                    snippetCount: result.examples.length
                })),
                hasMore: results.length > limit
            };
        }

        // Full mode: complete code examples (original behavior)
        return {
            query,
            source: 'documentation',
            examples: results.slice(0, limit).map(result => ({
                documentTitle: result.doc.title,
                documentUrl: result.doc.url,
                section: result.doc.section,
                codeSnippets: result.examples.map(ex => 
                    this.truncateCodeSnippet(ex, 1000, result.doc.url)
                ),
                snippetCount: result.examples.length,
                truncated: result.examples.some(ex => ex.length > 1000)
            })),
            totalDocuments: results.length,
            hasMore: results.length > limit
        };
    }

    private getAdvancedCodeExamples(
        topic?: string,
        mode: 'summary' | 'full' = 'summary',
        limit: number = 5,
        category?: AdvancedExampleCategory
    ): any {
        // List examples by category
        if (category && !topic) {
            const examples = this.advancedExamplesManager!.listExamples(category);
            
            // Summary mode for category listing
            if (mode === 'summary') {
                return {
                    category,
                    source: 'advanced-examples',
                    exampleCount: examples.length,
                    examples: examples.slice(0, limit).map(ex => ({
                        id: ex.id,
                        name: ex.name,
                        shortDescription: getFirstSentence(ex.description),
                        complexity: ex.complexity,
                        tags: ex.tags
                    })),
                    hasMore: examples.length > limit
                };
            }
            
            // Full mode for category listing
            return {
                category,
                source: 'advanced-examples',
                examples: examples.slice(0, limit).map(ex => ({
                    id: ex.id,
                    name: ex.name,
                    description: ex.description,
                    complexity: ex.complexity,
                    tags: ex.tags,
                    useCaseCount: ex.useCases.length,
                    bestPracticeCount: ex.bestPractices.length
                })),
                totalExamples: examples.length,
                hasMore: examples.length > limit,
                message: `Found ${examples.length} advanced example(s) in category '${category}'`
            };
        }

        // Search by topic
        if (topic) {
            const searchResults = this.advancedExamplesManager!.searchExamples(topic);
            
            // Filter by category if provided
            const filteredResults = category
                ? searchResults.filter(r => r.example.category === category)
                : searchResults;

            if (filteredResults.length === 0) {
                const categories = this.advancedExamplesManager!.getCategories();
                return {
                    topic,
                    category,
                    source: 'advanced-examples',
                    error: `No advanced examples found for: ${topic}`,
                    suggestion: 'Try a different search term or browse by category',
                    availableCategories: categories.map(c => c.category)
                };
            }

            const bestMatch = filteredResults[0].example;
            
            // Summary mode: minimal details without code
            if (mode === 'summary') {
                return {
                    topic,
                    source: 'advanced-examples',
                    matchCount: filteredResults.length,
                    bestMatch: {
                        id: bestMatch.id,
                        name: bestMatch.name,
                        shortDescription: getFirstSentence(bestMatch.description),
                        category: bestMatch.category,
                        complexity: bestMatch.complexity,
                        tags: bestMatch.tags,
                        docsUrl: bestMatch.docsUrl
                    },
                    otherMatches: filteredResults.slice(1, limit).map(r => ({
                        id: r.example.id,
                        name: r.example.name,
                        category: r.example.category
                    }))
                };
            }

            // Full mode: complete details with code (original behavior)
            return {
                topic,
                source: 'advanced-examples',
                matchInfo: {
                    matchType: filteredResults[0].matchType,
                    score: filteredResults[0].score
                },
                example: {
                    id: bestMatch.id,
                    name: bestMatch.name,
                    description: bestMatch.description,
                    category: bestMatch.category,
                    complexity: bestMatch.complexity,
                    code: this.truncateCodeSnippet(
                        bestMatch.code,
                        1000,
                        bestMatch.docsUrl || ''
                    ),
                    codeTruncated: bestMatch.code.length > 1000,
                    useCases: bestMatch.useCases,
                    bestPractices: bestMatch.bestPractices,
                    pitfalls: bestMatch.pitfalls,
                    relatedExamples: bestMatch.relatedExamples,
                    tags: bestMatch.tags,
                    docsUrl: bestMatch.docsUrl,
                    markdown: this.advancedExamplesManager!.formatExampleAsMarkdown(bestMatch)
                },
                otherMatches: filteredResults.slice(1, limit).map(r => ({
                    id: r.example.id,
                    name: r.example.name,
                    category: r.example.category,
                    matchType: r.matchType,
                    score: r.score
                })),
                totalMatches: filteredResults.length
            };
        }

        // No topic or category - return overview
        const categories = this.advancedExamplesManager!.getCategories();
        return {
            source: 'advanced-examples',
            message: 'Provide a topic to search, or a category to browse advanced examples',
            categories: categories.map(cat => ({
                category: cat.category,
                name: cat.name,
                description: cat.description,
                exampleCount: cat.exampleCount
            })),
            totalExamples: this.advancedExamplesManager!.getExampleCount(),
            exampleUsage: [
                { description: 'Search by topic', params: { advanced: true, topic: 'before_hook' } },
                { description: 'Browse by category', params: { advanced: true, category: 'hooks' } },
                { description: 'Get specific example', params: { advanced: true, topic: 'hook-error-handling' } }
            ]
        };
    }

    private async analyzeBestPractices(
        topic: string,
        mode: 'summary' | 'full' = 'summary',
        level?: 'beginner' | 'intermediate' | 'advanced'
    ): Promise<any> {
        try {
            const includeExamples = mode === 'full';
            const result = await this.bestPracticesAnalyzer!.analyzeTopic(topic, level, includeExamples);
            
            // Handle unknown topics with intelligent suggestions
            if (result.recommendations.length === 0) {
                // Use fuzzy-matched suggestions if available (from issue #33)
                const suggestion = result.suggestedTopics && result.suggestedTopics.length > 0
                    ? `Did you mean: ${result.suggestedTopics.join(', ')}?`
                    : 'Try one of the supported topics: module_organization, state_management, dependencies, ci_cd, security, performance, testing';

                return {
                    query: topic,
                    error: `No best practices found for topic: ${topic}`,
                    suggestion,
                    recommendations: [],
                    summary: result.summary || '',
                    confidence: result.confidence || 0,
                    ...(result.suggestedTopics && { suggestedTopics: result.suggestedTopics })
                };
            }

            // Summary mode: lean response with short descriptions
            if (mode === 'summary') {
                return {
                    query: result.query,
                    practiceCount: result.recommendations.length,
                    practices: result.recommendations.map(rec => ({
                        practice: rec.practice,
                        shortRationale: getFirstSentence(rec.rationale)
                    })),
                    summary: result.summary,
                    confidence: result.confidence,
                    ...(result.suggestedTopics && { suggestedTopics: result.suggestedTopics })
                };
            }

            // Full mode: complete result including all details (original behavior)
            return {
                query: result.query,
                recommendations: result.recommendations,
                summary: result.summary,
                commonPitfalls: result.commonPitfalls,
                experienceNotes: result.experienceNotes,
                realWorldExamples: result.realWorldExamples,
                confidence: result.confidence,
                ...(result.suggestedTopics && { suggestedTopics: result.suggestedTopics })
            };
        } catch (error) {
            console.error(`Error analyzing best practices for ${topic}:`, error);
            return {
                query: topic,
                error: error instanceof Error ? error.message : 'Failed to analyze best practices',
                recommendations: [],
                summary: '',
                confidence: 0
            };
        }
    }

    private async getTerragruntFunction(
        functionName: string,
        mode: 'summary' | 'full' = 'summary',
        includeExamples: boolean = true
    ): Promise<any> {
        // Ensure functions are loaded at least once per process
        if (!this.functionsLoaded) {
            await this.functionsManager!.loadFunctions();
            this.functionsLoaded = true;
        }

        const fn = this.functionsManager!.getFunction(functionName);
        if (!fn) {
            const suggestions = this.getSimilarFunctionNames(functionName);
            const suggestionText = suggestions.length > 0
                ? `Did you mean: ${suggestions.join(', ')}?`
                : 'Try function_reference without function_name parameter to see all available functions';

            return {
                name: functionName,
                error: `No Terragrunt function found for: ${functionName}`,
                suggestion: suggestionText
            };
        }

        // Summary mode: lean response with metadata
        if (mode === 'summary') {
            return {
                name: fn.name,
                signature: fn.signature,
                shortDescription: getFirstSentence(fn.description),
                category: fn.category,
                parameterCount: fn.parameters.length,
                exampleCount: fn.examples.length,
                relatedFunctions: fn.relatedFunctions
            };
        }

        // Full mode: complete details (original behavior)
        return {
            name: fn.name,
            signature: fn.signature,
            description: fn.description,
            parameters: fn.parameters,
            returnType: fn.returnType,
            category: fn.category,
            examples: includeExamples ? fn.examples : [],
            relatedFunctions: fn.relatedFunctions,
            relatedDocs: [] // TODO: Extract from documentation in future enhancement
        };
    }

    /**
     * Finds similar function names using a multi-factor scoring algorithm.
     * Scoring combines several matching strategies:
     * - Exact substring matches (higher score)
     * - Common prefix matches
     * - Word splitting and partial word matches
     * - Penalizes mismatches and rewards close matches
     * Suggestions are sorted by score and the top 5 are returned.
     * This helps provide relevant alternatives when a function name is not found.
     */
    private getSimilarFunctionNames(functionName: string): string[] {
        const allFunctions = this.functionsManager!.listFunctions();
        const query = functionName.toLowerCase();
        const suggestions: Array<{ name: string; score: number }> = [];

        for (const fn of allFunctions) {
            const fnName = fn.name.toLowerCase();
            let score = 0;

            // Exact substring match
            if (fnName.includes(query)) {
                score += 10;
            }

            // Query is substring of function name
            // Removed redundant query.includes(fnName) check

            // Common prefix
            let prefixLen = 0;
            for (let i = 0; i < Math.min(query.length, fnName.length); i++) {
                if (query[i] === fnName[i]) {
                    prefixLen++;
                } else {
                    break;
                }
            }
            score += prefixLen * 2;

            // Similar words (split by underscore)
            const queryParts = query.split('_');
            const fnParts = fnName.split('_');
            const commonParts = queryParts.filter(p => fnParts.includes(p)).length;
            score += commonParts * 3;

            if (score > 0) {
                suggestions.push({ name: fn.name, score });
            }
        }

        // Sort by score (descending) and return top 5
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(s => s.name);
    }

    private async listTerragruntFunctions(
        category?: string,
        search?: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<any> {
        if (!this.functionsLoaded) {
            await this.functionsManager!.loadFunctions();
            this.functionsLoaded = true;
        }

        let functions;
        
        // Apply search or category filter
        if (search && search.trim()) {
            functions = this.functionsManager!.searchFunctions(search);
            // Further filter by category if provided
            if (category && category.trim()) {
                const catFilter = category.trim().toLowerCase();
                functions = functions.filter(f => (f.category || '').toLowerCase() === catFilter);
            }
        } else {
            functions = this.functionsManager!.listFunctions(category);
        }

        // Get all available categories (not filtered - shows all options for discovery)
        const categories = this.functionsManager!.getAvailableCategories();

        // Apply pagination
        const { results, pagination } = this.calculatePagination(
            functions,
            page,
            pageSize
        );

        return {
            functions: results.map(fn => ({
                name: fn.name,
                category: fn.category,
                shortDescription: this.getShortDescription(fn.description),
                signature: fn.signature
            })),
            categories: categories,  // All categories, not just from filtered results
            pagination
        };
    }

    /**
     * Generate a short description from a full description.
     * Takes the first sentence or first 100 characters.
     */
    private getShortDescription(description: string): string {
        if (!description) return '';
        
        // Take first sentence or first 100 chars
        // Match sentence ending with proper boundary (whitespace or end of string)
        const firstSentence = description.match(/^[^.!?]+[.!?](?=\s|$)/);
        if (firstSentence) {
            return firstSentence[0].trim();
        }
        
        return description.length > 100 
            ? description.substring(0, 100).trim() + '...'
            : description;
    }

    /**
     * Unified config builder - generates Terragrunt config with optional file writing.
     * Combines generate and write operations into single workflow.
     * 
     * Supports two modes (write-only is handled in executeTool):
     * 1. Generate-only: useCase + options (returns config, does not write)
     * 2. Generate + Write: useCase + options + write=true + path (generates and writes in one operation)
     * 
     * Note: Write-only mode (content + path) is handled directly in executeTool, not by this method.
     */
    private async buildConfig(
        useCase: string,
        backend: string | undefined,
        tier: 'essential' | 'advanced' | 'complete' | undefined,
        options: Record<string, string | number | boolean | undefined>,
        strictValidation: boolean = false,
        customTemplate?: BuildConfigArgs['custom_template'],
        write: boolean = false,
        path?: string,
        overwrite: boolean = false,
        createBackup: boolean = true,
        createParentDirs: boolean = true
    ): Promise<any> {
        // Check if ConfigGenerator is available
        const configCheck = this.checkManager(this.configGenerator, 'ConfigGenerator');
        if (configCheck) return configCheck;
        
        // Check if FileWriter is available when write is requested
        if (write) {
            const writerCheck = this.checkManager(this.fileWriter, 'FileWriter');
            if (writerCheck) return writerCheck;
        }
        
        try {
            // Generate the configuration with correct parameter order (useCase, backend, tier, options)
            const generateResult = await this.generateTerragruntConfig(
                useCase,
                backend,
                tier,
                options,
                strictValidation,
                customTemplate
            );

            // If generation failed, return the error
            if (!generateResult.success) {
                return generateResult;
            }

            // If write mode is disabled, return generation result only
            if (!write) {
                return generateResult;
            }

            // Write the generated config to disk
            const writeResult = await this.writeTerragruntConfig(
                generateResult.config,
                path!,
                overwrite,
                createBackup,
                createParentDirs
            );

            // Combine generation and write results with nested writeResult to avoid field collisions
            // Nesting prevents collisions between:
            // - generateResult.success vs writeResult.success
            // - generateResult.error vs writeResult.error  
            // - potential future fields like 'path', 'created', etc.
            return {
                ...generateResult,
                // Override success based on combined result
                success: generateResult.success && writeResult.success,
                writeResult: writeResult
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to build configuration'
            };
        }
    }

    private async generateTerragruntConfig(
        useCase: string,
        backend?: string,
        tier?: 'essential' | 'advanced' | 'complete',
        options: Record<string, string | number | boolean | undefined> = {},
        strictValidation: boolean = false,
        customTemplate?: any
    ): Promise<any> {
        try {
            // If custom template provided, validate it and use the normalized result
            let templateLibrary = this.templateLibrary;
            
            if (customTemplate) {
                const validator = new TemplateValidator();
                // Validate and normalize the template - this throws on validation error
                const validatedTemplate = validator.validate(customTemplate);
                
                // Create a new TemplatesManager with validated template (highest priority)
                const customTemplatesManager = new TemplatesManager([
                    new CustomTemplateLoader(validatedTemplate),
                    new FilesystemTemplateLoader(),
                    new BuiltinTemplateLoader()
                ]);
                templateLibrary = new ConfigTemplateLibrary(customTemplatesManager);
            }
            
            // Use the appropriate template library (custom or default)
            const generator = customTemplate 
                ? new TerragruntConfigGenerator(this.docsManager!, templateLibrary)
                : this.configGenerator!;

            const result = await generator.generateConfig({
                useCase: useCase as UseCase,
                backend,
                tier,
                options,
                strictValidation
            });

            return {
                success: true,
                config: result.config,
                explanation: result.explanation,
                relatedDocs: result.relatedDocs.map(doc => ({
                    title: doc.title,
                    url: doc.url,
                    section: doc.section
                })),
                nextSteps: result.nextSteps,
                additionalOptions: result.additionalOptions || [],
                validation: result.validation ? {
                    regex: {
                        syntaxValid: result.validation.regex.syntaxValid,
                        formatted: result.validation.regex.formatted,
                        errors: result.validation.regex.errors,
                        warnings: result.validation.regex.warnings
                    },
                    terragrunt: result.validation.terragrunt ? {
                        available: result.validation.terragrunt.available,
                        syntaxValid: result.validation.terragrunt.syntaxValid,
                        formatted: result.validation.terragrunt.formatted,
                        errors: result.validation.terragrunt.errors,
                        warnings: result.validation.terragrunt.warnings
                    } : undefined
                } : undefined,
                wasFormatted: result.wasFormatted,
                // Indicate tier and if custom template was used
                tier: tier || 'essential',
                usedCustomTemplate: !!customTemplate
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate configuration'
            };
        }
    }

    /**
     * Write a Terragrunt configuration to a file
     */
    private async writeTerragruntConfig(
        content: string,
        filePath: string,
        overwrite: boolean,
        createBackup: boolean,
        createParentDirs: boolean
    ): Promise<any> {
        // Check if FileWriter is available
        const writerCheck = this.checkManager(this.fileWriter, 'FileWriter');
        if (writerCheck) return writerCheck;
        
        try {
            const result = await this.fileWriter!.writeFile({
                content,
                filePath,
                overwrite,
                createBackup,
                createParentDirs
            });

            return result;
        } catch (error) {
            console.error('Error writing Terragrunt config:', error);
            return {
                success: false,
                path: filePath,
                bytesWritten: 0,
                created: false,
                backedUp: false,
                error: error instanceof Error ? error.message : 'Failed to write file',
                errorType: 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Diagnose a Terragrunt error and provide solutions
     */
    private async diagnoseTerragruntError(
        errorMessage: string,
        context?: {
            command?: string;
            version?: string;
            os?: string;
            filePath?: string;
            module?: string;
            backend?: string;
        },
        options?: {
            maxMatches?: number;
            minConfidence?: number;
            enableFuzzyMatching?: boolean;
            enrichWithDocs?: boolean;
            includeDestructiveCommands?: boolean;
        }
    ): Promise<any> {
        // Check if ErrorPatternMatcher is available
        const errorCheck = this.checkManager(this.errorPatternMatcher, 'ErrorPatternMatcher');
        if (errorCheck) return errorCheck;
        
        try {
            const diagnosis = await this.errorPatternMatcher!.diagnoseError(
                errorMessage,
                context,
                {
                    maxMatches: options?.maxMatches,
                    minConfidence: options?.minConfidence,
                    enableFuzzyMatching: options?.enableFuzzyMatching,
                    enrichWithDocs: options?.enrichWithDocs,
                    enrichmentOptions: {
                        includeDestructiveCommands: options?.includeDestructiveCommands
                    }
                }
            );

            // Format the response based on whether enrichment was requested
            if (options?.enrichWithDocs && 'richSolutions' in diagnosis) {
                return {
                    success: true,
                    overallConfidence: diagnosis.overallConfidence,
                    matchCount: diagnosis.matches.length,
                    enrichmentSuccessful: diagnosis.enrichmentSuccessful,
                    enrichmentError: diagnosis.enrichmentError,
                    matches: diagnosis.matches.map(m => ({
                        patternId: m.pattern.id,
                        patternName: m.pattern.name,
                        category: m.pattern.category,
                        confidence: m.confidence,
                        description: m.pattern.description,
                        likelyCause: m.likelyCause,
                        solutions: m.solutions,
                        documentationRefs: m.documentationRefs
                    })),
                    richSolutions: diagnosis.richSolutions,
                    orderedDebuggingSteps: diagnosis.orderedDebuggingSteps,
                    documentationLinks: diagnosis.documentationLinks,
                    relatedErrorDetails: diagnosis.relatedErrorDetails,
                    generalAdvice: diagnosis.generalAdvice
                };
            }

            return {
                success: true,
                overallConfidence: diagnosis.overallConfidence,
                matchCount: diagnosis.matches.length,
                matches: diagnosis.matches.map(m => ({
                    patternId: m.pattern.id,
                    patternName: m.pattern.name,
                    category: m.pattern.category,
                    confidence: m.confidence,
                    description: m.pattern.description,
                    likelyCause: m.likelyCause,
                    solutions: m.solutions,
                    documentationRefs: m.documentationRefs
                })),
                debuggingSteps: diagnosis.debuggingSteps,
                relatedErrors: diagnosis.relatedErrors,
                generalAdvice: diagnosis.generalAdvice
            };
        } catch (error) {
            console.error('Error diagnosing Terragrunt error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to diagnose error'
            };
        }
    }

    /**
     * Unified guidance router - intelligently routes to best practices, comparisons, or patterns
     */
    private async getGuidance(
        query?: string,
        type?: 'best-practices' | 'comparison' | 'pattern',
        mode: 'summary' | 'full' = 'summary',
        level?: 'beginner' | 'intermediate' | 'advanced',
        listAll: boolean = false
    ): Promise<any> {
        // Check if BestPracticesAnalyzer is available
        const practicesCheck = this.checkManager(this.bestPracticesAnalyzer, 'BestPracticesAnalyzer');
        if (practicesCheck) return practicesCheck;
        
        // Check if BlockComparisonManager is available
        const comparisonCheck = this.checkManager(this.blockComparisonManager, 'BlockComparisonManager');
        if (comparisonCheck) return comparisonCheck;
        
        // List all available guidance
        if (listAll) {
            const bestPracticeTopics = [
                'project_structure', 'environment_config', 'module_organization',
                'state_management', 'dependencies', 'ci_cd', 'security',
                'performance', 'testing'
            ];
            const comparisons = this.blockComparisonManager!.getAvailableComparisons();
            const patterns = this.blockComparisonManager!.getAvailablePatterns();
            
            return {
                availableBestPracticeTopics: bestPracticeTopics,
                availableComparisons: comparisons,
                availablePatternTopics: patterns,
                usage: 'Use query parameter with optional type hint. Queries with "vs"/"versus" auto-route to comparisons. Known topics route to best practices. Other queries route to patterns.'
            };
        }

        // If query is missing/empty, show all available guidance (help/listing)
        if (!query || query.trim() === '') {
            const bestPracticeTopics = [
                'project_structure', 'environment_config', 'module_organization',
                'state_management', 'dependencies', 'ci_cd', 'security',
                'performance', 'testing'
            ];
            const comparisons = this.blockComparisonManager!.getAvailableComparisons();
            const patterns = this.blockComparisonManager!.getAvailablePatterns();
            
            return {
                availableBestPracticeTopics: bestPracticeTopics,
                availableComparisons: comparisons,
                availablePatternTopics: patterns,
                usage: 'Use query parameter with optional type hint. Queries with "vs"/"versus" auto-route to comparisons. Known topics route to best practices. Other queries route to patterns.'
            };
        }

        const normalizedQuery = query.toLowerCase().trim();

        // Explicit type hint takes precedence
        if (type === 'best-practices') {
            return await this.analyzeBestPractices(query, mode, level);
        }
        if (type === 'comparison') {
            return this.compareHclBlocks(query, undefined, false);
        }
        if (type === 'pattern') {
            return this.getPatternGuidance(query, false);
        }

        // Intelligent detection based on query content
        
        // 1. Check for comparison keywords
        const comparisonKeywords = [' vs ', ' versus ', ' compared to '];
        const hasComparisonKeyword = comparisonKeywords.some(kw => normalizedQuery.includes(kw));
        
        if (hasComparisonKeyword) {
            return this.compareHclBlocks(query, undefined, false);
        }

        // 2. Check for known best practice topics
        const bestPracticeTopics = [
            'project_structure', 'project structure',
            'environment_config', 'environment config',
            'module_organization', 'module organization',
            'state_management', 'state management',
            'dependencies', 'dependency',
            'ci_cd', 'ci/cd', 'ci cd',
            'security',
            'performance',
            'testing'
        ];
        
        const matchesBestPracticeTopic = bestPracticeTopics.some(topic => 
            normalizedQuery.includes(topic) || topic.includes(normalizedQuery)
        );
        
        if (matchesBestPracticeTopic) {
            return await this.analyzeBestPractices(query, mode, level);
        }

        // 3. Default to pattern guidance (most flexible matcher)
        return this.getPatternGuidance(query, false);
    }

    /**
     * Compare two HCL blocks and explain their differences
     */
    private compareHclBlocks(
        block1?: string,
        block2?: string,
        listComparisons: boolean = false
    ): any {
        // List all available comparisons
        if (listComparisons) {
            const comparisons = this.blockComparisonManager!.getAvailableComparisons();
            const patterns = this.blockComparisonManager!.getAvailablePatterns();
            return {
                availableComparisons: comparisons,
                availablePatternTopics: patterns,
                usage: 'Use block1 and block2 parameters to compare specific blocks, or use block1 with a query like "dependency vs dependencies"'
            };
        }

        // Need at least one block to compare
        if (!block1) {
            const comparisons = this.blockComparisonManager!.getAvailableComparisons();
            return {
                error: 'Please specify blocks to compare',
                availableComparisons: comparisons,
                examples: [
                    'block1: "dependency vs dependencies"',
                    'block1: "dependency", block2: "dependencies"',
                    'block1: "include vs multiple includes"'
                ]
            };
        }

        const result = this.blockComparisonManager!.compareBlocks(block1, block2);

        if (!result.found) {
            return {
                found: false,
                error: result.error,
                suggestions: result.suggestions,
                hint: 'Try using listComparisons: true to see all available comparisons'
            };
        }

        const comparison = result.comparison!;

        return {
            found: true,
            comparison: {
                id: comparison.id,
                blocks: comparison.blocks,
                summary: comparison.summary,
                block1: {
                    name: comparison.block1Details.name,
                    purpose: comparison.block1Details.purpose,
                    syntax: comparison.block1Details.syntax,
                    keyFeatures: comparison.block1Details.keyFeatures
                },
                block2: {
                    name: comparison.block2Details.name,
                    purpose: comparison.block2Details.purpose,
                    syntax: comparison.block2Details.syntax,
                    keyFeatures: comparison.block2Details.keyFeatures
                },
                keyDifferences: comparison.keyDifferences,
                whenToUse: comparison.whenToUse,
                commonMistakes: comparison.commonMistakes,
                relatedDocs: comparison.relatedDocs
            }
        };
    }

    /**
     * Get pattern guidance for a configuration scenario
     */
    private getPatternGuidance(
        scenario?: string,
        listPatterns: boolean = false
    ): any {
        // List all available patterns
        if (listPatterns) {
            const patterns = this.blockComparisonManager!.getAvailablePatterns();
            const comparisons = this.blockComparisonManager!.getAvailableComparisons();
            return {
                availablePatternTopics: patterns,
                relatedBlockComparisons: comparisons,
                usage: 'Use scenario parameter to get guidance for a specific topic (e.g., "managing dependencies", "configuration inheritance")'
            };
        }

        // Need a scenario to provide guidance
        if (!scenario) {
            const patterns = this.blockComparisonManager!.getAvailablePatterns();
            return {
                error: 'Please specify a scenario to get guidance for',
                availablePatternTopics: patterns,
                examples: [
                    'scenario: "managing dependencies"',
                    'scenario: "configuration inheritance"',
                    'scenario: "backend state"'
                ]
            };
        }

        const result = this.blockComparisonManager!.getPatternGuidance(scenario);

        if (!result.found) {
            return {
                found: false,
                error: result.error,
                suggestions: result.suggestions,
                hint: 'Try using listPatterns: true to see all available pattern topics'
            };
        }

        const guidance = result.guidance!;

        return {
            found: true,
            guidance: {
                id: guidance.id,
                scenario: guidance.scenario,
                question: guidance.question,
                decisionCriteria: guidance.decisionCriteria,
                patterns: guidance.patterns.map(p => ({
                    name: p.name,
                    description: p.description,
                    example: p.example,
                    pros: p.pros,
                    cons: p.cons
                })),
                relatedComparisons: guidance.relatedComparisons.map(id => {
                    const comp = this.blockComparisonManager!.getComparisonById(id);
                    return comp ? `${comp.blocks[0]} vs ${comp.blocks[1]}` : id;
                })
            }
        };
    }

    /**
     * Get server metrics for tools and resources
     */
    private getServerMetrics(
        filter?: string,
        format: string = 'json',
        reset: boolean = false
    ): MetricsResponse {
        const stats = this.metricsManager.getStats(filter);
        
        if (format === 'text') {
            const text = this.metricsManager.getSummaryText();
            if (reset) {
                this.metricsManager.reset();
            }
            return {
                format: 'text',
                summary: text,
                reset: reset
            };
        }
        
        // JSON format
        const result: MetricsResponse = {
            format: 'json',
            metrics: stats,
            totalCalls: this.metricsManager.getTotalCalls(),
            totalBytes: this.metricsManager.getTotalBytes(),
            operationCount: Object.keys(stats).length,
            filter: filter || 'none',
            timestamp: new Date().toISOString()
        };
        
        if (reset) {
            this.metricsManager.reset();
            result.reset = true;
        }
        
        return result;
    }
}
