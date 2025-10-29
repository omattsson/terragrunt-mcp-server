/**
 * HCL Syntax Validator
 *
 * Provides lightweight regex-based validation for HCL (HashiCorp Configuration Language)
 * syntax to catch common errors in generated Terragrunt configurations.
 *
 * This validator focuses on:
 * - Balanced delimiters (braces, brackets, parentheses, quotes)
 * - Basic HCL structure validation
 * - Common interpolation syntax
 * - Line-by-line error reporting
 *
 * Note: This is not a full HCL parser. It catches common syntax errors but may not
 * detect all possible HCL issues. For complete validation, use `terragrunt validate`.
 */

import { HCLValidationResult } from '../types/generator.js';

/**
 * Validates HCL syntax for a given configuration string
 *
 * @param config - The HCL configuration to validate
 * @returns Validation result with errors, warnings, and formatting info
 */
export function validateHCL(config: string): HCLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let formatted = true;

  // Empty config is technically valid
  if (!config || config.trim().length === 0) {
    return {
      syntaxValid: true,
      formatted: true,
      warnings: [],
      errors: [],
    };
  }

  // Check for balanced delimiters
  const delimiterErrors = checkBalancedDelimiters(config);
  errors.push(...delimiterErrors);

  // Check for unclosed strings
  const stringErrors = checkUnclosedStrings(config);
  errors.push(...stringErrors);

  // Check for valid interpolation syntax
  const interpolationErrors = checkInterpolationSyntax(config);
  errors.push(...interpolationErrors);

  // Check basic formatting (indentation consistency)
  const formattingWarnings = checkFormatting(config);
  warnings.push(...formattingWarnings);
  if (formattingWarnings.length > 0) {
    formatted = false;
  }

  // Check for common HCL structure issues
  const structureWarnings = checkHCLStructure(config);
  warnings.push(...structureWarnings);

  return {
    syntaxValid: errors.length === 0,
    formatted,
    warnings,
    errors,
  };
}

/**
 * Check if all delimiters (braces, brackets, parentheses) are balanced
 * Skips delimiters inside strings
 */
function checkBalancedDelimiters(config: string): string[] {
  const errors: string[] = [];
  const lines = config.split('\n');

  // Track delimiter stacks
  const braceStack: number[] = []; // { }
  const bracketStack: number[] = []; // [ ]
  const parenStack: number[] = []; // ( )

  // Track delimiters line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments but track strings to avoid counting delimiters inside them
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = j < line.length - 1 ? line[j + 1] : '';

      // Handle escape sequences
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      // Handle string boundaries
      if ((char === '"' || char === "'") && !escaped) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }

      // If we're in a string, skip this character
      if (inString) {
        continue;
      }

      // Check for comments (stop processing this line)
      if (char === '#' || (char === '/' && nextChar === '/')) {
        break;
      }

      // Count delimiters only when outside strings and comments
      switch (char) {
        case '{':
          braceStack.push(lineNum);
          break;
        case '}':
          if (braceStack.length === 0) {
            errors.push(`Line ${lineNum}: Unexpected closing brace '}'`);
          } else {
            braceStack.pop();
          }
          break;
        case '[':
          bracketStack.push(lineNum);
          break;
        case ']':
          if (bracketStack.length === 0) {
            errors.push(`Line ${lineNum}: Unexpected closing bracket ']'`);
          } else {
            bracketStack.pop();
          }
          break;
        case '(':
          parenStack.push(lineNum);
          break;
        case ')':
          if (parenStack.length === 0) {
            errors.push(`Line ${lineNum}: Unexpected closing parenthesis ')'`);
          } else {
            parenStack.pop();
          }
          break;
      }
    }
  }

  // Check for unclosed delimiters
  if (braceStack.length > 0) {
    const openLine = braceStack[0];
    errors.push(`Line ${openLine}: Unclosed brace '{'`);
  }
  if (bracketStack.length > 0) {
    const openLine = bracketStack[0];
    errors.push(`Line ${openLine}: Unclosed bracket '['`);
  }
  if (parenStack.length > 0) {
    const openLine = parenStack[0];
    errors.push(`Line ${openLine}: Unclosed parenthesis '('`);
  }

  return errors;
}

/**
 * Remove comments from a line (both # and // style)
 * Preserves # and // inside quoted strings
 */
function removeComments(line: string): string {
  let result = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';

    // Handle escape sequences
    if (escaped) {
      if (inString) {
        result += char;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      if (inString) {
        result += char;
      }
      escaped = true;
      continue;
    }

    // Handle string boundaries
    if ((char === '"' || char === "'") && !escaped) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      continue;
    }

    // If we're in a string, keep everything
    if (inString) {
      result += char;
      continue;
    }

    // Check for comments outside of strings
    if (char === '#') {
      // Rest of line is comment
      break;
    }

    if (char === '/' && nextChar === '/') {
      // Rest of line is comment
      break;
    }

    result += char;
  }

  return result;
}

/**
 * Check for unclosed strings
 */
function checkUnclosedStrings(config: string): string[] {
  const errors: string[] = [];
  const lines = config.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const withoutComments = removeComments(line);

    // Count unescaped quotes
    let doubleQuoteCount = 0;
    let singleQuoteCount = 0;
    let escaped = false;

    for (let j = 0; j < withoutComments.length; j++) {
      const char = withoutComments[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        doubleQuoteCount++;
      } else if (char === "'") {
        singleQuoteCount++;
      }
    }

    if (doubleQuoteCount % 2 !== 0) {
      errors.push(`Line ${lineNum}: Unclosed double quote`);
    }

    if (singleQuoteCount % 2 !== 0) {
      errors.push(`Line ${lineNum}: Unclosed single quote`);
    }
  }

  return errors;
}

/**
 * Check for valid interpolation syntax ${...}
 */
function checkInterpolationSyntax(config: string): string[] {
  const errors: string[] = [];
  const lines = config.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Find interpolations by scanning character by character to handle nesting
    let j = 0;
    while (j < line.length) {
      // Look for start of interpolation
      if (line[j] === '$' && j + 1 < line.length && line[j + 1] === '{') {
        // Found interpolation start
        const startPos = j;
        j += 2; // Skip ${
        
        // Track nested braces
        let braceDepth = 1;
        let interpEnd = -1;

        while (j < line.length && braceDepth > 0) {
          if (line[j] === '{') {
            braceDepth++;
          } else if (line[j] === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              interpEnd = j;
            }
          }
          j++;
        }

        // Extract the full interpolation
        const interp = line.substring(startPos, interpEnd + 1);
        const content = line.substring(startPos + 2, interpEnd);

        // Check for empty interpolation
        if (content.trim().length === 0) {
          errors.push(`Line ${lineNum}: Empty interpolation '\${}'`);
        }

        // Check if interpolation was closed
        if (interpEnd === -1) {
          errors.push(`Line ${lineNum}: Unclosed interpolation starting at position ${startPos}`);
        }
      } else {
        j++;
      }
    }
  }

  return errors;
}

/**
 * Check basic formatting (indentation consistency)
 */
function checkFormatting(config: string): string[] {
  const warnings: string[] = [];
  const lines = config.split('\n');

  // Check for mixed tabs and spaces
  let usesSpaces = false;
  let usesTabs = false;

  for (const line of lines) {
    if (line.trim().length === 0) continue; // Skip empty lines
    
    if (/^\t/.test(line)) {
      usesTabs = true;
    }
    if (/^ /.test(line)) {
      usesSpaces = true;
    }
  }

  if (usesSpaces && usesTabs) {
    warnings.push('Mixed indentation detected - prefer consistent use of spaces or tabs');
  }

  // Check for trailing whitespace
  for (let i = 0; i < lines.length; i++) {
    if (/\s+$/.test(lines[i]) && lines[i].length > 0) {
      warnings.push(`Line ${i + 1}: Trailing whitespace`);
      break; // Report once
    }
  }

  return warnings;
}

/**
 * Check for common HCL structure issues
 */
function checkHCLStructure(config: string): string[] {
  const warnings: string[] = [];
  const lines = config.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Check for common typos in block names
    // Match both `block {` and `block "label" {` patterns
    const blockMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+("[^"]*")?\s*\{|^([a-zA-Z_][a-zA-Z0-9_]*)\s*\{/);
    if (blockMatch) {
      const blockName = blockMatch[1] || blockMatch[3];
      const validBlocks = [
        'remote_state',
        'terraform',
        'generate',
        'dependency',
        'dependencies',
        'inputs',
        'locals',
        'include',
        'before_hook',
        'after_hook',
        'retryable_errors',
        'download_dir',
        'iam_role',
        'iam_assume_role_duration',
        'iam_assume_role_session_name',
      ];

      if (!validBlocks.includes(blockName) && !blockName.startsWith('before_hook') && !blockName.startsWith('after_hook')) {
        warnings.push(`Line ${lineNum}: Unknown block type '${blockName}' - verify this is a valid Terragrunt block`);
      }
    }
  }

  return warnings;
}
