import { describe, it, expect } from 'vitest';
import {
  checkStdoutLines,
  findStackLeak,
  checkCrash,
  checkHang,
  checkErrorShape,
  snapshotDiff,
  makeFinding,
  summarize,
  exitCodeFor,
// @ts-expect-error plain ESM script without type declarations
} from '../../scripts/mcp-stress/lib/oracles.mjs';

describe('checkStdoutLines', () => {
  it('accepts JSON-RPC lines and blank lines', () => {
    const lines = ['{"jsonrpc":"2.0","id":1,"result":{}}', '', '{"jsonrpc":"2.0","method":"x"}'];
    expect(checkStdoutLines(lines)).toEqual([]);
  });

  it('flags text, JSON without jsonrpc, and non-object JSON', () => {
    const bad = checkStdoutLines(['DEBUG hello', '{"foo":1}', '[1,2]', '42']);
    expect(bad.map((b: any) => b.line)).toEqual(['DEBUG hello', '{"foo":1}', '[1,2]', '42']);
  });

  it('accepts a JSON-RPC batch array', () => {
    expect(checkStdoutLines(['[{"jsonrpc":"2.0","id":1,"result":{}}]'])).toEqual([]);
  });
});

describe('findStackLeak', () => {
  it('detects stack frames and install paths', () => {
    expect(findStackLeak('TypeError: x\n    at foo (/app/dist/handlers/tools.js:10:5)').length).toBeGreaterThan(0);
    expect(findStackLeak('see /app/node_modules/foo/index.js')).not.toEqual([]);
    expect(findStackLeak('at file:///app/dist/index.js:1:1')).not.toEqual([]);
  });

  it('ignores ordinary messages', () => {
    expect(findStackLeak('path parameter must be a string')).toEqual([]);
    expect(findStackLeak('No Terragrunt function found: nope')).toEqual([]);
  });
});

describe('checkCrash', () => {
  it('reports an unexpected exit', () => {
    expect(checkCrash({ alive: false, exitCode: 1, signal: null })).toMatch(/exit code 1/);
    expect(checkCrash({ alive: false, exitCode: null, signal: 'SIGSEGV' })).toMatch(/SIGSEGV/);
  });
  it('is quiet for a live process', () => {
    expect(checkCrash({ alive: true })).toBeNull();
  });
});

describe('checkHang', () => {
  it('reports a timeout or a slow answer', () => {
    expect(checkHang({ timedOut: true, elapsedMs: 10000, limitMs: 10000 })).toMatch(/no answer/);
    expect(checkHang({ timedOut: false, elapsedMs: 12000, limitMs: 10000 })).toMatch(/12000/);
  });
  it('accepts a fast answer', () => {
    expect(checkHang({ timedOut: false, elapsedMs: 20, limitMs: 10000 })).toBeNull();
  });
});

describe('checkErrorShape', () => {
  it('accepts a well-formed isError result and a plain success', () => {
    expect(checkErrorShape({ isError: true, content: [{ type: 'text', text: '{"error":"bad"}' }] })).toEqual([]);
    expect(checkErrorShape({ content: [{ type: 'text', text: '{"ok":1}' }] })).toEqual([]);
  });
  it('flags an error body without isError, and isError without a message', () => {
    expect(checkErrorShape({ content: [{ type: 'text', text: '{"error":"bad"}' }] })).not.toEqual([]);
    expect(checkErrorShape({ content: [{ type: 'text', text: '{"success":false}' }] })).not.toEqual([]);
    expect(checkErrorShape({ isError: true, content: [{ type: 'text', text: '{}' }] })).not.toEqual([]);
  });
  it('flags a result without text content', () => {
    expect(checkErrorShape({ content: [] })).not.toEqual([]);
    expect(checkErrorShape(null)).not.toEqual([]);
  });
});

describe('snapshotDiff', () => {
  it('reports changed, created and removed files', () => {
    const before = { '/c/a': 'h1', '/c/b': 'h2' };
    const after = { '/c/a': 'h9', '/c/new': 'h3' };
    expect(snapshotDiff(before, after)).toEqual({ changed: ['/c/a'], created: ['/c/new'], removed: ['/c/b'] });
  });
  it('is empty for identical snapshots', () => {
    expect(snapshotDiff({ '/a': 'x' }, { '/a': 'x' })).toEqual({ changed: [], created: [], removed: [] });
  });
});

describe('findings', () => {
  const base = { group: 'fuzz', tool: 't', kind: 'crash', title: 'x', expected: 'e', actual: 'a', reproducer: { seed: 1 } };

  it('rejects an unknown severity', () => {
    expect(() => makeFinding({ ...base, severity: 'bogus' })).toThrow(/severity/);
  });

  it('summarises by severity', () => {
    const f = (severity: string) => makeFinding({ ...base, severity });
    expect(summarize([f('critical'), f('high'), f('high'), f('info')])).toEqual({ critical: 1, high: 2, medium: 0, info: 1 });
  });

  it('exits 1 only for critical or high', () => {
    const f = (severity: string) => makeFinding({ ...base, severity });
    expect(exitCodeFor([f('medium'), f('info')])).toBe(0);
    expect(exitCodeFor([f('medium'), f('high')])).toBe(1);
    expect(exitCodeFor([f('critical')])).toBe(1);
    expect(exitCodeFor([])).toBe(0);
  });
});
