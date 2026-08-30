/**
 * Type definitions for Terragrunt HCL configuration blocks
 */

/**
 * HCL attribute types
 */
export type HCLAttributeType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'list'
  | 'map'
  | 'object'
  | 'block'
  | 'any';

/**
 * Categories for HCL blocks
 */
export type HCLBlockCategory =
  | 'core'           // terraform, remote_state, locals, inputs
  | 'modules'        // include, dependencies, catalogs, units, stacks
  | 'generation'     // generate
  | 'execution'      // feature flags, exclusions, error handling, prevent_destroy
  | 'iam'            // iam_role, iam_assume_role_*, iam_web_identity_token
  | 'terraform';     // engine, binary, version constraints, download_dir

/**
 * Definition for an HCL attribute
 */
export interface HCLAttribute {
  /** Attribute name */
  name: string;
  /** Data type */
  type: HCLAttributeType;
  /** Whether this attribute is required */
  required: boolean;
  /** Description of what this attribute does */
  description: string;
  /** Default value if not specified */
  defaultValue?: string | number | boolean | null;
  /** Example value */
  example?: string;
  /** Valid values for enum-like attributes */
  validValues?: string[];
  /** For nested blocks, the attributes within */
  nestedAttributes?: HCLAttribute[];
}

/**
 * Example usage for an HCL block
 */
export interface HCLExample {
  /** Short description of the example */
  description: string;
  /** HCL code */
  code: string;
}

/**
 * Definition for an HCL block
 */
export interface HCLBlock {
  /** Block name (e.g., 'terraform', 'remote_state') */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Detailed description of the block's purpose */
  description: string;
  /** Category for grouping */
  category: HCLBlockCategory;
  /** Block syntax pattern */
  syntax: string;
  /** Available attributes within this block */
  attributes: HCLAttribute[];
  /** Usage examples */
  examples: HCLExample[];
  /** Related blocks or concepts */
  relatedBlocks?: string[];
  /** Whether this block can be used multiple times */
  allowMultiple?: boolean;
  /** Whether this block requires a label (e.g., dependency "name") */
  requiresLabel?: boolean;
  /** Link to official Terragrunt documentation */
  docsUrl?: string;
}

/**
 * Search result for HCL block queries
 */
export interface HCLBlockSearchResult {
  /** The matching block */
  block: HCLBlock;
  /** Relevance score (0-1) */
  score: number;
  /** How the match was found */
  matchType: 'exact' | 'name' | 'alias' | 'description' | 'attribute';
}

/**
 * Information about an HCL block category
 */
export interface HCLBlockCategoryInfo {
  /** Category identifier */
  category: HCLBlockCategory;
  /** Human-readable name */
  name: string;
  /** Description of this category */
  description: string;
  /** Number of blocks in this category */
  blockCount: number;
}
