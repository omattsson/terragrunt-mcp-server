/**
 * MCP client (SDK Client) over a RawServer, plus a "managed" session that runs
 * the universal oracle after every call: process alive, a follow-up tools/list
 * answers within 5 s, stdout held only JSON-RPC, no stack trace in the reply.
 */
import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { RawServer } from './rpc.mjs';
import { checkCrash, checkErrorShape, findStackLeak } from './oracles.mjs';
import { abbreviate } from './report.mjs';

const REQUEST_TIMEOUT_CODE = -32001;

/** SDK transport that reads from a RawServer (which has already classified stdout). */
class RawTransport {
  constructor(server) {
    this.server = server;
    server.on('message', (message) => {
      const parsed = JSONRPCMessageSchema.safeParse(message);
      if (parsed.success) this.onmessage?.(parsed.data);
      else this.onerror?.(new Error('unparseable JSON-RPC message from server'));
    });
    server.on('close', () => this.onclose?.());
  }

  async start() {}

  async send(message) {
    if (!(await this.server.sendJson(message))) throw new Error('server stdin is closed');
  }

  async close() {
    await this.server.stop();
  }
}

export function rssKb(pid) {
  return new Promise((resolve) => {
    execFile('ps', ['-o', 'rss=', '-p', String(pid)], (error, stdout) => {
      const value = parseInt(String(stdout).trim(), 10);
      resolve(error || Number.isNaN(value) ? null : value);
    });
  });
}

export function removeContainer(spec) {
  if (!spec.containerName) return Promise.resolve();
  return new Promise((resolve) => execFile('docker', ['rm', '-f', spec.containerName], () => resolve()));
}

/** One live connection. */
export class Session {
  constructor(spec) {
    this.spec = spec;
    this.server = new RawServer(spec);
    this.transport = new RawTransport(this.server);
    this.client = new Client({ name: 'mcp-stress', version: '1.0.0' });
    this.transportErrors = [];
    this.client.onerror = (error) => this.transportErrors.push(error);
    this.badSeen = 0;
  }

  async connect(timeoutMs = 20000) {
    await this.client.connect(this.transport, { timeout: timeoutMs });
  }

  get alive() {
    return this.server.alive;
  }

  async listTools(timeoutMs = 5000) {
    return this.client.listTools(undefined, { timeout: timeoutMs });
  }

  /** @returns {{result?: object, error?: Error, timedOut: boolean, elapsedMs: number}} */
  async call(name, args, timeoutMs = 10000) {
    const started = performance.now();
    try {
      const result = await this.client.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs });
      return { result, timedOut: false, elapsedMs: Math.round(performance.now() - started) };
    } catch (error) {
      return { error, timedOut: error?.code === REQUEST_TIMEOUT_CODE, elapsedMs: Math.round(performance.now() - started) };
    }
  }

  newBadLines() {
    const fresh = this.server.badLines.slice(this.badSeen);
    this.badSeen = this.server.badLines.length;
    return fresh;
  }

  async close() {
    await this.server.stop();
    await removeContainer(this.spec);
  }
}

/**
 * Session wrapper that applies the universal oracle and restarts a crashed
 * server. `ctx` provides `spec(opts)`, `report`, `opts`.
 */
export class ManagedSession {
  constructor(ctx, { group, specOptions = {} }) {
    this.ctx = ctx;
    this.group = group;
    this.specOptions = specOptions;
    this.session = null;
    this.restarts = 0;
  }

  async start() {
    this.session = new Session(this.ctx.spec(this.specOptions));
    await this.session.connect();
    this.#reportStdout('startup');
    return this;
  }

  get pid() {
    return this.session?.server.pid;
  }

  #base() {
    return { target: this.ctx.targetName, mode: this.specOptions.mode ?? this.ctx.opts.mode, seed: this.ctx.opts.seed };
  }

  #reportStdout(context, tool, reproducer) {
    for (const line of this.session.newBadLines()) {
      this.ctx.report.add({
        severity: 'high',
        group: this.group,
        kind: 'stdout-pollution',
        title: `Non-JSON-RPC line on stdout: ${JSON.stringify(line.slice(0, 80))}`,
        expected: 'stdout carries only JSON-RPC messages',
        actual: `stdout line during ${context}${tool ? ` (last tool: ${tool})` : ''}: ${JSON.stringify(line)}`,
        reproducer: { ...this.#base(), ...reproducer },
      });
    }
  }

  /**
   * Universal oracle after a call; restarts the server when it died.
   * @returns {Promise<boolean>} true when the server is still healthy
   */
  async checkpoint(tool, reproducer) {
    const repro = { ...this.#base(), ...reproducer };
    this.#reportStdout('call', tool, reproducer);
    const crash = checkCrash({ alive: this.session.alive, exitCode: this.session.server.exitCode, signal: this.session.server.signal });
    if (crash) {
      this.ctx.report.add({
        severity: 'critical',
        group: this.group,
        kind: 'crash',
        tool,
        title: `Server crashed${tool ? ` on a ${tool} call` : ''}`,
        expected: 'the server survives any tool call',
        actual: `${crash}; stderr tail: ${JSON.stringify(this.session.server.stderrTail.slice(-400))}`,
        reproducer: repro,
      });
      await this.#restart();
      return false;
    }
    try {
      await this.session.listTools(5000);
    } catch (error) {
      this.ctx.report.add({
        severity: 'critical',
        group: this.group,
        kind: 'hang',
        tool,
        title: `Server stopped answering after ${tool ? `a ${tool} call` : 'a case'}`,
        expected: 'tools/list answers within 5 s',
        actual: `tools/list failed: ${error?.message ?? error}`,
        reproducer: repro,
      });
      await this.#restart();
      return false;
    }
    return true;
  }

  async #restart() {
    await this.session.close();
    this.restarts += 1;
    if (this.restarts > 25) throw new Error(`${this.group}: server keeps failing to stay up (25 restarts)`);
    await this.start();
  }

  /**
   * One oracle-checked tool call.
   * @param {{label?: string, caseId?: string, timeoutMs?: number, checkShape?: boolean}} meta
   * @returns {Promise<{result?: object, error?: Error, timedOut: boolean, elapsedMs: number}>}
   */
  async call(tool, args, meta = {}) {
    const timeoutMs = meta.timeoutMs ?? this.ctx.opts.callTimeoutMs;
    const r = await this.session.call(tool, args, timeoutMs);
    const reproducer = { tool, arguments: abbreviate(args), caseId: meta.caseId, label: meta.label, callTimeoutMs: timeoutMs };
    if (r.timedOut) {
      this.ctx.report.add({
        severity: 'critical',
        group: this.group,
        kind: 'hang',
        tool,
        title: `Call hangs: ${tool} (${meta.label ?? 'case'})`,
        expected: `an answer within ${timeoutMs} ms`,
        actual: `no answer within ${timeoutMs} ms`,
        reproducer: { ...this.#base(), ...reproducer },
      });
    } else if (r.result) {
      const texts = (r.result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text);
      const leaks = texts.flatMap((t) => findStackLeak(t));
      if (leaks.length > 0) {
        this.ctx.report.add({
          severity: 'high',
          group: this.group,
          kind: 'stack-leak',
          tool,
          title: `Stack trace or install path in the reply of ${tool}`,
          expected: 'errors carry a short message only',
          actual: leaks.join(' | '),
          reproducer: { ...this.#base(), ...reproducer },
        });
      }
      if (meta.checkShape !== false) {
        const problems = checkErrorShape(r.result);
        if (problems.length > 0) {
          this.ctx.report.add({
            severity: 'medium',
            group: this.group,
            kind: 'error-shape',
            tool,
            title: `Inconsistent error shape from ${tool}: ${problems[0]}`,
            expected: 'isError matches the error in the body',
            actual: problems.join('; ') + ` | body: ${String(texts[0] ?? '').slice(0, 300)}`,
            reproducer: { ...this.#base(), ...reproducer },
          });
        }
      }
    }
    r.healthy = await this.checkpoint(tool, reproducer);
    return r;
  }

  async close() {
    if (this.session) await this.session.close();
  }
}
