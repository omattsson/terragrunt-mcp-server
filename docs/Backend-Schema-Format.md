# Backend Schema Format

This document describes the JSON schema format for defining Terraform backend configurations with complete attribute metadata. This format is used to auto-generate complete backend templates for Terragrunt.

## Overview

Backend schemas provide a standardized way to describe ALL attributes supported by Terraform backends (S3, Azure Blob, GCS, etc.) with rich validation metadata including:

- **Type information**: String, number, boolean, list, map, object
- **Validation rules**: Pattern matching, valid values, numeric ranges
- **Dependencies**: Required with, conflicts with
- **Documentation**: Descriptions, examples, deprecation warnings
- **Security markers**: Sensitive field indicators

## Schema Structure

### Top-Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g., `s3`, `azurerm`, `gcs`). Lowercase letters, numbers, and hyphens. |
| `name` | string | Yes | Human-readable name (e.g., "AWS S3 Backend") |
| `description` | string | Yes | Description of what this backend does |
| `provider` | string | Yes | Cloud provider: `aws`, `azure`, `gcp`, or `other` |
| `backend` | string | Yes | Terraform backend type (e.g., `s3`, `azurerm`, `gcs`) |
| `terraformDocsUrl` | string | Yes | URL to official Terraform documentation |
| `attributes` | array | Yes | Array of attribute definitions (at least one required) |
| `version` | string | No | Schema version in semver format (e.g., "1.0.0") |
| `lastUpdated` | string | No | ISO 8601 date (YYYY-MM-DD) of last update |

### Attribute Properties

Each attribute in the `attributes` array has the following properties:

#### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Attribute identifier (e.g., `bucket`, `region`). Lowercase letters, numbers, and underscores. |
| `type` | string | Terraform type: `string`, `number`, `boolean`, `list`, `map`, or `object` |
| `required` | boolean | Whether this attribute is required |
| `description` | string | Human-readable description |

#### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `example` | string/number/boolean | Example value demonstrating usage |
| `defaultValue` | any | Default value if not specified (can be `null`) |
| `sensitive` | boolean | Whether the value should be marked as sensitive |
| `deprecated` | boolean | Whether this attribute is deprecated |
| `deprecatedMessage` | string | Explanation and migration guidance (requires `deprecated: true`) |
| `validValues` | array | Array of allowed values (enum validation) |
| `minValue` | number | Minimum value (only for `type: "number"`) |
| `maxValue` | number | Maximum value (only for `type: "number"`) |
| `pattern` | string | Regex pattern for string validation |
| `conflictsWith` | array | Attribute names that cannot be used together |
| `requiredWith` | array | Attribute names that must be specified together |

## Example Schema

Here's a minimal example for an S3 backend:

```json
{
  "$schema": "../backend-schema.json",
  "id": "s3",
  "name": "AWS S3 Backend",
  "description": "Stores state as a given key in a given bucket on Amazon S3.",
  "provider": "aws",
  "backend": "s3",
  "terraformDocsUrl": "https://developer.hashicorp.com/terraform/language/backend/s3",
  "version": "1.0.0",
  "lastUpdated": "2024-12-03",
  "attributes": [
    {
      "name": "bucket",
      "type": "string",
      "required": true,
      "description": "Name of the S3 bucket where the state file will be stored.",
      "example": "my-terraform-state-bucket",
      "pattern": "^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$"
    },
    {
      "name": "key",
      "type": "string",
      "required": true,
      "description": "Path to the state file inside the S3 bucket.",
      "example": "path/to/my/terraform.tfstate"
    },
    {
      "name": "region",
      "type": "string",
      "required": false,
      "description": "AWS region of the S3 bucket.",
      "example": "us-east-1",
      "validValues": ["us-east-1", "us-west-2", "eu-west-1"]
    },
    {
      "name": "encrypt",
      "type": "boolean",
      "required": false,
      "description": "Whether to enable server side encryption.",
      "defaultValue": false,
      "example": true
    },
    {
      "name": "access_key",
      "type": "string",
      "required": false,
      "description": "AWS access key ID for authentication.",
      "sensitive": true,
      "requiredWith": ["secret_key"]
    },
    {
      "name": "secret_key",
      "type": "string",
      "required": false,
      "description": "AWS secret access key for authentication.",
      "sensitive": true,
      "requiredWith": ["access_key"]
    },
    {
      "name": "force_path_style",
      "type": "boolean",
      "required": false,
      "description": "Enable path-style S3 URLs.",
      "deprecated": true,
      "deprecatedMessage": "Use use_path_style instead.",
      "defaultValue": false
    },
    {
      "name": "use_path_style",
      "type": "boolean",
      "required": false,
      "description": "Enable path-style S3 URLs. Replaces force_path_style.",
      "defaultValue": false,
      "conflictsWith": ["force_path_style"]
    },
    {
      "name": "max_retries",
      "type": "number",
      "required": false,
      "description": "Maximum number of retries for AWS API requests.",
      "defaultValue": 5,
      "minValue": 0,
      "maxValue": 100
    }
  ]
}
```

## Validation Rules

### ID and Name Patterns

- **Schema `id`**: Must match `^[a-z][a-z0-9-]*$` (lowercase, starts with letter)
- **Attribute `name`**: Must match `^[a-z][a-z0-9_]*$` (lowercase, starts with letter, underscores allowed)

### Type-Specific Validation

- `minValue` and `maxValue` can only be specified for `type: "number"`
- `minValue` must be less than or equal to `maxValue`
- `pattern` should be a valid regular expression

### Dependency Validation

- `deprecatedMessage` requires `deprecated: true`
- `conflictsWith` and `requiredWith` should reference existing attribute names
- Unknown references generate warnings (not errors) to support forward compatibility

### URL Validation

- `terraformDocsUrl` must be a valid HTTP or HTTPS URL

## Using the Schema Loader

### TypeScript API

```typescript
import {
  loadBackendSchema,
  loadAllBackendSchemas,
  validateBackendSchema,
  getRequiredAttributes,
  getDeprecatedAttributes,
  getSensitiveAttributes,
} from './terragrunt/schema-loader.js';

// Load a single schema
const s3Schema = await loadBackendSchema('schemas/backends/s3.json');

// Load all schemas from a directory
const allSchemas = await loadAllBackendSchemas('schemas/backends/');

// Validate a schema object
const result = validateBackendSchema(schemaData);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}

// Get specific attribute types
const required = getRequiredAttributes(s3Schema);
const deprecated = getDeprecatedAttributes(s3Schema);
const sensitive = getSensitiveAttributes(s3Schema);
```

### Load Options

```typescript
interface BackendSchemaLoadOptions {
  validate?: boolean;      // Default: true - validate schemas during loading
  throwOnError?: boolean;  // Default: true for loadBackendSchema, false for loadAllBackendSchemas
}

// Skip validation
const schema = await loadBackendSchema('file.json', { validate: false });

// Throw on any error
const schemas = await loadAllBackendSchemas('dir/', { throwOnError: true });
```

## File Organization

Backend schema files should be organized in the `schemas/backends/` directory:

```
schemas/
├── backend-schema.json    # JSON Schema for validation
└── backends/
    ├── s3.json           # AWS S3 backend
    ├── azurerm.json      # Azure Blob Storage backend
    ├── gcs.json          # Google Cloud Storage backend
    └── ...
```

## Editor Support

Add the `$schema` property to get autocomplete and validation in VS Code:

```json
{
  "$schema": "../backend-schema.json",
  "id": "my-backend",
  ...
}
```

## Related Documentation

- [Custom Templates](./Custom-Templates.md) - Creating custom configuration templates
- [Configuration Generator](./Configuration-Generator.md) - Generating Terragrunt configurations
- [Available Tools](./Available-Tools.md) - MCP server tools reference
