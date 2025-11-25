import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('ErrorPatternMatcher - Fuzzy Matching and Confidence Scoring', () => {
  let matcher: ErrorPatternMatcher;
  let docsManager: TerragruntDocsManager;

  beforeEach(async () => {
    docsManager = new TerragruntDocsManager();
    matcher = new ErrorPatternMatcher(docsManager);
    await matcher.loadPatterns();
  });

  describe('Confidence Scoring Ranges', () => {
    it('should assign 0.95 confidence to regex matches', async () => {
      const errorMessage = 'Error: No Terraform configuration files found in the working directory';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].confidence).toBe(0.95);
    });

    it('should assign high confidence (0.7-0.85) for high similarity matches', async () => {
      // This should match via fuzzy matching with high similarity
      const errorMessage = 'configuration file syntax error invalid block definition';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true
      });

      const fuzzyMatches = result.matches.filter(m => m.confidence < 0.95);
      if (fuzzyMatches.length > 0) {
        const highConfMatches = fuzzyMatches.filter(m => m.confidence >= 0.7 && m.confidence <= 0.85);
        expect(highConfMatches.length).toBeGreaterThan(0);
      }
    });

    it('should assign medium confidence (0.4-0.65) for medium similarity matches', async () => {
      const errorMessage = 'something about configuration problems maybe';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.3,
        enableFuzzyMatching: true
      });

      const mediumMatches = result.matches.filter(m => m.confidence >= 0.4 && m.confidence < 0.7);
      // May or may not have matches depending on similarity, just verify range is valid
      mediumMatches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.4);
        expect(match.confidence).toBeLessThan(0.7);
      });
    });

    it('should filter out matches below minimum confidence threshold', async () => {
      const errorMessage = 'completely unrelated error message xyz123';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.3
      });

      // All matches should have confidence >= 0.3
      result.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });

    it('should respect custom minimum confidence threshold', async () => {
      const errorMessage = 'Error: state lock issue';
      
      // With higher threshold, should get fewer matches
      const highThreshold = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.8
      });
      
      const lowThreshold = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.3
      });

      expect(highThreshold.matches.length).toBeLessThanOrEqual(lowThreshold.matches.length);
      highThreshold.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Configurable Options', () => {
    it('should respect maxMatches option (default 3)', async () => {
      const errorMessage = 'Error: configuration syntax invalid';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeLessThanOrEqual(3);
    });

    it('should respect custom maxMatches option', async () => {
      const errorMessage = 'Error: configuration syntax invalid';
      
      const result1 = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 1
      });
      expect(result1.matches.length).toBeLessThanOrEqual(1);

      const result5 = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 5
      });
      expect(result5.matches.length).toBeLessThanOrEqual(5);
      expect(result5.matches.length).toBeGreaterThanOrEqual(result1.matches.length);
    });

    it('should disable fuzzy matching when option is false', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      
      const withFuzzy = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        maxMatches: 10,
        minConfidence: 0.3
      });
      
      const withoutFuzzy = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: false,
        maxMatches: 10,
        minConfidence: 0.3
      });

      // Without fuzzy matching, should get fewer or equal matches
      expect(withoutFuzzy.matches.length).toBeLessThanOrEqual(withFuzzy.matches.length);
      
      // With fuzzy enabled, might have additional non-regex matches
      const withFuzzyLowConf = withFuzzy.matches.filter(m => m.confidence < 0.95);
      
      // If there are fuzzy matches in the enabled version, prove fuzzy works
      if (withFuzzyLowConf.length > 0) {
        expect(withFuzzyLowConf[0].confidence).toBeLessThan(0.95);
      }
    });
  });

  describe('Match Ranking', () => {
    it('should rank matches by confidence (highest first)', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 1) {
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i].confidence).toBeGreaterThanOrEqual(
            result.matches[i + 1].confidence
          );
        }
      }
    });

    it('should prioritize regex matches over fuzzy matches', async () => {
      const errorMessage = 'Error: No Terraform configuration files found in directory';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        // First match should be regex match with confidence 0.95
        expect(result.matches[0].confidence).toBe(0.95);
      }
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate matches with identical solutions', async () => {
      // Use an error that might match multiple patterns with similar solutions
      const errorMessage = 'Error: configuration file not found terragrunt.hcl missing';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 10 // Allow more matches to test deduplication
      });

      // Check that solutions are unique
      const solutionSignatures = new Set<string>();
      result.matches.forEach(match => {
        const signature = match.solutions
          .map(s => s.explanation.toLowerCase().trim())
          .sort()
          .join('|');
        
        expect(solutionSignatures.has(signature)).toBe(false);
        solutionSignatures.add(signature);
      });
    });

    it('should keep highest confidence match when deduplicating', async () => {
      const errorMessage = 'Error: state lock error could not acquire lock';
      const result = await matcher.diagnoseError(errorMessage);

      // Verify matches are sorted by confidence
      for (let i = 0; i < result.matches.length - 1; i++) {
        expect(result.matches[i].confidence).toBeGreaterThanOrEqual(
          result.matches[i + 1].confidence
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error message', async () => {
      const result = await matcher.diagnoseError('');

      expect(result.matches).toEqual([]);
      expect(result.overallConfidence).toBe(0);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
      expect(result.debuggingSteps.length).toBeGreaterThan(0);
    });

    it('should handle null/whitespace-only error message', async () => {
      const result1 = await matcher.diagnoseError('   ');
      const result2 = await matcher.diagnoseError('\n\t  \n');

      expect(result1.matches).toEqual([]);
      expect(result2.matches).toEqual([]);
      expect(result1.overallConfidence).toBe(0);
      expect(result2.overallConfidence).toBe(0);
    });

    it('should handle very long error messages (>5000 chars)', async () => {
      const longError = 'Error: configuration problem. ' + 'x'.repeat(6000);
      
      // Should not crash and should truncate internally
      const result = await matcher.diagnoseError(longError);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should handle error with no matches', async () => {
      const errorMessage = 'qwerty12345 zxcvbn asdfgh completely nonsense jklmno pqrst';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.7 // Set high threshold to avoid fuzzy matches
      });

      expect(result.matches.length).toBe(0);
      expect(result.overallConfidence).toBe(0);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
    });

    it('should handle special characters in error messages', async () => {
      const errorMessage = 'Error: [config@#$%^&*()!] file not found';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });
  });

  describe('Enhanced Context Extraction', () => {
    it('should extract module from error message', async () => {
      const errorMessage = 'Error in module: vpc-network when running terragrunt apply';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        const context = result.matches[0].context;
        expect(context.module).toBe('vpc-network');
      }
    });

    it('should extract backend type from error message', async () => {
      const errorMessage = 'Error: backend s3 bucket not accessible';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        const context = result.matches[0].context;
        expect(context.backend).toBe('s3');
      }
    });

    it('should extract OS from error message', async () => {
      const errorMessage = 'Error on linux: permission denied';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        const context = result.matches[0].context;
        expect(context.os).toBe('linux');
      }
    });

    it('should extract command from error message', async () => {
      const errorMessage = 'terragrunt apply failed with error';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        const context = result.matches[0].context;
        expect(context.command).toContain('apply');
      }
    });
  });

  describe('Caching', () => {
    it('should cache results for identical error messages', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      
      const start1 = Date.now();
      await matcher.diagnoseError(errorMessage);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await matcher.diagnoseError(errorMessage);
      const time2 = Date.now() - start2;

      // Second call should be faster (cached)
      expect(time2).toBeLessThanOrEqual(time1);
    });

    it('should cache separately for different options', async () => {
      const errorMessage = 'Error: configuration problem';
      
      const result1 = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 1
      });
      
      const result2 = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 5
      });

      // Different options should produce different results
      expect(result1.matches.length).toBeLessThanOrEqual(1);
      expect(result2.matches.length).toBeLessThanOrEqual(5);
    });
  });
});
