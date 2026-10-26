/**
 * End-to-end stdio tests
 *
 * Builds the server, spawns the compiled entry points (dist/index.js and the
 * bin/ mode wrappers) and drives them over a real stdio transport with the MCP
 * SDK client. This exercises the protocol boundary that ToolHandler-level tests
 * cannot see: stdout must carry only JSON-RPC, and failed tool calls must be
 * reported with isError.
 *
 * Runs offline: the docs source points at an unreachable address with retries
 * disabled, so the server falls back to the disk cache or the bundled fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ServerMode, getModeConfig } from '../../src/modes/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SERVER_ENV = {
  TERRAGRUNT_LLMS_SOURCE: 'http://127.0.0.1:9/llms-small.txt',
  TERRAGRUNT_RETRY_MAX_RETRIES: '0',
  TERRAGRUNT_MCP_FILE_WRITE_ENABLED: 'false',
};

const ENTRY_POINTS: Record<ServerMode, string> = {
  [ServerMode.FULL]: 'dist/index.js',
  [ServerMode.CORE]: 'bin/terragrunt-mcp-core',
  [ServerMode.CONFIG]: 'bin/terragrunt-mcp-config',
  [ServerMode.GUIDANCE]: 'bin/terragrunt-mcp-guidance',
  [ServerMode.OBSERVABILITY]: 'bin/terragrunt-mcp-observability',
};

/** A minimal valid call for each tool */
const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  search_docs: { query: 'dependency' },
  cli_reference: { command: 'run' },
  function_reference: { function_name: 'find_in_parent_folders' },
  get_hcl_config_reference: { config: 'dependency' },
  get_guidance: { type: 'experiments' },
  build_config: { useCase: 'cicd', backend: 'github-actions' },
  diagnose_terragrunt_error: { error_message: 'Error acquiring the state lock' },
  get_server_metrics: {},
};

interface Connection {
  client: Client;
  /** Errors raised by the client transport, including stdout lines that are not JSON-RPC */
  transportErrors: Error[];
}

async function connect(mode: ServerMode): Promise<Connection> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, ENTRY_POINTS[mode])],
    cwd: ROOT,
    env: SERVER_ENV,
    stderr: 'ignore',
  });
  const transportErrors: Error[] = [];
  // Installed before connect so startup output is covered; Client.connect chains it
  transport.onerror = (error: Error) => {
    transportErrors.push(error);
  };
  const client = new Client({ name: 'stdio-e2e-test', version: '1.0.0' });
  await client.connect(transport);
  return { client, transportErrors };
}

function parseText(result: Awaited<ReturnType<Client['callTool']>>): any {
  const content = result.content as Array<{ type: string; text: string }>;
  expect(content[0].type).toBe('text');
  return JSON.parse(content[0].text);
}

describe('stdio end-to-end', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')], {
      cwd: ROOT,
      stdio: 'pipe',
    });
  }, 120000);

  describe('full mode', () => {
    let conn: Connection;

    beforeAll(async () => {
      conn = await connect(ServerMode.FULL);
    }, 30000);

    afterAll(async () => {
      await conn?.client.close();
    });

    it('identifies itself and advertises tools', () => {
      expect(conn.client.getServerVersion()?.name).toBe('terragrunt-mcp-server');
      expect(conn.client.getServerCapabilities()?.tools).toBeDefined();
    });

    it.each([
      ...Object.entries(SAMPLE_ARGS),
      ['search_docs', { mode: 'list' }],
    ])('%s %j succeeds without isError', async (name, args) => {
      const result = await conn.client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      expect(parseText(result)).toBeTypeOf('object');
    });

    it.each([
      ['build_config', { useCase: 'nope' }, /No template found/],
      ['build_config', { useCase: 'remote_state', backend: 's3', options: { bucket: 'b' } }, /Missing required variables/],
      ['function_reference', { function_name: 'no_such_function' }, /No Terragrunt function found/],
      ['no_such_tool', {}, /Unknown tool/],
    ])('%s %j reports isError', async (name, args, message) => {
      const result = await conn.client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      expect(parseText(result).error).toMatch(message);
    });

    it('writes only JSON-RPC to stdout', () => {
      // Runs after the calls above, which trigger docs loading and template loading
      expect(conn.transportErrors.map(e => e.message)).toEqual([]);
    });
  });

  describe.each([
    ServerMode.CORE,
    ServerMode.CONFIG,
    ServerMode.GUIDANCE,
    ServerMode.OBSERVABILITY,
  ])('%s mode wrapper', (mode) => {
    let conn: Connection;

    beforeAll(async () => {
      conn = await connect(mode);
    }, 30000);

    afterAll(async () => {
      await conn?.client.close();
    });

    it('lists exactly the tools configured for the mode', async () => {
      const { tools } = await conn.client.listTools();
      expect(tools.map(t => t.name).sort()).toEqual([...getModeConfig(mode).tools].sort());
      expect(conn.client.getServerVersion()?.name).toBe(`terragrunt-mcp-server-${mode}`);
    });

    it('serves its first tool over stdout without stray output', async () => {
      const [firstTool] = getModeConfig(mode).tools;
      const result = await conn.client.callTool({ name: firstTool, arguments: SAMPLE_ARGS[firstTool] });
      expect(result.isError).toBeFalsy();
      expect(conn.transportErrors.map(e => e.message)).toEqual([]);
    });
  });
});
