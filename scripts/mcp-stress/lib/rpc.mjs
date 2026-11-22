/**
 * Raw JSON-RPC over a child process's stdio. Unlike the SDK transport it can
 * send malformed frames, and it records everything needed by the oracles:
 * exit code and signal, stderr tail and every stdout line that is not JSON-RPC.
 */
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { checkStdoutLines } from './oracles.mjs';

export class RawServer extends EventEmitter {
  /** @param {{command: string, args: string[], env: object, cwd: string}} spec */
  constructor(spec) {
    super();
    this.spec = spec;
    this.exited = false;
    this.exitCode = null;
    this.signal = null;
    this.badLines = [];
    this.stderrTail = '';
    this.responses = new Map();
    this.waiters = new Map();
    this.stdoutBytes = 0;
    this.keepLines = false;
    this.lines = [];
    this.pending = '';
    this.child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.pid = this.child.pid;
    this.child.stdin.on('error', () => {});
    this.child.stdout.on('data', (chunk) => this.#onStdout(chunk));
    this.child.stderr.on('data', (chunk) => {
      this.stderrTail = (this.stderrTail + chunk.toString('utf8')).slice(-4000);
    });
    this.exitPromise = new Promise((resolve) => {
      this.child.on('exit', (code, signal) => {
        this.exited = true;
        this.exitCode = code;
        this.signal = signal;
        resolve({ code, signal });
      });
      this.child.on('error', (error) => {
        this.exited = true;
        this.stderrTail += `\nspawn error: ${error.message}`;
        resolve({ code: null, signal: null });
      });
    });
    this.child.on('close', () => this.emit('close'));
  }

  #onStdout(chunk) {
    this.stdoutBytes += chunk.length;
    this.pending += chunk.toString('utf8');
    let nl;
    while ((nl = this.pending.indexOf('\n')) !== -1) {
      const line = this.pending.slice(0, nl).replace(/\r$/, '');
      this.pending = this.pending.slice(nl + 1);
      this.#onLine(line);
    }
  }

  #onLine(line) {
    if (this.keepLines) this.lines.push(line);
    const bad = checkStdoutLines([line]);
    if (bad.length > 0) {
      this.badLines.push(line.slice(0, 300));
      return;
    }
    if (line.trim() === '') return;
    const parsed = JSON.parse(line);
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const message of messages) {
      this.emit('message', message);
      if (message.id !== undefined && message.id !== null && (message.result !== undefined || message.error !== undefined)) {
        const key = JSON.stringify(message.id);
        const waiter = this.waiters.get(key);
        if (waiter) {
          this.waiters.delete(key);
          waiter(message);
        } else {
          this.responses.set(key, message);
        }
      }
    }
  }

  get alive() {
    return !this.exited;
  }

  write(data) {
    if (this.exited || this.child.stdin.destroyed) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.child.stdin.write(data, (error) => resolve(!error));
    });
  }

  sendJson(message) {
    return this.write(JSON.stringify(message) + '\n');
  }

  /** Wait for the response carrying `id`; resolves null on timeout or when the process exits first. */
  waitForResponse(id, timeoutMs) {
    const key = JSON.stringify(id);
    const early = this.responses.get(key);
    if (early) {
      this.responses.delete(key);
      return Promise.resolve(early);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(key);
        resolve(null);
      }, timeoutMs);
      this.waiters.set(key, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      this.exitPromise.then(() => {
        if (this.waiters.get(key)) {
          clearTimeout(timer);
          this.waiters.delete(key);
          resolve(null);
        }
      });
    });
  }

  async request(message, timeoutMs) {
    const wait = this.waitForResponse(message.id, timeoutMs);
    await this.sendJson(message);
    return wait;
  }

  /** MCP handshake; returns the initialize result message or null. */
  async initialize(timeoutMs = 15000) {
    const reply = await this.request(
      { jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mcp-stress', version: '1.0.0' } } },
      timeoutMs,
    );
    if (reply) await this.sendJson({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return reply;
  }

  kill(signal = 'SIGKILL') {
    try {
      this.child.kill(signal);
    } catch {
      // already gone
    }
  }

  waitExit(timeoutMs) {
    return Promise.race([this.exitPromise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))]);
  }

  /** Close stdin, then terminate if the process lingers. */
  async stop() {
    if (!this.exited) {
      try {
        this.child.stdin.end();
      } catch {
        // ignore
      }
      if (!(await this.waitExit(2000))) {
        this.kill('SIGTERM');
        if (!(await this.waitExit(2000))) this.kill('SIGKILL');
        await this.waitExit(2000);
      }
    }
  }
}
