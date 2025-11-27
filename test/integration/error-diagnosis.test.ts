import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * Integration tests for error diagnosis functionality.
 * 
 * These tests verify the full end-to-end flow from MCP tool invocation
 * through ToolHandler to ErrorPatternMatcher and back, ensuring:
 * - Correct MCP response formatting
 * - Pattern matching for various error types
 * - Solution retrieval accuracy
 * - Confidence scoring validation
 */
describe('Error Diagnosis Integration', () => {
  let toolHandler: ToolHandler;

  beforeAll(async () => {
    toolHandler = new ToolHandler();
  });

  // ==================== End-to-End Diagnosis Flow Tests (3 tests) ====================
  describe('End-to-End Diagnosis Flow', () => {
    it('should diagnose error and return success with valid structure', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed since last init'
      });

      // Verify success response
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify required fields
      expect(typeof result.overallConfidence).toBe('number');
      expect(typeof result.matchCount).toBe('number');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(Array.isArray(result.debuggingSteps)).toBe(true);
      expect(Array.isArray(result.generalAdvice)).toBe(true);
    });

    it('should accept and process context parameters', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: S3 bucket access denied',
        context: {
          backend: 's3',
          command: 'terragrunt apply',
          filePath: '/path/to/terragrunt.hcl'
        }
      });

      // Context should be accepted without errors
      expect(result.success).toBe(true);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should respect options like maxMatches and minConfidence', async () => {
      const resultWithOptions = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed',
        options: {
          maxMatches: 2,
          minConfidence: 0.5
        }
      });

      expect(resultWithOptions.success).toBe(true);
      // Should respect maxMatches
      expect(resultWithOptions.matches.length).toBeLessThanOrEqual(2);
      // All matches should meet minConfidence threshold
      resultWithOptions.matches.forEach((match: { confidence: number }) => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  // ==================== Error Type Coverage Tests (3 tests) ====================
  describe('Error Type Coverage', () => {
    it('should diagnose validation/configuration errors correctly', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Invalid block definition in terragrunt.hcl'
      });

      expect(result.success).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
      
      // Should match configuration-related patterns
      const hasConfigMatch = result.matches.some(
        (m: { category: string }) => m.category === 'configuration'
      );
      expect(hasConfigMatch).toBe(true);
    });

    it('should diagnose dependency/module errors correctly', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Module not found: ./modules/vpc'
      });

      expect(result.success).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
      
      // Should match dependency-related patterns
      const hasDependencyMatch = result.matches.some(
        (m: { category: string }) => m.category === 'dependency'
      );
      expect(hasDependencyMatch).toBe(true);
    });

    it('should diagnose runtime/state errors correctly', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error acquiring the state lock: ConditionalCheckFailedException'
      });

      expect(result.success).toBe(true);
      expect(result.matchCount).toBeGreaterThan(0);
      
      // Should match state-related patterns
      const hasStateMatch = result.matches.some(
        (m: { category: string }) => m.category === 'state'
      );
      expect(hasStateMatch).toBe(true);
    });
  });

  // ==================== Solution & Confidence Tests (2 tests) ====================
  describe('Solution and Confidence Validation', () => {
    it('should return confidence scores in valid range (0-1)', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: No Terraform configuration files found in directory'
      });

      expect(result.success).toBe(true);
      
      // Overall confidence should be in valid range
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      
      // Each match confidence should be in valid range
      result.matches.forEach((match: { confidence: number }) => {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should provide actionable solutions for matched patterns', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed since last init'
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);

      // Each match should have solutions
      result.matches.forEach((match: { solutions: Array<{ step: string; explanation: string }> }) => {
        expect(Array.isArray(match.solutions)).toBe(true);
        expect(match.solutions.length).toBeGreaterThan(0);
        
        // Each solution should have required properties
        match.solutions.forEach(solution => {
          expect(solution.step).toBeDefined();
          expect(solution.explanation).toBeDefined();
        });
      });
    });
  });

  // ==================== Multiple Patterns Test (1 test) ====================
  describe('Multiple Pattern Matching', () => {
    it('should match multiple patterns for complex errors', async () => {
      // Complex error that could match multiple patterns
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend configuration changed, state lock acquisition failed during terraform init',
        options: {
          maxMatches: 10,
          minConfidence: 0.3
        }
      });

      expect(result.success).toBe(true);
      // Complex errors should potentially match multiple patterns
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      
      // Matches should be sorted by confidence (highest first)
      for (let i = 0; i < result.matches.length - 1; i++) {
        expect(result.matches[i].confidence).toBeGreaterThanOrEqual(
          result.matches[i + 1].confidence
        );
      }
    });
  });

  // ==================== MCP Response Format Test (1 test) ====================
  describe('MCP Response Format', () => {
    it('should return MCP-compliant response structure', async () => {
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: No Terraform configuration files found'
      });

      // MCP tool responses must have specific structure
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      // Verify diagnosis-specific response fields
      expect('success' in result).toBe(true);
      expect('overallConfidence' in result).toBe(true);
      expect('matchCount' in result).toBe(true);
      expect('matches' in result).toBe(true);
      expect('debuggingSteps' in result).toBe(true);
      expect('generalAdvice' in result).toBe(true);

      // Verify match structure
      if (result.matches.length > 0) {
        const match = result.matches[0];
        expect('patternId' in match).toBe(true);
        expect('patternName' in match).toBe(true);
        expect('category' in match).toBe(true);
        expect('confidence' in match).toBe(true);
        expect('description' in match).toBe(true);
        expect('likelyCause' in match).toBe(true);
        expect('solutions' in match).toBe(true);
        expect('documentationRefs' in match).toBe(true);
      }
    });
  });
});
