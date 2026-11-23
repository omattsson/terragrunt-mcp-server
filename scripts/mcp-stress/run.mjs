#!/usr/bin/env node
/**
 * MCP stress test harness (report only: it never changes src/, tests or dist/).
 *
 *   node scripts/mcp-stress/run.mjs [--target dist|docker:<image>|fixture:bad-server]
 *     [--mode full|core|config|guidance|observability] [--groups a,b] [--duration 30]
 *     [--concurrency 100] [--seed N] [--quick] [--out stress-report/<ts>]
 *
 * Exit code: 0 no critical or high finding, 1 at least one, 2 harness or usage error.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Reporter, renderMarkdown } from './lib/report.mjs';
import { exitCodeFor } from './lib/oracles.mjs';
import { snapshotDiff } from './lib/oracles.mjs';
import { buildSpec, createSandbox, parseTarget, snapshotOutside } from './lib/sandbox.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALL_GROUPS = ['protocol', 'fuzz', 'load', 'writes', 'modes', 'hostile-docs', 'lifecycle'];
const QUICK_GROUPS = ['protocol', 'modes', 'fuzz'];
const FIXTURE_GROUPS = ['protocol', 'fuzz', 'writes'];
const MODES = ['full', 'core', 'config', 'guidance', 'observability'];

const USAGE = `Usage: node scripts/mcp-stress/run.mjs [options]
  --target dist|docker:<image>|fixture:bad-server   default dist
  --mode full|core|config|guidance|observability    default full
  --groups protocol,fuzz,load,writes,modes,hostile-docs,lifecycle
  --duration <seconds>      sustained load phase, default 30
  --concurrency <n>         parallel calls, default 100
  --seed <n>                default 1
  --quick                   protocol, modes and a reduced fuzz (under 60 s)
  --out <dir>               default stress-report/<timestamp>
  --call-timeout <ms>       hang limit per call, default 10000
  --max-error-rate <0-1>    load threshold, default 0.01
  --max-rss-growth-mb <n>   load threshold, default 300
  --max-p99-ms <n>          load threshold, default 5000
  --fixture-clean           run the fixture without its planted defects`;

function parseArgs(argv) {
  const opts = {
    target: 'dist', mode: 'full', modeExplicit: false, groups: null, duration: 30, concurrency: 100, seed: 1, quick: false, out: null,
    callTimeoutMs: 10000, maxErrorRate: 0.01, maxRssGrowthMb: 300, maxP99Ms: 5000, fixtureClean: false,
  };
  const valueFlags = {
    '--target': (v) => (opts.target = v),
    '--mode': (v) => {
      if (!MODES.includes(v)) throw new Error(`--mode must be one of ${MODES.join(', ')}`);
      opts.mode = v;
      opts.modeExplicit = true;
    },
    '--groups': (v) => (opts.groups = v.split(',').map((s) => s.trim()).filter(Boolean)),
    '--duration': (v) => (opts.duration = positive(v, '--duration')),
    '--concurrency': (v) => (opts.concurrency = Math.floor(positive(v, '--concurrency'))),
    '--seed': (v) => (opts.seed = Number.parseInt(v, 10)),
    '--out': (v) => (opts.out = v),
    '--call-timeout': (v) => (opts.callTimeoutMs = positive(v, '--call-timeout')),
    '--max-error-rate': (v) => (opts.maxErrorRate = Number(v)),
    '--max-rss-growth-mb': (v) => (opts.maxRssGrowthMb = positive(v, '--max-rss-growth-mb')),
    '--max-p99-ms': (v) => (opts.maxP99Ms = positive(v, '--max-p99-ms')),
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--quick') opts.quick = true;
    else if (flag === '--fixture-clean') opts.fixtureClean = true;
    else if (flag === '--help' || flag === '-h') {
      console.error(USAGE);
      process.exit(0);
    } else if (valueFlags[flag]) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      valueFlags[flag](value);
    } else throw new Error(`Unknown option ${flag}`);
  }
  if (Number.isNaN(opts.seed)) throw new Error('--seed must be an integer');
  return opts;
}

function positive(value, flag) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} must be a positive number`);
  return n;
}

function underRepoDir(dir, name) {
  const rel = path.relative(path.join(ROOT, name), dir);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  let target;
  try {
    target = parseTarget(opts.target);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (target.kind === 'fixture' && target.name !== 'bad-server') {
    console.error(`Unknown fixture ${target.name}`);
    return 2;
  }
  if (target.kind !== 'fixture' && !fs.existsSync(path.join(ROOT, 'dist', 'index.js'))) {
    console.error('dist/index.js is missing: run npm run build first');
    return 2;
  }

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(ROOT, opts.out ?? path.join('stress-report', stamp));
  if (underRepoDir(outDir, 'dist') || underRepoDir(outDir, 'src')) {
    console.error('Refusing to write the report into dist/ or src/');
    return 2;
  }

  let groupNames = opts.groups ?? (target.kind === 'fixture' ? FIXTURE_GROUPS : opts.quick ? QUICK_GROUPS : ALL_GROUPS);
  const unknown = groupNames.filter((g) => !ALL_GROUPS.includes(g));
  if (unknown.length > 0) {
    console.error(`Unknown group(s): ${unknown.join(', ')}`);
    return 2;
  }

  const box = createSandbox();
  const report = new Reporter();
  const ctx = {
    root: ROOT,
    target,
    targetName: opts.target + (target.kind === 'fixture' && opts.fixtureClean ? ' (clean)' : ''),
    box,
    report,
    opts,
    capabilities: { rss: target.kind !== 'docker' },
    spec: (o = {}) => buildSpec(target, box, ROOT, { mode: o.mode ?? opts.mode, writes: o.writes ?? false, extraEnv: o.extraEnv ?? {}, fixtureClean: opts.fixtureClean }),
  };

  console.error(`mcp-stress: target=${ctx.targetName} mode=${opts.mode} seed=${opts.seed} quick=${opts.quick} groups=${groupNames.join(',')}`);
  console.error(`mcp-stress: sandbox ${box.base}`);

  const canaryBefore = snapshotOutside(box);
  let harnessError = false;
  try {
    for (const groupName of groupNames) {
      const group = await import(`./groups/${groupName}.mjs`);
      const skip = group.supports(ctx);
      if (skip) {
        console.error(`mcp-stress: ${groupName}: skipped (${skip})`);
        report.groups.push({ name: groupName, status: 'skipped', durationMs: 0, notes: [skip] });
        continue;
      }
      const t0 = Date.now();
      console.error(`mcp-stress: ${groupName}: running`);
      try {
        const out = (await group.run(ctx)) ?? {};
        report.groups.push({ name: groupName, status: 'done', durationMs: Date.now() - t0, notes: out.notes ?? [] });
      } catch (error) {
        harnessError = true;
        console.error(`mcp-stress: ${groupName}: harness error: ${error.stack ?? error}`);
        report.groups.push({ name: groupName, status: 'error', durationMs: Date.now() - t0, notes: [String(error.message).slice(0, 300)] });
      }
    }
    // Global canary check after everything
    const diff = snapshotDiff(canaryBefore, snapshotOutside(box));
    const touched = [...diff.changed, ...diff.created, ...diff.removed];
    if (touched.length > 0 && !report.findings.some((f) => f.kind === 'write-escape')) {
      report.add({
        severity: 'critical',
        group: 'run',
        kind: 'write-escape',
        title: 'Files outside the sandbox changed during the run',
        expected: 'no change outside ALLOWED_DIRS',
        actual: touched.map((f) => path.relative(box.base, f)).join(', '),
        reproducer: { target: ctx.targetName, seed: opts.seed, groups: groupNames },
      });
    }
  } finally {
    box.cleanup();
  }

  const meta = {
    target: opts.target,
    targetDescription: ctx.spec().description,
    mode: opts.mode,
    seed: opts.seed,
    quick: opts.quick,
    node: process.version,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    groups: groupNames,
    options: { duration: opts.duration, concurrency: opts.concurrency, callTimeoutMs: opts.callTimeoutMs },
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(meta, report));
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ meta, summary: report.summary(), groups: report.groups, metrics: report.metrics, findings: report.sorted() }, null, 2) + '\n');

  const s = report.summary();
  console.error(`mcp-stress: findings critical=${s.critical} high=${s.high} medium=${s.medium} info=${s.info}`);
  console.error(`mcp-stress: report ${path.join(outDir, 'report.md')}`);
  const code = exitCodeFor(report.findings);
  return code === 0 && harnessError ? 2 : code;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`mcp-stress: fatal: ${error.stack ?? error}`);
    process.exit(2);
  },
);
