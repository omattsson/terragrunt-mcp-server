# Changelog

All notable changes to the Terragrunt MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✨ Added

#### Lazy Loading System (Issue #183)

- **Metadata-First Loading**: Load lightweight document metadata (~50KB) at startup, load full content (~2.5MB) on-demand
- **Memory Optimization**: 60-80% reduction in initial memory footprint with lazy loading enabled
- **Warmup Strategies**: Four configurable strategies for preloading commonly used documents:
  - `none`: Zero preloading, minimal memory (best for CI/CD)
  - `minimal`: first 3 docs, ~90ms warmup (default, best for development)
  - `common`: 8-12 frequently used docs, ~200ms warmup (best for regular use)
  - `full`: All ~85 docs, ~1.5s warmup (best for offline/intensive workflows)
- **Promise Deduplication**: Concurrent requests for same document share single loading promise, preventing duplicate network calls
- **Cache Integration**: Seamless integration with existing disk cache system
- **Lazy Loading Metrics**: Enhanced `getCacheStats()` with lazy loading statistics:
  - Enabled flag, startup time, metadata-only load time, warmup time, initial memory (MB), metadata count, docs loaded lazily, average doc load time, loaded docs ratio, and warmup strategy
- **Configuration**: Control via `TERRAGRUNT_LAZY_LOADING` and `TERRAGRUNT_WARMUP_STRATEGY` environment variables
- **Comprehensive Documentation**: New [Lazy Loading Guide](docs/Lazy-Loading.md) with usage examples, performance characteristics, and troubleshooting

**Performance Impact:**
- Startup time: ~10ms (metadata) + warmup time (0ms to 1.5s depending on strategy)
- Memory at startup: ~450KB (minimal) vs ~2.5MB (no lazy loading) = 82% reduction
- Search performance: Metadata-first search (fast), content loaded on-demand for matches only

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

### 🔄 Migration Guide

#### Updating Tool Calls

**Function Reference**:
```typescript
// OLD: get_terragrunt_function
{ name: "get_terragrunt_function", arguments: { function_name: "path_relative_to_include" } }

// NEW: function_reference (auto-detects get mode when function_name provided)
{ name: "function_reference", arguments: { function_name: "path_relative_to_include" } }

// OLD: list_terragrunt_functions
{ name: "list_terragrunt_functions", arguments: { category: "path" } }

// NEW: function_reference (list mode when no function_name)
{ name: "function_reference", arguments: { category: "path" } }
```

**CLI Reference**:
```typescript
// OLD: get_cli_command_help
{ name: "get_cli_command_help", arguments: { command: "plan" } }

// NEW: cli_reference (auto-detects get mode when command provided)
{ name: "cli_reference", arguments: { command: "plan" } }

// OLD: list_cli_commands
{ name: "list_cli_commands", arguments: { category: "main" } }

// NEW: cli_reference (list mode when no command)
{ name: "cli_reference", arguments: { category: "main" } }
```

**Build Config**:
```typescript
// OLD: generate_terragrunt_config
{ name: "generate_terragrunt_config", arguments: { useCase: "remote_state", options: {...} } }

// NEW: build_config (generate-only mode, default)
{ name: "build_config", arguments: { useCase: "remote_state", options: {...} } }

// OLD: write_terragrunt_config
{ name: "write_terragrunt_config", arguments: { content: "...", path: "..." } }

// NEW: build_config (write-only mode when content provided)
{ name: "build_config", arguments: { content: "...", path: "..." } }

// NEW: Generate + Write in one call
{ name: "build_config", arguments: { useCase: "remote_state", options: {...}, write: true, path: "..." } }
```

### 🙏 Acknowledgments

Thanks to all contributors who helped with Epic #172 - Tool Consolidation and Architecture Improvements.

---

## [0.4.0] - Previous releases

See [CHANGELOG-0.3.0.md](CHANGELOG-0.3.0.md) for earlier release notes.

## Links

- **Epic #172**: Tool Consolidation and Architecture Improvements
- **Issue #181**: Update all documentation for v0.5.0
- **Repository**: https://github.com/your-org/terragrunt-mcp-server
