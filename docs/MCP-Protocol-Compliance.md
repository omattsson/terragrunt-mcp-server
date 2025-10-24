# MCP Protocol Compliance Testing Documentation

## Overview

This document describes the comprehensive Model Context Protocol (MCP) compliance test suite for the Terragrunt MCP Server. These tests validate that our server correctly implements the MCP specification and adheres to protocol standards.

## Test Statistics

- **Total MCP Compliance Tests**: 57
- **Test Categories**: 10
- **Test Duration**: ~155ms
- **Status**: ✅ All passing

## What is MCP?

The Model Context Protocol (MCP) is a standardized protocol for communication between AI assistants and context providers. It defines:

- **Resources**: Documents and data that can be discovered and read
- **Tools**: Executable functions that perform actions
- **Request/Response Format**: Structured JSON-RPC messages
- **Error Handling**: Consistent error reporting

## Test Categories

### 1. Server Initialization (3 tests)

Validates that the MCP server initializes correctly with proper configuration:

- **Server info**: Correct name and version
- **Resource capabilities**: Declared in server capabilities
- **Tool capabilities**: Declared in server capabilities

**Key Validations**:
```typescript
{
  name: 'terragrunt-mcp-server',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {}
  }
}
```

### 2. ListResourcesRequest Compliance (8 tests)

Tests that resource listing follows MCP specification:

#### Required Fields
Every resource must have:
- `uri` (string): Unique identifier using `terragrunt://` scheme
- `name` (string): Human-readable name
- `mimeType` (string): Content type (`text/markdown`)
- `description` (string, optional): Resource description

#### Test Coverage
- Handles requests with no parameters
- Returns valid MCP resource schema
- URIs follow proper format (no spaces, encoded special chars)
- All resources use `text/markdown` MIME type
- Includes expected resource types (overview, sections, pages)
- Limits total resources (<200) to prevent overwhelming clients

**Example Resource**:
```typescript
{
  uri: 'terragrunt://docs/overview',
  name: 'Terragrunt Documentation Overview',
  mimeType: 'text/markdown',
  description: 'Complete overview of all Terragrunt documentation'
}
```

### 3. ReadResourceRequest Compliance (8 tests)

Tests that resource reading follows MCP specification:

#### Response Format
```typescript
{
  contents: [{
    type: 'text',
    text: '# Content here...'
  }],
  mimeType: 'text/markdown'
}
```

#### Test Coverage
- Handles valid URI requests
- Returns valid MCP content schema
- Content has `type` and `text` fields
- Uses `text/markdown` MIME type
- Non-empty content text
- Properly handles encoded URIs
- Returns error response (not throw) for invalid URIs
- Returns error response for non-existent resources
- Handles all resource types (overview, section, page)

**Key Behavior**:
- Errors are returned as response objects, not thrown as exceptions
- Error responses use `text/plain` MIME type
- Error text includes helpful context

### 4. ListToolsRequest Compliance (12 tests)

Tests that tool listing follows MCP specification:

#### Required Fields
Every tool must have:
- `name` (string): Tool identifier (snake_case)
- `description` (string): What the tool does
- `inputSchema` (object): JSON Schema defining parameters

#### Input Schema Format
```typescript
{
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query'
    },
    limit: {
      type: 'number',
      description: 'Maximum results',
      default: 5
    }
  },
  required: ['query']
}
```

#### Test Coverage
- Handles requests with no parameters
- Returns valid MCP tool schema
- Input schemas are valid JSON Schema
- Exactly 6 tools provided
- All expected tools present:
  - `search_terragrunt_docs`
  - `get_terragrunt_sections`
  - `get_section_docs`
  - `get_cli_command_help`
  - `get_hcl_config_reference`
  - `get_code_examples`
- Tool names are snake_case (<50 chars)
- Descriptions are helpful (10-500 chars)

### 5. CallToolRequest Compliance (11 tests)

Tests that tool execution follows MCP specification:

#### Response Format
Tools return structured objects (not MCP response wrapper at this level):

```typescript
// search_terragrunt_docs
{
  query: string,
  results: Array<{title, url, section, snippet}>,
  total: number,
  hasMore: boolean
}

// get_terragrunt_sections
{
  sections: Array<{name, docCount}>,
  totalSections: number,
  totalDocs: number
}

// get_section_docs
{
  section: string,
  docs: Array<{title, url, content}>,
  totalDocs: number
} | {
  section: string,
  error: string,
  availableSections: string[]
}
```

#### Test Coverage
- Handles valid tool calls with arguments
- Returns structured responses for each tool
- Validates required parameters
- Returns error object for unknown tools
- Handles missing optional parameters gracefully
- Doesn't throw exceptions on tool errors

**Error Response Format**:
```typescript
{
  error: 'query parameter is required'
}
```

### 6. Error Response Compliance (4 tests)

Tests that errors are handled consistently:

#### Error Handling Principles
1. **Never throw exceptions to clients**: Return error objects
2. **Provide helpful messages**: Include context and suggestions
3. **No internal details**: Don't expose stack traces or paths
4. **Consistent format**: All errors use same structure

#### Test Coverage
- Invalid resources return error response (not throw)
- Invalid tool parameters return error object
- Error messages are helpful (include suggestions)
- Internal errors are sanitized

**Example Error Responses**:
```typescript
// Resource error
{
  contents: [{
    type: 'text',
    text: 'Error: Documentation page not found: xyz'
  }],
  mimeType: 'text/plain'
}

// Tool error with suggestion
{
  command: 'nonexistent-cmd',
  error: 'No CLI command documentation found for: nonexistent-cmd',
  suggestion: 'Try searching with search_terragrunt_docs...'
}
```

### 7. Response Format Compliance (3 tests)

Tests that all responses are MCP-compliant:

#### Requirements
- JSON-serializable (no functions, circular refs)
- Consistent field types across calls
- No undefined or null in required fields

#### Test Coverage
- Responses can be JSON.stringify()'d
- No circular references
- Same structure for repeated calls

### 8. URI Encoding Compliance (3 tests)

Tests that URIs are properly encoded:

#### URI Format
```
terragrunt://docs/{type}/{identifier}
```

#### Test Coverage
- Special characters are URL-encoded
- Encoded URIs can be decoded
- URIs consistent between list and read operations

**Examples**:
```
terragrunt://docs/overview
terragrunt://docs/section/getting-started
terragrunt://docs/page/https%3A%2F%2Fterragrunt.gruntwork.io%2Fdocs%2Fgetting-started%2F
```

### 9. Concurrency Compliance (3 tests)

Tests that concurrent operations are handled correctly:

#### Test Coverage
- Multiple concurrent resource reads
- Multiple concurrent tool executions
- No state corruption during concurrent ops

**Key Behavior**:
- Each request is isolated
- Results are returned in correct order
- No race conditions or shared state issues

### 10. Protocol Version Compliance (2 tests)

Tests that we use official MCP SDK correctly:

#### Test Coverage
- Uses official `@modelcontextprotocol/sdk` types
- Server info matches expected format

**SDK Schemas Used**:
- `ListResourcesRequestSchema`
- `ReadResourceRequestSchema`
- `ListToolsRequestSchema`
- `CallToolRequestSchema`

## Compliance Summary

### ✅ Fully Compliant

| Aspect | Status | Details |
|--------|--------|---------|
| Resource Discovery | ✅ | All resources listed with valid schema |
| Resource Reading | ✅ | Proper content format and error handling |
| Tool Discovery | ✅ | All tools listed with JSON Schema |
| Tool Execution | ✅ | Structured responses, validated params |
| Error Handling | ✅ | Consistent error objects, no exceptions |
| URI Format | ✅ | Proper encoding, consistent scheme |
| Concurrency | ✅ | Thread-safe operations |
| JSON Compliance | ✅ | All responses serializable |

### MCP Specification Alignment

Our implementation follows these MCP principles:

1. **Resource-Oriented**: Documentation exposed as resources
2. **Tool-Based Actions**: Operations exposed as executable tools
3. **Schema-Driven**: Input validation using JSON Schema
4. **Error Resilience**: Graceful error handling, no crashes
5. **Discoverability**: All capabilities listed via protocol
6. **Consistency**: Predictable behavior across operations

## Running MCP Protocol Tests

### Run All Protocol Tests

```bash
npm test -- test/integration/mcp-protocol.test.ts
```

### Run Specific Category

```bash
# Example: Run only resource compliance tests
npm test -- test/integration/mcp-protocol.test.ts -t "ListResourcesRequest"
```

### Watch Mode

```bash
npm test -- test/integration/mcp-protocol.test.ts --watch
```

## Protocol Validation Checklist

Use this checklist when adding new features:

### Adding a New Resource

- [ ] Add to `listResources()` with all required fields
- [ ] Implement `getResource()` handler for the URI
- [ ] Use `terragrunt://` URI scheme
- [ ] Return `text/markdown` MIME type
- [ ] Include error handling (return error response, not throw)
- [ ] Test with special characters in URI
- [ ] Validate content is non-empty

### Adding a New Tool

- [ ] Add to `getAvailableTools()` with name, description, schema
- [ ] Use snake_case naming
- [ ] Provide JSON Schema for inputs
- [ ] Mark required parameters in schema
- [ ] Implement `executeTool()` handler
- [ ] Return structured object (not plain text)
- [ ] Validate required parameters
- [ ] Return error object for invalid inputs
- [ ] Test with missing/invalid parameters
- [ ] Document response format

## Known MCP Behaviors

### Error Handling Philosophy

Our server follows a "return error, don't throw" philosophy:

**Resource Errors**: Return error in contents
```typescript
{
  contents: [{ type: 'text', text: 'Error: ...' }],
  mimeType: 'text/plain'
}
```

**Tool Errors**: Return error object
```typescript
{
  error: 'Parameter X is required',
  suggestion: 'Try...'
}
```

This ensures:
- Client applications don't crash
- Errors are structured and parseable
- Users get helpful feedback

### Content Format

Resources use simple `{ type, text }` format:
```typescript
{
  contents: [{
    type: 'text',  // Always 'text'
    text: '...'    // Markdown content
  }],
  mimeType: 'text/markdown'  // At resource level
}
```

Not MCP's more complex content format with URI/blob/etc.

## Future Enhancements

Potential MCP protocol improvements:

1. **Prompts**: Add MCP prompt templates
2. **Sampling**: Support LLM sampling requests
3. **Progress**: Add progress notifications for long operations
4. **Cancellation**: Support request cancellation
5. **Pagination**: Add cursor-based pagination for large result sets
6. **Caching**: Add resource caching headers
7. **Subscriptions**: Support resource change notifications

## Related Documentation

- [Available Tools](Available-Tools.md) - Tool usage guide
- [Architecture Overview](Architecture-Overview.md) - System design
- [Development Guide](Development-Guide.md) - Contributing
- [Edge Cases Testing](Edge-Cases-Testing.md) - Input validation tests
- [MCP Specification](https://modelcontextprotocol.io/) - Official MCP docs

## Last Updated

Generated: January 2025
Test Suite Version: 1.0.0
MCP SDK Version: 1.20+
Documentation Version: 0.2.0
