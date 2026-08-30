# Copilot Chat Test Plan for Terragrunt MCP Server

This document provides a comprehensive manual test plan for validating the Terragrunt MCP Server functionality through GitHub Copilot Chat in VS Code. These tests complement the automated unit and integration tests by verifying end-to-end functionality from the client perspective.

## Prerequisites

### 1. MCP Server Setup

Ensure the Terragrunt MCP server is configured in your VS Code settings:

```json
// In ~/.config/Code/User/settings.json or workspace .vscode/settings.json
{
  "mcp": {
    "servers": {
      "terragrunt": {
        "command": "node",
        "args": ["/path/to/terragrunt-mcp-server/dist/index.js"]
      }
    }
  }
}
```

### 2. Build the Server

```bash
cd /path/to/terragrunt-mcp-server
npm install
npm run build
```

### 3. Verify Server Status

In VS Code, open Copilot Chat and run:

```text
@terragrunt What tools are available?
```

Expected: Should list available Terragrunt documentation and configuration tools.

---

## Test Categories

| Category | Tools Covered | Test Count |
|----------|---------------|------------|
| [Documentation Search](#1-documentation-search-tools) | `search_terragrunt_docs`, `get_terragrunt_sections`, `get_section_docs` | 8 |
| [Function Lookup](#2-function-lookup-tools) | `get_terragrunt_function`, `list_terragrunt_functions` | 10 |
| [CLI and HCL Reference](#3-cli-and-hcl-reference-tools) | `get_cli_command_help`, `get_hcl_config_reference`, `get_code_examples` | 8 |
| [Config Generation](#4-config-generation-tool) | `generate_terragrunt_config` | 14 |
| [Best Practices](#5-best-practices-tool) | `get_guidance` | 6 |
| [Error Diagnosis](#6-error-diagnosis-tool) | `diagnose_terragrunt_error` | 6 |
| [File Writing](#7-file-writing-tool) | `write_terragrunt_config` | 6 |
| [Edge Cases and Errors](#8-edge-cases-and-error-handling) | All tools | 10 |

**Total: 68 test cases**

---

## 1. Documentation Search Tools

### 1.1 search_terragrunt_docs

#### Test 1.1.1: Basic Search
**Prompt:**
```
@terragrunt Search for documentation about dependencies
```
**Expected:** Returns relevant documentation pages about Terragrunt dependencies with titles, URLs, sections, and content snippets.

#### Test 1.1.2: Search with Limit
**Prompt:**
```
@terragrunt Search Terragrunt docs for "remote state" and return 10 results
```
**Expected:** Returns up to 10 results about remote state configuration.

#### Test 1.1.3: Search for Specific Feature
**Prompt:**
```
@terragrunt Find documentation about generate blocks
```
**Expected:** Returns documentation about the `generate` block feature.

#### Test 1.1.4: Search with No Results
**Prompt:**
```
@terragrunt Search for "xyznonexistent123"
```
**Expected:** Returns empty results or a message indicating no matches found.

---

### 1.2 get_terragrunt_sections

#### Test 1.2.1: List All Sections
**Prompt:**
```
@terragrunt What documentation sections are available?
```
**Expected:** Returns a list of sections like `getting-started`, `features`, `reference`, `community` with document counts for each.

#### Test 1.2.2: Section Overview Request
**Prompt:**
```
@terragrunt Show me the structure of Terragrunt documentation
```
**Expected:** Returns organized list of documentation categories.

---

### 1.3 get_section_docs

#### Test 1.3.1: Get Specific Section
**Prompt:**
```
@terragrunt Get all documentation from the features section
```
**Expected:** Returns all documentation pages in the `features` section.

#### Test 1.3.2: Invalid Section
**Prompt:**
```
@terragrunt Get documentation for the "nonexistent-section" section
```
**Expected:** Returns an error message with available section names.

---

## 2. Function Lookup Tools

### 2.1 get_terragrunt_function

#### Test 2.1.1: Well-Known Function
**Prompt:**
```
@terragrunt How do I use the get_env function in Terragrunt?
```
**Expected:** Returns detailed documentation for `get_env` including:
- Function signature
- Description
- Parameters with types
- Usage examples
- Related functions

#### Test 2.1.2: Path Function
**Prompt:**
```
@terragrunt Explain the find_in_parent_folders function
```
**Expected:** Returns documentation for `find_in_parent_folders` with examples.

#### Test 2.1.3: Function Without Examples
**Prompt:**
```
@terragrunt Get documentation for path_relative_to_include without examples
```
**Expected:** Returns function documentation without code examples.

#### Test 2.1.4: Function with Examples Explicitly
**Prompt:**
```
@terragrunt Show me get_terragrunt_dir with code examples
```
**Expected:** Returns function documentation with code examples included.

#### Test 2.1.5: Non-existent Function
**Prompt:**
```
@terragrunt What is the fake_function in Terragrunt?
```
**Expected:** Returns error or message that function was not found, possibly with suggestions.

---

### 2.2 list_terragrunt_functions

#### Test 2.2.1: List All Functions
**Prompt:**
```
@terragrunt List all available Terragrunt built-in functions
```
**Expected:** Returns a list of all built-in functions with names, categories, and brief descriptions.

#### Test 2.2.2: Filter by Category
**Prompt:**
```
@terragrunt List Terragrunt functions in the filesystem category
```
**Expected:** Returns only filesystem-related functions.

#### Test 2.2.3: Search by Keyword
**Prompt:**
```
@terragrunt Search for Terragrunt functions related to "path"
```
**Expected:** Returns functions with "path" in name or description.

#### Test 2.2.4: Combined Category and Search
**Prompt:**
```
@terragrunt List env functions that deal with variables
```
**Expected:** Returns filtered list matching both criteria.

#### Test 2.2.5: Limited Results
**Prompt:**
```
@terragrunt Show me 5 Terragrunt functions
```
**Expected:** Returns exactly 5 functions.

---

## 3. CLI and HCL Reference Tools

### 3.1 get_cli_command_help

#### Test 3.1.1: Common Command
**Prompt:**
```
@terragrunt How do I use terragrunt plan?
```
**Expected:** Returns detailed help for the `plan` command including options and usage.

#### Test 3.1.2: Run --all Command
**Prompt:**
```
@terragrunt Explain the run --all command
```
**Expected:** Returns documentation for `run --all` including parallelism options.

#### Test 3.1.3: Format Command
**Prompt:**
```
@terragrunt How do I use hcl fmt?
```
**Expected:** Returns help for the `hcl fmt` command and identifies `hclfmt` as a removed command name retained only for migration lookup; current Terragrunt does not execute it.

---

### 3.2 get_hcl_config_reference

#### Test 3.2.1: Remote State Block
**Prompt:**
```
@terragrunt How do I configure remote_state in terragrunt.hcl?
```
**Expected:** Returns documentation for the `remote_state` block with configuration options.

#### Test 3.2.2: Dependency Block
**Prompt:**
```
@terragrunt Explain the dependency block configuration
```
**Expected:** Returns documentation for `dependency` block.

#### Test 3.2.3: Inputs Block
**Prompt:**
```
@terragrunt How do I use the inputs block?
```
**Expected:** Returns documentation for the `inputs` block.

---

### 3.3 get_code_examples

#### Test 3.3.1: Example for Topic
**Prompt:**
```
@terragrunt Show me code examples for before hooks
```
**Expected:** Returns code snippets demonstrating before hooks usage.

#### Test 3.3.2: Examples with Limit
**Prompt:**
```
@terragrunt Find 3 code examples about remote state
```
**Expected:** Returns up to 3 code examples about remote state.

---

## 4. Config Generation Tool

### 4.1 AWS S3 Backend Templates

#### Test 4.1.1: Basic S3 Backend
**Prompt:**
```
@terragrunt Generate a Terragrunt remote_state config for AWS S3 with bucket "my-terraform-state", region "us-east-1", and DynamoDB table "terraform-locks"
```
**Expected:** Returns valid HCL configuration for S3 backend with DynamoDB locking.

#### Test 4.1.2: Advanced S3 Backend with KMS
**Prompt:**
```
@terragrunt Generate an advanced S3 backend config with:
- bucket: my-bucket
- key: prod/terraform.tfstate  
- region: us-east-1
- encrypt: true
- kms_key_id: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
```
**Expected:** Returns S3 backend config with KMS encryption enabled.

#### Test 4.1.3: S3 Backend with Cross-Account Access
**Prompt:**
```
@terragrunt Generate S3 backend config for cross-account access with role_arn "arn:aws:iam::987654321098:role/TerraformRole"
```
**Expected:** Returns config with assume role configuration.

#### Test 4.1.4: S3 Backend for LocalStack Testing
**Prompt:**
```
@terragrunt Generate S3 backend config for LocalStack with endpoint "http://localhost:4566" and skip_credentials_validation true
```
**Expected:** Returns config suitable for local testing with LocalStack.

---

### 4.2 Azure Backend Template

#### Test 4.2.1: Azure Blob Backend
**Prompt:**
```
@terragrunt Generate Azure blob backend config with:
- resource_group_name: my-rg
- storage_account_name: mystorageaccount
- container_name: tfstate
- key: terraform.tfstate
```
**Expected:** Returns valid Azure blob backend configuration.

---

### 4.3 GCS Backend Template

#### Test 4.3.1: GCS Backend
**Prompt:**
```
@terragrunt Generate GCS backend config with bucket "my-gcs-bucket" and prefix "terraform/state"
```
**Expected:** Returns valid GCS backend configuration.

---

### 4.4 Provider Generation

#### Test 4.4.1: AWS Provider
**Prompt:**
```
@terragrunt Generate AWS provider config for region us-west-2
```
**Expected:** Returns provider generation block for AWS.

#### Test 4.4.2: Azure Provider
**Prompt:**
```
@terragrunt Generate Azure provider configuration
```
**Expected:** Returns provider generation block for Azure.

---

### 4.5 Dependencies Template

#### Test 4.5.1: Single Dependency
**Prompt:**
```
@terragrunt Generate a dependency config for a VPC module at "../vpc"
```
**Expected:** Returns dependency block configuration.

---

### 4.6 Hooks Template

#### Test 4.6.1: Before Hook
**Prompt:**
```
@terragrunt Generate a before_hook that runs "echo Starting" before apply
```
**Expected:** Returns terraform block with before_hook configuration.

---

### 4.7 Inputs Template

#### Test 4.7.1: Inputs from Dependencies
**Prompt:**
```
@terragrunt Generate an inputs block that uses outputs from vpc and database dependencies
```
**Expected:** Returns inputs block with dependency references.

---

### 4.8 Custom Templates

#### Test 4.8.1: Custom Template
**Prompt:**
```
@terragrunt Generate config using this custom template:
{
  "id": "my-custom-backend",
  "name": "My Custom Backend",
  "description": "Custom backend for testing",
  "category": "backend",
  "templateHcl": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket = \"{{bucket}}\"\n  }\n}",
  "variables": [
    {"name": "bucket", "type": "string", "required": true}
  ]
}
with bucket "test-bucket"
```
**Expected:** Returns config generated from custom template.

---

### 4.9 Validation

#### Test 4.9.1: Missing Required Variable
**Prompt:**
```
@terragrunt Generate S3 backend config with just bucket "my-bucket" (missing required fields)
```
**Expected:** Returns validation errors listing missing required variables.

#### Test 4.9.2: Strict Validation Mode
**Prompt:**
```
@terragrunt Generate S3 backend config with strict validation enabled
```
**Expected:** If HCL is invalid, returns error instead of config with warnings.

---

## 5. Best Practices Tool

### 5.1 get_guidance

#### Test 5.1.1: Module Organization
**Prompt:**
```
@terragrunt What are best practices for module organization in Terragrunt?
```
**Expected:** Returns recommendations for module organization with confidence score.

#### Test 5.1.2: State Management
**Prompt:**
```
@terragrunt Analyze best practices for state management
```
**Expected:** Returns state management recommendations, anti-patterns to avoid.

#### Test 5.1.3: Security Best Practices
**Prompt:**
```
@terragrunt What are security best practices for Terragrunt?
```
**Expected:** Returns security recommendations with confidence scoring.

#### Test 5.1.4: CI/CD Best Practices
**Prompt:**
```
@terragrunt Best practices for CI/CD with Terragrunt
```
**Expected:** Returns CI/CD integration recommendations.

#### Test 5.1.5: Experience Level Filter
**Prompt:**
```
@terragrunt Show beginner-level best practices for dependencies
```
**Expected:** Returns beginner-appropriate recommendations only.

#### Test 5.1.6: Typo with Fuzzy Matching
**Prompt:**
```
@terragrunt Analyze best practices for "modul_organiztion"
```
**Expected:** Returns fuzzy-matched suggestions for the typo (suggests "module_organization").

---

## 6. Error Diagnosis Tool

### 6.1 diagnose_terragrunt_error

#### Test 6.1.1: Backend Configuration Error
**Prompt:**
```
@terragrunt Diagnose this error: "Error loading state: BucketRegionError: incorrect region"
```
**Expected:** Returns diagnosis with:
- Pattern match and confidence score
- Root cause explanation
- Step-by-step solutions
- Related documentation links

#### Test 6.1.2: Dependency Error
**Prompt:**
```
@terragrunt Help me fix: "Could not find a terragrunt.hcl file in any of the parent folders"
```
**Expected:** Returns diagnosis for missing parent config.

#### Test 6.1.3: Error with Context
**Prompt:**
```
@terragrunt Diagnose "AccessDenied: Access Denied" when running terragrunt apply on S3 backend
```
**Expected:** Returns context-aware diagnosis for S3 access issues.

#### Test 6.1.4: Error with Documentation Enrichment
**Prompt:**
```
@terragrunt Diagnose "Error: Cycle detected in dependency" with documentation links
```
**Expected:** Returns diagnosis enriched with relevant documentation.

#### Test 6.1.5: Unknown Error Pattern
**Prompt:**
```
@terragrunt Diagnose "Some completely unknown error xyz123"
```
**Expected:** Returns low-confidence match or general troubleshooting guidance.

#### Test 6.1.6: Error with Multiple Matches
**Prompt:**
```
@terragrunt Diagnose "Error: Invalid configuration"
```
**Expected:** Returns multiple possible matches ranked by confidence.

---

## 7. File Writing Tool

### 7.1 write_terragrunt_config

#### Test 7.1.1: Write New File
**Prompt:**
```
@terragrunt Generate an S3 backend config and save it to ./test-output/terragrunt.hcl
```
**Expected:** 
- Creates parent directories if needed
- Writes valid HCL file
- Returns success confirmation with path and bytes written

#### Test 7.1.2: Overwrite Protection
**Prompt:**
```
@terragrunt Write this config to ./test-output/terragrunt.hcl (file already exists)
```
**Expected:** Returns error about existing file, suggests using overwrite option.

#### Test 7.1.3: Overwrite with Backup
**Prompt:**
```
@terragrunt Overwrite ./test-output/terragrunt.hcl with new config, create backup first
```
**Expected:**
- Creates backup file (e.g., `terragrunt.hcl.backup`)
- Overwrites original
- Returns confirmation with backup path

#### Test 7.1.4: Write Outside Allowed Directory
**Prompt:**
```
@terragrunt Write config to /etc/terragrunt.hcl
```
**Expected:** Returns security error - path outside allowed directories.

#### Test 7.1.5: Invalid Path Characters
**Prompt:**
```
@terragrunt Write config to ./test<>output/file.hcl
```
**Expected:** Returns validation error for invalid path characters.

#### Test 7.1.6: File Size Limit
**Prompt:**
```
@terragrunt Write a very large config (>1MB) to file
```
**Expected:** Returns error if content exceeds max file size limit.

---

## 8. Edge Cases and Error Handling

### 8.1 Invalid Input Handling

#### Test 8.1.1: Empty Query
**Prompt:**
```
@terragrunt Search for ""
```
**Expected:** Returns error message about empty query.

#### Test 8.1.2: Missing Required Parameter
**Prompt:**
```
@terragrunt Generate remote_state config without any options
```
**Expected:** Returns error listing required parameters.

#### Test 8.1.3: Invalid Parameter Type
**Prompt:**
```
@terragrunt Search docs with limit "not-a-number"
```
**Expected:** Handles gracefully with default or error message.

#### Test 8.1.4: Very Long Query
**Prompt:**
```
@terragrunt Search for "[very long string >1000 chars]"
```
**Expected:** Handles without crashing, may truncate or warn.

---

### 8.2 Network & Cache Scenarios

#### Test 8.2.1: Cache Hit Performance
**Prompt (run twice):**
```
@terragrunt List all Terragrunt functions
```
**Expected:** Second call should be noticeably faster (cached).

#### Test 8.2.2: Documentation Freshness
**Prompt:**
```
@terragrunt When was the documentation last updated?
```
**Expected:** Returns cache age or last fetch timestamp.

---

### 8.3 Concurrent Requests

#### Test 8.3.1: Parallel Tool Calls
**Prompt:**
```
@terragrunt Search for "dependencies" and also list all functions
```
**Expected:** Both operations complete without interference.

---

### 8.4 Special Characters

#### Test 8.4.1: Query with Special Characters
**Prompt:**
```
@terragrunt Search for "path_relative_to_include()"
```
**Expected:** Handles parentheses correctly in search.

#### Test 8.4.2: HCL Special Syntax
**Prompt:**
```
@terragrunt Search for "${path_relative_to_include()}"
```
**Expected:** Handles Terraform interpolation syntax in search.

---

### 8.5 Boundary Conditions

#### Test 8.5.1: Maximum Limit
**Prompt:**
```
@terragrunt Search docs with limit 100
```
**Expected:** Respects maximum limit (20) or handles gracefully.

#### Test 8.5.2: Zero Limit
**Prompt:**
```
@terragrunt Search docs with limit 0
```
**Expected:** Returns minimum 1 result or appropriate error.

---

## Test Execution Checklist

### Quick Smoke Test (5 minutes)
- [ ] Server responds to basic query
- [ ] Search returns results
- [ ] Function lookup works
- [ ] Config generation produces valid HCL

### Full Regression Test (30 minutes)
- [ ] All documentation search tests pass
- [ ] All function lookup tests pass
- [ ] All CLI/HCL reference tests pass
- [ ] All config generation tests pass
- [ ] All best practices tests pass
- [ ] All error diagnosis tests pass
- [ ] All file writing tests pass
- [ ] All edge case tests pass

---

## Troubleshooting

### Server Not Responding
1. Check server is built: `npm run build`
2. Verify path in settings.json
3. Check VS Code Output panel for MCP errors
4. Try reloading VS Code window

### Slow Responses
1. First request may be slow (cache warming)
2. Check network connectivity for doc fetching
3. Verify fixture file exists for offline mode

### Invalid Responses
1. Check server logs in terminal
2. Verify fixture data is up to date
3. Run unit tests: `npm test`

---

## Reporting Issues

When reporting test failures, include:
1. Test case number and name
2. Exact prompt used
3. Actual response received
4. Expected response
5. VS Code and extension versions
6. Server logs if available
