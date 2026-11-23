/**
 * protocol: malformed and hostile JSON-RPC frames over raw stdio.
 * Pass criterion: the server survives and still answers tools/list. A missing
 * JSON-RPC error reply for a well-formed request is reported as medium.
 */
import { Buffer } from 'node:buffer';
import { RawServer } from '../lib/rpc.mjs';
import { checkCrash } from '../lib/oracles.mjs';
import { removeContainer } from '../lib/client.mjs';
import { abbreviate } from '../lib/report.mjs';
import { createRng } from '../lib/payloads.mjs';

export const name = 'protocol';
export function supports() {
  return null;
}

const MB = 1024 * 1024;
const line = (o) => JSON.stringify(o) + '\n';

function binaryGarbage(seed) {
  const rng = createRng(seed);
  const bytes = Buffer.alloc(64 * 1024);
  for (let i = 0; i < bytes.length; i++) {
    const b = Math.floor(rng() * 256);
    bytes[i] = b === 10 ? 11 : b;
  }
  return Buffer.concat([bytes, Buffer.from('\n')]);
}

/** Frames are strings or Buffers written verbatim. `wantError` lists acceptable JSON-RPC error codes. */
function buildCases(opts) {
  const list = { jsonrpc: '2.0', id: 'x', method: 'tools/list' };
  const init = { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } };
  const deepObject = '{"a":'.repeat(10_000) + '1' + '}'.repeat(10_000);
  const deepArray = '['.repeat(10_000) + ']'.repeat(10_000);
  const cases = [
    { id: 'invalid-json', frame: '{not json\n' },
    { id: 'truncated-frame', frame: '{"jsonrpc":"2.0","id":1,"method":"tools/li\n' },
    { id: 'binary-garbage', frame: binaryGarbage(opts.seed) },
    { id: 'nul-bytes', frame: '{"jsonrpc":"2.0",\u0000"id":1}\n' },
    { id: 'utf8-bom', frame: '﻿{"jsonrpc":"2.0","id":"bom","method":"tools/list"}\n' },
    { id: 'wrong-jsonrpc-version', frame: line({ ...list, id: 'v', jsonrpc: '1.0' }) },
    { id: 'missing-jsonrpc', frame: line({ id: 'm', method: 'tools/list' }) },
    { id: 'unknown-method', frame: line({ jsonrpc: '2.0', id: 'um', method: 'no/such/method' }), wantError: [-32601] },
    { id: 'huge-method-name', frame: line({ jsonrpc: '2.0', id: 'hm', method: 'm'.repeat(100_000) }), wantError: [-32601] },
    { id: 'method-not-string', frame: line({ jsonrpc: '2.0', id: 'mn', method: 42 }) },
    { id: 'missing-id-request', frame: line({ jsonrpc: '2.0', method: 'tools/list' }) },
    { id: 'duplicate-id', frame: line({ ...list, id: 7 }) + line({ ...list, id: 7 }) },
    { id: 'id-null', frame: line({ ...list, id: null }) },
    { id: 'id-object', frame: line({ ...list, id: { a: 1 } }) },
    { id: 'id-float', frame: line({ ...list, id: 1.5 }) },
    { id: 'id-huge-int', frame: '{"jsonrpc":"2.0","id":123456789012345678901234567890,"method":"tools/list"}\n' },
    { id: 'params-string', frame: line({ ...list, id: 'ps', params: 'x' }) },
    { id: 'params-array', frame: line({ ...list, id: 'pa', params: [1, 2] }) },
    { id: 'tools-call-null-params', frame: line({ jsonrpc: '2.0', id: 'cn', method: 'tools/call', params: null }) },
    { id: 'tools-call-name-number', frame: line({ jsonrpc: '2.0', id: 'nn', method: 'tools/call', params: { name: 42, arguments: {} } }) },
    { id: 'tools-call-arguments-string', frame: line({ jsonrpc: '2.0', id: 'as', method: 'tools/call', params: { name: 'search_docs', arguments: 'x' } }) },
    { id: 'tools-call-arguments-array', frame: line({ jsonrpc: '2.0', id: 'aa', method: 'tools/call', params: { name: 'search_docs', arguments: [1] } }) },
    { id: 'deep-nesting-10k-object', frame: `{"jsonrpc":"2.0","id":"dn","method":"tools/list","params":${deepObject}}\n` },
    { id: 'deep-nesting-10k-array', frame: `{"jsonrpc":"2.0","id":"da","method":"tools/list","params":{"x":${deepArray}}}\n` },
    { id: 'line-5mb-valid', frame: `{"jsonrpc":"2.0","id":"big","method":"tools/list","params":{"pad":"${'A'.repeat(5 * MB)}"}}\n`, healthTimeoutMs: 10000 },
    { id: 'line-5mb-garbage', frame: 'Z'.repeat(5 * MB) + '\n', healthTimeoutMs: 10000 },
    { id: 'initialize-twice', frame: line({ jsonrpc: '2.0', id: 'i2', method: 'initialize', params: init }) },
    { id: 'notification-flood', frame: '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":99}}\n'.repeat(10_000), healthTimeoutMs: 15000 },
    { id: 'cancel-unknown-request', frame: '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":"nope","reason":"x"}}\n' },
  ];
  const slow = new Set(['line-5mb-garbage', 'huge-method-name', 'id-huge-int', 'notification-flood']);
  return opts.quick ? cases.filter((c) => !slow.has(c.id)) : cases;
}

export async function run(ctx) {
  const { report, opts } = ctx;
  const cases = buildCases(opts);
  let health = 0;
  let server = null;

  const start = async () => {
    server = new RawServer(ctx.spec({}));
    const init = await server.initialize(20000);
    if (!init) throw new Error(`protocol: server did not answer initialize: ${server.stderrTail.slice(-300)}`);
  };
  const stop = async () => {
    if (!server) return;
    await server.stop();
    await removeContainer(server.spec);
  };

  await start();
  try {
    for (const c of cases) {
      const reproducer = { target: ctx.targetName, frame: c.id, frameDescription: describeFrame(c.frame) };
      const badBefore = server.badLines.length;
      await server.write(c.frame);
      const healthTimeout = c.healthTimeoutMs ?? 5000;
      const answer = await server.request({ jsonrpc: '2.0', id: `health-${++health}`, method: 'tools/list' }, healthTimeout);

      for (const text of server.badLines.slice(badBefore)) {
        report.add({
          severity: 'high',
          group: name,
          kind: 'stdout-pollution',
          title: `Non-JSON-RPC line on stdout: ${JSON.stringify(text.slice(0, 80))}`,
          expected: 'stdout carries only JSON-RPC messages',
          actual: `stdout line after frame ${c.id}: ${JSON.stringify(text)}`,
          reproducer,
        });
      }

      const crash = checkCrash({ alive: server.alive, exitCode: server.exitCode, signal: server.signal });
      if (crash) {
        report.add({
          severity: 'critical',
          group: name,
          kind: 'crash',
          title: `Server crashed on malformed frame: ${c.id}`,
          expected: 'the server survives any input on stdin',
          actual: `${crash}; stderr tail: ${JSON.stringify(server.stderrTail.slice(-400))}`,
          reproducer,
        });
        await stop();
        await start();
        continue;
      }
      if (!answer) {
        report.add({
          severity: 'critical',
          group: name,
          kind: 'hang',
          title: `Server stops answering after malformed frame: ${c.id}`,
          expected: `tools/list answers within ${healthTimeout / 1000} s`,
          actual: 'no reply',
          reproducer,
        });
        await stop();
        await start();
        continue;
      }
      if (c.wantError) {
        const id = JSON.parse(String(c.frame).split('\n')[0]).id;
        const reply = await server.waitForResponse(id, 300);
        if (!reply || !c.wantError.includes(reply.error?.code)) {
          report.add({
            severity: 'medium',
            group: name,
            kind: 'protocol-error-reply',
            title: `No ${c.wantError.join('/')} error reply for ${c.id}`,
            expected: `JSON-RPC error ${c.wantError.join(' or ')}`,
            actual: reply ? `reply: ${JSON.stringify(abbreviate(reply))}` : 'no reply to the request',
            reproducer,
          });
        }
      }
    }

    // A call before the handshake, on a fresh server
    await stop();
    server = new RawServer(ctx.spec({}));
    await server.request({ jsonrpc: '2.0', id: 'early', method: 'tools/list' }, 5000);
    if (!server.alive) {
      report.add({
        severity: 'critical',
        group: name,
        kind: 'crash',
        title: 'Server crashed on tools/list before initialize',
        expected: 'the server survives a request before the handshake',
        actual: `exit code ${server.exitCode}, signal ${server.signal}; stderr tail: ${JSON.stringify(server.stderrTail.slice(-300))}`,
        reproducer: { target: ctx.targetName, frame: 'tools/list before initialize' },
      });
    }
  } finally {
    await stop();
  }
}

function describeFrame(frame) {
  if (Buffer.isBuffer(frame)) return `<${frame.length} bytes of seeded binary>`;
  const text = String(frame);
  return text.length > 200 ? `${text.slice(0, 120)}...<${text.length} chars>` : text;
}
