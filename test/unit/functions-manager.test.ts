import { describe, it, expect, beforeEach } from 'vitest';
import type { TerragruntDoc } from '../../src/terragrunt/docs.js';
import { TerragruntFunctionsManager } from '../../src/terragrunt/functions.js';

class MockDocsManager {
  private docs: TerragruntDoc[];
  constructor(docs: TerragruntDoc[]) { this.docs = docs; }
  async fetchLatestDocs(): Promise<TerragruntDoc[]> { return this.docs; }
}

describe('TerragruntFunctionsManager', () => {
  let mgr: TerragruntFunctionsManager;

  beforeEach(() => {
    const content = [
      // Function 1: arrow style with description
      '## abspath',
      'Returns the absolute path to a given path.',
      'abspath(path) -> string',
      'Parameters: path (string): The path to resolve.',
      'Example: abspath("./foo")',
      'See also: dirname(), basename()',
      '',
      '## concat',
      'Concatenates two lists into a single list.',
      'concat(list1, list2) returns list',
      'Parameters: list1 (list), list2 (list)',
      'Usage: concat([1],[2])',
      '',
      '## get_env',
      'Description: Retrieves an environment variable value.',
      'get_env(name, default) -> string',
      'Parameters: name (string), default (string)',
      '',
      'You can also use account() to get cloud account info.',
    ].join(' ');

    const mockDocs: TerragruntDoc[] = [{
      title: 'Built-in Functions',
      url: 'https://terragrunt.gruntwork.io/docs/reference/hcl/functions/',
      content,
      section: 'reference',
      lastUpdated: new Date().toISOString(),
    }];

    mgr = new TerragruntFunctionsManager(new MockDocsManager(mockDocs) as any);
  });

  it('loads and lists functions with improved extraction', async () => {
    await mgr.loadFunctions();
    const list = mgr.listFunctions();
    expect(list.length).toBeGreaterThanOrEqual(3);

    const names = list.map(f => f.name);
    expect(names).toContain('abspath');
    expect(names).toContain('concat');
    expect(names).toContain('account');

    const abs = list.find(f => f.name === 'abspath')!;
    expect(abs.returnType.toLowerCase()).toBe('string');
    expect(abs.parameters?.[0]?.name).toBe('path');
    expect((abs.examples || []).length).toBeGreaterThanOrEqual(1);
    expect((abs.relatedFunctions || [])).toEqual(expect.arrayContaining(['dirname', 'basename']));

  const con = list.find(f => f.name === 'concat')!;
  expect(['list', 'unknown']).toContain(con.returnType.toLowerCase());
    expect(con.parameters.map(p => p.name)).toEqual(expect.arrayContaining(['list1', 'list2']));
  });

  it('gets functions case-insensitively', async () => {
    await mgr.loadFunctions();
    expect(mgr.getFunction('Abspath')?.name).toBe('abspath');
    expect(mgr.getFunction('CONCAT')?.name).toBe('concat');
  });

  it('searches functions across fields', async () => {
    await mgr.loadFunctions();
    const results = mgr.searchFunctions('list');
    // Should match concat by return type and parameter types
    expect(results.map(f => f.name)).toContain('concat');
  });

  it('extracts a specific function from docs by name', async () => {
    const result = await mgr.extractFunctionFromDocs('abspath');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('abspath');
    expect(result?.returnType.toLowerCase()).toBe('string');
    expect(result?.parameters?.[0]?.name).toBe('path');
  });

  it('returns null when extracting non-existent function', async () => {
    const result = await mgr.extractFunctionFromDocs('nonexistent_function_xyz');
    expect(result).toBeNull();
  });

  it('extracts function case-insensitively', async () => {
    const result = await mgr.extractFunctionFromDocs('CONCAT');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('concat');
  });

  it('caches extracted function for future lookups', async () => {
    // First extraction should search docs
    const result1 = await mgr.extractFunctionFromDocs('abspath');
    expect(result1).not.toBeNull();
    
    // Second call should return cached version
    const result2 = await mgr.extractFunctionFromDocs('abspath');
    expect(result2).not.toBeNull();
    expect(result2?.name).toBe('abspath');
    
    // Should also be available via getFunction
    const cached = mgr.getFunction('abspath');
    expect(cached).not.toBeNull();
    expect(cached?.name).toBe('abspath');
  });

  it('handles empty or whitespace-only function names', async () => {
    expect(await mgr.extractFunctionFromDocs('')).toBeNull();
    expect(await mgr.extractFunctionFromDocs('   ')).toBeNull();
  });

  it('extracts function descriptions from documentation', async () => {
    await mgr.loadFunctions();
    
    const abspath = mgr.getFunction('abspath');
    expect(abspath?.description).toBeTruthy();
    expect(abspath?.description.length).toBeGreaterThan(0);
    expect(abspath?.description.toLowerCase()).toContain('absolute');
    
    const concat = mgr.getFunction('concat');
    expect(concat?.description).toBeTruthy();
    expect(concat?.description.toLowerCase()).toContain('concatenate');
    
    const getEnv = mgr.getFunction('get_env');
    expect(getEnv?.description).toBeTruthy();
    expect(getEnv?.description.toLowerCase()).toContain('environment');
  });
});
