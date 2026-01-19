# Terragrunt MCP Server - AI Assistant Guide

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides Terragrunt documentation access to AI assistants via VS Code. The architecture follows MCP standards with handler-based separation:

- **`src/index.ts`**: MCP server entry point using `@modelcontextprotocol/sdk` with stdio transport
- **Handlers**: `src/handlers/` contains `ToolHandler` and `PromptHandler` for MCP protocol (v0.5.0: tool-only architecture)
- **Domain Logic**: `src/terragrunt/` contains `DocsManager` (caching/fetching), `FunctionsManager` (built-in functions), `CommandsManager`, and more
- **Types**: `src/types/` defines MCP and Terragrunt-specific interfaces
- **v0.5.0 Update**: Resources removed for simplified tool-only architecture with 7 consolidated tools

## Critical ES Module Requirements

- **`"type": "module"`** in package.json means all imports MUST use `.js` extensions
- Example: `import { ResourceHandler } from './handlers/resources.js';` (NOT `.ts`)
- TypeScript compiles `.ts` → `.js` but import statements reference the OUTPUT `.js` files
- Missing `.js` extension will cause runtime errors despite TypeScript compiling successfully

## Manager Pattern & Caching Architecture

### TerragruntDocsManager (`src/terragrunt/docs.ts`)
**Multi-tier resilience strategy** with automatic fallback chain:
1. **In-memory cache** (`Map<string, TerragruntDoc>`) - fastest, cleared on restart
2. **Disk cache** (`.cache/terragrunt-docs/`) - persists across restarts, 24-hour expiry
3. **Network fetch** (cheerio web scraping) - with exponential backoff retry (3 attempts, max 10s delay)
4. **Fixture fallback** (`fixtures/terragrunt-docs-fixture.json`) - offline/CI safety net

**Key method flow**:
- `fetchLatestDocs()` → checks cache validity → `loadCacheFromDisk()` → `refreshDocsCache()` → network or fallback
- `shouldRefreshCache()` returns true if >24 hours old OR never fetched
- Always call `saveCacheToDisk()` after successful network fetch to persist

**Content cleaning**: `cleanContent()` collapses whitespace, removes HTML artifacts for search efficiency

### TerragruntFunctionsManager (`src/terragrunt/functions.ts`)
**Extracts function metadata** from flattened docs content using regex patterns:
- **Signature styles**: Handles `name(params) -> Type` AND `name(params) returns Type`
- **Parameter extraction**: Two-pass approach:
  1. Parse inline signature `(param1, param2)` for quick extraction
  2. If empty or insufficient, scan nearby "Parameters:" context block with structured regex
  3. Prefers explicit context when it yields MORE parameters than inline (see `parseParamsFromContext`)
- **Structured parsing**: Matches `name (type)` or `name: type` format, stops at section markers (Usage, Example, See also)
- **Deduplication**: Uses lowercase normalized keys (`normalizeKey()`) for case-insensitive lookups
- **Related functions**: Extracts from "See also" patterns via regex

**Critical fix pattern** (from recent work):
```typescript
// WRONG: Only using inline params when signature is ambiguous
let parameters = parseParams(paramsRaw);

// RIGHT: Enrich from explicit context when available
let parameters = parseParams(paramsRaw);
const ctxParams = parseParamsFromContext(ctx);
if (parameters.length === 0 || ctxParams.length > parameters.length) {
  parameters = ctxParams; // Prefer richer context
}
```

## Testing Strategy & Commands

### Test Suite Structure
- **Unit tests** (`test/unit/*.test.ts`): Vitest-based, run with `npm run test` or `npm run test:unit`
  - `vitest.config.ts` includes ONLY `.test.ts` files to avoid Node-run `.test.js` integration tests
  - 60s timeout for retry-heavy tests (network fallback scenarios)
- **Integration tests** (`test/integration/*.test.js`): Node-run scripts, use `npm run test:integration:all`
  - Test REAL MCP protocol via direct manager instantiation (not Vitest mocks)
  - `test/server-test.js` is the main comprehensive integration suite
- **MCP protocol tests** (`test/integration/mcp-protocol.test.ts`): Vitest-based MCP compliance checks

### Critical Test Commands
```bash
npm run test                    # Vitest unit tests only (.test.ts files)
npm run test:unit              # Same as above
npm run test:integration:all   # Node-run integration scripts
npm run test:all              # Both unit + integration (full suite)
npm test -- path/to/file.test.ts  # Run single test file (faster iteration)
```

### Test Isolation Pattern
Integration tests use **real dependencies** (no mocks) but inject fixture data to avoid network calls:
```typescript
// Mock DocsManager with fixture content, not real fetch
class MockDocsManager {
  async fetchLatestDocs() { return fixtureData; }
}
```

## MCP Protocol Compliance

### Handler Error Handling
**Never throw errors to MCP layer** - always return valid MCP responses:
```typescript
// WRONG
async handler(request) {
  return await operation(); // Throws on error
}

// RIGHT
async handler(request) {
  try {
    return { data: await operation() };
  } catch (error) {
    console.error('Handler failed:', error);
    return { data: [], error: 'Fallback response' }; // Or empty array/object
  }
}
```

### Tool Schema Validation
Tools MUST define `inputSchema` with JSON Schema format:
```typescript
{
  type: 'object',
  properties: { query: { type: 'string', description: '...' } },
  required: ['query']
}
```

### Resource URI Scheme
Resources use `terragrunt://docs/{type}/{identifier}`:
- Encode URLs with `encodeURIComponent()` for page identifiers
- Section names are extracted from URL paths: `/docs/getting-started/` → `"getting-started"`

## Common Development Tasks

### Adding a New Tool
1. **Define in `ToolHandler.getAvailableTools()`**: Add schema with name, description, inputSchema
2. **Implement in `ToolHandler.executeTool()`**: Add case to switch statement
3. **Add tests**: Unit test in `test/unit/tool-handler.test.ts` + integration in `test/integration/`
4. **Update tool count**: Adjust MCP protocol test assertion (currently expects 8 tools) if adding
5. **Update documentation**: README.md, Available-Tools.md, and CHANGELOG.md with new tool details
6. **Consider consolidation**: Can this be merged into an existing tool with mode parameter?

### Adding a New Manager
1. **Create class in `src/terragrunt/`**: Follow constructor dependency injection pattern
2. **Inject dependencies**: Accept `TerragruntDocsManager` in constructor (see `TerragruntFunctionsManager`)
3. **Add caching**: Use `Map<string, T>` for in-memory cache with `normalizeKey()` for case-insensitive lookups
4. **Lazy loading**: Implement `loadData()` method called on first use (see `TerragruntFunctionsManager.loadFunctions()`)
5. **Wire to handler**: Instantiate in relevant handler constructor, expose via tools

### Regex-Based Extraction Patterns
When parsing documentation content:
- Use **global regex** (`/pattern/g`) on flattened text (newlines already collapsed by `cleanContent()`)
- **Capture groups** with named groups: `/(?<name>pattern)/` for clarity
- **Context windows**: Extract surrounding text (e.g., `text.slice(match.index, match.index + 400)`) for enrichment
- **Stopwords**: Filter out common prose words when extracting structured data (see `parseParamsFromContext`)
- **Section markers**: Stop extraction at keywords like "Usage:", "Example:", "See also" to avoid capturing unrelated text

### Lint & Build
- **ESLint v9** with flat config (`eslint.config.mjs`)
- **No-useless-escape rule**: Avoid escaping `-` in character classes `[a-z-]` → `[a-z-]` (hyphen at end doesn't need escape)
- **Build before commit**: `npm run build` to catch TS errors; `npm run lint` to catch style issues
- **Auto-fix**: `npm run lint:fix` for auto-fixable issues

## Debugging & Troubleshooting

### MCP Communication
- **Direct protocol test**: `./test-mcp.sh` sends raw JSON-RPC via stdin, useful for protocol debugging
- **Logs**: Server logs to stderr (visible in VS Code Output panel when running as MCP server)
- **Resource inspection**: Use `@copilot` in VS Code to query available resources/tools

### Cache Issues
- **Clear cache**: Delete `.cache/terragrunt-docs/` to force fresh fetch
- **Force fixture**: Remove cache + disable network in tests to verify fixture fallback works
- **Inspect cache**: `cat .cache/terragrunt-docs/metadata.json` shows last fetch time

### Test Failures
- **Run single test**: `npm test -- test/unit/functions-manager.test.ts` for faster iteration
- **Check test isolation**: Integration tests should not depend on disk cache state (use fixtures)
- **Regex debugging**: Add `console.log(match.groups)` to inspect capture groups in extraction logic

## Use sequential thought process when modifying code
- Understand existing flow before adding/changing logic
- Identify all impacted components (handlers, managers, tests)
- Always consider impact on caching, error handling, and MCP compliance
- Write unit tests for new logic, then integration tests for end-to-end verification
- Review regex patterns carefully to avoid over/under-matching

---

# User Tool Selection Guide

> **For End Users**: Copy this section to your workspace's `.github/copilot-instructions.md` to help Copilot automatically select Terragrunt MCP tools.

## When to Use Terragrunt MCP Tools

Copilot should use the **Terragrunt MCP server tools** when the user's question involves:

### Keyword Triggers
- **File patterns**: `terragrunt.hcl`, `*.hcl` files, `root.hcl`, `common.hcl`
- **HCL blocks**: `remote_state`, `dependency`, `dependencies`, `generate`, `terraform`, `inputs`, `include`, `locals`
- **Functions**: `find_in_parent_folders()`, `read_terragrunt_config()`, `path_relative_to_include()`, `get_env()`, `run_cmd()`
- **CLI commands**: `terragrunt run-all`, `terragrunt plan`, `terragrunt apply`, `terragrunt init`, `terragrunt validate`
- **Concepts**: DRY infrastructure, Terraform wrapper, multi-environment, mono-repo structure

### Tool Selection Matrix

| User Intent | Recommended Tool | Example Query |
|-------------|------------------|---------------|
| Search documentation | `search_docs` | "How does terragrunt handle dependencies?" |
| Understand a function | `function_reference` | "What does find_in_parent_folders do?" |
| Get CLI help | `cli_reference` | "How do I use terragrunt run-all?" |
| HCL block syntax | `get_hcl_config_reference` | "Show me remote_state block syntax" |
| Best practices | `get_guidance` | "What's the best way to organize Terragrunt?" |
| Generate config | `build_config` | "Create a terragrunt.hcl for S3 backend" |
| Debug errors | `diagnose_terragrunt_error` | "Why am I getting a dependency cycle error?" |
| Get server metrics | `get_server_metrics` | "Show me server performance metrics" |

### Multi-Tool Workflows

For complex questions, combine tools:
1. **Setup help**: `get_hcl_config_reference` → `build_config` → `get_guidance`
2. **Debugging**: `diagnose_terragrunt_error` → `search_docs` → `cli_reference`
3. **Learning**: `search_docs` → `function_reference` → `get_guidance`

## Server Mode Selection

The MCP server supports different modes for token efficiency:

| Mode | Tools | Use Case |
|------|-------|----------|
| `full` | All 8 tools | General Terragrunt assistance |
| `core` | search_docs, cli_reference, function_reference, get_hcl_config_reference | Documentation lookup only |
| `config` | build_config, get_hcl_config_reference | Configuration generation focus |
| `guidance` | get_guidance, diagnose_terragrunt_error | Best practices and troubleshooting |

Configure via environment variable: `TERRAGRUNT_MCP_MODE=core`