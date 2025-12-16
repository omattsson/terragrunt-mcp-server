# Terragrunt MCP Server

A Model Context Protocol (MCP) server that provides comprehensive Terragrunt documentation and tooling integration for AI assistants like GitHub Copilot in VS Code.

## Overview

This MCP server enables AI assistants to access and search the complete Terragrunt documentation, providing intelligent assistance for working with Terragrunt configurations, CLI commands, and HCL syntax. It features a robust caching system with network resilience and multiple fallback mechanisms.

**New:** Multi-mode architecture with **60-94% token overhead reduction** for optimized AI assistant integration. Choose the mode that fits your workflow: CORE (docs), CONFIG (generation), GUIDANCE (troubleshooting), OBSERVABILITY (metrics), or FULL (all tools).

## Features

### 📚 Documentation Access

- **Live Documentation**: Automatically fetches the latest Terragrunt documentation from the official website
- **Smart Caching**: Two-tier caching system (in-memory + disk) with 24-hour refresh cycle
- **Network Resilience**: Retry mechanism with exponential backoff (3 retries, up to 10s delay)
- **Multiple Fallbacks**: Network → Disk cache → Stale cache → Local fixture (for offline/CI use)
- **Fast Search**: Full-text search across all cached documentation
- **Organized Sections**: Browse documentation by categories (getting-started, reference, features, etc.)
- **Persistent Cache**: Cache survives server restarts (stored in `.cache/terragrunt-docs/`)

### ⚙️ Configuration Generator

- **Tiered Templates**: Essential (4-5 vars) and Advanced (9-12 vars) backend templates
- **Multi-Cloud Support**: AWS S3, Azure Blob Storage, GCP GCS backends
- **Advanced Features**: KMS encryption, cross-account access, managed identity, service account impersonation
- **Mustache Conditionals**: Smart rendering includes only provided options
- **Two-Tier Validation**: Regex-based (fast) + optional Terragrunt CLI validation (accurate)
- **Custom Templates**: Extend with organization-specific templates

See [Advanced Backend Templates](docs/Advanced-Backend-Templates.md) for enterprise configuration options.

### 🔧 Available Tools

**8 consolidated tools** for comprehensive Terragrunt assistance:
- **7 core tools** (tools 1-7): Documentation, functions, CLI, HCL reference, guidance, config generation, error diagnosis
- **1 observability tool** (tool 8): Server metrics and monitoring

#### 1. **`search_docs`** - Unified Documentation Search

Unified tool for all documentation search needs - semantic search, browsing sections, retrieving content, and finding code examples.

- **Parameters**:
  - `mode` (string, optional): Operation mode - `search`, `list`, `section`, or `examples` (default: `search`)
  - `query` (string, conditional): Search query text (required for `search` mode, optional for `examples`)
  - `section` (string, conditional): Section name (required for `section` mode)
  - `detailLevel` (string, optional): `summary` or `full` (default: `summary`)
  - Additional mode-specific parameters (page, pageSize, limit, advanced, category, etc.)
- **Modes**:
  - **search**: Semantic search across all documentation
  - **list**: List available documentation sections
  - **section**: Get docs from a specific section
  - **examples**: Find code examples and patterns (supports advanced curated examples)
- **Use cases**: All doc-related tasks including search, browsing, section retrieval, and code examples

#### 2. **`function_reference`** - Built-in Function Reference

Get function details OR list all functions - unified tool for Terragrunt built-in function documentation.

- **Get Mode** (when `function_name` provided):
  - `function_name` (string): Function name (e.g., "path_relative_to_include", "get_env")
  - `mode` (string, optional): Detail level - `summary` or `full` (default: `summary`)
  - `include_examples` (boolean, optional): Include code examples (default: true)
  - **Returns**: Complete function metadata including signature, parameters, return type, examples
- **List Mode** (when no `function_name`):
  - `category` (string, optional): Filter by category (e.g., "path", "aws", "environment")
  - `search` (string, optional): Search in function names and descriptions
  - `page` (number, optional): Page number (default: 1)
  - `pageSize` (number, optional): Results per page (default: 20)
  - **Returns**: Array of functions with name, signature, category, and description
- **Use cases**: Looking up specific functions, discovering available functions, browsing by category

#### 3. **`cli_reference`** - CLI Command Reference

Get command help OR list commands - unified tool for Terragrunt CLI command documentation.

- **Get Mode** (when `command` provided):
  - `command` (string): Command name (e.g., "plan", "apply", "run-all", "hclfmt")
  - **Returns**: Command documentation with usage, options, and examples
- **List Mode** (when no `command`):
  - `category` (string, optional): Filter by category (`main`, `backend`, `stack`, `catalog`, `discovery`, `configuration`, `shortcut`)
  - `search` (string, optional): Search in command names and descriptions
  - `page` (number, optional): Page number (default: 1)
  - `pageSize` (number, optional): Commands per page (default: 20)
  - **Returns**: Array of commands with name, category, and description
- **Use cases**: Learning command syntax, understanding command options, CLI troubleshooting, discovering available commands

#### 4. **`get_hcl_config_reference`** - HCL Configuration Reference

Get documentation for HCL configuration blocks used in `terragrunt.hcl` files.

- **Parameters**:
  - `config` (string, optional): Block name (e.g., "terraform", "remote_state", "dependency", "inputs", "generate", "locals")
  - `category` (string, optional): Filter blocks by category (`core`, `modules`, `generation`, `execution`, `iam`, `terraform`)
  - `listBlocks` (boolean, optional): List all available HCL blocks (default: false)
- **Returns**: HCL block documentation with syntax, attributes, examples, and usage patterns
- **Use cases**: Writing terragrunt.hcl files, understanding configuration options, discovering available blocks

#### 5. **`get_guidance`** - Best Practices & Comparisons

Get best practices, comparisons, or patterns for Terragrunt usage.

- **Parameters**:
  - `query` (string, optional): Topic, comparison, or scenario
  - `type` (string, optional): Guidance type - `best-practices`, `comparison`, or `pattern`
  - `mode` (string, optional): Detail level - `summary` or `full` (default: `summary`)
  - `level` (string, optional): Experience level - `beginner`, `intermediate`, or `advanced`
  - `listAll` (boolean, optional): List all available guidance (default: false)
- **Returns**: Structured recommendations with priority, rationale, examples, antipatterns, tradeoffs, and experience notes
- **Use cases**: Learning best practices, understanding patterns, avoiding common pitfalls, comparing approaches, getting experience-appropriate guidance

**Example prompts:**

```text
"What are the best practices for state management?"
"Compare different approaches for module organization"
"Show me beginner-level dependency management practices"
"What patterns should I use for CI/CD with Terragrunt?"
```

#### 6. **`build_config`** - Generate or Write Terragrunt Configuration

Generate OR write OR generate+write Terragrunt configurations - unified tool for configuration management.

- **Generate Mode** (when `useCase` provided, no `content`):
  - `useCase` (string): Configuration type - `remote_state`, `provider_generation`, `dependencies`, `hooks`, or `inputs`
  - `options` (object): Template variables (varies by use case and backend)
  - `backend` (string, optional): Backend type for remote_state - `s3`, `azurerm`, or `gcs`
  - `tier` (string, optional): Template tier - `essential`, `advanced`, or `complete` (default: `essential`)
  - `strictValidation` (boolean, optional): Enable strict validation (default: false)
  - **Returns**: Generated HCL configuration with explanation and next steps
- **Write Mode** (when `content` provided):
  - `content` (string): HCL content to write
  - `path` (string): File path where config should be written
  - `overwrite` (boolean, optional): Allow overwriting existing files (default: false)
  - `createBackup` (boolean, optional): Create backup before overwrite (default: true)
  - `createParentDirs` (boolean, optional): Create parent directories if missing (default: true)
  - **Returns**: Write confirmation with file path
- **Generate+Write Mode** (when `useCase` + `write=true` + `path`):
  - Combines both modes - generates configuration and writes to disk in one operation
  - **Returns**: Generated config + write confirmation
- **Security**: File writing disabled by default, requires explicit configuration (see [File Writing Guide](docs/File-Writing-Guide.md))
- **Use cases**: Quick project setup, learning HCL syntax, best practice configurations, saving generated configs, automating configuration updates

**Example prompts:**

```text
"Generate a terragrunt config for S3 remote state in us-east-1"
"Write this configuration to /home/user/terraform/terragrunt.hcl"
"Generate and save an Azure backend configuration to my project"
"Show me how to set up dependencies between terragrunt modules"
```

#### 7. **`diagnose_terragrunt_error`** - Error Diagnosis and Troubleshooting

Diagnose Terragrunt error messages and get actionable solutions, debugging steps, and relevant documentation links.

- **Parameters**:
  - `error_message` (string, required): The error message from Terragrunt to diagnose
  - `command` (string, optional): Command that was run (e.g., "apply", "plan")
  - `version` (string, optional): Terragrunt version
  - `os` (string, optional): Operating system
  - `filePath` (string, optional): File path where error occurred
  - `module` (string, optional): Module name
  - `backend` (string, optional): Backend type
  - `maxMatches` (number, optional): Maximum matches to return (default: 3)
  - `minConfidence` (number, optional): Minimum confidence score 0-1 (default: 0.3)
  - `enableFuzzyMatching` (boolean, optional): Enable fuzzy matching (default: true)
  - `enrichWithDocs` (boolean, optional): Enrich with documentation-sourced solutions (default: false)
- **Returns**: Matches with confidence scores, solutions, debugging steps, related errors, and documentation links (66 error patterns across 7 categories)
- **Use cases**: Troubleshooting errors, getting actionable solutions, finding relevant documentation

**Example prompts:**

```text
"I'm getting this error: Error acquiring the state lock"
"Help me fix: Backend configuration changed since last init"
"Diagnose this terragrunt error and tell me how to fix it"
```

See the [Troubleshooting Guide](docs/Troubleshooting-Guide.md) for detailed usage examples and best practices.

---

For complete tool documentation and examples, see [Available Tools](docs/Available-Tools.md).

### 📖 Resources

- Complete documentation overview with section breakdown
- Individual documentation pages as separate resources
- Section-based documentation collections
- All content accessible through VS Code and Copilot

## Server Modes

The Terragrunt MCP Server supports **5 operational modes** to optimize token usage and reduce overhead for specific workflows. Each mode loads only the tools and dependencies needed for its use case.

### Mode Overview

| Mode | Tools | Token Overhead | Memory | Managers | Use Case |
|------|-------|----------------|---------|----------|----------|
| **FULL** | 8 | 2,441 (baseline) | 0.20 MB | 12/12 | All features, backward compatible |
| **CORE** | 3 | 965 (-60%) | 0.19 MB | 4/12 | Documentation & reference lookups |
| **CONFIG** | 2 | 640 (-74%) | 0.08 MB | 6/12 | Configuration generation |
| **GUIDANCE** | 2 | 683 (-72%) | 0.13 MB | 4/12 | Troubleshooting & best practices |
| **OBSERVABILITY** | 1 | 155 (-94%) | 0.04 MB | 0/12 | Metrics & monitoring only |

### Quick Mode Selection

**Use CORE mode when:**
- Looking up documentation quickly
- Exploring CLI commands and functions
- Learning Terragrunt basics
- Need reference information

**Use CONFIG mode when:**
- Generating Terragrunt configurations
- Working with HCL templates
- CI/CD automation pipelines
- Template-based workflows

**Use GUIDANCE mode when:**
- Debugging errors
- Getting best practices advice
- Troubleshooting deployments
- Learning patterns and comparisons

**Use OBSERVABILITY mode when:**
- Monitoring server performance
- Tracking usage metrics
- Minimal deployment footprint
- Metrics-only workflows

**Use FULL mode when:**
- Need multiple tool categories
- Exploratory workflows
- Backward compatibility required
- Uncertain which tools needed

### Mode Performance

**Verified performance metrics:**
- **Token reduction**: 60-94% vs FULL mode
- **Memory savings**: 5-80% vs baseline
- **Manager efficiency**: 50-100% reduction
- **Startup time**: 1-4ms (negligible)
- **Lazy loading**: Confirmed working

See [MODE_PERFORMANCE_VERIFIED.md](MODE_PERFORMANCE_VERIFIED.md) for detailed benchmarks.

## Installation

### Option 1: Using Docker (Recommended)

The easiest way to get started is using the pre-built Docker image:

```bash
# Pull the latest image
docker pull olofdevopsninja/terragrunt-mcp-server:latest

# Run with Docker
docker run -i olofdevopsninja/terragrunt-mcp-server:latest

# Or use docker-compose
docker-compose up
```

See the [Docker Deployment Guide](DOCKER.md) for detailed instructions.

### Option 2: From Source

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the server:

   ```bash
   npm run build
   ```

### VS Code Configuration

#### Using Docker Hub Image (Recommended)

**FULL mode (all tools, default):**
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
        "olofdevopsninja/terragrunt-mcp-server:latest"
      ]
    }
  }
}
```

**Specialized modes (optimized for specific use cases):**
```json
{
  "mcp.servers": {
    "terragrunt-docs": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "mcp-cache:/app/.cache",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "core"
      ]
    },
    "terragrunt-config": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "mcp-cache:/app/.cache",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "config"
      ]
    }
  }
}
```

#### Using Local Build

**FULL mode:**
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

**Specialized modes using CLI wrappers:**
```json
{
  "mcp.servers": {
    "terragrunt-docs": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/absolute/path/to/terragrunt-mcp-server"
    },
    "terragrunt-config": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-config"],
      "cwd": "/absolute/path/to/terragrunt-mcp-server"
    }
  }
}
```

**Alternative: Direct mode flag:**
```json
{
  "mcp.servers": {
    "terragrunt-core": {
      "command": "node",
      "args": ["dist/index.js", "--mode", "core"],
      "cwd": "/absolute/path/to/terragrunt-mcp-server"
    }
  }
}
```

1. **Restart VS Code** to activate the MCP server

2. **Verify installation**: Ask GitHub Copilot: *"Search Terragrunt docs for getting started"*

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

#### Built-in Functions

- *"Show me documentation for the path_relative_to_include function"*
- *"What parameters does get_env accept?"*
- *"List all AWS-related Terragrunt functions"*
- *"What built-in functions are available for working with files?"*
- *"Search for functions related to environment variables"*
- *"How do I use find_in_parent_folders?"*

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
│   ├── handlers/
│   │   ├── tools.ts             # Tool execution handlers (7 consolidated tools)
│   │   └── prompts.ts           # Prompt templates (future)
│   ├── terragrunt/
│   │   ├── docs.ts              # Documentation fetching and caching
│   │   ├── functions.ts         # Built-in functions manager
│   │   ├── cli-commands.ts      # CLI commands manager
│   │   ├── hcl-blocks.ts        # HCL configuration blocks manager
│   │   ├── best-practices.ts    # Best practices analyzer
│   │   ├── generator.ts         # Configuration generator
│   │   ├── file-writer.ts       # Secure file writing
│   │   ├── error-patterns.ts    # Error diagnosis patterns
│   │   ├── config.ts            # Configuration management
│   │   └── utils.ts             # Utility functions
│   └── types/
│       ├── mcp.ts               # MCP protocol type definitions
│       └── terragrunt.ts        # Terragrunt-specific types
├── test/
│   ├── unit/                    # Unit tests (Vitest)
│   ├── integration/             # Integration tests
│   ├── performance/             # Performance benchmarks
│   └── edge-cases/              # Edge case validation
├── fixtures/
│   └── terragrunt-docs-fixture.json  # Offline documentation cache
├── .cache/                      # Auto-generated cache (gitignored)
│   └── terragrunt-docs/
│       ├── docs-cache.json      # Cached documentation (~1.1MB)
│       └── metadata.json        # Cache timestamps
├── docs/                        # Comprehensive documentation
├── schemas/                     # JSON schemas
├── package.json                 # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # This file
```

### Key Files

- **`src/index.ts`**: Main entry point that initializes the MCP server with stdio transport
- **`src/handlers/tools.ts`**: Implements all 8 consolidated tools for documentation access
- **`src/terragrunt/docs.ts`**: Core documentation manager with caching, retry logic, and fallbacks
- **`test/`**: Comprehensive test suite with unit, integration, and performance tests

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

The project includes comprehensive test coverage (363 tests):

- **Unit Tests** (160 tests): Core functionality validation
  - Functions Manager (21 tests)
  - Docs Manager (67 tests)
  - Error Handling (24 tests)
  - Resource Handler (24 tests)
  - Tool Handler (24 tests)
- **Integration Tests** (164 tests): End-to-end tool and resource testing
  - Functions Tools Integration (23 tests)
  - MCP Protocol Compliance (68 tests)
  - Edge Case Validation (48 tests)
  - Server Integration (24 tests)
  - Functions Tools (legacy .js) (1 test)
- **Performance Tests** (39 tests): Benchmark critical operations
  - Large result sets, search performance, concurrent operations
  - Cache efficiency, memory usage monitoring
  - Function lookup performance benchmarks

#### Running Tests Locally

```bash
npm test                          # Run all tests (~92 seconds)
npm run test:server              # Integration tests only
npm test -- test/unit            # Unit tests only
npm test -- test/performance     # Performance benchmarks
npm test -- test/integration     # All integration tests
```

#### GitHub Actions Workflows

Two CI/CD workflows are available:

1. **Automatic Tests** (`.github/workflows/test.yml`):
   - Runs on all pull requests
   - Tests on Node.js 18 and 20
   - Generates coverage reports
   - Uses npm caching for speed

2. **Manual Tests** (`.github/workflows/manual-test.yml`):
   - Manual trigger via GitHub UI
   - Choose specific test suite:
     - All tests
     - Unit tests
     - Integration tests
     - Performance tests
     - Edge case tests
     - MCP protocol tests
     - Error handling tests
   - Uploads test artifacts
   - Generates test summaries

#### Test Documentation

For detailed testing information, see:

- [Performance Testing Guide](docs/Performance-Testing.md)
- [Edge Cases Testing Guide](docs/Edge-Cases-Testing.md)
- [MCP Protocol Compliance](docs/MCP-Protocol-Compliance.md)

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
- **Tool Handlers**: Eight consolidated tools for comprehensive Terragrunt assistance
- **Tool-Only Architecture**: Simplified design with no MCP resources (v0.5.0+)
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

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and migration guides.

**Current Version**: 0.5.0

- 8 consolidated tools (simplified from 11)
- Tool-only architecture (resources removed)
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
