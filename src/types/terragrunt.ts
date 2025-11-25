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
    | 'network';

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