import { TerragruntDocsManager, TerragruntDoc } from './docs.js';
import { LRUCache } from 'lru-cache';
import {
  ErrorMatch,
  ErrorDiagnosisResult,
  EnrichedDiagnosisResult,
  RichSolution,
  DebuggingStep,
  DocumentationLink,
  RelatedError,
  SolutionRetrievalOptions,
  CommandSafetyLevel
} from '../types/terragrunt.js';

/**
 * Default options for solution retrieval
 */
const DEFAULT_OPTIONS: Required<SolutionRetrievalOptions> = {
  maxSolutions: 5,
  maxDebuggingSteps: 8,
  maxDocLinks: 3,
  includeDestructiveCommands: true,
  searchTimeoutMs: 5000
};

/**
 * Commands that are considered destructive and require warnings
 */
const DESTRUCTIVE_COMMANDS = [
  'destroy',
  'state rm',
  'state delete',
  'force-unlock',
  'taint',
  '-destroy',
  'rm -rf',
  'delete'
];

/**
 * Commands that modify state but are not destructive
 */
const STATE_MODIFYING_COMMANDS = [
  'apply',
  'import',
  'state mv',
  'state push',
  'state pull',
  'init -reconfigure',
  'init -migrate-state'
];

/**
 * Manages retrieval and enrichment of solutions from documentation.
 * 
 * This class enhances error diagnosis with documentation-sourced solutions,
 * commands, debugging steps, and relevant documentation links.
 * 
 * Features:
 * - Command extraction from markdown code blocks
 * - Command safety validation (safe/caution/destructive)
 * - Troubleshooting step extraction from documentation
 * - Relevance scoring for documentation links
 * - Context-specific debugging step generation
 * - Caching for performance optimization
 */
export class SolutionRetriever {
  private readonly docsManager: TerragruntDocsManager;
  private readonly enrichmentCache: LRUCache<string, EnrichedDiagnosisResult>;

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
    
    // Initialize LRU cache for enriched results
    this.enrichmentCache = new LRUCache<string, EnrichedDiagnosisResult>({
      max: 50, // Cache up to 50 enriched diagnoses
      ttl: 1000 * 60 * 10, // 10 minute TTL
      updateAgeOnGet: true
    });
  }

  // ==================== Public API ====================

  /**
   * Enrich a diagnosis result with documentation-sourced solutions.
   * 
   * @param diagnosis The original diagnosis result from ErrorPatternMatcher
   * @param options Options for solution retrieval
   * @returns Enriched diagnosis with documentation context
   */
  async enrichDiagnosis(
    diagnosis: ErrorDiagnosisResult,
    options: SolutionRetrievalOptions = {}
  ): Promise<EnrichedDiagnosisResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Generate cache key from diagnosis and options
    const cacheKey = this.generateCacheKey(diagnosis, opts);
    
    // Check cache first
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Search for relevant documentation
      const relevantDocs = await this.searchRelevantDocs(diagnosis, opts);
      
      // Enrich solutions with documentation
      const richSolutions = await this.enrichSolutions(diagnosis, relevantDocs, opts);
      
      // Generate ordered debugging steps
      const orderedDebuggingSteps = this.generateDebuggingSteps(diagnosis, relevantDocs, opts);
      
      // Create documentation links
      const documentationLinks = this.createDocumentationLinks(relevantDocs, diagnosis, opts);
      
      // Find related errors with reasons
      const relatedErrorDetails = this.findRelatedErrors(diagnosis, opts);

      const enrichedResult: EnrichedDiagnosisResult = {
        ...diagnosis,
        richSolutions,
        orderedDebuggingSteps,
        documentationLinks,
        relatedErrorDetails,
        enrichmentSuccessful: true
      };

      // Cache the result
      this.enrichmentCache.set(cacheKey, enrichedResult);

      return enrichedResult;
    } catch (error) {
      // Return diagnosis with enrichment error
      return {
        ...diagnosis,
        richSolutions: this.convertToRichSolutions(diagnosis),
        orderedDebuggingSteps: this.convertToDebuggingSteps(diagnosis.debuggingSteps),
        documentationLinks: [],
        relatedErrorDetails: [],
        enrichmentSuccessful: false,
        enrichmentError: error instanceof Error ? error.message : 'Unknown enrichment error'
      };
    }
  }

  // ==================== Documentation Search ====================

  /**
   * Search for documentation relevant to the diagnosis.
   */
  private async searchRelevantDocs(
    diagnosis: ErrorDiagnosisResult,
    opts: Required<SolutionRetrievalOptions>
  ): Promise<TerragruntDoc[]> {
    if (diagnosis.matches.length === 0) {
      return [];
    }

    const searchQueries = this.generateSearchQueries(diagnosis);
    const allDocs: TerragruntDoc[] = [];
    const seenUrls = new Set<string>();

    // Search with per-query timeout
    for (const query of searchQueries.slice(0, 5)) {
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<TerragruntDoc[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Search timeout')), opts.searchTimeoutMs);
      });

      try {
        const docsPromise = this.docsManager.searchDocs(query);
        const docs = await Promise.race([docsPromise, timeoutPromise]);
        clearTimeout(timeoutId!); // Clear timeout on success
        
        for (const doc of docs) {
          if (!seenUrls.has(doc.url)) {
            seenUrls.add(doc.url);
            allDocs.push(doc);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId!); // Clear timeout on error
        if (error instanceof Error && error.message === 'Search timeout') {
          console.warn(`Documentation search timed out for query: ${query}`);
          continue; // Continue to next query instead of breaking
        }
        throw error;
      }
    }

    return allDocs;
  }

  /**
   * Generate search queries based on diagnosis.
   */
  private generateSearchQueries(diagnosis: ErrorDiagnosisResult): string[] {
    const queries: string[] = [];

    for (const match of diagnosis.matches) {
      // Search by pattern name
      queries.push(match.pattern.name);
      
      // Search by category
      queries.push(match.pattern.category);
      
      // Search by key words from description
      const keywords = this.extractKeywords(match.pattern.description);
      queries.push(...keywords);
      
      // Search by likely cause
      if (match.likelyCause) {
        queries.push(match.likelyCause);
      }
    }

    // Deduplicate and return
    return [...new Set(queries)];
  }

  /**
   * Extract important keywords from text.
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
      'until', 'while', 'this', 'that', 'these', 'those'
    ]);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }

  // ==================== Solution Enrichment ====================

  /**
   * Enrich solutions with documentation context.
   */
  private async enrichSolutions(
    diagnosis: ErrorDiagnosisResult,
    docs: TerragruntDoc[],
    opts: Required<SolutionRetrievalOptions>
  ): Promise<RichSolution[]> {
    const richSolutions: RichSolution[] = [];

    // Convert existing pattern solutions to rich solutions
    for (const match of diagnosis.matches) {
      for (const solution of match.solutions) {
        const richSolution = this.convertSolutionToRich(solution, match);
        
        // Filter out destructive commands if not allowed
        if (!opts.includeDestructiveCommands && richSolution.safetyLevel === 'destructive') {
          continue;
        }
        
        richSolutions.push(richSolution);
      }
    }

    // Extract additional solutions from documentation
    const docSolutions = this.extractSolutionsFromDocs(docs, diagnosis, opts);
    richSolutions.push(...docSolutions);

    // Deduplicate and limit
    return this.deduplicateSolutions(richSolutions).slice(0, opts.maxSolutions);
  }

  /**
   * Convert a pattern solution to a rich solution.
   */
  private convertSolutionToRich(
    solution: { step: number; command?: string; explanation: string; optional?: boolean },
    _match: ErrorMatch
  ): RichSolution {
    const safetyLevel = solution.command 
      ? this.validateCommand(solution.command)
      : 'safe';
    
    const warnings = this.generateWarnings(solution.command, safetyLevel);

    return {
      step: `Step ${solution.step}: ${this.summarizeExplanation(solution.explanation)}`,
      command: solution.command,
      explanation: solution.explanation,
      warnings,
      safetyLevel,
      source: 'pattern',
      optional: solution.optional
    };
  }

  /**
   * Summarize an explanation to a short step description.
   */
  private summarizeExplanation(explanation: string): string {
    // Take first sentence or first 60 chars
    const firstSentence = explanation.split(/[.!?]/)[0];
    if (firstSentence.length <= 60) {
      return firstSentence;
    }
    return firstSentence.substring(0, 57) + '...';
  }

  /**
   * Extract solutions from documentation content.
   */
  private extractSolutionsFromDocs(
    docs: TerragruntDoc[],
    diagnosis: ErrorDiagnosisResult,
    opts: Required<SolutionRetrievalOptions>
  ): RichSolution[] {
    const solutions: RichSolution[] = [];

    for (const doc of docs.slice(0, 5)) {
      // Extract commands from code blocks
      const commands = this.parseCommandsFromMarkdown(doc.content);
      
      // Extract troubleshooting steps
      const steps = this.extractTroubleshootingSteps(doc.content);

      // Create solutions from extracted commands
      for (const cmd of commands.slice(0, 3)) {
        const safetyLevel = this.validateCommand(cmd.command);
        
        if (!opts.includeDestructiveCommands && safetyLevel === 'destructive') {
          continue;
        }

        solutions.push({
          step: cmd.description || `Run: ${cmd.command}`,
          command: cmd.command,
          explanation: cmd.context || `Command found in documentation: ${doc.title}`,
          warnings: this.generateWarnings(cmd.command, safetyLevel),
          safetyLevel,
          source: 'documentation'
        });
      }

      // Create solutions from troubleshooting steps
      for (const step of steps.slice(0, 3)) {
        const safetyLevel = step.command ? this.validateCommand(step.command) : 'safe';
        
        // Filter out destructive commands if not allowed
        if (!opts.includeDestructiveCommands && safetyLevel === 'destructive') {
          continue;
        }

        solutions.push({
          step: step.action,
          command: step.command,
          explanation: step.explanation || `From documentation: ${doc.title}`,
          warnings: step.command ? this.generateWarnings(step.command, safetyLevel) : [],
          safetyLevel,
          source: 'documentation'
        });
      }
    }

    return solutions;
  }

  /**
   * Deduplicate solutions by command or step description.
   */
  private deduplicateSolutions(solutions: RichSolution[]): RichSolution[] {
    const seen = new Map<string, RichSolution>();

    for (const solution of solutions) {
      const key = solution.command?.toLowerCase() || solution.step.toLowerCase();
      
      // Keep the solution with more detail
      const existing = seen.get(key);
      if (!existing || solution.explanation.length > existing.explanation.length) {
        seen.set(key, solution);
      }
    }

    return Array.from(seen.values());
  }

  // ==================== Command Parsing ====================

  /**
   * Parse commands from markdown content.
   */
  parseCommandsFromMarkdown(content: string): Array<{
    command: string;
    description?: string;
    context?: string;
  }> {
    const commands: Array<{ command: string; description?: string; context?: string }> = [];
    
    // Match fenced code blocks (```bash, ```shell, ```hcl, or just ```)
    const codeBlockRegex = /```(?:bash|shell|sh|hcl|terraform|console)?\s*\n([\s\S]*?)```/gi;
    
    // Match inline code that looks like commands
    const inlineCommandRegex = /`((?:terragrunt|terraform|tg)\s+[^`]+)`/gi;
    
    // Extract from fenced code blocks
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const codeContent = match[1].trim();
      const lines = codeContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//') || !trimmedLine) {
          continue;
        }
        
        // Check if it looks like a command
        if (this.isLikelyCommand(trimmedLine)) {
          // Get context from surrounding text
          const contextStart = Math.max(0, match.index - 200);
          const context = content.substring(contextStart, match.index).trim();
          const description = this.extractDescriptionFromContext(context);
          
          commands.push({
            command: trimmedLine,
            description,
            context: description
          });
        }
      }
    }

    // Extract inline commands
    while ((match = inlineCommandRegex.exec(content)) !== null) {
      const command = match[1].trim();
      
      if (this.isLikelyCommand(command)) {
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(content.length, match.index + match[0].length + 100);
        const context = content.substring(contextStart, contextEnd).trim();
        
        commands.push({
          command,
          context
        });
      }
    }

    return commands;
  }

  /**
   * Check if a string looks like a terminal command.
   */
  private isLikelyCommand(text: string): boolean {
    const commandPrefixes = [
      'terragrunt',
      'terraform',
      'tg',
      'aws',
      'gcloud',
      'az',
      'kubectl',
      'cd',
      'export',
      'echo',
      'cat',
      'grep',
      'ls',
      'rm',
      'cp',
      'mv',
      'mkdir'
    ];
    
    const lowerText = text.toLowerCase().trim();
    
    // Remove common shell prompt prefixes
    const cleanedText = lowerText.replace(/^\$\s*/, '').replace(/^>\s*/, '');
    
    return commandPrefixes.some(prefix => cleanedText.startsWith(prefix));
  }

  /**
   * Extract a description from context text.
   */
  private extractDescriptionFromContext(context: string): string | undefined {
    // Look for sentences ending before the code block
    const sentences = context.split(/[.!?]\s+/);
    const lastSentence = sentences[sentences.length - 1]?.trim();
    
    if (lastSentence && lastSentence.length > 10 && lastSentence.length < 200) {
      return lastSentence;
    }
    
    return undefined;
  }

  // ==================== Command Validation ====================

  /**
   * Validate a command and return its safety level.
   */
  validateCommand(command: string): CommandSafetyLevel {
    const lowerCommand = command.toLowerCase();

    // Check for destructive commands
    for (const destructive of DESTRUCTIVE_COMMANDS) {
      if (lowerCommand.includes(destructive)) {
        return 'destructive';
      }
    }

    // Check for state-modifying commands
    for (const stateModifying of STATE_MODIFYING_COMMANDS) {
      if (lowerCommand.includes(stateModifying)) {
        return 'caution';
      }
    }

    return 'safe';
  }

  /**
   * Generate warnings based on command and safety level.
   */
  private generateWarnings(command: string | undefined, safetyLevel: CommandSafetyLevel): string[] {
    if (!command) return [];

    const warnings: string[] = [];
    const lowerCommand = command.toLowerCase();

    if (safetyLevel === 'destructive') {
      warnings.push('⚠️ This command is destructive and may cause data loss');
      
      if (lowerCommand.includes('destroy')) {
        warnings.push('This will permanently destroy infrastructure resources');
      }
      if (lowerCommand.includes('state rm') || lowerCommand.includes('state delete')) {
        warnings.push('This will remove resources from Terraform state without destroying them');
      }
      if (lowerCommand.includes('force-unlock')) {
        warnings.push('Force unlocking may cause state corruption if another operation is in progress');
      }
    }

    if (safetyLevel === 'caution') {
      if (lowerCommand.includes('apply')) {
        warnings.push('This command will make changes to your infrastructure');
      }
      if (lowerCommand.includes('import')) {
        warnings.push('This will import existing resources into Terraform state');
      }
      if (lowerCommand.includes('state mv')) {
        warnings.push('This will move resources in Terraform state');
      }
      if (lowerCommand.includes('-reconfigure')) {
        warnings.push('This will reinitialize the backend without migrating state');
      }
      if (lowerCommand.includes('-migrate-state')) {
        warnings.push('This will migrate state to a new backend');
      }
    }

    return warnings;
  }

  // ==================== Troubleshooting Steps ====================

  /**
   * Extract troubleshooting steps from markdown content.
   */
  extractTroubleshootingSteps(content: string): Array<{
    action: string;
    command?: string;
    explanation?: string;
  }> {
    const steps: Array<{ action: string; command?: string; explanation?: string }> = [];
    
    // Match numbered lists (1. Step, 2. Step, etc.)
    const numberedListRegex = /^\s*(\d+)[.)]\s+(.+)$/gm;
    
    // Match bullet points with action words
    const bulletRegex = /^\s*[-*•]\s+((?:Check|Verify|Run|Execute|Ensure|Make sure|Try|Update|Add|Remove|Fix|Review|Inspect|Debug|Test|Validate).+)$/gim;
    
    // Match sections titled "Troubleshooting" or "How to fix"
    const troubleshootingSectionRegex = /(?:#{1,3}\s*(?:Troubleshooting|How to (?:fix|resolve|solve)|Solution|Steps to fix|Resolution))\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n\n\n|$)/gi;

    // Extract from troubleshooting sections first
    let sectionMatch;
    while ((sectionMatch = troubleshootingSectionRegex.exec(content)) !== null) {
      const sectionContent = sectionMatch[1];
      
      // Extract numbered steps from section
      let numMatch;
      while ((numMatch = numberedListRegex.exec(sectionContent)) !== null) {
        const stepText = numMatch[2].trim();
        const { action, command } = this.parseStepText(stepText);
        
        steps.push({
          action,
          command,
          explanation: this.findExplanationForStep(sectionContent, numMatch.index)
        });
      }
    }

    // If no troubleshooting section found, look for bullet points with action words
    if (steps.length === 0) {
      let bulletMatch;
      while ((bulletMatch = bulletRegex.exec(content)) !== null) {
        const stepText = bulletMatch[1].trim();
        const { action, command } = this.parseStepText(stepText);
        
        steps.push({
          action,
          command
        });
      }
    }

    return steps;
  }

  /**
   * Parse step text to extract action and command.
   */
  private parseStepText(text: string): { action: string; command?: string } {
    // Check if text contains an inline code command
    const codeMatch = text.match(/`([^`]+)`/);
    
    if (codeMatch && this.isLikelyCommand(codeMatch[1])) {
      return {
        action: text.replace(codeMatch[0], '').trim() || `Run ${codeMatch[1]}`,
        command: codeMatch[1]
      };
    }

    return { action: text };
  }

  /**
   * Find explanation text near a step.
   */
  private findExplanationForStep(content: string, stepIndex: number): string | undefined {
    // Look for text after the step (within 200 chars)
    const afterStep = content.substring(stepIndex, stepIndex + 300);
    const lines = afterStep.split('\n');
    
    // Skip the step line itself and look for explanation
    for (let i = 1; i < lines.length && i < 3; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and list items
      if (!line || /^[\d\-*•]/.test(line)) {
        continue;
      }
      
      // Found potential explanation
      if (line.length > 20 && line.length < 300) {
        return line;
      }
    }
    
    return undefined;
  }

  // ==================== Debugging Steps Generation ====================

  /**
   * Generate ordered debugging steps based on diagnosis and documentation.
   */
  generateDebuggingSteps(
    diagnosis: ErrorDiagnosisResult,
    docs: TerragruntDoc[],
    opts: Required<SolutionRetrievalOptions>
  ): DebuggingStep[] {
    const steps: DebuggingStep[] = [];
    let order = 1;

    // Add context-specific debugging steps based on error category
    if (diagnosis.matches.length > 0) {
      const primaryMatch = diagnosis.matches[0];
      const categorySteps = this.getCategoryDebuggingSteps(primaryMatch);
      
      for (const step of categorySteps) {
        steps.push({
          order: order++,
          ...step
        });
      }
    }

    // Add generic debugging steps from diagnosis
    for (const step of diagnosis.debuggingSteps) {
      // Check if this step is already covered (use safe substring)
      const compareStr = step.length > 20 ? step.substring(0, 20) : step;
      const isDuplicate = steps.some(s => 
        s.action.toLowerCase().includes(compareStr.toLowerCase())
      );
      
      if (!isDuplicate) {
        steps.push({
          order: order++,
          action: step,
          explanation: 'Standard debugging step for Terragrunt errors'
        });
      }
    }

    // Extract additional steps from documentation
    for (const doc of docs.slice(0, 3)) {
      const docSteps = this.extractTroubleshootingSteps(doc.content);
      
      for (const docStep of docSteps.slice(0, 2)) {
        // Check for duplicates (use safe substring)
        const compareStr = docStep.action.length > 20 ? docStep.action.substring(0, 20) : docStep.action;
        const isDuplicate = steps.some(s => 
          s.action.toLowerCase().includes(compareStr.toLowerCase()) ||
          (docStep.command && s.verificationCommand === docStep.command)
        );
        
        if (!isDuplicate) {
          steps.push({
            order: order++,
            action: docStep.action,
            verificationCommand: docStep.command,
            explanation: docStep.explanation || `From documentation: ${doc.title}`
          });
        }
      }
    }

    return steps.slice(0, opts.maxDebuggingSteps);
  }

  /**
   * Get category-specific debugging steps.
   */
  private getCategoryDebuggingSteps(match: ErrorMatch): Array<Omit<DebuggingStep, 'order'>> {
    const steps: Array<Omit<DebuggingStep, 'order'>> = [];
    
    switch (match.pattern.category) {
      case 'configuration':
        steps.push({
          action: 'Validate the terragrunt.hcl syntax',
          verificationCommand: 'terragrunt validate-inputs',
          explanation: 'Checks for syntax errors and missing required inputs'
        });
        steps.push({
          action: 'Check for typos in configuration block names',
          explanation: 'Common typos include "terrafrom" instead of "terraform"'
        });
        if (match.context.filePath) {
          steps.push({
            action: `Review the configuration file: ${match.context.filePath}`,
            verificationCommand: `cat ${match.context.filePath}`,
            explanation: 'Examine the specific file mentioned in the error'
          });
        }
        break;

      case 'state':
        steps.push({
          action: 'Check if state is locked by another process',
          verificationCommand: 'terragrunt state list',
          explanation: 'Verify state access and check for lock issues'
        });
        steps.push({
          action: 'Verify backend credentials are valid',
          explanation: 'Ensure AWS/GCP/Azure credentials have state access'
        });
        break;

      case 'dependency':
        steps.push({
          action: 'Verify dependency paths are correct',
          verificationCommand: 'terragrunt graph-dependencies',
          explanation: 'Visualize the dependency graph to find issues'
        });
        steps.push({
          action: 'Check if dependent modules have been applied',
          explanation: 'Dependencies must be applied before dependent modules'
        });
        break;

      case 'backend':
        steps.push({
          action: 'Verify backend configuration in terragrunt.hcl',
          explanation: 'Check remote_state block settings'
        });
        steps.push({
          action: 'Ensure backend storage exists and is accessible',
          explanation: 'S3 bucket, GCS bucket, or Azure container must exist'
        });
        if (match.context.backend) {
          steps.push({
            action: `Check ${match.context.backend} backend credentials`,
            explanation: `Verify credentials for ${match.context.backend} are configured`
          });
        }
        break;

      case 'terraform':
        steps.push({
          action: 'Check Terraform version compatibility',
          verificationCommand: 'terraform version',
          explanation: 'Ensure Terraform version matches requirements'
        });
        steps.push({
          action: 'Update Terraform providers',
          verificationCommand: 'terragrunt init -upgrade',
          explanation: 'Upgrade providers to latest compatible versions'
        });
        break;

      case 'authentication':
        steps.push({
          action: 'Verify cloud credentials are configured',
          explanation: 'Check AWS_PROFILE, GOOGLE_APPLICATION_CREDENTIALS, or Azure credentials'
        });
        steps.push({
          action: 'Test credentials with cloud CLI',
          verificationCommand: 'aws sts get-caller-identity',
          explanation: 'Verify credentials work outside of Terragrunt'
        });
        break;

      case 'network':
        steps.push({
          action: 'Check network connectivity',
          verificationCommand: 'curl -I https://registry.terraform.io',
          explanation: 'Verify access to Terraform registry'
        });
        steps.push({
          action: 'Check proxy settings if behind corporate firewall',
          explanation: 'HTTP_PROXY and HTTPS_PROXY may need to be set'
        });
        break;
    }

    return steps;
  }

  // ==================== Documentation Links ====================

  /**
   * Create documentation links with relevance scoring.
   */
  createDocumentationLinks(
    docs: TerragruntDoc[],
    diagnosis: ErrorDiagnosisResult,
    opts: Required<SolutionRetrievalOptions>
  ): DocumentationLink[] {
    const links: DocumentationLink[] = [];

    for (const doc of docs) {
      const relevanceScore = this.calculateRelevanceScore(doc, diagnosis);
      
      if (relevanceScore > 0.3) { // Only include reasonably relevant docs
        links.push({
          url: doc.url,
          title: doc.title,
          excerpt: this.extractRelevantExcerpt(doc.content, diagnosis),
          relevanceScore,
          section: doc.section
        });
      }
    }

    // Sort by relevance and limit
    return links
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, opts.maxDocLinks);
  }

  /**
   * Calculate relevance score for a document.
   */
  private calculateRelevanceScore(doc: TerragruntDoc, diagnosis: ErrorDiagnosisResult): number {
    let score = 0;
    const docContent = doc.content.toLowerCase();
    const docTitle = doc.title.toLowerCase();

    for (const match of diagnosis.matches) {
      const patternName = match.pattern.name.toLowerCase();
      const category = match.pattern.category.toLowerCase();
      
      // Title match is highly relevant
      if (docTitle.includes(patternName) || patternName.includes(docTitle)) {
        score += 0.5;
      }
      
      // Category match
      if (docTitle.includes(category) || doc.section.toLowerCase().includes(category)) {
        score += 0.3;
      }
      
      // Content matches
      const keywords = this.extractKeywords(match.pattern.description);
      const matchingKeywords = keywords.filter(kw => docContent.includes(kw));
      score += matchingKeywords.length * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract a relevant excerpt from document content.
   */
  private extractRelevantExcerpt(content: string, diagnosis: ErrorDiagnosisResult): string {
    const maxLength = 300;
    
    // Try to find a section that mentions error-related terms
    for (const match of diagnosis.matches) {
      const keywords = this.extractKeywords(match.pattern.description);
      
      for (const keyword of keywords) {
        const index = content.toLowerCase().indexOf(keyword);
        if (index !== -1) {
          // Extract surrounding context
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + maxLength);
          let excerpt = content.substring(start, end).trim();
          
          // Clean up excerpt
          excerpt = excerpt.replace(/\s+/g, ' ');
          
          // Add ellipsis if truncated
          if (start > 0) excerpt = '...' + excerpt;
          if (end < content.length) excerpt = excerpt + '...';
          
          return excerpt;
        }
      }
    }

    // Fall back to first part of content
    const firstPart = content.substring(0, maxLength).trim().replace(/\s+/g, ' ');
    return firstPart + (content.length > maxLength ? '...' : '');
  }

  // ==================== Related Errors ====================

  /**
   * Find related errors with detailed reasons.
   */
  findRelatedErrors(
    diagnosis: ErrorDiagnosisResult,
    _opts: Required<SolutionRetrievalOptions>
  ): RelatedError[] {
    const relatedErrors: RelatedError[] = [];
    
    // Convert string array to detailed RelatedError objects
    for (const relatedName of diagnosis.relatedErrors) {
      // Find the pattern if possible from matches
      const matchedPattern = diagnosis.matches.find(m => 
        m.pattern.name === relatedName
      );
      
      if (matchedPattern) {
        relatedErrors.push({
          errorId: matchedPattern.pattern.id,
          name: relatedName,
          category: matchedPattern.pattern.category,
          reason: `Same category as primary error (${matchedPattern.pattern.category})`,
          similarityScore: 0.7
        });
      } else {
        // Infer category from name
        const inferredCategory = this.inferCategoryFromName(relatedName);
        
        relatedErrors.push({
          errorId: relatedName.toLowerCase().replace(/\s+/g, '-'),
          name: relatedName,
          category: inferredCategory,
          reason: this.generateRelationReason(relatedName, diagnosis),
          similarityScore: 0.5
        });
      }
    }

    return relatedErrors;
  }

  /**
   * Infer error category from error name.
   */
  private inferCategoryFromName(name: string): ErrorMatch['pattern']['category'] {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('state') || lowerName.includes('lock')) return 'state';
    if (lowerName.includes('dependency') || lowerName.includes('module')) return 'dependency';
    if (lowerName.includes('backend') || lowerName.includes('s3') || lowerName.includes('gcs')) return 'backend';
    if (lowerName.includes('terraform') || lowerName.includes('provider')) return 'terraform';
    if (lowerName.includes('auth') || lowerName.includes('credential')) return 'authentication';
    if (lowerName.includes('network') || lowerName.includes('timeout')) return 'network';
    
    return 'configuration';
  }

  /**
   * Generate a reason for why an error is related.
   */
  private generateRelationReason(relatedName: string, diagnosis: ErrorDiagnosisResult): string {
    if (diagnosis.matches.length === 0) {
      return 'May be relevant to your error';
    }

    const primaryMatch = diagnosis.matches[0];
    const lowerRelated = relatedName.toLowerCase();
    const lowerPrimary = primaryMatch.pattern.name.toLowerCase();

    // Check for common keywords
    const primaryKeywords = lowerPrimary.split(/\s+/);
    const relatedKeywords = lowerRelated.split(/\s+/);
    const commonKeywords = primaryKeywords.filter(kw => 
      relatedKeywords.includes(kw) && kw.length > 3
    );

    if (commonKeywords.length > 0) {
      return `Shares common aspect: ${commonKeywords.join(', ')}`;
    }

    return `Related to ${primaryMatch.pattern.category} errors`;
  }

  // ==================== Utility Methods ====================

  /**
   * Generate cache key from diagnosis and options.
   */
  private generateCacheKey(diagnosis: ErrorDiagnosisResult, options: SolutionRetrievalOptions): string {
    const matchIds = diagnosis.matches
      .slice(0, 3)
      .map(m => m.pattern.id)
      .join('|');
    
    const optionsKey = `${options.includeDestructiveCommands ?? true}_${options.maxSolutions ?? 5}`;
    return `diag_${matchIds}_${diagnosis.overallConfidence.toFixed(2)}_${optionsKey}`;
  }

  /**
   * Convert basic diagnosis to rich solutions (fallback).
   */
  private convertToRichSolutions(diagnosis: ErrorDiagnosisResult): RichSolution[] {
    const solutions: RichSolution[] = [];

    for (const match of diagnosis.matches) {
      for (const solution of match.solutions) {
        solutions.push(this.convertSolutionToRich(solution, match));
      }
    }

    return solutions;
  }

  /**
   * Convert string debugging steps to DebuggingStep objects (fallback).
   */
  private convertToDebuggingSteps(steps: string[]): DebuggingStep[] {
    return steps.map((step, index) => ({
      order: index + 1,
      action: step,
      explanation: 'Standard debugging step'
    }));
  }
}
