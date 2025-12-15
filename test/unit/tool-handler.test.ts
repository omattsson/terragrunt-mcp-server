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

    it('should include search_docs tool (replaces search_terragrunt_docs)', () => {
      const tools = toolHandler.getAvailableTools();
      
      const unifiedSearchTool = tools.find(t => t.name === 'search_docs');
      expect(unifiedSearchTool).toBeDefined();
      expect(unifiedSearchTool?.inputSchema).toBeDefined();
    });

    it('should include search_docs tool (replaces get_terragrunt_sections)', () => {
      const tools = toolHandler.getAvailableTools();
      
      const unifiedSearchTool = tools.find(t => t.name === 'search_docs');
      expect(unifiedSearchTool).toBeDefined();
    });

    it('should include search_docs tool (replaces get_section_docs)', () => {
      const tools = toolHandler.getAvailableTools();
      
      const unifiedSearchTool = tools.find(t => t.name === 'search_docs');
      expect(unifiedSearchTool).toBeDefined();
    });

    it('should include cli_reference tool (replaces get_cli_command_help and list_cli_commands)', () => {
      const tools = toolHandler.getAvailableTools();
      
      const cliTool = tools.find(t => t.name === 'cli_reference');
      expect(cliTool).toBeDefined();
      expect(cliTool?.inputSchema.properties.command).toBeDefined();
      expect(cliTool?.inputSchema.properties.category).toBeDefined();
    });

    it('should include get_hcl_config_reference tool', () => {
      const tools = toolHandler.getAvailableTools();
      
      const hclTool = tools.find(t => t.name === 'get_hcl_config_reference');
      expect(hclTool).toBeDefined();
    });

    it('should include search_docs tool (replaces get_code_examples)', () => {
      const tools = toolHandler.getAvailableTools();
      
      const unifiedSearchTool = tools.find(t => t.name === 'search_docs');
      expect(unifiedSearchTool).toBeDefined();
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
    it('should have mode parameter for unified search tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_docs');
      
      expect(searchTool?.inputSchema.properties.mode).toBeDefined();
      expect(searchTool?.inputSchema.properties.mode.enum).toEqual(['search', 'list', 'section', 'examples']);
      expect(searchTool?.inputSchema.properties.mode.default).toBe('search');
    });

    it('should have optional page and pageSize parameters for search tool', () => {
      const tools = toolHandler.getAvailableTools();
      const searchTool = tools.find(t => t.name === 'search_docs');
      
      expect(searchTool?.inputSchema.properties.page).toBeDefined();
      expect(searchTool?.inputSchema.properties.page.default).toBe(1);
      expect(searchTool?.inputSchema.properties.pageSize).toBeDefined();
      expect(searchTool?.inputSchema.properties.pageSize.default).toBe(10);
    });

    it('should have query and section parameters for different modes', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'search_docs');
      
      // No schema-level required params (validation is mode-dependent at runtime)
      // 
      // WHY: The required parameters for this tool depend on the value of the 'mode' parameter.
      // JSON Schema cannot express conditional required fields based on the value of another field
      // in a way that is both precise and user-friendly for all clients. Therefore, we perform
      // validation at runtime to provide accurate, mode-specific error messages and to avoid
      // misleading API consumers with overly broad or incorrect schema-level requirements.
      expect(tool?.inputSchema.required).toEqual([]);
      expect(tool?.inputSchema.properties.query).toBeDefined();
      expect(tool?.inputSchema.properties.section).toBeDefined();
    });

    it('should handle edge case pageSize values gracefully', async () => {
      // Verify graceful handling of edge case pageSize values after removing schema constraints
      // Implementation behavior (see calculatePagination in tools.ts):
      // - pageSize > 0: Returns available results (accepts any positive value)
      // - pageSize <= 0: Returns empty results (explicit guard to avoid division by zero or invalid input)
      // This graceful degradation prevents errors while signaling invalid input through empty results
      
      // Test with pageSize=0 (returns empty results per implementation guard)
      const resultTooSmall = await toolHandler.executeTool('search_docs', {
        mode: 'search',
        query: 'test',
        pageSize: 0
      });
      expect(resultTooSmall).toBeDefined();
      expect(resultTooSmall.pagination).toBeDefined();
      expect(resultTooSmall.pagination.pageSize).toBe(0);
      expect(resultTooSmall.results).toEqual([]);
      
      // Test with negative pageSize (returns empty results per implementation guard)
      const resultNegative = await toolHandler.executeTool('search_docs', {
        mode: 'search',
        query: 'test',
        pageSize: -5
      });
      expect(resultNegative).toBeDefined();
      expect(resultNegative.results).toEqual([]);
      
      // Test with excessively large pageSize (should accept but return available results)
      const resultTooLarge = await toolHandler.executeTool('search_docs', {
        mode: 'search',
        query: 'test',
        pageSize: 1000
      });
      expect(resultTooLarge).toBeDefined();
      expect(resultTooLarge.error).toBeUndefined();
      expect(resultTooLarge.pagination).toBeDefined();
      expect(resultTooLarge.pagination.pageSize).toBe(1000);
      // Should return all available results without error
      expect(Array.isArray(resultTooLarge.results)).toBe(true);
      
      // Test with valid pageSize (should return actual results if documents exist)
      const resultValid = await toolHandler.executeTool('search_docs', {
        mode: 'search',
        query: 'test',
        pageSize: 25
      });
      expect(resultValid).toBeDefined();
      expect(resultValid.error).toBeUndefined();
      expect(resultValid.pagination.pageSize).toBe(25);
      // Verify implementation doesn't always return empty arrays - should return results for valid pageSize
      expect(Array.isArray(resultValid.results)).toBe(true);
      // If docs exist for query 'test', results should be non-empty
      // This verifies pageSize > 0 actually returns data, unlike pageSize <= 0
      if (resultValid.pagination.totalItems > 0) {
        expect(resultValid.results.length).toBeGreaterThan(0);
      }
    });

    it('should validate mode-dependent parameters at runtime', async () => {
      // Test that runtime validation enforces mode-specific required params
      
      // Section mode requires 'section' parameter
      const sectionResult = await toolHandler.executeTool('search_docs', { mode: 'section' });
      expect(sectionResult.error).toBeDefined();
      expect(sectionResult.error).toContain('section parameter is required');
      
      // Examples mode (non-advanced) requires 'query' parameter
      const examplesResult = await toolHandler.executeTool('search_docs', { mode: 'examples', advanced: false });
      expect(examplesResult.error).toBeDefined();
      expect(examplesResult.error).toContain('query parameter is required for examples mode');
    });

    it('should have no required parameters for cli_reference (supports dual modes)', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'cli_reference');
      
      // No required params - command is optional (list mode if omitted)
      // WHY: CLI reference tool supports two modes:
      // 1. Get mode: when command parameter is provided
      // 2. List mode: when command is omitted (with optional category/search filters)
      // Making command required would prevent list mode usage.
      expect(tool?.inputSchema.required).toEqual([]);
    });

    it('should not require any parameters for get_hcl_config_reference (supports listBlocks mode)', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'get_hcl_config_reference');
      
      // config is optional - can use listBlocks=true instead
      expect(tool?.inputSchema.required).toEqual([]);
    });

    it('should have optional topic parameter for get_code_examples (advanced mode)', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'search_docs');
      
      // topic is now optional - can use advanced mode without topic
      expect(tool?.inputSchema.required).toEqual([]);
      expect(tool?.inputSchema.properties.advanced).toBeDefined();
      expect(tool?.inputSchema.properties.category).toBeDefined();
      expect(tool?.inputSchema.properties.listCategories).toBeDefined();
    });

    it('should have no required parameters for get_terragrunt_sections', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'search_docs');
      
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

    it('should have optional context parameters for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      // Schema is now flattened - context properties are at top level
      expect(diagnoseTool?.inputSchema.properties.command).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.backend).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.version).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.os).toBeDefined();
    });

    it('should have optional options parameters with defaults for diagnose_terragrunt_error', () => {
      const tools = toolHandler.getAvailableTools();
      const diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      // Schema is now flattened - options properties are at top level
      expect(diagnoseTool?.inputSchema.properties.maxMatches).toBeDefined();
      expect(diagnoseTool?.inputSchema.properties.maxMatches.default).toBe(3);
      expect(diagnoseTool?.inputSchema.properties.minConfidence.default).toBe(0.3);
      expect(diagnoseTool?.inputSchema.properties.enableFuzzyMatching.default).toBe(true);
      expect(diagnoseTool?.inputSchema.properties.enrichWithDocs.default).toBe(false);
    });
  });

  describe('Tool Execution - search_terragrunt_docs', () => {
    it('should execute search with query', async () => {
      const result = await toolHandler.executeTool('search_docs', { mode: 'search', 
        query: 'remote state'
      });
      
      expect(result.query).toBe('remote state');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should apply default pageSize of 10', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test'
      });
      
      expect(result.results.length).toBeLessThanOrEqual(10);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should respect custom pageSize', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test',
        pageSize: 2
      });
      
      expect(result.results.length).toBeLessThanOrEqual(2);
      expect(result.pagination.pageSize).toBe(2);
    });

    it('should truncate long content snippets', async () => {
      const longDoc = {
        ...mockDocs[0],
        content: 'a'.repeat(500)
      };
      mockResourceHandler.searchDocumentation.mockResolvedValueOnce([longDoc]);

      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test'
      });
      
      if (result.results.length > 0) {
        expect(result.results[0].snippet.length).toBeLessThanOrEqual(303); // 300 + '...'
      }
    });

    it('should include pagination metadata in results', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test'
      });
      
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBeDefined();
      expect(result.pagination.hasMore).toBeDefined();
      expect(result.pagination.hasPrevious).toBeDefined();
    });
  });

  describe('Tool Execution - get_terragrunt_sections', () => {
    it('should return all sections', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});
      
      expect(result.sections).toBeDefined();
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.totalSections).toBeDefined();
      expect(result.totalDocs).toBeDefined();
    });

    it('should include doc counts for each section', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});
      
      expect(result.sections.every((s: any) => typeof s.docCount === 'number')).toBe(true);
    });

    it('should work without parameters', async () => {
      await expect(
        toolHandler.executeTool('search_docs', {mode: 'list'})
      ).resolves.toBeDefined();
    });
  });

  describe('Tool Execution - get_section_docs', () => {
    it('should return docs for valid section', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'getting-started',
        detailLevel: 'full'
      });
      
      expect(result.section).toBe('getting-started');
      expect(result.docs).toBeDefined();
      expect(Array.isArray(result.docs)).toBe(true);
    });

    it('should return error for invalid section', async () => {
      mockDocsManager.getDocBySection.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
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

      const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
        section: 'test'
      });
      
      if (result.docs && result.docs.length > 0) {
        expect(result.docs[0].content.length).toBeLessThanOrEqual(503);
      }
    });
  });

  describe('Tool Execution - cli_reference', () => {
    it('should return help for valid command (get mode)', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });
      
      expect(result.command).toBe('plan');
      expect(result.description).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.formattedHelp).toBeDefined();
    });

    it('should return error for invalid command', async () => {
      mockDocsManager.getCliCommandHelp.mockResolvedValueOnce(null);

      const result = await toolHandler.executeTool('cli_reference', {
        command: 'nonexistent'
      });
      
      expect(result.error).toBeDefined();
      expect(result.hint).toBeDefined();
      expect(result.availableCommands).toBeDefined();
    });

    it('should include documentation URL in response', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });
      
      expect(result.documentationUrl).toBeDefined();
    });

    it('should resolve command aliases', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run-all'
      });
      
      expect(result.command).toBe('run');
      expect(result.aliases).toContain('run-all');
    });

    it('should include examples in response', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'plan'
      });
      
      expect(result.examples).toBeDefined();
      expect(result.examples.length).toBeGreaterThan(0);
    });

    it('should include options in response', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        command: 'run'
      });
      
      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options.some((o: any) => o.flag === '--all')).toBe(true);
    });

    it('should list all commands when no command provided (list mode)', async () => {
      const result = await toolHandler.executeTool('cli_reference', {});
      
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
      expect(result.categories).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should filter by category in list mode', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        category: 'main'
      });
      
      expect(result.category).toBe('main');
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
    });

    it('should support search in list mode', async () => {
      const result = await toolHandler.executeTool('cli_reference', {
        search: 'plan'
      });
      
      expect(result.search).toBe('plan');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Tool Execution - get_hcl_config_reference', () => {
    it('should return structured docs for valid config from HCLBlocksManager', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'terraform'
      });
      
      expect(result.config).toBe('terraform');
      expect(result.displayName).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.attributes).toBeDefined();
      expect(result.examples).toBeDefined();
      expect(result.markdown).toBeDefined();
    });

    it('should return error for completely unknown config', async () => {
      mockDocsManager.getHclConfigReference.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'xyznonexistent123abc'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    it('should list all blocks when listBlocks is true', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        listBlocks: true
      });
      
      expect(result.blocks).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.totalBlocks).toBeGreaterThan(10);
    });

    it('should filter blocks by category', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        listBlocks: true,
        category: 'core'
      });
      
      expect(result.blocks).toBeDefined();
      expect(result.blocks.every((b: any) => b.category === 'core')).toBe(true);
    });

    it('should return summary when no parameters provided', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {});
      
      expect(result.message).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.exampleUsage).toBeDefined();
    });

    it('should handle search and return best match', async () => {
      const result = await toolHandler.executeTool('get_hcl_config_reference', {
        config: 'remote'
      });
      
      expect(result.config).toBe('remote_state');
      expect(result.matchInfo).toBeDefined();
      expect(result.matchInfo.matchType).toBe('name');
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

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'terraform',
        detailLevel: 'full'
      });
      
      expect(result.query).toBe('terraform');
      expect(result.examples).toBeDefined();
      expect(Array.isArray(result.examples)).toBe(true);
    });

    it('should return error when no examples found', async () => {
      mockDocsManager.getCodeExamples.mockResolvedValueOnce([]);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'nonexistent'
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

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        detailLevel: 'full'
      });
      
      expect(result.examples.length).toBeLessThanOrEqual(5);
    });

    it('should respect custom limit', async () => {
      const examples = Array.from({ length: 10 }, (_, i) => ({
        doc: mockDocs[0],
        examples: [`example ${i}`]
      }));
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        limit: 3,
        detailLevel: 'full'
      });
      
      expect(result.examples.length).toBeLessThanOrEqual(3);
    });

    it('should truncate long code snippets at 1000 characters', async () => {
      // Realistic HCL code that exceeds 1000 characters
      const longCode = `terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-vpc.git?ref=v5.0.0"
}

include "root" {
  path = find_in_parent_folders()
}

include "env" {
  path = find_in_parent_folders("env.hcl")
  expose = true
  merge_strategy = "deep"
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  environment = local.env_vars.locals.environment
  aws_region = local.region_vars.locals.aws_region
  project_name = "example-project"
}

inputs = {
  name = "\${local.project_name}-\${local.environment}-vpc"
  cidr = "10.0.0.0/16"
  
  azs = ["\${local.aws_region}a", "\${local.aws_region}b", "\${local.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
  
  enable_nat_gateway = true
  single_nat_gateway = false
  one_nat_gateway_per_az = true
  
  enable_dns_hostnames = true
  enable_dns_support = true
  
  tags = {
    Environment = local.environment
    ManagedBy = "Terragrunt"
    Project = local.project_name
  }
}`;
      const examples = [
        {
          doc: { ...mockDocs[0], url: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/' },
          examples: [longCode]
        }
      ];
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        detailLevel: 'full'
      });
      
      expect(result.examples[0].codeSnippets[0]).toContain('# ... [Truncated. See full example at https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/]');
      expect(result.examples[0].codeSnippets[0].length).toBeLessThan(longCode.length);
      expect(result.examples[0].truncated).toBe(true);
      // Verify truncation occurred at a line boundary (complete line)
      const truncated = result.examples[0].codeSnippets[0];
      const lines = truncated.split('\n');
      const lastLineBeforeTruncation = lines[lines.length - 3]; // -1 is empty, -2 is truncation msg, -3 is last code line
      expect(lastLineBeforeTruncation).toBeDefined();
      expect(lastLineBeforeTruncation.trim()).not.toBe(''); // Should be a complete line
      // Verify it's not mid-word by checking it doesn't end with incomplete syntax
      expect(lastLineBeforeTruncation).toMatch(/^\s*[\w\s"'={}\[\]\(\).,:\-\/]*$/); // Valid HCL line pattern
    });

    it('should not truncate short code snippets', async () => {
      const shortCode = 'terraform { source = "..." }';
      const examples = [
        {
          doc: { ...mockDocs[0], url: 'https://example.com/docs/test' },
          examples: [shortCode]
        }
      ];
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        detailLevel: 'full'
      });
      
      expect(result.examples[0].codeSnippets[0]).toBe(shortCode);
      expect(result.examples[0].codeSnippets[0]).not.toContain('Truncated');
      expect(result.examples[0].truncated).toBe(false);
    });

    it('should handle mixed length code snippets', async () => {
      const shortCode = 'terraform { source = "..." }';
      const longCode = 'a'.repeat(1200);
      const examples = [
        {
          doc: { ...mockDocs[0], url: 'https://example.com/docs/test' },
          examples: [shortCode, longCode]
        }
      ];
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        detailLevel: 'full'
      });
      
      expect(result.examples[0].codeSnippets[0]).toBe(shortCode);
      expect(result.examples[0].codeSnippets[1]).toContain('Truncated');
      expect(result.examples[0].truncated).toBe(true);
    });

    it('should truncate advanced example code', async () => {
      const longCode = 'b'.repeat(1500);
      
      // Mock the advanced examples manager
      const mockAdvancedExamplesManager = {
        searchExamples: vi.fn().mockReturnValueOnce([
          {
            example: {
              id: 'test-1',
              name: 'Test Example',
              description: 'A test example',
              category: 'backend' as AdvancedExampleCategory,
              complexity: 'intermediate' as AdvancedExampleComplexity,
              code: longCode,
              useCases: ['testing'],
              bestPractices: [],
              pitfalls: [],
              relatedExamples: [],
              tags: ['test'],
              docsUrl: 'https://terragrunt.gruntwork.io/docs/examples/backend-configuration/'
            },
            matchType: 'exact',
            score: 100
          }
        ]),
        formatExampleAsMarkdown: vi.fn().mockReturnValue('# Markdown')
      };
      (toolHandler as any).advancedExamplesManager = mockAdvancedExamplesManager;

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        advanced: true,
        detailLevel: 'full'
      });
      
      expect(result.example.code).toContain('# ... [Truncated. See full example at https://terragrunt.gruntwork.io/docs/examples/backend-configuration/]');
      expect(result.example.code.length).toBeLessThan(longCode.length);
      expect(result.example.codeTruncated).toBe(true);
    });

    it('should not truncate short advanced example code', async () => {
      const shortCode = 'terraform { source = "..." }';
      
      // Mock the advanced examples manager
      const mockAdvancedExamplesManager = {
        searchExamples: vi.fn().mockReturnValueOnce([
          {
            example: {
              id: 'test-1',
              name: 'Test Example',
              description: 'A test example',
              category: 'backend' as AdvancedExampleCategory,
              complexity: 'intermediate' as AdvancedExampleComplexity,
              code: shortCode,
              useCases: ['testing'],
              bestPractices: [],
              pitfalls: [],
              relatedExamples: [],
              tags: ['test'],
              docsUrl: 'https://terragrunt.gruntwork.io/docs/examples/dependencies/'
            },
            matchType: 'exact',
            score: 100
          }
        ]),
        formatExampleAsMarkdown: vi.fn().mockReturnValue('# Markdown')
      };
      (toolHandler as any).advancedExamplesManager = mockAdvancedExamplesManager;

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        advanced: true,
        detailLevel: 'full'
      });
      
      expect(result.example.code).toBe(shortCode);
      expect(result.example.code).not.toContain('Truncated');
      expect(result.example.codeTruncated).toBe(false);
    });

    it('should include valid doc URL in truncation message', async () => {
      const longCode = 'c'.repeat(1100);
      const docUrl = 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/';
      const examples = [
        {
          doc: { ...mockDocs[0], url: docUrl },
          examples: [longCode]
        }
      ];
      mockDocsManager.getCodeExamples.mockResolvedValueOnce(examples);

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        detailLevel: 'full'
      });
      
      expect(result.examples[0].codeSnippets[0]).toContain(`# ... [Truncated. See full example at ${docUrl}]`);
    });

    it('should handle missing docsUrl with fallback message', async () => {
      const longCode = 'd'.repeat(1100);
      
      // Mock the advanced examples manager with no docsUrl
      const mockAdvancedExamplesManager = {
        searchExamples: vi.fn().mockReturnValueOnce([
          {
            example: {
              id: 'test-1',
              name: 'Test Example',
              description: 'A test example',
              category: 'backend' as AdvancedExampleCategory,
              complexity: 'intermediate' as AdvancedExampleComplexity,
              code: longCode,
              useCases: ['testing'],
              bestPractices: [],
              pitfalls: [],
              relatedExamples: [],
              tags: ['test'],
              docsUrl: '' // Empty URL
            },
            matchType: 'exact',
            score: 100
          }
        ]),
        formatExampleAsMarkdown: vi.fn().mockReturnValue('# Markdown')
      };
      (toolHandler as any).advancedExamplesManager = mockAdvancedExamplesManager;

      const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
        query: 'test',
        advanced: true,
        detailLevel: 'full'
      });
      
      expect(result.example.code).toContain('# ... [Truncated. See full example in documentation]');
      expect(result.example.codeTruncated).toBe(true);
    });
  });

  describe('Tool Execution - function_reference (GET mode)', () => {
    it('should default to list mode when function_name is missing', async () => {
      const result = await toolHandler.executeTool('function_reference', {});
      
      // Should return list mode response, not an error
      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
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

      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'get_env',
        mode: 'full'
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

      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'get_env',
        include_examples: false,
        mode: 'full'
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

      const result = await toolHandler.executeTool('function_reference', {
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

      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'nonexistent_function'
      });
      
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('function_reference');
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

      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'test_func',
        mode: 'full'
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

  describe('Tool Execution - function_reference (LIST mode)', () => {
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

      const result = await toolHandler.executeTool('function_reference', {});
      
      expect(result.functions).toBeDefined();
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.functions.length).toBe(2);
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
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

      const result = await toolHandler.executeTool('function_reference', {
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

      const result = await toolHandler.executeTool('function_reference', {
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

      const result = await toolHandler.executeTool('function_reference', {
        search: 'get',
        category: 'env'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(1);
      expect(result.functions[0].category).toBe('env');
      expect(mockFunctionsManager.searchFunctions).toHaveBeenCalledWith('get');
    });

    it('should respect pageSize parameter', async () => {
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

      const result = await toolHandler.executeTool('function_reference', {
        pageSize: 10
      });
      
      expect(result.functions.length).toBe(10);
      expect(result.pagination.totalItems).toBe(100);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasMore).toBe(true);
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

      const result = await toolHandler.executeTool('function_reference', {});
      
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

      const result = await toolHandler.executeTool('function_reference', {});
      
      expect(result).toHaveProperty('functions');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('pagination');
      
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

      const result = await toolHandler.executeTool('function_reference', {
        search: 'nonexistent'
      });
      
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBe(0);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.categories).toBeDefined();
    });

    it('should support pagination - page 2', async () => {
      const mockFunctions = Array.from({ length: 50 }, (_, i) => ({
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

      const result = await toolHandler.executeTool('function_reference', {
        page: 2,
        pageSize: 20
      });
      
      expect(result.functions.length).toBe(20);
      expect(result.functions[0].name).toBe('func_20'); // Second page starts at index 20
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should handle last page correctly', async () => {
      const mockFunctions = Array.from({ length: 25 }, (_, i) => ({
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

      const result = await toolHandler.executeTool('function_reference', {
        page: 2,
        pageSize: 20
      });
      
      expect(result.functions.length).toBe(5); // Only 5 items on last page
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should handle out-of-range page gracefully', async () => {
      const mockFunctions = Array.from({ length: 10 }, (_, i) => ({
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

      const result = await toolHandler.executeTool('function_reference', {
        page: 10,
        pageSize: 20
      });
      
      expect(result.functions.length).toBe(0); // Out of range
      expect(result.pagination.totalItems).toBe(10);
      expect(result.pagination.page).toBe(10);
      expect(result.pagination.hasMore).toBe(false);
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

      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});
      
      expect(result.error).toBeDefined();
    });

    it('should not throw on internal errors', async () => {
      mockResourceHandler.searchDocumentation.mockRejectedValueOnce(new Error('Search failed'));

      await expect(
        toolHandler.executeTool('search_docs', {mode: 'search',  query: 'test' })
      ).resolves.toBeDefined();
    });
  });

  describe('Response Format Validation', () => {
    it('should return JSON-serializable results', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'list'});
      
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should include helpful metadata in responses', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
        query: 'test'
      });
      
      expect(result.query).toBe('test');
      expect(result.pagination).toBeDefined();
      expect(typeof result.pagination.totalItems).toBe('number');
      expect(typeof result.pagination.hasMore).toBe('boolean');
    });

    it('should format results consistently', async () => {
      const result = await toolHandler.executeTool('search_docs', {mode: 'search', 
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
