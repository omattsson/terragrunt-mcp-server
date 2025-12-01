/**
 * Type definitions for Advanced Code Examples
 * Issue #103: Enhancement - Add Advanced Code Example Responses
 */

/**
 * Categories for advanced Terragrunt code examples
 */
export type AdvancedExampleCategory =
  | 'hooks'           // before_hook, after_hook, error handling
  | 'generate'        // generate blocks for various purposes
  | 'environment'     // environment-specific configurations
  | 'dependencies'    // dependency patterns and mock outputs
  | 'dry-patterns';   // DRY configuration patterns with includes

/**
 * Complexity level for code examples
 */
export type ExampleComplexity = 'basic' | 'intermediate' | 'advanced';

/**
 * Related example reference
 */
export interface RelatedExample {
  /** Example ID */
  id: string;
  /** Brief description of relationship */
  relationship: string;
}

/**
 * Advanced code example definition
 */
export interface AdvancedExample {
  /** Unique identifier for the example */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of what this example demonstrates */
  description: string;
  /** Category this example belongs to */
  category: AdvancedExampleCategory;
  /** Complexity level */
  complexity: ExampleComplexity;
  /** The HCL code for this example */
  code: string;
  /** Use cases where this pattern is applicable */
  useCases: string[];
  /** Best practices when using this pattern */
  bestPractices: string[];
  /** Common pitfalls to avoid */
  pitfalls: string[];
  /** Related examples that complement this one */
  relatedExamples: RelatedExample[];
  /** Searchable tags */
  tags: string[];
  /** URL to official documentation (if applicable) */
  docsUrl?: string;
}

/**
 * Search result for advanced examples
 */
export interface AdvancedExampleSearchResult {
  /** The matched example */
  example: AdvancedExample;
  /** How the match was found */
  matchType: 'id' | 'name' | 'description' | 'tag' | 'use-case';
  /** Relevance score (0-1) */
  score: number;
}

/**
 * Category information for listing
 */
export interface AdvancedExampleCategoryInfo {
  /** Category identifier */
  category: AdvancedExampleCategory;
  /** Human-readable category name */
  name: string;
  /** Category description */
  description: string;
  /** Number of examples in this category */
  exampleCount: number;
}
