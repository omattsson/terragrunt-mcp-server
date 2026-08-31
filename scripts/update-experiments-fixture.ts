#!/usr/bin/env tsx
/**
 * Regenerates fixtures/terragrunt-experiments.json from the upstream
 * Terragrunt Go source (internal/experiment/experiment.go).
 *
 * Usage:
 *   TERRAGRUNT_REPO=/path/to/terragrunt npm run update-experiments-fixture
 *   npm run update-experiments-fixture -- --repo /path/to/terragrunt
 *
 * The Go source is not available in CI, so this is a maintainer-run refresh
 * step. Tests assert the fixture's internal consistency, not the Go source.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'terragrunt-experiments.json');
const EXPERIMENT_GO = path.join('internal', 'experiment', 'experiment.go');

/** Parse experiment.go into sorted active/completed name lists. */
export function parseExperiments(goSource: string): { active: string[]; completed: string[] } {
  // 1. Build ident -> kebab-name map from `Ident = "kebab-name"` constants.
  const nameByIdent = new Map<string, string>();
  for (const m of goSource.matchAll(/^\s*([A-Za-z]\w*)\s*=\s*"([a-z0-9-]+)"/gm)) {
    nameByIdent.set(m[1], m[2]);
  }

  // 2. Slice the NewExperiments() body so unrelated struct literals are ignored.
  const start = goSource.indexOf('func NewExperiments()');
  if (start === -1) throw new Error('no experiments: NewExperiments() not found');
  // Bound the scan to the function body so struct literals elsewhere in the file
  // cannot be absorbed. gofmt puts the function's closing brace at column 0.
  const rest = goSource.slice(start);
  const endRel = rest.search(/\n\}/);
  const body = endRel === -1 ? rest : rest.slice(0, endRel);

  // 3. Each entry is `{ Name: Ident }` or `{ Name: Ident, Status: StatusCompleted }`.
  const active = new Set<string>();
  const completed = new Set<string>();
  for (const m of body.matchAll(/\{\s*Name:\s*(\w+)\s*(?:,\s*Status:\s*Status(\w+)\s*)?,?\s*\}/g)) {
    const name = nameByIdent.get(m[1]);
    if (!name) continue; // ident without a string constant (not an experiment name)
    if (m[2] === 'Completed') completed.add(name);
    else active.add(name);
  }

  if (active.size + completed.size === 0) throw new Error('no experiments parsed from NewExperiments()');
  return {
    active: [...active].sort(),
    completed: [...completed].sort(),
  };
}

function resolveRepo(): string {
  const argIdx = process.argv.indexOf('--repo');
  const repo = argIdx !== -1 ? process.argv[argIdx + 1] : process.env.TERRAGRUNT_REPO;
  if (!repo) {
    console.error('ERROR: set TERRAGRUNT_REPO or pass --repo <path> to a terragrunt checkout.');
    process.exit(1);
  }
  return repo;
}

async function main(): Promise<void> {
  const repo = resolveRepo();
  const goSource = await fs.readFile(path.join(repo, EXPERIMENT_GO), 'utf-8');
  const { active, completed } = parseExperiments(goSource);
  const upstreamRevision = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD']).toString().trim();
  // Committer date of the checked-out commit (YYYY-MM-DD), so a refresh against a
  // newer checkout records that commit's date rather than a stale literal.
  const upstreamDate = execFileSync('git', ['-C', repo, 'show', '-s', '--format=%cs', 'HEAD']).toString().trim();

  const fixture = {
    upstreamRevision,
    upstreamDate,
    generatedAt: new Date().toISOString(),
    source: 'internal/experiment/experiment.go',
    active,
    completed,
  };

  const tmp = `${FIXTURE_PATH}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  await fs.rename(tmp, FIXTURE_PATH);
  console.log(`Wrote ${active.length} active, ${completed.length} completed experiments to ${path.relative(process.cwd(), FIXTURE_PATH)} (revision ${upstreamRevision}).`);
}

// Only run main when invoked directly, not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
