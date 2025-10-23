# Terragrunt MCP Server - AI Assistant Guide

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides Terragrunt documentation access to VS Code with GitHub Copilot. The architecture follows MCP standards with a clean handler-based separation:

- **`src/index.ts`**: Main MCP server entry point using `@modelcontextprotocol/sdk`
- **Handlers layer**: `src/handlers/` contains `ResourceHandler` and `ToolHandler` classes that implement MCP protocol handlers
- **Terragrunt layer**: `src/terragrunt/` contains domain logic for docs fetching, caching, and command execution
- **Types**: `src/types/` defines interfaces for MCP and Terragrunt-specific data structures

## Key Implementation Patterns

### MCP Protocol Implementation
- Server uses **stdio transport** (`StdioServerTransport`) for VS Code integration
- All handlers return MCP-compliant responses with proper error handling
- Tools return structured JSON, resources return markdown with MIME types
- Use `ListResourcesRequestSchema`, `ReadResourceRequestSchema`, `ListToolsRequestSchema`, `CallToolRequestSchema`

### Documentation Management
The `TerragruntDocsManager` class (`src/terragrunt/docs.ts`) implements:
- **Two-tier caching**: In-memory + disk-based persistence
- **Smart cache**: 24-hour expiry with automatic refresh detection
- **Disk persistence**: Cache survives server restarts (stored in `.cache/terragrunt-docs/`)
- **Web scraping**: Uses `cheerio` to parse `https://terragrunt.gruntwork.io/docs/`
- **Section-based organization**: Auto-extracts sections like "getting-started", "reference"
- **Search functionality**: Full-text search across cached documentation

### Resource Pattern
Resources follow URI scheme `terragrunt://docs/{type}/{identifier}`:
- `terragrunt://docs/overview` - Documentation overview
- `terragrunt://docs/section/{section}` - Section-grouped docs  
- `terragrunt://docs/page/{encoded-url}` - Individual pages

### Tool Pattern  
Six core tools with specific input schemas:
- `search_terragrunt_docs` - Query with limit parameter (general search across all docs)
- `get_terragrunt_sections` - No parameters (returns list of documentation sections)
- `get_section_docs` - Section parameter (retrieves all docs from a section)
- `get_cli_command_help` - Command parameter (finds CLI command documentation)
- `get_hcl_config_reference` - Config parameter (finds HCL blocks/attributes/functions)
- `get_code_examples` - Topic and limit parameters (extracts code snippets with context)

## Development Workflow

### Build & Test Commands
```bash
npm run build          # TypeScript compilation to dist/
npm run dev           # Development with ts-node
npm run test:server   # Integration test via Node.js
npm run test:mcp      # Direct MCP protocol test via stdin
```

### VS Code Integration
Server requires configuration in VS Code `settings.json`:
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

### Testing Strategy
- **`test/server-test.js`**: Comprehensive integration tests covering docs fetching, search, resources, and tools
- **`test-mcp.sh`**: Direct MCP protocol testing via JSON-RPC
- Tests validate documentation structure, search accuracy, and resource content

## Critical Implementation Details

### ES Modules Configuration
- Uses `"type": "module"` in package.json
- Import paths **must** include `.js` extensions (e.g., `'./handlers/resources.js'`)
- TypeScript compiles `.ts` to `.js` but imports still reference `.js`

### Dependency Management
- Uses **MCP SDK v1.20+** (keep updated for protocol compatibility)
- **ESLint v9+** and TypeScript ESLint v8+ (avoid deprecated v8/v6 versions)
- Run `npm outdated` regularly to check for MCP SDK updates
- Transitive dependency warnings (from jest/node-fetch) are non-critical

### Error Handling Pattern
All handlers use try-catch with fallbacks:
```typescript
try {
  const result = await operation();
  return { data: result };
} catch (error) {
  console.error('Context:', error);
  return { fallback: [] }; // Never throw to MCP layer
}
```

### Caching Implementation
- **Two-tier cache**: In-memory `Map<string, TerragruntDoc>` + disk persistence (JSON)
- **Disk location**: `.cache/terragrunt-docs/` (already in `.gitignore`)
- **Cache files**: `docs-cache.json` (~1.1MB) + `metadata.json` (timestamps)
- **Load strategy**: Disk → Memory on first request (~10ms load time)
- **Save strategy**: Automatically saves to disk after web fetch
- **Expiry logic**: 24-hour timestamp-based validation in `shouldRefreshCache()`
- **Refresh logic**: Only fetches from web when cache expired or missing

## Project-Specific Conventions

- **Handler classes**: Always instantiate dependencies in constructor
- **URL encoding**: Use `encodeURIComponent()` for resource URIs with URLs
- **Section extraction**: Parse URLs like `/docs/getting-started/` → `"getting-started"`
- **Content limits**: Resource handler limits to 50 docs to prevent VS Code overwhelming
- **Command execution**: `runTerragruntCommand()` has 5-minute timeout and proper stdio capture

## Common Tasks

### Adding New Tools
1. Add tool definition to `ToolHandler.getAvailableTools()`
2. Implement execution logic in `ToolHandler.executeTool()`
3. Add input schema validation with proper TypeScript types

### Extending Documentation Sources
1. Modify URL patterns in `TerragruntDocsManager.getDocumentationPages()`
2. Update section extraction logic in `extractSection()`
3. Test with `npm run test:server` to validate parsing

### Debugging MCP Communication  
Use `test-mcp.sh` to send raw JSON-RPC messages and inspect protocol-level responses.