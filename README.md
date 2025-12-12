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

### ⚙️ Configuration Generator

- **Tiered Templates**: Essential (4-5 vars) and Advanced (9-12 vars) backend templates
- **Multi-Cloud Support**: AWS S3, Azure Blob Storage, GCP GCS backends
- **Advanced Features**: KMS encryption, cross-account access, managed identity, service account impersonation
- **Mustache Conditionals**: Smart rendering includes only provided options
- **Two-Tier Validation**: Regex-based (fast) + optional Terragrunt CLI validation (accurate)
- **Custom Templates**: Extend with organization-specific templates

See [Advanced Backend Templates](docs/Advanced-Backend-Templates.md) for enterprise configuration options.

### 🔧 Available Tools

11 specialized tools for different documentation needs:

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

#### 2. **`get_cli_command_help`** - CLI Command Documentation

Get detailed help documentation for specific Terragrunt CLI commands.

- **Parameters**:
  - `command` (string, required): Command name (e.g., "plan", "apply", "run-all", "hclfmt")
- **Returns**: Command documentation with usage, options, and examples
- **Use cases**: Learning command syntax, understanding command options, CLI troubleshooting

#### 3. **`get_hcl_config_reference`** - HCL Configuration Reference

Get documentation for HCL configuration blocks, attributes, and functions used in `terragrunt.hcl`.

- **Parameters**:
  - `config` (string, required): Config element name (e.g., "terraform", "remote_state", "dependency", "inputs")
- **Returns**: Configuration reference with syntax and usage details
- **Use cases**: Writing terragrunt.hcl files, understanding configuration options

#### 4. **`get_terragrunt_function`** - Built-in Function Reference

Get detailed documentation for a specific Terragrunt built-in function.

- **Parameters**:
  - `function_name` (string, required): Function name (e.g., "path_relative_to_include", "get_env")
  - `include_examples` (boolean, optional): Include code examples (default: true)
- **Returns**: Complete function metadata including signature, parameters, return type, examples
- **Use cases**: Learning function syntax, understanding parameters, finding usage examples

#### 8. **`list_terragrunt_functions`** - List Built-in Functions

List all available Terragrunt built-in functions with filtering and search capabilities.

- **Parameters**:
  - `category` (string, optional): Filter by category (e.g., "path", "aws", "environment")
  - `search` (string, optional): Search in function names and descriptions
  - `limit` (number, optional): Maximum results to return (default: all functions)
- **Returns**: Array of functions with name, signature, category, and description
- **Use cases**: Discovering available functions, browsing by category, finding functions by keyword

#### 9. **`generate_terragrunt_config`** - Configuration Generator

Generate complete `terragrunt.hcl` configurations based on use case and requirements using battle-tested templates.

- **Parameters**:
  - `useCase` (string, required): Configuration type - one of:
    - `"remote_state"` - Remote state backend configuration
    - `"provider_generation"` - Provider block generation
    - `"dependencies"` - Module dependency configuration
    - `"hooks"` - Before/after hooks for automation
    - `"inputs"` - Input variables configuration
  - `backend` (string, optional): Backend type for remote_state use case:
    - `"s3"` - AWS S3 + DynamoDB
    - `"azurerm"` - Azure Blob Storage
    - `"gcs"` - Google Cloud Storage
  - `options` (object, optional): Configuration options (varies by use case and backend):
    - For S3: `bucket`, `key`, `region`, `dynamodb_table`, `encrypt`
    - For Azure: `storage_account_name`, `container_name`, `key`, `resource_group_name`
    - For GCS: `bucket`, `prefix`, `project`, `credentials`
    - For hooks: `name`, `commands`, `execute`, `working_dir`, `run_on_error`
    - For dependencies: `name`, `config_path`, `mock_outputs_allowed`
    - For inputs: `environment`, `region`, or any custom key-value pairs
    - For providers: `path`, `if_exists`, `region`, `account_id`
- **Returns**:
  - `config` - Complete HCL configuration ready to use
  - `explanation` - Human-readable description of what the config does
  - `nextSteps` - Suggested next actions
  - `relatedDocs` - Links to relevant Terragrunt documentation
- **Use cases**: Quick project setup, learning HCL syntax, best practice configurations, starting new modules

**Example prompts:**

```text
"Generate a terragrunt config for S3 remote state in us-east-1"
"Create an Azure backend configuration for my terraform state"
"Show me how to set up dependencies between terragrunt modules"
"Generate a before hook to run terraform fmt"
"Create an inputs configuration for a production environment"
```

#### 10. **`write_terragrunt_config`** - Write Configuration to Disk

Securely write generated or modified Terragrunt configurations to disk with directory whitelisting, path traversal protection, and automatic backup capabilities.

- **Parameters**:
  - `path` (string, required): Absolute file path where config should be written
  - `content` (string, required): HCL configuration content to write
  - `overwrite` (boolean, optional): Allow overwriting existing files (default: false)
  - `createBackup` (boolean, optional): Create backup before overwrite (default: from env var)
  - `createParentDirs` (boolean, optional): Create parent directories if missing (default: true)
- **Security**: Disabled by default, requires explicit configuration:
  - `TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true` - Enable file writing
  - `TERRAGRUNT_MCP_ALLOWED_DIRS` - Comma-separated whitelist of allowed directories
  - `TERRAGRUNT_MCP_AUTO_BACKUP` - Auto-create backups (default: true)
  - `TERRAGRUNT_MCP_MAX_FILE_SIZE` - Maximum file size limit (default: 1MB)
- **Use cases**: Saving generated configs, automating configuration updates, batch file operations
- **See**: [File Writing Guide](docs/File-Writing-Guide.md) for detailed security configuration

**Example prompts:**

```text
"Write this configuration to /home/user/terraform/terragrunt.hcl"
"Save the generated config to my project directory"
"Create a new terragrunt.hcl file with S3 backend configuration"
```

#### 11. **`analyze_best_practices`** - Analyze Best Practices by Topic

Extract and analyze best practices, patterns, antipatterns, and recommendations from Terragrunt documentation for specific topics with experience-level filtering.

- **Parameters**:
  - `topic` (string, required): Topic to analyze
    - `module_organization`, `state_management`, `dependencies`, `ci_cd`, `security`, `performance`, `testing`
  - `level` (string, optional): Filter by experience level
    - `beginner`, `intermediate`, `advanced`
- **Returns**: Structured recommendations with priority, rationale, examples, antipatterns, tradeoffs, and experience notes
- **Use cases**: Learning best practices, understanding patterns, avoiding common pitfalls, getting experience-appropriate guidance

**Example prompts:**

```text
"What are the best practices for state management?"
"Show me beginner-level module organization practices"
"Analyze CI/CD best practices for Terragrunt"
"What should I avoid when setting up dependencies?"
```

#### 12. **`diagnose_terragrunt_error`** - Error Diagnosis and Troubleshooting

Diagnose Terragrunt error messages and get actionable solutions, debugging steps, and relevant documentation links. Uses pattern matching with 66 error patterns across 7 categories.

- **Parameters**:
  - `error_message` (string, required): The error message from Terragrunt to diagnose
  - `context` (object, optional): Additional context (command, version, os, filePath, module, backend)
  - `options` (object, optional): Diagnosis options
    - `maxMatches` (number): Maximum matches to return (default: 3)
    - `minConfidence` (number): Minimum confidence score 0-1 (default: 0.3)
    - `enableFuzzyMatching` (boolean): Enable fuzzy matching (default: true)
    - `enrichWithDocs` (boolean): Enrich with documentation-sourced solutions (default: false)
    - `includeDestructiveCommands` (boolean): Include destructive commands in solutions (default: true)
- **Returns**: Matches with confidence scores, solutions, debugging steps, related errors, and documentation links
- **Use cases**: Troubleshooting errors, getting actionable solutions, finding relevant documentation

**Example prompts:**

```text
"I'm getting this error: Error acquiring the state lock"
"Help me fix: Backend configuration changed since last init"
"Diagnose this terragrunt error and tell me how to fix it"
```

See the [Troubleshooting Guide](docs/Troubleshooting-Guide.md) for detailed usage examples and best practices.

### 📖 Resources

- Complete documentation overview with section breakdown
- Individual documentation pages as separate resources
- Section-based documentation collections
- All content accessible through VS Code and Copilot

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

Add this to your VS Code `settings.json`:

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

#### Using Local Build

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
│   ├── server.ts                # Server initialization and setup
│   ├── handlers/
│   │   ├── tools.ts             # Tool execution handlers (8 tools)
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
- **`src/handlers/tools.ts`**: Implements all 8 tools for documentation access
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
- **Resource Handlers**: Expose documentation as structured resources
- **Tool Handlers**: Eight specialized tools for different documentation queries
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
