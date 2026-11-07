# Terragrunt Documentation Fixtures

This directory contains static fixture files used as fallback when fetching documentation fails.

## Files

### `terragrunt-docs-fixture.json`

A snapshot of Terragrunt documentation that serves as a fallback when:
- Network fetch fails after retries
- Documentation website is unavailable
- Running in CI environments with network restrictions

This ensures tests remain deterministic and don't fail due to network issues.

### `terragrunt-experiments.json`

Holds the inventory of active and completed Terragrunt experiments, pinned via
its `upstreamRevision` field to stay synchronized with the Terragrunt upstream.
Experiments data is extracted from the Terragrunt Go checkout to ensure parity
tests can verify which experiments are available. Refresh with:

```bash
TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture
```

See [docs/upstream-parity.md](../docs/upstream-parity.md) for the full refresh procedure.

## Fallback Strategy

The documentation fetching follows this priority:

1. **In-memory cache** - Fastest, used if already loaded
2. **Disk cache** - `.cache/terragrunt-docs/` (24-hour expiry)
3. **Network fetch with retry** - Fetches from docs.terragrunt.com with exponential backoff:
   - Max retries: 3
   - Initial delay: 1 second
   - Max delay: 10 seconds
   - Backoff multiplier: 2x
4. **Stale disk cache** - If network fails, use expired cache
5. **Fixture fallback** - Last resort, uses this static fixture

## Updating the Fixture

To update the fixture with fresh documentation from `llms-small.txt`:

```bash
npm run update-fixture
```

The script forces the canonical source (`https://docs.terragrunt.com/llms-small.txt`)
regardless of any `TERRAGRUNT_LLMS_SOURCE` environment variable, then calls
`TerragruntDocsManager.fetchFromLlmsTxt()` to download and parse the docs,
and writes the result to `fixtures/terragrunt-docs-fixture.json`.

The script writes only when the live page list matches `TERRAGRUNT_DOC_MANIFEST`
(same titles, order and count) and no page got a fallback URL. Otherwise it
prints how to proceed (re-pin with `npm run update-docs-manifest` from a newer
upstream checkout, or wait for the site), exits with code 2 and leaves the
fixture untouched. `npm run update-fixture -- --check` only compares.

After updating, commit the changes:

```bash
git add fixtures/terragrunt-docs-fixture.json
git commit -m "chore: Update Terragrunt documentation fixture"
```

## Fixture Contents

The fixture contains 147 Markdown documentation pages sourced from
`llms-small.txt`, covering:
- Getting Started guides
- Configuration reference
- Features documentation
- CLI commands
- HCL blocks, attributes, and functions
- Troubleshooting guides

Snapshot generated: November 7, 2026

Upstream baseline: Terragrunt revision
`0fa02c2575fa8256d1e6d12fc553381fb74f3dbb` from November 6, 2026.
