# Architecture Overview

This page provides a comprehensive overview of the Terragrunt MCP Server's architecture, design decisions, and internal workings.

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        VS Code                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           GitHub Copilot (MCP Client)                │   │
│  └────────────────┬─────────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Terragrunt MCP Server                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         src/index.ts (Entry Point)                   │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │          MCP Protocol Handlers                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │   Resources  │  │    Tools     │  │  Prompts  │  │   │
│  │  │   Handler    │  │   Handler    │  │  Handler  │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │   │
│  └─────────┼──────────────────┼────────────────┼────────┘   │
│            │                  │                │            │
│  ┌─────────▼──────────────────▼────────────────▼────────┐   │
│  │         TerragruntDocsManager                        │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  Two-Tier Caching System                      │   │   │
│  │  │  ┌──────────────┐     ┌──────────────────┐   │   │   │
│  │  │  │  In-Memory   │ ←→  │  Disk Cache      │   │   │   │
│  │  │  │  Cache (Map) │     │  (.cache/*.json) │   │   │   │
│  │  │  └──────────────┘     └──────────────────┘   │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └───────────────────────┬──────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐  ┌──────▼─────┐  ┌──────▼──────────┐
│  Web Scraping  │  │  Disk      │  │  Local Fixture  │
│  (Cheerio)     │  │  Cache     │  │  (Fallback)     │
└────────────────┘  └────────────┘  └─────────────────┘
```

## Core Components

### 1. MCP Protocol Layer (`src/index.ts`, `src/server.ts`)

**Purpose**: Implements the Model Context Protocol for communication with VS Code/Copilot

**Key Features**:
- Stdio transport for direct integration
- Request/response handling
- Protocol compliance validation
- Error handling and logging

**Technologies**:
- `@modelcontextprotocol/sdk` v1.20+
- TypeScript with ESM modules

### 2. Handler Layer (`src/handlers/`)

**Purpose**: Implements MCP protocol handlers for different request types

#### ResourceHandler (`resources.ts`)

- Exposes documentation as MCP resources
- Provides overview, section-based, and page-based views
- Formats content as markdown for AI consumption

#### ToolHandler (`tools.ts`)

- Implements 6 specialized documentation tools
- Validates input parameters
- Executes tool-specific logic
- Returns structured JSON responses

#### PromptsHandler (`prompts.ts`)

- Future: Guided workflows and templates
- Currently minimal implementation

### 3. Documentation Management Layer (`src/terragrunt/docs.ts`)

**Purpose**: Core business logic for fetching, caching, and searching Terragrunt documentation

**Key Class**: `TerragruntDocsManager`

**Responsibilities**:
- Web scraping documentation from terragrunt.gruntwork.io
- Multi-tier caching management
- Search and retrieval operations
- Fallback handling

### 4. Type Definitions (`src/types/`)

**Purpose**: TypeScript type safety and interface definitions

- `mcp.ts`: MCP protocol types
- `terragrunt.ts`: Domain-specific types

## Data Flow

### Cold Start (No Cache)

```text
1. Tool Request → ToolHandler
2. → TerragruntDocsManager.fetchLatestDocs()
3. → Check in-memory cache: Empty
4. → Check disk cache: Not found
5. → Fetch from web (with retry logic)
6. → Parse with Cheerio
7. → Save to disk cache
8. → Save to in-memory cache
9. → Return docs to handler
10. → Format and return to client
```

### Warm Start (Disk Cache Available)

```text
1. Tool Request → ToolHandler
2. → TerragruntDocsManager.fetchLatestDocs()
3. → Check in-memory cache: Empty
4. → Load from disk cache: Success (~10ms)
5. → Populate in-memory cache
6. → Return docs to handler
7. → Format and return to client
```

### Hot Path (In-Memory Cache)

```text
1. Tool Request → ToolHandler
2. → TerragruntDocsManager.fetchLatestDocs()
3. → Check in-memory cache: Hit! (<1ms)
4. → Return docs to handler
5. → Format and return to client
```

### Network Failure Fallback

```text
1. Tool Request → ToolHandler
2. → Fetch from web: FAIL (retry 3x)
3. → Load from disk cache: FAIL or expired
4. → Use stale cache if available
5. → Else: Load from local fixture
6. → Return docs to handler
```

## Caching Strategy

See [Caching System](Caching-System) for detailed information.

### Two-Tier Cache Design

1. **In-Memory Cache** (Primary)
   - `Map<string, TerragruntDoc>`
   - Fastest access (<1ms)
   - Lost on server restart
   - ~1.1MB RAM

2. **Disk Cache** (Secondary)
   - JSON files in `.cache/terragrunt-docs/`
   - Persists across restarts
   - Fast load time (~10ms)
   - ~1.1MB disk space

3. **Fixture Fallback** (Tertiary)
   - Embedded in repo: `fixtures/terragrunt-docs-fixture.json`
   - Ensures offline functionality
   - Used when all else fails

### Cache Expiry

- **Time-based**: 24 hours
- **Automatic refresh**: On cache expiry
- **Manual refresh**: Delete `.cache/` directory

## Network Resilience

### Retry Mechanism

```typescript
{
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
}
```

**Retry Strategy**:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 4 seconds delay
- Exponential backoff prevents hammering

### Fallback Chain

```text
Network → Disk Cache → Stale Cache → Fixture
```

This ensures the server **always** has data to return.

## Web Scraping

### Technology

- **Cheerio**: Fast HTML parsing
- **node-fetch**: HTTP requests
- **Selectors**: Navigational + content-based

### Extraction Process

1. **Fetch main docs page**: `https://terragrunt.gruntwork.io/docs/`
2. **Extract links**: From navigation, sidebar, and content
3. **Categorize by section**: Auto-detect from URL structure
4. **Fetch each page**: Individual HTML requests
5. **Parse content**: Remove nav, scripts, styles
6. **Clean text**: Normalize whitespace
7. **Store structured data**: Title, URL, content, section

### Content Selectors

```typescript
const contentSelectors = [
  '.content',
  '.markdown', 
  'main',
  '.post-content',
  '.doc-content',
  'article'
];
```

Fallback to `body` if no content container found.

## Search Implementation

### Algorithm

Simple but effective text-based search:

```typescript
docs.filter(doc =>
  doc.title.toLowerCase().includes(query) ||
  doc.content.toLowerCase().includes(query) ||
  doc.section.toLowerCase().includes(query)
)
```

### Ranking

1. **Title matches**: Highest priority
2. **Section matches**: Medium priority
3. **Content matches**: Lower priority

### Performance

- Search is in-memory: Very fast
- Full-text search across all docs
- No external dependencies

## Tool Implementation Patterns

### Example: `get_cli_command_help`

```typescript
async getCliCommandHelp(command: string) {
  const docs = await this.fetchLatestDocs();
  
  // Search in reference section for CLI docs
  const cliDocs = docs.filter(doc =>
    doc.section === 'reference' &&
    doc.url.includes('/cli/') &&
    (doc.title.toLowerCase().includes(command.toLowerCase()) ||
     doc.content.toLowerCase().includes(command.toLowerCase()))
  );
  
  return cliDocs[0] || null;
}
```

**Pattern**:
1. Get all docs
2. Filter by criteria (section, URL pattern, content)
3. Return best match

## Error Handling

### Principles

1. **Never throw to MCP layer**: Always return fallback data
2. **Log everything**: Helps debugging
3. **Graceful degradation**: Use stale data if needed
4. **Clear error messages**: Help users understand issues

### Example

```typescript
try {
  const result = await operation();
  return { data: result };
} catch (error) {
  console.error('Context:', error);
  return { fallback: [] }; // Never fails
}
```

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| In-memory cache hit | <1ms | Hot path |
| Disk cache load | ~10ms | Warm start |
| Web fetch (full) | ~5-10s | Cold start |
| Search (in-memory) | <10ms | Across all docs |
| Tool execution | <20ms | Including search |

## Dependencies

### Production

- `@modelcontextprotocol/sdk`: MCP protocol
- `cheerio`: HTML parsing
- `node-fetch`: HTTP requests
- `typescript`: Type safety

### Development

- `@types/node`: Node.js types
- `eslint`: Code linting
- `ts-node`: Development runtime

## Design Decisions

### Why Two-Tier Caching?

1. **In-memory**: Speed (most requests are hot)
2. **Disk**: Persistence (survives restarts)
3. **Trade-off**: Small memory footprint vs. performance

### Why Web Scraping vs. API?

- No official Terragrunt documentation API exists
- Web scraping is reliable and well-tested
- Content is relatively stable
- Caching minimizes requests

### Why ESM Modules?

- Modern JavaScript standard
- Better tree-shaking
- Future-proof
- MCP SDK uses ESM

### Why Stdio Transport?

- Direct VS Code integration
- No port conflicts
- Secure (local only)
- Standard for MCP servers

## Extension Points

### Adding New Tools

1. Add tool definition to `ToolHandler.getAvailableTools()`
2. Implement logic in `ToolHandler.executeTool()`
3. Add helper method to `TerragruntDocsManager` if needed
4. Update documentation

### Adding New Resources

1. Add resource URI pattern to `ResourceHandler.listResources()`
2. Implement handler in `ResourceHandler.getResource()`
3. Format content appropriately

### Customizing Caching

- Modify `cacheExpiry` in `TerragruntDocsManager`
- Adjust retry configuration
- Change cache directory location

## Security Considerations

### Inputs

- All tool parameters are validated
- URI encoding prevents injection
- No shell execution

### Network

- Only connects to official Terragrunt site
- HTTPS only
- No credentials required

### File System

- Cache directory is `.gitignore`d
- No sensitive data stored
- Read-only operations on fixtures

## Next Steps

- [Caching System](Caching-System) - Deep dive into caching
- [Development Guide](Development-Guide) - Contributing to the project
- [Testing](Testing) - How testing works
