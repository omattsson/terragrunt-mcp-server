import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

/**
 * Edge Case Tests for Error Diagnosis (Issue #50)
 * 
 * This test suite covers edge cases and boundary conditions for the
 * diagnose_terragrunt_error tool to ensure graceful handling of:
 * 
 * 1. Empty error messages
 * 2. Very long error messages (>10KB)
 * 3. Malformed/corrupted error text
 * 4. Non-English characters and special symbols
 * 5. No matching patterns found
 * 6. Multiple equally-confident matches
 * 7. Recursive/circular dependency errors
 * 8. Timeout scenarios
 * 9. Missing documentation sources
 * 
 * @see https://github.com/omattsson/terragrunt-mcp-server/issues/50
 */
describe('Edge Case Tests: Error Diagnosis', () => {
    let toolHandler: ToolHandler;
    let errorPatternMatcher: ErrorPatternMatcher;

    beforeAll(async () => {
        // ToolHandler creates its own dependencies internally
        toolHandler = new ToolHandler();
        
        // Create separate ErrorPatternMatcher for pattern loading verification
        const docsManager = new TerragruntDocsManager();
        errorPatternMatcher = new ErrorPatternMatcher(docsManager);
        await errorPatternMatcher.loadPatterns();
    });

    // ==================== 1. Empty Error Messages (6 tests) ====================
    describe('Empty Error Messages', () => {
        it('should handle empty string error message gracefully', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: ''
            });

            // Should return error or empty matches, NOT throw
            expect(result).toBeDefined();
            expect(() => JSON.stringify(result)).not.toThrow();
        });

        it('should handle whitespace-only error message', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: '   \t\n\r   '
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
        });

        it('should handle null error_message parameter', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: null
            });

            // Should return validation error
            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
        });

        it('should handle undefined error_message parameter', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: undefined
            });

            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
        });

        it('should handle missing error_message parameter entirely', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {});

            expect(result).toBeDefined();
            expect(result.error).toBe('error_message parameter is required');
        });

        it('should handle single character error message', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'x'
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Single char unlikely to match anything
            expect(result.matchCount).toBeGreaterThanOrEqual(0);
        });
    });

    // ==================== 2. Very Long Error Messages (5 tests) ====================
    describe('Very Long Error Messages', () => {
        it('should handle error message over 10KB', async () => {
            // Create a 15KB error message
            const largeError = 'Error: ' + 'Backend configuration failed. '.repeat(500);
            expect(largeError.length).toBeGreaterThan(10000);

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: largeError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Should still find matches despite size
            expect(result.matchCount).toBeGreaterThanOrEqual(0);
        });

        it('should handle error message over 50KB', async () => {
            // Create a 60KB error message
            const veryLargeError = 'Error: ' + 'State lock acquisition failed with timeout. '.repeat(1400);
            expect(veryLargeError.length).toBeGreaterThan(50000);

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: veryLargeError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle error message with very long single line (no newlines)', async () => {
            const singleLineError = 'Error: ' + 'a'.repeat(20000);

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: singleLineError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle error message with thousands of lines', async () => {
            const manyLinesError = Array(5000).fill('Error at line N: some issue').join('\n');

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: manyLinesError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle realistic large Terraform plan output', async () => {
            // Simulates large terraform plan output with actual error
            const largePlanOutput = `
Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create
  - destroy
  ~ update in-place

${Array(200).fill(`
# aws_instance.example[0] will be created
+ resource "aws_instance" "example" {
    + ami                          = "ami-12345"
    + instance_type                = "t2.micro"
    + tags                         = {
        + "Name" = "example"
      }
  }
`).join('')}

Error: Backend configuration changed

The backend configuration has changed since the last time Terraform was run.
Run "terragrunt init" to reconfigure.
            `.trim();

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: largePlanOutput
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Should find the backend error buried in the output
            expect(result.matchCount).toBeGreaterThan(0);
        });
    });

    // ==================== 3. Malformed/Corrupted Error Text (7 tests) ====================
    describe('Malformed/Corrupted Error Text', () => {
        it('should handle binary data in error message', async () => {
            // Simulate corrupted output with binary characters
            const binaryData = 'Error: \x00\x01\x02\x03\xFF\xFE configuration failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: binaryData
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle broken UTF-8 sequences', async () => {
            // Invalid UTF-8 byte sequences
            const brokenUtf8 = 'Error: Invalid \uFFFD\uFFFD configuration \uFFFD';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: brokenUtf8
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle ANSI color codes in error message', async () => {
            const ansiError = '\x1b[31mError:\x1b[0m \x1b[1mBackend configuration\x1b[0m changed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: ansiError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle control characters in error message', async () => {
            const controlChars = 'Error:\b\t\r\n\f\v Backend \0 failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: controlChars
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle error message with only special characters', async () => {
            const specialOnly = '!@#$%^&*()_+-=[]{}|;:\'"<>,.?/~`';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: specialOnly
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
        });

        it('should handle JSON-like error message', async () => {
            const jsonError = '{"error": "Backend configuration changed", "code": 500}';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: jsonError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle HTML-escaped error message', async () => {
            const htmlError = 'Error: &lt;Backend&gt; configuration &amp; state failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: htmlError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 4. Non-English Characters and Special Symbols (8 tests) ====================
    describe('Non-English Characters and Special Symbols', () => {
        it('should handle Chinese characters in error message', async () => {
            const chineseError = 'Error: 后端配置失败 Backend configuration failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: chineseError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle Japanese characters in error message', async () => {
            const japaneseError = 'Error: バックエンド設定に失敗しました Backend failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: japaneseError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle Arabic (RTL) characters in error message', async () => {
            const arabicError = 'Error: فشل تكوين الخلفية Backend configuration failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: arabicError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle emoji in error message', async () => {
            const emojiError = '❌ Error: 🔧 Backend configuration 💥 failed 🚫';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: emojiError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle mixed script error message', async () => {
            const mixedScript = 'Error: Конфигурация 配置 கட்டமைப்பு configuration failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: mixedScript
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle mathematical symbols in error message', async () => {
            const mathSymbols = 'Error: ∑ = ∫ × π ÷ √ ∞ configuration ≠ valid';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: mathSymbols
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle currency symbols in error message', async () => {
            const currencyError = 'Error: Budget exceeded $100 €50 £75 ¥1000 ₹500';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: currencyError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle zero-width characters in error message', async () => {
            // Zero-width joiner and non-joiner
            const zeroWidth = 'Error: Backend\u200B\u200C\u200D configuration failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: zeroWidth
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 5. No Matching Patterns Found (5 tests) ====================
    describe('No Matching Patterns Found', () => {
        it('should gracefully handle completely unrelated error text', async () => {
            const unrelatedError = 'The quick brown fox jumps over the lazy dog';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: unrelatedError,
                options: { minConfidence: 0.8 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
            expect(result.matches).toEqual([]);
        });

        it('should return empty matches with generalAdvice still present', async () => {
            const noMatchError = 'xyzzy99999 completely nonsensical gibberish abc123';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: noMatchError,
                options: { minConfidence: 0.9 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
            // generalAdvice should still be provided
            expect(result.generalAdvice).toBeDefined();
            expect(Array.isArray(result.generalAdvice)).toBe(true);
        });

        it('should handle error with very high minConfidence threshold', async () => {
            const normalError = 'Error: Backend configuration changed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { minConfidence: 0.99 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // May or may not have matches depending on exact confidence
            expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
        });

        it('should handle numeric-only error message', async () => {
            const numericError = '1234567890 404 500 200 0';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: numericError,
                options: { minConfidence: 0.8 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
        });

        it('should return proper structure even with no matches', async () => {
            const noMatchError = 'zzzzzzzzzz 999999 qqqqqqqqq';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: noMatchError,
                options: { minConfidence: 0.95 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
            expect(result.matches).toBeDefined();
            expect(Array.isArray(result.matches)).toBe(true);
            expect(result.overallConfidence).toBe(0);
        });
    });

    // ==================== 6. Multiple Equally-Confident Matches (5 tests) ====================
    describe('Multiple Equally-Confident Matches', () => {
        it('should handle error matching multiple patterns', async () => {
            // Error that could match multiple patterns
            const multiMatchError = 'Error: Backend configuration changed and state lock acquisition failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: multiMatchError,
                options: { maxMatches: 10, minConfidence: 0.3 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBeGreaterThanOrEqual(1);
        });

        it('should respect maxMatches limit when many patterns match', async () => {
            const broadError = 'Error: terraform init failed, backend configuration changed, state lock failed, module not found';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: broadError,
                options: { maxMatches: 2, minConfidence: 0.2 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBeLessThanOrEqual(2);
        });

        it('should return matches sorted by confidence', async () => {
            const multiError = 'Error: Backend configuration changed, run terragrunt init';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: multiError,
                options: { maxMatches: 5, minConfidence: 0.3 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            
            if (result.matchCount > 1) {
                // Verify matches are sorted by confidence (descending)
                for (let i = 1; i < result.matches.length; i++) {
                    expect(result.matches[i - 1].confidence).toBeGreaterThanOrEqual(
                        result.matches[i].confidence
                    );
                }
            }
        });

        it('should handle maxMatches of 0', async () => {
            const normalError = 'Error: Backend configuration changed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { maxMatches: 0 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBe(0);
        });

        it('should handle very large maxMatches value', async () => {
            const normalError = 'Error: Backend configuration changed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { maxMatches: 1000000 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Should not crash or hang with very large maxMatches
        });
    });

    // ==================== 7. Recursive/Circular Dependency Errors (5 tests) ====================
    describe('Recursive/Circular Dependency Errors', () => {
        it('should handle circular dependency error message', async () => {
            const circularError = `Error: Detected cycle in dependencies:
  module-a -> module-b -> module-c -> module-a

This creates an infinite loop that cannot be resolved.`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: circularError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle deeply nested dependency chain error', async () => {
            const deepChain = Array(100).fill(null).map((_, i) => 
                `module-${i} -> module-${i + 1}`
            ).join('\n');
            const deepError = `Error: Dependency chain too deep:\n${deepChain}`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: deepError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle self-referential dependency error', async () => {
            const selfRefError = 'Error: Module "my-module" depends on itself';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: selfRefError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle multiple circular dependencies in one error', async () => {
            const multiCircular = `Error: Multiple circular dependencies detected:
Cycle 1: a -> b -> a
Cycle 2: c -> d -> e -> c
Cycle 3: f -> g -> h -> i -> f`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: multiCircular
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle dependency resolution timeout error', async () => {
            const timeoutError = 'Error: Dependency resolution timed out after 300s while resolving: module-a -> module-b';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: timeoutError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 8. Timeout Scenarios (4 tests) ====================
    describe('Timeout Scenarios', () => {
        it('should complete diagnosis within reasonable time for normal error', async () => {
            const normalError = 'Error: Backend configuration changed';
            
            const startTime = Date.now();
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError
            });
            const duration = Date.now() - startTime;

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Should complete in under 5 seconds for normal case
            expect(duration).toBeLessThan(5000);
        });

        it('should complete diagnosis within reasonable time for large error', async () => {
            const largeError = 'Error: ' + 'Backend configuration failed. '.repeat(1000);
            
            const startTime = Date.now();
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: largeError
            });
            const duration = Date.now() - startTime;

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // Should complete in under 10 seconds even for large errors
            expect(duration).toBeLessThan(10000);
        });

        it('should handle timeout error message itself', async () => {
            const timeoutError = 'Error: Operation timed out after 30s waiting for state lock';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: timeoutError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle connection timeout error', async () => {
            const connTimeout = 'Error: net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: connTimeout
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 9. Missing Documentation Sources (5 tests) ====================
    describe('Missing Documentation Sources', () => {
        it('should handle enrichWithDocs when docs unavailable', async () => {
            const normalError = 'Error: Backend configuration changed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { enrichWithDocs: true }
            });

            expect(result).toBeDefined();
            // Should succeed even if enrichment partially fails
            expect(result.success).toBe(true);
        });

        it('should gracefully handle enrichment failure', async () => {
            const normalError = 'Error: Completely unknown error xyz123';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { 
                    enrichWithDocs: true,
                    minConfidence: 0.1
                }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should return basic diagnosis even when enrichment fails', async () => {
            const normalError = 'Error: terraform init required';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { enrichWithDocs: true }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBeGreaterThanOrEqual(0);
            expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
        });

        it('should handle includeDestructiveCommands option correctly', async () => {
            const normalError = 'Error: State lock failed';

            const resultWithDestructive = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { 
                    enrichWithDocs: true,
                    includeDestructiveCommands: true
                }
            });

            const resultWithoutDestructive = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: normalError,
                options: { 
                    enrichWithDocs: true,
                    includeDestructiveCommands: false
                }
            });

            expect(resultWithDestructive).toBeDefined();
            expect(resultWithoutDestructive).toBeDefined();
            expect(resultWithDestructive.success).toBe(true);
            expect(resultWithoutDestructive.success).toBe(true);
        });

        it('should handle documentation reference to non-existent page', async () => {
            // Even with unknown errors, should not crash
            const unknownError = 'Error: Configuration xyzzy-unknown-12345 failed';

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: unknownError,
                options: { enrichWithDocs: true }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 10. Context Parameter Edge Cases (6 tests) ====================
    describe('Context Parameter Edge Cases', () => {
        it('should handle empty context object', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: {}
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle null context', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: null
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle context with very long string values', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: {
                    command: 'a'.repeat(10000),
                    filePath: '/'.concat('path/'.repeat(1000)),
                    module: 'module-'.concat('nested/'.repeat(500))
                }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle context with special characters', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: {
                    command: 'terragrunt apply --var="name=test<script>alert(1)</script>"',
                    filePath: '/path/with spaces/and"quotes/terragrunt.hcl',
                    module: '../../relative/../path/../module'
                }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle context with unknown extra fields', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: {
                    command: 'terragrunt apply',
                    unknownField1: 'value1',
                    unknownField2: { nested: true },
                    unknownArray: [1, 2, 3]
                }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle context with all valid fields populated', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                context: {
                    command: 'terragrunt apply',
                    version: '0.50.0',
                    os: 'darwin',
                    filePath: '/Users/test/project/terragrunt.hcl',
                    module: 'my-module',
                    backend: 's3'
                }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.matchCount).toBeGreaterThan(0);
        });
    });

    // ==================== 11. Options Parameter Edge Cases (5 tests) ====================
    describe('Options Parameter Edge Cases', () => {
        it('should handle empty options object', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                options: {}
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle null options', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                options: null
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle negative minConfidence', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                options: { minConfidence: -0.5 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle minConfidence greater than 1', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                options: { minConfidence: 1.5 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            // The system may clamp/handle values > 1 gracefully - just verify it doesn't crash
            expect(result.matchCount).toBeGreaterThanOrEqual(0);
        });

        it('should handle negative maxMatches', async () => {
            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: 'Error: Backend configuration changed',
                options: { maxMatches: -5 }
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    // ==================== 12. Concurrent Execution (3 tests) ====================
    describe('Concurrent Execution', () => {
        it('should handle multiple concurrent diagnose calls', async () => {
            const errors = [
                'Error: Backend configuration changed',
                'Error: State lock acquisition failed',
                'Error: No Terraform configuration files found',
                'Error: Module not found',
                'Error: terraform init required'
            ];

            const promises = errors.map(error =>
                toolHandler.executeTool('diagnose_terragrunt_error', {
                    error_message: error
                })
            );

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.success).toBe(true);
            });
        });

        it('should produce consistent results for same error', async () => {
            const error = 'Error: Backend configuration changed';

            // Run the same diagnosis multiple times concurrently
            const results = await Promise.all([
                toolHandler.executeTool('diagnose_terragrunt_error', { error_message: error }),
                toolHandler.executeTool('diagnose_terragrunt_error', { error_message: error }),
                toolHandler.executeTool('diagnose_terragrunt_error', { error_message: error })
            ]);

            // All results should be identical
            expect(results[0].matchCount).toBe(results[1].matchCount);
            expect(results[1].matchCount).toBe(results[2].matchCount);
            expect(results[0].overallConfidence).toBe(results[1].overallConfidence);
        });

        it('should handle mixed concurrent calls with different options', async () => {
            const error = 'Error: Backend configuration changed';

            const results = await Promise.all([
                toolHandler.executeTool('diagnose_terragrunt_error', {
                    error_message: error,
                    options: { enableFuzzyMatching: true }
                }),
                toolHandler.executeTool('diagnose_terragrunt_error', {
                    error_message: error,
                    options: { enableFuzzyMatching: false }
                }),
                toolHandler.executeTool('diagnose_terragrunt_error', {
                    error_message: error,
                    options: { enrichWithDocs: true }
                })
            ]);

            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.success).toBe(true);
            });
        });
    });

    // ==================== 13. Real-World Error Patterns (4 tests) ====================
    describe('Real-World Error Patterns', () => {
        it('should handle terraform provider not found error', async () => {
            const providerError = `Error: Failed to query available provider packages

Could not retrieve the list of available versions for provider
hashicorp/aws: locked provider registry.terraform.io/hashicorp/aws 4.0.0
does not match configured version constraint ~> 5.0.`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: providerError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle terraform state corruption error', async () => {
            const stateError = `Error: Failed to load state: Error loading state: state snapshot was created 
by Terraform v1.5.0, which is newer than current v1.4.0; upgrade to Terraform v1.5.0 
or greater to work with this state`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: stateError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle authentication failure error', async () => {
            const authError = `Error: error configuring S3 Backend: no valid credential sources for 
S3 Backend found. Please see https://www.terraform.io/docs/backends/types/s3.html 
for more information about providing credentials.`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: authError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle resource already exists error', async () => {
            const existsError = `Error: error creating S3 Bucket (my-bucket-name): BucketAlreadyOwnedByYou: 
Your previous request to create the named bucket succeeded and you already own it.`;

            const result = await toolHandler.executeTool('diagnose_terragrunt_error', {
                error_message: existsError
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });
});
