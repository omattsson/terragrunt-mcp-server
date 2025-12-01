# Advanced Backend Templates Guide

This guide covers the advanced remote state backend templates available in the Terragrunt MCP Server. These templates provide comprehensive configuration options for enterprise-grade infrastructure management.

## Overview

The Terragrunt MCP Server uses a **tiered template system** for backend configurations:

| Tier | Description | Variables | Use Case |
|------|-------------|-----------|----------|
| **Essential** | Core required options | 4-5 | Quick setup, development environments |
| **Advanced** | Extended enterprise options | 9-12 | Production, cross-account, encryption |
| **Complete** | All available options | 20-40+ | Full customization (future) |

### When to Use Advanced Templates

Choose **Advanced** templates when you need:

- 🔐 **KMS/CMK Encryption** - Customer-managed encryption keys
- 🔄 **Cross-Account Access** - IAM role assumption or service account impersonation
- 🏢 **Enterprise Authentication** - Azure AD, Managed Identity, Service Principals
- 🌐 **Custom Endpoints** - LocalStack, MinIO, private endpoints, emulators
- 📍 **Data Residency** - Specific storage locations for compliance
- 📸 **Snapshot Support** - Point-in-time recovery capabilities

## Template Selection

Use the `generate_terragrunt_config` tool with the appropriate backend type:

```
# Essential template (default)
Generate S3 remote state config for bucket my-state

# Advanced template
Generate S3 remote state config with advanced options for cross-account access
```

Or specify explicitly via the API:

```json
{
  "useCase": "remote_state",
  "backend": "s3",           // Uses aws-s3-backend (essential)
  "options": { ... }
}

{
  "useCase": "remote_state", 
  "backend": "s3-advanced",  // Uses aws-s3-backend-advanced
  "options": { ... }
}
```

---

## AWS S3 Advanced Backend

The `aws-s3-backend-advanced` template provides 12 configuration variables for enterprise S3 state management.

### Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `bucket` | string | ✅ | S3 bucket name for Terraform state |
| `key` | string | ✅ | Path to state file within bucket |
| `region` | string | ✅ | AWS region for S3 bucket |
| `dynamodb_table` | string | ❌ | DynamoDB table for state locking |
| `encrypt` | boolean | ❌ | Enable encryption at rest |
| `kms_key_id` | string | ❌ | KMS key ARN for server-side encryption |
| `role_arn` | string | ❌ | IAM role ARN for cross-account access |
| `session_name` | string | ❌ | Session name for assumed role |
| `profile` | string | ❌ | AWS CLI profile name for authentication |
| `endpoint` | string | ❌ | Custom S3 endpoint URL (LocalStack/MinIO) |
| `workspace_key_prefix` | string | ❌ | Prefix for workspace-specific state files |
| `skip_credentials_validation` | boolean | ❌ | Skip AWS credentials validation |

### Use Cases

#### Cross-Account State Access

Store state in a centralized account while deploying to multiple workload accounts:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "central-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    role_arn       = "arn:aws:iam::123456789012:role/TerraformStateRole"
    session_name   = "terragrunt-deploy"
  }
}
```

#### KMS Encryption with Customer-Managed Keys

Use a customer-managed KMS key for state encryption:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
  }
}
```

#### Local Development with LocalStack

Test infrastructure locally using LocalStack:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket                      = "local-terraform-state"
    key                         = "${path_relative_to_include()}/terraform.tfstate"
    region                      = "us-east-1"
    endpoint                    = "http://localhost:4566"
    skip_credentials_validation = true
  }
}
```

#### Terraform Workspaces Support

Organize state files by workspace:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket               = "my-terraform-state"
    key                  = "terraform.tfstate"
    region               = "us-east-1"
    encrypt              = true
    dynamodb_table       = "terraform-locks"
    workspace_key_prefix = "workspaces"
  }
}
```

---

## Azure Blob Storage Advanced Backend

The `azure-blob-backend-advanced` template provides 12 configuration variables with multiple authentication methods.

### Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `resource_group_name` | string | ✅ | Resource group containing storage account |
| `storage_account_name` | string | ✅ | Storage account name |
| `container_name` | string | ✅ | Blob container name |
| `key` | string | ✅ | Path to state file within container |
| `subscription_id` | string | ❌ | Azure subscription ID |
| `tenant_id` | string | ❌ | Azure AD tenant ID for authentication |
| `client_id` | string | ❌ | Service principal client ID |
| `client_secret` | string | ❌ | Service principal client secret (sensitive) |
| `use_msi` | boolean | ❌ | Use Managed Service Identity |
| `sas_token` | string | ❌ | Storage SAS token (sensitive) |
| `snapshot` | boolean | ❌ | Enable snapshot support |
| `use_azuread_auth` | boolean | ❌ | Use Azure AD instead of access keys |

### Authentication Methods

The Azure advanced template supports multiple authentication patterns:

| Method | Variables Required | Best For |
|--------|-------------------|----------|
| **Azure AD** | `use_azuread_auth=true` | Modern authentication, RBAC |
| **Service Principal** | `tenant_id`, `client_id`, `client_secret` | CI/CD pipelines |
| **Managed Identity** | `use_msi=true` | Azure VMs, AKS, App Service |
| **SAS Token** | `sas_token` | Limited access, time-bound |
| **Access Keys** | (default) | Development, simple setups |

### Use Cases

#### Azure AD Authentication (Recommended)

Use Azure AD with RBAC for secure, auditable access:

```hcl
remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatestorage"
    container_name       = "tfstate"
    key                  = "${path_relative_to_include("site")}/terraform.tfstate"
    subscription_id      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    tenant_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    use_azuread_auth     = true
  }
}
```

#### Service Principal for CI/CD

Authenticate using a service principal in automation pipelines:

```hcl
remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatestorage"
    container_name       = "tfstate"
    key                  = "${path_relative_to_include("site")}/terraform.tfstate"
    tenant_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    client_id            = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    client_secret        = "your-client-secret"  # Use environment variable
  }
}
```

#### Managed Identity on Azure Resources

Use MSI when running from Azure VMs or AKS:

```hcl
remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatestorage"
    container_name       = "tfstate"
    key                  = "${path_relative_to_include("site")}/terraform.tfstate"
    use_msi              = true
  }
}
```

#### Snapshot Support for Recovery

Enable snapshots for point-in-time recovery:

```hcl
remote_state {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatestorage"
    container_name       = "tfstate"
    key                  = "${path_relative_to_include("site")}/terraform.tfstate"
    use_azuread_auth     = true
    snapshot             = true
  }
}
```

---

## GCP GCS Advanced Backend

The `gcp-gcs-backend-advanced` template provides 9 configuration variables for enterprise GCS state management.

### Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `bucket` | string | ✅ | GCS bucket name for remote state |
| `prefix` | string | ✅ | Path prefix within bucket |
| `project` | string | ❌ | GCP project ID |
| `credentials` | string | ❌ | Path to GCP credentials file |
| `location` | string | ❌ | Storage location for data residency |
| `encryption_key` | string | ❌ | Customer-supplied encryption key (Base64) |
| `kms_encryption_key` | string | ❌ | Cloud KMS key name for encryption |
| `impersonate_service_account` | string | ❌ | Service account email for impersonation |
| `storage_custom_endpoint` | string | ❌ | Custom storage endpoint URL |

### Use Cases

#### KMS Encryption with Cloud KMS

Use Google Cloud KMS for state encryption:

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket             = "my-terraform-state"
    prefix             = "terraform/state"
    project            = "my-gcp-project"
    kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"
  }
}
```

#### Service Account Impersonation

Impersonate a service account for elevated permissions:

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket                      = "my-terraform-state"
    prefix                      = "terraform/state"
    project                     = "my-gcp-project"
    impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"
  }
}
```

#### Data Residency Compliance

Specify storage location for regulatory compliance:

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket   = "my-terraform-state"
    prefix   = "terraform/state"
    project  = "my-gcp-project"
    location = "europe-west1"
  }
}
```

#### Local Development with GCS Emulator

Test locally using the GCS emulator:

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket                  = "local-terraform-state"
    prefix                  = "terraform/state"
    storage_custom_endpoint = "http://localhost:4443/storage/v1/"
  }
}
```

#### Customer-Supplied Encryption Key

Use your own encryption key (CSEK):

```hcl
remote_state {
  backend = "gcs"
  config = {
    bucket         = "my-terraform-state"
    prefix         = "terraform/state"
    project        = "my-gcp-project"
    encryption_key = "base64-encoded-256-bit-key"
  }
}
```

---

## Mustache Conditional Rendering

Advanced templates use **Mustache conditional syntax** to include only the options you specify. This keeps generated configurations clean and minimal.

### How It Works

```hcl
# Template with conditionals
remote_state {
  backend = "s3"
  config = {
    bucket = "{{bucket}}"
    key    = "{{key}}"
    region = "{{region}}"
{{#kms_key_id}}
    kms_key_id = "{{kms_key_id}}"
{{/kms_key_id}}
{{#role_arn}}
    role_arn = "{{role_arn}}"
{{/role_arn}}
  }
}
```

When you provide only `bucket`, `key`, and `region`:

```hcl
# Generated output (clean, no empty values)
remote_state {
  backend = "s3"
  config = {
    bucket = "my-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
```

When you also provide `kms_key_id`:

```hcl
# Generated output (includes KMS)
remote_state {
  backend = "s3"
  config = {
    bucket     = "my-state"
    key        = "terraform.tfstate"
    region     = "us-east-1"
    kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/..."
  }
}
```

---

## Migration Guide

### From Essential to Advanced Templates

1. **Identify additional requirements** - What features do you need?
   - Cross-account access → `role_arn` / `impersonate_service_account`
   - Encryption → `kms_key_id` / `kms_encryption_key`
   - Alternative auth → `use_msi` / `use_azuread_auth`

2. **Switch template** - Use the advanced backend variant:
   ```
   backend: "s3-advanced"   # Instead of "s3"
   backend: "azurerm-advanced"  # Instead of "azurerm"
   backend: "gcs-advanced"  # Instead of "gcs"
   ```

3. **Add new options** - Include only the options you need:
   ```json
   {
     "useCase": "remote_state",
     "backend": "s3-advanced",
     "options": {
       "bucket": "my-state",
       "key": "${path_relative_to_include()}/terraform.tfstate",
       "region": "us-east-1",
       "kms_key_id": "arn:aws:kms:..."
     }
   }
   ```

4. **Validate** - The generator validates HCL syntax automatically

### Backward Compatibility

- Essential templates remain available and unchanged
- Existing configurations continue to work
- Advanced templates are opt-in via `-advanced` suffix

---

## Security Best Practices

### Secrets Management

⚠️ **Never hardcode secrets** in terragrunt.hcl files:

```hcl
# ❌ BAD - Secret in config
client_secret = "my-secret-value"

# ✅ GOOD - Use environment variable
client_secret = get_env("ARM_CLIENT_SECRET")

# ✅ GOOD - Use Terragrunt's secret manager integration
client_secret = run_cmd("--terragrunt-quiet", "aws", "secretsmanager", "get-secret-value", ...)
```

### Encryption Recommendations

| Cloud | Recommendation |
|-------|----------------|
| AWS | Use KMS with key rotation enabled |
| Azure | Use Azure AD auth + RBAC over access keys |
| GCP | Use Cloud KMS with separation of duties |

### Access Control

- **AWS**: Use IAM policies and bucket policies
- **Azure**: Use RBAC roles (Storage Blob Data Contributor)
- **GCP**: Use IAM bindings on bucket and KMS key

---

## Related Documentation

- [Configuration Generator Guide](Configuration-Generator.md) - All templates and use cases
- [Custom Templates Guide](Custom-Templates.md) - Create your own templates
- [HCL Validation](HCL-Validation.md) - Syntax validation features
- [Terragrunt Remote State Docs](https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/)
