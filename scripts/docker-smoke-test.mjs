#!/usr/bin/env node
/**
 * Smoke test for the Docker image: starts it with no network and a read-only
 * root filesystem, then checks over MCP stdio that
 *   - the backend schema templates shipped in the image load, and
 *   - docs search is served from the bundled fixture.
 *
 * Usage: node scripts/docker-smoke-test.mjs <image>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const image = process.argv[2];
if (!image) {
  console.error('Usage: node scripts/docker-smoke-test.mjs <image>');
  process.exit(2);
}

const TIMEOUT_MS = 90_000;

// The complete S3 template only exists when schemas/backends is shipped; the
// builtin fallback template lacks the schema-derived attributes below.
const SCHEMA_CALL_ARGS = {
  useCase: 'remote_state',
  backend: 's3',
  tier: 'complete',
  options: { bucket: 'b', key: 'k/terraform.tfstate', region: 'eu-west-1' },
};
const SCHEMA_CHECK = (text) => text.includes('skip_s3_checksum');

// An empty result still echoes the query, so check for actual results.
const HAS_RESULTS = (search) => Array.isArray(search.results) && search.results.length > 0;

function fail(message) {
  console.error(`SMOKE TEST FAILED: ${message}`);
  process.exit(1);
}

const timer = setTimeout(() => fail(`timed out after ${TIMEOUT_MS / 1000}s`), TIMEOUT_MS);

const transport = new StdioClientTransport({
  command: 'docker',
  args: ['run', '-i', '--rm', '--network', 'none', '--read-only', '--tmpfs', '/cache', '-e', 'TERRAGRUNT_RETRY_MAX_RETRIES=0', image],
  stderr: 'inherit',
});
const client = new Client({ name: 'docker-smoke-test', version: '1.0.0' });

async function callJson(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) fail(`${name} returned isError: ${JSON.stringify(result.content)}`);
  return result.content[0].text;
}

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  if (!tools.length) fail('server listed no tools');

  const template = await callJson('build_config', SCHEMA_CALL_ARGS);
  if (!SCHEMA_CHECK(template)) fail('schema-based backend template did not load');

  const search = JSON.parse(await callJson('search_docs', { query: 'dependency' }));
  if (!HAS_RESULTS(search)) fail('docs search returned no results (fixture fallback not working)');

  console.error('Smoke test passed');
  await client.close();
  clearTimeout(timer);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
