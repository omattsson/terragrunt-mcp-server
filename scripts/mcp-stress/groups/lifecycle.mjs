/**
 * lifecycle: shutdown paths and persisted state. stdin close and SIGTERM exit
 * cleanly, a SIGKILL mid-call leaves state a restart can use, corrupt cache and
 * metrics files and read-only state directories do not take the server down.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { RawServer } from '../lib/rpc.mjs';
import { ManagedSession, removeContainer } from '../lib/client.mjs';
import { createRng } from '../lib/payloads.mjs';

export const name = 'lifecycle';

export function supports(ctx) {
  if (ctx.target.kind === 'fixture') return 'the fixture has no persisted state';
  return null;
}

function clearState(box) {
  for (const dir of [box.cache, box.metrics]) {
    fs.chmodSync(dir, 0o755);
    for (const entry of fs.readdirSync(dir)) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

async function startRaw(ctx, specOptions = {}) {
  const server = new RawServer(ctx.spec(specOptions));
  const init = await server.initialize(20000);
  if (!init) throw new Error(`lifecycle: server did not answer initialize: ${server.stderrTail.slice(-300)}`);
  return server;
}

export async function run(ctx) {
  const { report, box, opts } = ctx;
  const docker = ctx.target.kind === 'docker';
  const notes = [];
  const base = { target: ctx.targetName };

  // 1. stdin close
  {
    clearState(box);
    const server = await startRaw(ctx);
    const t = Date.now();
    server.child.stdin.end();
    const exited = await server.waitExit(5000);
    if (!exited || server.exitCode !== 0) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'shutdown',
        title: exited ? `Exit code ${server.exitCode} after stdin closed` : 'Server keeps running after stdin is closed',
        expected: 'exit code 0 within 5 s',
        actual: exited ? `exit code ${server.exitCode}, signal ${server.signal} after ${Date.now() - t} ms` : 'still running after 5 s',
        reproducer: { ...base, step: 'initialize, then close stdin' },
      });
    }
    await server.stop();
    await removeContainer(server.spec);
    notes.push('stdin close checked');
  }

  if (docker) return { notes: [...notes, 'SIGTERM, SIGKILL and state tests skipped for docker'] };

  // 2. SIGTERM
  {
    clearState(box);
    const server = await startRaw(ctx);
    server.kill('SIGTERM');
    const exited = await server.waitExit(5000);
    if (!exited) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'shutdown',
        title: 'Server ignores SIGTERM',
        expected: 'exit within 5 s of SIGTERM',
        actual: 'still running after 5 s',
        reproducer: { ...base, step: 'initialize, then send SIGTERM' },
      });
      await server.stop();
    }
    notes.push('SIGTERM checked');
  }

  // 3. SIGKILL in the middle of calls, then restart on the same state directories
  {
    clearState(box);
    const server = await startRaw(ctx);
    for (let i = 0; i < 8; i++) {
      void server.sendJson({ jsonrpc: '2.0', id: `k${i}`, method: 'tools/call', params: { name: i % 2 ? 'search_docs' : 'get_server_metrics', arguments: i % 2 ? { query: 'dependency' } : {} } });
    }
    await new Promise((r) => setTimeout(r, 15));
    server.kill('SIGKILL');
    await server.waitExit(3000);
    const managed = await new ManagedSession(ctx, { group: name }).start();
    try {
      const r = await managed.call('search_docs', { query: 'dependency' }, { label: 'after-sigkill', checkShape: false });
      if (r.timedOut || r.error || r.result?.isError) {
        report.add({
          severity: 'critical',
          group: name,
          kind: 'corrupt-state',
          tool: 'search_docs',
          title: 'Server cannot serve after a SIGKILL mid-call',
          expected: 'a restart on the same cache and metrics directories works',
          actual: r.error ? String(r.error.message) : JSON.stringify(r.result)?.slice(0, 200),
          reproducer: { ...base, step: 'send 8 calls, SIGKILL after 15 ms, restart with the same state directories' },
        });
      }
    } finally {
      await managed.close();
    }
    notes.push('SIGKILL restart checked');
  }

  // 4. Corrupt cache files (a long TTL makes the server try to use them)
  {
    const validGzip = zlib.gzipSync(Buffer.from(JSON.stringify({ version: 1, timestamp: Date.now(), sections: [] })));
    const rng = createRng(opts.seed);
    const noise = Buffer.from(Array.from({ length: 4096 }, () => Math.floor(rng() * 256)));
    const variants = [
      ['random-bytes', noise],
      ['truncated-gzip', validGzip.subarray(0, Math.floor(validGzip.length / 2))],
      ['gzip-of-invalid-json', zlib.gzipSync(Buffer.from('{"sections": [1, 2'))],
      ['gzip-of-wrong-shape', zlib.gzipSync(Buffer.from('{"sections": "no", "timestamp": "x"}'))],
      ['empty-file', Buffer.alloc(0)],
      ['json-null', Buffer.from('null')],
    ];
    for (const [id, bytes] of variants) {
      clearState(box);
      fs.writeFileSync(path.join(box.cache, 'docs-cache.json.gz'), bytes);
      fs.writeFileSync(path.join(box.cache, 'docs-cache.json'), bytes);
      await tryServing(ctx, `corrupt-cache:${id}`, { TERRAGRUNT_MCP_CACHE_TTL_HOURS: '24' }, { cacheFile: id });
    }
    notes.push(`${variants.length} corrupt cache variants`);
  }

  // 5. Corrupt metrics files
  {
    const today = new Date().toISOString().slice(0, 10);
    const targets = ['summary.json', 'config.json', path.join('snapshots', `${today}.json`)];
    for (const file of targets) {
      for (const [id, content] of [['garbage', '\u0000\u0001{{{ not json'], ['wrong-shape', '[1,2,3]'], ['empty', '']]) {
        clearState(box);
        fs.mkdirSync(path.join(box.metrics, 'snapshots'), { recursive: true });
        fs.writeFileSync(path.join(box.metrics, file), content);
        await tryServing(ctx, `corrupt-metrics:${file}:${id}`, {}, { metricsFile: file, content: id }, true);
      }
    }
    notes.push(`${targets.length * 3} corrupt metrics variants`);
  }

  // 6. Read-only cache and metrics directories
  {
    clearState(box);
    fs.chmodSync(box.cache, 0o555);
    fs.chmodSync(box.metrics, 0o555);
    try {
      await tryServing(ctx, 'read-only-state-dirs', {}, { chmod: '555 on cache and metrics' }, true);
    } finally {
      fs.chmodSync(box.cache, 0o755);
      fs.chmodSync(box.metrics, 0o755);
    }
    notes.push('read-only directories checked');
  }
  return { notes };
}

/** Start a server on the prepared state and make a docs and a metrics call. */
async function tryServing(ctx, id, extraEnv, detail, withMetrics = false) {
  const { report } = ctx;
  const repro = { target: ctx.targetName, case: id, ...detail, env: extraEnv, tool: 'search_docs', arguments: { query: 'dependency' } };
  let managed;
  try {
    managed = await new ManagedSession(ctx, { group: name, specOptions: { extraEnv } }).start();
  } catch (error) {
    report.add({
      severity: 'high',
      group: name,
      kind: 'corrupt-state',
      title: `Server fails to start with ${id}`,
      expected: 'the server starts and ignores or replaces the unusable file',
      actual: String(error?.message ?? error).slice(0, 300),
      reproducer: repro,
    });
    return;
  }
  try {
    const r = await managed.call('search_docs', { query: 'dependency' }, { label: id, checkShape: false });
    let results = null;
    try {
      results = JSON.parse(r.result?.content?.[0]?.text ?? '').results;
    } catch {
      results = null;
    }
    if (!r.timedOut && !r.error && !(Array.isArray(results) && results.length > 0)) {
      report.add({
        severity: 'high',
        group: name,
        kind: 'corrupt-state',
        tool: 'search_docs',
        title: `search_docs returns nothing with ${id}`,
        expected: 'results from the bundled fixture',
        actual: String(r.result?.content?.[0]?.text).slice(0, 200),
        reproducer: repro,
      });
    }
    if (withMetrics) {
      const m = await managed.call('get_server_metrics', {}, { label: id, checkShape: false });
      if (!m.timedOut && !m.error && m.result?.isError) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'corrupt-state',
          tool: 'get_server_metrics',
          title: `get_server_metrics fails with ${id}`,
          expected: 'metrics are served from memory',
          actual: String(m.result?.content?.[0]?.text).slice(0, 200),
          reproducer: { ...repro, tool: 'get_server_metrics', arguments: {} },
        });
      }
    }
  } finally {
    await managed.close();
  }
}
