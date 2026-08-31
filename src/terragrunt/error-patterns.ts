import { TerragruntDocsManager } from './docs.js';
import { SolutionRetriever } from './solution-retriever.js';
import { LRUCache } from 'lru-cache';
import {
  ErrorPattern,
  ErrorContext,
  ErrorMatch,
  ErrorDiagnosisResult,
  EnrichedDiagnosisResult,
  SolutionRetrievalOptions
} from '../types/terragrunt.js';

/**
 * Manages error pattern matching and diagnosis for Terragrunt errors.
 * 
 * This class analyzes error messages from Terragrunt and matches them against
 * known error patterns to provide helpful solutions and debugging steps.
 * 
 * **Database contains 102 error patterns across 11 categories**
 * (counts are computed by getPatternStats and guarded against drift by tests)
 * 
 * Features:
 * - Pattern matching with regex support
 * - Fuzzy matching for partial matches
 * - Confidence scoring (0-1 scale)
 * - Context extraction from error messages
 * - Solution retrieval from documentation
 * 
 * Supported error categories (patterns are thematically organized within these):
 * - configuration: Syntax errors, missing blocks, invalid values, hooks, includes, locals, generate, block expansion (46 patterns)
 * - state: State locking, backend issues (3 patterns)
 * - dependency: Circular dependencies, missing modules, module sources (13 patterns)
 * - backend: S3, GCS, Azure backend and managed azurerm state errors (8 patterns)
 * - terraform: Version mismatches, provider issues (3 patterns)
 * - authentication: AWS, Azure, GCP credential issues (3 patterns)
 * - network: Connectivity, timeout issues (2 patterns)
 * - stack: Typed stack validation failures (6 patterns)
 * - oci: OCI source and credential errors (11 patterns)
 * - engine: IaC engine lifecycle failures (6 patterns)
 * - experiment: Experiment-not-enabled failures (1 pattern)
 */
export class ErrorPatternMatcher {
  private readonly docsManager: TerragruntDocsManager;
  private readonly solutionRetriever: SolutionRetriever;
  private readonly matchCache: LRUCache<string, ErrorMatch[]>;
  private patterns: ErrorPattern[] = [];
  private patternsLoaded: boolean = false;

  /**
   * Maximum edit distance for fuzzy matching as percentage of string length
   */
  private readonly MAX_EDIT_DISTANCE_RATIO = 0.3;

  /**
   * Minimum confidence score to include in results (configurable per-call)
   */
  private readonly DEFAULT_MIN_CONFIDENCE = 0.3;

  /**
   * Maximum number of matches to return (configurable per-call)
   */
  private readonly DEFAULT_MAX_MATCHES = 3;

  /**
   * Confidence score for regex pattern matches
   */
  private readonly REGEX_MATCH_CONFIDENCE = 0.95;

  constructor(docsManager: TerragruntDocsManager) {
    // Store for future use: dynamic pattern extraction from documentation,
    // fetching updated solution links, and cross-referencing error patterns
    // with official Terragrunt docs
    this.docsManager = docsManager;
    
    // Initialize solution retriever for documentation enrichment
    this.solutionRetriever = new SolutionRetriever(docsManager);
    
    // Initialize LRU cache for match results
    this.matchCache = new LRUCache<string, ErrorMatch[]>({
      max: 100, // Cache up to 100 error messages
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });
  }

  /**
   * Load error patterns into memory.
   * This method initializes the pattern database on first use.
   */
  async loadPatterns(): Promise<void> {
    if (this.patternsLoaded) {
      return;
    }

    // Initialize patterns array with all error types
    this.patterns = [
      ...this.getConfigurationErrorPatterns(),
      ...this.getStateErrorPatterns(),
      ...this.getDependencyErrorPatterns(),
      ...this.getBackendErrorPatterns(),
      ...this.getTerraformErrorPatterns(),
      ...this.getAuthenticationErrorPatterns(),
      ...this.getNetworkErrorPatterns(),
      ...this.getModuleSourceErrorPatterns(),
      ...this.getHookErrorPatterns(),
      ...this.getIncludeErrorPatterns(),
      ...this.getLocalsErrorPatterns(),
      ...this.getGenerateErrorPatterns(),
      ...this.getStackErrorPatterns(),
      ...this.getExpansionErrorPatterns(),
      ...this.getOCIErrorPatterns(),
      ...this.getEngineErrorPatterns(),
      ...this.getExperimentErrorPatterns(),
      ...this.getAzureManagedStateErrorPatterns()
    ];

    this.patternsLoaded = true;
  }

  /**
   * Report pattern counts computed from the loaded array.
   *
   * The patterns array is the single source of truth for the documented
   * pattern and category counts. A drift-guard test cross-checks the counts
   * quoted in README.md, the blog post, and this file's JSDoc against this.
   *
   * @returns Total pattern count and a per-category breakdown
   * @throws If two patterns share an id
   */
  async getPatternStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
    await this.loadPatterns();

    const byCategory: Record<string, number> = {};
    const ids = new Set<string>();

    for (const pattern of this.patterns) {
      if (ids.has(pattern.id)) {
        throw new Error(`Duplicate error pattern id: ${pattern.id}`);
      }
      ids.add(pattern.id);
      byCategory[pattern.category] = (byCategory[pattern.category] ?? 0) + 1;
    }

    return { total: this.patterns.length, byCategory };
  }

  /**
   * Mask credential-bearing tokens in text derived from an error message.
   *
   * Diagnosis output must not echo secrets that appear in OCI or cloud
   * credential failures. This masks the secret value only, keeping the
   * surrounding label so the diagnosis stays readable.
   *
   * @param text Text that may contain a secret
   * @returns The text with secret values replaced by ***
   */
  private redactSecrets(text: string): string {
    // Match a credential key with an optional surrounding quote (JSON/HCL keys
    // are quoted), then mask the whole value: a complete quoted string, or an
    // unquoted token consumed up to the next delimiter.
    const key = '(["\']?(?:password|token|secret[\\w-]*)["\']?\\s*[:=]\\s*)';
    return text
      .replace(new RegExp(`${key}"[^"]*"`, 'gi'), '$1"***"')
      .replace(new RegExp(`${key}'[^']*'`, 'gi'), "$1'***'")
      .replace(new RegExp(`${key}[^\\s,;"'}]+`, 'gi'), '$1***')
      .replace(/Authorization:\s*Bearer\s+\S+/gi, 'Authorization: Bearer ***')
      .replace(/AKIA[0-9A-Z]{16}/g, '***');
  }

  /**
   * Redact every string-valued field of an error context.
   *
   * Applied once, at the point where extracted and caller-supplied context are
   * merged, so no path (including the raw stack trace or a caller-provided
   * filePath) can echo a credential in the diagnosis output.
   *
   * @param context The merged error context
   * @returns A copy with all string values passed through redactSecrets
   */
  private redactContext(context: ErrorContext): ErrorContext {
    const redacted: ErrorContext = { ...context };
    for (const key of Object.keys(redacted) as Array<keyof ErrorContext>) {
      const value = redacted[key];
      if (typeof value === 'string') {
        (redacted[key] as string) = this.redactSecrets(value);
      }
    }
    return redacted;
  }

  /**
   * Match an error message against known patterns and provide diagnosis.
   * 
   * @param errorMessage The error message to analyze
   * @param context Optional additional context information
   * @param options Options for matching and enrichment
   * @returns Complete diagnosis with matches, advice, and debugging steps
   */
  async diagnoseError(
    errorMessage: string,
    context?: Partial<ErrorContext>,
    options?: {
      maxMatches?: number;
      minConfidence?: number;
      enableFuzzyMatching?: boolean;
      enrichWithDocs?: boolean;
      enrichmentOptions?: SolutionRetrievalOptions;
    }
  ): Promise<ErrorDiagnosisResult | EnrichedDiagnosisResult> {
    // Handle edge case: empty or null error message
    if (!errorMessage || errorMessage.trim().length === 0) {
      const emptyResult: ErrorDiagnosisResult = {
        matches: [],
        generalAdvice: this.getGeneralAdvice(),
        debuggingSteps: this.getDebuggingSteps(),
        relatedErrors: [],
        overallConfidence: 0
      };

      // Return enriched empty result if enrichment requested
      if (options?.enrichWithDocs) {
        return {
          ...emptyResult,
          richSolutions: [],
          orderedDebuggingSteps: [],
          documentationLinks: [],
          relatedErrorDetails: [],
          enrichmentSuccessful: true
        };
      }

      return emptyResult;
    }

    // Truncate very long error messages for performance (keep first 5000 chars)
    const truncatedMessage = errorMessage.length > 5000
      ? errorMessage.substring(0, 5000)
      : errorMessage;

    // Ensure patterns are loaded
    await this.loadPatterns();

    // Extract options with defaults
    const maxMatches = options?.maxMatches ?? this.DEFAULT_MAX_MATCHES;
    const minConfidence = options?.minConfidence ?? this.DEFAULT_MIN_CONFIDENCE;
    const enableFuzzyMatching = options?.enableFuzzyMatching ?? true;
    const enrichWithDocs = options?.enrichWithDocs ?? false;

    // The context is request-specific (caller-supplied filePath, module, stack
    // trace), but the match cache is keyed on the message and options only.
    // Compute the redacted context fresh on every call and never cache it, so a
    // later request with the same message cannot receive an earlier request's
    // context (or leak its own into the cache).
    const extractedContext = this.extractErrorContext(truncatedMessage);
    const fullContext = this.redactContext({ ...extractedContext, ...context });

    // Check cache first (include options in cache key)
    const cacheKey = this.getCacheKey(truncatedMessage, maxMatches, minConfidence, enableFuzzyMatching);
    const cachedMatches = this.matchCache.get(cacheKey);

    let matches: ErrorMatch[];

    if (cachedMatches) {
      matches = cachedMatches;
    } else {
      // Find all matching patterns
      matches = this.matchError(truncatedMessage, fullContext, {
        maxMatches,
        minConfidence,
        enableFuzzyMatching
      });

      // Cache context-independent match data only; context is re-attached below.
      this.matchCache.set(cacheKey, matches.map(m => ({ ...m, context: {} as ErrorContext })));
    }

    // Attach the fresh, request-specific redacted context to every match.
    matches = matches.map(m => ({ ...m, context: fullContext }));

    // Calculate overall confidence
    const overallConfidence = matches.length > 0
      ? matches[0].confidence
      : 0;

    // Generate basic diagnosis result
    const diagnosis: ErrorDiagnosisResult = {
      matches,
      generalAdvice: this.getGeneralAdvice(),
      debuggingSteps: this.getDebuggingSteps(),
      relatedErrors: this.getRelatedErrors(matches),
      overallConfidence
    };

    // Enrich with documentation if requested
    if (enrichWithDocs) {
      try {
        return await this.solutionRetriever.enrichDiagnosis(
          diagnosis,
          options?.enrichmentOptions
        );
      } catch (error) {
        // Graceful fallback: return enriched result with error flag
        console.error('Failed to enrich diagnosis with documentation:', error);
        return {
          ...diagnosis,
          richSolutions: [],
          orderedDebuggingSteps: diagnosis.debuggingSteps.map((step, i) => ({
            order: i + 1,
            action: step,
            explanation: 'Standard debugging step'
          })),
          documentationLinks: [],
          relatedErrorDetails: [],
          enrichmentSuccessful: false,
          enrichmentError: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return diagnosis;
  }

  /**
   * Match error message against all patterns and return ranked matches.
   */
  private matchError(
    errorMessage: string,
    context: ErrorContext,
    options: {
      maxMatches: number;
      minConfidence: number;
      enableFuzzyMatching: boolean;
    }
  ): ErrorMatch[] {
    const matches: ErrorMatch[] = [];
    const normalizedMessage = errorMessage.toLowerCase();
    let regexMatchCount = 0;

    for (const pattern of this.patterns) {
      // Try exact regex match first
      const regexMatch = pattern.regex.test(errorMessage);
      
      if (regexMatch) {
        matches.push({
          pattern,
          confidence: this.REGEX_MATCH_CONFIDENCE, // 0.95 for regex matches
          context,
          likelyCause: pattern.likelyCauses[0] || 'Unknown cause',
          solutions: pattern.solutions,
          documentationRefs: pattern.documentationRefs
        });
        regexMatchCount++;
        continue;
      }

      // Skip fuzzy matching if disabled
      if (!options.enableFuzzyMatching) {
        continue;
      }
      
      // Skip fuzzy matching if we have enough high-quality regex matches (optimization)
      // Use 2x threshold to account for potential duplicates removed during deduplication
      if (regexMatchCount >= options.maxMatches * 2) {
        continue;
      }

      // Try fuzzy matching on pattern description and name
      const descriptionSimilarity = this.calculateSimilarity(
        pattern.description.toLowerCase(),
        normalizedMessage
      );
      const nameSimilarity = this.calculateSimilarity(
        pattern.name.toLowerCase(),
        normalizedMessage
      );

      const maxSimilarity = Math.max(descriptionSimilarity, nameSimilarity);
      
      // Map similarity to confidence score using the specified ranges
      const confidence = this.mapSimilarityToConfidence(maxSimilarity);

      if (confidence >= options.minConfidence) {
        matches.push({
          pattern,
          confidence,
          context,
          likelyCause: pattern.likelyCauses[0] || 'Unknown cause',
          solutions: pattern.solutions,
          documentationRefs: pattern.documentationRefs
        });
      }
    }

    // Sort by confidence (highest first), deduplicate, and limit results
    return this.deduplicateMatches(matches)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, options.maxMatches);
  }

  /**
   * Extract context information from error message.
   */
  private extractErrorContext(errorMessage: string): ErrorContext {
    const context: ErrorContext = {};

    // Extract command
    const commandMatch = errorMessage.match(/terragrunt\s+([\w-]+)/i);
    if (commandMatch) {
      context.command = `terragrunt ${commandMatch[1]}`;
    }

    // Extract version
    const versionMatch = errorMessage.match(/version[:\s]+v?([\d.]+)/i);
    if (versionMatch) {
      context.version = versionMatch[1];
    }

    // Extract file path
    const fileMatch = errorMessage.match(/(?:in|at|file)\s+([^\s:]+\.(?:hcl|tf|tfvars))/i);
    if (fileMatch) {
      context.filePath = fileMatch[1];
    }

    // Extract line number
    const lineMatch = errorMessage.match(/line\s+(\d+)/i);
    if (lineMatch) {
      context.lineNumber = parseInt(lineMatch[1], 10);
    }

    // Extract stack trace
    if (errorMessage.includes('Stack trace:') || errorMessage.includes('at ')) {
      context.stackTrace = errorMessage.split('\n')
        .filter(line => line.trim().startsWith('at '))
        .join('\n');
    }

    // Extract module/component
    const moduleMatch = errorMessage.match(/module[:\s]+([^\s,]+)/i);
    if (moduleMatch) {
      context.module = moduleMatch[1];
    }

    // Extract backend type
    const backendMatch = errorMessage.match(/backend[:\s]+(s3|gcs|azurerm|azure|local|remote)/i);
    if (backendMatch) {
      context.backend = backendMatch[1];
    }

    // Extract OS (if present)
    const osMatch = errorMessage.match(/\b(linux|darwin|windows|macos)\b/i);
    if (osMatch) {
      context.os = osMatch[1];
    }

    return context;
  }

  /**
   * Calculate raw similarity score between two strings.
   * 
   * @param pattern The pattern to match against
   * @param text The text to search in
   * @returns Raw similarity score 0-1 (1 = perfect match)
   */
  private calculateSimilarity(pattern: string, text: string): number {
    // Check for exact substring match first
    if (text.includes(pattern)) {
      return 1.0;
    }

    // Check for partial word matches
    const patternWords = pattern.split(/\s+/).filter(w => w.length > 0);
    const textWords = text.split(/\s+/).filter(w => w.length > 0);
    
    if (patternWords.length === 0) {
      return 0;
    }
    
    const matchingWords = patternWords.filter(pw => 
      textWords.some(tw => tw.includes(pw) || pw.includes(tw))
    );
    
    if (matchingWords.length > 0) {
      const wordMatchRatio = matchingWords.length / patternWords.length;
      // Scale word matches to 0.6-0.9 similarity range
      return 0.6 + (wordMatchRatio * 0.3);
    }

    // Calculate Levenshtein distance for overall similarity
    // Optimize by truncating very long texts to avoid expensive O(n*m) calculation
    const truncatedText = text.length > 500 ? text.substring(0, 500) : text;
    const distance = this.levenshteinDistance(pattern, truncatedText);
    const maxLength = Math.max(pattern.length, truncatedText.length);
    const similarity = 1 - (distance / maxLength);

    return similarity;
  }

  /**
   * Map raw similarity score to confidence score using specified ranges.
   * 
   * @param similarity Raw similarity score (0-1)
   * @returns Confidence score in appropriate range
   */
  private mapSimilarityToConfidence(similarity: number): number {
    if (similarity > 0.8) {
      // Map 0.8-1.0 to 0.7-0.85
      return 0.7 + (similarity - 0.8) * 0.75;
    } else if (similarity >= 0.5) {
      // Map 0.5-0.8 to 0.4-0.65
      return 0.4 + (similarity - 0.5) * 0.833;
    } else {
      // Map 0.0-0.5 to 0.1-0.35
      return 0.1 + similarity * 0.5;
    }
  }

  /**
   * Deduplicate matches with identical or very similar solutions.
   * 
   * @param matches Array of error matches to deduplicate
   * @returns Deduplicated array keeping highest confidence for each unique solution
   */
  private deduplicateMatches(matches: ErrorMatch[]): ErrorMatch[] {
    const solutionMap = new Map<string, ErrorMatch>();
    
    for (const match of matches) {
      // Create signature from solutions
      const signature = match.solutions
        .map(s => s.explanation.toLowerCase().trim())
        .sort()
        .join('|');
      
      // Keep the match with highest confidence for each unique solution signature
      const existing = solutionMap.get(signature);
      if (!existing || match.confidence > existing.confidence) {
        solutionMap.set(signature, match);
      }
    }
    
    return Array.from(solutionMap.values());
  }

  /**
   * Calculate Levenshtein distance between two strings.
   * This measures the minimum number of single-character edits needed.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first column and row
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Generate cache key for error message including options.
   */
  private getCacheKey(
    errorMessage: string,
    maxMatches: number,
    minConfidence: number,
    enableFuzzyMatching: boolean
  ): string {
    // Use first 200 chars plus options as cache key
    const msgKey = errorMessage.substring(0, 200).toLowerCase().trim();
    return `${msgKey}|${maxMatches}|${minConfidence}|${enableFuzzyMatching}`;
  }

  /**
   * Get general advice applicable to any Terragrunt error.
   */
  private getGeneralAdvice(): string[] {
    return [
      'Check your terragrunt.hcl configuration for syntax errors',
      'Verify all required inputs are provided',
      'Ensure you have the correct Terraform version installed',
      'Check that all dependencies are properly configured',
      'Review the full error message and stack trace for additional context'
    ];
  }

  /**
   * Get generic debugging steps.
   */
  private getDebuggingSteps(): string[] {
    return [
      'Run with --inputs-debug to emit input debugging information',
      'Check terragrunt.hcl syntax and inputs with terragrunt hcl validate --inputs',
      'Verify backend configuration is correct',
      'Clear cache with terragrunt clear-cache',
      'Try running terraform directly to isolate Terragrunt-specific issues'
    ];
  }

  /**
   * Get related error patterns based on matches.
   */
  private getRelatedErrors(matches: ErrorMatch[]): string[] {
    if (matches.length === 0) {
      return [];
    }

    const categories = new Set(matches.map(m => m.pattern.category));
    const related: string[] = [];

    for (const category of categories) {
      const categoryPatterns = this.patterns
        .filter(p => p.category === category)
        .filter(p => !matches.some(m => m.pattern.id === p.id))
        .slice(0, 3)
        .map(p => p.name);
      
      related.push(...categoryPatterns);
    }

    return related.slice(0, 5);
  }

  // ==================== Error Pattern Definitions ====================

  /**
   * Configuration error patterns (14 patterns)
   * Note: Additional configuration-category patterns are returned by
   * getHookErrorPatterns, getIncludeErrorPatterns, getLocalsErrorPatterns,
   * and getGenerateErrorPatterns methods for a total of 38 patterns.
   */
  private getConfigurationErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'config-no-tf-files',
        name: 'No Terraform configuration files found',
        category: 'configuration',
        regex: /no\s+terraform\s+configuration\s+files\s+found/i,
        description: 'Terragrunt cannot find any .tf files in the source directory',
        likelyCauses: [
          'Source path is incorrect or empty',
          'Terraform files are in a different directory',
          'terraform.source is pointing to wrong location'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the terraform.source path in terragrunt.hcl' },
          { step: 2, explanation: 'Check that .tf files exist in the source directory' },
          { step: 3, explanation: 'Ensure the source URL is accessible and correct' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'config-syntax-error',
        name: 'Syntax error in configuration',
        category: 'configuration',
        regex: /syntax\s+error|parse\s+error|invalid\s+hcl/i,
        description: 'HCL syntax error in terragrunt.hcl or .tf files',
        likelyCauses: [
          'Missing closing braces or quotes',
          'Invalid HCL syntax',
          'Incorrect block structure'
        ],
        solutions: [
          { step: 1, explanation: 'Check for matching braces, brackets, and quotes' },
          { step: 2, explanation: 'Validate HCL syntax using terraform fmt or hcl2json' },
          { step: 3, explanation: 'Review the line number indicated in the error' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/'
        ]
      },
      {
        id: 'config-missing-input',
        name: 'Missing required input variable',
        category: 'configuration',
        regex: /required\s+variable.*not\s+set|missing\s+required\s+input/i,
        description: 'A required input variable is not provided',
        likelyCauses: [
          'Input not defined in inputs block',
          'Variable not passed from parent terragrunt.hcl',
          'Typo in variable name'
        ],
        solutions: [
          { step: 1, explanation: 'Add the missing input to the inputs block in terragrunt.hcl' },
          { step: 2, explanation: 'Check for typos in variable names' },
          { step: 3, explanation: 'Verify the variable is exported from parent if using dependency' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#inputs'
        ]
      },
      {
        id: 'config-invalid-block',
        name: 'Invalid configuration block',
        category: 'configuration',
        regex: /invalid\s+block|unsupported\s+block|unexpected\s+block/i,
        description: 'Invalid or unsupported block in terragrunt.hcl',
        likelyCauses: [
          'Typo in block name',
          'Block not supported in this version',
          'Block in wrong location'
        ],
        solutions: [
          { step: 1, explanation: 'Check block name spelling against documentation' },
          { step: 2, explanation: 'Verify Terragrunt version supports this block' },
          { step: 3, explanation: 'Ensure block is at correct nesting level' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/'
        ]
      },
      {
        id: 'config-duplicate-block',
        name: 'Duplicate configuration block',
        category: 'configuration',
        regex: /duplicate\s+block|block.*already\s+defined/i,
        description: 'Configuration block defined multiple times',
        likelyCauses: [
          'Same block appears twice in terragrunt.hcl',
          'Block inherited from include and redefined',
          'Merged includes have duplicate blocks'
        ],
        solutions: [
          { step: 1, explanation: 'Search for duplicate block definitions' },
          { step: 2, explanation: 'Remove or consolidate duplicate blocks' },
          { step: 3, explanation: 'Use merge strategy if intentionally overriding' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/'
        ]
      },
      {
        id: 'config-invalid-attribute',
        name: 'Invalid attribute value',
        category: 'configuration',
        regex: /invalid\s+value|unsupported\s+argument|unexpected\s+attribute/i,
        description: 'Invalid or unsupported attribute in configuration',
        likelyCauses: [
          'Attribute value is wrong type',
          'Attribute not supported for this block',
          'Typo in attribute name'
        ],
        solutions: [
          { step: 1, explanation: 'Check attribute name and type in documentation' },
          { step: 2, explanation: 'Verify attribute is valid for this block type' },
          { step: 3, explanation: 'Check Terragrunt version compatibility' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/'
        ]
      },
      {
        id: 'config-required-attribute-missing',
        name: 'Required attribute missing',
        category: 'configuration',
        regex: /required\s+attribute|missing\s+required\s+argument/i,
        description: 'Required configuration attribute is not provided',
        likelyCauses: [
          'Mandatory attribute not specified',
          'Attribute removed in refactoring',
          'Version upgrade changed requirements'
        ],
        solutions: [
          { step: 1, explanation: 'Add the required attribute to the block' },
          { step: 2, explanation: 'Check documentation for required attributes' },
          { step: 3, explanation: 'Review version upgrade notes if recently upgraded' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/'
        ]
      },
      {
        id: 'config-terraform-source-invalid',
        name: 'Invalid terraform source',
        category: 'configuration',
        regex: /invalid\s+source|terraform\s+source.*invalid|source\s+format/i,
        description: 'The terraform source URL format is invalid',
        likelyCauses: [
          'Malformed URL or path',
          'Unsupported source type',
          'Missing required URL components'
        ],
        solutions: [
          { step: 1, explanation: 'Verify source URL follows Terraform module source format' },
          { step: 2, explanation: 'Check for typos in Git URLs or file paths' },
          { step: 3, explanation: 'Ensure ref parameter is properly formatted for Git sources' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'config-function-error',
        name: 'Function evaluation error',
        category: 'configuration',
        regex: /function.*error|error\s+calling\s+function|function.*failed/i,
        description: 'Error evaluating Terragrunt function',
        likelyCauses: [
          'Function arguments are invalid',
          'Function not available in this context',
          'Runtime error in function execution'
        ],
        solutions: [
          { step: 1, explanation: 'Check function syntax and argument types' },
          { step: 2, explanation: 'Verify function is available in Terragrunt built-in functions' },
          { step: 3, explanation: 'Review function documentation for correct usage' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/functions/'
        ]
      },
      {
        id: 'config-path-not-found',
        name: 'Configuration path not found',
        category: 'configuration',
        regex: /path.*not\s+found|directory.*does\s+not\s+exist|file.*not\s+found.*\.hcl/i,
        description: 'Referenced file or directory does not exist',
        likelyCauses: [
          'Path is incorrect',
          'File was moved or deleted',
          'Relative path resolved incorrectly'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the file or directory exists at specified path' },
          { step: 2, explanation: 'Check if path should be relative or absolute' },
          { step: 3, explanation: 'Use path functions like find_in_parent_folders() if needed' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/functions/#find_in_parent_folders'
        ]
      },
      {
        id: 'config-type-mismatch',
        name: 'Type mismatch error',
        category: 'configuration',
        regex: /type\s+mismatch|expected\s+(?:string|number|bool|list|map)|incorrect\s+type/i,
        description: 'Value type does not match expected type',
        likelyCauses: [
          'String provided where number expected',
          'Incorrect collection type',
          'Type conversion failed'
        ],
        solutions: [
          { step: 1, explanation: 'Check the expected type in documentation' },
          { step: 2, explanation: 'Convert value to correct type (e.g., use tonumber(), tostring())' },
          { step: 3, explanation: 'Review variable definitions and their types' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/expressions/type-constraints.html'
        ]
      },
      {
        id: 'config-remote-state-missing',
        name: 'Remote state configuration missing',
        category: 'configuration',
        regex: /remote[_\s]state.*not\s+configured|backend.*not\s+configured/i,
        description: 'Remote state backend is not configured',
        likelyCauses: [
          'remote_state block missing',
          'Backend type not specified',
          'Configuration incomplete'
        ],
        solutions: [
          { step: 1, explanation: 'Add remote_state block to terragrunt.hcl' },
          { step: 2, explanation: 'Specify backend type (s3, gcs, azurerm, etc.)' },
          { step: 3, explanation: 'Configure required backend attributes' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#remote_state'
        ]
      },
      {
        id: 'config-working-dir-error',
        name: 'Working directory error',
        category: 'configuration',
        regex: /working\s+dir.*error|cannot\s+change\s+directory|chdir\s+failed/i,
        description: 'Cannot access or change to working directory',
        likelyCauses: [
          'Directory does not exist',
          'Insufficient permissions',
          'Path is not a directory'
        ],
        solutions: [
          { step: 1, explanation: 'Verify directory exists and is accessible' },
          { step: 2, explanation: 'Check file system permissions' },
          { step: 3, explanation: 'Ensure path points to a directory, not a file' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/'
        ]
      },
      {
        id: 'config-interpolation-error',
        name: 'Interpolation error',
        category: 'configuration',
        regex: /interpolation.*error|invalid\s+template|template.*failed/i,
        description: 'Error in variable interpolation or template',
        likelyCauses: [
          'Variable not defined',
          'Invalid interpolation syntax',
          'Circular reference in interpolation'
        ],
        solutions: [
          { step: 1, explanation: 'Check variable is defined before use' },
          { step: 2, explanation: 'Verify interpolation syntax ${...}' },
          { step: 3, explanation: 'Look for circular references in variable definitions' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/expressions/strings.html'
        ]
      }
    ];
  }

  /**
   * State management error patterns (3 patterns)
   */
  private getStateErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'state-lock-error',
        name: 'Error acquiring state lock',
        category: 'state',
        regex: /error\s+acquiring\s+(?:the\s+)?state\s+lock|state\s+lock\s+timeout/i,
        description: 'Unable to acquire state lock, usually because another process has it',
        likelyCauses: [
          'Another Terragrunt/Terraform process is running',
          'Previous process crashed without releasing lock',
          'Lock file was not cleaned up properly'
        ],
        solutions: [
          { step: 1, explanation: 'Wait for other processes to complete' },
          { step: 2, explanation: 'Check for stuck processes and kill them if needed' },
          { step: 3, command: 'terragrunt force-unlock <LOCK_ID>', explanation: 'Force unlock if you are sure no other process is running' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/cli/commands/opentofu-shortcuts/'
        ]
      },
      {
        id: 'state-backend-changed',
        name: 'Backend configuration changed',
        category: 'state',
        regex: /backend\s+configuration\s+changed|backend\s+has\s+changed/i,
        description: 'The backend configuration has changed and state needs to be migrated',
        likelyCauses: [
          'Backend bucket/container changed',
          'Backend region changed',
          'Backend configuration was modified'
        ],
        solutions: [
          { step: 1, command: 'terragrunt init -reconfigure', explanation: 'Reconfigure backend with new settings' },
          { step: 2, command: 'terragrunt init -migrate-state', explanation: 'Migrate state to new backend location' },
          { step: 3, explanation: 'Verify the new backend configuration is correct' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/cli/commands/opentofu-shortcuts/'
        ]
      },
      {
        id: 'state-workspace-error',
        name: 'Failed to get existing workspaces',
        category: 'state',
        regex: /failed\s+to\s+get\s+existing\s+workspaces|workspace.*not\s+found/i,
        description: 'Cannot retrieve or access Terraform workspace',
        likelyCauses: [
          'Backend is not properly initialized',
          'Workspace does not exist',
          'Backend credentials are invalid'
        ],
        solutions: [
          { step: 1, command: 'terragrunt init', explanation: 'Initialize the backend' },
          { step: 2, command: 'terragrunt workspace list', explanation: 'List available workspaces' },
          { step: 3, command: 'terragrunt workspace new <name>', explanation: 'Create workspace if it does not exist' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/cli/workspaces/index.html'
        ]
      }
    ];
  }

  /**
   * Dependency error patterns
   */
  private getDependencyErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'dep-circular',
        name: 'Circular dependency detected',
        category: 'dependency',
        regex: /cycle:|circular\s+dependency/i,
        description: 'Modules have circular dependencies which Terraform cannot resolve',
        likelyCauses: [
          'Module A depends on Module B which depends on Module A',
          'Indirect circular dependency through multiple modules',
          'Output references create circular dependency'
        ],
        solutions: [
          { step: 1, explanation: 'Review dependency graph to identify the cycle' },
          { step: 2, explanation: 'Refactor modules to break the circular dependency' },
          { step: 3, explanation: 'Consider using data sources instead of dependencies where appropriate' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#dependencies'
        ]
      },
      {
        id: 'dep-module-not-found',
        name: 'Module not found',
        category: 'dependency',
        regex: /module\s+not\s+found|could\s+not\s+find\s+module/i,
        description: 'Terragrunt cannot locate a referenced module',
        likelyCauses: [
          'Module path is incorrect',
          'Module does not exist at specified location',
          'Git repository or URL is inaccessible'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the module source path in terraform.source' },
          { step: 2, explanation: 'Check that the module exists at the specified location' },
          { step: 3, explanation: 'Ensure Git repository is accessible if using Git source' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'dep-download-error',
        name: 'Could not download source',
        category: 'dependency',
        regex: /could\s+not\s+download\s+source|error\s+downloading/i,
        description: 'Failed to download module source code',
        likelyCauses: [
          'Network connectivity issues',
          'Invalid or inaccessible URL',
          'Authentication required but not provided'
        ],
        solutions: [
          { step: 1, explanation: 'Check network connectivity' },
          { step: 2, explanation: 'Verify the source URL is correct and accessible' },
          { step: 3, explanation: 'Ensure proper credentials are configured for private repositories' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/#remote-opentofuterraform-modules'
        ]
      }
    ];
  }

  /**
   * Backend error patterns
   */
  private getBackendErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'backend-s3-bucket-not-found',
        name: 'S3 bucket does not exist',
        category: 'backend',
        regex: /NoSuchBucket|bucket\s+does\s+not\s+exist|s3.*not\s+found/i,
        description: 'The S3 bucket specified for remote state does not exist',
        likelyCauses: [
          'Bucket name is incorrect',
          'Bucket does not exist in the specified region',
          'Bucket was deleted'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the bucket name in remote_state configuration' },
          { step: 2, command: 'aws s3 ls s3://<bucket-name>', explanation: 'Check if bucket exists' },
          { step: 3, explanation: 'Create the bucket if it does not exist or update configuration' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#remote_state'
        ]
      },
      {
        id: 'backend-access-denied',
        name: 'Access denied to backend',
        category: 'backend',
        regex: /AccessDenied|access\s+denied|permission\s+denied|forbidden/i,
        description: 'Insufficient permissions to access the backend storage',
        likelyCauses: [
          'AWS/Azure/GCP credentials are invalid',
          'IAM policy does not grant required permissions',
          'Bucket policy restricts access'
        ],
        solutions: [
          { step: 1, explanation: 'Verify your cloud provider credentials are valid' },
          { step: 2, explanation: 'Check IAM policies grant s3:GetObject, s3:PutObject permissions' },
          { step: 3, explanation: 'Review bucket policies and ensure your user/role is allowed' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/state-backend/'
        ]
      },
      {
        id: 'backend-gcs-not-found',
        name: 'GCS bucket not found',
        category: 'backend',
        regex: /storage:\s+bucket\s+doesn't\s+exist|gcs.*not\s+found/i,
        description: 'The GCS bucket for remote state does not exist',
        likelyCauses: [
          'Bucket name is incorrect',
          'Bucket does not exist in the project',
          'Wrong GCP project selected'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the bucket name in remote_state configuration' },
          { step: 2, command: 'gsutil ls gs://<bucket-name>', explanation: 'Check if bucket exists' },
          { step: 3, explanation: 'Ensure you are using the correct GCP project' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#remote_state'
        ]
      },
      {
        id: 'backend-azure-not-found',
        name: 'Azure storage account not found',
        category: 'backend',
        regex: /storage\s+account.*not\s+found|azure.*does\s+not\s+exist/i,
        description: 'The Azure storage account for remote state does not exist',
        likelyCauses: [
          'Storage account name is incorrect',
          'Storage account does not exist',
          'Wrong Azure subscription'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the storage account name in remote_state configuration' },
          { step: 2, command: 'az storage account show --name <account-name>', explanation: 'Check if storage account exists' },
          { step: 3, explanation: 'Ensure you are using the correct Azure subscription' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#remote_state'
        ]
      }
    ];
  }

  /**
   * Terraform version and provider error patterns
   */
  private getTerraformErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'tf-version-mismatch',
        name: 'Terraform version constraint not met',
        category: 'terraform',
        regex: /required_version|terraform\s+version.*required|version\s+constraint/i,
        description: 'The installed Terraform version does not meet requirements',
        likelyCauses: [
          'Wrong Terraform version installed',
          'Version constraint in configuration is too strict',
          'Using outdated Terraform binary'
        ],
        solutions: [
          { step: 1, command: 'terraform version', explanation: 'Check your Terraform version' },
          { step: 2, explanation: 'Install the required Terraform version' },
          { step: 3, explanation: 'Update required_version constraint if appropriate' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/settings/index.html#specifying-a-required-terraform-version'
        ]
      },
      {
        id: 'tf-provider-not-found',
        name: 'Provider not found',
        category: 'terraform',
        regex: /provider.*not\s+found|could\s+not\s+find\s+provider/i,
        description: 'Required Terraform provider is not installed',
        likelyCauses: [
          'Provider not specified in required_providers',
          'Provider version constraint cannot be satisfied',
          'Provider registry is inaccessible'
        ],
        solutions: [
          { step: 1, command: 'terragrunt init', explanation: 'Initialize to download providers' },
          { step: 2, explanation: 'Check required_providers block has correct provider configuration' },
          { step: 3, explanation: 'Verify provider version constraint can be satisfied' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/providers/requirements.html'
        ]
      },
      {
        id: 'tf-provider-version',
        name: 'Provider version constraint',
        category: 'terraform',
        regex: /provider.*version\s+constraint|incompatible\s+provider/i,
        description: 'Provider version does not meet requirements',
        likelyCauses: [
          'Installed provider version is too old or too new',
          'Version constraint is too strict',
          'Lock file specifies different version'
        ],
        solutions: [
          { step: 1, explanation: 'Review the provider version constraint in required_providers' },
          { step: 2, command: 'terragrunt init -upgrade', explanation: 'Upgrade providers to latest compatible versions' },
          { step: 3, explanation: 'Delete .terraform.lock.hcl and run init again if needed' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/providers/requirements.html'
        ]
      }
    ];
  }

  /**
   * Authentication error patterns
   */
  private getAuthenticationErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'auth-aws-credentials',
        name: 'AWS credentials not found',
        category: 'authentication',
        regex: /no\s+valid\s+credential|aws.*credential.*not\s+found|unable\s+to\s+locate\s+credentials/i,
        description: 'AWS credentials are not configured or invalid',
        likelyCauses: [
          'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY not set',
          'No AWS profile configured',
          'Credentials are expired or invalid'
        ],
        solutions: [
          { step: 1, command: 'aws configure', explanation: 'Configure AWS credentials' },
          { step: 2, explanation: 'Set AWS_PROFILE environment variable if using named profiles' },
          { step: 3, explanation: 'Verify credentials are valid and not expired' }
        ],
        documentationRefs: [
          'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html'
        ]
      },
      {
        id: 'auth-azure-login',
        name: 'Azure authentication required',
        category: 'authentication',
        regex: /azure.*authentication|az\s+login|subscription.*not\s+found/i,
        description: 'Not authenticated to Azure or subscription not accessible',
        likelyCauses: [
          'Not logged in to Azure CLI',
          'Azure subscription not selected',
          'Service principal credentials invalid'
        ],
        solutions: [
          { step: 1, command: 'az login', explanation: 'Login to Azure' },
          { step: 2, command: 'az account set --subscription <subscription-id>', explanation: 'Set active subscription' },
          { step: 3, explanation: 'Verify service principal credentials if using automation' }
        ],
        documentationRefs: [
          'https://docs.microsoft.com/en-us/cli/azure/authenticate-azure-cli'
        ]
      },
      {
        id: 'auth-gcp-credentials',
        name: 'GCP credentials not found',
        category: 'authentication',
        regex: /gcp.*credential|google.*application.*credentials|gcloud.*auth/i,
        description: 'GCP credentials are not configured',
        likelyCauses: [
          'GOOGLE_APPLICATION_CREDENTIALS not set',
          'Not authenticated with gcloud',
          'Service account key file missing'
        ],
        solutions: [
          { step: 1, command: 'gcloud auth application-default login', explanation: 'Authenticate with application default credentials' },
          { step: 2, explanation: 'Set GOOGLE_APPLICATION_CREDENTIALS to service account key file' },
          { step: 3, explanation: 'Verify project ID is set correctly' }
        ],
        documentationRefs: [
          'https://cloud.google.com/docs/authentication/getting-started'
        ]
      }
    ];
  }

  /**
   * Network error patterns
   */
  private getNetworkErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'network-timeout',
        name: 'Network timeout',
        category: 'network',
        regex: /timeout|timed\s+out|deadline\s+exceeded/i,
        description: 'Network operation timed out',
        likelyCauses: [
          'Network connectivity issues',
          'Firewall blocking connection',
          'Service endpoint is slow or unavailable'
        ],
        solutions: [
          { step: 1, explanation: 'Check network connectivity' },
          { step: 2, explanation: 'Verify firewall rules allow outbound connections' },
          { step: 3, explanation: 'Try again or increase timeout values if configurable' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/cli/'
        ]
      },
      {
        id: 'network-connection-refused',
        name: 'Connection refused',
        category: 'network',
        regex: /connection\s+refused|unable\s+to\s+connect/i,
        description: 'Cannot establish connection to remote service',
        likelyCauses: [
          'Service is not running',
          'Wrong host or port',
          'Firewall blocking connection'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the service endpoint is correct' },
          { step: 2, explanation: 'Check that the service is running and accessible' },
          { step: 3, explanation: 'Review firewall rules and network security groups' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/'
        ]
      }
    ];
  }

  /**
   * Module source error patterns (10+ patterns)
   */
  private getModuleSourceErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'module-git-auth-failed',
        name: 'Git authentication failed',
        category: 'dependency',
        regex: /authentication\s+failed|git.*credentials|could\s+not\s+read\s+from\s+remote/i,
        description: 'Failed to authenticate with Git repository',
        likelyCauses: [
          'SSH key not configured',
          'Git credentials expired or invalid',
          'Repository requires authentication'
        ],
        solutions: [
          { step: 1, explanation: 'Configure SSH keys for Git access' },
          { step: 2, explanation: 'Use SSH URL instead of HTTPS if applicable' },
          { step: 3, explanation: 'Set up Git credential helper for HTTPS' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/'
        ]
      },
      {
        id: 'module-git-ref-not-found',
        name: 'Git ref not found',
        category: 'dependency',
        regex: /ref.*not\s+found|tag.*does\s+not\s+exist|branch.*not\s+found/i,
        description: 'Specified Git tag or branch does not exist',
        likelyCauses: [
          'Tag or branch name is incorrect',
          'Tag/branch was deleted',
          'Typo in ref parameter'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the tag or branch exists in the repository' },
          { step: 2, explanation: 'Check for typos in the ref parameter' },
          { step: 3, explanation: 'Use a valid tag, branch, or commit hash' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html#selecting-a-revision'
        ]
      },
      {
        id: 'module-subdirectory-not-found',
        name: 'Module subdirectory not found',
        category: 'dependency',
        regex: /subdirectory.*not\s+found|path.*does\s+not\s+exist\s+in\s+module/i,
        description: 'Specified subdirectory does not exist in module source',
        likelyCauses: [
          'Subdirectory path is incorrect',
          'Path changed in module version',
          'Double slashes in path'
        ],
        solutions: [
          { step: 1, explanation: 'Verify subdirectory path in module source' },
          { step: 2, explanation: 'Check module structure at specified ref' },
          { step: 3, explanation: 'Ensure path uses forward slashes, not double slashes' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html#modules-in-package-sub-directories'
        ]
      },
      {
        id: 'module-registry-unavailable',
        name: 'Module registry unavailable',
        category: 'dependency',
        regex: /registry.*unavailable|could\s+not\s+query.*registry|registry.*timeout/i,
        description: 'Cannot access Terraform module registry',
        likelyCauses: [
          'Network connectivity issues',
          'Registry is down',
          'Firewall blocking registry access'
        ],
        solutions: [
          { step: 1, explanation: 'Check network connectivity to registry' },
          { step: 2, explanation: 'Verify firewall allows access to registry.terraform.io' },
          { step: 3, explanation: 'Try again later if registry is experiencing issues' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html#terraform-registry'
        ]
      },
      {
        id: 'module-checksum-mismatch',
        name: 'Module checksum mismatch',
        category: 'dependency',
        regex: /checksum.*mismatch|hash.*does\s+not\s+match|integrity\s+check\s+failed/i,
        description: 'Downloaded module checksum does not match expected value',
        likelyCauses: [
          'Module was modified after download',
          'Network corruption during download',
          'Lock file out of sync'
        ],
        solutions: [
          { step: 1, explanation: 'Delete .terraform directory and re-init' },
          { step: 2, explanation: 'Update lock file with correct checksums' },
          { step: 3, explanation: 'Verify module source has not been tampered with' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/cli/commands/providers/lock.html'
        ]
      },
      {
        id: 'module-version-not-found',
        name: 'Module version not found',
        category: 'dependency',
        regex: /version.*not\s+found|no\s+versions\s+matching|version\s+constraint.*not\s+satisfied/i,
        description: 'No module version matches the specified constraint',
        likelyCauses: [
          'Version constraint too strict',
          'Requested version does not exist',
          'Module has no published versions'
        ],
        solutions: [
          { step: 1, explanation: 'Check available versions in module registry or Git tags' },
          { step: 2, explanation: 'Relax version constraint if appropriate' },
          { step: 3, explanation: 'Verify version format is correct (e.g., v1.0.0 vs 1.0.0)' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html#selecting-a-revision'
        ]
      },
      {
        id: 'module-local-path-invalid',
        name: 'Local module path invalid',
        category: 'dependency',
        regex: /local\s+module.*not\s+found|local\s+path.*invalid/i,
        description: 'Local module path is invalid or inaccessible',
        likelyCauses: [
          'Relative path incorrect',
          'Module directory moved or deleted',
          'Path traversal issues'
        ],
        solutions: [
          { step: 1, explanation: 'Verify local module path exists and is correct' },
          { step: 2, explanation: 'Use absolute path or correct relative path' },
          { step: 3, explanation: 'Check file system permissions on module directory' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html#local-paths'
        ]
      },
      {
        id: 'module-cache-corruption',
        name: 'Module cache corrupted',
        category: 'dependency',
        regex: /corrupted\s+module|cache.*invalid|failed\s+to\s+load\s+module\s+cache/i,
        description: 'Module cache is corrupted',
        likelyCauses: [
          'Incomplete download',
          'Disk corruption',
          'Cache directory permissions'
        ],
        solutions: [
          { step: 1, command: 'terragrunt clear-cache', explanation: 'Clear Terragrunt cache' },
          { step: 2, explanation: 'Delete .terraform directory and re-init' },
          { step: 3, explanation: 'Check disk space and file system health' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/cli/'
        ]
      },
      {
        id: 'module-circular-source',
        name: 'Circular module source reference',
        category: 'dependency',
        regex: /circular.*module|module.*references\s+itself/i,
        description: 'Module source creates a circular reference',
        likelyCauses: [
          'Module source points to itself',
          'Indirect circular reference through includes',
          'Parent module depends on child'
        ],
        solutions: [
          { step: 1, explanation: 'Review module source paths for circular references' },
          { step: 2, explanation: 'Refactor module structure to eliminate cycles' },
          { step: 3, explanation: 'Use separate modules for shared components' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'module-archive-error',
        name: 'Module archive extraction error',
        category: 'dependency',
        regex: /failed\s+to\s+extract|archive.*corrupt|unzip\s+error/i,
        description: 'Failed to extract module archive',
        likelyCauses: [
          'Corrupted download',
          'Unsupported archive format',
          'Insufficient disk space'
        ],
        solutions: [
          { step: 1, explanation: 'Delete cached module and retry download' },
          { step: 2, explanation: 'Check available disk space' },
          { step: 3, explanation: 'Verify module archive is not corrupted at source' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/modules/sources.html'
        ]
      }
    ];
  }

  /**
   * Hook execution error patterns (7+ patterns)
   */
  private getHookErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'hook-command-failed',
        name: 'Hook command failed',
        category: 'configuration',
        regex: /hook.*failed|error\s+running.*hook|hook.*exit\s+code/i,
        description: 'Before or after hook command failed',
        likelyCauses: [
          'Command not found',
          'Script error',
          'Insufficient permissions'
        ],
        solutions: [
          { step: 1, explanation: 'Check hook command exists and is executable' },
          { step: 2, explanation: 'Review hook script for errors' },
          { step: 3, explanation: 'Check working directory and environment variables' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-timeout',
        name: 'Hook execution timeout',
        category: 'configuration',
        regex: /hook.*timeout|hook.*timed\s+out/i,
        description: 'Hook command exceeded timeout',
        likelyCauses: [
          'Command takes too long',
          'Process hung or stuck',
          'Timeout value too low'
        ],
        solutions: [
          { step: 1, explanation: 'Increase hook timeout if appropriate' },
          { step: 2, explanation: 'Optimize hook command for performance' },
          { step: 3, explanation: 'Check for infinite loops or blocking operations' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-before-init-failed',
        name: 'Before init hook failed',
        category: 'configuration',
        regex: /before[_-]init.*failed|init.*hook.*error/i,
        description: 'Before init hook execution failed',
        likelyCauses: [
          'Initialization dependencies not met',
          'Script path incorrect',
          'Environment not ready'
        ],
        solutions: [
          { step: 1, explanation: 'Ensure prerequisites for init are met' },
          { step: 2, explanation: 'Check hook script path is correct' },
          { step: 3, explanation: 'Verify required environment variables are set' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-after-apply-failed',
        name: 'After apply hook failed',
        category: 'configuration',
        regex: /after[_-]apply.*failed|apply.*hook.*error/i,
        description: 'After apply hook execution failed',
        likelyCauses: [
          'Post-deployment script error',
          'Resources not yet available',
          'Notification service unreachable'
        ],
        solutions: [
          { step: 1, explanation: 'Review post-deployment script for errors' },
          { step: 2, explanation: 'Add delays if resources need time to become available' },
          { step: 3, explanation: 'Make hooks more resilient with retries' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-env-var-missing',
        name: 'Hook environment variable missing',
        category: 'configuration',
        regex: /hook.*environment|hook.*variable.*not\s+set/i,
        description: 'Required environment variable for hook is missing',
        likelyCauses: [
          'Environment variable not exported',
          'Variable name typo',
          'Shell context different'
        ],
        solutions: [
          { step: 1, explanation: 'Export required environment variables before running Terragrunt' },
          { step: 2, explanation: 'Add environment variables to hook configuration' },
          { step: 3, explanation: 'Use ${get_env()} function to provide defaults' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-working-dir-error',
        name: 'Hook working directory error',
        category: 'configuration',
        regex: /hook.*working.*dir|hook.*chdir\s+failed/i,
        description: 'Cannot access hook working directory',
        likelyCauses: [
          'Directory does not exist',
          'Permissions issue',
          'Path resolution failed'
        ],
        solutions: [
          { step: 1, explanation: 'Verify working directory exists' },
          { step: 2, explanation: 'Check directory permissions' },
          { step: 3, explanation: 'Use absolute paths or path functions' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      },
      {
        id: 'hook-suppress-logs-error',
        name: 'Hook log suppression error',
        category: 'configuration',
        regex: /suppress[_-]logs.*error|hook.*logging\s+failed/i,
        description: 'Error with hook log suppression configuration',
        likelyCauses: [
          'Invalid suppress_stdout value',
          'Logging configuration conflict',
          'Output redirection failed'
        ],
        solutions: [
          { step: 1, explanation: 'Check suppress_stdout and suppress_stderr boolean values' },
          { step: 2, explanation: 'Review hook logging configuration' },
          { step: 3, explanation: 'Enable logging temporarily for debugging' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/hooks/'
        ]
      }
    ];
  }

  /**
   * Include/import error patterns (7+ patterns)
   */
  private getIncludeErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'include-not-found',
        name: 'Include file not found',
        category: 'configuration',
        regex: /include.*not\s+found|failed\s+to\s+read\s+include/i,
        description: 'Referenced include file does not exist',
        likelyCauses: [
          'Include path is incorrect',
          'File was moved or deleted',
          'Path resolution failed'
        ],
        solutions: [
          { step: 1, explanation: 'Verify include file exists at specified path' },
          { step: 2, explanation: 'Check path is correct (absolute or relative)' },
          { step: 3, explanation: 'Use find_in_parent_folders() if searching parent directories' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      },
      {
        id: 'include-circular',
        name: 'Circular include detected',
        category: 'configuration',
        regex: /circular\s+include|include.*cycle/i,
        description: 'Include files create a circular reference',
        likelyCauses: [
          'File A includes file B which includes file A',
          'Indirect circular include through multiple files',
          'Self-referencing include'
        ],
        solutions: [
          { step: 1, explanation: 'Review include chain to identify cycle' },
          { step: 2, explanation: 'Refactor includes to eliminate circular references' },
          { step: 3, explanation: 'Use inheritance hierarchy instead of circular includes' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      },
      {
        id: 'include-merge-conflict',
        name: 'Include merge conflict',
        category: 'configuration',
        regex: /merge\s+conflict|conflicting.*include|cannot\s+merge\s+include/i,
        description: 'Cannot merge configurations from includes',
        likelyCauses: [
          'Conflicting block definitions',
          'Incompatible merge strategies',
          'Duplicate keys with different values'
        ],
        solutions: [
          { step: 1, explanation: 'Review merge strategy configuration' },
          { step: 2, explanation: 'Use explicit merge strategy (shallow, deep, no_merge)' },
          { step: 3, explanation: 'Resolve conflicting definitions in include files' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      },
      {
        id: 'include-parse-error',
        name: 'Include file parse error',
        category: 'configuration',
        regex: /error\s+parsing\s+include|include.*syntax\s+error/i,
        description: 'Syntax error in included file',
        likelyCauses: [
          'HCL syntax error in include file',
          'Invalid configuration structure',
          'Encoding issues'
        ],
        solutions: [
          { step: 1, explanation: 'Check included file for syntax errors' },
          { step: 2, explanation: 'Validate HCL syntax in include file' },
          { step: 3, explanation: 'Ensure file encoding is UTF-8' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      },
      {
        id: 'include-expose-conflict',
        name: 'Include expose configuration conflict',
        category: 'configuration',
        regex: /expose.*conflict|cannot\s+expose\s+include/i,
        description: 'Conflict in include expose configuration',
        likelyCauses: [
          'Multiple includes expose same block',
          'Expose configuration incompatible',
          'Invalid expose value'
        ],
        solutions: [
          { step: 1, explanation: 'Review expose configuration in include blocks' },
          { step: 2, explanation: 'Ensure only one include exposes each block type' },
          { step: 3, explanation: 'Use merge strategies to resolve conflicts' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      },
      {
        id: 'include-path-traversal',
        name: 'Include path traversal limit',
        category: 'configuration',
        regex: /include.*traversal\s+limit|too\s+many\s+parent\s+folders/i,
        description: 'Exceeded limit searching for include file',
        likelyCauses: [
          'File not found in any parent directory',
          'Traversal reached filesystem root',
          'Fallback path not configured'
        ],
        solutions: [
          { step: 1, explanation: 'Verify include file exists in a parent directory' },
          { step: 2, explanation: 'Use specific path instead of find_in_parent_folders()' },
          { step: 3, explanation: 'Configure fallback path in find_in_parent_folders()' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/functions/#find_in_parent_folders'
        ]
      },
      {
        id: 'include-dependency-error',
        name: 'Include dependency resolution error',
        category: 'configuration',
        regex: /include.*dependency|cannot\s+resolve\s+include\s+dependency/i,
        description: 'Cannot resolve dependencies in included configuration',
        likelyCauses: [
          'Dependency defined in include not accessible',
          'Output reference invalid',
          'Dependency execution order wrong'
        ],
        solutions: [
          { step: 1, explanation: 'Verify dependencies in included file are valid' },
          { step: 2, explanation: 'Check dependency paths resolve correctly' },
          { step: 3, explanation: 'Ensure dependency outputs are properly exposed' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#include'
        ]
      }
    ];
  }

  /**
   * Locals block error patterns (5+ patterns)
   */
  private getLocalsErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'locals-undefined-reference',
        name: 'Undefined local reference',
        category: 'configuration',
        regex: /local.*not\s+defined|undefined\s+local|local.*does\s+not\s+exist/i,
        description: 'Referenced local variable is not defined',
        likelyCauses: [
          'Local variable not defined in locals block',
          'Typo in local variable name',
          'Local defined in different scope'
        ],
        solutions: [
          { step: 1, explanation: 'Add the local variable to locals block' },
          { step: 2, explanation: 'Check spelling of local variable name' },
          { step: 3, explanation: 'Verify local is defined in accessible scope' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#locals'
        ]
      },
      {
        id: 'locals-circular-dependency',
        name: 'Circular dependency in locals',
        category: 'configuration',
        regex: /circular.*local|local.*cycle/i,
        description: 'Local variables have circular dependencies',
        likelyCauses: [
          'Local A references local B which references local A',
          'Indirect circular reference through multiple locals',
          'Self-referencing local'
        ],
        solutions: [
          { step: 1, explanation: 'Review locals block for circular references' },
          { step: 2, explanation: 'Refactor locals to eliminate cycles' },
          { step: 3, explanation: 'Use intermediate locals to break dependency chain' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#locals'
        ]
      },
      {
        id: 'locals-evaluation-error',
        name: 'Local evaluation error',
        category: 'configuration',
        regex: /error\s+evaluating\s+local|local.*expression\s+failed/i,
        description: 'Error evaluating local variable expression',
        likelyCauses: [
          'Function call failed',
          'Type error in expression',
          'Null or undefined value'
        ],
        solutions: [
          { step: 1, explanation: 'Check expression syntax and functions' },
          { step: 2, explanation: 'Verify all referenced values exist' },
          { step: 3, explanation: 'Use try() or can() functions for defensive evaluation' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#locals'
        ]
      },
      {
        id: 'locals-type-error',
        name: 'Local type error',
        category: 'configuration',
        regex: /local.*type\s+error|local.*incorrect\s+type/i,
        description: 'Local variable has wrong type',
        likelyCauses: [
          'Expression evaluates to unexpected type',
          'Type conversion failed',
          'Collection type mismatch'
        ],
        solutions: [
          { step: 1, explanation: 'Check expected type for local usage' },
          { step: 2, explanation: 'Use type conversion functions (tostring, tonumber, etc.)' },
          { step: 3, explanation: 'Verify expression returns correct type' }
        ],
        documentationRefs: [
          'https://www.terraform.io/docs/language/expressions/types.html'
        ]
      },
      {
        id: 'locals-merge-error',
        name: 'Locals merge error',
        category: 'configuration',
        regex: /locals.*merge\s+error|cannot\s+merge\s+locals/i,
        description: 'Error merging locals from includes',
        likelyCauses: [
          'Conflicting local definitions',
          'Type incompatibility',
          'Merge strategy not specified'
        ],
        solutions: [
          { step: 1, explanation: 'Review locals in child and parent configs' },
          { step: 2, explanation: 'Use unique local names or merge strategies' },
          { step: 3, explanation: 'Explicitly handle conflicts with conditional logic' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#locals'
        ]
      }
    ];
  }

  /**
   * Generate block error patterns (5+ patterns)
   */
  private getGenerateErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'generate-file-exists',
        name: 'Generated file already exists',
        category: 'configuration',
        regex: /generate.*already\s+exists|cannot\s+generate.*file\s+exists/i,
        description: 'Generated file already exists and cannot be overwritten',
        likelyCauses: [
          'File manually created with same name',
          'Previous generation not cleaned up',
          'Multiple generates target same file'
        ],
        solutions: [
          { step: 1, explanation: 'Remove existing file if safe to do so' },
          { step: 2, explanation: 'Use if_exists = "overwrite" strategy if appropriate' },
          { step: 3, explanation: 'Change generate block path to avoid conflict' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#generate'
        ]
      },
      {
        id: 'generate-permission-denied',
        name: 'Generate permission denied',
        category: 'configuration',
        regex: /generate.*permission\s+denied|cannot\s+write\s+generated\s+file/i,
        description: 'Insufficient permissions to write generated file',
        likelyCauses: [
          'Directory is read-only',
          'File ownership issue',
          'SELinux or security policy blocking'
        ],
        solutions: [
          { step: 1, explanation: 'Check directory permissions' },
          { step: 2, explanation: 'Verify user has write access to target directory' },
          { step: 3, explanation: 'Use different path with appropriate permissions' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#generate'
        ]
      },
      {
        id: 'generate-invalid-path',
        name: 'Generate invalid path',
        category: 'configuration',
        regex: /generate.*invalid\s+path|generate.*path\s+error/i,
        description: 'Generated file path is invalid',
        likelyCauses: [
          'Path contains invalid characters',
          'Path traversal outside working directory',
          'Absolute path not allowed'
        ],
        solutions: [
          { step: 1, explanation: 'Use relative paths within working directory' },
          { step: 2, explanation: 'Avoid path traversal (..) in generate paths' },
          { step: 3, explanation: 'Check path does not contain invalid characters' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#generate'
        ]
      },
      {
        id: 'generate-template-error',
        name: 'Generate template error',
        category: 'configuration',
        regex: /generate.*template\s+error|invalid\s+contents.*generate/i,
        description: 'Error in generate block template',
        likelyCauses: [
          'Invalid HCL in contents',
          'Template interpolation failed',
          'Function error in contents'
        ],
        solutions: [
          { step: 1, explanation: 'Check contents for valid HCL syntax' },
          { step: 2, explanation: 'Verify all interpolations resolve correctly' },
          { step: 3, explanation: 'Test template with simple content first' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#generate'
        ]
      },
      {
        id: 'generate-if-exists-error',
        name: 'Generate if_exists strategy error',
        category: 'configuration',
        regex: /if[_-]exists.*invalid|generate.*strategy\s+error/i,
        description: 'Invalid if_exists strategy in generate block',
        likelyCauses: [
          'Invalid strategy value',
          'Strategy not applicable to situation',
          'Typo in strategy name'
        ],
        solutions: [
          { step: 1, explanation: 'Use valid if_exists values: overwrite, overwrite_terragrunt, skip, error' },
          { step: 2, explanation: 'Choose appropriate strategy for your use case' },
          { step: 3, explanation: 'Check documentation for strategy behavior' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#generate'
        ]
      }
    ];
  }

  /**
   * Typed stack validation error patterns (category: stack, 6 patterns)
   *
   * Anchored to pkg/config/stack_validation.go and pkg/config/errors.go at the
   * pinned upstream revision.
   */
  private getStackErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'stack-config-nil',
        name: 'Stack config is nil',
        category: 'stack',
        regex: /stack\s+config\s+cannot\s+be\s+nil/i,
        description: 'The stack configuration decoded to nothing',
        likelyCauses: [
          'terragrunt.stack.hcl is empty or all blocks were filtered out',
          'The stack file failed to parse before validation',
          'A generated stack produced no units or stacks'
        ],
        solutions: [
          { step: 1, explanation: 'Add at least one unit or stack block to terragrunt.stack.hcl' },
          { step: 2, command: 'terragrunt stack generate', explanation: 'Regenerate the stack and inspect the output' },
          { step: 3, explanation: 'Check for a parse error earlier in the stack file' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#stack'
        ]
      },
      {
        id: 'stack-component-field-empty',
        name: 'Stack component missing a required field',
        category: 'stack',
        regex: /\b(?:unit|stack)\b[^\n]*has\s+empty\s+(?:name|source|path)/i,
        description: 'A unit or stack block is missing a required name, source, or path',
        likelyCauses: [
          'A required attribute was left blank',
          'An interpolation resolved to an empty string',
          'A copied block was not fully filled in'
        ],
        solutions: [
          { step: 1, explanation: 'Set a non-empty name, source, and path on the reported component' },
          { step: 2, explanation: 'Check that any interpolated value resolves to a concrete string' },
          { step: 3, command: 'terragrunt stack generate', explanation: 'Regenerate the stack to see resolved fields' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#unit'
        ]
      },
      {
        id: 'stack-duplicate-name',
        name: 'Duplicate stack component name',
        category: 'stack',
        regex: /duplicate\s+(?:unit|stack)\s+name\s+found/i,
        description: 'Two units or stacks resolve to the same name or address',
        likelyCauses: [
          'Two unit or stack blocks share a name',
          'Expansion keys produce colliding addresses',
          'A copied block was not renamed'
        ],
        solutions: [
          { step: 1, explanation: 'Give each unit and stack block a unique name' },
          { step: 2, explanation: 'Check that expansion keys do not produce colliding addresses' },
          { step: 3, command: 'terragrunt stack generate', explanation: 'Regenerate the stack to see resolved addresses' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#stack'
        ]
      },
      {
        id: 'stack-duplicate-path',
        name: 'Duplicate stack component path',
        category: 'stack',
        regex: /duplicate\s+(?:unit|stack)\s+path\s+found/i,
        description: 'Two components of the same kind generate into the same path',
        likelyCauses: [
          'Two components declare the same path',
          'Expansion produces the same generated path twice',
          'Default paths collide because names match'
        ],
        solutions: [
          { step: 1, explanation: 'Give each component a distinct path' },
          { step: 2, explanation: 'Include the expansion key in the path so instances stay unique' },
          { step: 3, command: 'terragrunt stack generate', explanation: 'Regenerate the stack to see generated paths' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#stack'
        ]
      },
      {
        id: 'stack-cross-kind-path-collision',
        name: 'Unit and stack generate into the same path',
        category: 'stack',
        regex: /duplicate\s+path\s+found\s+across\s+unit\s+and\s+stack/i,
        description: 'A unit and a stack generate into the same on-disk directory',
        likelyCauses: [
          'A unit and a stack share a generated path',
          'Both a unit and a stack default to the same directory',
          'Paths overlap after expansion'
        ],
        solutions: [
          { step: 1, explanation: 'Give the unit and the stack distinct paths' },
          { step: 2, explanation: 'Move one component into its own subdirectory' },
          { step: 3, command: 'terragrunt stack generate', explanation: 'Regenerate the stack to confirm paths no longer overlap' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#stack'
        ]
      },
      {
        id: 'stack-output-fetch-failed',
        name: 'Stack unit output fetch failed',
        category: 'stack',
        regex: /stack\s+unit\s+.+\s+output\s+fetch\s+failed/i,
        description: 'Terragrunt could not read a stack unit output',
        likelyCauses: [
          'The referenced unit has not been applied',
          'The unit state is missing or inaccessible',
          'The output name does not exist on the unit'
        ],
        solutions: [
          { step: 1, explanation: 'Apply the referenced unit before the one that reads its output' },
          { step: 2, explanation: 'Verify the output name exists on the source unit' },
          { step: 3, explanation: 'Check that the unit state backend is reachable' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#dependency'
        ]
      }
    ];
  }

  /**
   * Block expansion error patterns (category: configuration, 8 patterns)
   *
   * Anchored to pkg/config/hclparse/errors.go at the pinned upstream revision.
   * Expansion is a parse-time concern, so these stay in the configuration
   * category; the meta-argument cases require the block-iteration experiment.
   */
  private getExpansionErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'expansion-duplicate-block',
        name: 'More than one expansion block',
        category: 'configuration',
        regex: /declares\s+more\s+than\s+one\s+expansion\s+block/i,
        description: 'A block declares more than one expansion block',
        likelyCauses: [
          'Two expansion blocks in one unit or stack block',
          'A merge added a second expansion block'
        ],
        solutions: [
          { step: 1, explanation: 'Keep at most one expansion block per unit or stack block' },
          { step: 2, explanation: 'Combine the iteration into a single expansion block' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-conflicting-meta-args',
        name: 'Expansion sets both for_each and count',
        category: 'configuration',
        regex: /expansion\s+block\s+sets\s+both\s+for_each\s+and\s+count/i,
        description: 'An expansion block sets both for_each and count',
        likelyCauses: [
          'Both meta-arguments are present',
          'A merge combined two expansion styles'
        ],
        solutions: [
          { step: 1, explanation: 'Set exactly one of for_each or count on the expansion block' },
          { step: 2, explanation: 'Use for_each for keyed instances, count for indexed instances' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-missing-meta-arg',
        name: 'Expansion sets neither for_each nor count',
        category: 'configuration',
        regex: /expansion\s+block\s+sets\s+neither\s+for_each\s+nor\s+count/i,
        description: 'An expansion block sets neither for_each nor count',
        likelyCauses: [
          'The expansion block is empty',
          'The meta-argument was removed by a merge'
        ],
        solutions: [
          { step: 1, explanation: 'Set exactly one of for_each or count on the expansion block' },
          { step: 2, explanation: 'Remove the expansion block if the component is not iterated' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-invalid-count',
        name: 'Expansion count is not a whole number',
        category: 'configuration',
        regex: /count\s+must\s+be\s+a\s+whole\s+number/i,
        description: 'The expansion count did not evaluate to a whole number',
        likelyCauses: [
          'count evaluated to a fraction or a string',
          'A function returned a non-integer value'
        ],
        solutions: [
          { step: 1, explanation: 'Make count evaluate to a whole number' },
          { step: 2, explanation: 'Wrap the expression in tonumber() or floor() if appropriate' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-negative-count',
        name: 'Expansion count is negative',
        category: 'configuration',
        regex: /count\s+is\s+-\d+;\s+it\s+must\s+not\s+be\s+negative/i,
        description: 'The expansion count evaluated to a negative number',
        likelyCauses: [
          'An expression produced a negative count',
          'A subtraction underflowed'
        ],
        solutions: [
          { step: 1, explanation: 'Make count evaluate to zero or a positive whole number' },
          { step: 2, explanation: 'Guard the expression with max(0, ...) if it can go negative' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-limit-exceeded',
        name: 'Expansion exceeds the instance limit',
        category: 'configuration',
        regex: /expands\s+to\s+\d+\s+instances?,\s+which\s+is\s+above\s+the\s+limit\s+of/i,
        description: 'An expansion asked for more instances than the ceiling allows',
        likelyCauses: [
          'for_each or count resolved to a very large collection',
          'An unbounded input drove the instance count'
        ],
        solutions: [
          { step: 1, explanation: 'Reduce the size of the for_each collection or count value' },
          { step: 2, explanation: 'Split the work across more units instead of one large expansion' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-non-concrete-value',
        name: 'Expansion value is not concrete',
        category: 'configuration',
        regex: /is\s+(?:not\s+known\s+at\s+parse\s+time|null);\s+it\s+must\s+resolve\s+to\s+a\s+concrete\s+value/i,
        description: 'A for_each or count value was unknown or null at parse time',
        likelyCauses: [
          'The meta-argument depends on a value not known until apply',
          'The expression resolved to null'
        ],
        solutions: [
          { step: 1, explanation: 'Drive the expansion from a value known at parse time' },
          { step: 2, explanation: 'Avoid dependency outputs or unknown values in for_each and count' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      },
      {
        id: 'expansion-unsupported-foreach',
        name: 'Unsupported for_each type',
        category: 'configuration',
        regex: /for_each\s+(?:must\s+be\s+a\s+set\s+or\s+a\s+map|keys\s+must\s+be\s+strings\s+or\s+numbers),\s+but\s+got/i,
        description: 'for_each received an unsupported type or key type',
        likelyCauses: [
          'for_each was given a list or a scalar instead of a set or map',
          'A for_each key was not a string or a number'
        ],
        solutions: [
          { step: 1, explanation: 'Give for_each a set or a map value' },
          { step: 2, explanation: 'Convert a list with toset() before using it in for_each' },
          { step: 3, explanation: 'Use string or number keys for for_each entries' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      }
    ];
  }

  /**
   * OCI source and credential error patterns (category: oci, 10 patterns)
   *
   * Anchored to internal/getter/oci.go and internal/getter/errors.go at the
   * pinned upstream revision. Solutions never instruct pasting credentials.
   */
  private getOCIErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'oci-missing-registry',
        name: 'OCI source missing a registry domain',
        category: 'oci',
        regex: /oci\s+source\s+is\s+missing\s+a\s+registry\s+domain/i,
        description: 'The OCI source URL has no registry domain',
        likelyCauses: [
          'The oci:// URL omits the registry host',
          'A leading slash pushed the host into the path'
        ],
        solutions: [
          { step: 1, explanation: 'Write the source as oci://<registry>/<repository>' },
          { step: 2, explanation: 'Check the registry host is not empty' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-missing-repository',
        name: 'OCI source missing a repository name',
        category: 'oci',
        regex: /oci\s+source\s+is\s+missing\s+a\s+repository\s+name/i,
        description: 'The OCI source URL has no repository name',
        likelyCauses: [
          'The oci:// URL omits the repository path',
          'Only a registry host was given'
        ],
        solutions: [
          { step: 1, explanation: 'Write the source as oci://<registry>/<repository>' },
          { step: 2, explanation: 'Add the repository path after the registry host' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-invalid-repository',
        name: 'Invalid OCI repository name',
        category: 'oci',
        regex: /invalid\s+oci\s+repository\s+name/i,
        description: 'The OCI repository name is not valid',
        likelyCauses: [
          'The repository name has invalid characters',
          'Uppercase or unsupported separators were used'
        ],
        solutions: [
          { step: 1, explanation: 'Use a lowercase repository name matching the OCI naming rules' },
          { step: 2, explanation: 'Check the registry documentation for allowed characters' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-invalid-digest',
        name: 'Invalid OCI digest',
        category: 'oci',
        regex: /invalid\s+digest\s+"?[^"\s]*"?:/i,
        description: 'The OCI digest reference is not valid',
        likelyCauses: [
          'The digest is not a sha256:<hex> value',
          'The digest was truncated or mistyped'
        ],
        solutions: [
          { step: 1, explanation: 'Use a digest of the form sha256:<64 hex characters>' },
          { step: 2, explanation: 'Copy the digest from the registry rather than typing it' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-invalid-tag',
        name: 'Invalid OCI tag',
        category: 'oci',
        regex: /invalid\s+tag\s+"?[^"\s]*"?:/i,
        description: 'The OCI tag reference is not valid',
        likelyCauses: [
          'The tag has invalid characters',
          'The tag is empty'
        ],
        solutions: [
          { step: 1, explanation: 'Use a tag matching the OCI tag rules' },
          { step: 2, explanation: 'Reference the artifact by a digest instead of a tag for immutability' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-tag-digest-conflict',
        name: 'OCI source sets both tag and digest',
        category: 'oci',
        regex: /cannot\s+set\s+both\s+"tag"\s+and\s+"digest"\s+arguments/i,
        description: 'The OCI source pins both a tag and a digest, which are mutually exclusive',
        likelyCauses: [
          'Both tag and digest were given on the oci:// source',
          'A digest was added without removing the tag'
        ],
        solutions: [
          { step: 1, explanation: 'Set either tag or digest on the OCI source, not both' },
          { step: 2, explanation: 'Prefer a digest for an immutable, reproducible reference' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-helper-malformed',
        name: 'OCI credential helper returned malformed output',
        category: 'oci',
        regex: /oci\s+credential\s+helper\s+returned\s+malformed\s+output/i,
        description: 'The configured OCI credential helper produced unparseable output',
        likelyCauses: [
          'The helper printed extra text alongside the credential JSON',
          'The helper is a wrong or outdated binary'
        ],
        solutions: [
          { step: 1, explanation: 'Confirm the helper returns only the expected credential JSON' },
          { step: 2, explanation: 'Run the helper by hand to inspect its output; do not share the result' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-credential-helper-failed',
        name: 'OCI credential helper failed',
        category: 'oci',
        regex: /oci\s+credential\s+helper\s+"[^"]*"\s+for\s+/i,
        description: 'The OCI credential helper exited with an error',
        likelyCauses: [
          'The helper binary is missing or not on PATH',
          'The registry rejected the credential request',
          'The helper timed out'
        ],
        solutions: [
          { step: 1, explanation: 'Verify the credential helper binary exists and is on PATH' },
          { step: 2, explanation: 'Confirm the registry is reachable and the identity is authorized' },
          { step: 3, explanation: 'Check the helper configuration; keep any secret values out of logs' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-incomplete-basic-cred',
        name: 'Incomplete OCI basic credential',
        category: 'oci',
        regex: /oci_credentials\s+basic\s+auth\s+requires\s+both\s+a\s+username\s+and\s+a\s+password/i,
        description: 'An oci_credentials basic auth block is missing the username or password',
        likelyCauses: [
          'Only one of username or password was set',
          'An env-var reference resolved to empty'
        ],
        solutions: [
          { step: 1, explanation: 'Set both username and password on the oci_credentials block' },
          { step: 2, explanation: 'Provide the values through environment variables and confirm they resolve' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-multiple-credential-styles',
        name: 'OCI credentials set more than one style',
        category: 'oci',
        regex: /oci_credentials\s+block\s+must\s+configure\s+at\s+most\s+one\s+credential\s+style/i,
        description: 'An oci_credentials block mixes more than one credential style',
        likelyCauses: [
          'Both basic auth and a helper were configured',
          'A merge combined two credential styles'
        ],
        solutions: [
          { step: 1, explanation: 'Configure exactly one credential style per oci_credentials block' },
          { step: 2, explanation: 'Split styles into separate blocks scoped to different registries' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      },
      {
        id: 'oci-layer-count',
        name: 'Unexpected OCI layer count',
        category: 'oci',
        regex: /expected\s+exactly\s+one\s+"[^"]*"\s+layer,\s+found\s+\d+/i,
        description: 'The OCI artifact did not contain exactly one module layer',
        likelyCauses: [
          'The artifact is not a Terragrunt module package',
          'The artifact was built with the wrong media type',
          'The wrong repository or tag was referenced'
        ],
        solutions: [
          { step: 1, explanation: 'Reference an artifact packaged as a Terragrunt module' },
          { step: 2, explanation: 'Rebuild the artifact with a single module zip layer' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#terraform'
        ]
      }
    ];
  }

  /**
   * IaC engine lifecycle error patterns (category: engine, 6 patterns)
   *
   * Anchored to internal/engine/engine.go and internal/engine/verification.go
   * at the pinned upstream revision.
   */
  private getEngineErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'engine-init-failed',
        name: 'Engine init failed',
        category: 'engine',
        regex: /engine\s+init\s+failed/i,
        description: 'The IaC engine failed to initialize',
        likelyCauses: [
          'The engine binary is incompatible with this Terragrunt version',
          'The engine returned a non-zero exit code during init',
          'Required engine configuration is missing'
        ],
        solutions: [
          { step: 1, explanation: 'Check the engine version is compatible with Terragrunt' },
          { step: 2, explanation: 'Review the engine block configuration in terragrunt.hcl' },
          { step: 3, explanation: 'Read the engine log lines that precede the failure' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      },
      {
        id: 'engine-shutdown-failed',
        name: 'Engine shutdown failed',
        category: 'engine',
        regex: /engine\s+shutdown\s+failed/i,
        description: 'The IaC engine failed to shut down cleanly',
        likelyCauses: [
          'The engine process crashed before shutdown',
          'A shutdown hook returned an error',
          'The engine was killed externally'
        ],
        solutions: [
          { step: 1, explanation: 'Check for an earlier engine crash in the logs' },
          { step: 2, explanation: 'Retry the command; a clean run usually shuts down without error' },
          { step: 3, explanation: 'Report a reproducible shutdown failure to the engine maintainer' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      },
      {
        id: 'engine-source-empty',
        name: 'Engine source is empty',
        category: 'engine',
        regex: /engine\s+source\s+is\s+empty,\s+cannot\s+create\s+engine/i,
        description: 'The engine block has no source',
        likelyCauses: [
          'The source attribute is missing or blank',
          'An interpolation resolved the source to empty'
        ],
        solutions: [
          { step: 1, explanation: 'Set the source attribute on the engine block' },
          { step: 2, explanation: 'Confirm any interpolated source resolves to a concrete value' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      },
      {
        id: 'engine-download-assets',
        name: 'Failed to download engine assets',
        category: 'engine',
        regex: /failed\s+to\s+download\s+engine\s+assets/i,
        description: 'Terragrunt could not download the engine assets',
        likelyCauses: [
          'Network connectivity to the engine source failed',
          'The engine version or asset does not exist',
          'Authentication to a private engine source is missing'
        ],
        solutions: [
          { step: 1, explanation: 'Check network access to the engine source' },
          { step: 2, explanation: 'Verify the engine source and version reference an existing asset' },
          { step: 3, explanation: 'Provide credentials for a private engine registry if required' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      },
      {
        id: 'engine-integrity',
        name: 'Engine checksum verification failed',
        category: 'engine',
        regex: /checksum\s+list\s+has\s+no\s+entry\s+for/i,
        description: 'The engine checksum list has no entry for a downloaded file',
        likelyCauses: [
          'The checksum list is out of date for this engine version',
          'The downloaded asset was tampered with or corrupted',
          'The wrong checksum file was used'
        ],
        solutions: [
          { step: 1, explanation: 'Re-download the engine assets and retry' },
          { step: 2, explanation: 'Confirm the engine version matches its checksum list' },
          { step: 3, explanation: 'Do not disable verification; investigate the mismatch instead' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      },
      {
        id: 'engine-plugin-spawn',
        name: 'Engine plugin spawn failed',
        category: 'engine',
        regex: /engine\s+plugin\s+spawn/i,
        description: 'Terragrunt could not spawn the engine plugin process',
        likelyCauses: [
          'The engine binary is not executable',
          'The host blocks spawning the plugin process',
          'The engine binary is built for a different platform'
        ],
        solutions: [
          { step: 1, explanation: 'Confirm the engine binary is executable on this host' },
          { step: 2, explanation: 'Check the engine binary matches the host OS and architecture' },
          { step: 3, explanation: 'Review any sandbox or security policy that blocks child processes' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/hcl/blocks/#engine'
        ]
      }
    ];
  }

  /**
   * Experiment-gate error patterns (category: experiment, 1 pattern)
   *
   * Every gate in Terragrunt uses the same phrasing, so one pattern matches
   * them all and separates experiment-not-enabled failures from malformed
   * configuration. Names cited in tests are cross-checked against the #252
   * EXPERIMENTS inventory. Anchored to internal/cli/commands/browse/errors.go,
   * pkg/config/errors.go, and internal/remotestate/backend/azurerm/errors.go.
   */
  private getExperimentErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'experiment-required',
        name: 'Feature requires an experiment',
        category: 'experiment',
        regex: /requires\s+the\s+'[\w-]+'\s+experiment/i,
        description: 'A command, block, or attribute is gated behind a Terragrunt experiment that is not enabled',
        likelyCauses: [
          'The feature is still experimental and off by default',
          'The experiment name is not in the --experiment list',
          'TG_EXPERIMENT does not include the required experiment'
        ],
        solutions: [
          { step: 1, explanation: 'Read the experiment name in single quotes from the error message' },
          { step: 2, command: 'terragrunt <cmd> --experiment <name>', explanation: 'Enable the experiment on the command line' },
          { step: 3, command: 'export TG_EXPERIMENT=<name>', explanation: 'Or enable it through the environment for the session' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/reference/experiments/'
        ]
      }
    ];
  }

  /**
   * Managed azurerm state error patterns (category: backend, 4 patterns)
   *
   * Anchored to pkg/config/dependency_state_azurerm.go and
   * internal/remotestate/backend/azurerm/errors.go at the pinned upstream
   * revision. The azure-backend experiment gate is covered by
   * experiment-required and is not duplicated here.
   */
  private getAzureManagedStateErrorPatterns(): ErrorPattern[] {
    return [
      {
        id: 'azurerm-dependency-state-open',
        name: 'Cannot open azurerm dependency state',
        category: 'backend',
        regex: /opening\s+dependency\s+state\s+at\s+azurerm:\/\//i,
        description: 'Terragrunt could not read a dependency output directly from azurerm state',
        likelyCauses: [
          'The state blob does not exist yet',
          'The identity cannot read the storage container',
          'The storage account or container name is wrong'
        ],
        solutions: [
          { step: 1, explanation: 'Confirm the dependency has been applied and its state blob exists' },
          { step: 2, explanation: 'Grant the identity read access to the state container' },
          { step: 3, explanation: 'Verify the storage account, container, and key in the backend config' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/state-backend/'
        ]
      },
      {
        id: 'azurerm-coordinates-permission',
        name: 'azurerm state coordinates or permissions invalid',
        category: 'backend',
        regex: /verify\s+that\s+resource_group_name,\s+storage_account_name,\s+and\s+subscription_id/i,
        description: 'The azurerm backend could not resolve the state client from the given coordinates',
        likelyCauses: [
          'resource_group_name, storage_account_name, or subscription_id points to a missing resource',
          'The identity may not list storage account keys',
          'The wrong subscription is selected'
        ],
        solutions: [
          { step: 1, explanation: 'Confirm the resource group, storage account, and subscription exist' },
          { step: 2, explanation: 'Grant the identity permission to list storage account keys, or use use_azuread_auth' },
          { step: 3, command: 'az account set --subscription <id>', explanation: 'Select the correct subscription' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/state-backend/'
        ]
      },
      {
        id: 'azurerm-cross-migration',
        name: 'azurerm cross-account or cross-cloud migration unsupported',
        category: 'backend',
        regex: /cross-(?:account|cloud)\s+state\s+migration.*not\s+supported\s+by\s+the\s+azurerm\s+backend/i,
        description: 'The azurerm backend does not support migrating state across accounts or clouds in place',
        likelyCauses: [
          'The storage account changed between runs',
          'The Azure environment or cloud changed between runs'
        ],
        solutions: [
          { step: 1, explanation: 'Migrate via separate init, pull, and push steps' },
          { step: 2, explanation: 'Or keep both units on the same storage account and environment' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/state-backend/'
        ]
      },
      {
        id: 'azurerm-state-client-setup',
        name: 'Building azurerm state client failed',
        category: 'backend',
        regex: /building\s+azurerm\s+state\s+client/i,
        description: 'Terragrunt failed to build the azurerm state client',
        likelyCauses: [
          'Azure authentication failed',
          'The backend configuration is incomplete',
          'The storage endpoint is unreachable'
        ],
        solutions: [
          { step: 1, command: 'az login', explanation: 'Authenticate to Azure' },
          { step: 2, explanation: 'Confirm the remote_state backend config is complete' },
          { step: 3, explanation: 'Check network access to the storage account endpoint' }
        ],
        documentationRefs: [
          'https://docs.terragrunt.com/features/units/state-backend/'
        ]
      }
    ];
  }
}
