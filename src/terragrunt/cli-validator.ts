/**
 * Terragrunt CLI Validator
 *
 * Provides optional Terragrunt CLI-based validation using `terragrunt hcl fmt --stdin`.
 * This offers more accurate validation than regex-based checking, but requires
 * Terragrunt to be installed and available in PATH.
 *
 * Features:
 * - Automatic detection of Terragrunt availability
 * - Validation via `terragrunt hcl fmt --stdin`
 * - Formatted output when validation succeeds
 * - Graceful fallback when Terragrunt not available
 * - Timeout protection (5 seconds)
 */

import { spawn } from 'child_process';
import { TerragruntValidationResult } from '../types/generator.js';

/**
 * Cache for Terragrunt availability check.
 * - null = not yet checked
 * - true = Terragrunt CLI is available
 * - false = Terragrunt CLI is not available
 *
 * Reset via resetAvailabilityCache() for testing.
 */
let terragruntAvailableCache: boolean | null = null;

/**
 * Timeout for Terragrunt CLI operations (milliseconds)
 */
const TERRAGRUNT_TIMEOUT_MS = 5000;

/**
 * Check if Terragrunt CLI is available in PATH
 * 
 * Results are cached to avoid repeated checks.
 * 
 * @returns Promise resolving to true if Terragrunt is available
 */
/**
 * Checks if the Terragrunt CLI is available on the system.
 * Uses a cache to avoid repeated checks. The check spawns `terragrunt --version`
 * and waits for successful completion with a 2-second timeout.
 *
 * @returns Promise that resolves to true if Terragrunt is available, false otherwise
 *
 * @example
 * ```typescript
 * if (await isTerragruntAvailable()) {
 *   console.log('Terragrunt CLI is installed');
 * }
 * ```
 */
export async function isTerragruntAvailable(): Promise<boolean> {
  // Return cached result if available
  if (terragruntAvailableCache !== null) {
    return terragruntAvailableCache;
  }

  try {
    const result = await new Promise<boolean>((resolve) => {
      const proc = spawn('terragrunt', ['--version']);
      let resolved = false;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve(false);
        }
      }, 2000); // Short timeout for version check

      proc.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });

      proc.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(code === 0);
        }
      });
    });

    terragruntAvailableCache = result;
    return result;
  } catch (error) {
    terragruntAvailableCache = false;
    return false;
  }
}

/**
 * Reset the Terragrunt availability cache
 * (mainly useful for testing)
 */
/**
 * Resets the Terragrunt availability cache.
 * Primarily used for testing to force re-checking CLI availability.
 *
 * @example
 * ```typescript
 * resetAvailabilityCache();
 * const isAvailable = await isTerragruntAvailable(); // Will check again
 * ```
 */
export function resetAvailabilityCache(): void {
  terragruntAvailableCache = null;
}

/**
 * Validate HCL configuration using Terragrunt CLI
 * 
 * Uses `terragrunt hcl fmt --stdin` to validate and format HCL.
 * This provides more accurate validation than regex-based checking.
 * 
 * @param config - HCL configuration to validate
 * @returns Promise resolving to validation result
 */
/**
 * Validates Terragrunt configuration using the Terragrunt CLI.
 * Runs `terragrunt hcl fmt --stdin` to validate and optionally format the configuration.
 * Returns validation results including syntax validity, formatted config, and error messages.
 *
 * @param config - The Terragrunt HCL configuration string to validate
 * @returns Promise resolving to TerragruntValidationResult with validation details
 *
 * @remarks
 * - First checks if Terragrunt CLI is available using isTerragruntAvailable()
 * - If unavailable, returns result with available=false
 * - If available, validates HCL syntax and returns formatted output if valid
 * - Includes a 5-second timeout for validation operations
 * - Errors are parsed from stderr and included in the result
 *
 * @example
 * ```typescript
 * const result = await validateWithTerragrunt('remote_state { backend = "s3" }');
 * if (result.syntaxValid) {
 *   console.log('Valid config:', result.formattedConfig);
 * } else {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export async function validateWithTerragrunt(config: string): Promise<TerragruntValidationResult> {
  // Check if Terragrunt is available
  const available = await isTerragruntAvailable();
  
  if (!available) {
    return {
      available: false,
      syntaxValid: false,
      formatted: false,
      warnings: [],
      errors: ['Terragrunt CLI not available in PATH'],
    };
  }

  return new Promise((resolve) => {
    const proc = spawn('terragrunt', ['hcl', 'fmt', '--stdin']);
    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Set timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({
          available: true,
          syntaxValid: false,
          formatted: false,
          warnings: [],
          errors: ['Terragrunt validation timed out after 5 seconds'],
        });
      }
    }, TERRAGRUNT_TIMEOUT_MS);

    // Collect stdout (formatted config)
    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr (errors)
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process errors
    proc.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          available: true,
          syntaxValid: false,
          formatted: false,
          warnings: [],
          errors: [`Terragrunt process error: ${error.message}`],
        });
      }
    });

    // Handle process exit
    proc.on('exit', (code: number | null) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);

        if (code === 0) {
          // Success - validation passed and config was formatted
          resolve({
            available: true,
            syntaxValid: true,
            formatted: true,
            formattedConfig: stdout,
            warnings: [],
            errors: [],
          });
        } else {
          // Validation failed - parse error messages
          const errors = parseErrorMessages(stderr);
          resolve({
            available: true,
            syntaxValid: false,
            formatted: false,
            warnings: [],
            errors: errors.length > 0 ? errors : ['Terragrunt validation failed (unknown error)'],
          });
        }
      }
    });

    // Write config to stdin
    try {
      proc.stdin.write(config);
      proc.stdin.end();
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          available: true,
          syntaxValid: false,
          formatted: false,
          warnings: [],
          errors: [`Failed to write to Terragrunt stdin: ${error instanceof Error ? error.message : String(error)}`],
        });
      }
    }
  });
}

/**
 * Parse error messages from Terragrunt stderr output
 * 
 * @param stderr - Stderr output from Terragrunt
 * @returns Array of error messages
 */
/**
 * Parses error messages from Terragrunt stderr output.
 * Filters out empty lines and includes only lines that look like error messages.
 *
 * @param stderr - The stderr output from Terragrunt CLI
 * @returns Array of error message strings
 *
 * @internal
 */
function parseErrorMessages(stderr: string): string[] {
  if (!stderr || stderr.trim().length === 0) {
    return [];
  }

  // Split by lines and filter out empty lines
  const lines = stderr.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // If we have specific error patterns, parse them
  // For now, return all non-empty lines
  return lines;
}
