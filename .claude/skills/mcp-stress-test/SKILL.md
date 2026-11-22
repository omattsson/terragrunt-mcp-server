---
name: mcp-stress-test
description: Run the hermetic MCP stress harness (protocol, fuzz, load, writes, modes, hostile docs, lifecycle) against the built server or the Docker image and triage the findings report. Report only.
disable-model-invocation: true
---

Stress test the server: $ARGUMENTS

The harness lives in `scripts/mcp-stress/` and uses only the MCP SDK and Node built-ins. It reports findings; it never fixes them.

1. **Build.** `npm run build`. The harness runs `dist/index.js` (or a Docker image), so a stale build gives stale findings.
2. **Pick target and groups.**
   - Target: `--target dist` (default) or `--target docker:<image>` (runs with `--network none --read-only`; hostile-docs and lifecycle signal tests are skipped there).
   - Groups: `protocol, fuzz, load, writes, modes, hostile-docs, lifecycle`. `--quick` runs protocol, modes and a reduced fuzz in under a minute.
   - Other flags: `--mode`, `--duration`, `--concurrency`, `--seed`, `--out`, `--call-timeout`.
3. **Run.** `npm run stress -- <flags>`. Examples: `npm run stress -- --quick`; `npm run stress -- --duration 30 --concurrency 100`; `npm run stress -- --groups writes`. Exit code 1 means a critical or high finding, 2 a harness or usage error.
4. **Read the report.** `stress-report/<timestamp>/report.md` (and `results.json`). Severity: critical = crash, hang, or a write or read outside the sandbox; high = stdout pollution, stack or path leak, guard bypass; medium = inconsistent errors, unbounded latency or memory; info = numbers. Re-run each reproducer (payload plus seed) before believing a finding. A finding is a measurement, not a verdict: say so when a limit simply does not exist yet.
5. **Hand over.** List the confirmed findings to the user with their reproducers. Suggest `/diagnosing-bugs` or `/tdd` per finding. Do not fix anything unprompted.

Rules:

- Sandbox only. Every write test is confined to a `mkdtemp` directory; the harness refuses to start when `ALLOWED_DIRS` would contain `$HOME` or `/`. Never point it at real directories.
- Never edit `src/` from this skill, and never touch `dist/` (a hook protects it). Reports go to `stress-report/` (git-ignored).
- Nothing leaves the machine: the hostile docs server binds `127.0.0.1` and Docker runs without network.
- To check that the oracles still work, run `npx vitest run --config vitest.unit.config.ts test/unit/mcp-stress-fixture.test.ts`: the broken fixture must report its four planted defects and the clean one nothing.
