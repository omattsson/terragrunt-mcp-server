import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import {
  WATCHED_PATHS,
  buildReport,
  compareStatusMeansDrift,
  type PathState,
} from '../../scripts/check-upstream-drift.js';

describe('WATCHED_PATHS', () => {
  it('has unique paths, each with a reason', () => {
    const paths = WATCHED_PATHS.map(w => w.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const w of WATCHED_PATHS) {
      expect(w.reason.length).toBeGreaterThan(0);
    }
  });

  it('covers every evidence file listed in docs/upstream-parity.md', async () => {
    const doc = await readFile(new URL('../../docs/upstream-parity.md', import.meta.url), 'utf-8');
    // Backtick-quoted upstream Go paths in the modern-diagnosis evidence list.
    const evidence = [...doc.matchAll(/`((?:pkg|internal)\/[\w/.-]+\.go)`/g)].map(m => m[1]);
    expect(evidence.length).toBeGreaterThan(0);
    const watched = new Set(WATCHED_PATHS.map(w => w.path));
    for (const file of new Set(evidence)) {
      expect(watched.has(file), `${file} listed in upstream-parity.md but not watched`).toBe(true);
    }
  });
});

describe('compareStatusMeansDrift', () => {
  it('treats ahead and diverged as drift', () => {
    expect(compareStatusMeansDrift('ahead')).toBe(true);
    expect(compareStatusMeansDrift('diverged')).toBe(true);
  });

  it('treats identical and behind as no drift', () => {
    expect(compareStatusMeansDrift('identical')).toBe(false);
    expect(compareStatusMeansDrift('behind')).toBe(false);
  });
});

describe('buildReport', () => {
  const commit = { sha: 'abc123', date: '2026-09-01T00:00:00Z', message: 'feat: x', url: 'https://example.invalid/c' };

  it('reports drift when a watched path changed since the pin', () => {
    const states: PathState[] = [
      { path: 'a.go', reason: 'r1', changedSincePin: true, latestCommit: commit },
      { path: 'b.go', reason: 'r2', changedSincePin: false, latestCommit: commit },
    ];
    const report = buildReport('pin', 'head', 42, states);

    expect(report.hasDrift).toBe(true);
    expect(report.changed.map(c => c.path)).toEqual(['a.go']);
    expect(report.unchanged).toEqual(['b.go']);
    expect(report.pinnedRevision).toBe('pin');
    expect(report.upstreamHead).toBe('head');
    expect(report.aheadBy).toBe(42);
  });

  it('reports no drift when no watched path changed', () => {
    const states: PathState[] = [
      { path: 'a.go', reason: 'r1', changedSincePin: false, latestCommit: commit },
    ];
    const report = buildReport('pin', 'head', 500, states);

    expect(report.hasDrift).toBe(false);
    expect(report.changed).toEqual([]);
    // A large aheadBy alone is not drift; only watched-path changes are.
    expect(report.aheadBy).toBe(500);
  });
});
