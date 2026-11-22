/**
 * hostile-docs: a local HTTP server (127.0.0.1 only) is the docs source and
 * misbehaves: oversized body, slow drip, gzip bomb, redirect loop, truncated
 * body, garbage. Expected: FETCH_TIMEOUT_MS and FETCH_MAX_BYTES are enforced,
 * the server falls back to the bundled fixture and never hangs.
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { setImmediate } from 'node:timers';
import { performance } from 'node:perf_hooks';
import { ManagedSession, rssKb } from '../lib/client.mjs';
import { resetSandbox } from '../lib/sandbox.mjs';

export const name = 'hostile-docs';

export function supports(ctx) {
  if (ctx.target.kind === 'docker') return 'the container runs with --network none and cannot reach a local server';
  if (ctx.target.kind === 'fixture') return 'the fixture fetches no docs';
  return null;
}

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 2000;
const TOTAL_OVERSIZE = 64 * 1024 * 1024;

function startHostileServer() {
  const stats = { hits: {}, bytesSent: {} };
  const bomb = zlib.gzipSync(Buffer.alloc(128 * 1024 * 1024, 0x61), { level: 9 });
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const route = (req.url ?? '/').split('?')[0];
    stats.hits[route] = (stats.hits[route] ?? 0) + 1;
    stats.bytesSent[route] ??= 0;
    const stream = (chunk, intervalMs) => {
      let timer = null;
      const tick = () => {
        if (res.destroyed || res.writableEnded) return;
        const ok = res.write(chunk);
        stats.bytesSent[route] += chunk.length;
        if (stats.bytesSent[route] >= TOTAL_OVERSIZE && intervalMs === 0) return res.end();
        if (intervalMs > 0) timer = setTimeout(tick, intervalMs);
        else if (ok) setImmediate(tick);
        else res.once('drain', tick);
      };
      res.on('close', () => timer && clearTimeout(timer));
      tick();
    };
    switch (route) {
      case '/oversize':
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return stream(Buffer.alloc(64 * 1024, 0x41), 0);
      case '/oversize-chunked-lies':
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '100' });
        return stream(Buffer.alloc(64 * 1024, 0x41), 0);
      case '/slow-drip':
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return stream(Buffer.from('x'), 200);
      case '/slow-headers':
        return void setTimeout(() => res.destroyed || res.end('late'), 60_000).unref();
      case '/gzip-bomb':
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip', 'Content-Length': String(bomb.length) });
        stats.bytesSent[route] = bomb.length;
        return res.end(bomb);
      case '/redirect-loop':
        res.writeHead(302, { Location: '/redirect-loop' });
        return res.end();
      case '/redirect-chain':
        res.writeHead(302, { Location: `/redirect-chain?n=${Number((req.url ?? '').split('n=')[1] ?? 0) + 1}` });
        return res.end();
      case '/truncated':
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '100000' });
        res.write('# Terragrunt\n\npartial');
        return setTimeout(() => res.socket?.destroy(), 100);
      case '/garbage':
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        return res.end(Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 131 + 7) % 256)));
      case '/empty':
        res.writeHead(200);
        return res.end();
      case '/server-error':
        res.writeHead(500);
        return res.end('boom');
      default:
        res.writeHead(404);
        return res.end();
    }
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, stats, port: server.address().port, close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }) });
    });
  });
}

const SCENARIOS = [
  { route: '/oversize', note: 'body far above FETCH_MAX_BYTES', checkBytes: true },
  { route: '/oversize-chunked-lies', note: 'Content-Length 100 but a stream follows', checkBytes: true },
  { route: '/slow-drip', note: 'one byte every 200 ms, never ends' },
  { route: '/slow-headers', note: 'no response headers for 60 s' },
  { route: '/gzip-bomb', note: '128 MB of "a" gzip-compressed to about 130 KB', memory: true },
  { route: '/redirect-loop', note: '302 to itself' },
  { route: '/redirect-chain', note: 'an endless chain of distinct redirects' },
  { route: '/truncated', note: 'Content-Length 100000 then the socket closes' },
  { route: '/garbage', note: 'binary body' },
  { route: '/empty', note: '200 with an empty body' },
  { route: '/server-error', note: 'HTTP 500' },
];

export async function run(ctx) {
  const { report, box, opts } = ctx;
  const hostile = await startHostileServer();
  const scenarios = opts.quick ? SCENARIOS.slice(0, 3) : SCENARIOS;
  const notes = [];
  const perScenario = {};
  try {
    for (const s of scenarios) {
      resetSandbox(box);
      const source = `http://127.0.0.1:${hostile.port}${s.route}`;
      const env = {
        TERRAGRUNT_MCP_LLMS_SOURCE: source,
        TERRAGRUNT_MCP_FETCH_MAX_BYTES: String(MAX_BYTES),
        TERRAGRUNT_MCP_FETCH_TIMEOUT_MS: String(TIMEOUT_MS),
        TERRAGRUNT_MCP_CACHE_TTL_HOURS: '0',
        TERRAGRUNT_MCP_CACHE_DIR: `${box.cache}/${s.route.slice(1)}`,
      };
      const managed = await new ManagedSession(ctx, { group: name, specOptions: { extraEnv: env, mode: 'full' } }).start();
      const pid = managed.session.server.pid;
      let peakKb = (await rssKb(pid)) ?? 0;
      const startKb = peakKb;
      const sampler = setInterval(async () => {
        const v = await rssKb(pid);
        if (v !== null && v > peakKb) peakKb = v;
      }, 100);
      const started = performance.now();
      // The docs load may happen at startup or on first use; the call covers both
      const callLimit = TIMEOUT_MS * 4 + 8000;
      const r = await managed.call('search_docs', { query: 'dependency' }, { label: `docs-${s.route}`, timeoutMs: callLimit, checkShape: false });
      const elapsedMs = Math.round(performance.now() - started);
      clearInterval(sampler);
      const growthMb = Math.round((peakKb - startKb) / 1024);
      let results = null;
      try {
        results = JSON.parse(r.result?.content?.[0]?.text ?? '').results;
      } catch {
        results = null;
      }
      const hits = hostile.stats.hits[s.route] ?? 0;
      perScenario[s.route] = { elapsedMs, rssGrowthMb: growthMb, serverHits: hits, bytesServed: hostile.stats.bytesSent[s.route] ?? 0, answeredWithResults: Array.isArray(results) && results.length > 0 };
      const repro = { target: ctx.targetName, env: { ...env, TERRAGRUNT_MCP_CACHE_DIR: '<temp>' }, scenario: s.route, hostileServer: `127.0.0.1:${hostile.port} (started by the harness)`, tool: 'search_docs', arguments: { query: 'dependency' } };

      if (!r.timedOut && r.result && !(Array.isArray(results) && results.length > 0)) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'docs-no-fallback',
          tool: 'search_docs',
          title: `No fallback results after hostile docs source: ${s.route}`,
          expected: 'search_docs falls back to the bundled fixture and returns results',
          actual: String(r.result?.content?.[0]?.text).slice(0, 200),
          reproducer: repro,
        });
      }
      if (elapsedMs > TIMEOUT_MS * 3 + 5000 && !r.timedOut) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'docs-slow',
          tool: 'search_docs',
          title: `Docs fetch outlasts FETCH_TIMEOUT_MS by far: ${s.route}`,
          expected: `about ${TIMEOUT_MS} ms (FETCH_TIMEOUT_MS) plus fallback`,
          actual: `${elapsedMs} ms`,
          reproducer: repro,
        });
      }
      if (s.checkBytes && (hostile.stats.bytesSent[s.route] ?? 0) >= TOTAL_OVERSIZE / 2) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'docs-size-cap',
          tool: 'search_docs',
          title: `FETCH_MAX_BYTES not enforced while streaming: ${s.route}`,
          expected: `the client stops reading near ${MAX_BYTES} bytes`,
          actual: `${hostile.stats.bytesSent[s.route]} bytes were consumed`,
          reproducer: repro,
        });
      }
      if (s.memory && growthMb > 300) {
        report.add({
          severity: 'high',
          group: name,
          kind: 'docs-memory',
          tool: 'search_docs',
          title: `Server memory balloons by ${growthMb} MB on a compressed response (${s.route})`,
          expected: `decompressed size capped at FETCH_MAX_BYTES (${MAX_BYTES} bytes)`,
          actual: `RSS grew ${growthMb} MB (start ${Math.round(startKb / 1024)} MB, peak ${Math.round(peakKb / 1024)} MB)`,
          reproducer: repro,
        });
      }
      await managed.close();
      notes.push(`${s.route}: ${elapsedMs} ms`);
    }
  } finally {
    await hostile.close();
  }
  report.metrics.hostileDocs = perScenario;
  return { notes };
}
