#!/usr/bin/env tsx
/**
 * Fixture Update Script
 *
 * Fetches the latest Terragrunt documentation from llms-small.txt
 * using TerragruntDocsManager.fetchFromLlmsTxt() (which internally
 * parses the content via the instance method parseLlmsMarkdown) and
 * writes the result to fixtures/terragrunt-docs-fixture.json.
 *
 * Usage: npm run update-fixture
 *
 * Part of the llms.txt integration epic (#221).
 * See: https://github.com/omattsson/terragrunt-mcp-server/issues/228
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TerragruntDocsManager } from '../src/terragrunt/docs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'terragrunt-docs-fixture.json');

const LLMS_SMALL_URL = 'https://terragrunt.gruntwork.io/llms-small.txt';

async function main(): Promise<void> {
  // Force canonical source to ensure deterministic fixture regeneration,
  // regardless of any TERRAGRUNT_LLMS_SOURCE env var the user may have set.
  process.env.TERRAGRUNT_LLMS_SOURCE = LLMS_SMALL_URL;

  console.log(`Fetching Terragrunt documentation from ${LLMS_SMALL_URL}...`);

  const docsManager = new TerragruntDocsManager();
  const docs = await docsManager.fetchFromLlmsTxt();

  if (docs.length === 0) {
    console.error('ERROR: No documents were returned from llms-small.txt.');
    console.error('Check network connectivity and that https://terragrunt.gruntwork.io/llms-small.txt is reachable.');
    process.exit(1);
  }

  console.log(`Fetched ${docs.length} documents.`);

  // Write pretty-printed JSON
  await fs.writeFile(FIXTURE_PATH, JSON.stringify(docs, null, 2) + '\n', 'utf-8');
  console.log(`Wrote fixture to ${path.relative(process.cwd(), FIXTURE_PATH)}`);

  // Quick validation summary
  const functionDocs = docs.filter(
    d => d.title.toLowerCase().includes('function') ||
         (d.section === 'reference' && d.url.includes('/functions/'))
  );
  const hasFunctionsPage = docs.some(d => d.title === 'Functions');

  console.log('\nValidation summary:');
  console.log(`  Total docs:      ${docs.length}`);
  console.log(`  Function docs:   ${functionDocs.length}`);
  console.log(`  Functions page:  ${hasFunctionsPage ? 'present' : 'MISSING'}`);

  if (!hasFunctionsPage) {
    console.error('\nERROR: "Functions" page not found — the generated fixture would be invalid.');
    console.error('Check whether the title has changed in llms-small.txt.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
