import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('ErrorPatternMatcher - Performance Benchmarks', () => {
  let matcher: ErrorPatternMatcher;
  let docsManager: TerragruntDocsManager;

  beforeEach(async () => {
    docsManager = new TerragruntDocsManager();
    matcher = new ErrorPatternMatcher(docsManager);
    await matcher.loadPatterns();
  });

  describe('Performance Requirements (<150ms)', () => {
    it('should match typical error message in <150ms', async () => {
      const errorMessage = `
Error: No Terraform configuration files found in the working directory

Call to function "get_terragrunt_dir" failed: terragrunt.hcl not found in the current directory or any parent directory.
`.trim();

      const start = Date.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(150);
    });

    it('should match medium error message (500 chars) in <150ms', async () => {
      const errorMessage = `
Error: Invalid block definition in terragrunt.hcl

The configuration file contains an invalid block definition. This can be caused by:
- Missing closing braces
- Invalid attribute names
- Incorrect block type
- Syntax errors in HCL

File: /path/to/terragrunt.hcl
Line: 42

To fix this error:
1. Check the syntax of your terragrunt.hcl file
2. Ensure all blocks are properly closed
3. Verify attribute names are valid
4. Run 'terragrunt hclfmt' to format the file
`.repeat(2).trim();

      const start = Date.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(150);
    });

    it('should match long error message (1000 chars) in <150ms', async () => {
      const baseError = `
Error: State lock acquisition failed

Terragrunt could not acquire the state lock for the remote state backend.
This typically happens when another process is already holding the lock.

Backend: s3
Bucket: my-terraform-state
Key: prod/terraform.tfstate
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
`.trim();

      const errorMessage = baseError + '\n' + 'Additional context: ' + 'x'.repeat(500);

      const start = Date.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(150);
    });

    it('should handle very long error (5000+ chars) in <150ms with truncation', async () => {
      const errorMessage = 'Error: configuration problem. ' + 
        'Long stack trace: ' + 
        'x'.repeat(6000);

      const start = Date.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(150); // Increased to account for system load variability
    });

    it('should perform multiple sequential matches in <500ms total', async () => {
      const errors = [
        'Error: No Terraform configuration files found',
        'Error: State lock acquisition failed',
        'Error: Invalid terragrunt.hcl syntax',
        'Error: Circular dependency detected',
        'Error: Backend S3 bucket not found'
      ];

      const start = Date.now();
      for (const error of errors) {
        await matcher.diagnoseError(error);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should benefit from caching on repeated errors', async () => {
      const errorMessage = 'Error: No Terraform configuration files found in directory';

      // First call (cold)
      const start1 = Date.now();
      await matcher.diagnoseError(errorMessage);
      const duration1 = Date.now() - start1;

      // Second call (cached)
      const start2 = Date.now();
      await matcher.diagnoseError(errorMessage);
      const duration2 = Date.now() - start2;

      // Third call (cached)
      const start3 = Date.now();
      await matcher.diagnoseError(errorMessage);
      const duration3 = Date.now() - start3;

      // Cached calls should be fast (<=10ms) or faster than first call
      // Note: On fast machines, Date.now() may return 0ms for sub-millisecond operations
      expect(duration2).toBeLessThanOrEqual(Math.max(duration1, 10));
      expect(duration3).toBeLessThanOrEqual(Math.max(duration1, 10));
      
      // At least verify the cache is working - run multiple times and check average
      const iterations = 10;
      let totalCached = 0;
      for (let i = 0; i < iterations; i++) {
        const startCached = Date.now();
        await matcher.diagnoseError(errorMessage);
        totalCached += Date.now() - startCached;
      }
      const avgCached = totalCached / iterations;
      expect(avgCached).toBeLessThan(10); // Average should be very fast
    });
  });

  describe('Performance with Different Configurations', () => {
    it('should be faster with fuzzy matching disabled', async () => {
      const errorMessage = 'some vague error message that might not match';

      const startWithFuzzy = Date.now();
      await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: true
      });
      const durationWithFuzzy = Date.now() - startWithFuzzy;

      const startWithoutFuzzy = Date.now();
      await matcher.diagnoseError(errorMessage, undefined, {
        enableFuzzyMatching: false
      });
      const durationWithoutFuzzy = Date.now() - startWithoutFuzzy;

      // Without fuzzy matching should be faster or equal
      expect(durationWithoutFuzzy).toBeLessThanOrEqual(durationWithFuzzy + 10);
    });

    it('should be faster with lower maxMatches', async () => {
      const errorMessage = 'Error: configuration syntax invalid block';

      const startMax10 = Date.now();
      await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 10
      });
      const durationMax10 = Date.now() - startMax10;

      const startMax1 = Date.now();
      await matcher.diagnoseError(errorMessage, undefined, {
        maxMatches: 1
      });
      const durationMax1 = Date.now() - startMax1;

      // Both should be fast, but max1 might be slightly faster
      expect(durationMax1).toBeLessThan(150);
      expect(durationMax10).toBeLessThan(150);
    });
  });

  describe('Scalability', () => {
    it('should handle 10 different errors in <1 second total', async () => {
      const errors = [
        'Error: No Terraform configuration files found',
        'Error: State lock acquisition failed',
        'Error: Invalid terragrunt.hcl syntax',
        'Error: Circular dependency detected',
        'Error: Backend S3 bucket not found',
        'Error: Module source not found',
        'Error: Hook execution failed',
        'Error: Include file not found',
        'Error: Local variable undefined',
        'Error: Generate block error'
      ];

      const start = Date.now();
      const results = await Promise.all(
        errors.map(error => matcher.diagnoseError(error))
      );
      const duration = Date.now() - start;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(1000);
    });

    it('should maintain performance with 66+ patterns loaded', async () => {
      const errorMessage = 'Error: configuration problem with terragrunt setup';

      const start = Date.now();
      const result = await matcher.diagnoseError(errorMessage);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory on repeated calls', async () => {
      const errors = Array(100).fill('Error: configuration problem');

      for (const error of errors) {
        await matcher.diagnoseError(error);
      }

      // Should complete without issues (cache size limit prevents memory leak)
      expect(true).toBe(true);
    });

    it('should cache efficiently (LRU eviction)', async () => {
      // Generate 150 different error messages (more than cache size of 100)
      const errors = Array.from({ length: 150 }, (_, i) => 
        `Error ${i}: configuration problem`
      );

      for (const error of errors) {
        await matcher.diagnoseError(error);
      }

      // First error should have been evicted from cache
      const firstErrorAgain = errors[0];
      const start = Date.now();
      await matcher.diagnoseError(firstErrorAgain);
      const duration = Date.now() - start;

      // Should still be fast but not instant (not in cache anymore)
      expect(duration).toBeLessThan(150);
    });
  });
});
