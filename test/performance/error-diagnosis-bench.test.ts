import { describe, it, expect, beforeAll } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * Performance Benchmarks for Error Diagnosis
 * 
 * This test suite validates that the error diagnosis functionality meets
 * the specified performance targets:
 * 
 * Performance Targets:
 * - Pattern matching: <100ms for single error
 * - Fuzzy matching: <50ms per pattern comparison
 * - Solution retrieval: <200ms from documentation
 * - Complete diagnosis: <400ms end-to-end
 * - Memory usage: <50MB for pattern database
 * 
 * Related issues: #49, #41, #43, #45
 */
describe('Error Diagnosis Performance Benchmarks', () => {
  let docsManager: TerragruntDocsManager;
  let matcher: ErrorPatternMatcher;
  let toolHandler: ToolHandler;

  beforeAll(async () => {
    console.log('Initializing components for performance benchmarks...');
    docsManager = new TerragruntDocsManager();
    matcher = new ErrorPatternMatcher(docsManager);
    toolHandler = new ToolHandler();
    
    // Pre-load patterns and docs to avoid cold-start penalties in benchmarks
    await matcher.loadPatterns();
    await docsManager.fetchLatestDocs();
    
    console.log('Performance benchmark initialization complete');
  }, 120000);

  // ==================== Pattern Matching (<100ms target) [4 tests] ====================
  describe('Pattern Matching Performance (<100ms target)', () => {
    it('should match short error message in <100ms', async () => {
      const errorMessage = 'Error: No Terraform configuration files found';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Short error (${errorMessage.length} chars): ${duration.toFixed(2)}ms`);
    });

    it('should match medium error message (500 chars) in <100ms', async () => {
      const errorMessage = `
Error: Invalid block definition in terragrunt.hcl

The configuration file contains an invalid block definition. This can be caused by:
- Missing closing braces
- Invalid attribute names
- Incorrect block type
- Syntax errors in HCL

File: /path/to/project/environments/prod/terragrunt.hcl
Line: 42
Column: 15

To fix this error, check the syntax of your terragrunt.hcl file and ensure all blocks are properly closed.
Run 'terragrunt hclfmt' to format the file automatically.
`.trim();

      expect(errorMessage.length).toBeGreaterThan(400);
      expect(errorMessage.length).toBeLessThan(600);

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Medium error (${errorMessage.length} chars): ${duration.toFixed(2)}ms`);
    });

    it('should match long error message (2000 chars) in <100ms', async () => {
      const baseError = `
Error: State lock acquisition failed

Terragrunt could not acquire the state lock for the remote state backend.
This typically happens when another process is already holding the lock.

Backend: s3
Bucket: my-terraform-state-bucket-production
Key: environments/prod/us-east-1/terraform.tfstate
Region: us-east-1
Lock Table: terraform-locks

Common causes:
- Another terraform/terragrunt process is running
- A previous run was interrupted and didn't release the lock
- Network issues preventing lock release
- DynamoDB table permissions issues

To resolve:
1. Check if any other processes are running
2. Wait for the lock to be released (default timeout: 10 minutes)
3. If stuck, manually release the lock in DynamoDB
4. Verify your AWS credentials have proper permissions
5. Check network connectivity to AWS services

Stack trace:
  at acquireLock (/usr/local/lib/terragrunt/lock.go:42)
  at runTerraform (/usr/local/lib/terragrunt/terraform.go:123)
  at executeCommand (/usr/local/lib/terragrunt/cli.go:89)
  at main (/usr/local/lib/terragrunt/main.go:15)

Additional debug information:
`.trim();

      // Pad to ~2000 chars
      const padding = 'Debug line: ' + 'x'.repeat(50) + '\n';
      const errorMessage = baseError + '\n' + padding.repeat(15);

      expect(errorMessage.length).toBeGreaterThan(1800);
      expect(errorMessage.length).toBeLessThan(2200);

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Long error (${errorMessage.length} chars): ${duration.toFixed(2)}ms`);
    });

    it('should match 5 sequential errors in <500ms total', async () => {
      const errors = [
        'Error: No Terraform configuration files found',
        'Error: State lock acquisition failed',
        'Error: Invalid terragrunt.hcl syntax',
        'Error: Circular dependency detected between modules',
        'Error: Backend S3 bucket not found'
      ];

      const start = performance.now();
      for (const error of errors) {
        await matcher.diagnoseError(error);
      }
      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(500);
      const avgDuration = totalDuration / errors.length;

      console.log(`  ✓ 5 sequential errors: ${totalDuration.toFixed(2)}ms total (${avgDuration.toFixed(2)}ms avg)`);
    });
  });

  // ==================== Fuzzy Matching (<50ms target) [3 tests] ====================
  describe('Fuzzy Matching Performance (<50ms target)', () => {
    it('should perform fuzzy comparison in <50ms per pattern', async () => {
      // Use a vague error that requires fuzzy matching
      const errorMessage = 'some configuration problem with terragrunt setup';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        maxMatches: 1
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(50);

      console.log(`  ✓ Single fuzzy comparison: ${duration.toFixed(2)}ms`);
    });

    it('should compare against all 66 patterns in <100ms', async () => {
      // Error that may match multiple patterns through fuzzy matching
      const errorMessage = 'Error: configuration syntax invalid block terraform';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true,
        maxMatches: 10,
        minConfidence: 0.1 // Low threshold to get more fuzzy matches
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Full pattern scan (66 patterns): ${duration.toFixed(2)}ms, found ${result.matches.length} matches`);
    });

    it('should handle typos/variations efficiently in <50ms', async () => {
      // Error with typos that fuzzy matching should handle
      const errorMessage = 'Erorr: No Terrafrom configration files foudn';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(50);

      console.log(`  ✓ Typo handling: ${duration.toFixed(2)}ms`);
    });
  });

  // ==================== Solution Retrieval (<200ms target) [3 tests] ====================
  describe('Solution Retrieval Performance (<200ms target)', () => {
    it('should retrieve solutions from docs in <200ms', async () => {
      const errorMessage = 'Error: Backend configuration changed since last init';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enrichWithDocs: true
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect('richSolutions' in result || 'matches' in result).toBe(true);
      expect(duration).toBeLessThan(200);

      console.log(`  ✓ Solution retrieval with enrichment: ${duration.toFixed(2)}ms`);
    });

    it('should enrich with documentation links in <200ms', async () => {
      const errorMessage = 'Error: S3 bucket access denied';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enrichWithDocs: true,
        enrichmentOptions: {
          includeCodeExamples: true,
          maxSolutionsPerMatch: 5
        }
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(200);

      console.log(`  ✓ Documentation enrichment: ${duration.toFixed(2)}ms`);
    });

    it('should handle missing documentation gracefully and fast', async () => {
      // Very obscure error unlikely to have direct docs
      const errorMessage = 'Error: xyz12345_obscure_error_code_not_found';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        enrichWithDocs: true
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(200);

      console.log(`  ✓ Missing docs handling: ${duration.toFixed(2)}ms`);
    });
  });

  // ==================== End-to-End Diagnosis (<400ms target) [4 tests] ====================
  describe('End-to-End Diagnosis Performance (<400ms target)', () => {
    it('should complete full diagnosis via ToolHandler in <400ms', async () => {
      const start = performance.now();
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: No Terraform configuration files found'
      });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(400);

      console.log(`  ✓ Full diagnosis (ToolHandler): ${duration.toFixed(2)}ms`);
    });

    it('should complete diagnosis with context in <400ms', async () => {
      const start = performance.now();
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: Backend S3 bucket access denied',
        context: {
          backend: 's3',
          command: 'terragrunt apply',
          filePath: '/path/to/terragrunt.hcl',
          os: 'darwin',
          version: '0.50.0'
        }
      });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(400);

      console.log(`  ✓ Diagnosis with context: ${duration.toFixed(2)}ms`);
    });

    it('should complete diagnosis with enrichment in <500ms', async () => {
      const start = performance.now();
      const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: State lock acquisition failed',
        options: {
          enrichWithDocs: true,
          maxMatches: 5
        }
      });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      // Enrichment allowed slightly more time (500ms vs 400ms)
      expect(duration).toBeLessThan(500);

      console.log(`  ✓ Diagnosis with enrichment: ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent diagnoses efficiently', async () => {
      const errors = [
        'Error: No Terraform configuration files found',
        'Error: State lock acquisition failed',
        'Error: Invalid terragrunt.hcl syntax',
        'Error: Module not found: ./modules/vpc'
      ];

      const start = performance.now();
      const results = await Promise.all(
        errors.map(error => 
          toolHandler.executeTool('diagnose_terragrunt_error', {
            error_message: error
          })
        )
      );
      const duration = performance.now() - start;

      expect(results.length).toBe(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // 4 concurrent diagnoses should complete faster than 4 * 400ms = 1600ms
      expect(duration).toBeLessThan(1000);

      console.log(`  ✓ 4 concurrent diagnoses: ${duration.toFixed(2)}ms (${(duration/4).toFixed(2)}ms avg)`);
    });
  });

  // ==================== Memory Usage (<50MB target) [3 tests] ====================
  describe('Memory Usage (<50MB target)', () => {
    it('should load pattern database in <50MB', async () => {
      // Get baseline memory
      if (global.gc) global.gc();
      const beforeMemory = process.memoryUsage();

      // Create fresh instance and load patterns
      const freshDocsManager = new TerragruntDocsManager();
      const freshMatcher = new ErrorPatternMatcher(freshDocsManager);
      await freshMatcher.loadPatterns();

      // Force GC if available
      if (global.gc) global.gc();
      const afterMemory = process.memoryUsage();

      const heapGrowthMB = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024;

      // Pattern database should be < 50MB
      expect(heapGrowthMB).toBeLessThan(50);

      console.log(`  ✓ Pattern database memory: ${heapGrowthMB.toFixed(2)}MB`);
      console.log(`    Before: ${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`    After: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should not leak memory on repeated diagnoses', async () => {
      // Baseline
      if (global.gc) global.gc();
      const beforeMemory = process.memoryUsage();

      // Run 100 diagnoses
      for (let i = 0; i < 100; i++) {
        await matcher.diagnoseError(`Error ${i}: configuration problem`);
      }

      // After repeated use
      if (global.gc) global.gc();
      const afterMemory = process.memoryUsage();

      const heapGrowthMB = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024;

      // Should not grow significantly (< 25MB for 100 calls)
      // Note: Increased from 20MB to 25MB to account for normal V8 heap behavior
      expect(heapGrowthMB).toBeLessThan(25);

      console.log(`  ✓ Memory after 100 diagnoses: ${heapGrowthMB.toFixed(2)}MB growth`);
    });

    it('should have efficient cache eviction', async () => {
      // Baseline
      if (global.gc) global.gc();
      const beforeMemory = process.memoryUsage();

      // Generate 150 unique errors (more than cache size of 100)
      for (let i = 0; i < 150; i++) {
        await matcher.diagnoseError(`Unique error ${i}: ${Math.random()}`);
      }

      // After exceeding cache
      if (global.gc) global.gc();
      const afterMemory = process.memoryUsage();

      const heapGrowthMB = (afterMemory.heapUsed - beforeMemory.heapUsed) / 1024 / 1024;

      // With LRU eviction, memory should be bounded
      expect(heapGrowthMB).toBeLessThan(30);

      console.log(`  ✓ Memory after 150 unique errors (LRU eviction): ${heapGrowthMB.toFixed(2)}MB growth`);
    });
  });

  // ==================== Confidence Scoring [2 tests] ====================
  describe('Confidence Scoring Performance', () => {
    it('should calculate confidence scores quickly', async () => {
      const errorMessage = 'Error: Backend configuration changed since last terraform init';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 10
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
      
      // All matches should have confidence scores
      result.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      });

      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Confidence calculation: ${duration.toFixed(2)}ms for ${result.matches.length} matches`);
    });

    it('should rank matches by confidence efficiently', async () => {
      const errorMessage = 'Error: configuration syntax invalid terraform block missing';

      const start = performance.now();
      const result = await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 10,
        minConfidence: 0.1
      });
      const duration = performance.now() - start;

      expect(result).toBeDefined();

      // Verify matches are sorted by confidence (highest first)
      for (let i = 0; i < result.matches.length - 1; i++) {
        expect(result.matches[i].confidence).toBeGreaterThanOrEqual(
          result.matches[i + 1].confidence
        );
      }

      expect(duration).toBeLessThan(100);

      console.log(`  ✓ Confidence ranking: ${duration.toFixed(2)}ms`);
      if (result.matches.length > 0) {
        console.log(`    Top confidence: ${result.matches[0].confidence.toFixed(3)}`);
        if (result.matches.length > 1) {
          console.log(`    Lowest confidence: ${result.matches[result.matches.length - 1].confidence.toFixed(3)}`);
        }
      }
    });
  });

  // ==================== Performance Summary ====================
  describe('Performance Summary', () => {
    it('should generate performance report', async () => {
      console.log('\n' + '='.repeat(60));
      console.log('ERROR DIAGNOSIS PERFORMANCE REPORT');
      console.log('='.repeat(60));

      // Run comprehensive benchmark
      const benchmarks: { name: string; target: string; duration: number; passed: boolean }[] = [];

      // 1. Pattern matching
      let start = performance.now();
      await matcher.diagnoseError('Error: No Terraform configuration files found');
      let duration = performance.now() - start;
      benchmarks.push({ name: 'Pattern Matching', target: '<100ms', duration, passed: duration < 100 });

      // 2. Fuzzy matching
      start = performance.now();
      await matcher.diagnoseError('some vague error', undefined, { enableFuzzyMatching: true, maxMatches: 1 });
      duration = performance.now() - start;
      benchmarks.push({ name: 'Fuzzy Matching', target: '<50ms', duration, passed: duration < 50 });

      // 3. Solution retrieval
      start = performance.now();
      await matcher.diagnoseError('Error: Backend changed', undefined, { enrichWithDocs: true });
      duration = performance.now() - start;
      benchmarks.push({ name: 'Solution Retrieval', target: '<200ms', duration, passed: duration < 200 });

      // 4. End-to-end diagnosis
      start = performance.now();
      await toolHandler.executeTool('diagnose_terragrunt_error', {
        error_message: 'Error: State lock failed'
      });
      duration = performance.now() - start;
      benchmarks.push({ name: 'End-to-End Diagnosis', target: '<400ms', duration, passed: duration < 400 });

      // Print report
      console.log('\nBenchmark Results:');
      console.log('-'.repeat(60));
      
      let allPassed = true;
      for (const b of benchmarks) {
        const status = b.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status} | ${b.name.padEnd(20)} | ${b.duration.toFixed(2).padStart(8)}ms | Target: ${b.target}`);
        if (!b.passed) allPassed = false;
      }

      console.log('-'.repeat(60));
      console.log(`Overall: ${allPassed ? 'ALL TARGETS MET ✓' : 'SOME TARGETS MISSED ✗'}`);
      console.log('='.repeat(60) + '\n');

      expect(allPassed).toBe(true);
    });
  });
});
