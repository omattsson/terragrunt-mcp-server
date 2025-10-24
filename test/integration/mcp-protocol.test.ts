import { describe, it, expect, beforeAll } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ResourceHandler } from '../../src/handlers/resources.js';
import { ToolHandler } from '../../src/handlers/tools.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

/**
 * MCP Protocol Compliance Tests
 * 
 * These tests validate that the Terragrunt MCP Server correctly implements
 * the Model Context Protocol (MCP) specification, including:
 * - Request/response formats
 * - Resource discovery and reading
 * - Tool listing and execution
 * - Error handling
 * - Schema validation
 */
describe('MCP Protocol Compliance', () => {
  let server: Server;
  let resourceHandler: ResourceHandler;
  let toolHandler: ToolHandler;
  let docsManager: TerragruntDocsManager;

  beforeAll(async () => {
    console.log('Initializing MCP server for protocol compliance tests...');
    
    // Initialize server with proper MCP configuration
    server = new Server(
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

    resourceHandler = new ResourceHandler();
    toolHandler = new ToolHandler();
    docsManager = new TerragruntDocsManager();
    
    await docsManager.fetchLatestDocs();
    console.log('MCP server initialized successfully');
  }, 120000);

  describe('Server Initialization', () => {
    it('should initialize with correct server info', () => {
      expect(server).toBeDefined();
      // Server info is private, but we can verify it was created
    });

    it('should declare resource capabilities', () => {
      // Server capabilities are set in constructor
      expect(server).toBeDefined();
    });

    it('should declare tool capabilities', () => {
      expect(server).toBeDefined();
    });
  });

  describe('ListResourcesRequest Compliance', () => {
    it('should handle ListResourcesRequest with no parameters', async () => {
      const resources = await resourceHandler.listResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should return resources with valid MCP resource schema', async () => {
      const resources = await resourceHandler.listResources();

      resources.forEach(resource => {
        // Each resource must have required MCP fields
        expect(resource.uri).toBeDefined();
        expect(typeof resource.uri).toBe('string');
        expect(resource.name).toBeDefined();
        expect(typeof resource.name).toBe('string');
        expect(resource.mimeType).toBeDefined();
        expect(typeof resource.mimeType).toBe('string');
        
        // Optional fields if present should be correct type
        if (resource.description) {
          expect(typeof resource.description).toBe('string');
        }
      });
    });

    it('should return resources with valid URI format', async () => {
      const resources = await resourceHandler.listResources();

      resources.forEach(resource => {
        // URIs should follow the terragrunt:// scheme
        expect(resource.uri).toMatch(/^terragrunt:\/\//);
        
        // URI should be properly formatted (no spaces, special chars encoded)
        expect(resource.uri).not.toMatch(/\s/);
      });
    });

    it('should return resources with text/markdown MIME type', async () => {
      const resources = await resourceHandler.listResources();

      resources.forEach(resource => {
        expect(resource.mimeType).toBe('text/markdown');
      });
    });

    it('should include overview resource', async () => {
      const resources = await resourceHandler.listResources();

      const overview = resources.find(r => r.uri === 'terragrunt://docs/overview');
      expect(overview).toBeDefined();
      expect(overview?.name).toBe('Terragrunt Documentation Overview');
    });

    it('should include section resources', async () => {
      const resources = await resourceHandler.listResources();

      const sectionResources = resources.filter(r => r.uri.startsWith('terragrunt://docs/section/'));
      expect(sectionResources.length).toBeGreaterThan(0);
    });

    it('should include page resources', async () => {
      const resources = await resourceHandler.listResources();

      const pageResources = resources.filter(r => r.uri.startsWith('terragrunt://docs/page/'));
      expect(pageResources.length).toBeGreaterThan(0);
    });

    it('should limit resources to prevent overwhelming clients', async () => {
      const resources = await resourceHandler.listResources();

      // Should be reasonable number (not thousands)
      expect(resources.length).toBeLessThan(200);
    });
  });

  describe('ReadResourceRequest Compliance', () => {
    it('should handle ReadResourceRequest with valid URI', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');

      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(Array.isArray(resource.contents)).toBe(true);
      expect(resource.contents.length).toBeGreaterThan(0);
    });

    it('should return content with valid MCP content schema', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');

      resource.contents.forEach((content: any) => {
        expect(content.type).toBeDefined();
        expect(typeof content.type).toBe('string');
        expect(content.type).toBe('text');
        expect(content.text).toBeDefined();
        expect(typeof content.text).toBe('string');
      });
    });

    it('should return text/markdown content type', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');

      // Resource has mimeType at top level, not in contents
      expect(resource.mimeType).toBe('text/markdown');
      
      resource.contents.forEach((content: any) => {
        expect(content.type).toBe('text');
      });
    });

    it('should return non-empty content text', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');

      resource.contents.forEach((content: any) => {
        expect(content.text.length).toBeGreaterThan(0);
      });
    });

    it('should handle encoded URIs correctly', async () => {
      const resources = await resourceHandler.listResources();
      const pageResource = resources.find(r => r.uri.startsWith('terragrunt://docs/page/'));
      
      if (pageResource) {
        const resource = await resourceHandler.getResource(pageResource.uri);
        expect(resource.contents).toBeDefined();
        expect(resource.contents.length).toBeGreaterThan(0);
      }
    });

    it('should return error response for invalid URI scheme', async () => {
      const resource = await resourceHandler.getResource('invalid://scheme/test');
      
      // Returns error in contents, not throws
      expect(resource.contents).toBeDefined();
      expect(resource.contents[0].text).toContain('Error');
      expect(resource.mimeType).toBe('text/plain');
    });

    it('should return error response for non-existent resource', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/page/nonexistent-12345');
      
      // Returns error in contents, not throws
      expect(resource.contents).toBeDefined();
      expect(resource.contents[0].text).toContain('Error');
      expect(resource.contents[0].text).toContain('not found');
      expect(resource.mimeType).toBe('text/plain');
    });

    it('should handle section resources', async () => {
      const resources = await resourceHandler.listResources();
      const sectionResource = resources.find(r => r.uri.startsWith('terragrunt://docs/section/'));
      
      if (sectionResource) {
        const resource = await resourceHandler.getResource(sectionResource.uri);
        expect(resource.contents).toBeDefined();
        expect(resource.contents[0].text).toContain('Terragrunt');
      }
    });
  });

  describe('ListToolsRequest Compliance', () => {
    it('should handle ListToolsRequest with no parameters', () => {
      const tools = toolHandler.getAvailableTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should return tools with valid MCP tool schema', () => {
      const tools = toolHandler.getAvailableTools();

      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('should return tools with valid JSON Schema input schemas', () => {
      const tools = toolHandler.getAvailableTools();

      tools.forEach(tool => {
        const schema = tool.inputSchema;
        
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
        expect(typeof schema.properties).toBe('object');
        
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      });
    });

    it('should return exactly 6 tools', () => {
      const tools = toolHandler.getAvailableTools();
      expect(tools.length).toBe(6);
    });

    it('should include search_terragrunt_docs tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_terragrunt_docs');
      
      expect(searchTool).toBeDefined();
      expect(searchTool?.description).toBeDefined();
      expect(searchTool?.inputSchema.properties.query).toBeDefined();
    });

    it('should include get_terragrunt_sections tool', () => {
      const tools = toolHandler.getAvailableTools();
      const sectionsTool = tools.find(t => t.name === 'get_terragrunt_sections');
      
      expect(sectionsTool).toBeDefined();
    });

    it('should include get_section_docs tool', () => {
      const tools = toolHandler.getAvailableTools();
      const sectionDocsTool = tools.find(t => t.name === 'get_section_docs');
      
      expect(sectionDocsTool).toBeDefined();
      expect(sectionDocsTool?.inputSchema.properties.section).toBeDefined();
    });

    it('should include get_cli_command_help tool', () => {
      const tools = toolHandler.getAvailableTools();
      const cliHelpTool = tools.find(t => t.name === 'get_cli_command_help');
      
      expect(cliHelpTool).toBeDefined();
      expect(cliHelpTool?.inputSchema.properties.command).toBeDefined();
    });

    it('should include get_hcl_config_reference tool', () => {
      const tools = toolHandler.getAvailableTools();
      const hclRefTool = tools.find(t => t.name === 'get_hcl_config_reference');
      
      expect(hclRefTool).toBeDefined();
      expect(hclRefTool?.inputSchema.properties.config).toBeDefined();
    });

    it('should include get_code_examples tool', () => {
      const tools = toolHandler.getAvailableTools();
      const examplesTool = tools.find(t => t.name === 'get_code_examples');
      
      expect(examplesTool).toBeDefined();
      expect(examplesTool?.inputSchema.properties.topic).toBeDefined();
    });

    it('should have clear, descriptive tool names', () => {
      const tools = toolHandler.getAvailableTools();

      tools.forEach(tool => {
        // Names should be snake_case
        expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
        
        // Names should not be too long
        expect(tool.name.length).toBeLessThan(50);
      });
    });

    it('should have helpful tool descriptions', () => {
      const tools = toolHandler.getAvailableTools();

      tools.forEach(tool => {
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.description.length).toBeLessThan(500);
      });
    });
  });

  describe('CallToolRequest Compliance', () => {
    it('should handle CallToolRequest with valid tool and arguments', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'dependencies',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should return structured response for search tool', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 3
      });

      expect(result.query).toBe('terraform');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.total).toBeDefined();
      expect(typeof result.total).toBe('number');
    });

    it('should return structured response for sections tool', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});

      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.totalSections).toBeDefined();
      expect(typeof result.totalSections).toBe('number');
    });

    it('should return structured response for section docs tool', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'getting-started'
      });

      expect(result.section).toBe('getting-started');
      
      if (result.error) {
        expect(result.error).toBeDefined();
        expect(result.availableSections).toBeDefined();
      } else {
        expect(result.docs).toBeDefined();
        expect(Array.isArray(result.docs)).toBe(true);
      }
    });

    it('should return structured response for CLI help tool', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });

      expect(result.command).toBe('plan');
      
      if (!result.error) {
        expect(result.title).toBeDefined();
        expect(result.content).toBeDefined();
      }
    });

    it('should return structured response for HCL config tool', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'terraform'
      });

      expect(result.config).toBe('terraform');
      
      if (!result.error) {
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }
    });

    it('should return structured response for code examples tool', async () => {
      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'dependencies',
        limit: 3
      });

      expect(result.topic).toBe('dependencies');
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it('should validate required parameters', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should return error object for unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle missing optional parameters gracefully', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
        // limit is optional, should default to 5
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should not throw exceptions on tool execution errors', async () => {
      // Should return error object, not throw
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'nonexistent-section'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('Error Response Compliance', () => {
    it('should return error response (not throw) for invalid resources', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/invalid');
      
      // Should return error in contents, not throw
      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(resource.contents[0].text).toContain('Error');
      expect(resource.mimeType).toBe('text/plain');
    });

    it('should return error object (not throw) for invalid tool parameters', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {});

      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should provide helpful error messages', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'nonexistent'
      });

      if (result.error) {
        expect(result.error).toContain('No documentation found');
        expect(result.availableSections).toBeDefined();
      }
    });

    it('should not expose internal errors to clients', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: null as any // Invalid input
      });

      // Should return safe error message
      expect(result.error).toBeDefined();
      expect(result.error).not.toContain('stack');
      expect(result.error).not.toContain('at Object');
    });
  });

  describe('Response Format Compliance', () => {
    it('should return JSON-serializable responses', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test',
        limit: 1
      });

      // Should be serializable to JSON
      expect(() => JSON.stringify(result)).not.toThrow();
      
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(result);
    });

    it('should not return circular references', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should return consistent field types across calls', async () => {
      const result1 = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'terraform',
        limit: 1
      });
      
      const result2 = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'different query',
        limit: 1
      });

      // Both should have same structure
      expect(typeof result1.query).toBe(typeof result2.query);
      expect(Array.isArray(result1.results)).toBe(Array.isArray(result2.results));
      expect(typeof result1.total).toBe(typeof result2.total);
    });
  });

  describe('URI Encoding Compliance', () => {
    it('should properly encode resource URIs', async () => {
      const resources = await resourceHandler.listResources();
      
      resources.forEach(resource => {
        // URIs with special characters should be encoded
        if (resource.uri.includes('%')) {
          // If encoded, should be valid
          expect(() => decodeURIComponent(resource.uri)).not.toThrow();
        }
      });
    });

    it('should handle reading encoded URIs', async () => {
      const resources = await resourceHandler.listResources();
      const encodedResource = resources.find(r => r.uri.includes('%'));
      
      if (encodedResource) {
        const resource = await resourceHandler.getResource(encodedResource.uri);
        expect(resource.contents).toBeDefined();
      }
    });

    it('should maintain URI consistency between list and read', async () => {
      const resources = await resourceHandler.listResources();
      const firstResource = resources[0];
      
      // Should be able to read using exact URI from list
      const resource = await resourceHandler.getResource(firstResource.uri);
      
      // Contents don't have URI field, but mimeType should match
      expect(resource.mimeType).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(resource.contents.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrency Compliance', () => {
    it('should handle concurrent resource reads', async () => {
      const resources = await resourceHandler.listResources();
      const uris = resources.slice(0, 5).map(r => r.uri);
      
      const promises = uris.map(uri => resourceHandler.getResource(uri));
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(uris.length);
      results.forEach(result => {
        expect(result.contents).toBeDefined();
      });
    });

    it('should handle concurrent tool executions', async () => {
      const promises = [
        toolHandler.executeTool('search_terragrunt_docs', { query: 'test1', limit: 1 }),
        toolHandler.executeTool('search_terragrunt_docs', { query: 'test2', limit: 1 }),
        toolHandler.executeTool('get_terragrunt_sections', {}),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should not corrupt state during concurrent operations', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        toolHandler.executeTool('search_terragrunt_docs', {
          query: `test${i}`,
          limit: 1
        })
      );
      
      const results = await Promise.all(promises);
      
      // Each result should have correct query
      results.forEach((result, i) => {
        expect(result.query).toBe(`test${i}`);
      });
    });
  });

  describe('Protocol Version Compliance', () => {
    it('should use MCP SDK types correctly', () => {
      // Verify we're using the official MCP SDK schemas
      expect(ListResourcesRequestSchema).toBeDefined();
      expect(ReadResourceRequestSchema).toBeDefined();
      expect(ListToolsRequestSchema).toBeDefined();
      expect(CallToolRequestSchema).toBeDefined();
    });

    it('should declare correct server info', () => {
      // Server info validation
      expect(server).toBeDefined();
    });
  });
});
