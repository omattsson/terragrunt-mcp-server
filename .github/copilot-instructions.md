# Terragrunt MCP Server - AI Assistant Guide

## Architecture

MCP server providing Terragrunt documentation to AI assistants via VS Code. Tool-only architecture (v1.0.0+).

```
src/
├── index.ts          # Server entry point (stdio transport)
├── handlers/tools.ts # 8 consolidated tools (search_docs, function_reference, cli_reference, etc.)
├── modes/config.ts   # Server modes: FULL, CORE, CONFIG, GUIDANCE, OBSERVABILITY
└── terragrunt/       # Domain managers (DocsManager, FunctionsManager, etc.)
```

### ES Module Critical Rule
All imports MUST use `.js` extensions (TypeScript compiles to `.js`):
```typescript
import { ToolHandler } from './handlers/tools.js';  // ✓ Correct
import { ToolHandler } from './handlers/tools';     // ✗ Runtime error
```

## Key Patterns

### Multi-tier Cache (DocsManager)
Fallback chain: In-memory → Disk (`.cache/terragrunt-docs/`) → Network (cheerio scraping) → Fixture (`fixtures/terragrunt-docs-fixture.json`)

### Parameter Extraction (FunctionsManager)
Two-pass approach with context enrichment:
```typescript
let parameters = parseParams(paramsRaw);
const ctxParams = parseParamsFromContext(ctx);
if (ctxParams.length > parameters.length) {
  parameters = ctxParams;  // Prefer richer context
}
```

### MCP Error Handling
Never throw to MCP layer - always return valid responses:
```typescript
try {
  return { data: await operation() };
} catch (error) {
  console.error('Handler failed:', error);
  return { data: [], error: 'Fallback response' };
}
```

## Development Commands

```bash
# Build & Lint
npm run build              # TypeScript compile (required before testing)
npm run lint:fix           # ESLint v9 flat config

# Testing (always build first)
npm run test:unit          # Vitest unit tests (test/unit/*.test.ts)
npm run test:integration:all  # Node-run integration (test/server-test.js + more)
npm run test:all           # Full suite
npm test -- test/unit/functions-manager.test.ts  # Single file

# Server modes
npm run start:core         # Docs/reference tools only (60% token reduction)
npm run start:config       # Config generation focus
npm run start:guidance     # Best practices/troubleshooting
```

## Adding a New Tool

1. Add schema in `ToolHandler.getAvailableTools()` (name, description, inputSchema)
2. Add case in `ToolHandler.executeTool()` switch statement
3. Add unit test in `test/unit/tool-handler.test.ts`
4. Update tool count in MCP protocol tests to match the current number of tools in FULL mode
5. Consider: can this merge into existing tool with `mode` parameter?

## Adding a New Manager

1. Create in `src/terragrunt/` with constructor dependency injection
2. Accept `TerragruntDocsManager` in constructor for doc access
3. Use `Map<string, T>` with `normalizeKey()` for case-insensitive caching
4. Implement lazy `loadData()` called on first use
5. Wire to `ToolHandler` constructor

## Schema Drift Detection

Backend schemas (`schemas/backends/*.json`) track Terraform backend attributes. Detect drift from upstream docs:
```bash
npm run check-schema-drift              # Compare schemas against HashiCorp docs
```

When adding backend attributes:
1. Run drift detection to identify missing attributes
2. Manually review and update schema JSON with new attributes (include `deprecated: true` if applicable)
3. Bump schema version in the JSON file

**Note**: Schema updates require human review - never auto-update without validating attribute semantics.

## Debugging

```bash
./test-mcp.sh                           # Raw JSON-RPC protocol test
rm -rf .cache/terragrunt-docs/          # Clear cache to force refresh
cat .cache/terragrunt-docs/metadata.json  # Check last fetch time
```

Server logs to stderr (visible in VS Code Output panel).

---

**End-user tool selection guide**: See [docs/Copilot-Instructions-Template.md](../docs/Copilot-Instructions-Template.md)