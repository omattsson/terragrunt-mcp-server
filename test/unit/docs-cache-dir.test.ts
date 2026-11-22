import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

describe('TerragruntDocsManager cache directory', () => {
  let tmp: string;
  const saved = process.env.TERRAGRUNT_MCP_CACHE_DIR;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tg-cache-'));
  });

  afterEach(async () => {
    if (saved === undefined) delete process.env.TERRAGRUNT_MCP_CACHE_DIR;
    else process.env.TERRAGRUNT_MCP_CACHE_DIR = saved;
    vi.restoreAllMocks();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('writes the disk cache to TERRAGRUNT_MCP_CACHE_DIR', async () => {
    const dir = path.join(tmp, 'docs');
    process.env.TERRAGRUNT_MCP_CACHE_DIR = dir;
    const manager = new TerragruntDocsManager();
    await (manager as any).saveCacheToDisk();
    const files = await fs.readdir(dir);
    expect(files).toContain('metadata.json');
  });

  it('does not throw and logs to stderr when the cache directory is unwritable', async () => {
    const blocker = path.join(tmp, 'file');
    await fs.writeFile(blocker, 'x');
    process.env.TERRAGRUNT_MCP_CACHE_DIR = path.join(blocker, 'docs');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager = new TerragruntDocsManager();
    await expect((manager as any).saveCacheToDisk()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
