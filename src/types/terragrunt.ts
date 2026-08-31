export interface TerragruntConfig {
    version: string;
    terraform: {
        source: string;
        extra_arguments?: ExtraArgument[];
    };
    inputs?: Record<string, any>;
    dependencies?: Dependency[];
}

export interface ExtraArgument {
    arguments: string[];
    commands: string[];
}

export interface Dependency {
    source: string;
    config: string;
}

/**
 * Error category types for pattern matching
 */
export type ErrorCategory =
    | 'configuration'
    | 'state'
    | 'dependency'
    | 'backend'
    | 'terraform'
    | 'authentication'
    | 'network'
    | 'stack'
    | 'engine'
    | 'oci'
    | 'experiment';

/**
 * Represents a known error pattern that can be matched against
 */
export interface ErrorPattern {
    /** Unique identifier for this pattern */
    id: string;
    /** Human-readable name for the error */
    name: string;
    /** Category of the error */
    category: ErrorCategory;
    /** Regex pattern to match the error message */
    regex: RegExp;
    /** Description of what this error means */
    description: string;
    /** Likely causes of this error */
    likelyCauses: string[];
    /** Solutions to fix the error */
    solutions: ErrorSolution[];
    /** Related documentation URLs */
    documentationRefs: string[];
}

/**
 * Context information extracted from an error message
 */
export interface ErrorContext {
    /** The command that was run (e.g., "terragrunt apply") */
    command?: string;
    /** Terragrunt version if detected */
    version?: string;
    /** Operating system if detected */
    os?: string;
    /** Stack trace if present */
    stackTrace?: string;
    /** File path if mentioned in error */
    filePath?: string;
    /** Line number if mentioned in error */
    lineNumber?: number;
    /** Module or component name if detected */
    module?: string;
    /** Backend type if detected (s3, gcs, azurerm, etc.) */
    backend?: string;
}

/**
 * A single solution step to fix an error
 */
export interface ErrorSolution {
    /** Sequential step number */
    step: number;
    /** Command to run (if applicable) */
    command?: string;
    /** Explanation of what to do */
    explanation: string;
    /** Whether this step is optional */
    optional?: boolean;
}

/**
 * Result of matching an error pattern against a message
 */
export interface ErrorMatch {
    /** The pattern that matched */
    pattern: ErrorPattern;
    /** Confidence score 0-1 (1 = perfect match) */
    confidence: number;
    /** Extracted context from the error message */
    context: ErrorContext;
    /** Likely cause (prioritized from pattern.likelyCauses) */
    likelyCause: string;
    /** Solutions to try (from pattern.solutions) */
    solutions: ErrorSolution[];
    /** Related documentation references */
    documentationRefs: string[];
}

/**
 * Complete diagnosis result from error analysis
 */
export interface ErrorDiagnosisResult {
    /** All matches found, sorted by confidence (highest first) */
    matches: ErrorMatch[];
    /** General advice applicable to any Terragrunt error */
    generalAdvice: string[];
    /** Generic debugging steps to try */
    debuggingSteps: string[];
    /** Related error patterns that might be relevant */
    relatedErrors: string[];
    /** Overall confidence in diagnosis (0-1) */
    overallConfidence: number;
}

// ==================== Solution Retrieval Types (Issue #44) ====================

/**
 * Command safety level for solution commands
 */
export type CommandSafetyLevel = 'safe' | 'caution' | 'destructive';

/**
 * An enriched solution step with documentation-sourced information
 */
export interface RichSolution {
    /** Human-readable step description */
    step: string;
    /** Command to run (if applicable) */
    command?: string;
    /** Detailed explanation of what to do and why */
    explanation: string;
    /** Warnings about this solution (e.g., "modifies state") */
    warnings: string[];
    /** Safety level of the command */
    safetyLevel: CommandSafetyLevel;
    /** Source of this solution */
    source: 'pattern' | 'documentation' | 'generated';
    /** Whether this step is optional */
    optional?: boolean;
}

/**
 * An ordered debugging step with optional verification
 */
export interface DebuggingStep {
    /** Order in the debugging sequence (1-based) */
    order: number;
    /** Action to take */
    action: string;
    /** Command to verify this step was successful */
    verificationCommand?: string;
    /** Explanation of why this step helps */
    explanation?: string;
    /** Expected outcome if step succeeds */
    expectedOutcome?: string;
}

/**
 * A link to relevant documentation with excerpt
 */
export interface DocumentationLink {
    /** URL to the documentation page */
    url: string;
    /** Title of the documentation page */
    title: string;
    /** Relevant excerpt from the documentation */
    excerpt: string;
    /** Relevance score 0-1 (1 = highly relevant) */
    relevanceScore: number;
    /** Section within the page if applicable */
    section?: string;
}

/**
 * A related error that might be relevant
 */
export interface RelatedError {
    /** Error pattern ID */
    errorId: string;
    /** Human-readable error name */
    name: string;
    /** Error category */
    category: ErrorCategory;
    /** Reason why this error is related */
    reason: string;
    /** Similarity score 0-1 */
    similarityScore: number;
}

/**
 * Options for solution retrieval
 */
export interface SolutionRetrievalOptions {
    /** Maximum number of solutions to return */
    maxSolutions?: number;
    /** Maximum number of debugging steps */
    maxDebuggingSteps?: number;
    /** Maximum number of documentation links */
    maxDocLinks?: number;
    /** Include commands that modify state */
    includeDestructiveCommands?: boolean;
    /** Search timeout in milliseconds */
    searchTimeoutMs?: number;
}

/**
 * Enriched diagnosis result with documentation-sourced solutions
 */
export interface EnrichedDiagnosisResult extends ErrorDiagnosisResult {
    /** Enriched solutions with documentation context */
    richSolutions: RichSolution[];
    /** Ordered debugging steps with verifications */
    orderedDebuggingSteps: DebuggingStep[];
    /** Links to relevant documentation with excerpts */
    documentationLinks: DocumentationLink[];
    /** Related errors with reasons */
    relatedErrorDetails: RelatedError[];
    /** Whether enrichment was successful */
    enrichmentSuccessful: boolean;
    /** Reason if enrichment failed */
    enrichmentError?: string;
}