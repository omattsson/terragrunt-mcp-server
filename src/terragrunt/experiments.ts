/**
 * Structured inventory of Terragrunt experiments, pinned to the upstream
 * revision in docs-manifest.ts. Names and the active/completed split come from
 * internal/experiment/experiment.go (via fixtures/terragrunt-experiments.json);
 * summaries come from docs/src/data/experiments/<name>.mdx.
 */
import { UPSTREAM_REVISION } from './docs-manifest.js';

export type ExperimentStatus = 'active' | 'completed';

export interface Experiment {
  name: string;
  status: ExperimentStatus;
  summary: string;
}

export interface ExperimentGate {
  name: string;
  status: ExperimentStatus;
  summary: string;
  enable?: { flag: string; envVar: string };
  note?: string;
}

export const EXPERIMENT_REVISION = UPSTREAM_REVISION;

export const EXPERIMENTS: readonly Experiment[] = [
  // Active (opt-in) experiments.
  { name: 'symlinks', status: 'active', summary: 'Resolve symlinks when discovering Terragrunt units.' },
  { name: 'iac-engine', status: 'active', summary: 'Use pluggable Terragrunt IaC engines to run infrastructure updates.' },
  { name: 'dependency-fetch-output-from-state', status: 'active', summary: 'Fetch dependency outputs directly from state files.' },
  { name: 'slow-task-reporting', status: 'active', summary: 'Report progress for long-running Terragrunt operations.' },
  { name: 'azure-backend', status: 'active', summary: 'Use the Azure Storage (azurerm) remote state backend.' },
  { name: 'deep-merge', status: 'active', summary: 'Enable the deep_merge HCL function.' },
  { name: 'hook-context-env', status: 'active', summary: 'Expose additional TG_CTX_* environment variables to hook scripts.' },
  { name: 'optional-hooks', status: 'active', summary: 'Allow Terragrunt hooks to be disabled during run.' },
  { name: 'profiling', status: 'active', summary: 'Collect CPU, memory, and goroutine profiles for Terragrunt.' },
  { name: 'oci', status: 'active', summary: 'Download modules from OCI registries using oci:// sources.' },
  { name: 'version-attribute', status: 'active', summary: 'Resolve a registry module by version constraint via a version attribute on a source.' },
  { name: 'otel-logs', status: 'active', summary: 'Export Terragrunt logs as an OpenTelemetry logs signal.' },
  { name: 'catalog-format', status: 'active', summary: 'Non-interactive output formats (jsonl, md) for the catalog command.' },
  { name: 'bounded-discovery', status: 'active', summary: 'Bound --filter graph traversal to a directory with an inline (dir) operand.' },
  { name: 'block-iteration', status: 'active', summary: 'Reserve the expansion block to iterate dependency/unit/stack blocks over count or for_each.' },
  { name: 'browse-tui', status: 'active', summary: 'Add the terragrunt browse command for interactive infrastructure browsing.' },
  { name: 'mutable-generate', status: 'active', summary: 'Deduplicate generate-block files via content-addressable storage, with a mutable attribute.' },
  { name: 'optional-dependency-outputs', status: 'active', summary: 'Skip all dependency output resolution during a run.' },
  { name: 'tg-login', status: 'active', summary: 'Sign in to the Gruntwork Developer Portal from the CLI (tg login).' },
  // Completed experiments — now stable and enabled by default.
  { name: 'cli-redesign', status: 'completed', summary: 'The redesigned Terragrunt CLI.' },
  { name: 'stacks', status: 'completed', summary: 'Terragrunt stacks (terragrunt.stack.hcl).' },
  { name: 'cas', status: 'completed', summary: 'Terragrunt Content Addressable Storage (CAS).' },
  { name: 'report', status: 'completed', summary: 'Terragrunt run reports and summaries.' },
  { name: 'runner-pool', status: 'completed', summary: 'Dynamic runner pool that schedules units as soon as dependencies allow.' },
  { name: 'auto-provider-cache-dir', status: 'completed', summary: 'Native OpenTofu provider caching via TF_PLUGIN_CACHE_DIR.' },
  { name: 'filter-flag', status: 'completed', summary: 'Unit and stack filtering with the --filter flag.' },
  { name: 'dag-queue-display', status: 'completed', summary: 'Display the run queue as a DAG tree showing dependency hierarchy.' },
  { name: 'stack-dependencies', status: 'completed', summary: 'The autoinclude block in terragrunt.stack.hcl for dependency relationships between components.' },
  { name: 'catalog-redesign', status: 'completed', summary: 'Redesigned catalog TUI with whole-repository discovery and scaffolding.' },
  { name: 'mark-many-as-read', status: 'completed', summary: 'Mark many files as read in one step for reading-based filter expressions.' },
  { name: 'opt-out-auth', status: 'completed', summary: 'Opt out of running --auth-provider-cmd during discovery.' },
];

const BY_NAME = new Map<string, Experiment>(EXPERIMENTS.map((e) => [e.name, e]));

export function getExperiment(name: string): Experiment | undefined {
  return BY_NAME.get(name);
}

/** The single definition of how a user enables an experiment. */
export function experimentEnablement(name: string): { flag: string; envVar: string } {
  return { flag: `--experiment ${name}`, envVar: `TG_EXPERIMENT=${name}` };
}

/**
 * The structured gate surfaced in tool responses. For an unknown name (should
 * not happen — data is validated in tests) it falls back to an active gate so
 * the reference still renders and the gap is visible.
 */
export function describeGate(name: string): ExperimentGate {
  const exp = getExperiment(name);
  if (exp && exp.status === 'completed') {
    return {
      name,
      status: 'completed',
      summary: exp.summary,
      note: 'Completed and enabled by default; the --experiment flag is no longer needed.',
    };
  }
  return {
    name,
    status: 'active',
    summary: exp?.summary ?? '',
    enable: experimentEnablement(name),
  };
}

/** Shape returned by the get_guidance `experiments` topic. */
export function experimentsGuidance() {
  const shape = (e: Experiment) => ({ name: e.name, summary: e.summary });
  return {
    revision: EXPERIMENT_REVISION,
    howToEnable: {
      flag: '--experiment <name>',
      envVar: 'TG_EXPERIMENT=<name>',
      note: 'Active experiments are opt-in. Completed experiments are enabled by default and need no flag.',
    },
    active: EXPERIMENTS.filter((e) => e.status === 'active').map(shape),
    completed: EXPERIMENTS.filter((e) => e.status === 'completed').map(shape),
  };
}
