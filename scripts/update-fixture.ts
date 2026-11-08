#!/usr/bin/env tsx
/**
 * Fixture Update Script
 *
 * Fetches the latest Terragrunt documentation from llms-small.txt
 * using TerragruntDocsManager.fetchFromLlmsTxt() (which internally
 * parses the content via the instance method parseLlmsMarkdown) and
 * writes the result to fixtures/terragrunt-docs-fixture.json.
 *
 * Usage: npm run update-fixture [-- --check]
 *
 * The fixture is written only when the live page list matches
 * TERRAGRUNT_DOC_MANIFEST (same titles, same order, same count) and no page
 * got a guessed fallback URL. Otherwise the script refuses and leaves the
 * fixture untouched (exit code 2). With --check it compares and exits without
 * writing.
 *
 * Part of the llms.txt integration epic (#221).
 * See: https://github.com/omattsson/terragrunt-mcp-server/issues/228
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TerragruntDocsManager } from '../src/terragrunt/docs.js';
import { TERRAGRUNT_DOC_MANIFEST, UPSTREAM_REVISION } from '../src/terragrunt/docs-manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'terragrunt-docs-fixture.json');

const LLMS_SMALL_URL = 'https://docs.terragrunt.com/llms-small.txt';

/** Site origin that the parser puts in front of the manifest paths. */
export const DOCS_BASE_URL = 'https://docs.terragrunt.com';

/** Exit code when the guard refuses to write the fixture. */
const EXIT_REFUSED = 2;

/** At most this many problems are printed in a refusal. */
const MAX_PROBLEMS_SHOWN = 20;

type ManifestEntry = readonly [title: string, path: string, description?: string];

export interface ManifestCheck {
  ok: boolean;
  /** One human-readable line per difference; empty when `ok`. */
  problems: string[];
}

const quote = (titles: string[]): string => titles.map(t => JSON.stringify(t)).join(', ');

/** Titles in `from` that are not matched by a title in `against`, counting duplicates. */
function titleDifference(from: string[], against: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const t of against) remaining.set(t, (remaining.get(t) ?? 0) + 1);
  const result: string[] = [];
  for (const t of from) {
    const n = remaining.get(t) ?? 0;
    if (n > 0) remaining.set(t, n - 1);
    else result.push(t);
  }
  return result;
}

/**
 * Compares the pages that the parser returned for the live llms-small.txt with
 * the manifest the parser used. The parser warns about a page with a guessed
 * URL but does not return the list, so this checks it again: a page whose URL is
 * not a manifest URL got a fallback.
 *
 * Pure: no I/O, no logging.
 *
 * @param docs - Parsed pages in document order.
 * @param manifest - `[title, path, description?]` entries in generator order.
 * @param baseUrl - Origin the parser prepends to the manifest paths.
 */
export function checkDocsAgainstManifest(
  docs: ReadonlyArray<{ title: string; url: string }>,
  manifest: readonly ManifestEntry[],
  baseUrl: string = DOCS_BASE_URL,
): ManifestCheck {
  const problems: string[] = [];
  const liveTitles = docs.map(d => d.title);
  const manifestTitles = manifest.map(([title]) => title);
  const manifestUrls = new Set(manifest.map(([, p]) => `${baseUrl}${p}`));

  if (docs.length !== manifest.length) {
    problems.push(`the live list has ${docs.length} pages, the manifest has ${manifest.length}`);
  }

  const unexpected = titleDifference(liveTitles, manifestTitles);
  if (unexpected.length > 0) {
    problems.push(`pages that the manifest does not know: ${quote(unexpected)}`);
  }
  const missing = titleDifference(manifestTitles, liveTitles);
  if (missing.length > 0) {
    problems.push(`manifest pages missing from the live list: ${quote(missing)}`);
  }

  // Same titles in a different order (only meaningful when the multisets agree).
  if (unexpected.length === 0 && missing.length === 0) {
    const at = liveTitles.findIndex((t, i) => t !== manifestTitles[i]);
    if (at !== -1) {
      problems.push(
        `the order differs from the manifest, first at position ${at + 1}: ` +
        `live ${JSON.stringify(liveTitles[at])}, manifest ${JSON.stringify(manifestTitles[at])}`,
      );
    }
  }

  const fallbacks = docs.filter(d => !manifestUrls.has(d.url));
  if (fallbacks.length > 0) {
    const shown = fallbacks.map(d => `${JSON.stringify(d.title)} -> ${d.url}`).join(', ');
    problems.push(`${fallbacks.length} page(s) got a fallback URL that is not in the manifest: ${shown}`);
  }

  // A page with the right title and a manifest URL, but not the URL of its own entry.
  docs.forEach((d, i) => {
    const entry = manifest[i];
    if (!entry || d.title !== entry[0]) return;
    const expected = `${baseUrl}${entry[1]}`;
    if (d.url !== expected && manifestUrls.has(d.url)) {
      problems.push(`position ${i + 1} ${JSON.stringify(d.title)} has URL ${d.url}, the manifest has ${expected}`);
    }
  });

  return { ok: problems.length === 0, problems };
}

/** Builds the text printed when the guard refuses; says how to proceed. */
export function refusalMessage(problems: readonly string[]): string {
  const shown = problems.slice(0, MAX_PROBLEMS_SHOWN).map(p => `  - ${p}`);
  if (problems.length > MAX_PROBLEMS_SHOWN) {
    shown.push(`  - ... and ${problems.length - MAX_PROBLEMS_SHOWN} more`);
  }
  return [
    'ERROR: the live documentation does not match the pinned docs manifest. The fixture was not written;',
    'fixtures/terragrunt-docs-fixture.json was left untouched.',
    '',
    shown.join('\n'),
    '',
    'The live site has moved on from the upstream revision that the manifest is pinned to',
    `(UPSTREAM_REVISION ${UPSTREAM_REVISION}). Either:`,
    '  1. Re-pin: check out a newer gruntwork-io/terragrunt revision that matches the live site,',
    '     run `TERRAGRUNT_REPO=<checkout> npm run update-docs-manifest`, review the diff of',
    '     src/terragrunt/docs-manifest.ts, then run `npm run update-fixture` again.',
    '  2. Or wait until the site is rebuilt from the revision you pinned, then run this script again.',
    'See docs/upstream-parity.md ("Refresh procedure").',
  ].join('\n');
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');

  // Force canonical source to ensure deterministic fixture regeneration,
  // regardless of any TERRAGRUNT_LLMS_SOURCE env var the user may have set.
  process.env.TERRAGRUNT_LLMS_SOURCE = LLMS_SMALL_URL;

  console.log(`Fetching Terragrunt documentation from ${LLMS_SMALL_URL}...`);

  const docsManager = new TerragruntDocsManager();
  const docs = await docsManager.fetchFromLlmsTxt();

  if (docs.length === 0) {
    console.error(`ERROR: No documents were returned from ${LLMS_SMALL_URL}.`);
    console.error(`Check network connectivity and that ${LLMS_SMALL_URL} is reachable.`);
    process.exit(1);
  }

  console.log(`Fetched ${docs.length} documents.`);

  const hasFunctionsPage = docs.some(d => d.title === 'Functions');
  if (!hasFunctionsPage) {
    console.error('\nERROR: "Functions" page not found — the generated fixture would be invalid.');
    console.error('Check whether the title has changed in llms-small.txt. The fixture was not written.');
    process.exit(1);
  }

  const check = checkDocsAgainstManifest(docs, TERRAGRUNT_DOC_MANIFEST);
  if (!check.ok) {
    console.error(refusalMessage(check.problems));
    process.exit(EXIT_REFUSED);
  }
  console.log(`The live page list matches the manifest (${docs.length} pages, UPSTREAM_REVISION ${UPSTREAM_REVISION}).`);

  if (checkOnly) {
    console.log('--check: fixture not written.');
    return;
  }

  // Write pretty-printed JSON atomically: temp file + rename to avoid
  // leaving a partially-written/corrupt fixture if the process is interrupted.
  const tempFixturePath = `${FIXTURE_PATH}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempFixturePath, JSON.stringify(docs, null, 2) + '\n', 'utf-8');
  await fs.rename(tempFixturePath, FIXTURE_PATH);
  console.log(`Wrote fixture to ${path.relative(process.cwd(), FIXTURE_PATH)}`);

  // Quick validation summary
  const functionDocs = docs.filter(
    d => d.title.toLowerCase().includes('function') ||
         (d.section === 'reference' && d.url.includes('/functions/'))
  );
  console.log('\nValidation summary:');
  console.log(`  Total docs:      ${docs.length}`);
  console.log(`  Function docs:   ${functionDocs.length}`);
  console.log('  Functions page:  present');
}

// Run only when invoked directly, so tests can import the pure functions.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
