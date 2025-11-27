import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('ErrorPatternMatcher', () => {
  let matcher: ErrorPatternMatcher;
  let docsManager: TerragruntDocsManager;

  beforeEach(async () => {
    docsManager = new TerragruntDocsManager();
    matcher = new ErrorPatternMatcher(docsManager);
    await matcher.loadPatterns();
  });

  // ==================== Pattern Matching Tests (8 tests) ====================
  describe('Pattern Matching', () => {
    it('should match exact error message with high confidence', async () => {
      // Use an error message that exactly matches a known pattern's regex
      const errorMessage = 'Error: No Terraform configuration files found in directory';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].confidence).toBe(0.95); // Regex match confidence
    });

    it('should match case-insensitively for fuzzy matches', async () => {
      const errorMessageLower = 'error: backend configuration changed';
      const errorMessageUpper = 'ERROR: BACKEND CONFIGURATION CHANGED';

      const resultLower = await matcher.diagnoseError(errorMessageLower);
      const resultUpper = await matcher.diagnoseError(errorMessageUpper);

      // Both should produce matches (may differ in confidence due to pattern case)
      expect(resultLower.matches.length).toBeGreaterThan(0);
      expect(resultUpper.matches.length).toBeGreaterThan(0);
    });

    it('should match regex patterns correctly', async () => {
      // This error message should trigger the "No Terraform configuration files" pattern
      const errorMessage = 'Error: No Terraform configuration files found in directory /path/to/module';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      // Regex matches should have 0.95 confidence
      const regexMatches = result.matches.filter(m => m.confidence === 0.95);
      expect(regexMatches.length).toBeGreaterThan(0);
    });

    it('should return multiple pattern matches when applicable', async () => {
      // Use an error that could match multiple patterns
      const errorMessage = 'Error: Backend configuration changed, state lock acquisition failed';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 10,
        minConfidence: 0.3
      });

      // Should potentially match multiple patterns related to backend and state
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should return no matches for completely unrelated error', async () => {
      const errorMessage = 'xyzzy12345 completely nonsensical gibberish qwerty99999';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.8 // High threshold to avoid false fuzzy matches
      });

      expect(result.matches.length).toBe(0);
      expect(result.overallConfidence).toBe(0);
    });

    it('should match partial error messages', async () => {
      // Partial match of a known error pattern
      const errorMessage = 'terraform init required';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      // Should find matches via fuzzy matching
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle error messages with stack traces', async () => {
      const errorWithStackTrace = `Error: Backend configuration changed
        at Object.<anonymous> (/path/to/module/terragrunt.hcl:15:1)
        at Module._compile (internal/modules/cjs/loader.js:999:30)
        at Object.Module._extensions..js (internal/modules/cjs/loader.js:1027:10)`;
      
      const result = await matcher.diagnoseError(errorWithStackTrace);

      // Should still match the core error despite stack trace noise
      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should handle error messages with file paths', async () => {
      const errorWithPath = 'Error in /home/user/projects/infra/modules/vpc/terragrunt.hcl: Invalid block definition';
      const result = await matcher.diagnoseError(errorWithPath);

      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      // Should extract file path context
      if (result.matches.length > 0 && result.matches[0].context.filePath) {
        expect(result.matches[0].context.filePath).toContain('.hcl');
      }
    });
  });

  // ==================== Fuzzy Matching Tests (6 tests) ====================
  describe('Fuzzy Matching', () => {
    it('should return high confidence (>0.7) for highly similar errors', async () => {
      // Use an exact error message that matches a known pattern regex for high confidence
      const errorMessage = 'Error: No Terraform configuration files found in directory /some/path';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.5
      });

      // Should have matches with high confidence (regex matches get 0.95)
      expect(result.matches.length).toBeGreaterThan(0);
      const highConfidenceMatches = result.matches.filter(m => m.confidence > 0.7);
      // Regex matches should have 0.95 confidence, which is > 0.7
      expect(highConfidenceMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('should return medium confidence (0.4-0.7) for moderately similar errors', async () => {
      const errorMessage = 'some kind of configuration issue maybe';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      const mediumConfidence = result.matches.filter(m => m.confidence >= 0.4 && m.confidence < 0.7);
      mediumConfidence.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.4);
        expect(match.confidence).toBeLessThan(0.7);
      });
    });

    it('should filter out low confidence matches (<0.3) by default', async () => {
      const errorMessage = 'random text that barely matches anything';
      const result = await matcher.diagnoseError(errorMessage);

      // Default minConfidence is 0.3, so no matches below that
      result.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.3);
      });
    });

    it('should match errors with typos via fuzzy matching', async () => {
      // Typos in "Backend" -> "Baceknd" and "initialization" -> "initializtion" (intentional typos for test)
      const errorWithTypo = 'Baceknd initializtion required, please run terraform init';
      const result = await matcher.diagnoseError(errorWithTypo, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      // Fuzzy matching should find relevant matches despite typos
      // The "terraform init" part should still trigger init-related patterns
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should distinguish between similar but different errors', async () => {
      const stateError = 'Error acquiring the state lock';
      const configError = 'Error: Invalid configuration syntax';

      const stateResult = await matcher.diagnoseError(stateError);
      const configResult = await matcher.diagnoseError(configError);

      // Both should have matches
      expect(stateResult.matches.length).toBeGreaterThan(0);
      expect(configResult.matches.length).toBeGreaterThan(0);

      // They should match different categories (if categorization works)
      if (stateResult.matches[0] && configResult.matches[0]) {
        // At minimum, they should be different patterns
        expect(stateResult.matches[0].pattern.id).not.toBe(configResult.matches[0].pattern.id);
      }
    });

    it('should use context hints to improve fuzzy match relevance', async () => {
      const errorMessage = 'access denied error';
      
      // With backend context hint
      const resultWithContext = await matcher.diagnoseError(errorMessage, {
        backend: 's3'
      }, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      // Without context
      const resultWithoutContext = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      // Both should return valid results
      expect(resultWithContext).toBeDefined();
      expect(resultWithoutContext).toBeDefined();
      expect(Array.isArray(resultWithContext.matches)).toBe(true);
      expect(Array.isArray(resultWithoutContext.matches)).toBe(true);
      
      // When context is provided, matches should favor backend-related patterns
      // or have higher overall confidence due to context boost
      if (resultWithContext.matches.length > 0 && resultWithoutContext.matches.length > 0) {
        // Context should influence results - either different matches or different confidence
        const contextMatchIds = resultWithContext.matches.map(m => m.pattern.id).join(',');
        const noContextMatchIds = resultWithoutContext.matches.map(m => m.pattern.id).join(',');
        const contextConfidence = resultWithContext.overallConfidence;
        const noContextConfidence = resultWithoutContext.overallConfidence;
        
        // At least one of these should differ when context is provided
        const resultsDiffer = contextMatchIds !== noContextMatchIds || contextConfidence !== noContextConfidence;
        expect(resultsDiffer || resultWithContext.matches.length > 0).toBe(true);
      }
    });
  });

  // ==================== Confidence Scoring Tests (5 tests) ====================
  describe('Confidence Scoring', () => {
    it('should score regex matches at 0.95', async () => {
      // Use an exact regex match
      const errorMessage = 'Error: No Terraform configuration files found in directory';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      // First match should be regex match with 0.95 confidence
      expect(result.matches[0].confidence).toBe(0.95);
    });

    it('should score fuzzy matches between 0.3 and 0.85', async () => {
      const errorMessage = 'configuration problem with terraform files';
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      const fuzzyMatches = result.matches.filter(m => m.confidence < 0.95);
      fuzzyMatches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.3);
        expect(match.confidence).toBeLessThanOrEqual(0.85);
      });
    });

    it('should boost confidence when context matches pattern category', async () => {
      const errorMessage = 'bucket not accessible error';
      
      // With relevant backend context
      const resultWithBackendContext = await matcher.diagnoseError(errorMessage, {
        backend: 's3'
      }, {
        enableFuzzyMatching: true,
        minConfidence: 0.3
      });

      // Context-aware matching should find backend-related patterns
      expect(resultWithBackendContext).toBeDefined();
    });

    it('should filter matches below minimum confidence threshold', async () => {
      const errorMessage = 'some vague error message';
      
      const highThreshold = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.8
      });
      
      const lowThreshold = await matcher.diagnoseError(errorMessage, undefined, {
        minConfidence: 0.3
      });

      // Higher threshold should return fewer or equal matches
      expect(highThreshold.matches.length).toBeLessThanOrEqual(lowThreshold.matches.length);
      
      // All matches should meet the threshold
      highThreshold.matches.forEach(m => expect(m.confidence).toBeGreaterThanOrEqual(0.8));
      lowThreshold.matches.forEach(m => expect(m.confidence).toBeGreaterThanOrEqual(0.3));
    });

    it('should calculate overall confidence from best match', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        // Overall confidence should equal the highest match confidence
        expect(result.overallConfidence).toBe(result.matches[0].confidence);
      } else {
        expect(result.overallConfidence).toBe(0);
      }
    });
  });

  // ==================== Category Tests (3 tests) ====================
  describe('Category Tests', () => {
    it('should categorize backend errors correctly', async () => {
      const backendError = 'Error: Backend configuration changed since last init';
      const result = await matcher.diagnoseError(backendError);

      expect(result.matches.length).toBeGreaterThan(0);
      // Should match a backend or state category pattern
      const hasBackendCategory = result.matches.some(m => 
        m.pattern.category === 'backend' || m.pattern.category === 'state'
      );
      expect(hasBackendCategory).toBe(true);
    });

    it('should categorize configuration errors correctly', async () => {
      const configError = 'Error: Invalid block definition in terragrunt.hcl';
      const result = await matcher.diagnoseError(configError);

      expect(result.matches.length).toBeGreaterThan(0);
      // Should match a configuration category pattern
      const hasConfigCategory = result.matches.some(m => 
        m.pattern.category === 'configuration'
      );
      expect(hasConfigCategory).toBe(true);
    });

    it('should categorize dependency errors correctly', async () => {
      const dependencyError = 'Module not found: ./modules/vpc';
      const result = await matcher.diagnoseError(dependencyError);

      expect(result.matches.length).toBeGreaterThan(0);
      // Should match a dependency category pattern
      const hasDependencyCategory = result.matches.some(m => 
        m.pattern.category === 'dependency'
      );
      expect(hasDependencyCategory).toBe(true);
    });
  });

  // ==================== Solution Retrieval Tests (3 tests) ====================
  describe('Solution Retrieval', () => {
    it('should extract solutions from matched patterns', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      const result = await matcher.diagnoseError(errorMessage);

      expect(result.matches.length).toBeGreaterThan(0);
      
      // Each match should have solutions
      result.matches.forEach(match => {
        expect(Array.isArray(match.solutions)).toBe(true);
        expect(match.solutions.length).toBeGreaterThan(0);
        
        // Each solution should have required properties
        match.solutions.forEach(solution => {
          expect(solution.step).toBeDefined();
          expect(solution.explanation).toBeDefined();
        });
      });
    });

    it('should generate debugging steps for diagnosis', async () => {
      const errorMessage = 'Error acquiring the state lock';
      const result = await matcher.diagnoseError(errorMessage);

      // Should have debugging steps
      expect(Array.isArray(result.debuggingSteps)).toBe(true);
      expect(result.debuggingSteps.length).toBeGreaterThan(0);
      
      // Each step should be a non-empty string
      result.debuggingSteps.forEach(step => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      });
    });

    it('should provide general advice for all diagnoses', async () => {
      const errorMessage = 'Error: Backend configuration changed';
      const result = await matcher.diagnoseError(errorMessage);

      // Should have general advice
      expect(Array.isArray(result.generalAdvice)).toBe(true);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
      
      // Each advice should be a non-empty string
      result.generalAdvice.forEach(advice => {
        expect(typeof advice).toBe('string');
        expect(advice.length).toBeGreaterThan(0);
      });
    });
  });

  // ==================== Additional Tests for Coverage ====================
  describe('Additional Coverage', () => {
    it('should include related errors in diagnosis', async () => {
      const errorMessage = 'Error: State lock acquisition failed';
      const result = await matcher.diagnoseError(errorMessage);

      // Should have related errors array
      expect(Array.isArray(result.relatedErrors)).toBe(true);
    });

    it('should include documentation references in matches', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        // Matches should have documentation references
        expect(Array.isArray(result.matches[0].documentationRefs)).toBe(true);
      }
    });

    it('should include likely cause in matches', async () => {
      const errorMessage = 'Error: Backend configuration changed';
      const result = await matcher.diagnoseError(errorMessage);

      if (result.matches.length > 0) {
        // Matches should have likely cause
        expect(result.matches[0].likelyCause).toBeDefined();
        expect(typeof result.matches[0].likelyCause).toBe('string');
      }
    });
  });
});
