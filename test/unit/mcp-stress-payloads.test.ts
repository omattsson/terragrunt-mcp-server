import { describe, it, expect } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { createRng, generateArgs, baselineArgs } from '../../scripts/mcp-stress/lib/payloads.mjs';

const tool = {
  name: 'demo',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['a', 'b'] },
      query: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 10 },
      flag: { type: 'boolean' },
      options: { type: 'object', additionalProperties: true },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['query'],
  },
};

describe('createRng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('baselineArgs', () => {
  it('fills required properties with a value of the declared type', () => {
    const args = baselineArgs(tool.inputSchema);
    expect(typeof args.query).toBe('string');
  });
});

describe('generateArgs', () => {
  it('is reproducible for the same seed', () => {
    const one = generateArgs(tool, { seed: 1 });
    const two = generateArgs(tool, { seed: 1 });
    expect(JSON.stringify(one)).toEqual(JSON.stringify(two));
  });

  it('gives every case a unique id, a label and an args object', () => {
    const cases = generateArgs(tool, { seed: 1 });
    expect(cases.length).toBeGreaterThan(50);
    expect(new Set(cases.map((c: any) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(typeof c.label).toBe('string');
      expect(c.args !== null && typeof c.args === 'object').toBe(true);
    }
  });

  it('omits each required property in one case', () => {
    const cases = generateArgs(tool, { seed: 1 });
    expect(cases.some((c: any) => !('query' in c.args))).toBe(true);
  });

  it('sends wrong types, enum violations and integer extremes', () => {
    const cases = generateArgs(tool, { seed: 1 });
    const values = (prop: string) => cases.filter((c: any) => prop in c.args).map((c: any) => c.args[prop]);
    expect(values('query').some((v: unknown) => v === null)).toBe(true);
    expect(values('query').some((v: unknown) => typeof v === 'number')).toBe(true);
    expect(values('mode').some((v: unknown) => typeof v === 'string' && !['a', 'b'].includes(v))).toBe(true);
    expect(values('limit').some((v: unknown) => v === Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(values('limit').some((v: unknown) => typeof v === 'number' && v < 0)).toBe(true);
  });

  it('includes hostile strings: NUL, traversal, 1 MB and unicode', () => {
    const strings = generateArgs(tool, { seed: 1 })
      .map((c: any) => c.args.query)
      .filter((v: unknown): v is string => typeof v === 'string');
    expect(strings.some((s: string) => s.includes('\u0000'))).toBe(true);
    expect(strings.some((s: string) => s.includes('../'))).toBe(true);
    expect(strings.some((s: string) => s.length >= 1_000_000)).toBe(true);
    expect(strings.some((s: string) => Array.from(s).some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f))).toBe(true);
  });

  it('serialises __proto__ and constructor keys as own properties', () => {
    const cases = generateArgs(tool, { seed: 1 });
    const json = cases.map((c: any) => JSON.stringify(c.args));
    expect(json.some((s: string) => s.includes('"__proto__"'))).toBe(true);
    expect(json.some((s: string) => s.includes('"constructor"'))).toBe(true);
  });

  it('includes extra properties and deep nesting', () => {
    const cases = generateArgs(tool, { seed: 1 });
    expect(cases.some((c: any) => Object.keys(c.args).some((k) => !(k in tool.inputSchema.properties) && k !== '__proto__' && k !== 'constructor'))).toBe(true);
    const deep = cases.find((c: any) => c.label.includes('deep'));
    expect(deep).toBeDefined();
  });

  it('quick mode produces fewer cases, all taken from the full set', () => {
    const full = generateArgs(tool, { seed: 3 });
    const quick = generateArgs(tool, { seed: 3, quick: true });
    expect(quick.length).toBeLessThan(full.length);
    expect(quick.length).toBeGreaterThan(10);
    const fullIds = new Set(full.map((c: any) => c.id));
    for (const c of quick) expect(fullIds.has(c.id)).toBe(true);
  });

  it('handles a tool without a schema', () => {
    const cases = generateArgs({ name: 'bare' }, { seed: 1 });
    expect(cases.length).toBeGreaterThan(0);
  });
});
