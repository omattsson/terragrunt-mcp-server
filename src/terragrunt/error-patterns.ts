import { TerragruntDocsManager } from './docs.js';
import { LRUCache } from 'lru-cache';
import {
  ErrorPattern,
  ErrorContext,
  ErrorMatch,
  ErrorDiagnosisResult
} from '../types/terragrunt.js';

/**
 * Manages error pattern matching and diagnosis for Terragrunt errors.
 * 
 * This class analyzes error messages from Terragrunt and matches them against
 * known error patterns to provide helpful solutions and debugging steps.
 * 
 * Features:
 * - Pattern matching with regex support
 * - Fuzzy matching for partial matches
 * - Confidence scoring (0-1 scale)
 * - Context extraction from error messages
 * - Solution retrieval from documentation
 * 
 * Supported error categories:
 * - configuration: Syntax errors, missing blocks, invalid values
 * - state: State locking, backend issues
 * - dependency: Circular dependencies, missing modules
 * - backend: S3, GCS, Azure backend errors
 * - terraform: Version mismatches, provider issues
 * - authentication: AWS, Azure, GCP credential issues
 * - network: Connectivity, timeout issues
 */
export class ErrorPatternMatcher {
  private readonly docsManager: TerragruntDocsManager;
  private readonly matchCache: LRUCache<string, ErrorMatch[]>;
  private patterns: ErrorPattern[] = [];
  private patternsLoaded: boolean = false;

  /**
   * Maximum edit distance for fuzzy matching as percentage of string length
   */
  private readonly MAX_EDIT_DISTANCE_RATIO = 0.3;

  /**
   * Minimum confidence score to include in results
   */
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.4;

  /**
   * Maximum number of matches to return
   */
  private readonly MAX_MATCHES = 5;

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
    
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
      ...this.getNetworkErrorPatterns()
    ];

    this.patternsLoaded = true;
  }

  /**
   * Match an error message against known patterns and provide diagnosis.
   * 
   * @param errorMessage The error message to analyze
   * @param context Optional additional context information
   * @returns Complete diagnosis with matches, advice, and debugging steps
   */
  async diagnoseError(errorMessage: string, context?: Partial<ErrorContext>): Promise<ErrorDiagnosisResult> {
    // Ensure patterns are loaded
    await this.loadPatterns();

    // Check cache first
    const cacheKey = this.getCacheKey(errorMessage);
    const cachedMatches = this.matchCache.get(cacheKey);
    
    let matches: ErrorMatch[];
    
    if (cachedMatches) {
      matches = cachedMatches;
    } else {
      // Extract context from error message
      const extractedContext = this.extractErrorContext(errorMessage);
      const fullContext = { ...extractedContext, ...context };

      // Find all matching patterns
      matches = this.matchError(errorMessage, fullContext);
      
      // Cache the results
      this.matchCache.set(cacheKey, matches);
    }

    // Calculate overall confidence
    const overallConfidence = matches.length > 0
      ? matches[0].confidence
      : 0;

    // Generate diagnosis result
    return {
      matches,
      generalAdvice: this.getGeneralAdvice(),
      debuggingSteps: this.getDebuggingSteps(),
      relatedErrors: this.getRelatedErrors(matches),
      overallConfidence
    };
  }

  /**
   * Match error message against all patterns and return ranked matches.
   */
  private matchError(errorMessage: string, context: ErrorContext): ErrorMatch[] {
    const matches: ErrorMatch[] = [];
    const normalizedMessage = errorMessage.toLowerCase();

    for (const pattern of this.patterns) {
      // Try exact regex match first
      const regexMatch = pattern.regex.test(errorMessage);
      
      if (regexMatch) {
        matches.push({
          pattern,
          confidence: 1.0, // Exact regex match
          context,
          likelyCause: pattern.likelyCauses[0] || 'Unknown cause',
          solutions: pattern.solutions,
          documentationRefs: pattern.documentationRefs
        });
        continue;
      }

      // Try fuzzy matching on pattern description and name
      const descriptionMatch = this.fuzzyMatch(
        pattern.description.toLowerCase(),
        normalizedMessage
      );
      const nameMatch = this.fuzzyMatch(
        pattern.name.toLowerCase(),
        normalizedMessage
      );

      const confidence = Math.max(descriptionMatch, nameMatch);

      if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
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

    // Sort by confidence (highest first) and limit results
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.MAX_MATCHES);
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

    return context;
  }

  /**
   * Calculate fuzzy match confidence between two strings using Levenshtein distance.
   * 
   * @param pattern The pattern to match against
   * @param text The text to search in
   * @returns Confidence score 0-1 (1 = perfect match)
   */
  private fuzzyMatch(pattern: string, text: string): number {
    // Check for exact substring match first
    if (text.includes(pattern)) {
      return 0.9;
    }

    // Check for partial word matches
    const patternWords = pattern.split(/\s+/);
    const textWords = text.split(/\s+/);
    const matchingWords = patternWords.filter(pw => 
      textWords.some(tw => tw.includes(pw) || pw.includes(tw))
    );
    
    if (matchingWords.length > 0) {
      const wordMatchRatio = matchingWords.length / patternWords.length;
      return 0.5 + (wordMatchRatio * 0.3); // 0.5-0.8 range
    }

    // Calculate Levenshtein distance for overall similarity
    const distance = this.levenshteinDistance(pattern, text);
    const maxLength = Math.max(pattern.length, text.length);
    const similarity = 1 - (distance / maxLength);

    // Only consider it a match if similarity is above threshold
    return similarity > this.MAX_EDIT_DISTANCE_RATIO ? similarity * 0.5 : 0;
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
   * Generate cache key for error message.
   */
  private getCacheKey(errorMessage: string): string {
    // Use first 200 chars as cache key to avoid huge keys
    return errorMessage.substring(0, 200).toLowerCase().trim();
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
      'Run with --terragrunt-debug flag for verbose output',
      'Check terragrunt.hcl syntax with terragrunt validate-inputs',
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
   * Configuration error patterns
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform'
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
          'https://terragrunt.gruntwork.io/docs/getting-started/configuration/'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#inputs'
        ]
      }
    ];
  }

  /**
   * State management error patterns
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
          'https://terragrunt.gruntwork.io/docs/reference/cli-options/#force-unlock'
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
          'https://terragrunt.gruntwork.io/docs/reference/cli-options/#init'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependencies'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform'
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
          'https://terragrunt.gruntwork.io/docs/features/keep-your-terraform-code-dry/#remote-terraform-configurations'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state'
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
          'https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state'
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
          'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state'
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
          'https://terragrunt.gruntwork.io/docs/reference/cli-options/'
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
          'https://terragrunt.gruntwork.io/docs/getting-started/configuration/'
        ]
      }
    ];
  }
}
