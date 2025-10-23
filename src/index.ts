#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from './handlers/resources.js';
import { ToolHandler } from './handlers/tools.js';

class TerragruntMCPServer {
    private server: Server;
    private resourceHandler: ResourceHandler;
    private toolHandler: ToolHandler;

    constructor() {
        this.server = new Server(
            {
                name: 'terragrunt-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    resources: {},
                    tools: {},
                },
            }
        );

        this.resourceHandler = new ResourceHandler();
        this.toolHandler = new ToolHandler();

        this.setupHandlers();
    }

    private setupHandlers() {
        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            try {
                const resources = await this.resourceHandler.listResources();
                return { resources };
            } catch (error) {
                console.error('Error listing resources:', error);
                return { resources: [] };
            }
        });

        // Read a specific resource
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            try {
                const { uri } = request.params;
                const resource = await this.resourceHandler.getResource(uri);
                return {
                    contents: resource.contents,
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error reading resource:', errorMsg);
                return {
                    contents: [
                        {
                            type: 'text',
                            text: `Error: ${errorMsg}`,
                        },
                    ],
                };
            }
        });

        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            try {
                const tools = this.toolHandler.getAvailableTools();
                return { tools };
            } catch (error) {
                console.error('Error listing tools:', error);
                return { tools: [] };
            }
        });

        // Execute a tool
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                const result = await this.toolHandler.executeTool(name, args);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error executing tool:', errorMsg);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${errorMsg}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Terragrunt MCP Server running on stdio');
    }
}

// Start the server
const server = new TerragruntMCPServer();
server.run().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});