# Configuration Generator Guide

The Terragrunt Configuration Generator (`generate_terragrunt_config` tool) helps you quickly create complete, production-ready `terragrunt.hcl` configurations based on battle-tested templates.

## Overview

The generator provides **12 templates** covering **5 use cases** across multiple cloud providers:

- **Remote State Management**: AWS S3, Azure Blob Storage, Google Cloud Storage (Essential + Advanced tiers)
- **Provider Generation**: AWS provider blocks with account validation
- **Dependencies**: Module dependency configurations with mock outputs
- **Hooks**: Before/after hooks for automation and validation
- **Inputs**: Variable configuration for Terraform modules
- **Version Constraints**: Terraform version requirements

### Template Tiers

Backend templates are available in two tiers:

| Tier | Description | Use Case |
|------|-------------|----------|
| **Essential** | Core required options (4-5 vars) | Quick setup, development |
| **Advanced** | Extended enterprise options (9-12 vars) | Production, cross-account, KMS encryption |

See [Advanced Backend Templates](Advanced-Backend-Templates.md) for detailed documentation on advanced templates.

## Quick Start

### Basic Usage

To generate a configuration, specify the use case and optionally provide backend type and options:

```text
Generate a terragrunt config for S3 remote state in us-east-1
```

The tool will return:

- **config**: Complete HCL configuration ready to use
- **explanation**: Human-readable description
- **nextSteps**: Suggested actions to take next
- **relatedDocs**: Links to relevant Terragrunt documentation
- **additionalOptions**: Other configuration options you might want

## Use Cases

### 1. Remote State Management

Configure backend storage for your Terraform state with locking and encryption.

#### AWS S3 Backend

**Example prompt:**

```text
Generate S3 remote state config with bucket my-terraform-state in us-west-2
```

**Parameters:**

```json
{
  "useCase": "remote_state",
  "backend": "s3",
  "options": {
    "bucket": "my-terraform-state",
    "key": "${path_relative_to_include()}/terraform.tfstate",
    "region": "us-west-2",
    "use_lockfile": true,
    "encrypt": true
  }
}
```

**Generated config:**

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    use_lockfile   = true
  }
}
```

**Required AWS resources:**

- S3 bucket for state storage
- Permissions to read, write, and delete the `<key>.tflock` object

For migration from deprecated DynamoDB locking, temporarily provide both `use_lockfile: true` and `dynamodb_table: "terraform-locks"`. Remove `dynamodb_table` after all clients have migrated. Clients without S3 lockfile support can set `use_lockfile: false` and continue providing `dynamodb_table`, but DynamoDB locking is not recommended for new configurations.

#### Azure Blob Storage Backend

**Example prompt:**

```text
Create Azure blob storage backend for my terraform state
```

**Parameters:**

```json
{
  "useCase": "remote_state",
  "backend": "azurerm",
  "options": {
    "storage_account_name": "mytfstate",
    "container_name": "tfstate",
    "key": "terraform.tfstate",
    "resource_group_name": "terraform-state-rg"
  }
}
```

**Generated config:**

```hcl
remote_state {
  backend = "azurerm"
  config = {
    storage_account_name = "mytfstate"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
    resource_group_name  = "terraform-state-rg"
    use_azuread_auth     = true
  }
}
```

**Required Azure resources:**

- Storage Account with blob container
- Resource Group
- Proper Azure AD permissions

#### Google Cloud Storage Backend

**Example prompt:**

```text
Generate GCS remote state config for project my-gcp-project
```

**Parameters:**

```json
{
  "useCase": "remote_state",
  "backend": "gcs",
  "options": {
    "bucket": "my-terraform-state",
    "prefix": "terraform/state",
    "project": "my-gcp-project"
  }
}
```

**Generated config:**

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket  = "my-terraform-state"
    prefix  = "terraform/state"
    project = "my-gcp-project"
  }
}
```

**Required GCP resources:**

- GCS bucket for state storage
- Project with appropriate permissions

### 2. Provider Generation

Generate provider blocks with account/subscription validation.

#### AWS Provider

**Example prompt:**

```text
Generate AWS provider block for account 123456789012 in us-east-1
```

**Parameters:**

```json
{
  "useCase": "provider_generation",
  "options": {
    "path": "provider.tf",
    "region": "us-east-1",
    "account_id": "123456789012"
  }
}
```

**Generated config:**

```hcl
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  allowed_account_ids = ["123456789012"]
}
EOF
}
```

**Benefits:**

- Prevents accidental deployment to wrong AWS account
- Consistent provider configuration across modules
- Automatic provider file generation

### 3. Dependencies

Configure dependencies between Terragrunt modules to access outputs.

**Example prompt:**

```text
Create a dependency configuration for my VPC module
```

**Parameters:**

```json
{
  "useCase": "dependencies",
  "options": {
    "name": "vpc",
    "config_path": "../vpc",
    "mock_outputs_allowed": "true"
  }
}
```

**Generated config:**

```hcl
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    # Add mock outputs here
  }
}
```

**Usage in your config:**

```hcl
inputs = {
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.private_subnet_ids
}
```

**Mock outputs** allow you to run `plan` and `validate` without the dependency being applied.

### 4. Hooks

Execute commands before or after Terragrunt operations for automation and validation.

#### Before Hooks

**Example prompt:**

```text
Generate a before hook to run terraform fmt
```

**Parameters:**

```json
{
  "useCase": "hooks",
  "options": {
    "name": "fmt",
    "commands": "apply,plan",
    "execute": "terraform fmt -check"
  }
}
```

**Generated config:**

```hcl
terraform {
  before_hook "fmt" {
    commands = ["apply", "plan"]
    execute  = ["terraform", "fmt", "-check"]
  }
}
```

**Common use cases:**

- Format checking before apply
- Validation before deployment
- Security scanning
- Policy checks

#### After Hooks

**Example prompt:**

```text
Create an after hook to notify on deployment completion
```

**Parameters:**

```json
{
  "useCase": "hooks",
  "options": {
    "name": "notify",
    "commands": "apply",
    "execute": "echo Deployment complete",
    "run_on_error": "true"
  }
}
```

**Generated config:**

```hcl
terraform {
  after_hook "notify" {
    commands     = ["apply"]
    execute      = ["echo", "Deployment complete"]
    run_on_error = true
  }
}
```

**Common use cases:**

- Notifications on completion/failure
- Cleanup operations
- Post-deployment validation
- Logging and auditing

### 5. Inputs

Configure input variables to pass to your Terraform modules.

**Example prompt:**

```text
Create inputs configuration for production environment
```

**Parameters:**

```json
{
  "useCase": "inputs",
  "options": {
    "environment": "production",
    "region": "us-east-1"
  }
}
```

**Generated config:**

```hcl
inputs = {
  environment = "production"
  region      = "us-east-1"
  # Add more inputs as needed
}
```

**Best practices:**

- Use consistent naming across environments
- Keep environment-specific values in separate files
- Leverage Terragrunt's built-in functions for dynamic values

## Available Templates

### Complete Template List

| Template ID | Use Case | Cloud Provider | Tier | Description |
|-------------|----------|----------------|------|-------------|
| `aws-s3-backend` | remote_state | AWS | Essential | S3 + DynamoDB state backend (5 vars) |
| `aws-s3-backend-advanced` | remote_state | AWS | Advanced | S3 with KMS, cross-account, custom endpoints (12 vars) |
| `azure-blob-backend` | remote_state | Azure | Essential | Azure Blob Storage with AD auth (5 vars) |
| `azure-blob-backend-advanced` | remote_state | Azure | Advanced | Azure Blob with MSI, SAS, snapshot support (12 vars) |
| `gcp-gcs-backend` | remote_state | GCP | Essential | Google Cloud Storage backend (4 vars) |
| `gcp-gcs-backend-advanced` | remote_state | GCP | Advanced | GCS with KMS, impersonation, custom endpoints (9 vars) |
| `aws-generate-provider` | provider_generation | AWS | - | AWS provider with account validation |
| `dependency-single` | dependencies | Multi-cloud | - | Single module dependency |
| `before-hook` | hooks | Multi-cloud | - | Execute commands before operations |
| `after-hook` | hooks | Multi-cloud | - | Execute commands after operations |
| `inputs-basic` | inputs | Multi-cloud | - | Basic input variables |
| `terraform-version` | configuration | Multi-cloud | - | Terraform version constraints |

> 💡 **Tip**: For advanced backend features like KMS encryption, cross-account access, or managed identity authentication, see [Advanced Backend Templates](Advanced-Backend-Templates.md).

## Common Scenarios

### Scenario 1: New Project Setup

Setting up a new Terragrunt project with S3 remote state:

1. **Generate remote state configuration:**

   ```text
   Generate S3 remote state config with bucket my-company-terraform-state in us-east-1
   ```

2. **Generate AWS provider:**

   ```text
   Generate AWS provider for account 123456789012 in us-east-1
   ```

3. **Add validation hook:**

   ```text
   Create a before hook to run terraform validate
   ```

### Scenario 2: Multi-Environment Setup

Configure different environments (dev, staging, prod) with shared VPC:

1. **In root `terragrunt.hcl` (shared):**

   ```text
   Generate S3 remote state config for my-terraform-state
   ```

2. **In VPC module:**

   ```text
   Generate inputs for production environment in us-east-1
   ```

3. **In app modules:**

   ```text
   Create dependency on VPC module at ../vpc
   ```

### Scenario 3: Migration from Local to Remote State

Migrating existing local state to S3:

1. **Generate S3 backend config:**

   ```text
   Generate S3 remote state with bucket my-tf-state in us-west-2
   ```

2. **Follow generated next steps** to create AWS resources

3. **Run `terragrunt init -migrate-state`** to move state to S3

## Troubleshooting

### Missing Required Variables

**Error:** "Missing required variables: bucket, region"

**Solution:** Provide all required options for your use case:

```json
{
  "useCase": "remote_state",
  "backend": "s3",
  "options": {
    "bucket": "my-bucket",
    "key": "terraform.tfstate",
    "region": "us-east-1",
    "use_lockfile": true
  }
}
```

### Unsupported Backend

**Error:** "Unknown backend type: local"

**Solution:** Use a supported backend type: `s3`, `azurerm`, or `gcs`

### Template Not Found

**Error:** "No template found for use case"

**Solution:** Check the use case name is one of:

- `remote_state`
- `provider_generation`
- `dependencies`
- `hooks`
- `inputs`

## Best Practices

### 1. Use DRY Principles

Generate common configurations once in root `terragrunt.hcl` and include them in child modules:

```hcl
# root terragrunt.hcl
# ... generated remote_state config ...
# ... generated provider config ...
```

```hcl
# child module
include "root" {
  path = find_in_parent_folders()
}
```

### 2. Enable State Locking

Always use DynamoDB (S3) or native locking (Azure/GCS) to prevent concurrent modifications:

```text
Generate S3 remote state with DynamoDB locking
```

### 3. Enable Encryption

Enable encryption at rest for sensitive state data:

```json
{
  "useCase": "remote_state",
  "backend": "s3",
  "options": {
    "encrypt": "true"
  }
}
```

### 4. Use Mock Outputs

Configure mock outputs for dependencies to enable `plan` without applying dependencies:

```text
Create dependency with mock outputs enabled
```

### 5. Add Validation Hooks

Use before hooks to validate configuration before apply:

```text
Generate before hook for terraform validate and fmt
```

### 6. Document Your Configurations

Use the generated `explanation` and `relatedDocs` to document your setup in your README.

## Next Steps

- **[Available Tools](Available-Tools.md)** - Explore all 9 tools
- **[Examples](Examples-and-Use-Cases.md)** - More real-world examples
- **[FAQ](FAQ.md)** - Common questions
- **[Terragrunt Documentation](https://docs.terragrunt.com/)** - Official docs

## Related Documentation

- [Remote State Configuration](https://docs.terragrunt.com/features/units/state-backend/)
- [Dependencies](https://docs.terragrunt.com/features/stacks/stack-operations#dependencies-between-units)
- [Hooks](https://docs.terragrunt.com/features/units/hooks/)
- [Generate Blocks](https://docs.terragrunt.com/features/units/extra-arguments/)
