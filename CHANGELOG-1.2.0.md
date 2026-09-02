## What's New in v1.2.0

A large, backward-compatible release: new configuration-generator modes, a much
deeper error-diagnosis database, structured experiment guidance, and new
upstream-parity automation. No tools were removed and no existing response
field changed.

### Features

- **build_config — preview & diff mode** (#95): `preview` performs a dry-run
  (never writes) and reports `targetExists` / `wouldOverwrite` / `wouldBackup`;
  `compareWith` returns a unified diff of the result against an existing file.
  Reads are restricted to the configured allowed directories.
- **build_config — CI/CD templates** (#96): new `cicd` use case with GitHub
  Actions, GitLab CI, and Azure DevOps templates (automation-friendly OpenTofu
  args plus an optional, correctly-gated auto-approve). `options` is now optional
  for use cases that have no required variables.
- **diagnose_terragrunt_error — modern patterns** (#253) and **CAS patterns**
  (#268): new `stack`, `engine`, `oci`, `experiment`, and `cas` categories.
  The database grows from 66 to 110 patterns across 12 categories, with secret
  redaction on the extracted context and a single source of truth for the counts.
- **get_guidance — experiment status** (#252): experiment gates are surfaced as
  structured `experimentGate` objects across CLI, HCL, function, and guidance
  responses, plus a new `experiments` guidance topic.
- **Static built-in functions reference** (#247): function reference is served
  from curated data, checked against upstream.
- **Upstream parity & drift automation** (#244, #269): offline parity guards for
  CLI/HCL/function/experiment data pinned to a Terragrunt revision, and a weekly
  workflow that opens/auto-closes an issue when a watched upstream file drifts
  from the pin.

### Fixes

- **Schema drift detector accuracy** (#212): nesting/tier-aware comparison ends
  the recurring false positives; the workflow now auto-closes the drift issue
  when it clears.
- Modernize the CLI reference (#243), preserve documentation metadata (#246),
  use canonical documentation URLs (#249), refresh the docs fixture (#245),
  correct the terragrunt.hcl reference (#242), S3 native lockfile locking (#248),
  and HCL block iteration / CAS handling (#251).

### Maintenance

- Migrate Vitest config to v4 top-level pool options (#267).
- Bump GitHub Actions to Node 24 majors (#265).
- Clear Dependabot security alerts — SDK and Vitest bumps (#262).

### Installation

```bash
npm install
npm run build
```

### Docker

```bash
docker build -t terragrunt-mcp-server:1.2.0 .
docker run -i terragrunt-mcp-server:1.2.0
```
