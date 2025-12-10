# CLI Validation

This document describes the two-tier validation system for Terragrunt configuration generation.

## Overview

The Terragrunt MCP Server provides **two levels of HCL validation**:

1. **Tier 1: Regex-based validation** (always enabled)
   - Fast, lightweight syntax checking
   - No external dependencies
   - Catches common HCL syntax errors

2. **Tier 2: Terragrunt CLI validation** (optional)
   - Accurate validation using actual Terragrunt CLI
   - Provides formatted output with proper indentation
   - Requires Terragrunt to be installed

## Usage

### Basic Configuration (Regex Only)

By default, configurations are validated using regex-based checking:

```typescript
const generator = new TerragruntConfigGenerator(params);
const result = await generator.generateConfig({
  backend: 's3',
  useCase: 'remote_state',
  tier: 'basic',
  params: {
    bucket: 'my-bucket',
    key: 'terraform.tfstate',
    region: 'us-east-1'
  }
});

// result.validation.regex contains validation results
// result.validation.terragrunt is undefined
```

### Strict Validation (Regex + CLI)

Enable strict validation to use both tiers:

```typescript
const result = await generator.generateConfig({
  backend: 's3',
  useCase: 'remote_state',
  tier: 'basic',
  strictValidation: true,  // Enable CLI validation
  params: {
    bucket: 'my-bucket',
    key: 'terraform.tfstate',
    region: 'us-east-1'
  }
});

// result.validation.regex contains regex validation results
// result.validation.terragrunt contains CLI validation results (if available)
// result.wasFormatted is true if CLI formatting was applied
```

## Validation Results

### ValidationResults Structure

```typescript
interface ValidationResults {
  regex: HCLValidationResult;
  terragrunt?: TerragruntValidationResult;
}
```

### HCLValidationResult (Tier 1)

```typescript
interface HCLValidationResult {
  syntaxValid: boolean;
  errors: string[];
  warnings: string[];
}
```

### TerragruntValidationResult (Tier 2)

```typescript
interface TerragruntValidationResult {
  available: boolean;        // Is Terragrunt CLI available?
  syntaxValid: boolean;      // Did validation pass?
  formatted: boolean;        // Was config formatted?
  formattedConfig?: string;  // Formatted output (if successful)
  errors: string[];
  warnings: string[];
}
```

## Behavior

### When Terragrunt is Available

1. Config is validated with both regex and CLI
2. If CLI validation succeeds:
   - Formatted output is used
   - `wasFormatted` is set to `true`
3. If CLI validation fails in strict mode:
   - Error is thrown with detailed messages
4. Validation results include both tier outputs

### When Terragrunt is Not Available

1. Config is validated with regex only
2. If `strictValidation=true` and regex fails:
   - Error is thrown
3. `validation.terragrunt.available` is `false`
4. System gracefully degrades to regex validation

### Timeout Protection

- **Availability check**: 2 second timeout
- **Validation operation**: 5 second timeout
- Timeouts are treated as unavailability

## Examples

### Example 1: Successful Validation

```typescript
const result = await generator.generateConfig({
  backend: 's3',
  useCase: 'remote_state',
  strictValidation: true,
  // ... params
});

console.log(result.validation.regex.syntaxValid);      // true
console.log(result.validation.terragrunt?.available);  // true
console.log(result.validation.terragrunt?.syntaxValid); // true
console.log(result.wasFormatted);                       // true
```

### Example 2: Terragrunt Not Available

```typescript
const result = await generator.generateConfig({
  backend: 's3',
  useCase: 'remote_state',
  strictValidation: true,
  // ... params
});

console.log(result.validation.regex.syntaxValid);      // true
console.log(result.validation.terragrunt?.available);  // false
console.log(result.wasFormatted);                       // false
```

### Example 3: Validation Errors

```typescript
try {
  const result = await generator.generateConfig({
    backend: 's3',
    useCase: 'remote_state',
    strictValidation: true,
    params: { /* invalid params */ }
  });
} catch (error) {
  // Error includes formatted list of validation failures
  console.error(error.message);
  // Output:
  // Terragrunt validation failed:
  //   - Missing required attribute: bucket
  //   - Invalid syntax on line 5
}
```

## Installation Requirements

### Installing Terragrunt

**macOS (Homebrew):**
```bash
brew install terragrunt
```

**Linux (direct download):**
```bash
wget https://github.com/gruntwork-io/terragrunt/releases/download/v0.50.0/terragrunt_linux_amd64
chmod +x terragrunt_linux_amd64
sudo mv terragrunt_linux_amd64 /usr/local/bin/terragrunt
```

**Verify Installation:**
```bash
terragrunt --version
```

### Checking Availability Programmatically

```typescript
import { isTerragruntAvailable } from './terragrunt/cli-validator.js';

if (await isTerragruntAvailable()) {
  console.log('Terragrunt CLI is available');
} else {
  console.log('Terragrunt CLI not found - using regex validation only');
}
```

## Performance Considerations

- **Availability check**: Cached after first check (~50ms initial overhead)
- **Regex validation**: ~1-5ms per configuration
- **CLI validation**: ~100-500ms per configuration
- **Recommendation**: Use `strictValidation=true` for production configs, `false` for development/testing

## Troubleshooting

### Terragrunt Not Found

**Symptom**: `validation.terragrunt.available` is `false`

**Solutions**:
1. Check if Terragrunt is installed: `terragrunt --version`
2. Ensure Terragrunt is in PATH: `which terragrunt`
3. Install Terragrunt (see Installation Requirements above)

### Validation Timeouts

**Symptom**: Validation takes >5 seconds or times out

**Solutions**:
1. Check system resources (CPU, memory)
2. Verify Terragrunt installation is not corrupted
3. Use `strictValidation=false` for faster validation

### Unexpected Formatting

**Symptom**: Config looks different after validation

**Explanation**: Terragrunt CLI applies standard HCL formatting (indentation, spacing). This is expected behavior when `strictValidation=true` and Terragrunt is available.

**Solution**: To preserve original formatting, use `strictValidation=false`.

## Best Practices

1. **Use strict validation for production**: Ensures configs are valid before deployment
2. **Use regex validation for development**: Faster iteration during development
3. **Check formatted output**: Review `wasFormatted` to know if CLI formatting was applied
4. **Handle unavailability gracefully**: Don't assume Terragrunt is always available
5. **Cache validation results**: For repeated use of same config, cache validation results to avoid re-validation

## Related Documentation

- [HCL Validation](./HCL-Validation.md) - Regex-based validation details
- [Configuration Generator](./Configuration-Generator.md) - Overall generator usage
- [Best Practices Guide](./Best-Practices-Guide.md) - General best practices

