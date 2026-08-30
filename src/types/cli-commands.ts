/**
 * Type definitions for Terragrunt CLI command documentation
 */

/**
 * Represents a CLI option/flag for a command
 */
export interface CLIOption {
  /** The flag name (e.g., '--all', '--config') */
  flag: string;
  /** Short flag if available (e.g., '-a') */
  shortFlag?: string;
  /** Description of what the option does */
  description: string;
  /** Type of value the option accepts */
  type: 'boolean' | 'string' | 'integer' | 'list' | 'path';
  /** Default value if any */
  defaultValue?: string;
  /** Environment variable that can set this option */
  envVar?: string;
  /** Whether this option is required */
  required?: boolean;
  /** Example value */
  example?: string;
}

/**
 * Represents a usage example for a command
 */
export interface CLIExample {
  /** Description of what the example demonstrates */
  description: string;
  /** The command to run */
  command: string;
  /** Expected output or result (optional) */
  output?: string;
}

/**
 * Represents a Terragrunt CLI command category
 */
export type CLICommandCategory =
  | 'main'
  | 'backend'
  | 'stack'
  | 'catalog'
  | 'discovery'
  | 'configuration'
  | 'shortcut';

/**
 * Represents a Terragrunt CLI command
 */
export interface CLICommand {
  /** Command name (e.g., 'run', 'hcl fmt') */
  name: string;
  /** Alternative names/aliases, including deprecated aliases where supported */
  aliases: string[];
  /** Removed command names retained only for migration-oriented lookup */
  legacyNames?: string[];
  /** Category of the command */
  category: CLICommandCategory;
  /** Brief description of the command */
  description: string;
  /** Usage syntax */
  usage: string;
  /** Detailed explanation of the command */
  details?: string;
  /** Available options/flags */
  options: CLIOption[];
  /** Usage examples */
  examples: CLIExample[];
  /** Related commands */
  relatedCommands: string[];
  /** Link to official documentation */
  documentationUrl?: string;
  /** Version when this command was introduced/changed */
  since?: string;
  /** Deprecation notice if applicable */
  deprecated?: string;
  /** Notes or warnings */
  notes?: string[];
}

/**
 * Result from searching CLI commands
 */
export interface CLICommandSearchResult {
  /** The matching command */
  command: CLICommand;
  /** Relevance score (0-1) */
  score: number;
  /** How the match was found */
  matchType: 'exact' | 'alias' | 'legacy' | 'partial' | 'fuzzy';
}

/**
 * Category information for grouping commands
 */
export interface CLICommandCategoryInfo {
  /** Category identifier */
  id: CLICommandCategory;
  /** Display name */
  name: string;
  /** Description of this category */
  description: string;
  /** Commands in this category */
  commands: string[];
}
