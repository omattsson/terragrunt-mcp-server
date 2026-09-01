#!/usr/bin/env tsx
/**
 * Upstream revision drift check.
 *
 * The curated data in this repo (diagnosis pattern anchors, the experiment
 * inventory, the docs fixture) is pinned to one gruntwork-io/terragrunt
 * revision (UPSTREAM_REVISION in src/terragrunt/docs-manifest.ts). Upstream
 * moves daily, so comparing the pin against HEAD directly would report drift
 * forever. Instead, this script reports drift only when upstream commits since
 * the pin touch a watched path — a file our curated data anchors on.
 *
 * Per watched path: find the latest upstream commit touching it, then check
 * whether that commit is an ancestor of the pin. If it is not, the path
 * changed after the pin and the curated data may be stale.
 *
 * Output: JSON drift report on stdout (progress on stderr). Exit code is 0
 * even when drift is found; CI reads `hasDrift` from the report.
 *
 * Refresh procedure: docs/upstream-parity.md.
 */
import { UPSTREAM_REVISION } from '../src/terragrunt/docs-manifest.js';

const UPSTREAM_REPO = 'gruntwork-io/terragrunt';
const API_BASE = 'https://api.github.com';

export interface WatchedPath {
  path: string;
  reason: string;
}

/**
 * Upstream paths whose changes invalidate curated data in this repo.
 * Keep in sync with the evidence files listed in docs/upstream-parity.md.
 */
export const WATCHED_PATHS: WatchedPath[] = [
  // Experiment inventory (fixtures/terragrunt-experiments.json, src/terragrunt/experiments.ts)
  { path: 'internal/experiment/experiment.go', reason: 'experiment inventory names and status' },
  { path: 'docs/src/data/experiments', reason: 'experiment summaries' },
  // Reference surfaces (docs manifest fixture; CLI commands and flags)
  { path: 'docs/src/data/commands', reason: 'CLI command reference' },
  { path: 'docs/src/data/flags', reason: 'CLI flag reference' },
  // Diagnosis pattern anchors (#253) — see docs/upstream-parity.md
  { path: 'pkg/config/stack_validation.go', reason: 'stack validation diagnosis patterns' },
  { path: 'pkg/config/errors.go', reason: 'stack and experiment-gate diagnosis patterns' },
  { path: 'pkg/config/hclparse/errors.go', reason: 'expansion diagnosis patterns' },
  { path: 'internal/getter/oci.go', reason: 'OCI diagnosis patterns' },
  { path: 'internal/getter/errors.go', reason: 'OCI credential diagnosis patterns' },
  { path: 'internal/engine/engine.go', reason: 'engine diagnosis patterns' },
  { path: 'internal/engine/verification.go', reason: 'engine integrity diagnosis pattern' },
  { path: 'internal/cli/commands/browse/errors.go', reason: 'experiment gate diagnosis pattern' },
  { path: 'internal/remotestate/backend/azurerm/errors.go', reason: 'managed azurerm diagnosis patterns' },
  { path: 'pkg/config/dependency_state_azurerm.go', reason: 'azurerm dependency-state diagnosis pattern' },
  { path: 'internal/cli/commands/run/flags.go', reason: 'experiment-gated run flag messages' },
  { path: 'internal/cli/flags/shared/filter.go', reason: 'bounded-discovery gate message' },
];

export interface CommitInfo {
  sha: string;
  date: string;
  message: string;
  url: string;
}

export interface PathState {
  path: string;
  reason: string;
  changedSincePin: boolean;
  latestCommit?: CommitInfo;
}

export interface UpstreamDriftReport {
  hasDrift: boolean;
  timestamp: string;
  pinnedRevision: string;
  upstreamHead: string;
  aheadBy: number;
  changed: PathState[];
  unchanged: string[];
}

/**
 * A compare status of 'ahead' or 'diverged' means the candidate commit is not
 * reachable from the pin, so the path changed after the pin.
 * Exported for testing.
 */
export function compareStatusMeansDrift(status: string): boolean {
  return status === 'ahead' || status === 'diverged';
}

/**
 * Assemble the drift report from per-path states.
 * Exported for testing.
 */
export function buildReport(
  pinnedRevision: string,
  upstreamHead: string,
  aheadBy: number,
  pathStates: PathState[]
): UpstreamDriftReport {
  const changed = pathStates.filter(s => s.changedSincePin);
  const unchanged = pathStates.filter(s => !s.changedSincePin).map(s => s.path);

  return {
    hasDrift: changed.length > 0,
    timestamp: new Date().toISOString(),
    pinnedRevision,
    upstreamHead,
    aheadBy,
    changed,
    unchanged
  };
}

/**
 * GitHubClient - minimal REST client with retry and optional token auth.
 */
export class GitHubClient {
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;
  private readonly token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

  async get(path: string, attempt = 1): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'terragrunt-mcp-server-upstream-drift'
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${path}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }
      console.error(`  Retry ${attempt}/${this.retryAttempts} for ${path}...`);
      await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
      return this.get(path, attempt + 1);
    }
  }

  /** Resolve the default branch and its current head commit sha. */
  async getUpstreamHead(): Promise<{ branch: string; sha: string }> {
    const repo = await this.get(`/repos/${UPSTREAM_REPO}`) as { default_branch: string };
    const branch = repo.default_branch;
    const head = await this.get(`/repos/${UPSTREAM_REPO}/commits/${branch}`) as { sha: string };
    return { branch, sha: head.sha };
  }

  /** Count commits on the default branch that the pin does not have. */
  async getAheadBy(pinned: string, head: string): Promise<number> {
    const cmp = await this.get(`/repos/${UPSTREAM_REPO}/compare/${pinned}...${head}`) as { ahead_by: number };
    return cmp.ahead_by;
  }

  /** Latest commit on the default branch touching the given path, if any. */
  async latestCommitForPath(path: string, branch: string): Promise<CommitInfo | undefined> {
    const commits = await this.get(
      `/repos/${UPSTREAM_REPO}/commits?path=${encodeURIComponent(path)}&sha=${branch}&per_page=1`
    ) as Array<{ sha: string; html_url: string; commit: { message: string; committer: { date: string } } }>;

    const latest = commits[0];
    if (!latest) {
      return undefined;
    }
    return {
      sha: latest.sha,
      date: latest.commit.committer.date,
      message: latest.commit.message.split('\n')[0],
      url: latest.html_url
    };
  }

  /** Whether the given commit is NOT an ancestor of the pin (changed after the pin). */
  async isAfterPin(sha: string, pinned: string, cache: Map<string, boolean>): Promise<boolean> {
    if (sha === pinned) {
      return false;
    }
    const cached = cache.get(sha);
    if (cached !== undefined) {
      return cached;
    }
    const cmp = await this.get(`/repos/${UPSTREAM_REPO}/compare/${pinned}...${sha}`) as { status: string };
    const result = compareStatusMeansDrift(cmp.status);
    cache.set(sha, result);
    return result;
  }
}

async function main(): Promise<void> {
  const client = new GitHubClient();

  console.error(`Checking ${UPSTREAM_REPO} against pinned revision ${UPSTREAM_REVISION}...`);
  const { branch, sha: upstreamHead } = await client.getUpstreamHead();
  console.error(`Upstream ${branch} is at ${upstreamHead}`);

  const aheadBy = upstreamHead === UPSTREAM_REVISION
    ? 0
    : await client.getAheadBy(UPSTREAM_REVISION, upstreamHead);
  console.error(`Upstream is ${aheadBy} commits ahead of the pin`);

  const pathStates: PathState[] = [];
  const ancestorCache = new Map<string, boolean>();

  for (const watched of WATCHED_PATHS) {
    if (aheadBy === 0) {
      pathStates.push({ ...watched, changedSincePin: false });
      continue;
    }

    const latestCommit = await client.latestCommitForPath(watched.path, branch);
    if (!latestCommit) {
      // Path no longer exists upstream at all; treat as drift so it gets reviewed.
      console.error(`  ⚠️  ${watched.path}: no commits found (path removed or renamed?)`);
      pathStates.push({ ...watched, changedSincePin: true });
      continue;
    }

    const changedSincePin = await client.isAfterPin(latestCommit.sha, UPSTREAM_REVISION, ancestorCache);
    console.error(`  ${changedSincePin ? '⚠️  changed' : '✅ unchanged'}: ${watched.path}`);
    pathStates.push({ ...watched, changedSincePin, latestCommit });
  }

  const report = buildReport(UPSTREAM_REVISION, upstreamHead, aheadBy, pathStates);

  console.error(
    report.hasDrift
      ? `\n⚠️  ${report.changed.length} watched path(s) changed since the pin`
      : '\n✅ No watched paths changed since the pin'
  );

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// Run only when executed directly (not when imported by tests). Matches the
// TypeScript source and any transpiled variant.
if (process.argv[1] && /check-upstream-drift\.(?:ts|js|mjs|cjs)$/.test(process.argv[1])) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
