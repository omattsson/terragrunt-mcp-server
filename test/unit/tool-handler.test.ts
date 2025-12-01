import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { TerragruntDoc } from '../../src/terragrunt/docs.js';

// Create shared mock instances
const mockDocsManager = {
  fetchLatestDocs: vi.fn(),
  getAvailableSections: vi.fn(),
  getDocBySection: vi.fn(),
  getCliCommandHelp: vi.fn(),
  getHclConfigReference: vi.fn(),
  getCodeExamples: vi.fn(),
  searchDocs: vi.fn()
};

const mockResourceHandler = {
  searchDocumentation: vi.fn()
};

// Mock dependencies
vi.mock('../../src/handlers/resources.js', () => {
  return {
    ResourceHandler: class {
      searchDocumentation = mockResourceHandler.searchDocumentation;
    }
  };
});

vi.mock('../../src/terragrunt/docs.js', () => {
  return {
    TerragruntDocsManager: class {
      fetchLatestDocs = mockDocsManager.fetchLatestDocs;
      getAvailableSections = mockDocsManager.getAvailableSections;
      getDocBySection = mockDocsManager.getDocBySection;
      getCliCommandHelp = mockDocsManager.getCliCommandHelp;
      getHclConfigReference = mockDocsManager.getHclConfigReference;
      getCodeExamples = mockDocsManager.getCodeExamples;
      searchDocs = mockDocsManager.searchDocs;
    }
  };
});

describe('ToolHandler', () => {
  let toolHandler: ToolHandler;

  const mockDocs: TerragruntDoc[] = [
    {
      title: 'Quick Start',
      url: 'https://terragrunt.gruntwork.io/docs/getting-started/quick-start/',
      content: 'Getting started with Terragrunt',
      section: 'getting-started',
      lastUpdated: '2025-01-01'
    },
    {
      title: 'plan command',
      url: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/plan/',
      content: 'Execute terraform plan',
      section: 'reference',
      lastUpdated: '2025-01-01'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock return values
    mockDocsManager.fetchLatestDocs.mockResolvedValue(mockDocs);
    mockDocsManager.getAvailableSections.mockResolvedValue(['getting-started', 'reference']);
    mockDocsManager.getDocBySection.mockResolvedValue([mockDocs[0]]);
    mockDocsManager.getCliCommandHelp.mockResolvedValue(mockDocs[1]);
    mockDocsManager.getHclConfigReference.mockResolvedValue([mockDocs[0]]);
    mockDocsManager.getCodeExamples.mockResolvedValue([]);
    mockDocsManager.searchDocs.mockResolvedValue(mockDocs);
    
    mockResourceHandler.searchDocumentation.mockResolvedValue(mockDocs);
    
    // Create new instance for each test
    toolHandler = new ToolHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Listing', () => {
    it('should return all available tools', () => {
      const tools = toolHandler.getAvailableTools();
      
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
  expect(tools.length).toBeGreaterThanOrEqual(6);
    });

    it('should include search_terragrunt_docs tool', () => {
      const tools = toolHandler.getAvailableTools();
      
      const searchTool = tools.find(t => t.name === 'search_terragrunt_docs');
      expect(searchTool).toBeDefined();
      expect(searchTool?.inputSchema).toBeDefined();
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
    });

    it('should include get_cli_command_help tool', () => {
      const tools = toolHandler.getAvailableTools();
      
      const cliTool = tools.find(t => t.name === 'get_cli_command_help');
      expect(cliTool).toBeDefined();
    });

    it('should include get_hcl_config_reference tool', () => {
      const tools = toolHandler.getAvailableTools();
      
      const hclTool = tools.find(t => t.name === 'get_hcl_config_reference');
      expect(hclTool).toBeDefined();
    });

    it('should include get_code_examples tool', () => {
      const tools = toolHandler.getAvailableTools();
      
      const examplesTool = tools.find(t => t.name === 'get_code_examples');
      expect(examplesTool).toBeDefined();
    });

    it('should have descriptions for all tools', () => {
      const tools = toolHandler.getAvailableTools();
      
      expect(tools.every(t => t.description)).toBe(true);
      expect(tools.every(t => t.description.length > 10)).toBe(true);
    });

    it('should have input schemas for all tools', () => {
      const tools = toolHandler.getAvailableTools();
      
      expect(tools.every(t => t.inputSchema)).toBe(true);
      expect(tools.every(t => t.inputSchema.type === 'object')).toBe(true);
    });
  });

  describe('Input Schema Validation', () => {
    it('should require query parameter for search tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_terragrunt_docs');
      
      expect(searchTool?.inputSchema.required).toContain('query');
    });

    it('should have optional limit parameter for search tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_terragrunt_docs');
      
      expect(searchTool?.inputSchema.properties.limit).toBeDefined();
      expect(searchTool?.inputSchema.properties.limit.default).toBe(5);
    });

    it('should enforce limit boundaries for search tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_terragrunt_docs');
      
      expect(searchTool?.inputSchema.properties.limit.minimum).toBe(1);
      expect(searchTool?.inputSchema.properties.limit.maximum).toBe(20);
    });

    it('should require section parameter for get_section_docs', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_section_docs');
      
      expect(tool?.inputSchema.required).toContain('section');
    });

    it('should require command parameter for get_cli_command_help', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_cli_command_help');
      
      expect(tool?.inputSchema.required).toContain('command');
    });

    it('should require config parameter for get_hcl_config_reference', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_hcl_config_reference');
      
      expect(tool?.inputSchema.required).toContain('config');
    });

    it('should require topic parameter for get_code_examples', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_code_examples');
      
      expect(tool?.inputSchema.required).toContain('topic');
    });

    it('should have no required parameters for get_terragrunt_sections', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_terragrunt_sections');
      
      expect(tool?.inputSchema.required).toHaveLength(0);
    });

    it('should require error_message parameter for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      expect(diagnoseTool?.inputSchema.required).toContain('error_message');
    });

    it('should have correct input schema for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      expect(diagnoseTool?.inputSchema).toBeDefined();
      expect(diagnoseTool?.inputSchema.type).toBe('object');
      expect(diagnoseTool?.inputSchema.properties.error_message).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.error_message.type).toBe('string');
    });

    it('should have optional context parameter for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      expect(diagnoseTool?.inputSchema.properties.context).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.context.type).toBe('object');
      expect(diagnoseTool?.inputSchema.properties.context.properties.command).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.context.properties.backend).toBeDefined();
    });

    it('should have optional options parameter with defaults for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      expect(diagnoseTool?.inputSchema.properties.options).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.options.properties.maxMatches.default).toBe(3);
      expect(diagnoseTool?.inputSchema.properties.options.properties.minConfidence.default).toBe(0.3);
      expect(diagnoseTool?.inputSchema.properties.options.properties.enableFuzzyMatching.default).toBe(true);
      expect(diagnoseTool?.inputSchema.properties.options.properties.enrichWithDocs.default).toBe(false);
    });
  });

  describe('Tool Execution - search_terragrunt_docs', () => {
    it('should execute search with query', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'remote state'
      });
      
      expect(result.query).toBe('remote state');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should apply default limit of 5', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
      });
      
      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should respect custom limit', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test',
        limit: 2
      });
      
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should truncate long content snippets', async () => {
      const longDoc = {
        ...mockDocs[0],
        content: 'a'.repeat(500)
      };
      mockResourceHandler.searchDocumentation.mockResolvedValueOnce([longDoc]);

      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
      });
      
      if (result.results.length > 0) {
        expect(result.results[0].snippet.length).toBeLessThanOrEqual(303); // 300 + '...'
      }
    });

    it('should include metadata in results', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
      });
      
      expect(result.total).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });
  });

  describe('Tool Execution - get_terragrunt_sections', () => {
    it('should return all sections', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});
      
      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.totalSections).toBeDefined();
      expect(result.totalDocs).toBeDefined();
    });

    it('should include doc counts for each section', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});
      
      expect(result.sections.every((s: any) => typeof s.docCount === 'number')).toBe(true);
    });

    it('should work without parameters', async () => {
      await expect(
        toolHandler.executeTool('get_terragrunt_sections', {})
      ).resolves.toBeDefined();
    });
  });

  describe('Tool Execution - get_section_docs', () => {
    it('should return docs for valid section', async () => {
      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'getting-started'
      });
      
      expect(result.section).toBe('getting-started');
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should return error for invalid section', async () => {
      mockDocsManager.getDocBySection.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.availableSections).toBeDefined();
    });

    it('should truncate long doc content', async () => {
      const longDoc = {
        ...mockDocs[0],
        content: 'a'.repeat(1000)
      };
      mockDocsManager.getDocBySection.mockResolvedValueOnce([longDoc]);

      const result = await toolHandler.executeTool('get_section_docs', {
        section: 'test'
      });
      
      if (result.docs && result.docs.length > 0) {
        expect(result.docs[0].content.length).toBeLessThanOrEqual(503);
      }
    });
  });

  describe('Tool Execution - get_cli_command_help', () => {
    it('should return help for valid command', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });
      
      expect(result.command).toBe('plan');
      expect(result.description).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.formattedHelp).toBeDefined();
    });

    it('should return error for invalid command', async () => {
      mockDocsManager.getCliCommandHelp.mockResolvedValueOnce(null);

      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.hint).toBeDefined();
      expect(result.availableCommands).toBeDefined();
    });

    it('should include documentation URL in response', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });
      
      expect(result.documentationUrl).toBeDefined();
    });

    it('should resolve command aliases', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'run-all'
      });
      
      expect(result.command).toBe('run');
      expect(result.aliases).toContain('run-all');
    });

    it('should include examples in response', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });
      
      expect(result.examples).toBeDefined();
      expect(result.examples.length).toBeGreaterThan(0);
    });

    it('should include options in response', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'run'
      });
      
      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options.some((o: any) => o.flag === '--all')).toBe(true);
    });
  });

  describe('Tool Execution - get_hcl_config_reference', () => {
    it('should return docs for valid config', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'terraform'
      });
      
      expect(result.config).toBe('terraform');
      expect(result.results).toBeDefined();
    });

    it('should return error for invalid config', async () => {
      mockDocsManager.getHclConfigReference.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should truncate long content', async () => {
      const longDoc = {
        ...mockDocs[0],
        content: 'a'.repeat(1500)
      };
      mockDocsManager.getHclConfigReference.mockResolvedValueOnce([longDoc]);

      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'test'
      });
      
      if (result.results && result.results.length > 0) {
        expect(result.results[0].content.length).toBeLessThanOrEqual(803);
      }
    });
  });

  describe('Tool Execution - get_code_examples', () => {
    it('should return examples for valid topic', async () => {
      const examples = [
        {
          doc: mockDocs[0],
          examples: ['terraform { source = "..." }']
        }
      ];
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'terraform'
      });
      
      expect(result.topic).toBe('terraform');
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it('should return error when no examples found', async () => {
      mockDocsManager.getCodeExamples.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should apply default limit of 5', async () => {
      const examples = Array.from({ length: 10 }, (_, i) => ({
        doc: mockDocs[0],
        examples: [`example ${i}`]
      }));
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'test'
      });
      
      expect(result.examples.length).toBeLessThanOrEqual(5);
    });

    it('should respect custom limit', async () => {
      const examples = Array.from({ length: 10 }, (_, i) => ({
        doc: mockDocs[0],
        examples: [`example ${i}`]
      }));
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('get_code_examples', {
        topic: 'test',
        limit: 3
      });
      
      expect(result.examples.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Tool Execution - get_terragrunt_function', () => {
    it('should return error when function_name is missing', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_function', {});
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('function_name parameter is required');
    });

    it('should return function details with examples by default', async () => {
      // Mock the functions manager to return a sample function
      const mockFunction = {
        name: 'get_env',
        signature: 'get_env(name, default) -> string',
        description: 'Returns the value of an environment variable',
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Environment variable name' },
          { name: 'default', type: 'string', required: false, description: 'Default value' }
        ],
        returnType: 'string',
        category: 'env',
        examples: [
          { code: 'get_env("HOME")', description: 'Get HOME environment variable', useCase: 'Basic usage' }
        ],
        relatedFunctions: ['get_aws_account_id']
      };

      // Create a mock functions manager
      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        getFunction: vi.fn().mockReturnValue(mockFunction),
        listFunctions: vi.fn().mockReturnValue([mockFunction])
      };

      // Replace the functions manager
      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'get_env'
      });
      
      expect(result.error).toBeUndefined();
      expect(result.name).toBe('get_env');
      expect(result.signature).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.parameters).toBeDefined();
      expect(result.returnType).toBe('string');
      expect(result.category).toBe('env');
      expect(result.examples).toBeDefined();
      expect(result.examples.length).toBeGreaterThan(0);
      expect(result.relatedFunctions).toBeDefined();
      expect(result.relatedDocs).toBeDefined();
      expect(Array.isArray(result.relatedDocs)).toBe(true);
    });

    it('should exclude examples when include_examples is false', async () => {
      const mockFunction = {
        name: 'get_env',
        signature: 'get_env(name, default) -> string',
        description: 'Returns the value of an environment variable',
        parameters: [],
        returnType: 'string',
        category: 'env',
        examples: [
          { code: 'get_env("HOME")', description: 'Get HOME', useCase: 'Basic' }
        ],
        relatedFunctions: []
      };

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        getFunction: vi.fn().mockReturnValue(mockFunction),
        listFunctions: vi.fn().mockReturnValue([mockFunction])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'get_env',
        include_examples: false
      });
      
      expect(result.error).toBeUndefined();
      expect(result.name).toBe('get_env');
      expect(result.examples).toBeDefined();
      expect(result.examples.length).toBe(0);
    });

    it('should return error with suggestions for unknown function', async () => {
      const allFunctions = [
        { name: 'get_env', signature: '', description: '', parameters: [], returnType: '', category: '', examples: [], relatedFunctions: [] },
        { name: 'get_aws_account_id', signature: '', description: '', parameters: [], returnType: '', category: '', examples: [], relatedFunctions: [] },
        { name: 'find_in_parent_folders', signature: '', description: '', parameters: [], returnType: '', category: '', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        getFunction: vi.fn().mockReturnValue(null),
        listFunctions: vi.fn().mockReturnValue(allFunctions)
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'get_envi'
      });
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('No Terragrunt function found');
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('Did you mean');
      expect(result.suggestion).toContain('get_env');
    });

    it('should provide fallback suggestion when no similar functions found', async () => {
      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        getFunction: vi.fn().mockReturnValue(null),
        listFunctions: vi.fn().mockReturnValue([])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'nonexistent_function'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('list_terragrunt_functions');
    });

    it('should include all required MCP response fields', async () => {
      const mockFunction = {
        name: 'test_func',
        signature: 'test_func() -> string',
        description: 'Test function',
        parameters: [],
        returnType: 'string',
        category: 'test',
        examples: [],
        relatedFunctions: []
      };

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        getFunction: vi.fn().mockReturnValue(mockFunction),
        listFunctions: vi.fn().mockReturnValue([mockFunction])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('get_terragrunt_function', {
        function_name: 'test_func'
      });
      
      // Verify all required fields from issue #14
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('returnType');
      expect(result).toHaveProperty('examples');
      expect(result).toHaveProperty('relatedFunctions');
      expect(result).toHaveProperty('relatedDocs');
    });
  });

  describe('Tool Execution - list_terragrunt_functions', () => {
    it('should list all functions when no parameters provided', async () => {
      const mockFunctions = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] },
        { name: 'find_in_parent_folders', signature: 'find_in_parent_folders() -> string', description: 'Find file in parent folders', parameters: [], returnType: 'string', category: 'path', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        listFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['env', 'path'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {});
      
      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.functions.length).toBe(2);
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.totalCount).toBe(2);
    });

    it('should filter by category', async () => {
      const mockFunctions = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        listFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['env', 'path'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        category: 'env'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].category).toBe('env');
      expect(mockFunctionsManager.listFunctions).toHaveBeenCalledWith('env');
    });

    it('should filter by search query', async () => {
      const mockFunctions = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable value', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] },
        { name: 'get_aws_account_id', signature: 'get_aws_account_id() -> string', description: 'Get AWS account ID', parameters: [], returnType: 'string', category: 'aws', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        searchFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['env', 'aws'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        search: 'get'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(2);
      expect(mockFunctionsManager.searchFunctions).toHaveBeenCalledWith('get');
    });

    it('should combine search and category filters', async () => {
      const mockSearchResults = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] },
        { name: 'get_aws_account_id', signature: 'get_aws_account_id() -> string', description: 'Get AWS account ID', parameters: [], returnType: 'string', category: 'aws', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        searchFunctions: vi.fn().mockReturnValue(mockSearchResults),
        getAvailableCategories: vi.fn().mockReturnValue(['env', 'aws'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        search: 'get',
        category: 'env'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].category).toBe('env');
      expect(mockFunctionsManager.searchFunctions).toHaveBeenCalledWith('get');
    });

    it('should respect limit parameter', async () => {
      const mockFunctions = Array.from({ length: 100 }, (_, i) => ({
        name: `func_${i}`,
        signature: `func_${i}() -> string`,
        description: `Function ${i}`,
        parameters: [],
        returnType: 'string',
        category: 'test',
        examples: [],
        relatedFunctions: []
      }));

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        listFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['test'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        limit: 10
      });
      
      expect(result.functions.length).toBe(10);
      expect(result.totalCount).toBe(100);
    });

    it('should include shortDescription in response', async () => {
      const mockFunctions = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable value. This is a longer description with more details.', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        listFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['env'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {});
      
      expect(result.functions[0]).toHaveProperty('shortDescription');
      expect(result.functions[0].shortDescription).toBe('Get environment variable value.');
      // shortDescription should be shorter than or equal to the original
      expect(result.functions[0].shortDescription.length).toBeLessThanOrEqual(mockFunctions[0].description.length);
      // Verify it's actually shortened (took first sentence)
      expect(result.functions[0].shortDescription).not.toBe(mockFunctions[0].description);
    });

    it('should include all required fields in response', async () => {
      const mockFunctions = [
        { name: 'get_env', signature: 'get_env(name, default) -> string', description: 'Get environment variable', parameters: [], returnType: 'string', category: 'env', examples: [], relatedFunctions: [] }
      ];

      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        listFunctions: vi.fn().mockReturnValue(mockFunctions),
        getAvailableCategories: vi.fn().mockReturnValue(['env'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {});
      
      expect(result).toHaveProperty('functions');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('totalCount');
      
      const func = result.functions[0];
      expect(func).toHaveProperty('name');
      expect(func).toHaveProperty('category');
      expect(func).toHaveProperty('shortDescription');
      expect(func).toHaveProperty('signature');
    });

    it('should return empty array when search has no results', async () => {
      const mockFunctionsManager = {
        loadFunctions: vi.fn().mockResolvedValue(undefined),
        searchFunctions: vi.fn().mockReturnValue([]),
        getAvailableCategories: vi.fn().mockReturnValue(['env', 'path'])
      };

      (toolHandler as any).functionsManager = mockFunctionsManager;

      const result = await toolHandler.executeTool('list_terragrunt_functions', {
        search: 'nonexistent'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.categories).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle tool execution errors gracefully', async () => {
      mockDocsManager.fetchLatestDocs.mockRejectedValueOnce(new Error('Network error'));

      const result = await toolHandler.executeTool('get_terragrunt_sections', {});
      
      expect(result.error).toBeDefined();
    });

    it('should not throw on internal errors', async () => {
      mockResourceHandler.searchDocumentation.mockRejectedValueOnce(new Error('Search failed'));

      await expect(
        toolHandler.executeTool('search_terragrunt_docs', { query: 'test' })
      ).resolves.toBeDefined();
    });
  });

  describe('Response Format Validation', () => {
    it('should return JSON-serializable results', async () => {
      const result = await toolHandler.executeTool('get_terragrunt_sections', {});
      
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should include helpful metadata in responses', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
      });
      
      expect(result.query).toBe('test');
      expect(typeof result.total).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should format results consistently', async () => {
      const result = await toolHandler.executeTool('search_terragrunt_docs', {
        query: 'test'
      });
      
      if (result.results && result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult.title).toBeDefined();
        expect(firstResult.url).toBeDefined();
        expect(firstResult.section).toBeDefined();
        expect(firstResult.snippet).toBeDefined();
      }
    });
  });

  describe('Tool Listing - diagnose_terragrunt_error', () => {
    it('should include diagnose_terragrunt_error tool in tools list', () => {
      const tools = toolHandler.getAvailableTools();
      
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      expect(diagnoseTool).toBeDefined();
      expect(diagnoseTool?.description).toContain('Diagnose');
      expect(diagnoseTool?.description).toContain('Terragrunt');
    });
  });

  describe('Tool Execution - diagnose_terragrunt_error', () => {
    it('should execute with valid error message', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Backend initialization required, please run "terraform init"'
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should return error for missing error_message', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {});
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('error_message');
    });

    it('should return error for empty error_message', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: ''
      });
      
      // Empty string is rejected by validation (!args?.error_message)
      expect(result.error).toBeDefined();
      expect(result.error).toContain('error_message');
    });

    it('should return structured diagnosis with confidence scores', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result.success).toBe(true);
      expect(typeof result.overallConfidence).toBe('number');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should include match details with pattern info', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result.success).toBe(true);
      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect(match.patternId).toBeDefined();
        expect(match.patternName).toBeDefined();
        expect(match.category).toBeDefined();
        expect(typeof match.confidence).toBe('number');
      }
    });

    it('should include debugging steps', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result.success).toBe(true);
      expect(result.debuggingSteps || result.orderedDebuggingSteps).toBeDefined();
    });

    it('should handle context parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Backend initialization required',
        context: {
          command: 'terragrunt apply',
          backend: 's3',
          os: 'linux'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
    });

    it('should handle options parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock',
        options: {
          maxMatches: 5,
          minConfidence: 0.5,
          enableFuzzyMatching: true
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.matches.length).toBeLessThanOrEqual(5);
    });

    it('should handle enrichWithDocs option', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Backend initialization required',
        options: {
          enrichWithDocs: true
        }
      });
      
      expect(result.success).toBe(true);
      // When enrichWithDocs is true, response should have enrichment fields
      if (result.enrichmentSuccessful) {
        expect(result.richSolutions || result.documentationLinks).toBeDefined();
      }
    });

    it('should handle includeDestructiveCommands option', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock',
        options: {
          enrichWithDocs: true,
          includeDestructiveCommands: false
        }
      });
      
      expect(result.success).toBe(true);
    });

    it('should rank matches by confidence', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result.success).toBe(true);
      if (result.matches.length >= 2) {
        // Matches should be sorted by confidence (highest first)
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i].confidence).toBeGreaterThanOrEqual(result.matches[i + 1].confidence);
        }
      }
    });

    it('should return general advice', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock'
      });
      
      expect(result.success).toBe(true);
      expect(result.generalAdvice).toBeDefined();
      expect(Array.isArray(result.generalAdvice)).toBe(true);
    });

    it('should handle unknown errors gracefully', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Some completely unknown error xyz123'
      });
      
      expect(result.success).toBe(true);
      // Should still return a valid response even with no matches
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should handle very long error messages', async () => {
      const longError = 'Error: '.repeat(1000) + 'actual error message';
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: longError
      });
      
      expect(result).toBeDefined();
      expect(result.success !== undefined || result.error !== undefined).toBe(true);
    });

    it('should return JSON-serializable results', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Backend initialization required'
      });
      
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });
});
