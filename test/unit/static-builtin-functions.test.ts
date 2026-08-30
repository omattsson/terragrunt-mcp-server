import { describe, it, expect, beforeEach } from 'vitest';
import type { TerragruntDoc } from '../../src/terragrunt/docs.js';
import { 
  TerragruntFunctionsManager, 
  STATIC_BUILTIN_FUNCTIONS,
  type TerragruntFunction,
  type FunctionCategory
} from '../../src/terragrunt/functions.js';

/**
 * Mock DocsManager that returns empty docs - tests static functions without doc enrichment
 */
class EmptyDocsManager {
  async fetchLatestDocs(): Promise<TerragruntDoc[]> { return []; }
}

/**
 * Mock DocsManager that throws - tests resilience
 */
class FailingDocsManager {
  async fetchLatestDocs(): Promise<TerragruntDoc[]> { 
    throw new Error('Network error'); 
  }
}

describe('STATIC_BUILTIN_FUNCTIONS', () => {
  describe('Static definitions completeness', () => {
    it('should contain exactly 30 functions', () => {
      expect(STATIC_BUILTIN_FUNCTIONS.length).toBe(30);
    });

    it('should have unique function names', () => {
      const names = STATIC_BUILTIN_FUNCTIONS.map(f => f.name.toLowerCase());
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have all expected path functions (10)', () => {
      const pathFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'path');
      expect(pathFunctions.length).toBe(10);
      
      const expectedPathFunctions = [
        'find_in_parent_folders',
        'path_relative_to_include',
        'path_relative_from_include',
        'get_terragrunt_dir',
        'get_working_dir',
        'get_parent_terragrunt_dir',
        'get_original_terragrunt_dir',
        'get_repo_root',
        'get_path_from_repo_root',
        'get_path_to_repo_root'
      ];
      
      const actualNames = pathFunctions.map(f => f.name);
      for (const expected of expectedPathFunctions) {
        expect(actualNames).toContain(expected);
      }
    });

    it('should have all expected environment functions (2)', () => {
      const envFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'environment');
      expect(envFunctions.length).toBe(2);
      expect(envFunctions.map(f => f.name)).toContain('get_env');
      expect(envFunctions.map(f => f.name)).toContain('get_platform');
    });

    it('should have all expected AWS functions (4)', () => {
      const awsFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'aws');
      expect(awsFunctions.length).toBe(4);
      
      const expectedAwsFunctions = [
        'get_aws_account_id',
        'get_aws_account_alias',
        'get_aws_caller_identity_arn',
        'get_aws_caller_identity_user_id'
      ];
      
      const actualNames = awsFunctions.map(f => f.name);
      for (const expected of expectedAwsFunctions) {
        expect(actualNames).toContain(expected);
      }
    });

    it('should have all expected terraform functions (6)', () => {
      const tfFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'terraform');
      expect(tfFunctions.length).toBe(6);
      
      const expectedTfFunctions = [
        'get_terraform_commands_that_need_vars',
        'get_terraform_commands_that_need_input',
        'get_terraform_commands_that_need_locking',
        'get_terraform_commands_that_need_parallelism',
        'get_terraform_command',
        'get_terraform_cli_args'
      ];
      
      const actualNames = tfFunctions.map(f => f.name);
      for (const expected of expectedTfFunctions) {
        expect(actualNames).toContain(expected);
      }
    });

    it('should have all expected file functions (4)', () => {
      const fileFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'file');
      expect(fileFunctions.length).toBe(4);
      
      const expectedFileFunctions = [
        'read_terragrunt_config',
        'read_tfvars_file',
        'sops_decrypt_file',
        'mark_as_read'
      ];
      
      const actualNames = fileFunctions.map(f => f.name);
      for (const expected of expectedFileFunctions) {
        expect(actualNames).toContain(expected);
      }
    });

    it('should have all expected execution functions (1)', () => {
      const execFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'execution');
      expect(execFunctions.length).toBe(1);
      expect(execFunctions[0].name).toBe('run_cmd');
    });

    it('should have all expected utility functions (3)', () => {
      const utilFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'utility');
      expect(utilFunctions.length).toBe(3);
      
      const expectedUtilFunctions = [
        'get_terragrunt_source_cli_flag',
        'get_default_retryable_errors',
        'constraint_check'
      ];
      
      const actualNames = utilFunctions.map(f => f.name);
      for (const expected of expectedUtilFunctions) {
        expect(actualNames).toContain(expected);
      }
    });
  });

  describe('Static definition structure validation', () => {
    it.each(STATIC_BUILTIN_FUNCTIONS)('function "$name" has all required fields', (fn) => {
      expect(fn.name).toBeTruthy();
      expect(fn.signature).toBeTruthy();
      expect(fn.description).toBeTruthy();
      expect(fn.description.length).toBeGreaterThan(20); // Meaningful description
      expect(Array.isArray(fn.parameters)).toBe(true);
      expect(fn.returnType).toBeTruthy();
      expect(fn.category).toBeTruthy();
      expect(Array.isArray(fn.examples)).toBe(true);
      expect(fn.examples.length).toBeGreaterThan(0); // At least one example
      expect(Array.isArray(fn.relatedFunctions)).toBe(true);
    });

    it.each(STATIC_BUILTIN_FUNCTIONS)('function "$name" has valid category', (fn) => {
      const validCategories: FunctionCategory[] = ['path', 'environment', 'aws', 'terraform', 'file', 'execution', 'utility'];
      expect(validCategories).toContain(fn.category);
    });

    it.each(STATIC_BUILTIN_FUNCTIONS)('function "$name" signature contains function name', (fn) => {
      expect(fn.signature).toContain(fn.name);
    });

    it.each(STATIC_BUILTIN_FUNCTIONS)('function "$name" examples have required fields', (fn) => {
      for (const example of fn.examples) {
        expect(example.code).toBeTruthy();
        expect(example.description).toBeTruthy();
        expect(example.useCase).toBeTruthy();
      }
    });

    it.each(STATIC_BUILTIN_FUNCTIONS)('function "$name" parameters have required fields', (fn) => {
      for (const param of fn.parameters) {
        expect(param.name).toBeTruthy();
        expect(param.type).toBeTruthy();
        expect(typeof param.required).toBe('boolean');
        expect(param.description).toBeTruthy();
      }
    });
  });

  describe('Specific function validations', () => {
    it('find_in_parent_folders has correct parameters', () => {
      const fn = STATIC_BUILTIN_FUNCTIONS.find(f => f.name === 'find_in_parent_folders');
      expect(fn).toBeDefined();
      expect(fn!.parameters.length).toBe(2);
      expect(fn!.parameters[0].name).toBe('name');
      expect(fn!.parameters[0].required).toBe(true);
      expect(fn!.parameters[1].name).toBe('fallback');
      expect(fn!.parameters[1].required).toBe(false);
    });

    it('get_env has correct parameters', () => {
      const fn = STATIC_BUILTIN_FUNCTIONS.find(f => f.name === 'get_env');
      expect(fn).toBeDefined();
      expect(fn!.parameters.length).toBe(2);
      expect(fn!.parameters[0].name).toBe('name');
      expect(fn!.parameters[0].required).toBe(true);
      expect(fn!.parameters[1].name).toBe('default');
      expect(fn!.parameters[1].required).toBe(false);
    });

    it('run_cmd documents special parameters', () => {
      const fn = STATIC_BUILTIN_FUNCTIONS.find(f => f.name === 'run_cmd');
      expect(fn).toBeDefined();
      expect(fn!.description).toContain('--terragrunt-quiet');
      expect(fn!.description).toContain('--terragrunt-global-cache');
      expect(fn!.description).toContain('--terragrunt-no-cache');
      // Should have examples demonstrating special flags
      const quietExample = fn!.examples.find(e => e.code.includes('--terragrunt-quiet'));
      expect(quietExample).toBeDefined();
    });

    it('constraint_check has correct parameters', () => {
      const fn = STATIC_BUILTIN_FUNCTIONS.find(f => f.name === 'constraint_check');
      expect(fn).toBeDefined();
      expect(fn!.parameters.length).toBe(2);
      expect(fn!.parameters[0].name).toBe('version');
      expect(fn!.parameters[1].name).toBe('constraint');
      expect(fn!.returnType).toBe('bool');
    });

    it('path functions return string type', () => {
      const pathFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'path');
      for (const fn of pathFunctions) {
        expect(fn.returnType).toBe('string');
      }
    });

    it('AWS functions return string type', () => {
      const awsFunctions = STATIC_BUILTIN_FUNCTIONS.filter(f => f.category === 'aws');
      for (const fn of awsFunctions) {
        expect(fn.returnType).toBe('string');
      }
    });
  });
});

describe('TerragruntFunctionsManager with static functions', () => {
  let mgr: TerragruntFunctionsManager;

  beforeEach(() => {
    mgr = new TerragruntFunctionsManager(new EmptyDocsManager() as any);
  });

  describe('getStaticFunctions()', () => {
    it('returns all 30 static functions', () => {
      const staticFns = mgr.getStaticFunctions();
      expect(staticFns.length).toBe(30);
    });

    it('returns a copy, not the original array', () => {
      const staticFns = mgr.getStaticFunctions();
      staticFns.push({} as TerragruntFunction);
      expect(mgr.getStaticFunctions().length).toBe(30);
    });
  });

  describe('isStaticFunction()', () => {
    it('returns true for static functions', () => {
      expect(mgr.isStaticFunction('find_in_parent_folders')).toBe(true);
      expect(mgr.isStaticFunction('get_env')).toBe(true);
      expect(mgr.isStaticFunction('run_cmd')).toBe(true);
    });

    it('returns true case-insensitively', () => {
      expect(mgr.isStaticFunction('FIND_IN_PARENT_FOLDERS')).toBe(true);
      expect(mgr.isStaticFunction('Get_Env')).toBe(true);
    });

    it('returns false for non-static functions', () => {
      expect(mgr.isStaticFunction('nonexistent_function')).toBe(false);
      expect(mgr.isStaticFunction('custom_function')).toBe(false);
    });

    it('returns false for empty/null input', () => {
      expect(mgr.isStaticFunction('')).toBe(false);
      expect(mgr.isStaticFunction('   ')).toBe(false);
    });
  });

  describe('loadFunctions() with static definitions', () => {
    it('loads all 30 static functions when docs are empty', async () => {
      await mgr.loadFunctions();
      const functions = mgr.listFunctions();
      expect(functions.length).toBe(30);
    });

    it('includes find_in_parent_folders after loading', async () => {
      await mgr.loadFunctions();
      const fn = mgr.getFunction('find_in_parent_folders');
      expect(fn).not.toBeNull();
      expect(fn!.description).toContain('Searches up the directory tree');
    });

    it('includes all categories after loading', async () => {
      await mgr.loadFunctions();
      const categories = mgr.getAvailableCategories();
      expect(categories).toContain('path');
      expect(categories).toContain('environment');
      expect(categories).toContain('aws');
      expect(categories).toContain('terraform');
      expect(categories).toContain('file');
      expect(categories).toContain('execution');
      expect(categories).toContain('utility');
    });

    it('survives doc extraction failure', async () => {
      const failingMgr = new TerragruntFunctionsManager(new FailingDocsManager() as any);
      await failingMgr.loadFunctions();
      const functions = failingMgr.listFunctions();
      expect(functions.length).toBe(30);
    });
  });

  describe('listFunctions() with category filter', () => {
    beforeEach(async () => {
      await mgr.loadFunctions();
    });

    it('filters by path category', () => {
      const pathFns = mgr.listFunctions('path');
      expect(pathFns.length).toBe(10);
      expect(pathFns.every(f => f.category === 'path')).toBe(true);
    });

    it('filters by aws category', () => {
      const awsFns = mgr.listFunctions('aws');
      expect(awsFns.length).toBe(4);
      expect(awsFns.every(f => f.category === 'aws')).toBe(true);
    });

    it('filters by terraform category', () => {
      const tfFns = mgr.listFunctions('terraform');
      expect(tfFns.length).toBe(6);
      expect(tfFns.every(f => f.category === 'terraform')).toBe(true);
    });

    it('filters case-insensitively', () => {
      const pathFns = mgr.listFunctions('PATH');
      expect(pathFns.length).toBe(10);
    });

    it('returns empty array for unknown category', () => {
      const unknownFns = mgr.listFunctions('unknown_category');
      expect(unknownFns.length).toBe(0);
    });
  });

  describe('getFunction() with static definitions', () => {
    beforeEach(async () => {
      await mgr.loadFunctions();
    });

    it('returns static function by name', () => {
      const fn = mgr.getFunction('get_env');
      expect(fn).not.toBeNull();
      expect(fn!.name).toBe('get_env');
      expect(fn!.category).toBe('environment');
    });

    it('returns function case-insensitively', () => {
      const fn = mgr.getFunction('GET_ENV');
      expect(fn).not.toBeNull();
      expect(fn!.name).toBe('get_env');
    });

    it('returns null for unknown function', () => {
      const fn = mgr.getFunction('unknown_function');
      expect(fn).toBeNull();
    });
  });

  describe('searchFunctions() with static definitions', () => {
    beforeEach(async () => {
      await mgr.loadFunctions();
    });

    it('searches by function name', () => {
      const results = mgr.searchFunctions('terragrunt');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(f => f.name.includes('terragrunt'))).toBe(true);
    });

    it('searches by description', () => {
      const results = mgr.searchFunctions('directory');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches by category', () => {
      const results = mgr.searchFunctions('aws');
      // Matches 4 AWS category functions plus 2 terraform functions mentioning AWS in examples
      expect(results.length).toBeGreaterThanOrEqual(4);
    });

    it('searches by parameter name', () => {
      const results = mgr.searchFunctions('fallback');
      expect(results.some(f => f.name === 'find_in_parent_folders')).toBe(true);
    });

    it('returns empty for no matches', () => {
      const results = mgr.searchFunctions('xyz_nonexistent_xyz');
      expect(results.length).toBe(0);
    });
  });
});

describe('Doc enrichment of static functions', () => {
  it('enriches static function with additional examples from docs', async () => {
    const mockDocs: TerragruntDoc[] = [{
      title: 'Built-in Functions',
      url: 'https://docs.terragrunt.com/reference/hcl/functions/',
      content: `
        ## get_env
        get_env(name, default) -> string
        Example: get_env("MY_VAR", "default_value")
        Another usage from docs.
      `,
      section: 'reference',
      lastUpdated: new Date().toISOString(),
    }];

    class MockDocsManager {
      async fetchLatestDocs(): Promise<TerragruntDoc[]> { return mockDocs; }
    }

    const mgr = new TerragruntFunctionsManager(new MockDocsManager() as any);
    await mgr.loadFunctions();

    const fn = mgr.getFunction('get_env');
    expect(fn).not.toBeNull();
    // Should have at least the static examples
    expect(fn!.examples.length).toBeGreaterThanOrEqual(2);
  });

  it('does not duplicate existing examples', async () => {
    // Create mock docs with an example that matches one already in static definitions
    const staticGetEnv = STATIC_BUILTIN_FUNCTIONS.find(f => f.name === 'get_env');
    const existingExample = staticGetEnv!.examples[0].code;

    const mockDocs: TerragruntDoc[] = [{
      title: 'Built-in Functions',
      url: 'https://docs.terragrunt.com/reference/hcl/functions/',
      content: `
        ## get_env
        get_env(name, default) -> string
        Example: ${existingExample}
      `,
      section: 'reference',
      lastUpdated: new Date().toISOString(),
    }];

    class MockDocsManager {
      async fetchLatestDocs(): Promise<TerragruntDoc[]> { return mockDocs; }
    }

    const mgr = new TerragruntFunctionsManager(new MockDocsManager() as any);
    await mgr.loadFunctions();

    const fn = mgr.getFunction('get_env');
    // Count occurrences of the example code
    const count = fn!.examples.filter(e => e.code === existingExample).length;
    expect(count).toBe(1); // Should not be duplicated
  });
});
