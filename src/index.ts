#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolHandler } from './handlers/tools.js';
import { MetricsManager } from './terragrunt/metrics.js';

class TerragruntMCPServer {
    private server: Server;
    private toolHandler: ToolHandler;
    private metricsManager: MetricsManager;

    constructor() {
        this.server = new Server(
            {
                name: 'terragrunt-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Create shared metrics manager
        this.metricsManager = new MetricsManager();
        this.toolHandler = new ToolHandler(this.metricsManager);

        this.setupHandlers();
    }

    private setupHandlers() {
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