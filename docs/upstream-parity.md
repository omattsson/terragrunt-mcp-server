# Upstream parity checks

These tests guard the curated Terragrunt data in `src/terragrunt/*` against a
pinned upstream revision, so upstream drift fails a test instead of silently
rotting.

- Pinned revision: `0fa02c2575fa8256d1e6d12fc553381fb74f3dbb` (2026-11-06).
- Single source of truth for the revision string: `UPSTREAM_REVISION` in
  `src/terragrunt/docs-manifest.ts`.

## What each guard covers

| Surface | Baseline | Test |
| --- | --- | --- |
| Docs page list | `TERRAGRUNT_DOC_MANIFEST` (generated from the upstream docs tree) | `test/unit/docs-manager.test.ts`, `test/unit/update-docs-manifest.test.ts`, `test/unit/update-fixture.test.ts` |
| CLI commands | `TERRAGRUNT_DOC_MANIFEST` command pages | `test/unit/cli-commands-manager.test.ts` |
| HCL blocks | `## <name>` headings of the `hcl/blocks` page plus the per-item pages `hcl/blocks/<name>/` in the docs fixture | `test/unit/hcl-blocks-manager.test.ts` |
| Built-in functions | `## <name>` headings of the `hcl/functions` page plus the per-item pages `hcl/functions/<name>/` in the docs fixture | `test/unit/static-builtin-functions.test.ts` |
| Experiments (active/completed) | `fixtures/terragrunt-experiments.json` | `test/unit/experiments-fixture.test.ts`, function cross-check |
| Error diagnosis (Azure/unit/stack) | in-code patterns | `test/unit/error-patterns.test.ts` |
| Modern diagnosis patterns | in-code patterns anchored to upstream `Error()` strings | `test/unit/error-patterns-modern.test.ts` |
| Diagnosis pattern/category counts | `getPatternStats()` (single source of truth) | `test/unit/error-pattern-stats.test.ts` |

### HCL names: two page shapes

Upstream is moving the HCL reference to one page per item (a block, an
attribute or a function gets its own page, `hcl/<kind>/<name>/`). While the
move is under way a documented name lives in one of two shapes: an `## <name>`
heading on the combined reference page (`hcl/<kind>/`) for items not yet moved,
or its own per-item page for moved items. At the pin, `catalog` (block),
`prevent_destroy` (attribute) and `get_env` (function) have per-item pages.
The shared helper `documentedHclNames()` in `test/unit/upstream-hcl-names.ts`
returns the union of both shapes, and the block and function parity tests use
it, so they keep working as items move. Per-item pages are listed in the docs
manifest, and their data lives in `docs/src/data/hcl/<kind>/<name>.mdx`
upstream. Curated entries for moved items link to the per-item page (for
example `catalog` links to `/reference/hcl/blocks/catalog/`). Items without a
per-item page keep an anchor on the combined page.

The modern diagnosis patterns (#253) cover typed stack validation, block
expansion, OCI sources and credentials, the IaC engine, experiment gates,
managed `azurerm` state, and the content-addressable store (CAS). Each pattern
regex anchors on a verbatim upstream `Error()` string, read at the pinned
revision, in these files:

- `pkg/config/stack_validation.go`, `pkg/config/errors.go`
- `pkg/config/hclparse/errors.go`
- `internal/getter/oci.go`, `internal/getter/errors.go`
- `internal/engine/engine.go`, `internal/engine/verification.go`
- `internal/cli/commands/browse/errors.go`,
  `internal/cli/commands/login/errors.go`,
  `internal/cli/commands/mcp/errors.go`, and the other experiment gates
- `pkg/config/dependency_state_azurerm.go`,
  `internal/remotestate/backend/azurerm/errors.go`
- `internal/cas/errors.go` (CAS / update_source_with_cas)

The same test also anchors the dependency patterns (#294) on
`pkg/config/errors.go`: `DependencyCycleError` ("Found a dependency cycle
between modules: "), `ReadTerragruntConfigCycleError`
("read_terragrunt_config cycle detected: "), and
`TerragruntOutputTargetNoOutputs` ("... but detected no outputs").

The documented pattern and category counts come from one source of truth:
`ErrorPatternMatcher.getPatternStats()` computes them from the pattern array,
and `test/unit/error-pattern-stats.test.ts` fails if the counts quoted in
`README.md`, the blog post, or the class JSDoc drift from it.

## Experiment inventory

`src/terragrunt/experiments.ts` is the typed experiment inventory (13 active,
23 completed at the pin) used to surface experiment gates. It is pinned to
`UPSTREAM_REVISION` (`EXPERIMENT_REVISION`), and its names and active/completed
split are cross-checked against `fixtures/terragrunt-experiments.json`
(`test/unit/experiments.test.ts`). Names and status come from the Go source
(`internal/experiment/experiment.go`, via the fixture); summaries come from
`docs/src/data/experiments/<name>.mdx`.

The inventory drives the structured `experiment` gate on gated CLI commands,
CLI options, HCL blocks, and HCL attributes (surfaced in `cli_reference`,
`get_hcl_config_reference`, and `function_reference` responses) and the
`get_guidance` `experiments` topic. Active experiments are enabled with
`--experiment <name>` or `TG_EXPERIMENT=<name>`; completed experiments are
default and need no flag. To refresh: after
`TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture`
(see below), reconcile `EXPERIMENTS` in `experiments.ts` with the fixture (the
cross-check test fails on any drift) and refresh summaries from the upstream
`.mdx` files.

## Automated pin drift check

The Upstream Revision Check workflow
(`.github/workflows/upstream-check.yml`, weekly on Monday, or manual dispatch)
runs `npm run check-upstream-drift`. The script compares the pinned
`UPSTREAM_REVISION` against the `gruntwork-io/terragrunt` default branch, but
reports drift only when commits since the pin touch a **watched path** — a file
the curated data anchors on:

- the diagnosis evidence files above and `internal/experiment/experiment.go`;
- the reference data: `docs/src/data/commands`, `docs/src/data/flags`,
  `docs/src/data/experiments`, and `docs/src/data/hcl` (the per-item HCL data:
  blocks, attributes, functions);
- the HCL reference pages under `docs/src/content/docs/04-reference/01-hcl`
  (combined pages and migration placeholders);
- the docs manifest sources that are small and change when a page is added,
  renamed or removed: `docs/src/lib/generated-pages.ts` (the llms page order),
  `docs/src/data/faq` and `docs/src/data/patterns`.

The rest of the docs collection (the `content/docs` folder of the upstream docs
site) is **not** watched as a whole, because ordinary prose edits there happen almost daily and would keep
the check red. A page added to or removed from that collection is therefore not
reported by the watcher; the `update-fixture` guard finds it the next time the
fixture is refreshed. The same holds for the strict controls data: its two
status pages are fixed in the manifest.
Upstream moving ahead by itself is not drift; that would flag forever.

On drift the workflow opens or updates an issue labeled `upstream-drift` with
the changed paths, why each matters, and the latest commit per path. The issue
closes automatically once the pin is refreshed and no watched path has drifted.
The watched-path list lives in `scripts/check-upstream-drift.ts`; a unit test
cross-checks it against the evidence files and the upstream docs paths
(data folders and generator files) listed in this document.

## Refresh procedure

The curated data comes from three upstream sources: the docs tree of a
checkout (the page list), the live docs site (the page content) and the Go
source of the same checkout (experiments). They must describe the same
revision. Steps 1 and 2 choose the pin; everything else follows from it.

1. **Choose the pin.** Check out `gruntwork-io/terragrunt` at the revision to
   pin (normally the head of the default branch). The revision in
   `UPSTREAM_REVISION` is only the previous pin and is not an input.
2. **Regenerate the docs manifest.**
   `TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-docs-manifest`
   rewrites `src/terragrunt/docs-manifest.ts` (the page list: titles, canonical
   URLs, order) from the docs tree of the checkout and sets `UPSTREAM_REVISION`
   to the checkout's HEAD. The page list depends on the latest Terragrunt
   release, because upstream hides entries whose `since` is newer than that
   release. The script reads the release with `gh api`; pass the release the
   live site was built with via `--release vX.Y.Z` or
   `TERRAGRUNT_LATEST_RELEASE` when it differs. It refuses a checkout with
   uncommitted changes under `docs/`. `--keep-revision` keeps the old
   `UPSTREAM_REVISION` and is only for a manifest-only experiment. Review the
   manifest diff.
3. **Refresh the docs fixture.** `npm run update-fixture` reads
   `llms-small.txt` from the live site (the page content) and writes
   `fixtures/terragrunt-docs-fixture.json`; the page list and URLs come from the
   manifest. It refuses to write, and leaves the fixture untouched (exit code
   2), when the live page list differs from the manifest in titles, order or
   count, or when any page would get a guessed fallback URL. That means the
   site and the pin have drifted apart. Either re-pin to a checkout that matches
   the site (repeat from step 1 with the revision the site was built from), or
   wait until the site is rebuilt from the pinned revision and run the command
   again. `npm run update-fixture -- --check` compares without writing.

   The guard checks titles, order, count and URLs. It does **not** check page
   descriptions or page bodies: a description-only or body-only change on the
   site is not caught, because the manifest stores a description only for
   duplicate titles. The fixture content is whatever the site serves at that
   moment, so review the fixture diff.
4. **Refresh the experiments fixture.**
   `TERRAGRUNT_REPO=<path-to-terragrunt> npm run update-experiments-fixture`
   reads the Go checkout (`internal/experiment/experiment.go`) and writes
   `fixtures/terragrunt-experiments.json`. Then reconcile `EXPERIMENTS` in
   `src/terragrunt/experiments.ts` with it (the cross-check test fails on any
   drift) and refresh summaries from `docs/src/data/experiments/<name>.mdx`.
5. **Update the metadata** (revision, date, page count, snapshot date) in
   `fixtures/README.md` and the pin line at the top of this file.
6. **Run the tests**: `npm run test:unit`.
7. **Review each parity failure.** A failure is a real drift signal: update the
   curated data in `src/terragrunt/*` by hand. Do not edit ignore lists or
   alias maps to hide a genuine new command, block, attribute or function. For
   HCL names the parity tests use `documentedHclNames()` (see "HCL names: two
   page shapes"): a new name shows up either as a heading on the combined page
   or as a per-item page. A curated entry for a name that moved to its own page
   should link to that page.
8. **Diagnosis patterns.** Re-read the upstream evidence files listed above. If
   an `Error()` string changed, update the matching regex in
   `src/terragrunt/error-patterns.ts` and its verbatim anchor in
   `test/unit/error-patterns-modern.test.ts`. If you add or remove a pattern,
   the count guard in `test/unit/error-pattern-stats.test.ts` fails until you
   update `README.md`, the blog post, and the class JSDoc to the new totals.
9. **Verify the drift check.** After the merge, `npm run check-upstream-drift`
   should report no drift on the watched paths (set `GITHUB_TOKEN` to avoid API
   rate limits); the open `upstream-drift` issue then closes automatically.
