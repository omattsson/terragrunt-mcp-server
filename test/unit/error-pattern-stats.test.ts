import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

const matcher = new ErrorPatternMatcher(new TerragruntDocsManager());

describe('getPatternStats', () => {
  it('reports the total and a per-category breakdown computed from the array', async () => {
    const stats = await matcher.getPatternStats();
    expect(stats.total).toBe(122);
    expect(stats.byCategory).toMatchObject({
      configuration: 48,
      state: 3,
      dependency: 17,
      backend: 8,
      terraform: 3,
      authentication: 3,
      network: 2,
      stack: 6,
      oci: 11,
      engine: 6,
      experiment: 1,
      cas: 14,
    });
  });

  it('has a per-category breakdown that sums to the total', async () => {
    const stats = await matcher.getPatternStats();
    const summed = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(summed).toBe(stats.total);
  });

  it('exposes exactly 12 categories', async () => {
    const stats = await matcher.getPatternStats();
    expect(Object.keys(stats.byCategory).length).toBe(12);
  });

  it('has unique pattern ids (getPatternStats throws otherwise)', async () => {
    // getPatternStats throws on a duplicate id; reaching a total proves uniqueness.
    const stats = await matcher.getPatternStats();
    expect(stats.total).toBeGreaterThan(0);
  });

  it('keeps documented counts in sync with the computed stats', async () => {
    const stats = await matcher.getPatternStats();
    const categories = Object.keys(stats.byCategory).length;
    const files = [
      '../../README.md',
      '../../docs/blog-introducing-terragrunt-mcp-server.md',
      '../../src/terragrunt/error-patterns.ts',
    ];
    for (const file of files) {
      const text = await readFile(new URL(file, import.meta.url), 'utf-8');
      const match = text.match(/(\d+)\s+error patterns across\s+(\d+)\s+categories/i);
      expect(match, `"N error patterns across M categories" phrase missing in ${file}`).not.toBeNull();
      expect(Number(match![1]), `documented total in ${file}`).toBe(stats.total);
      expect(Number(match![2]), `documented category count in ${file}`).toBe(categories);
    }
  });

  it('keeps the counts in the troubleshooting and architecture docs in sync', async () => {
    const stats = await matcher.getPatternStats();
    const categories = Object.keys(stats.byCategory).length;
    for (const file of ['../../docs/Troubleshooting-Guide.md', '../../docs/Architecture-Overview.md']) {
      const text = (await readFile(new URL(file, import.meta.url), 'utf-8')).replace(/\*\*/g, '');
      const totals = [...text.matchAll(/(\d+)\s+(?:known\s+error\s+)?patterns\b/gi)].map((m) => Number(m[1]));
      expect(totals.length, `pattern total missing in ${file}`).toBeGreaterThan(0);
      for (const total of totals) expect(total, `documented total in ${file}`).toBe(stats.total);
      for (const m of text.matchAll(/(\d+)\s+categories/gi)) {
        expect(Number(m[1]), `documented category count in ${file}`).toBe(categories);
      }
    }
    // Architecture-Overview lists each category as "• name (N)".
    const arch = await readFile(new URL('../../docs/Architecture-Overview.md', import.meta.url), 'utf-8');
    const documented: Record<string, number> = {};
    for (const m of arch.matchAll(/• (\w+) \((\d+)\)/g)) documented[m[1]] = Number(m[2]);
    expect(documented).toEqual(stats.byCategory);
  });

  it('keeps the per-category counts in the class JSDoc in sync', async () => {
    const stats = await matcher.getPatternStats();
    const text = await readFile(new URL('../../src/terragrunt/error-patterns.ts', import.meta.url), 'utf-8');
    // Lines such as " * - configuration: Syntax errors, ... (48 patterns)".
    const documented: Record<string, number> = {};
    for (const m of text.matchAll(/^ \* - (\w+): .*\((\d+) patterns?\)$/gm)) {
      documented[m[1]] = Number(m[2]);
    }
    expect(documented).toEqual(stats.byCategory);
  });
});
