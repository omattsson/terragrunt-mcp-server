/**
 * modes: the tool list of each server mode matches dist/modes/config.js, a tool
 * hidden in a mode is refused with MODE_RESTRICTION, unknown tools fail cleanly.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ManagedSession } from '../lib/client.mjs';

export const name = 'modes';

export function supports(ctx) {
  if (ctx.target.kind === 'fixture') return 'the fixture has no server modes';
  if (!existsSync(path.join(ctx.root, 'dist', 'modes', 'config.js'))) return 'dist/modes/config.js is missing (run npm run build)';
  return null;
}

const UNKNOWN_NAMES = ['no_such_tool', '', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'x'.repeat(10_000), 'search_docs ', 'SEARCH_DOCS', 'search_docs\u0000'];

function parseBody(result) {
  try {
    return JSON.parse(result?.content?.[0]?.text ?? '');
  } catch {
    return undefined;
  }
}

export async function run(ctx) {
  const { report, opts } = ctx;
  const config = await import(pathToFileURL(path.join(ctx.root, 'dist', 'modes', 'config.js')).href);
  const modes = opts.modeExplicit ? [opts.mode] : Object.values(config.ServerMode);
  const allTools = config.getModeConfig(config.ServerMode.FULL).tools;
  const notes = [];

  for (const mode of modes) {
    const expected = [...config.getModeConfig(mode).tools].sort();
    const session = await new ManagedSession(ctx, { group: name, specOptions: { mode } }).start();
    try {
      const { tools } = await session.session.listTools(10000);
      const actual = tools.map((t) => t.name).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'mode-tool-list',
          title: `tools/list in ${mode} mode differs from getModeConfig`,
          expected: expected.join(', '),
          actual: actual.join(', '),
          reproducer: { target: ctx.targetName, mode, method: 'tools/list' },
        });
      }
      const serverName = session.session.client.getServerVersion()?.name;
      const expectedName = mode === 'full' ? 'terragrunt-mcp-server' : `terragrunt-mcp-server-${mode}`;
      if (serverName !== expectedName) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'mode-server-name',
          title: `Server name in ${mode} mode is not ${expectedName}`,
          expected: expectedName,
          actual: String(serverName),
          reproducer: { target: ctx.targetName, mode, method: 'initialize' },
        });
      }

      for (const hidden of allTools.filter((t) => !expected.includes(t))) {
        const r = await session.call(hidden, {}, { label: `hidden-in-${mode}`, checkShape: false });
        const body = parseBody(r.result);
        if (!(r.result?.isError === true && body?.errorType === 'MODE_RESTRICTION')) {
          report.add({
            severity: 'high',
            group: name,
            kind: 'mode-bypass',
            tool: hidden,
            title: `${hidden} is callable in ${mode} mode`,
            expected: 'isError with errorType MODE_RESTRICTION',
            actual: r.error ? `error: ${r.error.message}` : `isError=${r.result?.isError} body=${JSON.stringify(body)?.slice(0, 200)}`,
            reproducer: { target: ctx.targetName, mode, tool: hidden, arguments: {} },
          });
        }
      }

      if (mode === 'full') {
        for (const unknown of UNKNOWN_NAMES) {
          const r = await session.call(unknown, {}, { label: 'unknown-tool', checkShape: false });
          if (!(r.error || r.result?.isError === true)) {
            report.add({
              severity: 'medium',
              group: name,
              kind: 'unknown-tool',
              tool: unknown.slice(0, 40),
              title: `Unknown tool name accepted without an error: ${JSON.stringify(unknown.slice(0, 30))}`,
              expected: 'an error reply',
              actual: JSON.stringify(r.result)?.slice(0, 200),
              reproducer: { target: ctx.targetName, tool: unknown.slice(0, 60), arguments: {} },
            });
          }
        }
      }
      notes.push(`${mode}: ${actual.length} tools`);
    } finally {
      await session.close();
    }
  }
  return { notes };
}
