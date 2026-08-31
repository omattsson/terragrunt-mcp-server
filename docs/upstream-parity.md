# Upstream parity checks

These tests guard the curated Terragrunt data in `src/terragrunt/*` against a
pinned upstream revision, so upstream drift fails a test instead of silently
rotting.

- Pinned revision: `2a4802eb604cc7175d9937a9d5303d66656b86ed` (2026-08-29).
- Single source of truth for the revision string: `UPSTREAM_REVISION` in
  `src/terragrunt/docs-manifest.ts`.

## What each guard covers

| Surface | Baseline | Test |
| --- | --- | --- |
| CLI commands | `TERRAGRUNT_DOC_MANIFEST` command pages | `test/unit/cli-commands-manager.test.ts` |
| HCL blocks | `hcl/blocks` page in the docs fixture | `test/unit/hcl-blocks-manager.test.ts` |
| Built-in functions | `hcl/functions` page in the docs fixture | `test/unit/static-builtin-functions.test.ts` |
| Experiments (active/completed) | `fixtures/terragrunt-experiments.json` | `test/unit/experiments-fixture.test.ts`, function cross-check |
| Error diagnosis (Azure/unit/stack) | in-code patterns | `test/unit/error-patterns.test.ts` |

OCI and CAS diagnosis patterns are tracked in #253 and appear as `it.todo`
placeholders until then.

## Refresh procedure

The two fixtures come from two upstream sources (the live docs site and the Go
checkout), so align them by revision:

1. Check out `gruntwork-io/terragrunt` at the revision in `fixtures/README.md`.
2. `npm run update-fixture` (reads the docs site).
3. `TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture`
   (reads the Go checkout).
4. If the revision changed, update `UPSTREAM_REVISION` in
   `src/terragrunt/docs-manifest.ts` and the metadata in `fixtures/README.md`.
5. `npm run test:unit`.
6. Review each parity failure. A failure is a real drift signal: update the
   curated data in `src/terragrunt/*` by hand. Do not edit ignore lists or
   alias maps to hide a genuine new command, block, or function.
