import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { MAX_SEARCH_QUERY_LENGTH, ToolHandler } from '../../src/handlers/tools.js';
import { NullMetricsManager } from '../../src/terragrunt/metrics.js';
import { ServerMode } from '../../src/modes/config.js';

// search_docs takes a free-text query from the client. Oversized queries must be
// rejected up front with a short error: no event-loop stall, no internal regex
// message echoing the query back.
describe('search_docs query length limit', () => {
  const saved: Record<string, string | undefined> = {};
  let tmp: string;
  let handler: ToolHandler;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-query-limit-'));
    const env: Record<string, string> = {
      TERRAGRUNT_MCP_LLMS_SOURCE: 'http://127.0.0.1:9/llms-small.txt',
      TERRAGRUNT_MCP_RETRY_MAX_RETRIES: '0',
      TERRAGRUNT_MCP_CACHE_TTL_HOURS: '0',
      TERRAGRUNT_MCP_CACHE_DIR: path.join(tmp, 'cache'),
      TERRAGRUNT_MCP_METRICS_DIR: path.join(tmp, 'metrics'),
    };
    for (const [key, value] of Object.entries(env)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
    handler = new ToolHandler(new NullMetricsManager(), ServerMode.FULL);
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it.each([
    ['letters only', 'a'.repeat(100_000)],
    ['a real term plus a huge word', `terragrunt ${'a'.repeat(100_000)}`],
    ['one mebibyte', 'a'.repeat(1_048_576)],
  ])('rejects an oversized query (%s) quickly with a clear error', async (_name, query) => {
    const started = performance.now();
    const { result, isError } = await handler.callTool('search_docs', { query });
    const elapsed = performance.now() - started;

    expect(isError).toBe(true);
    expect((result as { error: string }).error).toMatch(/too long/i);
    expect(JSON.stringify(result)).not.toMatch(/regular expression/i);
    expect(JSON.stringify(result).length).toBeLessThan(500);
    expect(elapsed).toBeLessThan(2000);
  }, 30_000);

  it('still answers a normal query', async () => {
    const { result, isError } = await handler.callTool('search_docs', { query: 'dependency outputs' });
    expect(isError).toBe(false);
    expect((result as { results: unknown[] }).results.length).toBeGreaterThan(0);
  }, 30_000);

  it('handles a real term plus a single word near the limit without a regex error', async () => {
    const query = `terragrunt ${'a'.repeat(MAX_SEARCH_QUERY_LENGTH - 11)}`;
    expect(query.length).toBe(MAX_SEARCH_QUERY_LENGTH);
    const started = performance.now();
    const { result } = await handler.callTool('search_docs', { query });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(JSON.stringify(result)).not.toMatch(/regular expression/i);
  }, 30_000);

  it('accepts a query of about 1400 characters (existing edge-case expectation)', async () => {
    const query = 'How to configure terragrunt dependencies with remote state '.repeat(24).trim();
    expect(query.length).toBeGreaterThan(1000);
    const { isError } = await handler.callTool('search_docs', { query });
    expect(isError).toBe(false);
  }, 30_000);

  it('accepts a query of exactly the maximum length and rejects one more character', async () => {
    const atLimit = `${'dependency '.repeat(400)}`.slice(0, MAX_SEARCH_QUERY_LENGTH);
    expect(atLimit.length).toBe(MAX_SEARCH_QUERY_LENGTH);
    expect((await handler.callTool('search_docs', { query: atLimit })).isError).toBe(false);

    const overLimit = `${atLimit}x`;
    const { result, isError } = await handler.callTool('search_docs', { query: overLimit });
    expect(isError).toBe(true);
    expect((result as { error: string }).error).toMatch(/too long/i);
  }, 30_000);
});
