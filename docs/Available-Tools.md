# Available Tools

The Terragrunt MCP Server provides a set of specialized tools for accessing and searching Terragrunt documentation, generating configurations, analyzing best practices, diagnosing errors, comparing blocks, and writing files. Each tool is designed for specific use cases to help you find the information you need quickly.

## Tool Overview

| Tool | Purpose | Best For |
|------|---------|----------|
| `search_docs` | Unified documentation search | All doc-related tasks (search, browse, sections, examples) |
| `get_terragrunt_function` | Get a single function | Looking up a specific built-in function |
| `list_terragrunt_functions` | List functions | Browsing available built-in functions |
| `cli_reference` | CLI command reference | Command help, listing, and browsing by category |
| `get_hcl_config_reference` | HCL config reference | Writing terragrunt.hcl files |
| `generate_terragrunt_config` | Configuration generator | Quick setup and best practices |
| `write_terragrunt_config` | Write configs to disk | Saving generated configurations |
| `analyze_best_practices` | Analyze practices by topic | Learning best practices and patterns |
| `diagnose_terragrunt_error` | Error diagnosis | Troubleshooting Terragrunt errors |
| `compare_hcl_blocks` | Block comparison | Understanding differences between similar blocks |
| `get_pattern_guidance` | Pattern guidance | Choosing between configuration patterns |

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
      "url": "https://terragrunt.gruntwork.io/docs/...",
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

## 2. get_terragrunt_function

## 3. cli_reference

**Purpose**: Unified tool for CLI command help and listing. Provide `command` parameter for specific help, or omit for listing mode with optional category/search filters.

### Parameters — cli_reference

- **`command`** (string, optional): Specific command for detailed help (e.g., "plan", "apply", "run-all", "hcl fmt")
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

### Supported Aliases

The tool automatically resolves common aliases:

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
| `configuration` | HCL and config tools | `hcl fmt`, `hcl validate`, `render`, `validate-inputs` |
| `backend` | State backend management | `backend bootstrap`, `backend delete`, `backend migrate` |
| `stack` | Multi-module operations | `stack run`, `stack output`, `stack clean` |
| `catalog` | Module catalogs | `catalog`, `scaffold` |
| `discovery` | Module discovery | `find`, `list` |

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
"Show me help for the hclfmt command"
"Explain the terragrunt validate-inputs command"
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
  "relatedCommands": ["apply", "destroy", "run", "validate-inputs"],
  "notes": ["Equivalent to: terragrunt run -- plan"],
  "documentationUrl": "https://terragrunt.gruntwork.io/docs/reference/cli/",
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
      "aliases": ["run-all"],
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
      "aliases": ["hclfmt", "fmt"],
      "description": "Format Terragrunt HCL configuration files.",
      "usage": "terragrunt hcl fmt [flags] [path]"
    },
    {
      "name": "validate-inputs",
      "aliases": [],
      "description": "Validate that all required inputs are provided and match expected types.",
      "usage": "terragrunt validate-inputs [flags]"
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
      "url": "https://terragrunt.gruntwork.io/docs/reference/hcl/blocks/",
      "content": "The dependency block is used to...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalResults": 2
}
```

---

## 6. generate_terragrunt_config

**Purpose**: Generate complete `terragrunt.hcl` configurations from battle-tested templates based on your use case and cloud provider.

### Parameters — generate_terragrunt_config

- **`useCase`** (string, required): Configuration type to generate:
  - `"remote_state"` - Remote state backend configuration (S3, Azure Blob, GCS)
  - `"provider_generation"` - Provider block generation (AWS, Azure, GCP)
  - `"dependencies"` - Module dependency configuration
  - `"hooks"` - Before/after hooks for automation
  - `"inputs"` - Input variables configuration
- **`backend`** (string, optional): Backend type for `remote_state` use case:
  - `"s3"` - AWS S3 with DynamoDB locking
  - `"azurerm"` - Azure Blob Storage with Azure AD
  - `"gcs"` - Google Cloud Storage
- **`options`** (object, optional): Configuration options (varies by use case):
  - **For S3**: `bucket`, `key`, `region`, `dynamodb_table`, `encrypt`
  - **For Azure**: `storage_account_name`, `container_name`, `key`, `resource_group_name`
  - **For GCS**: `bucket`, `prefix`, `project`, `credentials`
  - **For hooks**: `name`, `commands`, `execute`, `working_dir`, `run_on_error`
  - **For dependencies**: `name`, `config_path`, `mock_outputs_allowed`
  - **For inputs**: `environment`, `region`, or custom key-value pairs
  - **For providers**: `path`, `if_exists`, `region`, `account_id`

### Use Cases — generate_terragrunt_config

- Quick project setup and scaffolding
- Learning Terragrunt HCL syntax
- Implementing best practice configurations
- Starting new Terragrunt modules
- Ensuring consistent configuration patterns across teams
- Discovering available configuration options

### Example Prompts — generate_terragrunt_config

```text
"Generate a terragrunt config for S3 remote state in us-east-1"
"Create an Azure backend configuration for my terraform state"
"Show me how to configure GCS remote state with my project ID"
"Generate a before hook to run terraform fmt"
"Create a dependency configuration for my VPC module"
"Show me an inputs configuration for production environment"
"Generate an AWS provider block with account validation"
```

### Example Response — generate_terragrunt_config

```json
{
  "config": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket         = \"my-terraform-state\"\n    key            = \"${path_relative_to_include()}/terraform.tfstate\"\n    region         = \"us-east-1\"\n    encrypt        = true\n    dynamodb_table = \"terraform-locks\"\n  }\n}",
  "explanation": "This configuration sets up AWS S3 as your remote state backend with DynamoDB for state locking. The state file will be stored in the 'my-terraform-state' bucket in us-east-1, with encryption enabled and state locking via the 'terraform-locks' DynamoDB table.",
  "nextSteps": [
    "Create the S3 bucket: aws s3 mb s3://my-terraform-state",
    "Create the DynamoDB table: aws dynamodb create-table --table-name terraform-locks ...",
    "Add this configuration to your root terragrunt.hcl",
    "Run terragrunt init to initialize the backend"
  ],
  "relatedDocs": [
    {
      "title": "Remote State",
      "url": "https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/",
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

### Available Templates — generate_terragrunt_config

The tool provides **9 templates** covering **5 use cases**:

| Use Case | Templates | Cloud Providers |
|----------|-----------|-----------------|
| remote_state | 3 templates | AWS S3, Azure Blob, GCP GCS |
| provider_generation | 1 template | AWS |
| dependencies | 1 template | Multi-cloud |
| hooks | 2 templates | Multi-cloud (before_hook, after_hook) |
| inputs | 1 template | Multi-cloud |

<!-- Note: The "configuration" template (Terraform version constraints) is included as part of the "inputs" use case. -->

---

## 7. write_terragrunt_config

**Purpose**: Write generated Terragrunt configurations to disk with security validation and backup support.

### Parameters — write_terragrunt_config

- **`content`** (string, required): The HCL configuration content to write
- **`path`** (string, required): Absolute or relative path where the file should be written
- **`overwrite`** (boolean, optional): Allow overwriting existing files (default: `false`)
- **`createBackup`** (boolean, optional): Create timestamped backup before overwriting (default: `true`)
- **`createParentDirs`** (boolean, optional): Create parent directories if they don't exist (default: `true`)

### Security Features — write_terragrunt_config

The tool includes comprehensive security validation:

- **Path traversal prevention**: Detects and blocks `../` patterns
- **Directory whitelisting**: Only writes to explicitly allowed directories
- **File size limits**: Configurable maximum file size (default: 1MB)
- **Overwrite protection**: Requires explicit permission to overwrite files
- **Automatic backups**: Creates timestamped backups before overwriting

### Configuration — write_terragrunt_config

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

### Use Cases — write_terragrunt_config

- Saving generated configurations to disk
- Creating new terragrunt.hcl files
- Updating existing configurations with backups
- Setting up multi-environment structures

### Example Prompts — write_terragrunt_config

```text
"Write the configuration to terragrunt.hcl"
"Save this to /home/user/terraform/dev/terragrunt.hcl"
"Create a new file at ./env/prod/terragrunt.hcl with this config"
"Update the existing file and create a backup"
```

### Example Usage — write_terragrunt_config

#### Step 1: Generate configuration

```json
{
  "tool": "generate_terragrunt_config",
  "arguments": {
    "useCase": "remote_state",
    "backend": "s3",
    "options": {
      "bucket": "my-terraform-state",
      "region": "us-east-1",
      "key": "terraform.tfstate",
      "dynamodb_table": "terraform-locks"
    }
  }
}
```

#### Step 2: Write to disk

```json
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "path": "/home/user/terraform/terragrunt.hcl",
    "content": "remote_state {\n  backend = \"s3\"\n  ...\n}",
    "overwrite": false,
    "createBackup": true
  }
}
```

### Example Response — write_terragrunt_config

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

### Error Types — write_terragrunt_config

| Error Type | Description | Solution |
|------------|-------------|----------|
| `FILE_WRITING_DISABLED` | File writing not enabled | Set `TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true` |
| `OUTSIDE_ALLOWED_DIRECTORIES` | Path not in whitelist | Add directory to `TERRAGRUNT_MCP_ALLOWED_DIRS` |
| `PATH_TRAVERSAL_DETECTED` | Malicious path detected | Use absolute paths without `../` |
| `FILE_EXISTS_NO_OVERWRITE` | File exists, overwrite disabled | Set `overwrite: true` in arguments |
| `PERMISSION_DENIED` | No write permission | Check file/directory permissions |
| `MAX_SIZE_EXCEEDED` | File too large | Increase `TERRAGRUNT_MCP_MAX_FILE_SIZE` |

### Best Practices — write_terragrunt_config

1. **Always use absolute paths** or paths relative to workspace root
2. **Enable backups** when overwriting important files
3. **Test with non-critical directories** first
4. **Review security settings** before enabling in production
5. **Keep allowed directories minimal** for security
6. **Check error messages** for detailed troubleshooting

See [File Writing Guide](File-Writing-Guide.md) for detailed security configuration and examples.

---

## 8. analyze_best_practices

**Purpose**: Analyze and retrieve best practices for specific Terragrunt topics with experience-level filtering. Extracts patterns, recommendations, antipatterns, and real-world examples from documentation.

### Parameters — analyze_best_practices

- **`topic`** (string, required): Topic to analyze. One of:
  - `module_organization` - Module structure and organization patterns
  - `state_management` - Remote state configuration and best practices
  - `dependencies` - Managing dependencies between modules
  - `ci_cd` - CI/CD integration patterns and workflows
  - `security` - Security considerations and best practices
  - `performance` - Performance optimization techniques
  - `testing` - Testing strategies and patterns
- **`level`** (string, optional): Filter by experience level
  - `beginner` - Basic practices for getting started
  - `intermediate` - Standard practices for production use
  - `advanced` - Complex patterns for enterprise scenarios

### Use Cases — analyze_best_practices

- Learning recommended patterns for a specific topic
- Understanding what to avoid (antipatterns)
- Finding trade-offs and considerations
- Getting experience-appropriate recommendations
- Discovering real-world examples
- Identifying common pitfalls

### Example Prompts — analyze_best_practices

```text
"What are the best practices for state management?"
"Show me beginner-level module organization practices"
"Analyze CI/CD best practices for Terragrunt"
"What are advanced dependency management patterns?"
"What should I avoid when configuring remote state?"
```

### Example Usage — analyze_best_practices

```json
{
  "tool": "analyze_best_practices",
  "arguments": {
    "topic": "state_management",
    "level": "beginner"
  }
}
```

### Example Response — analyze_best_practices

```json
{
  "topic": "state_management",
  "recommendations": [
    {
      "practice": "Always use remote state for production environments",
      "priority": "critical",
      "experienceLevel": "beginner",
      "category": "state_management",
      "rationale": "Remote state ensures your infrastructure state is safely backed up and can be shared across teams",
      "examples": ["remote_state {\n  backend = \"s3\"\n  ..."],
      "antipatterns": ["Don't use local state for multi-user environments"],
      "tradeoffs": ["Centralized state may increase latency"],
      "relatedDocs": ["https://terragrunt.gruntwork.io/docs/..."]
    }
  ],
  "summary": "Best practices for state_management include using remote state backends, enabling encryption and versioning, and implementing state locking to prevent concurrent modifications...",
  "commonPitfalls": [
    "Storing sensitive data directly in state files",
    "Not configuring state locking for multi-user environments"
  ],
  "experienceNotes": {
    "beginner": ["Start with S3 backend and basic encryption"],
    "intermediate": ["Implement state locking with DynamoDB"],
    "advanced": ["Consider state backend optimization for enterprise scale"]
  },
  "realWorldExamples": [
    "S3 backend with encryption and versioning enabled",
    "State locking configuration to prevent concurrent modifications"
  ]
}
```

### Best Practices — analyze_best_practices

1. **Start with your experience level** - Filter to get appropriate recommendations
2. **Review antipatterns first** - Learn what NOT to do
3. **Check trade-offs** - Understand the implications of each practice
4. **Use with other tools** - Combine with `get_code_examples` for implementation details
5. **Apply iteratively** - Start with beginner practices and progress
6. **Cross-reference examples** - Verify practices with real code samples



<!-- Note: The "configuration" template (Terraform version constraints) is included as part of the "inputs" use case. -->
---

## 9. diagnose_terragrunt_error

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
      "documentationRefs": ["https://terragrunt.gruntwork.io/docs/..."]
    }
  ],
  "debuggingSteps": [
    "Run with --terragrunt-debug flag for verbose output",
    "Check terragrunt.hcl syntax with terragrunt validate-inputs"
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
      "url": "https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state",
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
→ Use `analyze_best_practices` with your topic to get recommendations and patterns

**"How should I organize my modules/manage state/handle dependencies?"**
→ Use `analyze_best_practices` to learn recommended patterns and what to avoid

**"I'm getting an error, what should I do?"**
→ Use `diagnose_terragrunt_error` to analyze the error and get solutions

**"Help me troubleshoot this Terragrunt error..."**
→ Use `diagnose_terragrunt_error` with `enrichWithDocs: true` for comprehensive solutions

**"What's the difference between dependency and dependencies?"**
→ Use `compare_hcl_blocks` to see a detailed comparison with use cases

**"When should I use include vs multiple includes?"**
→ Use `compare_hcl_blocks` for block-level differences or `get_pattern_guidance` for architectural patterns

**"How should I manage dependencies between modules?"**
→ Use `get_pattern_guidance` to see different approaches with pros/cons and examples

---

## 10. compare_hcl_blocks

**Purpose**: Compare two similar HCL blocks and explain their differences, use cases, and when to use each. Supports natural language queries like "dependency vs dependencies" and uses fuzzy matching for typo tolerance.

### Parameters — compare_hcl_blocks

- **`block1`** (string, optional): First block name or comparison query (e.g., "dependency" or "dependency vs dependencies")
- **`block2`** (string, optional): Second block name (optional if block1 contains both)
- **`listComparisons`** (boolean, optional): List all available comparisons

### Available Comparisons

| Comparison | Summary |
|------------|---------|
| `dependency` vs `dependencies` | Single dependency with output access vs. bulk ordering without outputs |
| `include` vs `multiple includes` | Single parent inheritance vs. composable configuration from multiple sources |
| `inputs` vs `locals` | Values passed to Terraform vs. internal Terragrunt values |
| `generate` vs `terraform.source` | Creating .tf files vs. specifying module source |
| `before_hook` vs `after_hook` | Commands before Terraform vs. commands after |
| `remote_state` vs `dependency` | Where to store state vs. how to read other module outputs |

### Use Cases — compare_hcl_blocks

- Understanding subtle differences between similar constructs
- Deciding which block to use for your use case
- Learning about common mistakes with each block
- Getting syntax examples for both options

### Example Prompts — compare_hcl_blocks

```text
"What's the difference between dependency and dependencies?"
"Compare inputs vs locals in Terragrunt"
"When should I use generate vs terraform.source?"
"Explain before_hook versus after_hook"
```

### Example Response — compare_hcl_blocks

```json
{
  "found": true,
  "comparison": {
    "id": "dependency-vs-dependencies",
    "blocks": ["dependency", "dependencies"],
    "summary": "dependency defines a single module dependency with output access; dependencies lists modules that must run first without output access.",
    "block1": {
      "name": "dependency",
      "purpose": "Declare a dependency on another Terragrunt module and access its outputs",
      "syntax": "dependency \"vpc\" {\n  config_path = \"../vpc\"\n  ...\n}",
      "keyFeatures": [
        "Access outputs from dependent module",
        "Supports mock_outputs for planning",
        "Each dependency block has a unique name"
      ]
    },
    "block2": {
      "name": "dependencies",
      "purpose": "Declare execution order dependencies without needing output access",
      "syntax": "dependencies {\n  paths = [\"../vpc\", \"../sg\"]\n}",
      "keyFeatures": [
        "Simple list of paths that must be applied first",
        "No access to outputs from listed modules",
        "Lightweight - no state file reading required"
      ]
    },
    "keyDifferences": [
      {
        "aspect": "Output Access",
        "block1": "Full access to dependent module outputs",
        "block2": "No output access - ordering only"
      }
    ],
    "whenToUse": {
      "useBlock1When": ["You need to pass outputs from one module to another"],
      "useBlock2When": ["You only need to ensure modules run in a specific order"]
    },
    "commonMistakes": [
      "Using dependencies when you actually need output values"
    ],
    "relatedDocs": ["https://terragrunt.gruntwork.io/docs/..."]
  }
}
```

---

## 11. get_pattern_guidance

**Purpose**: Get guidance on choosing between Terragrunt configuration patterns for common scenarios. Returns decision criteria, pattern options with pros/cons, and code examples.

### Parameters — get_pattern_guidance

- **`scenario`** (string, optional): The scenario to get guidance for (e.g., "managing dependencies", "configuration inheritance")
- **`listPatterns`** (boolean, optional): List all available pattern guidance topics

### Available Pattern Topics

| Scenario | Question Answered |
|----------|-------------------|
| Module Dependency Management | How should I manage dependencies between my Terragrunt modules? |
| Configuration Inheritance | How should I structure configuration inheritance in my project? |
| Backend State Management | How should I configure my Terraform backend in Terragrunt? |

### Use Cases — get_pattern_guidance

- Making architectural decisions about project structure
- Choosing between different approaches for common problems
- Understanding trade-offs between patterns
- Getting working examples for your chosen pattern

### Example Prompts — get_pattern_guidance

```text
"How should I manage dependencies between modules?"
"What's the best way to handle configuration inheritance?"
"How do I configure state management in Terragrunt?"
"Help me choose a pattern for my multi-environment setup"
```

### Example Response — get_pattern_guidance

```json
{
  "found": true,
  "guidance": {
    "id": "module-dependency-management",
    "scenario": "Managing dependencies between Terraform modules",
    "question": "How should I manage dependencies between my Terragrunt modules?",
    "decisionCriteria": [
      {
        "criterion": "You need to pass output values from one module to another",
        "recommendation": "Use dependency blocks",
        "reason": "dependency blocks expose .outputs for accessing values like VPC IDs"
      },
      {
        "criterion": "You only need modules to run in a specific order, no data passing",
        "recommendation": "Use dependencies block",
        "reason": "dependencies is lighter weight - no state reading, just ordering"
      }
    ],
    "patterns": [
      {
        "name": "Explicit Output Dependencies",
        "description": "Use named dependency blocks for each module whose outputs you need",
        "example": "dependency \"vpc\" {\n  config_path = \"../vpc\"\n  mock_outputs = { vpc_id = \"mock\" }\n}",
        "pros": ["Clear, explicit data flow", "Supports mock values"],
        "cons": ["Reads state files (slower)", "Must maintain mock_outputs"]
      }
    ],
    "relatedComparisons": ["dependency vs dependencies"]
  }
}
```

---

## Tips for Best Results

1. **Be specific but not too narrow**: "dependencies" works better than "dependency block configuration syntax"
2. **Try multiple tools**: If one doesn't give you what you need, try another approach
3. **Use natural language**: The tools understand questions like "How do I..."
4. **Start broad, then narrow**: Use search first, then dive deeper with specific tools
5. **Check multiple sources**: Code examples + CLI help + config reference = complete understanding
6. **For errors, provide context**: Include the full error message and relevant context for better diagnosis

---

## Next Steps

- [Quick Start Tutorial](Quick-Start-Tutorial) - Practice using these tools
- [Examples and Use Cases](Examples-and-Use-Cases) - Real-world scenarios
- [FAQ](FAQ) - Common questions about using the tools

