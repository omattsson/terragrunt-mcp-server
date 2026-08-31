import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

const matcher = new ErrorPatternMatcher(new TerragruntDocsManager());

describe('getPatternStats', () => {
  it('reports the total and a per-category breakdown computed from the array', async () => {
    const stats = await matcher.getPatternStats();
    expect(stats.total).toBe(101);
    expect(stats.byCategory).toMatchObject({
      configuration: 46,
      state: 3,
      dependency: 13,
      backend: 8,
      terraform: 3,
      authentication: 3,
      network: 2,
      stack: 6,
      oci: 10,
      engine: 6,
      experiment: 1,
    });
  });

  it('has a per-category breakdown that sums to the total', async () => {
    const stats = await matcher.getPatternStats();
    const summed = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(summed).toBe(stats.total);
  });

  it('exposes exactly 11 categories', async () => {
    const stats = await matcher.getPatternStats();
    expect(Object.keys(stats.byCategory).length).toBe(11);
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
});
