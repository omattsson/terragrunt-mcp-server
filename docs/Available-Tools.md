# Available Tools

The Terragrunt MCP Server provides **8 consolidated tools** for comprehensive Terragrunt assistance. Each tool is designed with unified interfaces that intelligently adapt to your needs based on provided parameters.

> **Version Note**: v0.5.0 consolidated 11 separate tools into 8 (7 core + 1 observability) for improved usability. See [CHANGELOG.md](../CHANGELOG.md) for migration details.

> **AI Assistants**: For optimal prompt patterns and token efficiency tips, see [AI Prompt Patterns Guide](AI-Prompt-Patterns.md).

## Tool Overview

| # | Tool | Purpose | Best For |
|---|------|---------|----------|
| 1 | `search_docs` | Unified documentation search | All doc-related tasks (search, browse, sections, examples) |
| 2 | `function_reference` | Get/list built-in functions | Function lookup, discovery, and browsing |
| 3 | `cli_reference` | Get/list CLI commands | Command help, listing, and browsing by category |
| 4 | `get_hcl_config_reference` | HCL block documentation | Writing terragrunt.hcl files |
| 5 | `get_guidance` | Best practices & comparisons | Learning patterns, avoiding pitfalls |
| 6 | `build_config` | Generate/write configurations | Config creation, file management |
| 7 | `diagnose_terragrunt_error` | Error diagnosis | Troubleshooting Terragrunt errors |
| 8 | `get_server_metrics` | Server observability | Monitoring performance and usage |

---

## 1. search_docs

**Purpose**: Unified tool for all documentation search needs - semantic search, browsing sections, retrieving content, and finding code examples. Supports 4 modes controlled by the `mode` parameter.

### Parameters — search_docs

- **`mode`** (string, optional): Operation mode - `search`, `list`, `section`, or `examples` (default: `search`)
- **`query`** (string, conditional): Search query text (required for `search` mode, optional for `examples` mode)
- **`section`** (string, conditional): Section name (required for `section` mode)
- **`detailLevel`** (string, optional): Response detail level - `summary` (concise, 60-90% smaller) or `full` (default: `summary`)
- **`page`** (number, optional): Page number for `search` mode (default: 1)
- **`pageSize`** (number, optional): Results per page for `search` mode (default: 10)
- **`limit`** (number, optional): Maximum examples for `examples` mode (default: 5)
- **`advanced`** (boolean, optional): Use curated examples in `examples` mode (default: false)
- **`category`** (string, optional): Filter by category in `examples` mode with `advanced=true`
- **`listCategories`** (boolean, optional): List available categories in `examples` mode (default: false)

### Modes — search_docs

#### Mode: search (default)
Semantic search across all documentation.

**Required**: `query`  
**Optional**: `page`, `pageSize`

```text
"Search for Terragrunt documentation about dependencies"
"Find information about remote state"
```

#### Mode: list
List all available documentation sections with counts.

**Required**: None

```text
"What documentation sections are available?"
"List all Terragrunt documentation categories"
```

#### Mode: section
Get all documentation pages in a specific section.

**Required**: `section`  
**Optional**: `detailLevel`

```text
"Show me all docs in the getting-started section"
"Get reference documentation pages"
```

#### Mode: examples
Find code examples and patterns.

**Required**: `query` (when `advanced=false`)  
**Optional**: `query`, `detailLevel`, `limit`, `advanced`, `category`, `listCategories`

```text
"Find code examples for dependencies"
"Show me advanced examples for hooks"
"List all example categories"
```

### Example Prompts — search_docs

```text
"Search for Terragrunt documentation about dependencies"
"List all documentation sections"
"Show me docs in the features section"
"Find code examples for remote state"
"Show advanced hook examples"
```

### Example Responses — search_docs

**Search mode response:**
```json
{
  "query": "dependencies",
  "results": [
    {
      "title": "Dependencies",
      "url": "https://docs.terragrunt.com/...",
      "section": "features",
      "snippet": "...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalPages": 2,
    "totalItems": 12,
    "hasMore": true
  }
}
```

**List mode response:**
```json
{
  "sections": [
    {
      "name": "getting-started",
      "docCount": 5
    },
    {
      "name": "features", 
      "docCount": 15
    }
  ],
  "totalSections": 7
}
```

**Section mode response:**
```json
{
  "section": "features",
  "docs": [
    {
      "title": "Dependencies",
      "url": "https://...",
      "content": "...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalDocs": 15
}
```

**Examples mode response:**
```json
{
  "source": "advanced-examples",
  "examples": [
    {
      "topic": "before_hook",
      "code": "...",
      "description": "...",
      "useCases": ["..."]
    }
  ],
  "totalExamples": 21
}
```

---

## 2. function_reference

**Purpose**: Unified tool for Terragrunt built-in function documentation - get detailed function information OR list all available functions. The tool automatically detects which mode to use based on whether `function_name` is provided.

### Parameters — function_reference

#### Get Mode (when `function_name` provided)
- **`function_name`** (string, required): Function name to look up (e.g., `"path_relative_to_include"`, `"get_env"`)
- **`mode`** (string, optional): Detail level - `"summary"` or `"full"` (default: `"summary"`)
- **`include_examples`** (boolean, optional): Include code examples (default: `true`)

#### List Mode (when no `function_name`)
- **`category`** (string, optional): Filter by category (e.g., `"path"`, `"aws"`, `"environment"`)
- **`search`** (string, optional): Search in function names and descriptions
- **`page`** (number, optional): Page number for pagination (default: `1`)
- **`pageSize`** (number, optional): Results per page (default: `20`)

### Modes — function_reference

#### Get Mode
Retrieves detailed documentation for a specific function including signature, parameters, return type, description, and usage examples.

**Trigger**: Provide `function_name` parameter

**Returns**: Complete function metadata with:
- Function name and signature
- Parameter details (name, type, description)
- Return type
- Description and usage notes
- Code examples (when `include_examples=true`)
- Related functions

**Example Prompts**:
```text
"Show me documentation for path_relative_to_include"
"What parameters does get_env accept?"
"How do I use find_in_parent_folders?"
```

#### List Mode
Lists all available functions with filtering and search capabilities.

**Trigger**: Omit `function_name` parameter

**Returns**: Array of functions with:
- Function name and signature
- Category
- Short description
- Pagination metadata

**Example Prompts**:
```text
"List all AWS-related Terragrunt functions"
"What built-in functions are available?"
"Search for functions related to environment variables"
```

### Function Categories

- **path**: Path manipulation functions (`path_relative_to_include`, `path_relative_from_include`, etc.)
- **aws**: AWS-specific functions (`get_aws_account_id`, `get_aws_caller_identity_arn`, etc.)
- **environment**: Environment variable functions (`get_env`, `get_terraform_command`, etc.)
- **platform**: Platform detection (`get_platform`, `get_repo_root`, etc.)
- **file**: File operations (`read_terragrunt_config`, `find_in_parent_folders`, etc.)
- **terraform**: Terraform integration (`get_terraform_commands_that_need_vars`, etc.)

### Use Cases — function_reference

- **Get Mode**: Looking up specific function syntax, understanding parameters, finding usage examples
- **List Mode**: Discovering available functions, browsing by category, finding functions by keyword
- **Learning**: Understanding Terragrunt's built-in function ecosystem
- **Development**: Quick reference during terragrunt.hcl file authoring

### Example Response — function_reference (get mode)

```json
{
  "name": "path_relative_to_include",
  "signature": "path_relative_to_include() -> string",
  "category": "path",
  "description": "Returns the relative path between the current terragrunt.hcl file and the path specified in its include block.",
  "parameters": [],
  "returnType": "string",
  "examples": [
    {
      "code": "inputs = { deployment_id = path_relative_to_include() }",
      "description": "Returns relative path from include location to current file"
    }
  ],
  "relatedFunctions": ["path_relative_from_include", "find_in_parent_folders"]
}
```

**Full example usage**:
```hcl
terraform {
  source = "git::git@github.com:foo/modules.git//app?ref=v0.0.3"
}

include {
  path = find_in_parent_folders()
}

inputs = {
  deployment_id = path_relative_to_include()
}
```

### Example Response — function_reference (list mode)

```json
{
  "functions": [
    {
      "name": "get_env",
      "signature": "get_env(name, default) -> string",
      "category": "environment",
      "description": "Returns the value of the environment variable named by the key name. If no such environment variable exists, returns the default value."
    },
    {
      "name": "get_aws_account_id",
      "signature": "get_aws_account_id() -> string",
      "category": "aws",
      "description": "Returns the AWS account ID associated with the current set of credentials."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 3,
    "totalItems": 47,
    "hasMore": true
  }
}
```

---

## 3. cli_reference

**Purpose**: Unified tool for CLI command help and listing. Provide `command` parameter for specific help, or omit for listing mode with optional category/search filters.

### Parameters — cli_reference

- **`command`** (string, optional): Specific command for detailed help (e.g., "plan", "apply", "run", "hcl fmt", "browse")
- **`category`** (string, optional, list mode): Filter by category (`main`, `backend`, `stack`, `catalog`, `discovery`, `configuration`, `shortcut`)
- **`search`** (string, optional, list mode): Search query to filter commands
- **`page`** (number, optional, list mode): Page number for pagination (default: 1)
- **`pageSize`** (number, optional, list mode): Commands per page (default: 20)

### Modes

**Get Mode** (with `command`):
- Returns detailed help for specific command
- Includes options, examples, aliases, related commands
- Provides formatted markdown help

**List Mode** (without `command`):
- Lists all available commands
- Supports category filtering
- Supports search queries
- Includes pagination

### Removed Command Lookups

The tool accepts these removed names for migration help. Current Terragrunt does not execute them:

| Input | Resolves To |
|-------|-------------|
| `run-all` | `run` (with `--all` flag) |
| `hclfmt` | `hcl fmt` |
| `fmt` | `hcl fmt` |
| `hclvalidate` | `hcl validate` |
| `bootstrap` | `backend bootstrap` |
| `graph` | `dag graph` |

### Command Categories

| Category | Description | Example Commands |
|----------|-------------|------------------|
| `main` | Primary execution commands | `run`, `exec` |
| `shortcut` | Terraform command shortcuts | `plan`, `apply`, `destroy`, `init` |
| `configuration` | HCL and config tools | `hcl fmt`, `hcl validate`, `render`, `info print` |
| `backend` | State backend management | `backend bootstrap`, `backend delete`, `backend migrate` |
| `stack` | Multi-module operations | `stack run`, `stack output`, `stack clean` |
| `catalog` | Module catalogs | `catalog`, `scaffold` |
| `discovery` | Unit and stack discovery | `find`, `list`, `browse` |

### Use Cases — cli_reference

- Learning command syntax and options
- Understanding available flags and their defaults
- Finding practical usage examples
- Discovering available commands
- Understanding command organization
- Finding commands by category
- Searching for specific functionality

### Example Prompts — cli_reference

**Get Mode:**
```text
"How do I use the terragrunt plan command?"
"What options are available for terragrunt run with --all?"
"Show me help for the hcl fmt command"
"How do I validate Terragrunt inputs?"
```

**List Mode:**
```text
"List all Terragrunt CLI commands"
"What configuration commands are available?"
"Show me backend-related commands"
"Search for commands related to validation"
```

### Example Response — cli_reference (get mode)

```json
{
  "command": "plan",
  "aliases": [],
  "category": "shortcut",
  "description": "Shortcut for running terraform plan through Terragrunt.",
  "usage": "terragrunt plan [flags]",
  "details": "A convenience shortcut equivalent to 'terragrunt run -- plan'...",
  "options": [
    {
      "flag": "--all",
      "description": "Run plan on all modules in the stack",
      "type": "boolean",
      "defaultValue": "false"
    },
    {
      "flag": "-out",
      "description": "Save the plan to a file",
      "type": "path",
      "example": "-out=tfplan"
    }
  ],
  "examples": [
    {
      "description": "Run plan on current module",
      "command": "terragrunt plan"
    },
    {
      "description": "Plan all modules",
      "command": "terragrunt plan --all"
    }
  ],
  "relatedCommands": ["apply", "destroy", "run", "hcl validate"],
  "notes": [
    "Equivalent to: terragrunt run -- plan",
    "With --all, equivalent to: terragrunt run --all -- plan"
  ],
  "documentationUrl": "https://docs.terragrunt.com/reference/cli/",
  "formattedHelp": "# plan\n\nShortcut for running terraform plan..."
}
```

### Example Response — cli_reference (list mode)

```json
{
  "commands": [
    {
      "name": "plan",
      "aliases": [],
      "category": "shortcut",
      "description": "Shortcut for running terraform plan.",
      "usage": "terragrunt plan [flags]"
    },
    {
      "name": "run",
      "aliases": [],
      "legacyNames": ["run-all"],
      "category": "main",
      "description": "Execute a Terraform command through Terragrunt.",
      "usage": "terragrunt run [flags] -- <terraform command>"
    }
  ],
  "categories": [
    {
      "id": "main",
      "name": "Main Commands",
      "description": "Primary Terragrunt commands for executing Terraform operations",
      "commandCount": 2
    },
    {
      "id": "shortcut",
      "name": "Shortcut Commands",
      "description": "Convenience shortcuts for common Terraform commands",
      "commandCount": 8
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 23,
    "totalPages": 2
  }
}
```

### Example Response — cli_reference (filtered by category)

```json
{
  "category": "configuration",
  "commands": [
    {
      "name": "hcl fmt",
      "aliases": ["fmt"],
      "legacyNames": ["hclfmt"],
      "description": "Format Terragrunt HCL configuration files.",
      "usage": "terragrunt hcl fmt [flags] [path]"
    },
    {
      "name": "hcl validate",
      "aliases": [],
      "description": "Validate Terragrunt HCL, optionally checking configured inputs.",
      "usage": "terragrunt hcl validate --inputs [flags]"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 6,
    "totalPages": 1
  }
}
```

---

## 4. get_hcl_config_reference

**Purpose**: Get documentation for HCL configuration blocks, attributes, and functions used in `terragrunt.hcl`.

### Parameters — get_hcl_config_reference

- **`config`** (string, required): Config element name (e.g., "terraform", "remote_state", "dependency", "inputs")

### Use Cases — get_hcl_config_reference

- Writing terragrunt.hcl files
- Understanding configuration options
- Learning HCL syntax for Terragrunt
- Debugging configuration issues

### Example Prompts — get_hcl_config_reference

```text
"How do I configure the terraform block in terragrunt.hcl?"
"What options are available for remote_state?"
"Show me how to use the dependency block"
"What attributes can I use in the inputs block?"
```

### Example Response — get_hcl_config_reference

```json
{
  "config": "dependency",
  "results": [
    {
      "title": "Blocks",
      "url": "https://docs.terragrunt.com/reference/hcl/blocks/",
      "content": "The dependency block is used to...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalResults": 2
}
```

---

## 5. get_guidance

**Purpose**: Unified tool for getting best practices, comparing HCL blocks, and choosing between patterns. Intelligently routes based on query content or explicit type hints.

### Parameters — get_guidance

- **`query`** (string, optional): Topic, comparison, or scenario to get guidance on
- **`type`** (string, optional): Guidance type - `"best-practices"`, `"comparison"`, or `"pattern"`
- **`mode`** (string, optional): Detail level - `"summary"` or `"full"` (default: `"summary"`)
- **`level`** (string, optional): Experience level filter - `"beginner"`, `"intermediate"`, or `"advanced"`
- **`listAll`** (boolean, optional): List all available guidance topics (default: `false`)

### Use Cases — get_guidance

- Learning best practices for specific topics
- Comparing different approaches (e.g., dependency vs dependencies)
- Understanding patterns and antipatterns
- Getting experience-appropriate recommendations

### Example Prompts — get_guidance

```text
"What are best practices for state management?"
"Compare dependency vs dependencies blocks"
"Show me module organization patterns"
"What should I avoid when setting up CI/CD?"
```

---

## 6. build_config

**Purpose**: Unified tool for generating OR writing OR generating+writing Terragrunt configurations. Supports three operational modes with intelligent routing based on provided parameters.

### Parameters — build_config

- **`useCase`** (string, required): Configuration type to generate:
  - `"remote_state"` - Remote state backend configuration (S3, Azure Blob, GCS)
  - `"provider_generation"` - Provider block generation (AWS, Azure, GCP)
  - `"dependencies"` - Module dependency configuration
  - `"hooks"` - Before/after hooks for automation
  - `"inputs"` - Input variables configuration
  - `"cicd"` - CI/CD-ready Terragrunt config (non-interactive runs, plan output, optional auto-approve)
- **`backend`** (string, optional): Backend type for `remote_state` use case:
  - `"s3"` - AWS S3 with native lockfile locking
  - `"azurerm"` - Azure Blob Storage with Azure AD
  - `"gcs"` - Google Cloud Storage
  - For the `cicd` use case, `backend` selects the platform: `"github-actions"`, `"gitlab"`, or `"azure-devops"`
- **`options`** (object, optional): Configuration options (varies by use case):
  - **For S3**: `bucket`, `key`, `region`, `use_lockfile`, `dynamodb_table`, `encrypt`. Native `use_lockfile` locking is enabled for new configurations when neither locking option is specified. Deprecated `dynamodb_table` remains available for migration and clients that do not support S3 lockfiles.
  - **For Azure**: `storage_account_name`, `container_name`, `key`, `resource_group_name`
  - **For GCS**: `bucket`, `prefix`, `project`, `credentials`
  - **For hooks**: `name`, `commands`, `execute`, `working_dir`, `run_on_error`
  - **For dependencies**: `name`, `config_path`, `mock_outputs_allowed`
  - **For inputs**: `environment`, `region`, or custom key-value pairs
  - **For providers**: `path`, `if_exists`, `region`, `account_id`

### Operational Modes — build_config

#### Generate-Only Mode
Generates configuration and returns it without writing to disk. Useful for:
- Previewing configurations before saving
- Learning HCL syntax and structure
- Getting configuration templates for manual editing
- CI/CD pipelines that need to inspect configs

#### Write-Only Mode  
Writes provided HCL content to disk. Useful for:
- Saving manually edited configurations
- Writing configs from external sources
- Batch file operations
- Automated configuration deployment

#### Generate+Write Mode
Generates and writes in one operation. Useful for:
- Quick project setup and scaffolding
- Automated environment provisioning
- Ensuring consistent patterns across teams
- One-command configuration deployment

### Use Cases — build_config

- Quick project setup and scaffolding (Generate+Write)
- Learning Terragrunt HCL syntax (Generate-Only)
- Implementing best practice configurations (All modes)
- Starting new Terragrunt modules (Generate+Write)
- Saving generated or modified configs (Write-Only)
- Automating configuration updates (All modes)

### Example Prompts — build_config

```text
# Generate-Only
"Generate a terragrunt config for S3 remote state in us-east-1"
"Show me how to configure GCS remote state"
"Create a before hook to run terraform fmt"

# Write-Only  
"Write this configuration to /home/user/terraform/terragrunt.hcl"
"Save this HCL to my project directory"

# Generate+Write
"Generate and save an S3 backend config to ./terragrunt.hcl"
"Create an Azure backend configuration and write it to my project"
```

### Example Response — build_config (generate mode)

```json
{
  "config": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket       = \"my-terraform-state\"\n    key          = \"${path_relative_to_include()}/terraform.tfstate\"\n    region       = \"us-east-1\"\n    encrypt      = true\n    use_lockfile = true\n  }\n}",
  "explanation": "This configuration sets up AWS S3 as your remote state backend with S3 native lockfile locking. The state file will be stored in the 'my-terraform-state' bucket in us-east-1, with encryption enabled.",
  "nextSteps": [
    "Create the S3 bucket: aws s3 mb s3://my-terraform-state",
    "Add this configuration to your root terragrunt.hcl",
    "Run terragrunt init to initialize the backend"
  ],
  "relatedDocs": [
    {
      "title": "Remote State",
      "url": "https://docs.terragrunt.com/features/units/state-backend/",
      "section": "features"
    }
  ],
  "additionalOptions": [
    "Add kms_key_id for server-side encryption with AWS KMS",
    "Configure skip_bucket_versioning to disable versioning",
    "Add skip_bucket_accesslogging to disable access logging"
  ]
}
```

### Available Templates — build_config

The tool provides **12 templates** covering **6 use cases**:

| Use Case | Templates | Cloud Providers |
|----------|-----------|-----------------|
| remote_state | 3 templates | AWS S3, Azure Blob, GCP GCS |
| provider_generation | 1 template | AWS |
| dependencies | 1 template | Multi-cloud |
| hooks | 2 templates | Multi-cloud (before_hook, after_hook) |
| inputs | 1 template | Multi-cloud |
| cicd | 3 templates | GitHub Actions, GitLab CI, Azure DevOps |

<!-- Note: The "configuration" template (Terraform version constraints) is included as part of the "inputs" use case. -->

### Security Features — build_config (write mode)

File writing includes comprehensive security validation:

- **Path traversal prevention**: Detects and blocks `../` patterns
- **Directory whitelisting**: Only writes to explicitly allowed directories
- **File size limits**: Configurable maximum file size (default: 1MB)
- **Overwrite protection**: Requires explicit permission to overwrite files
- **Automatic backups**: Creates timestamped backups before overwriting

### Configuration — build_config (write mode)

Control file writing behavior with environment variables:

```bash
# Enable/disable file writing (default: false for security)
export TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true

# Comma-separated list of allowed directories
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user/terraform,/home/user/projects"

# Automatic backup creation (default: true)
export TERRAGRUNT_MCP_AUTO_BACKUP=true

# Maximum file size in bytes (default: 1048576 = 1MB)
export TERRAGRUNT_MCP_MAX_FILE_SIZE=1048576
```

**Important**: File writing is **disabled by default** for security. You must explicitly enable it and configure allowed directories.

### Example Usage — build_config (generate+write mode)

Single command to generate and write configuration:

```json
{
  "tool": "build_config",
  "arguments": {
    "useCase": "remote_state",
    "backend": "s3",
    "options": {
      "bucket": "my-terraform-state",
      "region": "us-east-1",
      "key": "terraform.tfstate",
      "use_lockfile": true
    },
    "write": true,
    "path": "/home/user/terraform/terragrunt.hcl"
  }
}
```

Or write-only with existing content:

```json
{
  "tool": "build_config",
  "arguments": {
    "content": "remote_state {\n  backend = \"s3\"\n  ...\n}",
    "path": "/home/user/terraform/terragrunt.hcl",
    "overwrite": false,
    "createBackup": true
  }
}
```

### Example Response — build_config (write mode)

#### Success

```json
{
  "success": true,
  "path": "/home/user/terraform/terragrunt.hcl",
  "bytesWritten": 245,
  "created": true,
  "backedUp": false,
  "message": "File created successfully"
}
```

#### Overwrite with backup

```json
{
  "success": true,
  "path": "/home/user/terraform/terragrunt.hcl",
  "bytesWritten": 245,
  "created": false,
  "backedUp": true,
  "backupPath": "/home/user/terraform/terragrunt.hcl.backup.2025-10-30T12-34-56-789Z",
  "message": "File updated successfully (backup created)"
}
```

#### Error (security rejection)

```json
{
  "success": false,
  "path": "/etc/passwd",
  "bytesWritten": 0,
  "created": false,
  "backedUp": false,
  "error": "Path is outside allowed directories: /etc/passwd",
  "errorType": "OUTSIDE_ALLOWED_DIRECTORIES"
}
```

### Error Types — build_config (write mode)

| Error Type | Description | Solution |
|------------|-------------|----------|
| `FILE_WRITING_DISABLED` | File writing not enabled | Set `TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true` |
| `OUTSIDE_ALLOWED_DIRECTORIES` | Path not in whitelist | Add directory to `TERRAGRUNT_MCP_ALLOWED_DIRS` |
| `PATH_TRAVERSAL_DETECTED` | Malicious path detected | Use absolute paths without `../` |
| `FILE_EXISTS_NO_OVERWRITE` | File exists, overwrite disabled | Set `overwrite: true` in arguments |
| `PERMISSION_DENIED` | No write permission | Check file/directory permissions |
| `MAX_SIZE_EXCEEDED` | File too large | Increase `TERRAGRUNT_MCP_MAX_FILE_SIZE` |

### Best Practices — build_config

1. **Generate-only mode**: Use for previewing and learning before committing to disk
2. **Always use absolute paths** when writing files
3. **Enable backups** when overwriting important files (`createBackup: true`)
4. **Test with non-critical directories** first
5. **Review security settings** before enabling file writing in production
6. **Keep allowed directories minimal** for security
7. **Use generate+write mode** for streamlined workflows
8. **Check error messages** for detailed troubleshooting

See [File Writing Guide](File-Writing-Guide.md) for detailed security configuration and examples.

---

## 7. diagnose_terragrunt_error

**Purpose**: Diagnose Terragrunt error messages and get actionable solutions, debugging steps, and relevant documentation links.

### Parameters — diagnose_terragrunt_error

- **`error_message`** (string, required): The error message from Terragrunt to diagnose
- **`context`** (object, optional): Additional context about the error
  - `command` (string): The terragrunt command that was run
  - `version` (string): Terragrunt version if known
  - `os` (string): Operating system (linux, darwin, windows)
  - `filePath` (string): Path to the terragrunt.hcl file
  - `module` (string): Module name if applicable
  - `backend` (string): Backend type (s3, gcs, azurerm, etc.)
- **`options`** (object, optional): Diagnosis options
  - `maxMatches` (number): Maximum matches to return (default: 3)
  - `minConfidence` (number): Minimum confidence score 0-1 (default: 0.3)
  - `enableFuzzyMatching` (boolean): Enable fuzzy matching (default: true)
  - `enrichWithDocs` (boolean): Enrich with documentation-sourced solutions (default: false)
  - `includeDestructiveCommands` (boolean): Include destructive commands in solutions (default: true)

### Use Cases — diagnose_terragrunt_error

- Troubleshooting Terragrunt errors
- Getting actionable solutions for common problems
- Finding relevant documentation for specific errors
- Understanding what went wrong and how to fix it

### Example Prompts — diagnose_terragrunt_error

```text
"I'm getting this error: Error acquiring the state lock"
"Help me fix: Backend configuration changed since last init"
"What does this error mean: No Terraform files found"
"Diagnose this terragrunt error and tell me how to fix it"
```

### Example Response — diagnose_terragrunt_error (Basic)

```json
{
  "success": true,
  "overallConfidence": 0.95,
  "matchCount": 1,
  "matches": [
    {
      "patternId": "backend-config-changed",
      "patternName": "Backend Configuration Changed",
      "category": "backend",
      "confidence": 0.95,
      "description": "Backend configuration has changed since last init",
      "likelyCause": "Backend bucket, region, or key was modified",
      "solutions": [
        {
          "step": 1,
          "command": "terragrunt init -reconfigure",
          "explanation": "Reinitialize with new backend configuration"
        }
      ],
      "documentationRefs": ["https://docs.terragrunt.com/..."]
    }
  ],
  "debuggingSteps": [
    "Run with --inputs-debug to emit input debugging information",
    "Check terragrunt.hcl syntax and inputs with terragrunt hcl validate --inputs"
  ],
  "relatedErrors": ["State Lock Error", "Backend Access Denied"],
  "generalAdvice": [
    "Check your terragrunt.hcl configuration for syntax errors",
    "Verify all required inputs are provided"
  ]
}
```

### Example Response — diagnose_terragrunt_error (Enriched)

When `enrichWithDocs: true`, you get additional documentation-sourced solutions:

```json
{
  "success": true,
  "overallConfidence": 0.95,
  "matchCount": 1,
  "enrichmentSuccessful": true,
  "matches": [...],
  "richSolutions": [
    {
      "step": "Step 1: Reinitialize with new backend configuration",
      "command": "terragrunt init -reconfigure",
      "explanation": "Forces Terraform to reconfigure backend without migrating state",
      "warnings": ["This will reinitialize the backend without migrating state"],
      "safetyLevel": "caution",
      "source": "pattern"
    },
    {
      "step": "Verify backend configuration",
      "command": "terragrunt terragrunt-info",
      "explanation": "Shows current backend configuration from documentation",
      "warnings": [],
      "safetyLevel": "safe",
      "source": "documentation"
    }
  ],
  "orderedDebuggingSteps": [
    {
      "order": 1,
      "action": "Verify backend configuration in terragrunt.hcl",
      "explanation": "Check remote_state block settings"
    },
    {
      "order": 2,
      "action": "Ensure backend storage exists and is accessible",
      "verificationCommand": "aws s3 ls s3://your-bucket",
      "explanation": "S3 bucket must exist and be accessible"
    }
  ],
  "documentationLinks": [
    {
      "url": "https://docs.terragrunt.com/reference/hcl/blocks/#remote_state",
      "title": "Remote State Configuration",
      "excerpt": "Configure your backend with the remote_state block...",
      "relevanceScore": 0.9
    }
  ],
  "relatedErrorDetails": [
    {
      "errorId": "state-lock-error",
      "name": "State Lock Error",
      "category": "state",
      "reason": "Related to backend/state operations",
      "similarityScore": 0.7
    }
  ]
}
```

### Solution Safety Levels

- **`safe`**: Command is read-only or has no side effects
- **`caution`**: Command modifies state or infrastructure
- **`destructive`**: Command may cause data loss or destroy resources

---

## Tool Selection Guide

### Choose the right tool for your needs

**"I don't know where to start..."**
→ Use `get_terragrunt_sections` to browse categories

**"I'm looking for information about X..."**
→ Use `search_terragrunt_docs` with your topic

**"I want to learn everything about X feature..."**
→ Use `get_section_docs` after finding the right section

**"How do I use command X?"**
→ Use `get_cli_command_help` with the command name

**"How do I configure X in terragrunt.hcl?"**
→ Use `get_hcl_config_reference` with the config element

**"Show me an example of X..."**
→ Use `get_code_examples` with the topic

**"What's the signature of function X?"**
→ Use `get_terragrunt_function` with the function name

**"What built-in functions are available?"**
→ Use `list_terragrunt_functions` optionally with a category filter

**"I need to generate a configuration quickly..."**
→ Use `generate_terragrunt_config` with your use case and options

**"How do I set up remote state/dependencies/hooks?"**
→ Use `generate_terragrunt_config` to get a complete working example

**"Save the generated configuration to a file..."**
→ Use `write_terragrunt_config` after generating (remember to enable file writing first)

**"I want to create a new terragrunt.hcl file..."**
→ First use `generate_terragrunt_config`, then `write_terragrunt_config` to save it

**"What are the best practices for X?"**
→ Use `get_guidance` with your topic (auto-routes to best practices)

**"How should I organize my modules/manage state/handle dependencies?"**
→ Use `get_guidance` to learn recommended patterns and what to avoid

**"What's the difference between dependency and dependencies?"**
→ Use `get_guidance` with "dependency vs dependencies" (auto-routes to comparison)

**"When should I use include vs multiple includes?"**
→ Use `get_guidance` for block comparisons or architectural patterns

**"How should I manage dependencies between modules?"**
→ Use `get_guidance` to see different approaches with pros/cons (auto-routes to patterns)

**"I'm getting an error, what should I do?"**
→ Use `diagnose_terragrunt_error` to analyze the error and get solutions

**"Help me troubleshoot this Terragrunt error..."**
→ Use `diagnose_terragrunt_error` with `enrichWithDocs: true` for comprehensive solutions

---

## Tips for Best Results

1. **Be specific but not too narrow**: "dependencies" works better than "dependency block configuration syntax"
2. **Try multiple tools**: If one doesn't give you what you need, try another approach
3. **Use natural language**: The tools understand questions like "How do I..."
4. **Start broad, then narrow**: Use search first, then dive deeper with specific tools
5. **Check multiple sources**: Code examples + CLI help + config reference = complete understanding
6. **For errors, provide context**: Include the full error message and relevant context for better diagnosis

---

## 8. get_server_metrics

**Purpose**: Get server performance metrics and usage statistics for monitoring and observability.

### Parameters — get_server_metrics

- **`filter`** (string, optional): Filter pattern to match specific metrics
- **`format`** (string, optional): Output format - `"json"` or `"text"` (default: `"json"`)
- **`reset`** (boolean, optional): Reset metrics after retrieval (default: `false`)

### Use Cases — get_server_metrics

- Monitoring server performance
- Analyzing tool usage patterns
- Debugging performance issues
- Tracking response times and sizes
- Understanding which tools are most used

### Example Prompts — get_server_metrics

```text
"Show me server metrics"
"What tools are being used the most?"
"Get performance statistics"
"Show metrics in text format"
```

### Example Response — get_server_metrics

```json
{
  "uptime": "2h 34m 18s",
  "totalCalls": 156,
  "tools": {
    "search_docs": {
      "calls": 45,
      "avgResponseTime": "125ms",
      "avgBytes": 2456,
      "minBytes": 512,
      "maxBytes": 8192
    },
    "function_reference": {
      "calls": 32,
      "avgResponseTime": "85ms",
      "avgBytes": 1234,
      "minBytes": 256,
      "maxBytes": 4096
    }
  },
  "cacheHitRate": "87.5%",
  "errors": 3
}
```

---

## Next Steps

- [Quick Start Tutorial](Quick-Start-Tutorial) - Practice using these tools
- [Examples and Use Cases](Examples-and-Use-Cases) - Real-world scenarios
- [FAQ](FAQ) - Common questions about using the tools

