/**
 * Types for Terragrunt configuration generation
 */

import { UseCase } from '../terragrunt/library.js';
import { TerragruntDoc } from '../terragrunt/docs.js';

/**
 * Parameters for generating a Terragrunt configuration
 */
export interface GenerateConfigParams {
  /** The use case to generate config for */
  useCase: UseCase;
  /** Optional backend type (e.g., 's3', 'azurerm', 'gcs') */
  backend?: string;
  /** Optional template tier (essential, advanced, complete). Defaults to essential. */
  tier?: 'essential' | 'advanced' | 'complete';
  /** Configuration options/variables for template substitution */
  options: Record<string, string | number | boolean | undefined>;
  /** Enable strict HCL syntax validation (defaults to false) */
  strictValidation?: boolean;
}

/**
 * Result of configuration generation
 */
export interface GeneratedConfig {
  /** The generated HCL configuration */
  config: string;
  /** Human-readable explanation of the configuration */
  explanation: string;
  /** Related documentation sections */
  relatedDocs: TerragruntDoc[];
  /** Suggested next steps for the user */
  nextSteps: string[];
  /** Additional configuration options that could be added */
  additionalOptions?: string[];
  /** HCL syntax validation results */
  validation?: HCLValidationResult;
}

/**
 * Result of HCL syntax validation
 */
export interface HCLValidationResult {
  /** Whether the HCL syntax is valid */
  syntaxValid: boolean;
  /** Whether the HCL appears to be properly formatted */
  formatted: boolean;
  /** Non-critical issues or suggestions */
  warnings: string[];
  /** Critical syntax errors */
  errors: string[];
}

/**
 * Internal type for variable validation results
 */
export interface VariableValidationResult {
  /** Whether all required variables are satisfied */
  isValid: boolean;
  /** List of missing required variables */
  missingVariables: string[];
  /** Resolved values with defaults applied */
  resolvedValues: Record<string, string | number | boolean>;
}
