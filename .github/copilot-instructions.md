# Terragrunt MCP Server - AI Assistant Guide

## Architecture

MCP server (stdio transport) providing Terragrunt documentation to AI assistants. Tool-only architecture — 8 tools in FULL mode, subsetted via 5 server modes (`FULL`, `CORE`, `CONFIG`, `GUIDANCE`, `OBSERVABILITY`).

```
src/index.ts              # Entry point — TerragruntMCPServer class, stdio transport
src/handlers/tools.ts     # ToolHandler: all 8 tool schemas + executeTool() switch (~2600 lines)
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

**Multi-tier cache (DocsManager `src/terragrunt/docs.ts`):** In-memory `Map` → LRU search cache → Disk `.cache/terragrunt-docs/` (gzip-compressed) → Network (cheerio scraping from terragrunt.gruntwork.io) → Fixture fallback (`fixtures/terragrunt-docs-fixture.json`).

**Case-insensitive lookups:** Managers use `private normalizeKey(name: string): string` with `Map<string, T>` for cache keys. Follow this pattern in any new manager (see `src/terragrunt/functions.ts`, `src/terragrunt/best-practices.ts`).

**MCP error handling — never throw:** Always return valid MCP responses with error info in the payload:
```typescript
try { return { data: await operation() }; }
catch (error) { console.error('...', error); return { data: [], error: 'message' }; }
```

**Template loading priority:** `TemplatesManager` (`src/terragrunt/templates/index.ts`) loads from multiple loaders sorted by priority (builtin=10, schema=15, filesystem=50, custom API=100). Higher priority overrides lower.

## Development

```bash
npm run build                # Required before any testing (tsc → dist/)
npm run test:unit            # Vitest unit tests (test/unit/*.test.ts)
npm run test:all             # Unit + all integration tests
npm test -- test/unit/functions-manager.test.ts  # Single file
npm run lint:fix             # ESLint v9 flat config
```

**Testing conventions:** Tests use Vitest with `vi.mock()` for manager dependencies. Test files in `test/unit/` mirror source names (e.g., `functions-manager.test.ts` tests `src/terragrunt/functions.ts`). Always mock `TerragruntDocsManager` — it does network I/O. See `test/unit/tool-handler.test.ts` for the canonical mocking pattern.

**Integration tests** run against the compiled output: `node test/server-test.js` sends raw JSON-RPC over stdio. Build first.

## Adding a New Tool

1. Add tool schema in `ToolHandler.getAvailableTools()` — name, description, inputSchema
2. Add case in `ToolHandler.executeTool()` switch
3. Add to the appropriate mode's `tools` array in `src/modes/config.ts` (and add its dependency type)
4. Add unit test in `test/unit/tool-handler.test.ts`
5. Update tool count assertions in MCP protocol tests
6. Prefer merging into an existing tool with a `mode` parameter over creating a new tool

## Adding a New Manager

1. Create in `src/terragrunt/` — accept `TerragruntDocsManager` in constructor if doc access is needed
2. Use `Map<string, T>` + `normalizeKey()` for case-insensitive caching
3. Implement lazy `loadData()` called on first use
4. Add dependency type to `DependencyType` union in `src/modes/config.ts`
5. Wire instantiation in `ToolHandler.initializeManagers()` behind `shouldLoadDependency()` guard

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
TERRAGRUNT_LAZY_LOADING=true npm start     # Reduce memory footprint 60-80%
```
Server logs to stderr (visible in VS Code Output panel).

**End-user tool selection guide**: See [docs/Copilot-Instructions-Template.md](../docs/Copilot-Instructions-Template.md)