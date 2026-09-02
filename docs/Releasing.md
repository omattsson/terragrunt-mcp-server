# Releasing

How to cut a release of the Terragrunt MCP Server. Releases are driven by the
**Create Release** workflow (`.github/workflows/release.yml`), a manual
two-phase `workflow_dispatch`. You do not tag locally — you dispatch the
workflow twice. This guide supersedes the older root-level `RELEASE.md`.

## Versioning

Follow [semantic versioning](https://semver.org/):

- **MAJOR** — a breaking change to the MCP tool API (a tool removed, a required
  parameter added, an existing response field removed or changed in meaning).
- **MINOR** — backward-compatible new functionality (a new tool, a new
  parameter, a new response field, additional diagnosis patterns or templates).
- **PATCH** — backward-compatible fixes only.

Adding fields or optional parameters is a MINOR bump, not MAJOR.

## Steps

### 1. Phase 1 — create the version-bump PR

Run **Actions → Create Release** with:

- `version`: the new version, no `v` prefix (e.g. `1.3.0`)
- `action`: `create-pr`
- `prerelease`: leave unchecked for a normal release

Or from the CLI:

```bash
gh workflow run release.yml -f version=1.3.0 -f action=create-pr
```

This runs `build`, `lint`, and `test:server`, then creates branch
`release/v1.3.0`, bumps `package.json` and `package-lock.json` (`npm version … --no-git-tag-version`),
and opens a **version-bump PR** into `main`.

### 2. Add curated release notes

The publish step uses a file named `CHANGELOG-<version>.md` at the repo root if
it exists; otherwise it auto-generates notes from raw commit subjects (one line
per commit — noisy for a large release). **Prefer a curated file.**

Add `CHANGELOG-<version>.md` to the release branch:

```bash
git fetch origin release/v1.3.0
git checkout release/v1.3.0
# write CHANGELOG-1.3.0.md (What's New, Features, Fixes, Maintenance)
git add CHANGELOG-1.3.0.md
git commit -m "docs: add curated release notes for v1.3.0"
git push
```

Base the notes on the merged PRs since the previous tag:

```bash
git log v1.2.0..origin/main --oneline --merges
```

### 3. Merge the version-bump PR

Wait for CI to pass on the PR, then merge it. `main` now carries the new version
and the `CHANGELOG-<version>.md`.

### 4. Phase 2 — publish the release

Run **Create Release** again with the **same version** and:

- `action`: `publish-release`

```bash
gh workflow run release.yml -f version=1.3.0 -f action=publish-release
```

This verifies `package.json` matches the input (it fails if the bump PR was not
merged), builds a Docker image, generates the changelog (or uses your
`CHANGELOG-<version>.md`), creates and pushes tag `v1.3.0`, and publishes the
GitHub Release as **Latest**.

### 5. Publish the versioned Docker image

`docker-publish.yml` triggers on `v*.*.*` tags and produces the semver image
tags (`X.Y.Z`, `X.Y`, `X`) plus `latest`. **However**, a tag pushed by another
workflow using `GITHUB_TOKEN` does not trigger other workflows (a GitHub
anti-recursion rule), and the release workflow pushes the tag with
`GITHUB_TOKEN`. So the release tag does **not** auto-trigger a Docker publish.

Publish the versioned image explicitly:

```bash
gh workflow run docker-publish.yml -f tag=1.3.0 -f push_latest=true
```

This pushes `olofdevopsninja/terragrunt-mcp-server:1.3.0` and refreshes
`:latest`. (A **manually** pushed `v*` tag would trigger `docker-publish`
automatically; only workflow-pushed tags need this dispatch.)

## Notes

- **No npm publish.** The project ships via source and Docker, not npm.
- **Per-merge Docker builds.** `docker-publish.yml` also runs on every push to
  `main`, publishing `:latest` and a commit-`sha` tag, so `:latest` always
  tracks `main` between releases.
- **Prereleases.** Set `prerelease: true` in Phase 2 to mark the GitHub Release
  as a pre-release (it will not become `Latest`).
