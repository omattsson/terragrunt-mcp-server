import { ResourceHandler } from './resources.js';
import { TerragruntDocsManager } from '../terragrunt/docs.js';

export interface Tool {
    name: string;
    description: string;
    inputSchema: any;
}

export class ToolHandler {
    private resourceHandler: ResourceHandler;
    private docsManager: TerragruntDocsManager;

    constructor() {
        this.resourceHandler = new ResourceHandler();
        this.docsManager = new TerragruntDocsManager();
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
}