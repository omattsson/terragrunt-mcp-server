import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { UPSTREAM_REVISION } from '../../src/terragrunt/docs-manifest.js';

interface ExperimentsFixture {
  upstreamRevision: string;
  active: string[];
  completed: string[];
}

async function load(): Promise<ExperimentsFixture> {
  const raw = await readFile(new URL('../../fixtures/terragrunt-experiments.json', import.meta.url), 'utf-8');
  return JSON.parse(raw);
}

describe('terragrunt-experiments.json', () => {
  it('is pinned to the same upstream revision as the docs manifest', async () => {
    const fx = await load();
    expect(fx.upstreamRevision).toBe(UPSTREAM_REVISION);
  });

  it('has non-empty, sorted, disjoint active and completed lists', async () => {
    const fx = await load();
    expect(fx.active.length).toBeGreaterThan(0);
    expect(fx.completed.length).toBeGreaterThan(0);
    expect(fx.active).toEqual([...fx.active].sort());
    expect(fx.completed).toEqual([...fx.completed].sort());
    const overlap = fx.active.filter((n) => fx.completed.includes(n));
    expect(overlap, `experiments on both sides: ${overlap.join(', ')}`).toEqual([]);
  });

  it('classifies the audited experiments correctly', async () => {
    const fx = await load();
    for (const name of ['deep-merge', 'block-iteration', 'oci', 'version-attribute', 'mutable-generate']) {
      expect(fx.active, `${name} should be active`).toContain(name);
    }
    for (const name of ['cas', 'cli-redesign', 'stacks']) {
      expect(fx.completed, `${name} should be completed`).toContain(name);
    }
  });
});
