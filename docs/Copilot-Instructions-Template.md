# Copilot Instructions Template for Terragrunt MCP Server

> **Usage**: Copy the content below to your project's `.github/copilot-instructions.md` file to help GitHub Copilot automatically select Terragrunt MCP tools for relevant questions.

---

## Terragrunt MCP Tool Selection

When the user's question involves Terragrunt, use the **Terragrunt MCP server tools** instead of general web search or inference.

### Keyword Triggers

Recognize these patterns and use Terragrunt MCP tools:

- **File patterns**: `terragrunt.hcl`, `*.hcl` files, `root.hcl`, `common.hcl`
- **HCL blocks**: `remote_state`, `dependency`, `dependencies`, `generate`, `terraform`, `inputs`, `include`, `locals`
- **Functions**: `find_in_parent_folders()`, `read_terragrunt_config()`, `path_relative_to_include()`, `get_env()`, `run_cmd()`
- **CLI commands**: `terragrunt run-all`, `terragrunt plan`, `terragrunt apply`, `terragrunt init`, `terragrunt validate`
- **Concepts**: DRY infrastructure, Terraform wrapper, multi-environment setup, mono-repo structure, infrastructure-as-code organization

### Tool Selection Guide

| User Intent | Recommended Tool | Example Query |
|-------------|------------------|---------------|
| Search documentation | `search_docs` | "How does terragrunt handle dependencies?" |
| Understand a function | `function_reference` | "What does find_in_parent_folders do?" |
| Get CLI help | `cli_reference` | "How do I use terragrunt run-all?" |
| HCL block syntax | `get_hcl_config_reference` | "Show me remote_state block syntax" |
| Best practices | `get_guidance` | "What's the best way to organize Terragrunt?" |
| Generate config | `build_config` | "Create a terragrunt.hcl for S3 backend" |
| Debug errors | `diagnose_terragrunt_error` | "Why am I getting a dependency cycle error?" |
| Get server metrics | `get_server_metrics` | "Show me MCP server cache hit rates and tool usage" |

### Multi-Tool Workflows

For complex questions, combine tools in sequence:

1. **Setup help**: `get_hcl_config_reference` → `build_config` → `get_guidance`
2. **Debugging**: `diagnose_terragrunt_error` → `search_docs` → `cli_reference`
3. **Learning**: `search_docs` → `function_reference` → `get_guidance`

### Tool Descriptions Reference

- **search_docs**: Search Terragrunt documentation for HCL blocks, CLI commands, functions, and IaC patterns
- **function_reference**: Get details on built-in functions like `find_in_parent_folders`, `dependency`, `read_terragrunt_config`
- **cli_reference**: Get help for CLI commands like `terragrunt run-all`, `plan`, `apply`, `init`, `validate`
- **get_hcl_config_reference**: Get HCL block documentation for `remote_state`, `dependency`, `dependencies`, `generate`, `terraform`, `inputs`, `include`, `locals`
- **get_guidance**: Get best practices, block comparisons (e.g., dependency vs dependencies), or DRY patterns
- **build_config**: Generate Terragrunt HCL configuration files for remote_state backends, provider generation, dependency blocks, hooks, and inputs
- **diagnose_terragrunt_error**: Diagnose error messages including dependency cycles, state lock errors, provider issues, and HCL syntax problems
- **get_server_metrics**: Get Terragrunt MCP server metrics including cache hit rates, tool invocation counts, response times, and memory usage for observability

---

## Optional: Project-Specific Context

Add your project-specific Terragrunt context below:

```markdown
<!-- Example project context - customize for your setup -->

### Project Structure
- Root config: `infrastructure/root.hcl`
- Environments: `infrastructure/environments/{dev,staging,prod}/`
- Modules: `infrastructure/modules/`

### Backends
- AWS S3 with DynamoDB locking
- Bucket: `my-company-terraform-state`
- Region: `us-east-1`

### Common Patterns
- Use `find_in_parent_folders()` for root config inclusion
- Environment-specific inputs via `inputs = { ... }`
- Cross-stack dependencies via `dependency` blocks
```
