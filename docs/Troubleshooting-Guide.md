# Troubleshooting Guide

This guide provides comprehensive information about the `diagnose_terragrunt_error` tool and how to effectively troubleshoot Terragrunt errors using the MCP server.

## Overview

The Terragrunt MCP Server includes a powerful error diagnosis system that can analyze error messages and provide actionable solutions. It uses pattern matching against a database of **66 known error patterns** across **7 categories** to identify issues and suggest fixes.

**Mode Availability:** Error diagnosis is available in **GUIDANCE** and **FULL** modes only. If you need troubleshooting capabilities, ensure you're using one of these modes. See [Mode Selection](#mode-specific-troubleshooting) below.

## How Error Pattern Matching Works

### Pattern Database

The error diagnosis system maintains a curated database of common Terragrunt error patterns:

| Category | Patterns | Description |
|----------|----------|-------------|
| **configuration** | 38 | Syntax errors, missing blocks, invalid values, hooks, includes, locals, generate blocks |
| **dependency** | 13 | Circular dependencies, missing modules, module sources |
| **backend** | 4 | S3, GCS, Azure backend configuration errors |
| **state** | 3 | State locking, backend migration issues |
| **terraform** | 3 | Version mismatches, provider issues |
| **authentication** | 3 | AWS, Azure, GCP credential issues |
| **network** | 2 | Connectivity, timeout issues |

### Matching Process

When you submit an error message, the system:

1. **Regex Matching**: First attempts exact pattern matching using regular expressions (confidence: 0.95)
2. **Fuzzy Matching**: If no exact match, uses fuzzy string matching based on edit distance
3. **Context Extraction**: Extracts relevant context (file paths, variable names, etc.) from the error
4. **Confidence Scoring**: Assigns a confidence score (0-1) to each match
5. **Solution Retrieval**: Fetches relevant solutions and documentation

```text
┌─────────────────────────────────────────────────────────────┐
│                    Error Message Input                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ErrorPatternMatcher.diagnoseError()             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Check LRU Cache for cached results              │    │
│  │  2. Run regex matching against 66 patterns          │    │
│  │  3. Run fuzzy matching for partial matches          │    │
│  │  4. Score and rank matches by confidence            │    │
│  │  5. Extract context from error message              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SolutionRetriever (if enrichWithDocs=true)      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. Search documentation for relevant content       │    │
│  │  2. Extract solutions from docs                     │    │
│  │  3. Add documentation links                         │    │
│  │  4. Order debugging steps                           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Diagnosis Result                          │
│  • Matched patterns with confidence scores                   │
│  • Likely causes                                             │
│  • Step-by-step solutions                                    │
│  • Debugging steps                                           │
│  • Related errors                                            │
│  • Documentation links                                       │
└─────────────────────────────────────────────────────────────┘
```

## Confidence Scoring System

The system uses confidence scores to indicate how certain it is about a match:

| Score | Meaning | Match Type |
|-------|---------|------------|
| **0.95** | Very high confidence | Regex pattern match |
| **0.7-0.9** | High confidence | Close fuzzy match |
| **0.5-0.7** | Medium confidence | Moderate fuzzy match |
| **0.3-0.5** | Low confidence | Distant fuzzy match |
| **< 0.3** | Very low confidence | Filtered out by default |

### Confidence Calculation

- **Regex matches**: Automatically assigned 0.95 confidence
- **Fuzzy matches**: Based on Levenshtein edit distance ratio
  - `confidence = 1 - (editDistance / maxLength)`
  - Maximum edit distance ratio: 30% of string length

## Using the diagnose_terragrunt_error Tool

### Basic Usage

Simply provide the error message:

```text
"Diagnose this error: Error: Backend configuration changed since last init"
```

### With Context

Provide additional context for better diagnosis:

```text
"I ran 'terragrunt apply' on macOS and got this error: Error acquiring the state lock.
The module is in /projects/infrastructure/vpc and uses S3 backend."
```

### Tool Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `error_message` | string | Yes | - | The error message to diagnose |
| `context.command` | string | No | - | The terragrunt command that was run |
| `context.version` | string | No | - | Terragrunt version |
| `context.os` | string | No | - | Operating system (linux, darwin, windows) |
| `context.filePath` | string | No | - | Path to terragrunt.hcl |
| `context.module` | string | No | - | Module name |
| `context.backend` | string | No | - | Backend type (s3, gcs, azurerm) |
| `options.maxMatches` | number | No | 3 | Maximum matches to return |
| `options.minConfidence` | number | No | 0.3 | Minimum confidence threshold |
| `options.enableFuzzyMatching` | boolean | No | true | Enable fuzzy matching |
| `options.enrichWithDocs` | boolean | No | false | Enrich with documentation |
| `options.includeDestructiveCommands` | boolean | No | true | Include destructive commands |

## Common Error Scenarios

### 1. Backend Configuration Changed

**Error:**
```text
Error: Backend configuration changed since last init
```

**Typical Cause:** Backend settings (bucket, region, key) were modified in terragrunt.hcl

**Solutions:**
1. Run `terragrunt init -reconfigure` to reinitialize with new settings
2. Or run `terragrunt init -migrate-state` to migrate existing state

### 2. State Lock Error

**Error:**
```text
Error: Error acquiring the state lock
Error: Error: state data in S3 does not have the expected content
```

**Typical Causes:**
- Another terragrunt/terraform process is running
- Previous process crashed without releasing lock
- Network issues with backend

**Solutions:**
1. Wait for other process to complete
2. Use `terragrunt force-unlock <LOCK_ID>` (with caution)
3. Check network connectivity to backend

### 3. Circular Dependency

**Error:**
```text
Error: Detected cycle in dependencies: module-a -> module-b -> module-c -> module-a
```

**Typical Cause:** Modules reference each other in a loop

**Solutions:**
1. Review dependency graph and break the cycle
2. Use `mock_outputs` for testing without real dependencies
3. Restructure modules to avoid circular references

### 4. Module Not Found

**Error:**
```text
Error: Module not found
Error: Failed to download module
```

**Typical Causes:**
- Incorrect source path
- Private repository without credentials
- Network connectivity issues

**Solutions:**
1. Verify the source path is correct
2. Check credentials for private repositories
3. Test network connectivity

### 5. No Terraform Configuration Files

**Error:**
```text
Error: No Terraform configuration files found in directory
```

**Typical Causes:**
- terragrunt.hcl is in wrong directory
- Missing terraform block pointing to source
- Incorrect working directory

**Solutions:**
1. Verify you're in the correct directory
2. Check that terragrunt.hcl has proper terraform source block
3. Run with the `--working-dir` flag

### 6. Authentication Errors

**Error:**
```text
Error: error configuring S3 Backend: no valid credential sources
Error: Access Denied
```

**Typical Causes:**
- Missing or expired AWS credentials
- Incorrect IAM permissions
- Wrong profile or region

**Solutions:**
1. Verify credentials with `aws sts get-caller-identity`
2. Check IAM permissions for S3/DynamoDB
3. Set correct AWS_PROFILE or region

## Best Practices for Error Diagnosis

### 1. Provide Complete Error Messages

Include the full error output, not just the first line:

✅ **Good:**
```text
"Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        12345
  Path:      s3://bucket/path/terraform.tfstate
  Operation: OperationTypePlan
  Who:       user@host"
```

❌ **Bad:**
```text
"Error acquiring state lock"
```

### 2. Include Context When Available

Context helps narrow down the issue:

```text
"Running 'terragrunt apply' in /projects/infra/vpc on macOS,
using Terragrunt 0.50.0 with S3 backend. Got this error: ..."
```

### 3. Use enrichWithDocs for Complex Issues

For complex issues, enable documentation enrichment:

```text
"Diagnose this error with documentation enrichment enabled: ..."
```

This provides:
- Additional solutions from official documentation
- Relevant documentation links
- More detailed debugging steps

### 4. Check Related Errors

The diagnosis includes related errors that might be connected:

```json
{
  "relatedErrors": [
    "State Lock Error",
    "Backend Access Denied"
  ]
}
```

## Troubleshooting Workflow

Follow this workflow for effective troubleshooting:

```text
┌─────────────────────────────────────────────────────────────┐
│  1. CAPTURE - Copy the complete error message               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. DIAGNOSE - Use diagnose_terragrunt_error tool           │
│     • Provide full error message                            │
│     • Include context if available                          │
│     • Enable enrichWithDocs for complex issues              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. ANALYZE - Review the diagnosis results                  │
│     • Check confidence scores                               │
│     • Read likely causes                                    │
│     • Review suggested solutions                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. APPLY - Try solutions in order                          │
│     • Start with highest confidence matches                 │
│     • Try safe solutions before destructive ones            │
│     • Check solution safety levels                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. VERIFY - Confirm the fix worked                         │
│     • Re-run the failed command                             │
│     • Check for new errors                                  │
│     • Validate infrastructure state                         │
└─────────────────────────────────────────────────────────────┘
```

## Solution Safety Levels

Solutions are categorized by safety level:

| Level | Description | Examples |
|-------|-------------|----------|
| **safe** | Read-only, no side effects | `terragrunt validate`, `terragrunt terragrunt-info` |
| **caution** | Modifies state or config | `terragrunt init -reconfigure`, `terragrunt apply` |
| **destructive** | May cause data loss | `terragrunt destroy`, `terragrunt force-unlock` |

### Handling Destructive Commands

By default, destructive commands are included in solutions. To exclude them:

```text
"Diagnose this error but don't suggest any destructive commands: ..."
```

Or set `includeDestructiveCommands: false` in options.

## Performance Considerations

The error diagnosis system is optimized for performance:

- **Pattern Matching**: < 100ms for typical errors
- **Fuzzy Matching**: < 50ms per pattern
- **Solution Retrieval**: < 200ms with documentation enrichment
- **Caching**: Results are cached in an LRU cache for repeated queries

### Caching

The system uses an LRU (Least Recently Used) cache:
- Caches up to 100 recent error diagnosis results
- Cache key based on error message + options
- Improves response time for repeated queries

## API Response Structure

### Basic Response

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
      "solutions": [...],
      "documentationRefs": [...]
    }
  ],
  "debuggingSteps": [...],
  "relatedErrors": [...],
  "generalAdvice": [...]
}
```

### Enriched Response (with enrichWithDocs: true)

```json
{
  "success": true,
  "overallConfidence": 0.95,
  "matchCount": 1,
  "enrichmentSuccessful": true,
  "matches": [...],
  "richSolutions": [
    {
      "step": "Step 1: Reinitialize backend",
      "command": "terragrunt init -reconfigure",
      "explanation": "Forces reconfiguration without state migration",
      "warnings": ["This will reinitialize without migrating state"],
      "safetyLevel": "caution",
      "source": "pattern"
    }
  ],
  "orderedDebuggingSteps": [...],
  "documentationLinks": [...],
  "relatedErrorDetails": [...]
}
```

## Troubleshooting the Troubleshooter

### No Matches Found

If the tool returns no matches:

1. **Lower the confidence threshold**: Try `minConfidence: 0.2`
2. **Enable fuzzy matching**: Ensure `enableFuzzyMatching: true`
3. **Simplify the error message**: Remove timestamps and paths
4. **Check for typos**: Ensure the error message is accurate

### Low Confidence Matches

If matches have low confidence:

1. **Provide more context**: Add command, version, OS info
2. **Include full error**: Don't truncate the message
3. **Enable enrichment**: Use `enrichWithDocs: true`

### Enrichment Failed

If `enrichmentSuccessful: false`:

1. **Check network**: Documentation enrichment requires internet
2. **Check cache**: Clear cache if documentation is stale
3. **Use basic diagnosis**: Results still useful without enrichment

## Mode-Specific Troubleshooting

### Troubleshooting Tool Availability

The `diagnose_terragrunt_error` and `get_guidance` tools are available in specific modes:

| Mode | diagnose_terragrunt_error | get_guidance | Best Practices | Error Patterns |
|------|---------------------------|--------------|----------------|----------------|
| **GUIDANCE** | ✅ Yes | ✅ Yes | ✅ Loaded | ✅ Loaded |
| **FULL** | ✅ Yes | ✅ Yes | ✅ Loaded | ✅ Loaded |
| **CORE** | ❌ No | ❌ No | ❌ Not loaded | ❌ Not loaded |
| **CONFIG** | ❌ No | ❌ No | ❌ Not loaded | ❌ Not loaded |
| **OBSERVABILITY** | ❌ No | ❌ No | ❌ Not loaded | ❌ Not loaded |

### Switching to GUIDANCE Mode

If you encounter an error "Tool not available" when trying to diagnose errors:

**Option 1: Add GUIDANCE mode instance**
```json
{
  "mcp.servers": {
    "terragrunt-debug": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-guidance"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

**Option 2: Switch to FULL mode**
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],  // No --mode flag = FULL
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

**Option 3: Use --mode flag**
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js", "--mode", "guidance"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

### Mode-Specific Performance

GUIDANCE mode loads only troubleshooting-related dependencies:
- **Managers loaded**: 4/12 (docs, bestPractices, errorPatterns, comparisons)
- **Memory footprint**: 0.13 MB (35% savings vs FULL)
- **Token overhead**: 683 tokens (72% reduction vs FULL)
- **Startup time**: ~3.7ms

This makes GUIDANCE mode optimal for dedicated troubleshooting sessions while reducing overhead compared to FULL mode.

### Troubleshooting Mode Issues

**Problem:** "Tool diagnose_terragrunt_error not found"

**Solution:** Server is running in a mode without troubleshooting tools. Check mode with:
```bash
# Check server logs in VS Code Output panel
# Look for: "[Server] Starting in <mode> mode"
```

**Problem:** Mode change not taking effect

**Solution:**
1. Verify VS Code `settings.json` saved correctly
2. Restart VS Code completely (not just reload)
3. Check Output panel for mode confirmation
4. Try using CLI wrapper instead of --mode flag

**Problem:** Need both documentation AND troubleshooting

**Solution:** Run multiple server instances:
```json
{
  "mcp.servers": {
    "terragrunt-docs": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    "terragrunt-debug": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-guidance"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

## Further Reading

- [Migration Guide](MIGRATION_GUIDE.md) - Mode migration and configuration
- [Available Tools](Available-Tools.md) - Complete tool reference
- [Architecture Overview](Architecture-Overview.md) - Technical architecture details
- [Mode Performance](../MODE_PERFORMANCE_VERIFIED.md) - Detailed mode benchmarks
- [Edge Cases Testing](Edge-Cases-Testing.md) - Edge case handling
- [Performance Testing](Performance-Testing.md) - Performance benchmarks
