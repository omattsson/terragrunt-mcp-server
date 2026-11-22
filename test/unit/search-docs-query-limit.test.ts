import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ToolHandler } from '../../src/handlers/tools.js';
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

  it('accepts a query at the limit boundary', async () => {
    const query = `${'dependency '.repeat(90)}`.trim(); // < 1000 characters
    const { isError } = await handler.callTool('search_docs', { query });
    expect(isError).toBe(false);
  }, 30_000);
});
