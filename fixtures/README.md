# Terragrunt Documentation Fixtures

This directory contains static fixture files used as fallback when fetching documentation fails.

## Files

### `terragrunt-docs-fixture.json`

A snapshot of Terragrunt documentation that serves as a fallback when:
- Network fetch fails after retries
- Documentation website is unavailable
- Running in CI environments with network restrictions

This ensures tests remain deterministic and don't fail due to network issues.

The page content comes from the live docs site (`llms-small.txt`). The page
list (titles, order, canonical URLs) comes from `TERRAGRUNT_DOC_MANIFEST` in
`src/terragrunt/docs-manifest.ts`, which is generated from an upstream
checkout and pinned to `UPSTREAM_REVISION` in the same file.

### `terragrunt-experiments.json`

Holds the inventory of active and completed Terragrunt experiments, pinned via
its `upstreamRevision` field to stay synchronized with the Terragrunt upstream.
Experiments data is extracted from the Terragrunt Go checkout to ensure parity
tests can verify which experiments are available. Refresh with:

```bash
TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture
```

Use the same checkout that the docs manifest was generated from, so both
fixtures describe one revision.

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

## Updating the Fixtures

Both fixtures belong to one upstream revision. Regenerate them in this order
(full procedure: [docs/upstream-parity.md](../docs/upstream-parity.md)):

```bash
# 1. Page list and pin: from an upstream checkout at the revision to pin.
#    Writes src/terragrunt/docs-manifest.ts and sets UPSTREAM_REVISION to the
#    checkout's HEAD.
TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-docs-manifest

# 2. Docs content: from the live site.
npm run update-fixture

# 3. Experiments: from the same checkout.
TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture
```

`npm run update-fixture` forces the canonical source
(`https://docs.terragrunt.com/llms-small.txt`) regardless of any
`TERRAGRUNT_LLMS_SOURCE` environment variable, then calls
`TerragruntDocsManager.fetchFromLlmsTxt()` to download and parse the docs, and
writes the result to `fixtures/terragrunt-docs-fixture.json`.

The script writes only when the live page list matches `TERRAGRUNT_DOC_MANIFEST`
(same titles, order and count) and no page got a fallback URL. Otherwise it
prints how to proceed (re-pin with `npm run update-docs-manifest` from a
checkout that matches the site, or wait for the site to be rebuilt), exits with
code 2 and leaves the fixture untouched. `npm run update-fixture -- --check`
only compares. The guard does not compare page descriptions or bodies: the
manifest stores descriptions only for duplicate titles, so a description-only or
body-only change on the site is not caught. Review the fixture diff.

After updating, update the metadata below (revision, pin date, page count,
snapshot date) and run `npm run test:unit`. Commit the manifest and both
fixtures together.

## Fixture Contents

The fixture contains 147 Markdown documentation pages (the number of entries in
`TERRAGRUNT_DOC_MANIFEST`) sourced from `llms-small.txt`, covering:
- Getting Started guides
- Configuration reference
- Features documentation
- CLI commands
- HCL blocks, attributes, and functions
- Troubleshooting guides

Snapshot generated: November 7, 2026

Upstream baseline (pin, `UPSTREAM_REVISION`): Terragrunt revision
`0fa02c2575fa8256d1e6d12fc553381fb74f3dbb` from November 6, 2026. The
experiments fixture carries the same revision in `upstreamRevision`.
