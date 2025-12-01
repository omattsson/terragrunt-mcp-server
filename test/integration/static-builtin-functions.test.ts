import { describe, it, expect, beforeAll } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { TerragruntFunctionsManager, STATIC_BUILTIN_FUNCTIONS } from '../../src/terragrunt/functions.js';

/**
 * Integration tests for static built-in functions.
 * These tests verify the complete flow from manager initialization through to function retrieval.
 */
describe('Static Built-in Functions Integration', () => {
  let docsManager: TerragruntDocsManager;
  let functionsManager: TerragruntFunctionsManager;

  beforeAll(async () => {
    docsManager = new TerragruntDocsManager();
    functionsManager = new TerragruntFunctionsManager(docsManager);
    await functionsManager.loadFunctions();
  }, 60000); // Allow time for potential network calls

  describe('Complete function coverage', () => {
    it('should have all 30 built-in functions available', () => {
      const functions = functionsManager.listFunctions();
      expect(functions.length).toBeGreaterThanOrEqual(30);
      
      // Verify all static functions are present
      for (const staticFn of STATIC_BUILTIN_FUNCTIONS) {
        const fn = functionsManager.getFunction(staticFn.name);
        expect(fn).not.toBeNull();
        expect(fn!.name).toBe(staticFn.name);
      }
    });

    it('should provide complete documentation for each function', () => {
      for (const staticFn of STATIC_BUILTIN_FUNCTIONS) {
        const fn = functionsManager.getFunction(staticFn.name);
        expect(fn).not.toBeNull();
        
        // Each function should have comprehensive documentation
        expect(fn!.description.length).toBeGreaterThan(20);
        expect(fn!.signature).toContain(fn!.name);
        expect(fn!.examples.length).toBeGreaterThan(0);
        expect(fn!.category).toBeTruthy();
      }
    });
  });

  describe('Category filtering', () => {
    it('should filter path functions correctly', () => {
      const pathFunctions = functionsManager.listFunctions('path');
      expect(pathFunctions.length).toBeGreaterThanOrEqual(10);
      
      const expectedNames = [
        'find_in_parent_folders',
        'get_terragrunt_dir',
        'get_parent_terragrunt_dir',
        'path_relative_to_include'
      ];
      
      const names = pathFunctions.map(f => f.name);
      for (const expected of expectedNames) {
        expect(names).toContain(expected);
      }
    });

    it('should filter AWS functions correctly', () => {
      const awsFunctions = functionsManager.listFunctions('aws');
      expect(awsFunctions.length).toBeGreaterThanOrEqual(4);
      
      const expectedNames = [
        'get_aws_account_id',
        'get_aws_account_alias',
        'get_aws_caller_identity_arn',
        'get_aws_caller_identity_user_id'
      ];
      
      const names = awsFunctions.map(f => f.name);
      for (const expected of expectedNames) {
        expect(names).toContain(expected);
      }
    });

    it('should list all available categories', () => {
      const categories = functionsManager.getAvailableCategories();
      expect(categories).toContain('path');
      expect(categories).toContain('environment');
      expect(categories).toContain('aws');
      expect(categories).toContain('terraform');
      expect(categories).toContain('file');
      expect(categories).toContain('execution');
      expect(categories).toContain('utility');
    });
  });

  describe('Function search', () => {
    it('should find functions by partial name', () => {
      const results = functionsManager.searchFunctions('get_');
      expect(results.length).toBeGreaterThan(5);
    });

    it('should find functions by description keywords', () => {
      const results = functionsManager.searchFunctions('environment variable');
      expect(results.some(f => f.name === 'get_env')).toBe(true);
    });

    it('should find functions by category', () => {
      const results = functionsManager.searchFunctions('terraform');
      expect(results.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Individual function validation', () => {
    it('find_in_parent_folders has correct structure', () => {
      const fn = functionsManager.getFunction('find_in_parent_folders');
      expect(fn).not.toBeNull();
      expect(fn!.signature).toBe('find_in_parent_folders(name, [fallback])');
      expect(fn!.parameters.length).toBe(2);
      expect(fn!.parameters[0].name).toBe('name');
      expect(fn!.parameters[0].required).toBe(true);
      expect(fn!.parameters[1].name).toBe('fallback');
      expect(fn!.parameters[1].required).toBe(false);
      expect(fn!.returnType).toBe('string');
      expect(fn!.category).toBe('path');
    });

    it('run_cmd documents special flags', () => {
      const fn = functionsManager.getFunction('run_cmd');
      expect(fn).not.toBeNull();
      expect(fn!.description).toContain('--terragrunt-quiet');
      expect(fn!.description).toContain('--terragrunt-global-cache');
      expect(fn!.description).toContain('--terragrunt-no-cache');
    });

    it('get_env supports optional default parameter', () => {
      const fn = functionsManager.getFunction('get_env');
      expect(fn).not.toBeNull();
      expect(fn!.parameters.length).toBe(2);
      expect(fn!.parameters[1].required).toBe(false);
    });

    it('constraint_check returns boolean', () => {
      const fn = functionsManager.getFunction('constraint_check');
      expect(fn).not.toBeNull();
      expect(fn!.returnType).toBe('bool');
    });
  });

  describe('Static function helpers', () => {
    it('getStaticFunctions returns all static definitions', () => {
      const staticFns = functionsManager.getStaticFunctions();
      expect(staticFns.length).toBe(30);
    });

    it('isStaticFunction correctly identifies static functions', () => {
      expect(functionsManager.isStaticFunction('find_in_parent_folders')).toBe(true);
      expect(functionsManager.isStaticFunction('get_env')).toBe(true);
      expect(functionsManager.isStaticFunction('run_cmd')).toBe(true);
      expect(functionsManager.isStaticFunction('nonexistent')).toBe(false);
    });

    it('isStaticFunction is case-insensitive', () => {
      expect(functionsManager.isStaticFunction('FIND_IN_PARENT_FOLDERS')).toBe(true);
      expect(functionsManager.isStaticFunction('Get_Env')).toBe(true);
    });
  });

  describe('Related functions cross-reference', () => {
    it('path functions reference other path functions', () => {
      const fn = functionsManager.getFunction('find_in_parent_folders');
      expect(fn!.relatedFunctions.length).toBeGreaterThan(0);
      
      // All related functions should exist
      for (const related of fn!.relatedFunctions) {
        const relatedFn = functionsManager.getFunction(related);
        expect(relatedFn).not.toBeNull();
      }
    });

    it('AWS functions reference each other', () => {
      const fn = functionsManager.getFunction('get_aws_account_id');
      expect(fn!.relatedFunctions.length).toBeGreaterThan(0);
      expect(fn!.relatedFunctions).toContain('get_aws_account_alias');
    });
  });

  describe('Examples quality', () => {
    it('all functions have practical examples', () => {
      const functions = functionsManager.listFunctions();
      for (const fn of functions) {
        expect(fn.examples.length).toBeGreaterThan(0);
        
        for (const example of fn.examples) {
          expect(example.code).toBeTruthy();
          expect(example.code.length).toBeGreaterThan(5);
          expect(example.description).toBeTruthy();
          expect(example.useCase).toBeTruthy();
        }
      }
    });

    it('examples contain actual HCL code', () => {
      const fn = functionsManager.getFunction('find_in_parent_folders');
      expect(fn!.examples.some(e => e.code.includes('include'))).toBe(true);
      
      const envFn = functionsManager.getFunction('get_env');
      expect(envFn!.examples.some(e => e.code.includes('get_env'))).toBe(true);
    });
  });
});
