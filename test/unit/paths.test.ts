import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { resolveCacheDir, resolveMetricsDir } from '../../src/terragrunt/paths.js';

const homeBase = path.join(os.homedir(), '.cache', 'terragrunt-mcp');

describe('resolveCacheDir', () => {
  it('uses TERRAGRUNT_MCP_CACHE_DIR when set', () => {
    expect(resolveCacheDir({ TERRAGRUNT_MCP_CACHE_DIR: '/x' })).toBe('/x');
  });

  it('resolves a relative override to an absolute path', () => {
    expect(resolveCacheDir({ TERRAGRUNT_MCP_CACHE_DIR: 'rel/dir' })).toBe(path.resolve('rel/dir'));
  });

  it('uses XDG_CACHE_HOME when it is absolute', () => {
    expect(resolveCacheDir({ XDG_CACHE_HOME: '/xdg' })).toBe(path.join('/xdg', 'terragrunt-mcp', 'docs'));
  });

  it('ignores an empty XDG_CACHE_HOME', () => {
    expect(resolveCacheDir({ XDG_CACHE_HOME: '' })).toBe(path.join(homeBase, 'docs'));
  });

  it('ignores a relative XDG_CACHE_HOME', () => {
    expect(resolveCacheDir({ XDG_CACHE_HOME: 'relative' })).toBe(path.join(homeBase, 'docs'));
  });

  it('falls back to ~/.cache/terragrunt-mcp/docs', () => {
    expect(resolveCacheDir({})).toBe(path.join(homeBase, 'docs'));
  });
});

describe('resolveMetricsDir', () => {
  it('uses TERRAGRUNT_MCP_METRICS_DIR when set', () => {
    expect(resolveMetricsDir({ TERRAGRUNT_MCP_METRICS_DIR: '/m' })).toBe('/m');
  });

  it('uses XDG_CACHE_HOME when it is absolute', () => {
    expect(resolveMetricsDir({ XDG_CACHE_HOME: '/xdg' })).toBe(path.join('/xdg', 'terragrunt-mcp', 'metrics'));
  });

  it('falls back to ~/.cache/terragrunt-mcp/metrics', () => {
    expect(resolveMetricsDir({})).toBe(path.join(homeBase, 'metrics'));
  });
});
