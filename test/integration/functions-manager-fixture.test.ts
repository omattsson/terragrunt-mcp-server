import { describe, it, expect } from 'vitest';
import { TerragruntFunctionsManager } from '../../src/terragrunt/functions.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

/**
 * Integration tests for TerragruntFunctionsManager with real fixture data.
 * These tests are slower as they load and parse actual documentation fixtures.
 */
describe('TerragruntFunctionsManager - Fixture Integration', () => {
  describe('Fixture-based Function Extraction', () => {
    async function createFixtureDocsManager(): Promise<TerragruntDocsManager> {
      const docsManager = new TerragruntDocsManager();
      expect(await (docsManager as any).loadFixture()).toBe(true);
      return docsManager;
    }

    it('can extract functions from real fixture data', async () => {
      const realDocsManager = await createFixtureDocsManager();
      
      // Validate fixture first
      const validation = await realDocsManager.validateFixture();
      expect(validation.valid).toBe(true);
      expect(validation.hasFunctionDocs).toBe(true);
      
      // Create functions manager with real docs
      const realFunctionsManager = new TerragruntFunctionsManager(realDocsManager);
      await realFunctionsManager.loadFunctions();
      
      // Should extract some functions from fixture
      const functions = realFunctionsManager.listFunctions();
      expect(functions.length).toBeGreaterThan(0);
    });

    it('extracted functions from fixture have complete metadata', async () => {
      const realDocsManager = await createFixtureDocsManager();
      const realFunctionsManager = new TerragruntFunctionsManager(realDocsManager);
      
      await realFunctionsManager.loadFunctions();
      const functions = realFunctionsManager.listFunctions();
      
      // Verify at least some functions were extracted
      expect(functions.length).toBeGreaterThan(0);
      
      // Check that functions have expected structure
      for (const fn of functions) {
        expect(fn.name).toBeDefined();
        expect(fn.signature).toBeDefined();
        expect(fn.description).toBeDefined();
        expect(fn.category).toBeDefined();
        expect(Array.isArray(fn.parameters)).toBe(true);
        expect(Array.isArray(fn.examples)).toBe(true);
        expect(Array.isArray(fn.relatedFunctions)).toBe(true);
      }
    });

    it('extracts all functions from issue #98 (missing built-in functions)', async () => {
      const realDocsManager = await createFixtureDocsManager();
      const realFunctionsManager = new TerragruntFunctionsManager(realDocsManager);
      
      await realFunctionsManager.loadFunctions();
      
      // These 7 functions were reported as missing in issue #98
      const missingFunctions = [
        'find_in_parent_folders',
        'run_cmd',
        'read_terragrunt_config',
        'sops_decrypt_file',
        'read_tfvars_file',
        'mark_as_read',
        'constraint_check'
      ];
      
      // Verify all functions are now extracted
      for (const functionName of missingFunctions) {
        const fn = realFunctionsManager.getFunction(functionName);
        expect(fn, `Function ${functionName} should be extracted from documentation`).toBeTruthy();
        expect(fn!.name).toBe(functionName);
        expect(fn!.description).toBeTruthy();
        expect(fn!.signature).toBeTruthy();
      }
      
      // Verify total count includes these functions
      const allFunctions = realFunctionsManager.listFunctions();
      expect(allFunctions.length).toBeGreaterThanOrEqual(23 + 7); // 23 existing + 7 missing
    });
  });
});
