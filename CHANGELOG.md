# Changelog

All notable changes to the Terragrunt MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-06

### 🎉 First Stable Release

This is the first stable 1.0.0 release of the Terragrunt MCP Server, bringing together all major features and improvements into a production-ready package.

### ✨ Added

#### Comprehensive Metrics Collection System (Issue #184)

- **Real-Time Tracking**: Monitor tool execution times, response sizes, error rates, and cache performance
- **Historical Analysis**: Automatic daily snapshots with configurable retention (default: 90 days)
- **Multi-Format Reports**: Generate reports in Text, JSON, or Markdown formats
  - Daily, Weekly, Monthly, and All-time report periods
  - Trend analysis comparing performance over time
  - Top operations ranking by calls, latency, or errors
- **Privacy Controls**: Configurable data anonymization and redaction
  - SHA-256 hashing for operation names
  - Error message redaction
  - Timestamp removal
  - Configurable data retention
- **Multi-Format Export**: Export metrics in JSON, CSV, or ZIP formats
- **Performance**: <1ms overhead per operation, async operations, efficient caching
- **Documentation**: Comprehensive [Metrics Collection Guide](docs/Metrics-Collection-Guide.md)

#### Lazy Loading System (Issue #183)

- **Metadata-First Loading**: Load lightweight document metadata (~50KB) at startup, load full content (~2.5MB) on-demand
- **Memory Optimization**: 60-80% reduction in initial memory footprint with lazy loading enabled
- **Warmup Strategies**: Four configurable strategies for preloading commonly used documents:
  - `none`: Zero preloading, minimal memory (best for CI/CD)
  - `minimal`: first 3 docs, ~90ms warmup (default, best for development)
  - `common`: 8-12 frequently used docs, ~200ms warmup (best for regular use)
  - `full`: All ~85 docs, ~1.5s warmup (best for offline/intensive workflows)
- **Promise Deduplication**: Concurrent requests for same document share single loading promise
- **Cache Integration**: Seamless integration with existing disk cache system
- **Configuration**: Control via `TERRAGRUNT_LAZY_LOADING` and `TERRAGRUNT_WARMUP_STRATEGY` environment variables
- **Documentation**: New [Lazy Loading Guide](docs/Lazy-Loading.md)

**Performance Impact:**
- Startup time: ~10ms (metadata) + warmup time (0ms to 1.5s depending on strategy)
- Memory at startup: ~450KB (minimal) vs ~2.5MB (no lazy loading) = 82% reduction
- Search performance: Metadata-first search (fast), content loaded on-demand

### 📊 Summary Statistics

- **8 Comprehensive Tools**: Unified, intuitive API
- **114 New Tests**: All 1508 tests passing (100% pass rate)
- **Zero Linting Warnings**: Production-ready code quality
- **Comprehensive Documentation**: 12 detailed guides covering all features
- **No Breaking Changes**: Fully backward compatible

---

## [0.5.0] - 2025-12-15

### 🎯 Major Changes - Tool Consolidation & Architecture Improvements

This release represents a significant architectural improvement focused on simplifying the API surface while maintaining full functionality. Part of Epic #172.

### ⚠️ BREAKING CHANGES

#### Tool Consolidation (11 → 8 Tools)

**Removed Tools** (functionality consolidated into unified tools):
- `get_terragrunt_function` - Merged into `function_reference`
- `list_terragrunt_functions` - Merged into `function_reference`
- `get_cli_command_help` - Merged into `cli_reference`
- `list_cli_commands` - Merged into `cli_reference`
- `generate_terragrunt_config` - Merged into `build_config`
- `write_terragrunt_config` - Merged into `build_config`

**New Unified Tools**:
- `function_reference` - Get function details OR list all functions (replaces 2 tools)
- `cli_reference` - Get command help OR list commands (replaces 2 tools)
- `build_config` - Generate OR write OR generate+write configs (replaces 2 tools)

**Unchanged Tools**:
- `search_docs` - Unchanged (already unified in v0.4.0)
- `get_hcl_config_reference` - Unchanged
- `get_guidance` - Unchanged (already unified in v0.4.0)
- `diagnose_terragrunt_error` - Unchanged
- `get_server_metrics` - Unchanged (observability tool)

#### Resource Removal

**All MCP resources removed** - The server now operates in a tool-only architecture:
- Resources added complexity without providing significant value
- All resource functionality is better served through tools
- Simplifies the MCP protocol surface
- Improves performance and maintainability

### ✨ Improvements

#### Developer Experience
- **Simpler API**: 8 tools instead of 11, easier to discover and use
- **Unified Interfaces**: Related operations consolidated under single tool names
- **Mode-based Operations**: Tools use `mode` or conditional parameters instead of separate tools
- **Backward Compatible Behavior**: Same functionality, better organization

#### Performance
- **Reduced Protocol Overhead**: Fewer tool registrations and lookups
- **Streamlined Handlers**: Simplified routing logic
- **Better Resource Efficiency**: Tool-only architecture reduces memory footprint

#### Maintainability
- **Clearer Code Organization**: Related functionality grouped together
- **Easier Testing**: Fewer tools to test, better test coverage
- **Simplified Documentation**: Less surface area to document

### 📖 Documentation

- Complete rewrite of tool documentation for v0.5.0
- Updated all examples to use consolidated tool names
- New architecture overview reflecting tool-only design
- Migration guide for users upgrading from v0.4.x

---

## [0.4.0] - 2025-12-01

### ✨ Added

#### Configuration Generator & File Writing

- **Interactive Configuration Generator**: Generate Terragrunt configurations from natural language prompts
- **Template Library**: Comprehensive library of pre-built templates for AWS, Azure, GCP, and Kubernetes
- **Custom Template Support**: Define and use custom templates for organization-specific patterns
- **HCL Validation**: Built-in syntax validation for generated configurations
- **File Writing Capability**: Write generated configurations directly to disk with safety checks

#### Enhanced Documentation Search

- **Semantic Search**: Improved search capabilities across all Terragrunt documentation
- **Code Examples**: Extract and search code examples from documentation
- **Section Navigation**: Browse documentation by sections and categories
- **Related Content**: Get related documentation suggestions

#### Performance Optimizations

- **Phase 1 & 2 Cache Optimizations**: Significantly improved lookup performance
- **Efficient Template Storage**: Optimized template organization and retrieval
- **Reduced Network Calls**: Better caching strategy for documentation

### 🐛 Bug Fixes

- **Fixed #98**: Added 7 missing built-in Terragrunt functions to function registry
- **Cache Warmup**: Fixed cache initialization issues
- **Documentation Updates**: Improved accuracy and coverage

---

## [0.3.0] - 2025-11-15

### ✨ Added

#### Best Practices & Guidance System

- **Best Practices Analyzer**: Get recommendations for Terragrunt project structure and patterns
- **Configuration Comparisons**: Compare different approaches (e.g., dependency vs dependencies)
- **Anti-Pattern Detection**: Identify and avoid common Terragrunt pitfalls
- **Context-Aware Suggestions**: Recommendations based on your specific use case

#### Error Diagnosis System

- **66 Error Patterns**: Comprehensive database of Terragrunt errors across 7 categories
- **Actionable Solutions**: Step-by-step solutions with commands
- **Documentation Links**: Direct links to relevant Terragrunt documentation
- **Fuzzy Matching**: Handles typos and partial error messages
- **Enriched Diagnosis**: Optional documentation-sourced solutions and debugging steps

#### Enhanced Function Tools

- **Improved Search**: Better search capabilities in function reference
- **Rich Response Format**: Enhanced function metadata and examples
- **Include Examples**: Optional parameter to include usage examples
- **Function Suggestions**: Related function recommendations

### 📖 Documentation

- Configuration generator usage guide
- Custom template documentation
- Best practices guide
- Error diagnosis guide
- Performance benchmarking documentation

---

## [0.2.0] - 2025-10-30

### ✨ Added

#### Multi-Mode Architecture

- **5 Operational Modes**: FULL, CORE, CONFIG, GUIDANCE, OBSERVABILITY
- **Token Optimization**: 60-74% token reduction for specific workflows
- **Memory Efficiency**: Reduced memory footprint for lightweight deployments
- **Mode Selection**: Configure via `TERRAGRUNT_MCP_MODE` environment variable

#### CLI Command Reference

- **Complete CLI Documentation**: Access to all Terragrunt CLI commands
- **Command Help**: Detailed help for specific commands
- **Command Listing**: Browse commands by category
- **Usage Examples**: Examples for each command

#### HCL Configuration Reference

- **Block Documentation**: Documentation for all HCL blocks (terraform, remote_state, etc.)
- **Attribute Reference**: Complete attribute documentation
- **Configuration Examples**: Examples for each block type
- **Best Practices**: Recommendations for each configuration element

### 📖 Documentation

- Multi-mode architecture guide
- CLI reference documentation
- HCL configuration guide
- Mode performance benchmarks

---

## [0.1.0] - 2025-10-15

### 🎉 Initial Release

#### Core Features

- **Terragrunt Documentation Access**: Complete access to official Terragrunt documentation
- **Function Reference**: Documentation for 50+ built-in Terragrunt functions
- **Semantic Search**: Search across all Terragrunt documentation
- **Disk Caching**: Efficient caching with 24-hour expiry
- **MCP Protocol**: Full compliance with Model Context Protocol v0.5.0

#### Tools (Initial Set)

1. `search_docs` - Search Terragrunt documentation
2. `get_terragrunt_function` - Get function details
3. `list_terragrunt_functions` - List all functions
4. `get_server_metrics` - Server observability

#### Infrastructure

- TypeScript with ES modules
- Vitest testing framework
- Comprehensive error handling
- Logging to stderr (MCP compliant)

### 📖 Documentation

- README with quick start guide
- Installation guide
- Testing documentation
- Contributing guidelines

---

## Links

- **Repository**: https://github.com/omattsson/terragrunt-mcp-server
- **Issues**: https://github.com/omattsson/terragrunt-mcp-server/issues
- **Documentation**: https://github.com/omattsson/terragrunt-mcp-server/tree/main/docs
