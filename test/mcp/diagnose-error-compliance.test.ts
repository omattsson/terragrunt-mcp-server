import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * MCP Protocol Compliance Tests for diagnose_terragrunt_error Tool
 * 
 * These tests validate that the diagnose_terragrunt_error tool correctly implements
 * the Model Context Protocol (MCP) specification, including:
 * - Tool registration and schema validation
 * - Request/response format compliance
 * - Error handling and edge cases
 * - Tool metadata (name, description, input schema)
 * - JSON-RPC 2.0 compliance
 * 
 * Reference: MCP Specification for Tool definitions
 */
describe('MCP Protocol Compliance - diagnose_terragrunt_error', () => {
  let toolHandler: ToolHandler;
  let diagnoseTool: ReturnType<typeof toolHandler.getAvailableTools>[0] | undefined;

  beforeAll(() => {
    toolHandler = new ToolHandler();
    const tools = toolHandler.getAvailableTools();
    diagnoseTool = tools.find(t => t.name === 'diagnose_terragrunt_error');
  });

  // ==================== Tool Definition in ListTools (5 tests) ====================
  describe('Tool Definition in ListTools', () => {
    it('should include diagnose_terragrunt_error in available tools', () => {
      const tools = toolHandler.getAvailableTools();
      const tool = tools.find(t => t.name === 'diagnose_terragrunt_error');
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('diagnose_terragrunt_error');
    });

    it('should have valid JSON Schema for inputSchema', () => {
      expect(diagnoseTool?.inputSchema).toBeDefined();
      expect(diagnoseTool?.inputSchema.type).toBe('object');
      expect(diagnoseTool?.inputSchema.properties).toBeDefined();
      expect(typeof diagnoseTool?.inputSchema.properties).toBe('object');
    });

    it('should define error_message as required string parameter', () => {
      const errorMessageProp = diagnoseTool?.inputSchema.properties.error_message;
      
      expect(errorMessageProp).toBeDefined();
      expect(errorMessageProp.type).toBe('string');
      expect(errorMessageProp.description).toBeDefined();
      expect(typeof errorMessageProp.description).toBe('string');
      
      // Should be in required array
      expect(diagnoseTool?.inputSchema.required).toContain('error_message');
    });

    it('should define context as optional object with nested properties', () => {
      const contextProp = diagnoseTool?.inputSchema.properties.context;
      
      expect(contextProp).toBeDefined();
      expect(contextProp.type).toBe('object');
      expect(contextProp.description).toBeDefined();
      
      // Context should have nested properties
      expect(contextProp.properties).toBeDefined();
      expect(contextProp.properties.command).toBeDefined();
      expect(contextProp.properties.version).toBeDefined();
      expect(contextProp.properties.os).toBeDefined();
      expect(contextProp.properties.filePath).toBeDefined();
      expect(contextProp.properties.module).toBeDefined();
      expect(contextProp.properties.backend).toBeDefined();
      
      // Context should NOT be in required array
      const required = diagnoseTool?.inputSchema.required || [];
      expect(required.includes('context')).toBe(false);
    });

    it('should define options as optional object with defaults', () => {
      const optionsProp = diagnoseTool?.inputSchema.properties.options;
      
      expect(optionsProp).toBeDefined();
      expect(optionsProp.type).toBe('object');
      expect(optionsProp.description).toBeDefined();
      
      // Options should have nested properties with defaults
      expect(optionsProp.properties).toBeDefined();
      expect(optionsProp.properties.maxMatches).toBeDefined();
      expect(optionsProp.properties.maxMatches.default).toBe(3);
      expect(optionsProp.properties.minConfidence).toBeDefined();
      expect(optionsProp.properties.minConfidence.default).toBe(0.3);
      expect(optionsProp.properties.enableFuzzyMatching).toBeDefined();
      expect(optionsProp.properties.enableFuzzyMatching.default).toBe(true);
      expect(optionsProp.properties.enrichWithDocs).toBeDefined();
      expect(optionsProp.properties.enrichWithDocs.default).toBe(false);
      expect(optionsProp.properties.includeDestructiveCommands).toBeDefined();
      expect(optionsProp.properties.includeDestructiveCommands.default).toBe(true);
      
      // Options should NOT be in required array
      const required = diagnoseTool?.inputSchema.required || [];
      expect(required.includes('options')).toBe(false);
    });
  });

  // ==================== Input Schema Validation (6 tests) ====================
  describe('Input Schema Validation', () => {
    it('should validate required error_message parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {});
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('error_message');
      expect(result.error).toContain('required');
    });

    it('should accept error_message as only parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept optional context parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed',
        context: {
          command: 'terragrunt apply',
          backend: 's3'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept optional options parameter', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed',
        options: {
          maxMatches: 5,
          minConfidence: 0.5
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate context property types when provided', () => {
      const contextProp = diagnoseTool?.inputSchema.properties.context;
      expect(contextProp).toBeDefined();
      
      // All context properties should be strings
      expect(contextProp.properties.command.type).toBe('string');
      expect(contextProp.properties.version.type).toBe('string');
      expect(contextProp.properties.os.type).toBe('string');
      expect(contextProp.properties.filePath.type).toBe('string');
      expect(contextProp.properties.module.type).toBe('string');
      expect(contextProp.properties.backend.type).toBe('string');
    });

    it('should validate options property types', () => {
      const optionsProp = diagnoseTool?.inputSchema.properties.options;
      expect(optionsProp).toBeDefined();
      
      expect(optionsProp.properties.maxMatches.type).toBe('number');
      expect(optionsProp.properties.minConfidence.type).toBe('number');
      expect(optionsProp.properties.enableFuzzyMatching.type).toBe('boolean');
      expect(optionsProp.properties.enrichWithDocs.type).toBe('boolean');
      expect(optionsProp.properties.includeDestructiveCommands.type).toBe('boolean');
    });
  });

  // ==================== Request/Response Format (5 tests) ====================
  describe('Request/Response Format Compliance', () => {
    it('should execute successfully with minimal params', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: No Terraform configuration files found'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.success).toBe(true);
    });

    it('should execute with full context and options', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed since last init',
        context: {
          command: 'terragrunt apply',
          version: '0.50.0',
          os: 'darwin',
          filePath: '/path/to/terragrunt.hcl',
          module: 'vpc',
          backend: 's3'
        },
        options: {
          maxMatches: 5,
          minConfidence: 0.4,
          enableFuzzyMatching: true,
          enrichWithDocs: false,
          includeDestructiveCommands: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return MCP-compliant success response structure', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: State lock acquisition failed'
      });

      // MCP tool responses must be objects
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      
      // Should have success indicator
      expect('success' in result).toBe(true);
      expect(typeof result.success).toBe('boolean');
    });

    it('should include all DiagnosisResult fields', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      // Verify all required response fields exist
      expect('success' in result).toBe(true);
      expect('overallConfidence' in result).toBe(true);
      expect('matchCount' in result).toBe(true);
      expect('matches' in result).toBe(true);
      expect('debuggingSteps' in result).toBe(true);
      expect('generalAdvice' in result).toBe(true);
    });

    it('should include enriched fields when enrichWithDocs is enabled', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed',
        options: { enrichWithDocs: true }
      });

      expect('richSolutions' in result).toBe(true);
      expect('orderedDebuggingSteps' in result).toBe(true);
      expect('documentationLinks' in result).toBe(true);
      expect('relatedErrorDetails' in result).toBe(true);
      expect('enrichmentSuccessful' in result).toBe(true);
    });

    it('should handle concurrent executions correctly', async () => {
      const promises = [
        toolHandler.executeTool('diagnose_terragrunt_error', {
          error_message: 'Error: Backend configuration changed'
        }),
        toolHandler.executeTool('diagnose_terragrunt_error', {
          error_message: 'Error: State lock acquisition failed'
        }),
        toolHandler.executeTool('diagnose_terragrunt_error', {
          error_message: 'Error: Module not found'
        })
      ];

      const results = await Promise.all(promises);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  // ==================== Response Structure Validation (6 tests) ====================
  describe('Response Structure Validation', () => {
    it('should return success boolean', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(typeof result.success).toBe('boolean');
      expect(result.success).toBe(true);
    });

    it('should return overallConfidence in 0-1 range', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(typeof result.overallConfidence).toBe('number');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should return matchCount as number', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(typeof result.matchCount).toBe('number');
      expect(result.matchCount).toBeGreaterThanOrEqual(0);
    });

    it('should return matches array with correct structure', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(Array.isArray(result.matches)).toBe(true);
      
      if (result.matches.length > 0) {
        const match = result.matches[0];
        
        // Verify match structure
        expect('patternId' in match).toBe(true);
        expect('patternName' in match).toBe(true);
        expect('category' in match).toBe(true);
        expect('confidence' in match).toBe(true);
        expect('description' in match).toBe(true);
        expect('likelyCause' in match).toBe(true);
        expect('solutions' in match).toBe(true);
        expect('documentationRefs' in match).toBe(true);
        
        // Verify types
        expect(typeof match.patternId).toBe('string');
        expect(typeof match.patternName).toBe('string');
        expect(typeof match.category).toBe('string');
        expect(typeof match.confidence).toBe('number');
        expect(typeof match.description).toBe('string');
        expect(typeof match.likelyCause).toBe('string');
        expect(Array.isArray(match.solutions)).toBe(true);
        expect(Array.isArray(match.documentationRefs)).toBe(true);
      }
    });

    it('should return debuggingSteps array', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(Array.isArray(result.debuggingSteps)).toBe(true);
      
      result.debuggingSteps.forEach((step: unknown) => {
        expect(typeof step).toBe('string');
      });
    });

    it('should return generalAdvice array', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      expect(Array.isArray(result.generalAdvice)).toBe(true);
      
      result.generalAdvice.forEach((advice: unknown) => {
        expect(typeof advice).toBe('string');
      });
    });
  });

  // ==================== Error Handling Compliance (6 tests) ====================
  describe('Error Handling Compliance', () => {
    it('should return error for missing error_message', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {});

      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error).toContain('error_message');
    });

    it('should return error object and not throw for invalid input', async () => {
      // Test with various invalid inputs - should all return error objects, not throw
      const testCases = [
        {},
        { error_message: '' },
        { context: {} }, // missing error_message
      ];

      for (const testCase of testCases) {
        const result = await toolHandler.executeTool('diagnose_terragrunt_error', testCase);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        // Should have either success=true or error property
        expect(result.success === true || result.error !== undefined).toBe(true);
      }
    });

    it('should provide helpful error messages', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {});

      expect(result.error).toBeDefined();
      expect(result.error.length).toBeGreaterThan(10); // Should be descriptive
      expect(result.error).toContain('required'); // Should explain what's wrong
    });

    it('should not expose internal errors to clients', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: null as unknown as string // Test null handling - should be caught by required validation
      });

      // Should return safe error message
      if (result.error) {
        expect(result.error).not.toContain('stack');
        expect(result.error).not.toContain('at Object');
        expect(result.error).not.toContain('TypeError');
      }
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const resultNull = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: null as unknown as string
      });
      
      const resultUndefined = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: undefined as unknown as string
      });

      // Both should handle gracefully without throwing
      expect(resultNull).toBeDefined();
      expect(resultUndefined).toBeDefined();
    });

    it('should handle malformed context/options gracefully', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Test error',
        context: 'invalid' as unknown as object, // Should be object, not string
        options: 123 as unknown as object // Should be object, not number
      });

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  // ==================== JSON-RPC 2.0 Compliance (4 tests) ====================
  describe('JSON-RPC 2.0 Compliance', () => {
    it('should return JSON-serializable responses', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });

      // Should be serializable to JSON without throwing
      expect(() => JSON.stringify(result)).not.toThrow();
      
      // Should round-trip correctly
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(result);
    });

    it('should not return circular references', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: State lock acquisition failed',
        context: {
          command: 'terragrunt apply',
          backend: 's3'
        },
        options: {
          maxMatches: 5,
          enrichWithDocs: true
        }
      });

      // JSON.stringify throws on circular references
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should return consistent field types across calls', async () => {
      const result1 = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed'
      });
      
      const result2 = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Module not found'
      });

      // Both should have same structure/types
      expect(typeof result1.success).toBe(typeof result2.success);
      expect(typeof result1.overallConfidence).toBe(typeof result2.overallConfidence);
      expect(typeof result1.matchCount).toBe(typeof result2.matchCount);
      expect(Array.isArray(result1.matches)).toBe(Array.isArray(result2.matches));
      expect(Array.isArray(result1.debuggingSteps)).toBe(Array.isArray(result2.debuggingSteps));
      expect(Array.isArray(result1.generalAdvice)).toBe(Array.isArray(result2.generalAdvice));
    });

    it('should handle edge case inputs and return valid JSON', async () => {
      const edgeCases = [
        { error_message: '' }, // Empty string
        { error_message: 'x' }, // Single char
        { error_message: 'Error: ' + 'x'.repeat(10000) }, // Very long string
        { error_message: 'Error: Special chars: \n\t\r"\'\\' }, // Special chars
        { error_message: 'Error: Unicode: 日本語 한국어 العربية' }, // Unicode
      ];

      for (const testCase of edgeCases) {
        const result = await toolHandler.executeTool('diagnose_terragrunt_error', testCase);
        
        expect(result).toBeDefined();
        expect(() => JSON.stringify(result)).not.toThrow();
      }
    });
  });

  // ==================== Tool Metadata Validation (4 tests) ====================
  describe('Tool Metadata Validation', () => {
    it('should have snake_case tool name', () => {
      expect(diagnoseTool?.name).toBe('diagnose_terragrunt_error');
      expect(diagnoseTool?.name).toMatch(/^[a-z][a-z0-9_]*$/);
    });

    it('should have descriptive name under 50 chars', () => {
      expect(diagnoseTool?.name).toBeDefined();
      expect(diagnoseTool?.name.length).toBeLessThan(50);
      expect(diagnoseTool?.name.length).toBeGreaterThan(5);
    });

    it('should have helpful description 10-500 chars', () => {
      expect(diagnoseTool?.description).toBeDefined();
      expect(typeof diagnoseTool?.description).toBe('string');
      expect(diagnoseTool?.description.length).toBeGreaterThan(10);
      expect(diagnoseTool?.description.length).toBeLessThan(500);
      
      // Description should mention key functionality
      expect(diagnoseTool?.description.toLowerCase()).toContain('diagnose');
      expect(diagnoseTool?.description.toLowerCase()).toContain('error');
    });

    it('should have complete inputSchema with descriptions', () => {
      const schema = diagnoseTool?.inputSchema;
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
      expect(Array.isArray(schema.required)).toBe(true);
      
      // All properties should have descriptions
      const properties = schema.properties;
      expect(properties.error_message.description).toBeDefined();
      expect(properties.context.description).toBeDefined();
      expect(properties.options.description).toBeDefined();
      
      // Nested properties should also have descriptions
      expect(properties.context.properties.command.description).toBeDefined();
      expect(properties.options.properties.maxMatches.description).toBeDefined();
    });
  });
});
