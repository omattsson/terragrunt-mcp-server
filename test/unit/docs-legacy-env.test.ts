import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

// The deprecated TERRAGRUNT_<name> aliases must keep working through the real
// consumer (TerragruntDocsManager), not only through readEnv itself.
const NAMES = ['RETRY_INITIAL_DELAY', 'RETRY_MAX_DELAY', 'CACHE_TTL_HOURS', 'CACHE_COMPRESSION'];

describe('TerragruntDocsManager deprecated environment variable aliases', () => {
  let tmp: string;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-legacy-env-'));
    saved.TERRAGRUNT_MCP_CACHE_DIR = process.env.TERRAGRUNT_MCP_CACHE_DIR;
    process.env.TERRAGRUNT_MCP_CACHE_DIR = tmp;
    for (const name of NAMES) {
      for (const key of [`TERRAGRUNT_${name}`, `TERRAGRUNT_MCP_${name}`]) {
        saved[key] = process.env[key];
        delete process.env[key];
      }
    }
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reads the legacy name and warns on stderr that it is deprecated', () => {
    process.env.TERRAGRUNT_RETRY_INITIAL_DELAY = '250';
    const manager = new TerragruntDocsManager();
    expect((manager as any).retryConfig.initialDelayMs).toBe(250);
    const warnings = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('TERRAGRUNT_RETRY_INITIAL_DELAY') && w.includes('TERRAGRUNT_MCP_RETRY_INITIAL_DELAY'))).toBe(true);
  });

  it('prefers the TERRAGRUNT_MCP_ name over the legacy name', () => {
    process.env.TERRAGRUNT_MCP_RETRY_MAX_DELAY = '777';
    process.env.TERRAGRUNT_RETRY_MAX_DELAY = '999';
    const manager = new TerragruntDocsManager();
    expect((manager as any).retryConfig.maxDelayMs).toBe(777);
  });

  it('applies the legacy cache settings and validates them under the new name', () => {
    process.env.TERRAGRUNT_CACHE_COMPRESSION = 'false';
    expect((new TerragruntDocsManager() as any).useCompression).toBe(false);
    delete process.env.TERRAGRUNT_CACHE_COMPRESSION;

    process.env.TERRAGRUNT_CACHE_TTL_HOURS = '-1';
    expect(() => new TerragruntDocsManager()).toThrow('TERRAGRUNT_MCP_CACHE_TTL_HOURS');
  });
});
