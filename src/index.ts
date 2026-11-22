#!/usr/bin/env node

/**
 * Terragrunt MCP Server
 * 
 * A Model Context Protocol server providing comprehensive Terragrunt documentation
 * and tooling integration for AI assistants. The reported version comes from
 * package.json (see src/version.ts).
 * 
 * Architecture: Tool-only (no resources or prompts)
 * Tools: 8 tools total (7 core tools + 1 observability tool), subsetted by server mode
 */

// Must stay the first import: redirects console stdout methods before any other module loads
import './stdio-guard.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolHandler } from './handlers/tools.js';
import { MetricsManager } from './terragrunt/metrics.js';
import { parseModeFromArgs, ServerMode } from './modes/config.js';
import { getServerVersion } from './version.js';

class TerragruntMCPServer {
    private server: Server;
    private toolHandler: ToolHandler;
    private metricsManager: MetricsManager;
    private mode: ServerMode;

    constructor() {
        // Parse server mode from CLI arguments (defaults to FULL for backward compatibility)
        this.mode = parseModeFromArgs(process.argv);
        
        // Update server name to indicate mode (useful for debugging/monitoring)
        const serverName = this.mode === ServerMode.FULL 
            ? 'terragrunt-mcp-server'
            : `terragrunt-mcp-server-${this.mode}`;
        
        this.server = new Server(
            {
                name: serverName,
                version: getServerVersion(),
            },
            {
                capabilities: {
                    tools: {},  // Tool-only architecture
                },
            }
        );

        // Create shared metrics manager and tool handler with mode
        this.metricsManager = new MetricsManager();
        this.toolHandler = new ToolHandler(this.metricsManager, this.mode);

        this.setupHandlers();
        
        // Log mode configuration on startup
        console.error(`[Server] Starting in ${this.mode} mode`);
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
                const { result, isError } = await this.toolHandler.callTool(name, args);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result),
                        },
                    ],
                    ...(isError ? { isError: true } : {}),
                };
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error executing tool:', errorMsg);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ error: errorMsg }),
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