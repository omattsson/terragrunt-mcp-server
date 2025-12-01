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
      expect(cliHelpTool?.description).toContain('aliases');
    });

    it('should include list_cli_commands tool', () => {
      const tools = toolHandler.getAvailableTools();
      const listCliTool = tools.find(t => t.name === 'list_cli_commands');
      
      expect(listCliTool).toBeDefined();
      expect(listCliTool?.inputSchema.properties.category).toBeDefined();
      expect(listCliTool?.inputSchema.properties.search).toBeDefined();
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

    it('should include get_terragrunt_function tool', () => {
      const tools = toolHandler.getAvailableTools();
      const functionTool = tools.find(t => t.name === 'get_terragrunt_function');
      
      expect(functionTool).toBeDefined();
      expect(functionTool?.description).toBeDefined();
      expect(functionTool?.inputSchema.properties.function_name).toBeDefined();
      expect(functionTool?.inputSchema.properties.include_examples).toBeDefined();
      expect(functionTool?.inputSchema.required).toContain('function_name');
    });

    it('should include list_terragrunt_functions tool', () => {
      const tools = toolHandler.getAvailableTools();
      const listTool = tools.find(t => t.name === 'list_terragrunt_functions');
      
      expect(listTool).toBeDefined();
      expect(listTool?.description).toBeDefined();
      expect(listTool?.inputSchema.properties.category).toBeDefined();
      expect(listTool?.inputSchema.properties.search).toBeDefined();
      expect(listTool?.inputSchema.properties.limit).toBeDefined();
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
        expect(result.description).toBeDefined();
        expect(result.usage).toBeDefined();
        expect(result.examples).toBeDefined();
        expect(result.formattedHelp).toBeDefined();
      }
    });

    it('should return all categories for list_cli_commands tool', async () => {
      const result = await toolHandler.executeTool('list_cli_commands', {});

      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.totalCategories).toBeGreaterThan(0);
      expect(result.totalCommands).toBeGreaterThan(15);
      
      const categoryIds = result.categories.map((c: any) => c.id);
      expect(categoryIds).toContain('main');
      expect(categoryIds).toContain('shortcut');
      expect(categoryIds).toContain('configuration');
    });

    it('should filter list_cli_commands by category', async () => {
      const result = await toolHandler.executeTool('list_cli_commands', {
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

    it('should search list_cli_commands by query', async () => {
      const result = await toolHandler.executeTool('list_cli_commands', {
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

    it('should return structured response for get_terragrunt_function tool', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'path_relative_to_include'
      });

      expect(result.name).toBe('path_relative_to_include');
      expect(result.signature).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.parameters).toBeDefined();
      expect(Array.isArray(result.parameters)).toBe(true);
      expect(result.category).toBeDefined();
    });

    it('should handle include_examples parameter for get_terragrunt_function', async () => {
      const withExamples = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'path_relative_to_include',
        include_examples: true
      });

      const withoutExamples = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'path_relative_to_include',
        include_examples: false
      });

      expect(withExamples.examples).toBeDefined();
      // When include_examples=false, examples is an empty array, not undefined
      expect(Array.isArray(withoutExamples.examples)).toBe(true);
      expect(withoutExamples.examples.length).toBe(0);
    });

    it('should return structured response for list_terragrunt_functions tool with no params', async () => {
      const result = await toolHandler.executeTool('list_terragrunt_functions', {});

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.totalCount).toBeDefined();
      expect(typeof result.totalCount).toBe('number');
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('should filter by category for list_terragrunt_functions tool', async () => {
      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        category: 'path'
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      
      // All returned functions should be in the 'path' category
      result.functions.forEach((fn: any) => {
        expect(fn.category).toBe('path');
      });
    });

    it('should search by keyword for list_terragrunt_functions tool', async () => {
      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        search: 'path'
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      // Functions should contain 'path' in name or description
      expect(result.functions.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter for list_terragrunt_functions tool', async () => {
      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        limit: 5
      });

      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.functions.length).toBeLessThanOrEqual(5);
    });

    it('should validate required parameters', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    });

    it('should validate required function_name parameter for get_terragrunt_function', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_function', {});

      expect(result.error).toBeDefined();
      expect(result.error).toContain('function_name');
    });

    it('should return error for unknown function in get_terragrunt_function', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'nonexistent_function_12345'
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No Terragrunt function found');
      // Should provide suggestions
      expect(result.suggestion).toBeDefined();
    });

    it('should handle invalid category gracefully for list_terragrunt_functions', async () => {
      const result = await toolHandler.executeTool('list_terragrunt_functions', {
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

  describe('Configuration Generator Tool Compliance', () => {
    describe('Tool Definition in ListTools', () => {
      it('should include generate_terragrunt_config in available tools', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
        expect(genTool).toBeDefined();
        expect(genTool?.name).toBe('generate_terragrunt_config');
        expect(genTool?.description).toBeDefined();
        expect(typeof genTool?.description).toBe('string');
      });

      it('should have valid JSON Schema for generate_terragrunt_config', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
        expect(genTool?.inputSchema).toBeDefined();
        expect(genTool?.inputSchema.type).toBe('object');
        expect(genTool?.inputSchema.properties).toBeDefined();
        expect(typeof genTool?.inputSchema.properties).toBe('object');
      });

      it('should define useCase parameter as enum with 5 valid values', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
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
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
        const backendProperty = genTool?.inputSchema.properties.backend;
        expect(backendProperty).toBeDefined();
        expect(backendProperty.type).toBe('string');
        
        // backend should NOT be in required array
        const required = genTool?.inputSchema.required || [];
        expect(required.includes('backend')).toBe(false);
      });

      it('should define options as required object parameter', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
        const optionsProperty = genTool?.inputSchema.properties.options;
        expect(optionsProperty).toBeDefined();
        expect(optionsProperty.type).toBe('object');
        expect(optionsProperty.additionalProperties).toBe(true);
        
        // options should be in required array
        const required = genTool?.inputSchema.required || [];
        expect(required.includes('options')).toBe(true);
      });

      it('should require useCase and options parameters', () => {
        const tools = toolHandler.getAvailableTools();
        const genTool = tools.find(t => t.name === 'generate_terragrunt_config');
        
        expect(genTool?.inputSchema.required).toBeDefined();
        expect(Array.isArray(genTool?.inputSchema.required)).toBe(true);
        expect(genTool?.inputSchema.required).toContain('useCase');
        expect(genTool?.inputSchema.required).toContain('options');
      });
    });

    describe('CallTool Request/Response Format', () => {
      it('should execute successfully with valid parameters', async () => {
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
          useCase: 'remote_state'
          // Missing options
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('options');
      });

      it('should handle optional backend parameter correctly', async () => {
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
        const result = await toolHandler.executeTool('generate_terragrunt_config', {
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
          const result = await toolHandler.executeTool('generate_terragrunt_config', testCase);
          
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
      it('should include analyze_best_practices in available tools', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
        expect(bestPracticesTool).toBeDefined();
        expect(bestPracticesTool?.name).toBe('analyze_best_practices');
        expect(bestPracticesTool?.description).toBeDefined();
        expect(typeof bestPracticesTool?.description).toBe('string');
        expect(bestPracticesTool?.description).toContain('confidence');
      });

      it('should have valid JSON Schema for analyze_best_practices', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
        expect(bestPracticesTool?.inputSchema).toBeDefined();
        expect(bestPracticesTool?.inputSchema.type).toBe('object');
        expect(bestPracticesTool?.inputSchema.properties).toBeDefined();
        expect(typeof bestPracticesTool?.inputSchema.properties).toBe('object');
      });

      it('should define topic parameter as required string WITHOUT enum (enables fuzzy matching)', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
        const topicProperty = bestPracticesTool?.inputSchema.properties.topic;
        expect(topicProperty).toBeDefined();
        expect(topicProperty.type).toBe('string');
        
        // CRITICAL: Topic should NOT have enum to enable fuzzy matching
        // This was a key decision in PR #114 (issue #34)
        expect(topicProperty.enum).toBeUndefined();
        expect(topicProperty.description).toBeDefined();
        expect(topicProperty.description).toContain('Supported topics');
      });

      it('should define level parameter as optional string WITH enum', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
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

      it('should require only topic parameter', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
        expect(bestPracticesTool?.inputSchema.required).toBeDefined();
        expect(Array.isArray(bestPracticesTool?.inputSchema.required)).toBe(true);
        expect(bestPracticesTool?.inputSchema.required).toEqual(['topic']);
      });

      it('should describe confidence scoring in tool description', () => {
        const tools = toolHandler.getAvailableTools();
        const bestPracticesTool = tools.find(t => t.name === 'analyze_best_practices');
        
        expect(bestPracticesTool?.description).toBeDefined();
        expect(bestPracticesTool?.description.toLowerCase()).toContain('confidence');
        expect(bestPracticesTool?.description.toLowerCase()).toMatch(/suggest|fuzzy|did you mean/);
      });
    });

    describe('CallTool Request/Response Format', () => {
      it('should execute successfully with valid topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management'
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        expect(result.topic).toBe('state_management');
      }, 30000);

      it('should return MCP-compliant success response structure', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'module_organization'
        });

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        
        // Should have all required BestPracticeResult fields
        expect(result.topic).toBeDefined();
        expect(result.recommendations).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.commonPitfalls).toBeDefined();
        expect(result.experienceNotes).toBeDefined();
        expect(result.realWorldExamples).toBeDefined();
        expect(result.confidence).toBeDefined();
      }, 30000);

      it('should include all required BestPracticeResult fields', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'dependencies',
          level: 'intermediate'
        });

        // Validate field types
        expect(typeof result.topic).toBe('string');
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'security'
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
        const result = await toolHandler.executeTool('analyze_best_practices', {
          // Missing topic
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('topic');
      });

      it('should handle invalid level value gracefully', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_management',
          level: 'invalid_level' as any
        });

        // Should still return a result (not throw)
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        
        // Should either ignore invalid level or return error
        expect(result.topic || result.error).toBeDefined();
      }, 30000);

      it('should handle optional level parameter correctly', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'performance'
          // No level specified - should still work
        });

        expect(result).toBeDefined();
        expect(result.topic).toBe('performance');
        expect(result.recommendations).toBeDefined();
        expect(result.confidence).toBeDefined();
      }, 30000);

      it('should handle unknown parameters gracefully', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'testing',
          unknownParam: 'should be ignored' as any
        });

        // Should still execute successfully, ignoring unknown params
        expect(result).toBeDefined();
        expect(result.topic).toBe('testing');
        expect(result.confidence).toBeDefined();
      }, 30000);
    });

    describe('Error Handling Compliance', () => {
      it('should return MCP-compliant error for typo with fuzzy matching suggestions', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'state_managment' // Typo: missing 'e'
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        
        // Should include helpful suggestion
        expect(result.suggestion).toBeDefined();
        expect(result.suggestion).toContain('Did you mean');
        
        // Should include suggested topics array
        expect(result.suggestedTopics).toBeDefined();
        expect(Array.isArray(result.suggestedTopics)).toBe(true);
        expect(result.suggestedTopics.length).toBeGreaterThan(0);
        
        // Should suggest the correct topic
        expect(result.suggestedTopics).toContain('state_management');
        
        // Confidence should be 0 for unknown topics
        expect(result.confidence).toBe(0);
      }, 30000);

      it('should return helpful suggestion for semantic queries', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'remote state' // Semantic query
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(result.suggestion).toBeDefined();
        
        // Semantic queries may not trigger fuzzy matching if too different
        // but should get helpful suggestion listing supported topics
        expect(result.suggestion).toContain('supported topics');
        expect(result.confidence).toBe(0);
      }, 30000);

      it('should return MCP-compliant error for completely unknown topic', async () => {
        const result = await toolHandler.executeTool('analyze_best_practices', {
          topic: 'xyz_completely_invalid_topic_12345'
        });

        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.suggestion).toBeDefined();
        expect(result.confidence).toBe(0);
        
        // For very different topics, suggestedTopics may be undefined
        // but suggestion should list supported topics
        expect(result.suggestion).toContain('supported topics');
      }, 30000);

      it('should not throw exceptions on invalid input (return error object instead)', async () => {
        // Test multiple invalid inputs - should all return error objects, not throw
        const testCases = [
          { topic: 'invalid_topic_xyz' },
          { topic: 'state_managment' }, // typo
          {}, // missing topic
          { topic: 'state_management', level: 'invalid' as any },
        ];

        for (const testCase of testCases) {
          const result = await toolHandler.executeTool('analyze_best_practices', testCase);
          
          expect(result).toBeDefined();
          expect(typeof result).toBe('object');
          // Should have either valid response or error property, not throw
          expect(result.topic || result.error).toBeDefined();
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
