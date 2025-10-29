# Terragrunt Built-in Functions Reference

## Overview

Terragrunt provides 23+ built-in functions that extend Terraform's functionality with features specifically designed for multi-environment infrastructure management. These functions help you work with paths, environment variables, dependencies, cloud provider metadata, and more.

**Access these functions via the MCP server:**

- Use `@terragrunt get_terragrunt_function --function_name "function_name"` to get detailed documentation
- Use `@terragrunt list_terragrunt_functions` to browse all available functions
- Use `@terragrunt list_terragrunt_functions --category "category_name"` to filter by category

## Function Categories

Terragrunt built-in functions are organized into eight categories:

| Category | Count | Purpose |
|----------|-------|---------|
| **Path** | ~5 | File path manipulation and resolution |
| **Environment** | ~2 | Environment variable access |
| **Terraform** | ~3 | Terraform workspace and output access |
| **File** | ~4 | File system operations and content reading |
| **Dependency** | ~2 | Dependency block and output access |
| **AWS** | ~3 | AWS-specific metadata (region, account, etc.) |
| **GCP** | ~2 | GCP-specific metadata (project, region) |
| **Utility** | ~2 | Helper functions (sops decryption, etc.) |

## How to Use This Reference

### Quick Lookup

If you know the function name, ask the MCP server directly:

```text
@terragrunt get_terragrunt_function --function_name "path_relative_to_include"
```

### Browse by Category

To see all functions in a specific category:

```text
@terragrunt list_terragrunt_functions --category "path"
@terragrunt list_terragrunt_functions --category "aws"
@terragrunt list_terragrunt_functions --category "environment"
```

### Search by Keyword

To find functions related to a specific topic:

```text
@terragrunt list_terragrunt_functions --search "environment"
@terragrunt list_terragrunt_functions --search "output"
@terragrunt list_terragrunt_functions --search "dependency"
```

## Common Functions

### Path Functions

Functions for working with file paths and resolving relative paths in Terragrunt configurations.

**Key Functions:**

- `path_relative_to_include()` - Get path relative to parent terragrunt.hcl
- `path_relative_from_include()` - Get path from parent to current module
- `find_in_parent_folders()` - Find a file in parent directories
- `get_terragrunt_dir()` - Get directory containing terragrunt.hcl
- `get_parent_terragrunt_dir()` - Get directory of parent terragrunt.hcl

**Example Use Case:**

```hcl
# Reference a shared file in parent directory
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Get path relative to root
locals {
  relative_path = path_relative_to_include()
}
```

### Environment Functions

Functions for accessing environment variables with defaults and validation.

**Key Functions:**

- `get_env(name, default)` - Get environment variable with optional default
- `get_aws_account_id()` - Get AWS account ID from environment/credentials

**Example Use Case:**

```hcl
locals {
  environment = get_env("ENVIRONMENT", "dev")
  aws_region  = get_env("AWS_REGION", "us-east-1")
}
```

### Terraform Functions

Functions for accessing Terraform workspace information and outputs.

**Key Functions:**

- `get_terraform_commands_that_need_vars()` - Get commands requiring variable files
- `get_terraform_commands_that_need_input()` - Get commands requiring user input
- `get_terraform_commands_that_need_locking()` - Get commands requiring state locking

**Example Use Case:**

```hcl
terraform {
  extra_arguments "common_vars" {
    commands = get_terraform_commands_that_need_vars()
    arguments = ["-var-file=common.tfvars"]
  }
}
```

### Dependency Functions

Functions for accessing outputs from Terragrunt dependencies.

**Key Functions:**

- `dependency.<NAME>.outputs.<OUTPUT>` - Access dependency outputs
- `read_terragrunt_config(path)` - Read another terragrunt.hcl file

**Example Use Case:**

```hcl
dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.private_subnet_ids
}
```

### AWS Functions

Functions for getting AWS-specific metadata.

**Key Functions:**

- `get_aws_account_id()` - Get AWS account ID
- `get_aws_caller_identity_arn()` - Get caller identity ARN
- `get_aws_caller_identity_user_id()` - Get caller user ID

**Example Use Case:**

```hcl
locals {
  account_id = get_aws_account_id()
}

remote_state {
  backend = "s3"
  config = {
    bucket = "terraform-state-${local.account_id}"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = "us-east-1"
  }
}
```

### GCP Functions

Functions for getting Google Cloud Platform metadata.

**Key Functions:**

- `get_gcp_project()` - Get GCP project ID
- `get_gcp_region()` - Get GCP region

**Example Use Case:**

```hcl
locals {
  project_id = get_gcp_project()
  region     = get_gcp_region()
}

remote_state {
  backend = "gcs"
  config = {
    bucket = "terraform-state-${local.project_id}"
    prefix = "${path_relative_to_include()}"
  }
}
```

### File Functions

Functions for reading file contents and working with the file system.

**Key Functions:**

- `read_tfvars_file(path)` - Read and parse .tfvars file
- `find_in_parent_folders(name, fallback)` - Find file in parent directories
- `get_platform()` - Get current OS platform
- `get_repo_root()` - Get repository root directory

**Example Use Case:**

```hcl
# Load common variables from parent
locals {
  common_vars = read_tfvars_file(find_in_parent_folders("common.tfvars"))
  environment = local.common_vars["environment"]
}
```

### Utility Functions

Helper functions for various tasks.

**Key Functions:**

- `sops_decrypt_file(path)` - Decrypt SOPS-encrypted file
- `run_cmd(args...)` - Run shell command and capture output

**Example Use Case:**

```hcl
# Load encrypted secrets
locals {
  secrets = yamldecode(sops_decrypt_file("secrets.enc.yaml"))
}

inputs = {
  db_password = local.secrets.database.password
}
```

## Function Naming Conventions

Terragrunt functions follow these naming patterns:

- `get_*` - Retrieve information (environment, AWS metadata, etc.)
- `path_*` - Path manipulation and resolution
- `read_*` - Read file contents
- `find_*` - Search for files or directories
- `*_commands_*` - Lists of Terraform commands for specific purposes

## Best Practices

### 1. Use Functions for Dynamic Configuration

Functions make your Terragrunt configuration more flexible and environment-aware:

```hcl
# Good: Dynamic based on environment
locals {
  env = get_env("ENVIRONMENT", "dev")
  account_id = get_aws_account_id()
}

# Avoid: Hardcoded values
locals {
  env = "dev"
  account_id = "123456789012"
}
```

### 2. Provide Defaults for Environment Variables

Always provide sensible defaults when using `get_env()`:

```hcl
# Good: Has fallback
locals {
  region = get_env("AWS_REGION", "us-east-1")
}

# Risky: No default (fails if not set)
locals {
  region = get_env("AWS_REGION")
}
```

### 3. Cache Function Results in Locals

If you use a function multiple times, cache the result:

```hcl
# Good: Calculate once
locals {
  account_id = get_aws_account_id()
}

remote_state {
  config = {
    bucket = "state-${local.account_id}"
    # ... more config using local.account_id
  }
}

# Avoid: Multiple calls
remote_state {
  config = {
    bucket = "state-${get_aws_account_id()}"
    dynamodb_table = "locks-${get_aws_account_id()}"
  }
}
```

### 4. Use path_relative_to_include() for State Keys

This ensures each module has a unique state file:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket = "terraform-state-${get_aws_account_id()}"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = get_env("AWS_REGION", "us-east-1")
  }
}
```

### 5. Combine Functions for Powerful Patterns

```hcl
# Find and read parent configuration
locals {
  parent_config = read_terragrunt_config(find_in_parent_folders("terragrunt.hcl"))
  common_vars   = read_tfvars_file(find_in_parent_folders("common.tfvars"))
  
  # Merge with local overrides
  environment   = get_env("ENVIRONMENT", local.common_vars.environment)
}
```

## Additional Resources

- **Official Terragrunt Functions Documentation**: <https://terragrunt.gruntwork.io/docs/reference/built-in-functions/>
- **Use the MCP Server**: Ask `@terragrunt` for real-time function documentation
- **Example Patterns**: See [Available Tools](./Available-Tools.md) for more usage examples

## Getting Help

### Via MCP Server

The fastest way to get help with functions:

```text
# Get detailed function documentation
@terragrunt get_terragrunt_function --function_name "function_name"

# See all functions in a category
@terragrunt list_terragrunt_functions --category "path"

# Search for relevant functions
@terragrunt list_terragrunt_functions --search "environment"
```

### Via Terragrunt Documentation

Search the official documentation:

```text
@terragrunt search_terragrunt_docs --query "built-in functions"
```

### Common Issues

#### Q: Function not found error

- Verify the function name spelling
- Check if you're using the correct Terragrunt version
- Use `list_terragrunt_functions` to see all available functions

#### Q: Environment variable not set

- Always provide a default value with `get_env(name, default)`
- Or set the variable before running Terragrunt: `export VAR_NAME=value`

#### Q: Path resolution issues

- Use `get_terragrunt_dir()` to understand current working directory
- Use `find_in_parent_folders()` instead of relative paths
- Test with `terragrunt render` to see resolved paths

---

*This reference is automatically updated from the live Terragrunt documentation.
For the most current information, use the MCP server tools or visit the
official Terragrunt documentation.*
