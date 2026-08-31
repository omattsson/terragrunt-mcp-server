import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import {
  EXPERIMENTS,
  EXPERIMENT_REVISION,
  getExperiment,
  experimentEnablement,
  describeGate,
} from '../../src/terragrunt/experiments.js';
import { UPSTREAM_REVISION } from '../../src/terragrunt/docs-manifest.js';

describe('EXPERIMENTS inventory', () => {
  it('has 19 active and 12 completed, all with unique names and summaries', () => {
    const active = EXPERIMENTS.filter((e) => e.status === 'active');
    const completed = EXPERIMENTS.filter((e) => e.status === 'completed');
    expect(active.length).toBe(19);
    expect(completed.length).toBe(12);
    const names = EXPERIMENTS.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const e of EXPERIMENTS) expect(e.summary.length).toBeGreaterThan(0);
  });

  it('is pinned to the docs-manifest revision', () => {
    expect(EXPERIMENT_REVISION).toBe(UPSTREAM_REVISION);
  });

  it('matches the active/completed split in the #244 fixture', async () => {
    const raw = await readFile(new URL('../../fixtures/terragrunt-experiments.json', import.meta.url), 'utf-8');
    const fx = JSON.parse(raw) as { active: string[]; completed: string[] };
    const active = EXPERIMENTS.filter((e) => e.status === 'active').map((e) => e.name).sort();
    const completed = EXPERIMENTS.filter((e) => e.status === 'completed').map((e) => e.name).sort();
    expect(active).toEqual([...fx.active].sort());
    expect(completed).toEqual([...fx.completed].sort());
  });

  it('resolves experiments and builds enablement syntax', () => {
    expect(getExperiment('deep-merge')?.status).toBe('active');
    expect(getExperiment('nope')).toBeUndefined();
    expect(experimentEnablement('deep-merge')).toEqual({
      flag: '--experiment deep-merge',
      envVar: 'TG_EXPERIMENT=deep-merge',
    });
  });

  it('describes an active gate with enablement', () => {
    const gate = describeGate('block-iteration');
    expect(gate.status).toBe('active');
    expect(gate.enable).toEqual({ flag: '--experiment block-iteration', envVar: 'TG_EXPERIMENT=block-iteration' });
    expect(gate.summary.length).toBeGreaterThan(0);
  });

  it('describes a completed gate as default with no enablement', () => {
    const gate = describeGate('cas');
    expect(gate.status).toBe('completed');
    expect(gate.enable).toBeUndefined();
    expect(gate.note).toMatch(/default/i);
  });
});
