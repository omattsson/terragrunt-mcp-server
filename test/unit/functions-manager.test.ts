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
      // Function 1: arrow style
      'abspath(path) -> string Returns the absolute path to a given path. Parameters: - path (string): The path to resolve. Example: abspath("./foo") See also: dirname(), basename()',
      // Function 2: returns wording
      'concat(list1, list2) returns list Parameters: list1 (list), list2 (list) Usage: concat([1],[2])',
      // Inline call only
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
    expect(con.returnType.toLowerCase()).toBe('list');
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
});
