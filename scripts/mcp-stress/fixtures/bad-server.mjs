#!/usr/bin/env node
/**
 * Deliberately broken MCP stdio server: the harness self-test. It is NOT the
 * product. With STRESS_FIXTURE_CLEAN=1 every defect is switched off, so the
 * same server must produce zero findings.
 *
 * Planted defects (broken mode only):
 *   1. stdout pollution: a non-JSON banner line after the initialize reply
 *   2. crash: echo with text=null throws an uncaught exception
 *   3. hang: echo with a text of 1,000,000 characters or more never answers
 *   4. write outside the sandbox: build_config decodes %2e%2e in the path
 *      after the traversal check, so it can write above ALLOWED_DIRS
 *
 * Everything else behaves like a careful server, including a small version of
 * the real FileWriter guards, so the clean run proves the oracles stay quiet.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import process from 'node:process';
import { setImmediate } from 'node:timers';
import { Buffer } from 'node:buffer';

const CLEAN = process.env.STRESS_FIXTURE_CLEAN === '1';
const WRITES = process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED === 'true';
const ALLOWED = (process.env.TERRAGRUNT_MCP_ALLOWED_DIRS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((d) => path.resolve(d));
const MAX_SIZE = 1024 * 1024;

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo a string',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'build_config',
    description: 'Write an HCL file inside ALLOWED_DIRS',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        path: { type: 'string' },
        overwrite: { type: 'boolean', default: false },
        createParentDirs: { type: 'boolean', default: true },
        preview: { type: 'boolean', default: false },
        compareWith: { type: 'string' },
      },
    },
  },
];

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id, payload, isError = false) {
  send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(payload) }], ...(isError ? { isError: true } : {}) } });
}

function fail(id, errorType, error) {
  reply(id, { success: false, errorType, error }, true);
}

function within(candidate, dir) {
  return candidate === dir || candidate.startsWith(dir + path.sep);
}

class GuardError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
  }
}

/** Validate a path; returns its absolute form. */
function guardPath(raw, { forWrite }) {
  if (typeof raw !== 'string' || raw.length === 0) throw new GuardError('INVALID_PATH', 'path must be a non-empty string');
  if (raw.includes('\u0000')) throw new GuardError('INVALID_PATH', 'path contains a NUL byte');
  if (/(^|[\\/])\.\.($|[\\/])/.test(raw)) throw new GuardError('PATH_TRAVERSAL_DETECTED', 'Path traversal detected');
  const abs = path.resolve(raw);
  const root = ALLOWED.find((d) => within(abs, d));
  if (!root) throw new GuardError('OUTSIDE_ALLOWED_DIRECTORIES', 'Path is outside allowed directories');
  const segments = path.relative(root, abs).split(path.sep);
  if (segments.some((s) => s.startsWith('.')) || !abs.toLowerCase().endsWith('.hcl') || path.basename(abs) === '.hcl') {
    throw new GuardError('DISALLOWED_FILE_TYPE', 'File type is not allowed');
  }
  // Real path of the deepest existing ancestor must stay inside a real allowed root
  let ancestor = path.dirname(abs);
  while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor) ancestor = path.dirname(ancestor);
  const realAncestor = fs.realpathSync(ancestor);
  const realRoots = ALLOWED.map((d) => (fs.existsSync(d) ? fs.realpathSync(d) : d));
  if (!realRoots.some((d) => within(realAncestor, d))) throw new GuardError('OUTSIDE_ALLOWED_DIRECTORIES', 'Path resolves outside allowed directories');
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    st = null;
  }
  if (st?.isSymbolicLink()) throw new GuardError('SYMLINK_NOT_ALLOWED', 'Refusing to use a symlink');
  if (st && st.nlink > 1) throw new GuardError('HARDLINK_NOT_ALLOWED', 'Refusing a file with multiple hard links');
  void forWrite;
  return abs;
}

function buildConfig(id, args) {
  if (!WRITES) return fail(id, 'FILE_WRITING_DISABLED', 'File writing is disabled in configuration');
  if (ALLOWED.length === 0) return fail(id, 'NO_ALLOWED_DIRECTORIES', 'File access requires an explicit allowlist');
  if (typeof args?.content !== 'string') return fail(id, 'VALIDATION_ERROR', 'content parameter must be a string');
  if (typeof args?.path !== 'string') return fail(id, 'VALIDATION_ERROR', 'path parameter must be a string');
  try {
    if (Buffer.byteLength(args.content) > MAX_SIZE) throw new GuardError('MAX_SIZE_EXCEEDED', 'File size exceeds maximum allowed');
    const checked = guardPath(args.path, { forWrite: true });
    // DEFECT 4: the traversal check ran on the raw path, the decoded path is used for the write
    const target = CLEAN ? checked : path.resolve(decodeURIComponent(args.path));
    if (args.preview) {
      const base = guardPath(args.compareWith ?? args.path, { forWrite: false });
      const exists = fs.existsSync(base);
      return reply(id, { preview: true, success: true, previewResult: { success: true, diff: exists ? 'diff' : 'new file', targetPath: target } });
    }
    if (fs.existsSync(target) && !args.overwrite) throw new GuardError('FILE_EXISTS_NO_OVERWRITE', 'File exists and overwrite is disabled');
    if (args.createParentDirs === false && !fs.existsSync(path.dirname(target))) throw new GuardError('INVALID_PATH', 'Parent directory does not exist');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, args.content);
    return reply(id, { success: true, path: target, bytesWritten: Buffer.byteLength(args.content) });
  } catch (error) {
    if (error instanceof GuardError) return fail(id, error.type, error.message);
    return fail(id, 'INVALID_PATH', 'Invalid file path');
  }
}

function echo(id, args) {
  const text = args?.text;
  if (!CLEAN && text === null) {
    // DEFECT 2: uncaught exception kills the process
    setImmediate(() => {
      throw new TypeError("Cannot read properties of null (reading 'length')");
    });
    return;
  }
  if (!CLEAN && typeof text === 'string' && text.length >= 1_000_000) return; // DEFECT 3: never answers
  if (typeof text !== 'string') return fail(id, 'VALIDATION_ERROR', 'text must be a string');
  return reply(id, { echo: text.slice(0, 100) });
}

function handle(message) {
  if (message === null || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
  }
  const { id, method, params } = message;
  const isRequest = id !== undefined && id !== null && typeof method === 'string';
  if (!isRequest) return; // notifications and responses need no answer
  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: { protocolVersion: params?.protocolVersion ?? '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'bad-server', version: '0.0.1' } },
      });
      // DEFECT 1: stray non-JSON output on the protocol stream
      if (!CLEAN) process.stdout.write('DEBUG: bad-server initialised\n');
      return;
    case 'ping':
      return send({ jsonrpc: '2.0', id, result: {} });
    case 'tools/list':
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments;
      if (name === 'echo') return echo(id, args);
      if (name === 'build_config') return buildConfig(id, args);
      return reply(id, { error: `Unknown tool: ${String(name).slice(0, 60)}` }, true);
    }
    default:
      return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${String(method).slice(0, 60)}` } });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (line.trim() === '') return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  try {
    handle(message);
  } catch {
    const id = message && typeof message === 'object' ? message.id : null;
    if (id !== undefined && id !== null) send({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error' } });
  }
});
rl.on('close', () => process.exit(0));
