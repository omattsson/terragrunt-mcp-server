/**
 * load: parallel mixed valid calls, first a burst, then a sustained phase of
 * `--duration` seconds with `--concurrency` calls in flight. No limit exists in
 * the server today, so the numbers are reported as info; thresholds (see CLI
 * flags) only raise medium findings, a crash or hang is critical.
 */
import { performance } from 'node:perf_hooks';
import { ManagedSession, rssKb } from '../lib/client.mjs';

export const name = 'load';
export function supports() {
  return null;
}

/** A minimal valid call per tool (same set the stdio e2e test uses). */
const VALID_CALLS = {
  search_docs: [{ query: 'dependency' }, { mode: 'list' }, { query: 'remote state', limit: 5 }],
  cli_reference: [{ command: 'run' }],
  function_reference: [{ function_name: 'find_in_parent_folders' }],
  get_hcl_config_reference: [{ config: 'dependency' }],
  get_guidance: [{ type: 'experiments' }],
  build_config: [{ useCase: 'cicd', backend: 'github-actions' }, { useCase: 'remote_state', backend: 's3', options: { bucket: 'b', key: 'k', region: 'eu-west-1' } }],
  diagnose_terragrunt_error: [{ error_message: 'Error acquiring the state lock' }],
  get_server_metrics: [{}],
};

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function stats(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return { count: sorted.length, p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99), max: sorted.at(-1) ?? null };
}

export async function run(ctx) {
  const { opts, report } = ctx;
  const managed = await new ManagedSession(ctx, { group: name }).start();
  const session = managed.session;
  const notes = [];
  try {
    const { tools } = await session.listTools(10000);
    const pool = [];
    for (const tool of tools) for (const args of VALID_CALLS[tool.name] ?? []) pool.push({ tool: tool.name, args });
    if (pool.length === 0) throw new Error('load: no known tool to call');

    const pid = session.server.pid;
    const canRss = ctx.capabilities.rss;
    const rss = { startKb: canRss ? await rssKb(pid) : null, peakKb: null, endKb: null };
    const sampler = canRss
      ? setInterval(async () => {
          const v = await rssKb(pid);
          if (v !== null && (rss.peakKb === null || v > rss.peakKb)) rss.peakKb = v;
        }, 500)
      : null;

    // Event-loop stall probe: a cheap tools/list every 100 ms, its latency shows how long the server was blocked
    const probe = [];
    let probing = true;
    const probeLoop = (async () => {
      while (probing) {
        const t = performance.now();
        try {
          await session.listTools(30000);
          probe.push(performance.now() - t);
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    })();

    const results = { ok: 0, errorReplies: 0, failures: 0, latencies: [] };
    let cursor = 0;
    const oneCall = async () => {
      const item = pool[cursor++ % pool.length];
      const r = await session.call(item.tool, item.args, 60000);
      if (r.error) {
        results.failures += 1;
        if (results.failures <= 3) results.firstFailure = { tool: item.tool, arguments: item.args, error: String(r.error.message).slice(0, 200) };
      } else {
        results.latencies.push(r.elapsedMs);
        if (r.result?.isError) results.errorReplies += 1;
        else results.ok += 1;
      }
    };

    // Burst: `concurrency` calls at once, three rounds
    const burstStart = performance.now();
    for (let round = 0; round < 3; round++) await Promise.all(Array.from({ length: opts.concurrency }, oneCall));
    const burstMs = Math.round(performance.now() - burstStart);
    const burst = stats(results.latencies);
    const burstCalls = results.latencies.length;

    // Sustained: keep `concurrency` calls in flight until the deadline
    const deadline = performance.now() + opts.duration * 1000;
    const sustainedStartCount = results.latencies.length;
    const worker = async () => {
      while (performance.now() < deadline && session.alive) await oneCall();
    };
    await Promise.all(Array.from({ length: opts.concurrency }, worker));
    const sustained = stats(results.latencies.slice(sustainedStartCount));

    probing = false;
    await probeLoop;
    if (sampler) clearInterval(sampler);
    if (canRss) {
      rss.endKb = await rssKb(pid);
      if (rss.endKb !== null && (rss.peakKb === null || rss.endKb > rss.peakKb)) rss.peakKb = rss.endKb;
    }

    const total = results.ok + results.errorReplies + results.failures;
    const errorRate = total === 0 ? 0 : (results.errorReplies + results.failures) / total;
    const growthMb = rss.startKb !== null && rss.peakKb !== null ? Math.round((rss.peakKb - rss.startKb) / 1024) : null;
    const stallMax = probe.length > 0 ? Math.round(Math.max(...probe)) : null;
    const metrics = {
      concurrency: opts.concurrency,
      durationSeconds: opts.duration,
      totalCalls: total,
      okReplies: results.ok,
      errorReplies: results.errorReplies,
      transportFailures: results.failures,
      errorRate: Number(errorRate.toFixed(4)),
      burst: { calls: burstCalls, wallMs: burstMs, ...burst },
      sustained: { calls: sustained.count, throughputPerSecond: Number((sustained.count / Math.max(1, opts.duration)).toFixed(1)), ...sustained },
      overallLatencyMs: stats(results.latencies),
      rssMb: canRss ? { start: toMb(rss.startKb), peak: toMb(rss.peakKb), end: toMb(rss.endKb), growth: growthMb } : 'not measured for this target',
      eventLoopStallMaxMs: stallMax,
      probeSamples: probe.length,
    };
    report.metrics.load = metrics;
    report.add({
      severity: 'info',
      group: name,
      kind: 'load-numbers',
      title: `Load numbers at concurrency ${opts.concurrency} for ${opts.duration} s`,
      expected: 'numbers only (no limit is configured in the server)',
      actual: `p50 ${metrics.overallLatencyMs.p50} ms, p95 ${metrics.overallLatencyMs.p95} ms, p99 ${metrics.overallLatencyMs.p99} ms, error rate ${(errorRate * 100).toFixed(2)} %, RSS growth ${growthMb ?? 'n/a'} MB, max stall ${stallMax} ms`,
      reproducer: { target: ctx.targetName, command: `npm run stress -- --groups load --duration ${opts.duration} --concurrency ${opts.concurrency} --seed ${opts.seed}` },
    });

    if (!session.alive) {
      await managed.checkpoint(null, { phase: 'load' });
    }
    if (errorRate > opts.maxErrorRate) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'load-errors',
        title: `Valid calls fail under load (${(errorRate * 100).toFixed(1)} % > ${opts.maxErrorRate * 100} %)`,
        expected: `error rate at most ${opts.maxErrorRate * 100} %`,
        actual: `${results.errorReplies} error replies, ${results.failures} transport failures of ${total}; first failure: ${JSON.stringify(results.firstFailure ?? null)}`,
        reproducer: { target: ctx.targetName, concurrency: opts.concurrency, duration: opts.duration, seed: opts.seed, firstFailure: results.firstFailure },
      });
    }
    if (growthMb !== null && growthMb > opts.maxRssGrowthMb) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'load-memory',
        title: `RSS grows by ${growthMb} MB under load (limit ${opts.maxRssGrowthMb} MB)`,
        expected: `growth at most ${opts.maxRssGrowthMb} MB`,
        actual: `start ${toMb(rss.startKb)} MB, peak ${toMb(rss.peakKb)} MB, end ${toMb(rss.endKb)} MB`,
        reproducer: { target: ctx.targetName, concurrency: opts.concurrency, duration: opts.duration },
      });
    }
    if (metrics.overallLatencyMs.p99 !== null && metrics.overallLatencyMs.p99 > opts.maxP99Ms) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'load-latency',
        title: `p99 latency ${metrics.overallLatencyMs.p99} ms under load (limit ${opts.maxP99Ms} ms)`,
        expected: `p99 at most ${opts.maxP99Ms} ms`,
        actual: `p50 ${metrics.overallLatencyMs.p50}, p95 ${metrics.overallLatencyMs.p95}, p99 ${metrics.overallLatencyMs.p99}, max ${metrics.overallLatencyMs.max} ms`,
        reproducer: { target: ctx.targetName, concurrency: opts.concurrency, duration: opts.duration },
      });
    }
    notes.push(`${total} calls, p99 ${metrics.overallLatencyMs.p99} ms`);
  } finally {
    await managed.close();
  }
  return { notes };
}

function toMb(kb) {
  return kb === null || kb === undefined ? null : Math.round(kb / 1024);
}
