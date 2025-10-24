# Terragrunt MCP Server

A Model Context Protocol (MCP) server that provides comprehensive Terragrunt documentation and tooling integration for AI assistants like GitHub Copilot in VS Code.

## Overview

This MCP server enables AI assistants to access and search the complete Terragrunt documentation, providing intelligent assistance for working with Terragrunt configurations, CLI commands, and HCL syntax. It features a robust caching system with network resilience and multiple fallback mechanisms.

## Features

### 📚 Documentation Access

- **Live Documentation**: Automatically fetches the latest Terragrunt documentation from the official website
- **Smart Caching**: Two-tier caching system (in-memory + disk) with 24-hour refresh cycle
- **Network Resilience**: Retry mechanism with exponential backoff (3 retries, up to 10s delay)
- **Multiple Fallbacks**: Network → Disk cache → Stale cache → Local fixture (for offline/CI use)
- **Fast Search**: Full-text search across all cached documentation
- **Organized Sections**: Browse documentation by categories (getting-started, reference, features, etc.)
- **Persistent Cache**: Cache survives server restarts (stored in `.cache/terragrunt-docs/`)

### 🔧 Available Tools

Six specialized tools for different documentation needs:

#### 1. **`search_terragrunt_docs`** - General Documentation Search

Search across all Terragrunt documentation for specific topics, commands, or concepts.

- **Parameters**:
  - `query` (string, required): Search query text
  - `limit` (number, optional): Maximum results (default: 5, max: 20)
- **Use cases**: General questions, broad topic searches, discovering documentation

#### 2. **`get_terragrunt_sections`** - List Documentation Sections

Get a complete list of all available documentation sections with document counts.

- **Parameters**: None
- **Returns**: Array of sections (e.g., "getting-started", "reference", "features")
- **Use cases**: Understanding documentation structure, browsing by category

#### 3. **`get_section_docs`** - Retrieve Section Documentation

Get all documentation pages from a specific section.

- **Parameters**:
  - `section` (string, required): Section name (e.g., "getting-started", "reference")
- **Use cases**: Deep diving into a specific topic area, reading sequential guides

#### 4. **`get_cli_command_help`** - CLI Command Documentation

Get detailed help documentation for specific Terragrunt CLI commands.

- **Parameters**:
  - `command` (string, required): Command name (e.g., "plan", "apply", "run-all", "hclfmt")
- **Returns**: Command documentation with usage, options, and examples
- **Use cases**: Learning command syntax, understanding command options, CLI troubleshooting

#### 5. **`get_hcl_config_reference`** - HCL Configuration Reference

Get documentation for HCL configuration blocks, attributes, and functions used in `terragrunt.hcl`.

- **Parameters**:
  - `config` (string, required): Config element name (e.g., "terraform", "remote_state", "dependency", "inputs")
- **Returns**: Configuration reference with syntax and usage details
- **Use cases**: Writing terragrunt.hcl files, understanding configuration options

#### 6. **`get_code_examples`** - Find Code Examples

Find code examples and snippets related to specific Terragrunt topics or patterns.

- **Parameters**:
  - `topic` (string, required): Topic or pattern (e.g., "remote state", "dependencies", "before hooks")
  - `limit` (number, optional): Max documents to return (default: 5, max: 10)
- **Returns**: Code snippets with context from relevant documentation
- **Use cases**: Learning by example, implementation patterns, quick references

### 📖 Resources

- Complete documentation overview with section breakdown
- Individual documentation pages as separate resources
- Section-based documentation collections
- All content accessible through VS Code and Copilot

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```

### Running with Docker

For containerized deployment, see the [Docker Deployment Guide](DOCKER.md) for instructions on building and running the server in a local Docker container.

### VS Code Configuration

Add this to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/terragrunt-mcp-server"
    }
  }
}
```

Or use the Docker configuration (see [Docker guide](DOCKER.md)):

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "mcp-cache:/app/.cache",
        "terragrunt-mcp-server:latest"
      ]
    }
  }
}
```

4. **Restart VS Code** to activate the MCP server

5. **Verify installation**: Ask GitHub Copilot: *"Search Terragrunt docs for getting started"*

## Usage with GitHub Copilot

Once configured, interact with Terragrunt documentation directly through Copilot in VS Code. The server provides intelligent context for all your Terragrunt questions.

### Example Prompts by Category

#### General Documentation Search

- *"Search for Terragrunt documentation about dependencies"*
- *"Show me the getting started guide for Terragrunt"*
- *"What are the available configuration options in Terragrunt?"*
- *"How do I use remote state with Terragrunt?"*
- *"Find documentation about Terragrunt generate blocks"*

#### CLI Command Help

- *"What options are available for the terragrunt plan command?"*
- *"How do I use terragrunt run-all?"*
- *"Show me help for the hclfmt command"*
- *"What does terragrunt validate-inputs do?"*

#### HCL Configuration Reference

- *"Show me how to configure the terraform block in terragrunt.hcl"*
- *"What are the available remote_state options?"*
- *"How do I use the dependency block?"*
- *"What attributes can I use in the inputs block?"*

#### Code Examples

- *"Show me examples of using dependencies in Terragrunt"*
- *"Find code snippets for remote state configuration"*
- *"What are some examples of before_hook usage?"*
- *"Show me how to use generate blocks with examples"*

### Advanced Usage

- *"Compare different approaches for Terragrunt module organization"*
- *"Show me best practices for Terragrunt project structure"*
- *"Explain the difference between dependency and dependencies blocks"*
- *"What's the recommended way to handle environment-specific configurations?"*

## Project Structure

```text
terragrunt-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── server.ts                # Server initialization and setup
│   ├── handlers/
│   │   ├── tools.ts             # Tool execution handlers (6 tools)
│   │   ├── resources.ts         # Resource access handlers
│   │   └── prompts.ts           # Prompt templates (future)
│   ├── terragrunt/
│   │   ├── docs.ts              # Documentation fetching and caching
│   │   ├── commands.ts          # Terragrunt CLI wrapper (future)
│   │   ├── config.ts            # Configuration management
│   │   └── utils.ts             # Utility functions
│   └── types/
│       ├── mcp.ts               # MCP protocol type definitions
│       └── terragrunt.ts        # Terragrunt-specific types
├── test/
│   ├── server-test.js           # Integration tests
│   └── test-retry-fallback.mjs  # Resilience tests
├── fixtures/
│   └── terragrunt-docs-fixture.json  # Offline documentation cache
├── .cache/                      # Auto-generated cache (gitignored)
│   └── terragrunt-docs/
│       ├── docs-cache.json      # Cached documentation (~1.1MB)
│       └── metadata.json        # Cache timestamps
├── schemas/
│   └── mcp-protocol.json        # MCP protocol schema
├── package.json                 # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # This file
```

### Key Files

- **`src/index.ts`**: Main entry point that initializes the MCP server with stdio transport
- **`src/handlers/tools.ts`**: Implements all 6 tools for documentation access
- **`src/terragrunt/docs.ts`**: Core documentation manager with caching, retry logic, and fallbacks
- **`test/server-test.js`**: Comprehensive test suite validating all functionality

## Development

### Available Scripts

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Run in development mode with ts-node
npm start              # Run compiled server from dist/
npm run lint           # Check code style with ESLint
npm run lint:fix       # Auto-fix linting issues
npm test               # Run all tests (Jest)
npm run test:server    # Run integration tests
```

### Testing

The project includes comprehensive tests:

- **Integration tests** (`test/server-test.js`): Tests all tools, resources, and documentation fetching
- **Resilience tests** (`test/test-retry-fallback.mjs`): Validates retry logic and fallback mechanisms
- **MCP protocol tests** (`test-mcp.sh`): Direct JSON-RPC protocol testing

Run tests with:

```bash
npm run test:server    # Recommended for development
npm test               # Full test suite
```

### Docker Support

Build and run in Docker for isolated testing:

```bash
# Build Docker image
npm run docker:build

# Run with docker-compose
npm run docker:compose:up
npm run docker:compose:logs
npm run docker:compose:down
```

See [DOCKER.md](DOCKER.md) for detailed Docker usage.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and contribution process.

## Technical Architecture

### MCP Protocol Implementation

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) using the official SDK (`@modelcontextprotocol/sdk`). It provides:

- **Stdio Transport**: Direct integration with VS Code and other MCP clients
- **Resource Handlers**: Expose documentation as structured resources
- **Tool Handlers**: Six specialized tools for different documentation queries
- **Prompt Handlers**: Future support for guided workflows

### Documentation Caching System

The `TerragruntDocsManager` implements a sophisticated multi-tier caching strategy:

1. **In-Memory Cache**: Fast access to frequently used documentation
2. **Disk Cache**: Persistent storage in `.cache/terragrunt-docs/` (~1.1MB)
3. **24-Hour Expiry**: Automatic refresh to keep documentation current
4. **Stale Cache Fallback**: Uses expired cache when network fails
5. **Local Fixture**: Embedded documentation for complete offline support

### Network Resilience

Built-in retry mechanism with exponential backoff:

- **3 retry attempts** with increasing delays (1s → 2s → 4s)
- **10-second maximum delay** to prevent excessive waiting
- **Graceful degradation** through multiple fallback layers
- **CI/Test-friendly** with deterministic fixture fallback

### Web Scraping

Uses Cheerio to parse the official Terragrunt documentation site:

- Extracts all documentation pages from `https://terragrunt.gruntwork.io/docs/`
- Preserves document structure (sections, titles, URLs)
- Cleans HTML content for better AI consumption
- Updates automatically based on cache expiry

## Version History

See [RELEASE.md](RELEASE.md) for detailed version history and changelog.

**Current Version**: 0.2.0

- 6 specialized documentation tools
- Multi-tier caching with network resilience
- Docker support
- Comprehensive test coverage

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Terragrunt Official Documentation](https://terragrunt.gruntwork.io/)
- [GitHub Repository](https://github.com/omattsson/terragrunt-mcp-server)
- [Setup Guide](SETUP.md)
- [Docker Guide](DOCKER.md)
