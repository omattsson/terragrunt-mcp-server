# Terragrunt MCP Server - AI Assistant Guide

GitHub Copilot code review reads this file. Claude Code imports it from `CLAUDE.md`.

## What to flag first in a review

1. Anything that writes to stdout in `src/` (`console.log`, `console.info`, `console.debug`, `process.stdout.write`): it corrupts the MCP JSON-RPC stream.
2. A tool handler that throws instead of returning an error payload, or an error payload that `isErrorResult` does not see (no `error`, no `success: false`).
3. File writes or diff reads outside `TERRAGRUNT_MCP_ALLOWED_DIRS`, a path check without `realpath`, or a weaker extension or size limit (see "File writing").
4. A network fetch without the timeout and size cap of `fetchConfig` (`TERRAGRUNT_FETCH_TIMEOUT_MS`, `TERRAGRUNT_FETCH_MAX_BYTES`).
5. An import without the `.js` extension (runtime crash).
6. A new tool, or a tool moved between modes, without the matching change in `MODE_CONFIGS` and the mode tests (`test/unit/modes/`).
7. A changed tool schema or behavior without updated tests and docs (`README.md`, `docs/`).
8. A diagnosis or search result that claims a confident match on weak evidence (see `test/unit/diagnosis-false-matches.test.ts`).

## Architecture

MCP server (stdio transport) providing Terragrunt documentation to AI assistants. Tool-only architecture — 8 tools in FULL mode, subsetted via 5 server modes (`FULL`, `CORE`, `CONFIG`, `GUIDANCE`, `OBSERVABILITY`).

```
src/index.ts              # Entry point — TerragruntMCPServer class, stdio transport
src/stdio-guard.ts        # Redirects every console method to stderr; must stay the first import of index.ts
src/handlers/tools.ts     # ToolHandler: all 8 tool schemas, executeTool() switch and callTool() (~3000 lines)
src/modes/config.ts       # ServerMode enum, MODE_CONFIGS (tool lists + dependency lists per mode)
src/terragrunt/           # Domain managers — each owns one concern (docs, functions, CLI, etc.)
src/types/                # Shared interfaces (hcl-blocks, templates, metrics, mcp)
```

**Manager wiring:** `ToolHandler.initializeManagers()` conditionally instantiates managers based on `shouldLoadDependency(dep, mode)`. Managers that need doc access take `TerragruntDocsManager` as a constructor param. Mode configs in `src/modes/config.ts` declare which dependencies each mode needs.

**ES Module critical rule:** This project uses `"type": "module"`. All imports MUST use `.js` extensions:
```typescript
import { ToolHandler } from './handlers/tools.js';  // ✓
import { ToolHandler } from './handlers/tools';     // ✗ Runtime crash
```

## Key Patterns

**Multi-tier cache (DocsManager `src/terragrunt/docs.ts`):** In-memory `Map` → LRU search cache → Disk `.cache/terragrunt-docs/` (gzip-compressed) → Network (llms.txt from docs.terragrunt.com) → Fixture fallback (`fixtures/terragrunt-docs-fixture.json`).

**Case-insensitive lookups:** Managers use `private normalizeKey(name: string): string` with `Map<string, T>` for cache keys. Follow this pattern in any new manager (see `src/terragrunt/functions.ts`, `src/terragrunt/best-practices.ts`).

**MCP error handling — never throw:** Always return valid MCP responses with error info in the payload:
```typescript
try { return { data: await operation() }; }
catch (error) { console.error('...', error); return { data: [], error: 'message' }; }
```
A result with a non-empty `error` (a string, or an object with a non-empty `message`) or `success: false` is reported to the client with `isError: true` (`isErrorResult` in `src/handlers/tools.ts`, applied once in `ToolHandler.callTool`). Preview results that still produced a diff are not errors. In metrics, a failure is recorded with `logError` only: `calls`, sizes and latencies count successful calls, and `errors` counts failures.

**Logging — stderr only:** stdout carries the MCP JSON-RPC stream. Use `console.error` / `console.warn`; ESLint `no-console` rejects `console.log`, `console.info` and `console.debug` in `src/`. `src/stdio-guard.ts` also points every console method at stderr, but it does not cover direct `process.stdout.write` calls. Keep `import './stdio-guard.js'` the first import of `src/index.ts`.

**File writing (`src/terragrunt/file-writer.ts`):** writes and diff reads are refused unless the target is inside `TERRAGRUNT_MCP_ALLOWED_DIRS` (no default). The check resolves symlinks with `fs.realpath`. Other settings: `TERRAGRUNT_MCP_FILE_WRITE_ENABLED` (`false` turns writes off), `TERRAGRUNT_MCP_ALLOWED_EXTENSIONS` (default `.hcl`), `TERRAGRUNT_MCP_AUTO_BACKUP`, `TERRAGRUNT_MCP_MAX_FILE_SIZE` (default 1 MiB). Never add a default directory or skip the realpath check.

**Docs fetch (`src/terragrunt/docs.ts`):** every fetch has a timeout and a size cap (`TERRAGRUNT_FETCH_TIMEOUT_MS`, default 10 s; `TERRAGRUNT_FETCH_MAX_BYTES`, default 16 MiB) and retries with backoff (`TERRAGRUNT_RETRY_*`). The docs source can be changed with `TERRAGRUNT_LLMS_SOURCE`.

**Template loading priority:** `TemplatesManager` (`src/terragrunt/templates/index.ts`) loads from multiple loaders sorted by priority (builtin=10, schema=15, filesystem=50, custom API=100). Higher priority overrides lower.

## Development

```bash
npm run build                # Required before the integration tests (tsc → dist/)
npm run test:unit            # Vitest unit tests (test/unit/**/*.test.ts)
npm run test:all             # Unit + all integration tests
npx vitest run --config vitest.unit.config.ts test/unit/functions-manager.test.ts  # Single file
npm run lint                 # ESLint 10 flat config (eslint.config.mjs)
npm run lint:fix
```

Versions: Node `>=20.19.0` (`engines`); CI runs Node 24. Vitest 5, ESLint 10, TypeScript 5.

**Testing conventions:** Tests use Vitest with `vi.mock()` for manager dependencies. Test files in `test/unit/` mirror source names (e.g., `functions-manager.test.ts` tests `src/terragrunt/functions.ts`). Always mock `TerragruntDocsManager` — it does network I/O. See `test/unit/tool-handler.test.ts` for the canonical mocking pattern.

**Integration tests** run against the compiled output: `node test/server-test.js` sends raw JSON-RPC over stdio. Build first.

## Schema Drift Detection

Backend schemas (`schemas/backends/*.json`) track Terraform backend attributes:
```bash
npm run check-schema-drift   # Compare against HashiCorp docs
```
Schema updates require human review — never auto-update. Include `deprecated: true` for removed attributes and bump the schema version.

## Debugging

```bash
./test-mcp.sh                              # Raw JSON-RPC protocol test
rm -rf .cache/terragrunt-docs/             # Force cache refresh
TERRAGRUNT_CACHE_TTL_HOURS=1 npm start     # Docs cache TTL in hours (default 24)
```
Server logs to stderr (visible in VS Code Output panel).

**Commits and PRs:** Conventional Commits (`CONTRIBUTING.md`); PRs use `.github/pull_request_template.md`.

**End-user tool selection guide**: See [docs/Copilot-Instructions-Template.md](../docs/Copilot-Instructions-Template.md)