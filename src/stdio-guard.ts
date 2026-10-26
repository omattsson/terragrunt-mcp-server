/**
 * stdout carries the MCP JSON-RPC stream. Point every method of the global
 * console at a Console that writes only to stderr, so stray console output from
 * this codebase or its dependencies (log, info, debug, dir, table, ...) cannot
 * corrupt the protocol. The global console object itself is kept, so properties
 * such as console.Console stay available. Direct process.stdout.write calls are
 * not covered; the stdio transport itself writes that way.
 *
 * Import this module first in the entry point: ES module imports are hoisted,
 * so the redirect only covers module-load-time logging if it is evaluated
 * before every other import.
 */

import { Console } from 'console';

const stderrConsole = new Console({ stdout: process.stderr, stderr: process.stderr });
const globalConsole = console as unknown as Record<string, unknown>;

for (const [method, value] of Object.entries(stderrConsole)) {
  if (typeof value === 'function') {
    globalConsole[method] = value.bind(stderrConsole);
  }
}
