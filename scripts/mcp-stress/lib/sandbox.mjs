/**
 * Sandbox, hermetic environment and target launch specs.
 *
 * Layout of one run (all under a fresh mkdtemp directory, `base`):
 *   sandbox/  the only directory a write test may touch (ALLOWED_DIRS)
 *   canary/   files outside the sandbox whose hashes must never change
 *   cache/ metrics/ home/ work/   server state, HOME and working directory
 * Any new or changed entry elsewhere under `base` counts as an escape.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, rmSync, realpathSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Directories under `base` that the server may legitimately write to. */
const LEGIT = new Set(['sandbox', 'cache', 'metrics', 'home', 'work']);

export const CANARY_FILES = {
  'secret.hcl': 'CANARY-SECRET-4f9c1d: this file must never be read or changed by the server\n',
  'notes.txt': 'canary notes, do not touch\n',
  'nested/deep.hcl': 'CANARY-NESTED-77aa: untouched\n',
};
export const CANARY_MARKER = 'CANARY-SECRET-4f9c1d';

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function createSandbox() {
  const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'mcp-stress-')));
  const dirs = {
    base,
    sandbox: path.join(base, 'sandbox'),
    canary: path.join(base, 'canary'),
    cache: path.join(base, 'cache'),
    metrics: path.join(base, 'metrics'),
    home: path.join(base, 'home'),
    work: path.join(base, 'work'),
  };
  for (const d of [dirs.sandbox, dirs.canary, dirs.cache, dirs.metrics, dirs.home, dirs.work]) mkdirSync(d, { recursive: true });
  const box = { ...dirs, cleanup: () => rmSync(base, { recursive: true, force: true }) };
  seedCanaries(box);
  return box;
}

/** (Re)write the canary files with their known content. */
export function seedCanaries(box) {
  for (const [rel, content] of Object.entries(CANARY_FILES)) {
    const file = path.join(box.canary, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

/** Empty the sandbox directory (between cases). */
export function resetSandbox(box) {
  rmSync(box.sandbox, { recursive: true, force: true });
  mkdirSync(box.sandbox, { recursive: true });
}

/** Remove anything under base that is not part of the layout, and restore the canaries. */
export function restoreOutside(box) {
  for (const name of readdirSync(box.base)) {
    if (LEGIT.has(name) || name === 'canary') continue;
    rmSync(path.join(box.base, name), { recursive: true, force: true });
  }
  rmSync(box.canary, { recursive: true, force: true });
  mkdirSync(box.canary, { recursive: true });
  seedCanaries(box);
}

/** {path: sha256 | '<dir>' | '<symlink>'} for everything under base outside the legitimate directories. */
export function snapshotOutside(box) {
  const out = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = lstatSync(full);
      if (st.isSymbolicLink()) out[full] = '<symlink>';
      else if (st.isDirectory()) {
        out[full] = '<dir>';
        walk(full);
      } else out[full] = sha256(readFileSync(full)) + `:${st.nlink}`;
    }
  };
  for (const name of readdirSync(box.base)) {
    if (LEGIT.has(name)) continue;
    const full = path.join(box.base, name);
    const st = lstatSync(full);
    if (st.isDirectory() && !st.isSymbolicLink()) {
      out[full] = '<dir>';
      walk(full);
    } else if (st.isSymbolicLink()) out[full] = '<symlink>';
    else out[full] = sha256(readFileSync(full)) + `:${st.nlink}`;
  }
  return out;
}

/**
 * Refuse an ALLOWED_DIRS value that is the filesystem root, contains $HOME, or
 * lies outside the run's sandbox directory.
 */
export function assertSafeAllowedDirs(allowed, box) {
  const home = safeReal(homedir());
  for (const raw of String(allowed).split(',').map((s) => s.trim()).filter(Boolean)) {
    const dir = path.resolve(raw);
    if (path.parse(dir).root === dir) throw new Error(`Refusing to run: ALLOWED_DIRS contains the filesystem root (${raw})`);
    if (isWithin(home, dir) || isWithin(homedir(), dir)) throw new Error(`Refusing to run: ALLOWED_DIRS (${raw}) would contain $HOME`);
    if (!isWithin(dir, box.sandbox) && !isWithin(dir, '/stress/sandbox')) throw new Error(`Refusing to run: ALLOWED_DIRS (${raw}) is outside the sandbox`);
  }
}

function safeReal(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function isWithin(candidate, dir) {
  const c = path.resolve(candidate);
  const d = path.resolve(dir);
  return c === d || c.startsWith(d + path.sep);
}

export function parseTarget(value) {
  if (value === 'dist') return { kind: 'dist' };
  if (value.startsWith('docker:') && value.length > 'docker:'.length) return { kind: 'docker', image: value.slice('docker:'.length) };
  if (value.startsWith('fixture:')) return { kind: 'fixture', name: value.slice('fixture:'.length) };
  throw new Error(`Unknown --target ${value} (use dist, docker:<image> or fixture:bad-server)`);
}

/**
 * Hermetic server environment: no network source, no retries, no cache reuse,
 * all state and HOME inside the sandbox. Writes are off unless asked for.
 */
export function hermeticEnv(box, { writes = false, extra = {}, inContainer = false } = {}) {
  const env = {
    TERRAGRUNT_MCP_LLMS_SOURCE: 'http://127.0.0.1:9/llms-small.txt',
    TERRAGRUNT_MCP_RETRY_MAX_RETRIES: '0',
    TERRAGRUNT_MCP_CACHE_TTL_HOURS: '0',
    TERRAGRUNT_MCP_FILE_WRITE_ENABLED: writes ? 'true' : 'false',
  };
  if (!inContainer) {
    env.TERRAGRUNT_MCP_CACHE_DIR = box.cache;
    env.TERRAGRUNT_MCP_METRICS_DIR = box.metrics;
  }
  if (writes) env.TERRAGRUNT_MCP_ALLOWED_DIRS = inContainer ? '/stress/sandbox' : box.sandbox;
  return { ...env, ...extra };
}

/**
 * Build the process spec for a target.
 *
 * @returns {{command: string, args: string[], env: object, cwd: string, kind: string, hostToTarget: (p: string) => string, canMeasureRss: boolean, description: string}}
 */
export function buildSpec(target, box, root, { mode = 'full', writes = false, extraEnv = {}, fixtureClean = false } = {}) {
  const modeArgs = mode && mode !== 'full' ? ['--mode', mode] : [];
  if (target.kind === 'docker') {
    const env = hermeticEnv(box, { writes, extra: extraEnv, inContainer: true });
    const containerName = `mcp-stress-${randomBytes(4).toString('hex')}`;
    const args = ['run', '-i', '--rm', '--name', containerName, '--network', 'none', '--read-only', '--tmpfs', '/cache'];
    // The whole run directory is mounted so canaries are visible to symlink tests, but only sandbox/ is allowed
    if (writes) args.push('-v', `${box.base}:/stress`);
    for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
    args.push(target.image, 'node', 'dist/index.js', ...modeArgs);
    if (writes) assertSafeAllowedDirs(env.TERRAGRUNT_MCP_ALLOWED_DIRS, box);
    return {
      kind: 'docker',
      containerName,
      command: 'docker',
      args,
      env: pickEnv(['PATH', 'HOME', 'DOCKER_HOST', 'DOCKER_CONFIG', 'DOCKER_CONTEXT']),
      cwd: box.work,
      hostToTarget: (p) => (p.startsWith(box.base) ? '/stress' + p.slice(box.base.length) : p),
      canMeasureRss: false,
      description: `docker ${target.image}`,
    };
  }
  const env = hermeticEnv(box, { writes, extra: extraEnv });
  if (writes) assertSafeAllowedDirs(env.TERRAGRUNT_MCP_ALLOWED_DIRS, box);
  const full = { ...pickEnv(['PATH']), HOME: box.home, TMPDIR: box.work, ...env };
  if (target.kind === 'fixture') {
    if (fixtureClean) full.STRESS_FIXTURE_CLEAN = '1';
    return {
      kind: 'fixture',
      command: process.execPath,
      args: [path.join(root, 'scripts', 'mcp-stress', 'fixtures', `${target.name}.mjs`)],
      env: full,
      cwd: box.work,
      hostToTarget: (p) => p,
      canMeasureRss: true,
      description: `fixture ${target.name}${fixtureClean ? ' (clean)' : ''}`,
    };
  }
  return {
    kind: 'dist',
    command: process.execPath,
    args: [path.join(root, 'dist', 'index.js'), ...modeArgs],
    env: full,
    cwd: box.work,
    hostToTarget: (p) => p,
    canMeasureRss: true,
    description: 'dist/index.js',
  };
}

function pickEnv(names) {
  const out = {};
  for (const n of names) if (process.env[n] !== undefined) out[n] = process.env[n];
  return out;
}
