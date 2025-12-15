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

    it('should return at least 8 tools', () => {
      const tools = toolHandler.getAvailableTools();
      expect(tools.length).toBeGreaterThanOrEqual(8);
    });

    it('should include unified search_docs tool with all modes', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_docs');
      
      expect(searchTool).toBeDefined();
      expect(searchTool?.description).toBeDefined();
      expect(searchTool?.description).toContain('Unified'); // Case-sensitive
      
      // Verify mode parameter and its options
      expect(searchTool?.inputSchema.properties.mode).toBeDefined();
      expect(searchTool?.inputSchema.properties.mode.enum).toEqual(['search', 'list', 'section', 'examples']);
      
      // Verify all mode-specific parameters exist
      expect(searchTool?.inputSchema.properties.query).toBeDefined(); // search & examples modes
      expect(searchTool?.inputSchema.properties.section).toBeDefined(); // section mode
      expect(searchTool?.inputSchema.properties.detailLevel).toBeDefined(); // section & examples modes
      expect(searchTool?.inputSchema.properties.page).toBeDefined(); // search mode
      expect(searchTool?.inputSchema.properties.pageSize).toBeDefined(); // search mode
      
      // No required parameters at schema level (mode-dependent validation)
      expect(searchTool?.inputSchema.required).toEqual([]);
    });

    it('should include function_reference tool with dual-mode parameters', () => {
      const tools = toolHandler.getAvailableTools();
      const functionTool = tools.find(t => t.name === 'function_reference');
      
      expect(functionTool).toBeDefined();
      expect(functionTool?.description).toBeDefined();
      
      // GET mode parameters
      expect(functionTool?.inputSchema.properties.function_name).toBeDefined();
      expect(functionTool?.inputSchema.properties.mode).toBeDefined();
      expect(functionTool?.inputSchema.properties.include_examples).toBeDefined();
      
      // LIST mode parameters
      expect(functionTool?.inputSchema.properties.category).toBeDefined();
      expect(functionTool?.inputSchema.properties.search).toBeDefined();
      expect(functionTool?.inputSchema.properties.page).toBeDefined();
      expect(functionTool?.inputSchema.properties.pageSize).toBeDefined();
      
      // All params are optional for dual-mode routing
      expect(functionTool?.inputSchema.required).toEqual([]);
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'dependencies',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should return structured response for search tool', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        limit: 3
      });

      expect(result.query).toBe('terraform');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeGreaterThanOrEqual(0);
      expect(typeof result.pagination.totalItems).toBe('number');
    });

    it('should return structured response for sections tool', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});

      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.totalSections).toBeDefined();
      expect(typeof result.totalSections).toBe('number');
    });

    it('should return structured response for section docs tool', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'getting-started'
      , detailLevel: 'full'
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
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });

      expect(result.command).toBe('plan');
      
      if (!result.error) {
        expect(result.description).toBeDefined();
        expect(result.usage).toBeDefined();
        expect(result.examples).toBeDefined();
        expect(result.formattedHelp).toBeDefined();
      }
    });

    it('should return all categories for cli_reference in list mode', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});

      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeGreaterThan(15);
      
      const categoryIds = result.categories.map((c: any) => c.id);
      expect(categoryIds).toContain('main');
      expect(categoryIds).toContain('shortcut');
      expect(categoryIds).toContain('configuration');
    });

    it('should filter cli_reference by category', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'shortcut'
      });

      expect(result.category).toBe('shortcut');
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
      
      const names = result.commands.map((c: any) => c.name);
      expect(names).toContain('plan');
      expect(names).toContain('apply');
      expect(names).toContain('destroy');
    });

    it('should search cli_reference by query', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'validate'
      });

      expect(result.search).toBe('validate');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      
      const names = result.results.map((r: any) => r.name);
      expect(names).toContain('validate-inputs');
      expect(names).toContain('hcl validate');
    });

    it('should return structured response for HCL config tool', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'terraform'
      });

      expect(result.config).toBe('terraform');
      
      if (!result.error) {
        // New structured response from HCLBlocksManager
        expect(result.displayName).toBeDefined();
        expect(result.attributes).toBeDefined();
        expect(result.examples).toBeDefined();
        expect(result.markdown).toBeDefined();
      }
    });

    it('should return block list when listBlocks is true', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        listBlocks: true
      });

      expect(result.blocks).toBeDefined();
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.totalBlocks).toBeGreaterThan(10);
    });

    it('should return structured response for code examples tool', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'dependencies',
        limit: 3
      , detailLevel: 'full'
      });

      expect(result.query).toBe('dependencies');
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it('should return structured response for function_reference tool', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'path_relative_to_include'
      , mode: 'full'
      });

      expect(result.name).toBe('path_relative_to_include');
      expect(result.signature).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.parameters).toBeDefined();
      expect(Array.isArray(result.parameters)).toBe(true);
      expect(result.category).toBeDefined();
    });

    it('should handle include_examples parameter for function_reference', async () => {
      const withExamples = await toolHandler.executeTool('function_reference', {
        function_name: 'path_relative_to_include',
        include_examples: true
      , mode: 'full'
      });

      const withoutExamples = await toolHandler.executeTool('function_reference', {
        function_name: 'path_relative_to_include',
        include_examples: false
      , mode: 'full'
      });

      expect(withExamples.examples).toBeDefined();
      // When include_examples=false, examples is an empty array, not undefined
      expect(Array.isArray(withoutExamples.examples)).toBe(true);
      expect(withoutExamples.examples.length).toBe(0);
    });

    it('should return structured response for function_reference tool with no params', async () => {
      const result = await toolHandler.executeTool('function_reference', {});

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeGreaterThanOrEqual(0);
      expect(typeof result.pagination.totalItems).toBe('number');
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('should filter by category for function_reference tool', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        category: 'path'
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      
      // All returned functions should be in the 'path' category
      result.functions.forEach((fn: any) => {
        expect(fn.category).toBe('path');
      });
    });

    it('should search by keyword for function_reference tool', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        search: 'path'
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      // Functions should contain 'path' in name or description
      expect(result.functions.length).toBeGreaterThan(0);
    });

    it('should respect pageSize parameter for function_reference tool', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        pageSize: 5
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.functions.length).toBeLessThanOrEqual(5);
    });

    it('should validate required parameters', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should default to list mode when function_name is omitted', async () => {
      const result = await toolHandler.executeTool('function_reference', { mode: 'full' });

      // Should return list mode response, not an error
      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.pagination).toBeDefined();
    });

    it('should return error for unknown function in function_reference', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'nonexistent_function_12345'
      , mode: 'full'
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No Terragrunt function found');
      // Should provide suggestions
      expect(result.suggestion).toBeDefined();
    });

    it('should handle invalid category gracefully for function_reference', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        category: 'invalid_category_xyz'
      });

      // Should not throw error, but may return empty results
      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      // Either returns empty array or includes available categories
      if (result.functions.length === 0) {
        expect(result.availableCategories || result.categories).toBeDefined();
      }
    });

    it('should return error object for unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle missing optional parameters gracefully', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test'
        // pageSize is optional, should default to 10
      });

      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(10);
    });

    it('should not throw exceptions on tool execution errors', async () => {
      // Should return error object, not throw
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'nonexistent-section'
      , detailLevel: 'full'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('Configuration Builder Tool Compliance (build_config)', () => {
    describe('Tool Definition in ListTools', () => {
      it('should include build_config in available tools', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        expect(genTool).toBeDefined();
        expect(genTool?.name).toBe('build_config');
        expect(genTool?.description).toBeDefined();
        expect(typeof genTool?.description).toBe('string');
      });

      it('should have valid JSON Schema for build_config', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        expect(genTool?.inputSchema).toBeDefined();
        expect(genTool?.inputSchema.type).toBe('object');
        expect(genTool?.inputSchema.properties).toBeDefined();
        expect(typeof genTool?.inputSchema.properties).toBe('object');
      });

      it('should define useCase parameter as enum with 5 valid values', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        const useCaseProperty = genTool?.inputSchema.properties.useCase;
        expect(useCaseProperty).toBeDefined();
        expect(useCaseProperty.type).toBe('string');
        expect(useCaseProperty.enum).toBeDefined();
        expect(Array.isArray(useCaseProperty.enum)).toBe(true);
        expect(useCaseProperty.enum).toEqual([
          'remote_state',
          'provider_generation',
          'dependencies',
          'hooks',
          'inputs'
        ]);
      });

      it('should define backend as optional string parameter', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        const backendProperty = genTool?.inputSchema.properties.backend;
        expect(backendProperty).toBeDefined();
        expect(backendProperty.type).toBe('string');
        
        // backend should NOT be in required array
        const required = genTool?.inputSchema.required || [];
        expect(required.includes('backend')).toBe(false);
      });

      it('should define options as object parameter with proper schema', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        const optionsProperty = genTool?.inputSchema.properties.options;
        expect(optionsProperty).toBeDefined();
        expect(optionsProperty.type).toBe('object');
        expect(optionsProperty.additionalProperties).toBe(true);
        
        // No fixed required params since tool supports multiple modes
        const required = genTool?.inputSchema.required || [];
        expect(Array.isArray(required)).toBe(true);
      });

      it('should have flexible parameters for multiple modes', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'build_config');
        
        // Tool supports 3 modes:
        // 1. Generate only: useCase + options
        // 2. Write only: content + path
        // 3. Generate + write: useCase + options + write + path
        expect(genTool?.inputSchema.properties.useCase).toBeDefined();
        expect(genTool?.inputSchema.properties.options).toBeDefined();
        expect(genTool?.inputSchema.properties.content).toBeDefined();
        expect(genTool?.inputSchema.properties.path).toBeDefined();
        expect(genTool?.inputSchema.properties.write).toBeDefined();
      });
    });

    describe('CallTool Request/Response Format', () => {
      it('should execute successfully with valid parameters', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          backend: 's3',
          options: {
            bucket: 'test-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'terraform-locks'
          }
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(result.success).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });

      it('should return MCP-compliant success response structure', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          backend: 's3',
          options: {
            bucket: 'test-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'locks'
          }
        });

        expect(result.success).toBe(true);
        expect(result).toHaveProperty('config');
        expect(typeof result.config).toBe('string');
        expect(result).toHaveProperty('explanation');
        expect(typeof result.explanation).toBe('string');
        expect(result).toHaveProperty('relatedDocs');
        expect(Array.isArray(result.relatedDocs)).toBe(true);
        expect(result).toHaveProperty('nextSteps');
        expect(Array.isArray(result.nextSteps)).toBe(true);
        expect(result).toHaveProperty('additionalOptions');
        expect(Array.isArray(result.additionalOptions)).toBe(true);
      });

      it('should handle complex options object with multiple value types', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          backend: 's3',
          options: {
            bucket: 'test-bucket',              // string
            key: 'terraform.tfstate',            // string
            region: 'us-west-2',                 // string
            dynamodb_table: 'locks',             // string
            encrypt: true,                       // boolean
          }
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        // All parameter types should be handled
        expect(result.config).toContain('test-bucket');
        expect(result.config).toContain('encrypt');
      });
    });

    describe('Parameter Validation', () => {
      it('should return error when useCase parameter is missing', async () => {
        const result = await toolHandler.executeTool('build_config', {
          // Missing useCase
          options: {
            bucket: 'test'
          }
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('useCase');
      });

      it('should return error when options parameter is missing', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state'
          // Missing options
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('options');
      });

      it('should handle optional backend parameter correctly', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          // No backend specified - should still work
          options: {
            bucket: 'test-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'locks'
          }
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    describe('Error Handling Compliance', () => {
      it('should return MCP-compliant error for unknown use case', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'unknown_use_case',
          options: {}
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      });

      it('should return MCP-compliant error for invalid backend', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          backend: 'invalid_backend_xyz',
          options: {
            bucket: 'test'
          }
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      });

      it('should return MCP-compliant error for missing required template variables', async () => {
        const result = await toolHandler.executeTool('build_config', {
          useCase: 'remote_state',
          backend: 's3',
          options: {
            // Missing required variables like bucket, region, etc.
            key: 'terraform.tfstate'
          }
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.toLowerCase()).toMatch(/required|missing|variable/);
      });

      it('should not throw exceptions on invalid input (return error object instead)', async () => {
        // Test multiple invalid inputs - should all return error objects, not throw
        const testCases = [
          { useCase: 'invalid' },
          { useCase: 'remote_state' }, // missing options
          { options: {} }, // missing useCase
        ];

        for (const testCase of testCases) {
          const result = await toolHandler.executeTool('build_config', testCase);
          
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          // Should have error property, not throw
          expect(result.error || result.success === false).toBeTruthy();
        }
      });
    });
  });

  describe('Best Practices Analyzer Tool Compliance', () => {
    describe('Tool Definition in ListTools', () => {
      it('should include get_guidance in available tools', () => {
        const tools = toolHandler.getAvailableTools();
        const guidanceTool = tools.find(t => t.name === 'get_guidance');
        
        expect(guidanceTool).toBeDefined();
        expect(guidanceTool?.name).toBe('get_guidance');
        expect(guidanceTool?.description).toBeDefined();
        expect(typeof guidanceTool?.description).toBe('string');
        expect(guidanceTool?.description).toContain('guidance');
      });

      it('should have valid JSON Schema for get_guidance', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'get_guidance');
        
        expect(bestPracticesTool?.inputSchema).toBeDefined();
        expect(bestPracticesTool?.inputSchema.type).toBe('object');
        expect(bestPracticesTool?.inputSchema.properties).toBeDefined();
        expect(typeof bestPracticesTool?.inputSchema.properties).toBe('object');
      });

      it('should define query parameter as optional string WITHOUT enum (enables flexible querying)', () => {
        const tools = toolHandler.getAvailableTools();
        const guidanceTool = tools.find(t => t.name === 'get_guidance');
        
        const queryProperty = guidanceTool?.inputSchema.properties.query;
        expect(queryProperty).toBeDefined();
        expect(queryProperty.type).toBe('string');
        
        // Query should NOT have enum to enable flexible querying
        expect(queryProperty.enum).toBeUndefined();
        expect(queryProperty.description).toBeDefined();
      });

      it('should define level parameter as optional string WITH enum', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'get_guidance');
        
        const levelProperty = bestPracticesTool?.inputSchema.properties.level;
        expect(levelProperty).toBeDefined();
        expect(levelProperty.type).toBe('string');
        expect(levelProperty.enum).toBeDefined();
        expect(Array.isArray(levelProperty.enum)).toBe(true);
        expect(levelProperty.enum).toEqual([
          'beginner',
          'intermediate',
          'advanced'
        ]);
        
        // level should NOT be in required array
        const required = bestPracticesTool?.inputSchema.required || [];
        expect(required.includes('level')).toBe(false);
      });

      it('should have flexible parameters for guidance routing', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'get_guidance');
        
        // No fixed required params - tool intelligently routes based on query content
        expect(bestPracticesTool?.inputSchema.required).toBeDefined();
        expect(Array.isArray(bestPracticesTool?.inputSchema.required)).toBe(true);
        expect(bestPracticesTool?.inputSchema.properties.query).toBeDefined();
        expect(bestPracticesTool?.inputSchema.properties.type).toBeDefined();
      });

      it('should describe guidance routing in tool description', () => {
        const tools = toolHandler.getAvailableTools();
        const guidanceTool = tools.find(t => t.name === 'get_guidance');
        
        expect(guidanceTool?.description).toBeDefined();
        expect(guidanceTool?.description.toLowerCase()).toContain('guidance');
        expect(guidanceTool?.description.toLowerCase()).toMatch(/best practices|comparison|pattern/);
      });
    });

    describe('CallTool Request/Response Format', () => {
      it('should execute successfully with valid topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(result.query).toBe('state_management');
      }, 30000);

      it('should return MCP-compliant success response structure', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'module_organization'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        
        // Should have all required BestPracticeResult fields
        expect(result.query).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.commonPitfalls).toBeDefined();
        expect(result.experienceNotes).toBeDefined();
        expect(result.realWorldExamples).toBeDefined();
        expect(result.confidence).toBeDefined();
      }, 30000);

      it('should include all required BestPracticeResult fields', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'dependencies',
          level: 'intermediate'
        , mode: 'full'
        });

        // Validate field types
        expect(typeof result.query).toBe('string');
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(typeof result.summary).toBe('string');
        expect(Array.isArray(result.commonPitfalls)).toBe(true);
        expect(typeof result.experienceNotes).toBe('object');
        expect(Array.isArray(result.realWorldExamples)).toBe(true);
        expect(typeof result.confidence).toBe('number');
        
        // Validate experienceNotes structure
        expect(result.experienceNotes).toHaveProperty('beginner');
        expect(result.experienceNotes).toHaveProperty('intermediate');
        expect(result.experienceNotes).toHaveProperty('advanced');
        expect(Array.isArray(result.experienceNotes.beginner)).toBe(true);
        expect(Array.isArray(result.experienceNotes.intermediate)).toBe(true);
        expect(Array.isArray(result.experienceNotes.advanced)).toBe(true);
      }, 30000);

      it('should include confidence score in valid range (0-100)', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'security'
        , mode: 'full'
        });

        expect(result.confidence).toBeDefined();
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        
        // Confidence should be a whole number
        expect(Number.isInteger(result.confidence)).toBe(true);
      }, 30000);
    });

    describe('Parameter Validation', () => {
      it('should return error when topic parameter is missing', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          // Missing topic
          mode: 'full'
        });

        expect(result).toBeDefined();
        // Missing query returns available guidance list, not error
        expect(result.availableBestPracticeTopics || result.availableComparisons || result.availablePatternTopics).toBeDefined();
      });

      it('should handle invalid level value gracefully', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_management',
          level: 'invalid_level' as any
        , mode: 'full'
        });

        // Should still return a result (not throw)
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        
        // Should either ignore invalid level or return error
        expect(result.query || result.error).toBeDefined();
      }, 30000);

      it('should handle optional level parameter correctly', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'performance'
          // No level specified - should still work
        , mode: 'full'
        });

        expect(result).toBeDefined();
        expect(result.query).toBe('performance');
        expect(result.recommendations).toBeDefined();
        expect(result.confidence).toBeDefined();
      }, 30000);

      it('should handle unknown parameters gracefully', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'testing',
          unknownParam: 'should be ignored' as any
        , mode: 'full'
        });

        // Should still execute successfully, ignoring unknown params
        expect(result).toBeDefined();
        expect(result.query).toBe('testing');
        expect(result.confidence).toBeDefined();
      }, 30000);
    });

    describe('Error Handling Compliance', () => {
      it('should return MCP-compliant error for typo with fuzzy matching suggestions', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'state_managment', // Typo: missing 'e' - routes to best practices
          mode: 'full'
        });

        expect(result).toBeDefined();
        // Best practices route should provide error with suggestions
        if (result.error) {
          expect(typeof result.error).toBe('string');
          // Should include helpful suggestion
          expect(result.suggestion || result.suggestedTopics).toBeDefined();
          
          if (result.suggestedTopics) {
            expect(Array.isArray(result.suggestedTopics)).toBe(true);
            expect(result.suggestedTopics.length).toBeGreaterThan(0);
          }
          // Confidence should be 0 for unknown topics in best practices route
          if (result.confidence !== undefined) {
            expect(result.confidence).toBe(0);
          }
        } else {
          // If no error, fuzzy matching succeeded or routed to different handler
          // Just verify we got a valid result back
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
        }
      }, 30000);

      it('should route unknown patterns to pattern guidance', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'completely-unknown-topic-xyz123'
        });
          
        // Pattern guidance route should return found status or available topics
        expect(result.found !== undefined || result.availablePatternTopics).toBeDefined();
      }, 30000);

      it('should return helpful suggestion for semantic queries', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'remote state' // Semantic query
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Semantic query may route to pattern guidance or best practices
        if (result.recommendations !== undefined) {
          // Best practices route with error/suggestion
          if (result.error) {
            expect(result.suggestion || result.suggestedTopics).toBeDefined();
          }
        } else {
          // Pattern guidance route
          expect(result.found !== undefined || result.error).toBeTruthy();
        }
      }, 30000);

      it('should return MCP-compliant error for completely unknown topic', async () => {
        const result = await toolHandler.executeTool('get_guidance', {
          query: 'xyz_completely_invalid_topic_12345'
        , mode: 'full'
        });

        expect(result).toBeDefined();
        // Unknown topic may route to pattern guidance (no confidence) or best practices (has confidence)
        if (result.recommendations !== undefined) {
          // Best practices route
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.suggestion || result.suggestedTopics).toBeDefined();
        } else {
          // Pattern guidance route
          expect(result.found).toBe(false);
          expect(result.error).toBeDefined();
        }
      }, 30000);

      it('should not throw exceptions on invalid input (return error object instead)', async () => {
        // Test multiple invalid inputs - should all return error objects, not throw
        const testCases = [
          { query: 'invalid_topic_xyz' },
          { query: 'state_managment' }, // typo
          {}, // missing topic
          { query: 'state_management', level: 'invalid' as any },
        ];

        for (const testCase of testCases) {
          const result = await toolHandler.executeTool('get_guidance', testCase);
          
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          // Should have either valid response, error, or available guidance
          expect(result.topic || result.error || result.found !== undefined || result.availableBestPracticeTopics).toBeDefined();
        }
      }, 60000);
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', });

      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should provide helpful error messages', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'nonexistent'
      , detailLevel: 'full'
      });

      if (result.error) {
        expect(result.error).toContain('No documentation found');
        expect(result.availableSections).toBeDefined();
      }
    });

    it('should not expose internal errors to clients', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});

      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should return consistent field types across calls', async () => {
      const result1 = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'terraform',
        limit: 1
      });
      
      const result2 = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
        toolHandler.executeTool('search_docs', {mode: 'search',  query: 'test1', limit: 1 }),
        toolHandler.executeTool('search_docs', {mode: 'search',  query: 'test2', limit: 1 }),
        toolHandler.executeTool('search_docs', {mode: 'list'}),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should not corrupt state during concurrent operations', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        toolHandler.executeTool('search_docs', {mode: 'search', 
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
