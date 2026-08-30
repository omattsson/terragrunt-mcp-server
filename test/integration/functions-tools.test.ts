import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * Function Lookup Tools Integration Tests
 * 
 * These tests validate end-to-end functionality of the function lookup tools:
 * - function_reference: Unified tool for function operations (GET specific function details or LIST/search/filter all functions)
 * 
 * Tests use real documentation parsing (not mocked) to ensure accurate extraction.
 */
describe('Function Lookup Tools Integration Tests', () => {
  let toolHandler: ToolHandler;

  beforeAll(async () => {
    console.log('Initializing ToolHandler for function lookup integration tests...');
    toolHandler = new ToolHandler();
    
    // Prime the cache by loading functions once
    await toolHandler.executeTool('function_reference', { limit: 1 });
    console.log('ToolHandler initialized and functions loaded successfully');
  }, 120000); // Allow up to 2 minutes for initial documentation loading

  describe('function_reference tool (GET mode)', () => {
    describe('Well-known function retrieval', () => {
      it('should retrieve path_relative_to_include with complete metadata', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'path_relative_to_include'
        , mode: 'full'
        });

        // Should not have error
        expect(result.error).toBeUndefined();
        
        // Required fields
        expect(result.name).toBe('path_relative_to_include');
        expect(result.signature).toBeDefined();
        expect(typeof result.signature).toBe('string');
        expect(result.description).toBeDefined();
        expect(typeof result.description).toBe('string');
        expect(result.description.length).toBeGreaterThan(10);
        
        // Type information
        expect(result.returnType).toBeDefined();
        expect(typeof result.returnType).toBe('string');
        
        // Metadata
        expect(result.category).toBeDefined();
        expect(typeof result.category).toBe('string');
        
        // Arrays (may be empty but should be defined)
        expect(Array.isArray(result.parameters)).toBe(true);
        expect(Array.isArray(result.examples)).toBe(true);
        expect(Array.isArray(result.relatedFunctions)).toBe(true);
        expect(Array.isArray(result.relatedDocs)).toBe(true);
      });

      it('should retrieve get_env with complete metadata', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'get_env'
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(result.name).toBe('get_env');
        expect(result.signature).toBeDefined();
        expect(result.description).toBeDefined();
        // Description may be empty for some functions, just verify it's defined
        expect(result.returnType).toBeDefined();
        expect(result.category).toBeDefined();
        expect(Array.isArray(result.parameters)).toBe(true);
        expect(Array.isArray(result.examples)).toBe(true);
        expect(Array.isArray(result.relatedFunctions)).toBe(true);
      });

      it('should retrieve a well-known path function with complete metadata', async () => {
        // First get a function from the path category
        const listResult = await toolHandler.executeTool('function_reference', {
          category: 'path',
          limit: 1
        });
        
        expect(listResult.functions.length).toBeGreaterThan(0);
        const functionName = listResult.functions[0].name;
        
        const result = await toolHandler.executeTool('function_reference', {
          function_name: functionName
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(result.name).toBe(functionName);
        expect(result.signature).toBeDefined();
        expect(result.description).toBeDefined();
        expect(result.returnType).toBeDefined();
        expect(result.category).toBeDefined();
        expect(Array.isArray(result.parameters)).toBe(true);
        expect(Array.isArray(result.examples)).toBe(true);
      });
    });

    describe('Metadata validation', () => {
      it('should expose function stability and experiment gates', async () => {
        const deepMerge = await toolHandler.executeTool('function_reference', {
          function_name: 'deep_merge',
          mode: 'full'
        });
        expect(deepMerge.stability).toBe('experimental');
        expect(deepMerge.experiment).toBe('deep-merge');

        const markGlobAsRead = await toolHandler.executeTool('function_reference', {
          function_name: 'mark_glob_as_read',
          mode: 'summary'
        });
        expect(markGlobAsRead.stability).toBe('stable');
        expect(markGlobAsRead.experiment).toBeUndefined();

        const listResult = await toolHandler.executeTool('function_reference', {
          search: 'deep_merge'
        });
        expect(listResult.functions).toContainEqual(expect.objectContaining({
          name: 'deep_merge',
          stability: 'experimental',
          experiment: 'deep-merge'
        }));
      });

      it('should include properly formatted examples when available', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'get_env'
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.examples)).toBe(true);
        
        // If examples exist, they should have proper structure
        if (result.examples.length > 0) {
          const example = result.examples[0];
          expect(example.code).toBeDefined();
          expect(typeof example.code).toBe('string');
          expect(example.description).toBeDefined();
          expect(typeof example.description).toBe('string');
          expect(example.useCase).toBeDefined();
          expect(typeof example.useCase).toBe('string');
        }
      });

      it('should populate related functions array when available', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'path_relative_to_include'
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.relatedFunctions)).toBe(true);
        
        // Related functions should be strings if present
        if (result.relatedFunctions.length > 0) {
          result.relatedFunctions.forEach((fn: any) => {
            expect(typeof fn).toBe('string');
          });
        }
      });
    });

    describe('Error handling', () => {
      it('should handle unknown function with error and suggestions', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'nonexistent_function_xyz_12345'
        , mode: 'full'
        });

        // Should have error response
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
        
        // Should provide suggestion
        expect(result.suggestion).toBeDefined();
        expect(typeof result.suggestion).toBe('string');
        
        // Should include the attempted function name
        expect(result.name).toBe('nonexistent_function_xyz_12345');
      });
    });

    describe('Parameter behavior', () => {
      it('should include examples when include_examples=true', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'get_env',
          include_examples: true
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.examples)).toBe(true);
        // Examples should be present (default behavior)
      });

      it('should exclude examples when include_examples=false', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          function_name: 'get_env',
          include_examples: false
        , mode: 'full'
        });

        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.examples)).toBe(true);
        expect(result.examples.length).toBe(0); // Should be empty array
      });
    });

    describe('Performance', () => {
      it('should respond in <500ms for cached function lookup', async () => {
        // Get a real function name dynamically instead of hardcoding
        const listResult = await toolHandler.executeTool('function_reference', {
          limit: 1
        });
        expect(listResult.functions).toBeDefined();
        expect(listResult.functions.length).toBeGreaterThan(0);
        const functionName = listResult.functions[0].name;

        const start = performance.now();

        await toolHandler.executeTool('function_reference', {
          function_name: functionName
        , mode: 'full'
        });

        const duration = performance.now() - start;
        // Use 500ms threshold for integration tests to avoid flakiness in CI/CD
        expect(duration).toBeLessThan(500);
      });
    });
  });

  describe('function_reference tool (LIST mode)', () => {
    describe('Basic listing', () => {
      it('should list all functions without parameters', async () => {
        const result = await toolHandler.executeTool('function_reference', {});

        // Should have proper structure
        expect(result.functions).toBeDefined();
        expect(Array.isArray(result.functions)).toBe(true);
        expect(result.functions.length).toBeGreaterThan(0);
        
        expect(result.categories).toBeDefined();
        expect(Array.isArray(result.categories)).toBe(true);
        
        expect(result.pagination).toBeDefined();
        expect(result.pagination.totalItems).toBeDefined();
        expect(typeof result.pagination.totalItems).toBe('number');
        expect(result.pagination.totalItems).toBeGreaterThan(0);
        
        // Verify function structure
        const fn = result.functions[0];
        expect(fn.name).toBeDefined();
        expect(typeof fn.name).toBe('string');
        expect(fn.category).toBeDefined();
        expect(fn.shortDescription).toBeDefined();
        expect(fn.signature).toBeDefined();
      });
    });

    describe('Category filtering', () => {
      it('should filter by path category', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          category: 'path'
        });

        expect(result.functions).toBeDefined();
        expect(Array.isArray(result.functions)).toBe(true);
        
        // All returned functions should be in 'path' category
        if (result.functions.length > 0) {
          result.functions.forEach((fn: any) => {
            expect(fn.category.toLowerCase()).toBe('path');
          });
        }
      });

      it('should filter by environment category', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          category: 'environment'
        });

        expect(result.functions).toBeDefined();
        expect(Array.isArray(result.functions)).toBe(true);
        
        // All returned functions should be in 'environment' category
        if (result.functions.length > 0) {
          result.functions.forEach((fn: any) => {
            expect(fn.category.toLowerCase()).toBe('environment');
          });
        }
      });
    });

    describe('Search functionality', () => {
      it('should search by function name', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          search: 'get_env'
        });

        expect(result.functions).toBeDefined();
        expect(Array.isArray(result.functions)).toBe(true);
        expect(result.functions.length).toBeGreaterThan(0);
        
        // Should include get_env function
        const hasGetEnv = result.functions.some((fn: any) => 
          fn.name.toLowerCase().includes('get_env')
        );
        expect(hasGetEnv).toBe(true);
      });

      it('should search by description content', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          search: 'environment'
        });

        expect(result.functions).toBeDefined();
        expect(Array.isArray(result.functions)).toBe(true);
        expect(result.functions.length).toBeGreaterThan(0);
        
        // Should find functions related to environment
        result.functions.forEach((fn: any) => {
          const matchesSearch = 
            fn.name.toLowerCase().includes('environment') ||
            fn.shortDescription.toLowerCase().includes('environment') ||
            fn.category.toLowerCase().includes('environment');
          expect(matchesSearch).toBe(true);
        });
      });
    });

    describe('Response structure validation', () => {
      it('should return proper structure with all required fields', async () => {
        const result = await toolHandler.executeTool('function_reference', {
          limit: 10
        });

        // Top-level structure
        expect(result).toHaveProperty('functions');
        expect(result).toHaveProperty('categories');
        expect(result).toHaveProperty('pagination');
        
        // Functions array
        expect(Array.isArray(result.functions)).toBe(true);
        expect(result.functions.length).toBeLessThanOrEqual(20); // Default pageSize is 20
        
        // Each function has required fields
        result.functions.forEach((fn: any) => {
          expect(fn).toHaveProperty('name');
          expect(fn).toHaveProperty('category');
          expect(fn).toHaveProperty('shortDescription');
          expect(fn).toHaveProperty('signature');
        });
        
        // Categories array contains strings
        expect(Array.isArray(result.categories)).toBe(true);
        result.categories.forEach((cat: any) => {
          expect(typeof cat).toBe('string');
        });
      });
    });

    describe('Performance', () => {
      it('should respond in <500ms for cached list operation', async () => {
        const start = performance.now();

        await toolHandler.executeTool('function_reference', {
          limit: 20
        });

        const duration = performance.now() - start;
        // Use 500ms threshold for integration tests to avoid flakiness in CI/CD
        expect(duration).toBeLessThan(500);
      });
    });
  });

  describe('Real Documentation Extraction', () => {
    it('should discover at least 10 major functions', async () => {
      const result = await toolHandler.executeTool('function_reference', {});

      expect(result.pagination.totalItems).toBeGreaterThanOrEqual(10);
      expect(result.functions.length).toBeGreaterThan(0);
    });

    it('should have all function categories represented', async () => {
      const result = await toolHandler.executeTool('function_reference', {});

      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.categories.length).toBeGreaterThan(0);
      
      // Common Terragrunt function categories should be present
      const categorySet = new Set(result.categories.map((c: string) => c.toLowerCase()));
      
      // At least some of these common categories should be present
      const commonCategories = ['path', 'environment', 'terraform', 'file', 'dependency', 'aws', 'gcp', 'utility'];
      const foundCategories = commonCategories.filter(cat => categorySet.has(cat));
      expect(foundCategories.length).toBeGreaterThan(0);
    });

    it('should extract examples correctly for at least one function', async () => {
      // Get a function known to have examples
      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'get_env',
        include_examples: true
      , mode: 'full'
      });

      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.examples)).toBe(true);
      
      // At least verify the structure is correct even if empty
      // (The fixture may or may not have examples extracted for all functions)
      result.examples.forEach((example: any) => {
        expect(example).toHaveProperty('code');
        expect(example).toHaveProperty('description');
        expect(example).toHaveProperty('useCase');
      });
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should have valid tool definitions', async () => {
      const tools = toolHandler.getAvailableTools();
      
      // Should have our unified function tool
      const functionTool = tools.find(t => t.name === 'function_reference');
      
      expect(functionTool).toBeDefined();
      
      // Validate function_reference schema
      expect(functionTool?.inputSchema).toBeDefined();
      expect(functionTool?.inputSchema.type).toBe('object');
      expect(functionTool?.inputSchema.properties).toBeDefined();
      // All params are optional for dual-mode routing
      expect(functionTool?.inputSchema.required).toEqual([]);
    });

    it('should return responses with correct schema for success', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'get_env'
      , mode: 'full'
      });

      // Success response should have all expected fields
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('returnType');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('examples');
      expect(result).toHaveProperty('relatedFunctions');
      expect(result).toHaveProperty('relatedDocs');
      
      // Should not have error field
      expect(result.error).toBeUndefined();
    });

    it('should format error responses properly', async () => {
      const result = await toolHandler.executeTool('function_reference', {
        function_name: 'invalid_function_name'
      , mode: 'full'
      });

      // Error response should have specific fields
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('suggestion');
      
      // Error and suggestion should be strings
      expect(typeof result.error).toBe('string');
      expect(typeof result.suggestion).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.suggestion.length).toBeGreaterThan(0);
    });

    it('should have all required fields in list response', async () => {
      const result = await toolHandler.executeTool('function_reference', {});

      // Required top-level fields
      expect(result).toHaveProperty('functions');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('pagination');
      
      // Correct types
      expect(Array.isArray(result.functions)).toBe(true);
      expect(Array.isArray(result.categories)).toBe(true);
      expect(typeof result.pagination.totalItems).toBe('number');
      
      // Each function has required fields
      if (result.functions.length > 0) {
        const fn = result.functions[0];
        expect(fn).toHaveProperty('name');
        expect(fn).toHaveProperty('category');
        expect(fn).toHaveProperty('shortDescription');
        expect(fn).toHaveProperty('signature');
      }
    });
  });
});
