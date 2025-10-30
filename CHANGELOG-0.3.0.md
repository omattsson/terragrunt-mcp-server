# Release Notes - v0.3.0

## 🎉 Major Features

### Configuration Generator

- **New MCP Tool**: `generate_terragrunt_config` - Generate Terragrunt configurations from natural language prompts
- **Template Library**: Comprehensive library of pre-built templates organized by category (AWS, Azure, GCP, Kubernetes, etc.)
- **Custom Template Support**: Define and use custom templates for organization-specific patterns
- **HCL Validation**: Built-in syntax validation for generated configurations
- **Smart Generation**: Context-aware configuration generation with best practices

### Custom Templates

- User-defined template system for organization-specific patterns
- Template validation and management
- Integration with configuration generator
- Support for complex variable substitution and logic

### Enhanced Function Tools

- **Improved Search**: Better search capabilities in `list_terragrunt_functions`
- **Rich Response Format**: Enhanced function metadata and examples
- **Include Examples**: Optional parameter to include usage examples
- **Function Suggestions**: Related function recommendations

### Performance Optimizations

- **Phase 1 & 2 Cache Optimizations**: Significantly improved lookup performance
- **Efficient Template Storage**: Optimized template organization and retrieval
- **Reduced Network Calls**: Better caching strategy for documentation

## 🐛 Bug Fixes

- **Fixed #98**: Added 7 missing built-in Terragrunt functions to function registry
- **Cache Warmup**: Fixed cache initialization issues
- **Documentation Updates**: Improved accuracy and coverage

## 📚 Documentation

- Configuration generator usage guide
- Custom template documentation
- Function lookup tool documentation
- Performance benchmarking documentation
- Comprehensive API documentation updates

## 🧪 Testing

- MCP protocol compliance tests for config generator
- Comprehensive integration tests for config generation
- Unit tests for TerragruntConfigGenerator
- Performance benchmarks for function lookup tools
- Edge case testing coverage

## 📦 Infrastructure

- Docker workflow for publishing images
- Improved build and deployment processes
- Enhanced development tooling

## 🔄 Refactoring

- Organized templates into scalable category-based structure
- Improved code organization and maintainability
- Better separation of concerns

---

## Upgrade Notes

No breaking changes - this is a backward-compatible release. Simply update to v0.3.0 to gain access to all new features.

## Getting Started with New Features

### Using the Configuration Generator

```typescript
// Example: Generate a Terraform configuration
const result = await mcp.callTool('generate_terragrunt_config', {
  prompt: 'Create a Terraform block with remote state in S3'
});
```

### Defining Custom Templates

See documentation at `docs/Custom-Templates.md` for detailed guidance on creating and using custom templates.

## Statistics

- **25 commits** since v0.2.1
- **10+ new features** and enhancements
- **100+ tests** added or updated
- **Multiple documentation** improvements

---

**Full Changelog**: [v0.2.1...v0.3.0](https://github.com/omattsson/terragrunt-mcp-server/compare/v0.2.1...v0.3.0)
