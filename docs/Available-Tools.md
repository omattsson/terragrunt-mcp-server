# Available Tools

The Terragrunt MCP Server provides **12 specialized tools** for accessing and searching Terragrunt documentation, generating configurations, analyzing best practices, diagnosing errors, and writing files. Each tool is designed for specific use cases to help you find the information you need quickly.

## Tool Overview

| Tool | Purpose | Best For |
|------|---------|----------|
| `search_terragrunt_docs` | General search | Broad topic exploration |
| `get_terragrunt_function` | Get a single function | Looking up a specific built-in function |
| `list_terragrunt_functions` | List functions | Browsing available built-in functions |
| `get_terragrunt_sections` | List sections | Understanding doc structure |
| `get_section_docs` | Section retrieval | Deep diving into topics |
| `get_cli_command_help` | CLI command help | Command syntax and options |
| `get_hcl_config_reference` | HCL config reference | Writing terragrunt.hcl files |
| `get_code_examples` | Find code snippets | Learning by example |
| `generate_terragrunt_config` | Configuration generator | Quick setup and best practices |
| `write_terragrunt_config` | Write configs to disk | Saving generated configurations |
| `analyze_best_practices` | Analyze practices by topic | Learning best practices and patterns |
| `diagnose_terragrunt_error` | Error diagnosis | Troubleshooting Terragrunt errors |

---

## 1. search_terragrunt_docs

**Purpose**: Search across all Terragrunt documentation for specific topics, commands, or concepts.

### Parameters — search_terragrunt_docs

- **`query`** (string, required): Search query text
- **`limit`** (number, optional): Maximum results (default: 5, max: 20)

### Use Cases — search_terragrunt_docs

- General questions about Terragrunt
- Broad topic exploration
- Discovering documentation you didn't know existed
- Finding all mentions of a specific concept

### Example Prompts — search_terragrunt_docs

```text
"Search for Terragrunt documentation about dependencies"
"Find information about remote state"
"What does Terragrunt say about generate blocks?"
"Search for documentation on mocking"
```

### Example Response — search_terragrunt_docs

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
  "total": 12,
  "hasMore": true
}
```

---

## 2. get_terragrunt_sections

**Purpose**: Get a complete list of all available documentation sections with document counts.

### Parameters — get_terragrunt_sections

None required.

### Use Cases — get_terragrunt_sections

- Understanding the documentation structure
- Browsing by category
- Finding the right section for deep exploration
- Getting an overview of available topics

### Example Prompts — get_terragrunt_sections

```text
"What documentation sections are available?"
"List all Terragrunt documentation categories"
"Show me the structure of Terragrunt docs"
```

### Example Response — get_terragrunt_sections

```json
{
  "sections": [
    {
      "name": "getting-started",
      "documentCount": 4
    },
    {
      "name": "reference",
      "documentCount": 36
    },
    {
      "name": "features",
      "documentCount": 18
    }
  ]
}
```

---

## 3. get_section_docs

**Purpose**: Get all documentation pages from a specific section for comprehensive reading.

### Parameters — get_section_docs

- **`section`** (string, required): Section name (e.g., "getting-started", "reference", "features")

### Use Cases — get_section_docs

- Deep diving into a specific topic area
- Reading documentation sequentially
- Understanding a complete feature set
- Comprehensive learning

### Example Prompts — get_section_docs

```text
"Show me all getting-started documentation"
"Get all reference documentation"
"What's in the features section?"
"Retrieve all CLI reference docs"
```

### Example Response — get_section_docs

```json
{
  "section": "getting-started",
  "docs": [
    {
      "title": "Quick Start",
      "url": "https://terragrunt.gruntwork.io/docs/getting-started/quick-start/",
      "content": "...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalDocs": 4
}
```

---

## 4. get_cli_command_help

**Purpose**: Get detailed help documentation for specific Terragrunt CLI commands.

### Parameters — get_cli_command_help

- **`command`** (string, required): Command name (e.g., "plan", "apply", "run-all", "hclfmt")

### Use Cases — get_cli_command_help

- Learning command syntax
- Understanding command options and flags
- CLI troubleshooting
- Discovering command capabilities

### Example Prompts — get_cli_command_help

```text
"How do I use the terragrunt plan command?"
"What options are available for terragrunt run-all?"
"Show me help for the hclfmt command"
"Explain the terragrunt render command"
```

### Example Response — get_cli_command_help

```json
{
  "command": "render",
  "title": "render",
  "url": "https://terragrunt.gruntwork.io/docs/reference/cli/commands/render/",
  "content": "Generate a simplified version of the Terragrunt configuration with all includes and dependencies resolved...",
  "lastUpdated": "2025-10-23"
}
```

---

## 5. get_hcl_config_reference

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

## 6. get_code_examples

**Purpose**: Find code examples and snippets related to specific Terragrunt topics or patterns.

### Parameters — get_code_examples

- **`topic`** (string, required): Topic or pattern (e.g., "remote state", "dependencies", "before hooks")
- **`limit`** (number, optional): Max documents to return (default: 5, max: 10)

### Use Cases — get_code_examples

- Learning by example
- Finding implementation patterns
- Quick reference for syntax
- Copying working code snippets

### Example Prompts — get_code_examples

```text
"Show me examples of using dependencies in Terragrunt"
"Find code snippets for remote state configuration"
"What are some examples of before_hook usage?"
"Show me how to use generate blocks with examples"
```

### Example Response — get_code_examples

```json
{
  "topic": "dependency",
  "examples": [
    {
      "documentTitle": "Quick Start",
      "documentUrl": "https://terragrunt.gruntwork.io/docs/getting-started/quick-start/",
      "section": "getting-started",
      "codeSnippets": [
        "dependency \"vpc\" { config_path = \"../vpc\" }",
        "inputs = { subnet_id = dependency.vpc.outputs.subnet_id }"
      ],
      "snippetCount": 5
    }
  ],
  "totalDocuments": 3,
  "hasMore": false
}
```

---

## 7. get_terragrunt_function

**Purpose**: Retrieve a specific Terragrunt built-in function by name.

### Parameters — get_terragrunt_function

- **`name`** (string, required): Function name (e.g., "get_env", "find_in_parent_folders")

### Example Prompts — get_terragrunt_function

```text
"Show Terragrunt function get_env"
"Lookup the find_in_parent_folders function"
```

### Example Response — get_terragrunt_function

```json
{
  "name": "get_env",
  "signature": "get_env(name, default) -> string",
  "description": "",
  "parameters": [
    { "name": "name", "type": "string", "required": true, "description": "" },
    { "name": "default", "type": "string", "required": true, "description": "" }
  ],
  "returnType": "string",
  "category": "functions",
  "examples": [],
  "relatedFunctions": []
}
```

---

## 8. list_terragrunt_functions

**Purpose**: List Terragrunt built-in functions, optionally filtered by category.

### Parameters — list_terragrunt_functions

- **`category`** (string, optional): Category filter (e.g., "filesystem", "env")
- **`limit`** (number, optional): Maximum results (default: 50, max: 200)

### Example Prompts — list_terragrunt_functions

```text
"List Terragrunt functions"
"List functions in the env category"
```

### Example Response — list_terragrunt_functions

```json
{
  "total": 42,
  "hasMore": false,
  "functions": [
    { "name": "get_env", "signature": "get_env(name, default) -> string", "category": "functions", "description": "", "returnType": "string" }
  ]
}
```

---

## 9. generate_terragrunt_config

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

## 10. write_terragrunt_config

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

## 11. analyze_best_practices

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

## 12. diagnose_terragrunt_error

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

