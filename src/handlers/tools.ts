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
            }
        ];
    }

    async executeTool(name: string, args: any): Promise<any> {
        try {
            switch (name) {
                case 'search_terragrunt_docs':
                    return this.searchTerragruntDocs(args.query, args.limit || 5);
                case 'get_terragrunt_sections':
                    return this.getTerragruntSections();
                case 'get_section_docs':
                    return this.getSectionDocs(args.section);
                default:
                    throw new Error(`Unknown tool: ${name}`);
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
}