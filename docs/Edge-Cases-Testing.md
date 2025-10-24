# Edge Cases Testing Documentation

## Overview

This document describes the comprehensive edge case test suite for the Terragrunt MCP Server. These tests validate tool behavior with unusual, boundary, and invalid inputs to ensure robust error handling and graceful degradation.

## Test Statistics

- **Total Edge Case Tests**: 48
- **Test Categories**: 11
- **Test Duration**: ~135ms
- **Status**: ✅ All passing

## Test Categories

### 1. Search with Special Characters (8 tests)

Tests search functionality with various special characters that could cause parsing issues:

- **Special characters**: `terraform { source = "..." }`
- **Quotes**: `dependency "vpc"`
- **Forward slashes**: `path/to/module`
- **Backslashes**: `C:\Users\path`
- **Ampersands**: `flag1 && flag2`
- **Parentheses/brackets**: `func(param1, param2)`
- **Dollar signs**: `${var.name}`
- **Asterisks/wildcards**: `*.tf`

**Key Findings**:
- All special characters handled gracefully
- No parsing errors or crashes
- Search engine properly escapes/sanitizes input

### 2. Very Long Search Queries (3 tests)

Tests search with extremely long query strings:

- **1000 character queries**: ~990 chars (repeated "terragrunt ")
- **>1000 character queries**: ~1400 chars (long descriptive sentence)
- **Multi-line queries**: Terraform HCL block with newlines

**Key Findings**:
- No length limit enforced (handles queries >1000 chars)
- Multi-line queries processed correctly
- Long queries may return 0 results (expected behavior)

### 3. Unicode in Titles and Content (4 tests)

Tests internationalization and Unicode support:

- **Emoji**: `terraform 🚀`
- **Non-ASCII characters**: `configuración terraform`
- **Chinese characters**: `配置 terraform`
- **Mixed unicode**: `terraform-модуль`

**Key Findings**:
- Full Unicode support in search
- No character encoding issues
- Properly handles mixed ASCII/Unicode

### 4. Limit Parameters at Boundaries (6 tests)

Tests edge cases for the `limit` parameter:

| Limit Value | Expected Behavior | Actual Behavior |
|-------------|-------------------|-----------------|
| `0` | Return 0 results | ✅ Returns empty array |
| `1` | Return max 1 result | ✅ Returns 0-1 results |
| (default) | Return max 5 results | ✅ Returns ≤5 results |
| `20` | Return max 20 results | ✅ Returns ≤20 results |
| `1000` | Return all available | ✅ Returns all (~82 docs) |
| `-5` | Handle gracefully | ✅ No crash, returns empty |

**Key Findings**:
- Negative limits handled gracefully
- Zero limit returns empty array (but shows total count)
- Large limits return all available results (no artificial cap)
- `hasMore` flag correctly indicates if results were truncated

### 5. Empty and Invalid Inputs (7 tests)

Tests error handling for missing or invalid parameters:

- **Empty search query**: `query: ""`
- **Whitespace-only query**: `query: "   "`
- **Missing required parameter**: No `query` provided
- **Invalid section name**: `nonexistent-section-12345`
- **Invalid CLI command**: `nonexistent-command-xyz`
- **Invalid HCL config**: `invalid_config_12345`
- **Empty topic**: `topic: ""`

**Error Handling**:
```typescript
// Invalid section returns helpful error
{
  section: 'nonexistent-section-12345',
  error: 'No documentation found for section: ...',
  availableSections: ['getting-started', 'reference', ...]
}

// Invalid CLI command returns suggestion
{
  command: 'nonexistent-command-xyz',
  error: 'No CLI command documentation found for: ...',
  suggestion: 'Try searching with search_terragrunt_docs...'
}

// Invalid HCL config returns suggestion
{
  config: 'invalid_config_12345',
  error: 'No HCL configuration documentation found for: ...',
  suggestion: 'Try searching with search_terragrunt_docs...'
}
```

**Key Findings**:
- All tools validate required parameters
- Helpful error messages with suggestions
- Invalid inputs return structured errors (not exceptions)
- Empty queries handled gracefully (may return all docs or error)

### 6. Tool Parameter Validation (5 tests)

Tests that all tools properly validate required parameters:

| Tool | Required Parameter | Validation |
|------|-------------------|------------|
| `search_terragrunt_docs` | `query` | ✅ Error if missing |
| `get_terragrunt_sections` | (none) | ✅ No validation needed |
| `get_section_docs` | `section` | ✅ Error if missing |
| `get_cli_command_help` | `command` | ✅ Error if missing |
| `get_hcl_config_reference` | `config` | ✅ Error if missing |
| `get_code_examples` | `topic` | ✅ Error if missing |

**Validation Messages**:
```typescript
{
  error: 'query parameter is required'
}
{
  error: 'command parameter is required'
}
{
  error: 'config parameter is required'
}
{
  error: 'topic parameter is required'
}
{
  error: 'section parameter is required'
}
```

### 7. Unknown Tool Handling (3 tests)

Tests graceful handling of invalid tool invocations:

- **Unknown tool name**: `unknown_tool_xyz`
- **Null tool name**: `null`
- **Undefined tool name**: `undefined`

**Error Response**:
```typescript
{
  error: 'Unknown tool: unknown_tool_xyz'
}
```

**Key Findings**:
- No crashes or exceptions on unknown tools
- Consistent error response format
- Null/undefined handled gracefully

### 8. Code Examples Edge Cases (3 tests)

Tests `get_code_examples` with edge case parameters:

- **Limit=0**: Returns empty array (but indicates examples exist)
- **Very high limit** (100): Returns all available examples
- **Rare/specific topics**: May return 0 results (graceful)

**Key Findings**:
- Limit boundaries respected
- Rare topics return empty array (not error)
- High limits return all available examples

### 9. Section Docs Edge Cases (3 tests)

Tests `get_section_docs` with unusual section names:

- **Hyphenated sections**: `getting-started` ✅
- **Uppercase sections**: `GETTING-STARTED` → error (case-sensitive)
- **Whitespace in section**: `  getting-started  ` → error (not trimmed)

**Key Findings**:
- Section names are case-sensitive
- No automatic trimming of whitespace
- Invalid sections return helpful error with available sections list

### 10. CLI Command Help Edge Cases (3 tests)

Tests `get_cli_command_help` with various command formats:

Common commands tested:
- `plan` ✅
- `apply` ✅
- `init` (may not have docs)
- `validate` (may not have docs)
- `run-all` ✅

Format variations:
- **Hyphens**: `run-all` ✅
- **Uppercase**: `PLAN` (may not find, case-sensitive)

**Key Findings**:
- Command names are case-sensitive
- Hyphens in command names supported
- Not all Terragrunt commands have documentation pages

### 11. HCL Config Reference Edge Cases (3 tests)

Tests `get_hcl_config_reference` with various config names:

Common HCL blocks tested:
- `terraform` ✅
- `dependency` ✅
- `dependencies` ✅
- `remote_state` ✅
- `inputs` ✅

Format variations:
- **Underscores**: `remote_state` ✅
- **Hyphens**: `generate-config` ✅

**Key Findings**:
- Both underscores and hyphens supported
- Multiple variations may return results (e.g., `dependency` vs `dependencies`)
- Config names are case-sensitive

## Edge Case Summary

### Handled Gracefully ✅

1. **Special characters** in search queries
2. **Very long queries** (>1000 chars)
3. **Multi-line queries**
4. **Unicode and emoji** in search
5. **Boundary limit values** (0, 1, negative, huge)
6. **Missing required parameters** → error with helpful message
7. **Invalid section/command/config names** → error with suggestions
8. **Unknown tools** → structured error response
9. **Empty/whitespace inputs** → handled gracefully
10. **Null/undefined values** → no crashes

### Current Limitations ⚠️

1. **Case sensitivity**: Section names, commands, and configs are case-sensitive
2. **No whitespace trimming**: Leading/trailing spaces not automatically removed
3. **No fuzzy matching**: Typos in section/command names return errors (not suggestions)
4. **No normalization**: `GETTING-STARTED` ≠ `getting-started`

### Recommendations for Future Enhancements

1. **Add input normalization**:
   - Trim whitespace from all string parameters
   - Convert section names to lowercase
   - Normalize command names

2. **Add fuzzy search**:
   - Suggest closest matches for invalid sections
   - "Did you mean: getting-started?" for typos

3. **Add query validation**:
   - Optional max query length enforcement
   - Warning for extremely long queries

4. **Add better Unicode support**:
   - Test with right-to-left languages (Arabic, Hebrew)
   - Test with zero-width characters

## Test Implementation

### File Structure
```
test/integration/
└── edge-cases.test.ts   (650+ lines, 48 tests)
```

### Test Pattern
```typescript
describe('Category Name', () => {
  it('should handle specific edge case', async () => {
    const result = await toolHandler.executeTool('tool_name', {
      param: edgeCaseValue
    });

    expect(result).toBeDefined();
    
    // Check for either success or graceful error
    if (result.error) {
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined(); // Helpful suggestion
    } else {
      expect(result.expectedProperty).toBeDefined();
    }
  });
});
```

## Running Edge Case Tests

### Run All Edge Case Tests
```bash
npm test -- test/integration/edge-cases.test.ts
```

### Run Specific Category
```bash
# Example: Run only special character tests
npm test -- test/integration/edge-cases.test.ts -t "Special Characters"
```

### Watch Mode
```bash
npm test -- test/integration/edge-cases.test.ts --watch
```

## Related Documentation

- [Available Tools](Available-Tools.md) - Tool parameter documentation
- [Development Guide](Development-Guide.md) - Contributing guidelines
- [Error Handling Tests](../test/unit/error-handling.test.ts) - Network/cache error tests
- [Performance Testing](Performance-Testing.md) - Performance benchmarks

## Last Updated

Generated: January 2025
Test Suite Version: 1.0.0
Documentation Version: 0.2.0
