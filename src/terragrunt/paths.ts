import * as os from 'os';
import * as path from 'path';

/**
 * Locations for the docs cache and persisted metrics.
 *
 * Resolution order: explicit env var, then `$XDG_CACHE_HOME/terragrunt-mcp`
 * (only when absolute), then `~/.cache/terragrunt-mcp`. Pure functions: they
 * never touch the filesystem, so callers create directories lazily.
 */

function baseDir(env: NodeJS.ProcessEnv): string {
  const xdg = env.XDG_CACHE_HOME;
  if (xdg && path.isAbsolute(xdg)) {
    return path.join(xdg, 'terragrunt-mcp');
  }
  let home = '';
  try {
    home = os.homedir();
  } catch {
    // Fall through to tmpdir below
  }
  return path.join(home || os.tmpdir(), '.cache', 'terragrunt-mcp');
}

/** Directory for the docs cache (`TERRAGRUNT_MCP_CACHE_DIR` overrides). */
export function resolveCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.TERRAGRUNT_MCP_CACHE_DIR;
  return override ? path.resolve(override) : path.join(baseDir(env), 'docs');
}

/** Directory for persisted metrics (`TERRAGRUNT_MCP_METRICS_DIR` overrides). */
export function resolveMetricsDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.TERRAGRUNT_MCP_METRICS_DIR;
  return override ? path.resolve(override) : path.join(baseDir(env), 'metrics');
}
