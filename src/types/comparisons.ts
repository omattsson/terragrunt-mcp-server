/**
 * Type definitions for HCL block comparisons and pattern guidance
 */

/**
 * Details about a single HCL block in a comparison
 */
export interface BlockDetails {
  /** Block name (e.g., "dependency") */
  name: string;
  /** Brief description of the block's purpose */
  purpose: string;
  /** HCL syntax example */
  syntax: string;
  /** Key features/capabilities of this block */
  keyFeatures: string[];
}

/**
 * A single difference aspect between two blocks
 */
export interface DifferenceAspect {
  /** The aspect being compared (e.g., "Cardinality", "Use Case") */
  aspect: string;
  /** How block1 handles this aspect */
  block1: string;
  /** How block2 handles this aspect */
  block2: string;
}

/**
 * Guidance on when to use each block
 */
export interface UsageGuidance {
  /** Scenarios where block1 is the better choice */
  useBlock1When: string[];
  /** Scenarios where block2 is the better choice */
  useBlock2When: string[];
}

/**
 * Complete comparison between two HCL blocks
 */
export interface BlockComparison {
  /** Unique identifier (e.g., "dependency-vs-dependencies") */
  id: string;
  /** The two blocks being compared */
  blocks: [string, string];
  /** Brief one-line summary of the comparison */
  summary: string;
  /** Detailed information about the first block */
  block1Details: BlockDetails;
  /** Detailed information about the second block */
  block2Details: BlockDetails;
  /** Point-by-point differences */
  keyDifferences: DifferenceAspect[];
  /** When to use each block */
  whenToUse: UsageGuidance;
  /** Common mistakes users make with these blocks */
  commonMistakes: string[];
  /** Related documentation URLs or references */
  relatedDocs: string[];
}

/**
 * Result of a block comparison lookup
 */
export interface BlockComparisonResult {
  /** Whether a comparison was found */
  found: boolean;
  /** The comparison if found */
  comparison?: BlockComparison;
  /** Alternative suggestions if exact match not found */
  suggestions?: string[];
  /** Error message if applicable */
  error?: string;
}

/**
 * A single decision criterion for choosing a pattern
 */
export interface DecisionCriterion {
  /** The criterion to evaluate (e.g., "Need to reference outputs from another module") */
  criterion: string;
  /** The recommended pattern/approach */
  recommendation: string;
  /** Why this recommendation makes sense */
  reason: string;
}

/**
 * A configuration pattern with its trade-offs
 */
export interface ConfigurationPattern {
  /** Pattern name (e.g., "Explicit Dependencies") */
  name: string;
  /** Description of what this pattern does */
  description: string;
  /** HCL code example */
  example: string;
  /** Advantages of this pattern */
  pros: string[];
  /** Disadvantages or limitations */
  cons: string[];
}

/**
 * Complete guidance for a configuration scenario
 */
export interface PatternGuidance {
  /** Unique identifier (e.g., "module-dependency-management") */
  id: string;
  /** Human-readable scenario description */
  scenario: string;
  /** The question this guidance answers */
  question: string;
  /** Keywords for search matching */
  keywords: string[];
  /** Decision criteria to help choose */
  decisionCriteria: DecisionCriterion[];
  /** Available patterns with trade-offs */
  patterns: ConfigurationPattern[];
  /** IDs of related block comparisons */
  relatedComparisons: string[];
}

/**
 * Result of a pattern guidance lookup
 */
export interface PatternGuidanceResult {
  /** Whether guidance was found */
  found: boolean;
  /** The guidance if found */
  guidance?: PatternGuidance;
  /** Alternative suggestions if exact match not found */
  suggestions?: string[];
  /** Error message if applicable */
  error?: string;
}

/**
 * Search match with relevance score
 */
export interface SearchMatch<T> {
  /** The matched item */
  item: T;
  /** Relevance score (0-1) */
  score: number;
  /** Which field(s) matched */
  matchedOn: string[];
}
