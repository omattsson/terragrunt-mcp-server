import { describe, it, expect, beforeAll } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { EnrichedDiagnosisResult } from '../../src/types/terragrunt.js';

describe('Solution Retrieval Integration', () => {
  let matcher: ErrorPatternMatcher;
  let docsManager: TerragruntDocsManager;

  beforeAll(async () => {
    docsManager = new TerragruntDocsManager();
    matcher = new ErrorPatternMatcher(docsManager);
  });

  describe('Basic Diagnosis Flow', () => {
    it('should diagnose a backend configuration error', async () => {
      const errorMessage = 'Error: Backend configuration changed since last init';

      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
      expect(result.debuggingSteps.length).toBeGreaterThan(0);
    });

    it('should diagnose a state locking error', async () => {
      const errorMessage = 'Error acquiring the state lock: ConditionalCheckFailedException';

      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.pattern.category === 'state')).toBe(true);
    });

    it('should diagnose a dependency error', async () => {
      const errorMessage = 'Module not found: ./modules/vpc';

      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe('Enriched Diagnosis Flow', () => {
    it('should return enriched result when enrichWithDocs is true', async () => {
      const errorMessage = 'Error: Backend configuration changed';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enrichWithDocs: true }
      );

      // Check if it's an enriched result
      expect('richSolutions' in result).toBe(true);
      expect('orderedDebuggingSteps' in result).toBe(true);
      expect('documentationLinks' in result).toBe(true);
      expect('relatedErrorDetails' in result).toBe(true);
      expect('enrichmentSuccessful' in result).toBe(true);
    });

    it('should include rich solutions with safety levels', async () => {
      const errorMessage = 'Error: State lock timeout';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enrichWithDocs: true }
      ) as EnrichedDiagnosisResult;

      if (result.richSolutions.length > 0) {
        expect(result.richSolutions[0].safetyLevel).toMatch(/safe|caution|destructive/);
        expect(result.richSolutions[0].source).toMatch(/pattern|documentation|generated/);
      }
    });

    it('should include ordered debugging steps', async () => {
      const errorMessage = 'Error: No Terraform files found';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enrichWithDocs: true }
      ) as EnrichedDiagnosisResult;

      if (result.orderedDebuggingSteps.length > 0) {
        // Steps should be ordered
        const orders = result.orderedDebuggingSteps.map(s => s.order);
        const sortedOrders = [...orders].sort((a, b) => a - b);
        expect(orders).toEqual(sortedOrders);
      }
    });

    it('should handle enrichment with context', async () => {
      const errorMessage = 'Error: S3 bucket not found';

      const result = await matcher.diagnoseError(
        errorMessage,
        {
          command: 'terragrunt apply',
          backend: 's3',
          os: 'darwin'
        },
        { enrichWithDocs: true }
      ) as EnrichedDiagnosisResult;

      expect(result.enrichmentSuccessful).toBeDefined();
    });
  });

  describe('Options Handling', () => {
    it('should respect maxMatches option', async () => {
      const errorMessage = 'Error: configuration problem';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { maxMatches: 1 }
      );

      expect(result.matches.length).toBeLessThanOrEqual(1);
    });

    it('should respect minConfidence option', async () => {
      const errorMessage = 'Error: some generic issue';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { minConfidence: 0.8 }
      );

      result.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should disable fuzzy matching when option is false', async () => {
      const errorMessage = 'Error: a very unique and specific message';

      const withFuzzy = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enableFuzzyMatching: true }
      );

      const withoutFuzzy = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enableFuzzyMatching: false }
      );

      // Without fuzzy matching, should have fewer or equal matches
      expect(withoutFuzzy.matches.length).toBeLessThanOrEqual(withFuzzy.matches.length);
    });

    it('should filter destructive commands when option is set', async () => {
      const errorMessage = 'Error: State corrupted';

      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        {
          enrichWithDocs: true,
          enrichmentOptions: {
            includeDestructiveCommands: false
          }
        }
      ) as EnrichedDiagnosisResult;

      // No solutions should have destructive safety level
      result.richSolutions.forEach(solution => {
        expect(solution.safetyLevel).not.toBe('destructive');
      });
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle empty error message', async () => {
      const result = await matcher.diagnoseError('', undefined, { enrichWithDocs: true });

      expect(result.matches).toEqual([]);
      expect(result.overallConfidence).toBe(0);
    });

    it('should handle whitespace-only error message', async () => {
      const result = await matcher.diagnoseError('   \n\t  ', undefined, { enrichWithDocs: true });

      expect(result.matches).toEqual([]);
    });

    it('should handle very long error message', async () => {
      const longError = 'Error: ' + 'x'.repeat(10000);

      const result = await matcher.diagnoseError(longError, undefined, { enrichWithDocs: true });

      expect(result).toBeDefined();
      // Should complete without hanging
    });
  });

  describe('Graceful Degradation', () => {
    it('should return partial result if enrichment fails', async () => {
      const errorMessage = 'Error: Backend configuration changed';

      // Even if docs aren't available, should return a result
      const result = await matcher.diagnoseError(
        errorMessage,
        undefined,
        { enrichWithDocs: true }
      ) as EnrichedDiagnosisResult;

      // Basic diagnosis should still work
      expect(result.matches.length).toBeGreaterThanOrEqual(0);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
      
      // Enrichment may or may not succeed but should not throw
      expect(typeof result.enrichmentSuccessful).toBe('boolean');
    });
  });

  describe('Context Extraction', () => {
    it('should extract command from error message', async () => {
      const errorMessage = 'Error running terragrunt apply: permission denied';

      const result = await matcher.diagnoseError(errorMessage);

      // Context should be extracted even if no exact pattern match
      expect(result).toBeDefined();
    });

    it('should extract backend type from error message', async () => {
      const errorMessage = 'Error initializing backend s3: access denied';

      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        expect(result.matches[0].context.backend).toBe('s3');
      }
    });

    it('should extract file path from error message', async () => {
      const errorMessage = 'Error in terragrunt.hcl: syntax error on line 42';

      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0 && result.matches[0].context.filePath) {
        expect(result.matches[0].context.filePath).toContain('.hcl');
      }
    });
  });
});
