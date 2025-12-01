# Custom User-Provided Templates

## Overview

The Terragrunt MCP Server supports custom user-provided templates to extend the built-in template library with organization-specific patterns, compliance requirements, or proprietary infrastructure configurations.

## Features

- **API Parameter Support**: Pass custom templates directly via tool parameters
- **Filesystem Loading**: Store templates in `~/.terragrunt-mcp/templates/` for persistent use
- **Template Validation**: Automatic validation of template structure and HCL syntax
- **Priority-Based Override**: Custom templates override built-in templates with the same ID
- **Backward Compatible**: Works seamlessly without custom templates

## Priority System

Templates are loaded with the following priority (highest to lowest):

1. **Custom (API)**: Priority 100 - Templates passed via tool parameters
2. **Filesystem**: Priority 50 - Templates loaded from filesystem
3. **Built-in**: Priority 10 - Default template library

When multiple templates have the same ID, the highest priority wins.

## Usage

### 1. API Parameter (Ad-hoc Custom Templates)

Pass a custom template directly when calling a tool:

> **Note on Template Placeholders**: Use `{{variable_name}}` syntax for template placeholders. These will be replaced with actual values during config generation. The generated output will contain HCL variable references like `${var.variable_name}` or literal values depending on the context.

```typescript
{
  query: "Generate S3 backend with KMS encryption",
  custom_template: {
    id: "aws-s3-backend-kms",
    name: "AWS S3 Backend with KMS",
    description: "S3 backend with KMS encryption for compliance",
    category: "backend",
    templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket         = "{{bucket_name}}"
    key            = "{{key_path}}"
    region         = "{{region}}"
    encrypt        = true
    kms_key_id     = "{{kms_key_id}}"
    dynamodb_table = "{{dynamodb_table}}"
  }
}`,
    variables: [
      {
        name: "bucket_name",
        type: "string",
        description: "S3 bucket name",
        required: true,
        example: "my-terraform-state"
      },
      {
        name: "kms_key_id",
        type: "string",
        description: "KMS key ID for encryption",
        required: true,
        example: "arn:aws:kms:us-east-1:123456789012:key/..."
      }
    ],
    tags: ["aws", "s3", "kms", "encryption"]
  }
}
```

### 2. Filesystem Templates (Persistent)

Create template files in `~/.terragrunt-mcp/templates/`:

**File: `~/.terragrunt-mcp/templates/custom-backend.json`**

```json
{
  "id": "my-org-s3-backend",
  "name": "Organization S3 Backend",
  "description": "Standard S3 backend configuration for our organization",
  "category": "backend",
  "cloudProvider": "aws",
  "templateHcl": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket         = \"{{bucket_name}}\"\n    key            = \"{{key_path}}\"\n    region         = \"us-east-1\"\n    encrypt        = true\n    dynamodb_table = \"terraform-locks\"\n  }\n}",
  "variables": [
    {
      "name": "bucket_name",
      "type": "string",
      "description": "S3 bucket name",
      "required": true,
      "example": "acme-terraform-state"
    },
    {
      "name": "key_path",
      "type": "string",
      "description": "Path to state file in bucket",
      "required": true,
      "example": "prod/terraform.tfstate"
    }
  ],
  "tags": ["aws", "s3", "organization"],
  "example": "bucket_name = \"acme-terraform-state\"\nkey_path    = \"prod/terraform.tfstate\""
}
```

Templates in this directory are automatically loaded at startup.

## Template Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the template |
| `name` | string | Human-readable template name |
| `description` | string | Template description |
| `category` | string | Template category (see below) |
| `templateHcl` | string | HCL template content |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `cloudProvider` | string | Cloud provider: `aws`, `azure`, `gcp`, `multi` |
| `variables` | Variable[] | Template variables (see below) |
| `tags` | string[] | Search tags |
| `example` | string | Usage example |

### Categories

Valid template categories:

- `backend` - Remote state backends
- `provider` - Cloud provider configurations
- `dependency` - Module dependencies
- `hooks` - Before/after hooks
- `inputs` - Input variable declarations
- `advanced` - Advanced configurations
- `configuration` - General configuration

### Variable Schema

Each variable in the `variables` array must include:

```typescript
{
  "name": "variable_name",      // Required: Variable name
  "type": "string",             // Required: Variable type
  "description": "Description", // Recommended: What this variable does
  "required": true,             // Required: Is this variable required?
  "defaultValue": "default",    // Optional: Default value
  "example": "example-value"    // Optional: Example usage
}
```

## Mustache Conditional Syntax

Templates use [Mustache](https://mustache.github.io/) syntax for variable substitution and conditional rendering. This enables templates to include only the options that are provided, keeping generated configurations clean.

### Basic Variable Substitution

Use double curly braces to substitute a variable value:

```hcl
bucket = "{{bucket}}"
region = "{{region}}"
```

### Conditional Sections

Use section tags to conditionally include blocks when a variable is provided:

```hcl
{{#kms_key_id}}
    kms_key_id = "{{kms_key_id}}"
{{/kms_key_id}}
{{#role_arn}}
    role_arn = "{{role_arn}}"
{{/role_arn}}
```

If `kms_key_id` is not provided, the entire block (including the line) is omitted from the output.

### Inverted Sections

Use inverted sections to include content when a variable is **not** provided:

```hcl
{{^use_msi}}
    # Default: use access key authentication
{{/use_msi}}
{{#use_msi}}
    use_msi = {{use_msi}}
{{/use_msi}}
```

### Complete Example

Here's a custom advanced template using conditionals:

```json
{
  "id": "my-org-s3-backend-advanced",
  "name": "Organization S3 Backend (Advanced)",
  "description": "S3 backend with optional KMS and cross-account support",
  "category": "backend",
  "cloudProvider": "aws",
  "templateHcl": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket         = \"{{bucket}}\"\n    key            = \"{{key}}\"\n    region         = \"{{region}}\"\n{{#dynamodb_table}}\n    dynamodb_table = \"{{dynamodb_table}}\"\n{{/dynamodb_table}}\n{{#encrypt}}\n    encrypt        = {{encrypt}}\n{{/encrypt}}\n{{#kms_key_id}}\n    kms_key_id     = \"{{kms_key_id}}\"\n{{/kms_key_id}}\n{{#role_arn}}\n    role_arn       = \"{{role_arn}}\"\n{{/role_arn}}\n  }\n}",
  "variables": [
    { "name": "bucket", "type": "string", "required": true },
    { "name": "key", "type": "string", "required": true },
    { "name": "region", "type": "string", "required": true },
    { "name": "dynamodb_table", "type": "string", "required": false },
    { "name": "encrypt", "type": "boolean", "required": false },
    { "name": "kms_key_id", "type": "string", "required": false },
    { "name": "role_arn", "type": "string", "required": false }
  ],
  "tags": ["aws", "s3", "advanced", "kms", "cross-account"]
}
```

When called with only required variables:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket = "my-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
```

When called with KMS and role_arn:

```hcl
remote_state {
  backend = "s3"
  config = {
    bucket     = "my-state"
    key        = "terraform.tfstate"
    region     = "us-east-1"
    encrypt    = true
    kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/..."
    role_arn   = "arn:aws:iam::123456789012:role/TerraformRole"
  }
}
```

> 💡 See [Advanced Backend Templates](Advanced-Backend-Templates.md) for more examples of Mustache conditionals in production templates.

## Validation

Templates are automatically validated for:

1. **Required Fields**: All mandatory fields must be present and non-empty
2. **Field Types**: Enum values (category, cloudProvider) must be valid
3. **HCL Syntax**: Template HCL must be syntactically valid
4. **Variables**: Variable definitions must include name, type, and required flag

Invalid templates will be rejected with a detailed error message.

## Examples

### Example 1: Azure Blob Storage Backend

```json
{
  "id": "azure-blob-backend-sas",
  "name": "Azure Blob Storage with SAS",
  "description": "Azure Blob Storage backend with SAS token authentication",
  "category": "backend",
  "cloudProvider": "azure",
  "templateHcl": "remote_state {\n  backend = \"azurerm\"\n  config = {\n    storage_account_name = \"{{storage_account}}\"\n    container_name       = \"{{container_name}}\"\n    key                  = \"{{key_path}}\"\n    sas_token            = \"{{sas_token}}\"\n  }\n}",
  "variables": [
    {
      "name": "storage_account",
      "type": "string",
      "description": "Azure storage account name",
      "required": true
    },
    {
      "name": "container_name",
      "type": "string",
      "description": "Blob container name",
      "required": true
    },
    {
      "name": "key_path",
      "type": "string",
      "description": "State file path in container",
      "required": true
    },
    {
      "name": "sas_token",
      "type": "string",
      "description": "SAS token for authentication",
      "required": true
    }
  ],
  "tags": ["azure", "blob", "sas"]
}
```

### Example 2: Custom Hook

```json
{
  "id": "security-scan-hook",
  "name": "Security Scan Before Apply",
  "description": "Runs security scanning before terraform apply",
  "category": "hooks",
  "templateHcl": "terraform {\n  before_hook \"security_scan\" {\n    commands     = [\"apply\"]\n    execute      = [\"tfsec\", \".\"]\n    run_on_error = false\n  }\n}",
  "variables": [],
  "tags": ["security", "tfsec", "compliance"]
}
```

### Example 3: Multi-Provider Configuration

```json
{
  "id": "multi-cloud-providers",
  "name": "Multi-Cloud Provider Setup",
  "description": "Configure AWS and Azure providers together",
  "category": "provider",
  "cloudProvider": "multi",
  "templateHcl": "generate \"providers\" {\n  path      = \"providers.tf\"\n  if_exists = \"overwrite_terragrunt\"\n  contents  = <<EOF\nprovider \"aws\" {\n  region = \"{{aws_region}}\"\n}\n\nprovider \"azurerm\" {\n  features {}\n}\nEOF\n}",
  "variables": [
    {
      "name": "aws_region",
      "type": "string",
      "description": "AWS region",
      "required": true,
      "example": "us-east-1"
    }
  ],
  "tags": ["aws", "azure", "multi-cloud"]
}
```

## Best Practices

1. **Use Descriptive IDs**: Choose clear, unique identifiers
2. **Document Variables**: Provide detailed descriptions and examples
3. **Validate Locally**: Test templates before deployment
4. **Version Control**: Keep templates in Git alongside infrastructure code
5. **Security**: Never hardcode secrets in templates; use variables
6. **Organization Standards**: Define organization-wide templates for consistency
7. **Testing**: Validate generated configs with `terragrunt validate`

## Troubleshooting

### Template Not Loading

- Check file is in `~/.terragrunt-mcp/templates/`
- Verify file has `.json` extension
- Check JSON syntax is valid
- Review logs for validation errors

### Validation Errors

Common issues:

- **Missing required fields**: Ensure id, name, description, category, templateHcl are present
- **Invalid category**: Must be one of the valid categories listed above
- **Invalid HCL**: Check HCL syntax (balanced braces, valid interpolations)
- **Invalid variables**: Each variable needs name, type, and required fields

### Template Not Overriding Built-in

- Verify custom template has same `id` as built-in template
- Check template loaded successfully (review startup logs)
- Confirm custom template has higher priority (filesystem > builtin, custom > all)

## Security Considerations

1. **HCL Injection**: Templates are validated for HCL syntax to prevent injection
2. **Filesystem Permissions**: Ensure `~/.terragrunt-mcp/templates/` has appropriate permissions
3. **Secrets Management**: Never store secrets in templates; use variables or secret managers
4. **Template Source**: Only load templates from trusted sources
5. **Validation**: All templates undergo syntax and structure validation before use

## Advanced Usage

### Multiple Template Directories

You can load templates from multiple filesystem locations by instantiating multiple `FilesystemTemplateLoader` instances:

```typescript
const manager = new TemplatesManager([
  new BuiltinTemplateLoader(),
  new FilesystemTemplateLoader('~/.terragrunt-mcp/templates'),
  new FilesystemTemplateLoader('/path/to/org/templates'),
  new CustomTemplateLoader(apiTemplate)
]);
```

### Override Built-in Templates

To replace a built-in template, create a custom template with the same ID. For example, to override the built-in AWS S3 backend:

```json
{
  "id": "aws-s3-backend",
  "name": "Custom AWS S3 Backend",
  "description": "Organization-specific S3 backend configuration",
  ...
}
```

### Template Inheritance (Future)

Template inheritance/composition is planned for a future release. Track progress in issue #72.

## API Reference

### TemplateValidator

```typescript
class TemplateValidator {
  validate(template: any, source: 'custom' | 'filesystem' = 'custom'): ConfigTemplate
}
```

Validates and normalizes a template object.

### CustomTemplateLoader

```typescript
class CustomTemplateLoader implements TemplateLoader {
  readonly priority = 100;
  constructor(template: any);
  loadTemplates(): Promise<ConfigTemplate[]>;
}
```

Loads a single template provided via API parameter.

### FilesystemTemplateLoader

```typescript
class FilesystemTemplateLoader implements TemplateLoader {
  readonly priority = 50;
  constructor(templatePath?: string);
  loadTemplates(): Promise<ConfigTemplate[]>;
}
```

Loads templates from filesystem directory (default: `~/.terragrunt-mcp/templates/`).

### BuiltinTemplateLoader

```typescript
class BuiltinTemplateLoader implements TemplateLoader {
  readonly priority = 10;
  loadTemplates(): Promise<ConfigTemplate[]>;
}
```

Loads built-in template library.

## Related Documentation

- [Template Library](./Available-Tools.md#template-library)
- [Configuration Generation](./Development-Guide.md#configuration-generation)
- [HCL Validation](./MCP-Protocol-Compliance.md#hcl-validation)
- [Issue #72](https://github.com/omattsson/terragrunt-mcp-server/issues/72)
