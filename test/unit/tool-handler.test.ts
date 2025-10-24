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
      expect(tools.length).toBe(6);
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
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should return error for invalid command', async () => {
      mockDocsManager.getCliCommandHelp.mockResolvedValueOnce(null);

      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should include URL in response', async () => {
      const result = await toolHandler.executeTool('get_cli_command_help', {
        command: 'plan'
      });
      
      expect(result.url).toBeDefined();
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
});
