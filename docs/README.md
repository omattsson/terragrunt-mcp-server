# Terragrunt MCP Server Documentation

Welcome to the comprehensive documentation for the Terragrunt MCP Server! This documentation provides detailed information about installation, configuration, usage, and development.

## What is Terragrunt MCP Server?

A Model Context Protocol (MCP) server that provides comprehensive Terragrunt documentation and tooling integration for AI assistants like GitHub Copilot in VS Code.

## Quick Links

### Getting Started

- [Installation Guide](Installation-Guide) - Get up and running quickly
- [Quick Start Tutorial](Quick-Start-Tutorial) - Your first steps with the MCP server
- [Configuration](Configuration) - Configure VS Code and MCP settings
- [Copilot Instructions Template](Copilot-Instructions-Template.md) - Copy to your workspace for automatic tool selection

### Features & Tools

- [Available Tools](Available-Tools.md) - Complete reference for all 8 tools
- [AI Prompt Patterns](AI-Prompt-Patterns.md) - Optimize AI assistant tool usage for maximum efficiency
- [Best Practices Guide](Best-Practices-Guide.md) - Comprehensive guide to Terragrunt best practices
- [Configuration Generator](Configuration-Generator.md) - Generate Terragrunt configurations
- [Advanced Backend Templates](Advanced-Backend-Templates.md) - Enterprise backend configurations with KMS, cross-account, MSI
- [Custom Templates](Custom-Templates.md) - Create and use organization-specific templates
- [File Writing Guide](File-Writing-Guide.md) - Secure file writing with directory whitelisting
- [HCL Validation](HCL-Validation.md) - Built-in regex-based syntax validation
- [CLI Validation](CLI-Validation.md) - Optional Terragrunt CLI validation for accurate syntax checking
- [Architecture Overview](Architecture-Overview.md) - Understanding the caching and MCP implementation
- [Caching System](Caching-System.md) - Deep dive into the two-tier caching mechanism
- [Lazy Loading](Lazy-Loading.md) - Metadata-first loading with on-demand content fetching (60-80% memory reduction)

### Deployment

- [Docker Deployment](Docker-Deployment) - Run in Docker containers
- [Direct Installation](Direct-Installation) - Install and run natively
- [CI/CD Integration](CICD-Integration) - Use in automated environments

### Development

- [Development Guide](Development-Guide) - Contributing to the project
- [Testing](Testing) - Running and writing tests
- [Testing Complete Templates](Testing-Complete-Templates.md) - Comprehensive test guide for auto-generated templates
- [Manual Testing Checklist](Manual-Testing-Checklist.md) - Real-world validation procedures
- [Schema Drift Detection](Schema-Drift-Detection.md) - Automated schema update detection
- [Performance Testing](Performance-Testing) - Performance benchmarks and metrics
- [Edge Cases Testing](Edge-Cases-Testing) - Edge case and input validation tests
- [MCP Protocol Compliance](MCP-Protocol-Compliance) - MCP specification compliance tests
- [Release Process](Release-Process) - How releases are managed

### Help & Support

- [Troubleshooting](Troubleshooting) - Common issues and solutions
- [FAQ](FAQ) - Frequently asked questions
- [Examples & Use Cases](Examples-and-Use-Cases) - Real-world scenarios

## Project Information

- **GitHub Repository**: [omattsson/terragrunt-mcp-server](https://github.com/omattsson/terragrunt-mcp-server)
- **Version**: 0.2.0
- **License**: MIT
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **Terragrunt Docs**: [Official Documentation](https://terragrunt.gruntwork.io/)

## Recent Updates

- 🔧 Advanced backend templates with KMS, cross-account, MSI support
- 📖 CLI command help documentation (24 commands)
- ✨ 6 specialized documentation tools (v0.2.0)
- 🔄 Multi-tier caching with network resilience
- 🐳 Docker support with docker-compose
- ✅ Comprehensive test coverage
- 📚 Expanded documentation and examples

## Community

- [Discord](https://discord.gg/terragrunt) - Join the Terragrunt community
- [GitHub Discussions](https://github.com/omattsson/terragrunt-mcp-server/discussions) - Ask questions and share ideas
- [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues) - Report bugs or request features

## Contributing

We welcome contributions! See the [Development Guide](Development-Guide) for information on how to get started.
