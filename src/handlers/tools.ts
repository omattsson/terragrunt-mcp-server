import { ResourceHandler } from './resources.js';
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

export interface Tool {
    name: string;
    description: string;
    inputSchema: any;
}

export class ToolHandler {
    private resourceHandler: ResourceHandler;
    private docsManager: TerragruntDocsManager;
    private functionsManager: TerragruntFunctionsManager;
    private bestPracticesAnalyzer: BestPracticesAnalyzer;
    private functionsLoaded: boolean = false;
    private templatesManager: TemplatesManager;
    private templateLibrary: ConfigTemplateLibrary;
    private configGenerator: TerragruntConfigGenerator;
    private fileWriter: FileWriter;

    constructor() {
        this.resourceHandler = new ResourceHandler();
        this.docsManager = new TerragruntDocsManager();
        this.functionsManager = new TerragruntFunctionsManager(this.docsManager);
        this.bestPracticesAnalyzer = new BestPracticesAnalyzer(this.docsManager);
        
        // Initialize templates manager with builtin and filesystem loaders
        this.templatesManager = new TemplatesManager([
            new BuiltinTemplateLoader(),
            new FilesystemTemplateLoader()  // Defaults to ~/.terragrunt-mcp/templates/
        ]);
        
        this.templateLibrary = new ConfigTemplateLibrary(this.templatesManager);
        this.configGenerator = new TerragruntConfigGenerator(this.docsManager, this.templateLibrary);
        
        // Initialize file writer (can be configured via environment or config file)
        this.fileWriter = new FileWriter({
            enabled: process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED !== 'false',
            allowedDirectories: this.parseAllowedDirectories(),
            autoBackup: process.env.TERRAGRUNT_MCP_AUTO_BACKUP !== 'false',
            maxFileSize: parseInt(process.env.TERRAGRUNT_MCP_MAX_FILE_SIZE || '1048576', 10) || 1048576
        });
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

    getAvailableTools(): Tool[] {
        return [
            {
                name: 'search_terragrunt_docs',
                description: 'Search Terragrunt documentation for specific topics, commands, concepts, or configuration options',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query for Terragrunt documentation (e.g., "dependencies", "remote state", "generate block")'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 5,
                            minimum: 1,
                            maximum: 20
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'get_terragrunt_function',
                description: 'Get detailed documentation for a specific Terragrunt built-in function',
                inputSchema: {
                    type: 'object',
                    properties: {
                        function_name: {
                            type: 'string',
                            description: 'The Terragrunt function name (e.g., "get_env", "find_in_parent_folders")'
                        },
                        include_examples: {
                            type: 'boolean',
                            description: 'Include code examples in the response (default: true)',
                            default: true
                        }
                    },
                    required: ['function_name']
                }
            },
            {
                name: 'list_terragrunt_functions',
                description: 'List Terragrunt built-in functions with optional filtering by category or search query',
                inputSchema: {
                    type: 'object',
                    properties: {
                        category: {
                            type: 'string',
                            description: 'Optional category filter (e.g., "filesystem", "env", "path")'
                        },
                        search: {
                            type: 'string',
                            description: 'Optional search query to filter functions by name or description'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 50,
                            minimum: 1,
                            maximum: 200
                        }
                    },
                    required: []
                }
            },
            {
                name: 'get_terragrunt_sections',
                description: 'Get all available documentation sections in Terragrunt docs',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'get_section_docs',
                description: 'Get all documentation for a specific Terragrunt section',
                inputSchema: {
                    type: 'object',
                    properties: {
                        section: {
                            type: 'string',
                            description: 'The section name (e.g., "getting-started", "reference", "features")'
                        }
                    },
                    required: ['section']
                }
            },
            {
                name: 'get_cli_command_help',
                description: 'Get detailed help documentation for a specific Terragrunt CLI command',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The Terragrunt CLI command name (e.g., "plan", "apply", "run-all", "hclfmt")'
                        }
                    },
                    required: ['command']
                }
            },
            {
                name: 'get_hcl_config_reference',
                description: 'Get documentation for HCL configuration blocks, attributes, or functions used in terragrunt.hcl',
                inputSchema: {
                    type: 'object',
                    properties: {
                        config: {
                            type: 'string',
                            description: 'HCL block, attribute, or function name (e.g., "terraform", "remote_state", "dependency", "inputs")'
                        }
                    },
                    required: ['config']
                }
            },
            {
                name: 'get_code_examples',
                description: 'Find code examples and snippets related to a specific Terragrunt topic or pattern',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'Topic or pattern to find examples for (e.g., "remote state", "dependencies", "before hooks")'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of documents with examples to return',
                            default: 5,
                            minimum: 1,
                            maximum: 10
                        }
                    },
                    required: ['topic']
                }
            },
            {
                name: 'analyze_best_practices',
                description: 'Analyze best practices for a specific Terragrunt topic, including recommendations, antipatterns, and experience-level filtering',
                inputSchema: {
                    type: 'object',
                    properties: {
                        topic: {
                            type: 'string',
                            description: 'Topic to analyze. Supported topics: module_organization, state_management, dependencies, ci_cd, security, performance, testing',
                            enum: ['module_organization', 'state_management', 'dependencies', 'ci_cd', 'security', 'performance', 'testing']
                        },
                        level: {
                            type: 'string',
                            description: 'Optional experience level filter (beginner, intermediate, advanced)',
                            enum: ['beginner', 'intermediate', 'advanced']
                        }
                    },
                    required: ['topic']
                }
            },
            {
                name: 'generate_terragrunt_config',
                description: 'Generate a complete Terragrunt configuration from templates with variable substitution, explanations, and documentation. Includes HCL syntax validation. Supports custom user-provided templates.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        useCase: {
                            type: 'string',
                            enum: ['remote_state', 'provider_generation', 'dependencies', 'hooks', 'inputs'],
                            description: 'The use case to generate configuration for (remote_state, provider_generation, dependencies, hooks, inputs)'
                        },
                        backend: {
                            type: 'string',
                            description: 'Optional backend type for remote_state (e.g., "s3", "azurerm", "gcs", "azure")'
                        },
                        options: {
                            type: 'object',
                            description: 'Configuration variables for the template (e.g., bucket, region, account_id). Required variables depend on the selected template.',
                            additionalProperties: true
                        },
                        strictValidation: {
                            type: 'boolean',
                            description: 'If true, throw an error if HCL validation fails. If false (default), return the config with validation warnings.',
                            default: false
                        },
                        custom_template: {
                            type: 'object',
                            description: 'Optional custom template to use instead of built-in templates. Must include: id, name, description, category, templateHcl. See documentation for full schema.',
                            properties: {
                                id: { type: 'string', description: 'Unique template identifier' },
                                name: { type: 'string', description: 'Human-readable template name' },
                                description: { type: 'string', description: 'Template description' },
                                category: { 
                                    type: 'string', 
                                    enum: ['backend', 'provider', 'dependency', 'hooks', 'inputs', 'advanced', 'configuration'],
                                    description: 'Template category'
                                },
                                cloudProvider: { 
                                    type: 'string',
                                    enum: ['aws', 'azure', 'gcp', 'multi'],
                                    description: 'Optional cloud provider'
                                },
                                templateHcl: { type: 'string', description: 'HCL template content with ${var.name} placeholders' },
                                variables: {
                                    type: 'array',
                                    description: 'Template variables',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            type: { type: 'string' },
                                            description: { type: 'string' },
                                            required: { type: 'boolean' },
                                            defaultValue: {},
                                            example: { type: 'string' }
                                        },
                                        required: ['name', 'type', 'required']
                                    }
                                },
                                tags: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Search tags'
                                },
                                example: { type: 'string', description: 'Usage example' }
                            },
                            required: ['id', 'name', 'description', 'category', 'templateHcl']
                        }
                    },
                    required: ['useCase', 'options']
                }
            },
            {
                name: 'write_terragrunt_config',
                description: 'Write a Terragrunt configuration to a file with security validation and backup support',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The HCL configuration content to write to the file'
                        },
                        path: {
                            type: 'string',
                            description: 'Path where the file should be written (relative or absolute). Must be within allowed directories.'
                        },
                        filePath: {
                            type: 'string',
                            description: 'Alternative to path parameter. Path where the file should be written.'
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Allow overwriting existing files (default: false)',
                            default: false
                        },
                        createBackup: {
                            type: 'boolean',
                            description: 'Create backup before overwriting existing files (default: true)',
                            default: true
                        },
                        createParentDirs: {
                            type: 'boolean',
                            description: 'Create parent directories if they don\'t exist (default: true)',
                            default: true
                        }
                    },
                    required: ['content'],
                    oneOf: [
                        { required: ['path'] },
                        { required: ['filePath'] }
                    ]
                }
            }
        ];
    }

    async executeTool(name: string, args?: any): Promise<any> {
        try {
            switch (name) {
                case 'search_terragrunt_docs':
                    if (!args?.query) {
                        return { error: 'query parameter is required' };
                    }
                    return await this.searchTerragruntDocs(args.query, args?.limit);

                case 'get_terragrunt_sections':
                    return await this.getTerragruntSections();

                case 'get_section_docs':
                    if (!args?.section) {
                        return { error: 'section parameter is required' };
                    }
                    return await this.getSectionDocs(args.section);

                case 'get_cli_command_help':
                    if (!args?.command) {
                        return { error: 'command parameter is required' };
                    }
                    return await this.getCliCommandHelp(args.command);
                case 'get_terragrunt_function':
                    if (!args?.function_name) {
                        return { error: 'function_name parameter is required' };
                    }
                    return await this.getTerragruntFunction(
                        args.function_name,
                        args?.include_examples ?? true
                    );
                case 'list_terragrunt_functions':
                    return await this.listTerragruntFunctions(
                        args?.category,
                        args?.search,
                        args?.limit
                    );

                case 'get_hcl_config_reference':
                    if (!args?.config) {
                        return { error: 'config parameter is required' };
                    }
                    return await this.getHclConfigReference(args.config);
                case 'get_code_examples':
                    if (!args?.topic) {
                        return { error: 'topic parameter is required' };
                    }
                    return await this.getCodeExamples(args.topic, args?.limit);

                case 'analyze_best_practices':
                    if (!args?.topic) {
                        return { error: 'topic parameter is required' };
                    }
                    return await this.analyzeBestPractices(args.topic, args?.level);

                case 'generate_terragrunt_config':
                    if (!args?.useCase) {
                        return { error: 'useCase parameter is required' };
                    }
                    if (!args?.options) {
                        return { error: 'options parameter is required' };
                    }
                    return await this.generateTerragruntConfig(
                        args.useCase,
                        args.backend || undefined,
                        args.options,
                        args.strictValidation ?? false,
                        args.custom_template
                    );

                case 'write_terragrunt_config':
                    if (!args?.content) {
                        return {
                            success: false,
                            path: '',
                            bytesWritten: 0,
                            created: false,
                            backedUp: false,
                            error: 'content parameter is required',
                            errorType: 'VALIDATION_ERROR'
                        };
                    }
                    // Accept both 'path' and 'filePath' for compatibility
                    const targetPath = args?.path || args?.filePath;
                    if (!targetPath) {
                        return {
                            success: false,
                            path: '',
                            bytesWritten: 0,
                            created: false,
                            backedUp: false,
                            error: 'path or filePath parameter is required',
                            errorType: 'VALIDATION_ERROR'
                        };
                    }
                    if (typeof targetPath !== 'string') {
                        return {
                            success: false,
                            path: String(targetPath),
                            bytesWritten: 0,
                            created: false,
                            backedUp: false,
                            error: 'path must be a string',
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

    private async searchTerragruntDocs(query: string, limit: number = 5): Promise<any> {
        const results = await this.resourceHandler.searchDocumentation(query);

        return {
            query,
            results: results.slice(0, limit).map(doc => ({
                title: doc.title,
                url: doc.url,
                section: doc.section,
                snippet: doc.content.length > 300
                    ? doc.content.substring(0, 300) + '...'
                    : doc.content,
                lastUpdated: doc.lastUpdated
            })),
            total: results.length,
            hasMore: results.length > limit
        };
    }

    private async getTerragruntSections(): Promise<any> {
        const sections = await this.docsManager.getAvailableSections();
        const docs = await this.docsManager.fetchLatestDocs();

        return {
            sections: sections.map(section => ({
                name: section,
                docCount: docs.filter(doc => doc.section === section).length
            })),
            totalSections: sections.length,
            totalDocs: docs.length
        };
    }

    private async getSectionDocs(section: string): Promise<any> {
        const docs = await this.docsManager.getDocBySection(section);

        if (docs.length === 0) {
            return {
                section,
                error: `No documentation found for section: ${section}`,
                availableSections: await this.docsManager.getAvailableSections()
            };
        }

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

    private async getCliCommandHelp(command: string): Promise<any> {
        const doc = await this.docsManager.getCliCommandHelp(command);

        if (!doc) {
            return {
                command,
                error: `No CLI command documentation found for: ${command}`,
                suggestion: 'Try searching with search_terragrunt_docs or use get_section_docs with section "reference" to see all available CLI commands'
            };
        }

        return {
            command,
            title: doc.title,
            url: doc.url,
            content: doc.content,
            lastUpdated: doc.lastUpdated
        };
    }

    private async getHclConfigReference(config: string): Promise<any> {
        const docs = await this.docsManager.getHclConfigReference(config);

        if (docs.length === 0) {
            return {
                config,
                error: `No HCL configuration documentation found for: ${config}`,
                suggestion: 'Try searching with search_terragrunt_docs or use get_section_docs with section "reference" to see all available HCL configurations'
            };
        }

        return {
            config,
            results: docs.map(doc => ({
                title: doc.title,
                url: doc.url,
                content: doc.content.length > 800
                    ? doc.content.substring(0, 800) + '...'
                    : doc.content,
                lastUpdated: doc.lastUpdated
            })),
            totalResults: docs.length
        };
    }

    private async getCodeExamples(topic: string, limit: number = 5): Promise<any> {
        const results = await this.docsManager.getCodeExamples(topic);

        if (results.length === 0) {
            return {
                topic,
                error: `No code examples found for: ${topic}`,
                suggestion: 'Try a broader search term or use search_terragrunt_docs to find relevant documentation'
            };
        }

        return {
            topic,
            examples: results.slice(0, limit).map(result => ({
                documentTitle: result.doc.title,
                documentUrl: result.doc.url,
                section: result.doc.section,
                codeSnippets: result.examples,
                snippetCount: result.examples.length
            })),
            totalDocuments: results.length,
            hasMore: results.length > limit
        };
    }

    private async analyzeBestPractices(
        topic: string,
        level?: 'beginner' | 'intermediate' | 'advanced'
    ): Promise<any> {
        try {
            const result = await this.bestPracticesAnalyzer.analyzeTopic(topic, level);
            
            if (result.recommendations.length === 0) {
                return {
                    topic,
                    error: `No best practices found for topic: ${topic}`,
                    suggestion: 'Try one of the supported topics: module_organization, state_management, dependencies, ci_cd, security, performance, testing'
                };
            }

            return result;
        } catch (error) {
            console.error(`Error analyzing best practices for ${topic}:`, error);
            return {
                topic,
                error: error instanceof Error ? error.message : 'Failed to analyze best practices',
                recommendations: [],
                summary: '',
                commonPitfalls: [],
                experienceNotes: { beginner: [], intermediate: [], advanced: [] },
                realWorldExamples: []
            };
        }
    }

    private async getTerragruntFunction(functionName: string, includeExamples: boolean = true): Promise<any> {
        // Ensure functions are loaded at least once per process
        if (!this.functionsLoaded) {
            await this.functionsManager.loadFunctions();
            this.functionsLoaded = true;
        }

        const fn = this.functionsManager.getFunction(functionName);
        if (!fn) {
            const suggestions = this.getSimilarFunctionNames(functionName);
            const suggestionText = suggestions.length > 0
                ? `Did you mean: ${suggestions.join(', ')}?`
                : 'Try list_terragrunt_functions to see all available functions';

            return {
                name: functionName,
                error: `No Terragrunt function found for: ${functionName}`,
                suggestion: suggestionText
            };
        }

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
        const allFunctions = this.functionsManager.listFunctions();
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

    private async listTerragruntFunctions(category?: string, search?: string, limit: number = 50): Promise<any> {
        if (!this.functionsLoaded) {
            await this.functionsManager.loadFunctions();
            this.functionsLoaded = true;
        }

        let functions;
        
        // Apply search or category filter
        if (search && search.trim()) {
            functions = this.functionsManager.searchFunctions(search);
            // Further filter by category if provided
            if (category && category.trim()) {
                const catFilter = category.trim().toLowerCase();
                functions = functions.filter(f => (f.category || '').toLowerCase() === catFilter);
            }
        } else {
            functions = this.functionsManager.listFunctions(category);
        }

        // Get all available categories (not filtered - shows all options for discovery)
        const categories = this.functionsManager.getAvailableCategories();

        return {
            functions: functions.slice(0, limit).map(fn => ({
                name: fn.name,
                category: fn.category,
                shortDescription: this.getShortDescription(fn.description),
                signature: fn.signature
            })),
            categories: categories,  // All categories, not just from filtered results
            totalCount: functions.length  // Count of filtered results before limit
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
     * Generate a complete Terragrunt configuration from templates
     */
    private async generateTerragruntConfig(
        useCase: string,
        backend?: string,
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
                ? new TerragruntConfigGenerator(this.docsManager, templateLibrary)
                : this.configGenerator;

            const result = await generator.generateConfig({
                useCase: useCase as UseCase,
                backend,
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
                    syntaxValid: result.validation.syntaxValid,
                    formatted: result.validation.formatted,
                    errors: result.validation.errors,
                    warnings: result.validation.warnings
                } : undefined,
                // Indicate if custom template was used
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
        try {
            const result = await this.fileWriter.writeFile({
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
}