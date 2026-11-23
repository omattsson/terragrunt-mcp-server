/**
 * Harness self-test: proves the oracles can fail. The broken fixture plants
 * four defects and the stress run must report exactly those; the same fixture
 * with the defects switched off must report nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN = path.join(ROOT, 'scripts', 'mcp-stress', 'run.mjs');

interface Finding { severity: string; group: string; kind: string; tool: string | null; title: string }

function stress(out: string, extra: string[]): { status: number | null; findings: Finding[] } {
  const r = spawnSync(process.execPath, [RUN, '--target', 'fixture:bad-server', '--call-timeout', '2000', '--out', out, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90_000,
  });
  const results = JSON.parse(readFileSync(path.join(out, 'results.json'), 'utf8'));
  return { status: r.status, findings: results.findings };
}

describe('mcp-stress harness self-test', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mcp-stress-selftest-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports exactly the four planted defects of the broken fixture', () => {
    const { status, findings } = stress(path.join(dir, 'bad'), []);
    expect(status).toBe(1);
    const found = new Set(findings.map((f) => `${f.severity}:${f.kind}`));
    expect(found).toEqual(new Set(['high:stdout-pollution', 'critical:crash', 'critical:hang', 'critical:write-escape']));
    expect(findings.find((f) => f.kind === 'crash')?.tool).toBe('echo');
    expect(findings.find((f) => f.kind === 'hang')?.tool).toBe('echo');
    expect(findings.find((f) => f.kind === 'write-escape')?.tool).toBe('build_config');
  }, 100_000);

  it('reports nothing for the clean fixture', () => {
    const { status, findings } = stress(path.join(dir, 'clean'), ['--fixture-clean']);
    expect(findings.map((f) => `${f.kind}: ${f.title}`)).toEqual([]);
    expect(status).toBe(0);
  }, 100_000);
});
