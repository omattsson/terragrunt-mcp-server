import { TerragruntDocsManager, TerragruntDoc } from './docs.js';
import { LRUCache } from 'lru-cache';

/**
 * Represents a best practice extracted from Terragrunt documentation
 */
export interface BestPractice {
  practice: string;           // The best practice recommendation
  rationale: string;          // Why this is recommended
  example: string;            // Code example demonstrating it
  antipatterns: string[];     // What to avoid
  tradeoffs: string[];        // Tradeoffs to consider
  relatedDocs: string[];      // URLs to related documentation
}

/**
 * Priority level for a practice recommendation
 */
export type PracticePriority = 'critical' | 'recommended' | 'optional';

/**
 * Experience level for a practice recommendation
 */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A structured recommendation for a specific practice
 */
export interface PracticeRecommendation {
  practice: string;
  priority: PracticePriority;
  experienceLevel: ExperienceLevel;
  category: string;           // Topic/category it belongs to
  rationale: string;
  examples: string[];
  antipatterns: string[];
  tradeoffs: string[];
  relatedDocs: string[];
}

/**
 * Experience-specific notes grouped by level
 */
export interface ExperienceNotes {
  beginner: string[];
  intermediate: string[];
  advanced: string[];
}

/**
 * Result of analyzing best practices for a topic
 */
export interface BestPracticeResult {
  topic: string;
  recommendations: PracticeRecommendation[];
  summary: string;
  commonPitfalls: string[];
  experienceNotes: ExperienceNotes;
  realWorldExamples: string[];
}

/**
 * Internal interface for scoring and ranking practices
 * Extends BestPractice with metadata for ranking algorithm
 */
interface ScoredPractice extends BestPractice {
  score: number;           // Calculated ranking score
  frequency: number;       // How many similar practices found
  sourceSection: string;   // Documentation section (for priority)
  exampleCount: number;    // Number of code examples
}

/**
 * Manages extraction and analysis of best practices from Terragrunt documentation.
 * 
 * This class extracts best practices, antipatterns, and recommendations from
 * documentation content using pattern matching and heuristics. It supports
 * categorization by experience level and topic-based filtering.
 * 
 * Supported topics:
 * - module_organization: How to structure modules
 * - state_management: Remote state best practices
 * - dependencies: Managing dependencies between modules
 * - ci_cd: CI/CD integration patterns
 * - security: Security considerations
 * - performance: Performance optimization
 * - testing: Testing strategies
 */
export class BestPracticesAnalyzer {
  private readonly docsManager: TerragruntDocsManager;
  private readonly practicesCache: LRUCache<string, BestPractice[]>;
  private readonly resultsCache: LRUCache<string, BestPracticeResult>;
  private practicesLoaded: boolean = false;

  /**
   * Supported topics for best practices analysis
   */
  private readonly supportedTopics: string[] = [
    'module_organization',
    'state_management',
    'dependencies',
    'ci_cd',
    'security',
    'performance',
    'testing'
  ];

  /**
   * Regex patterns for extracting best practices from documentation
   */
  private readonly bestPracticePatterns = [
    /(?:should|recommended|best practice|prefer|always|must)\s+([^.!?]+[.!?])/gi,
    /it\s+is\s+(?:recommended|preferred)\s+(?:to\s+)?([^.!?]+[.!?])/gi,
    /(?:we|you)\s+(?:should|must|recommend)\s+([^.!?]+[.!?])/gi
  ];

  /**
   * Regex patterns for identifying antipatterns and warnings
   */
  private readonly antipatternPatterns = [
    /(?:avoid|don't|do not)\s+([^.!?]+[.!?])/gi,
    /(?:deprecated|not recommended|discouraged)[:\s]+([^.!?]+[.!?])/gi,
    /(?:warning|caution|note)[:\s]+([^.!?]+[.!?])/gi,
    /(?:never|shouldn't|should not)\s+([^.!?]+[.!?])/gi
  ];

  /**
   * Regex patterns for extracting tradeoffs and considerations
   */
  private readonly tradeoffPatterns = [
    /(?:tradeoff|trade-off)[:\s]+([^.!?]+[.!?])/gi,
    // Only match "consider" when followed by context suggesting weighing options
    /consider\s+(?:whether|if|the)\s+([^.!?]+[.!?])/gi,
    // Only match "however", "but", "although" when sentence contains tradeoff context
    /(?:however|but|although)[^.!?]*?\b(?:cost|performance|vs\.?|instead|downside|upside|benefit|drawback|advantage|disadvantage)\b[^.!?]*?[.!?]/gi,
    /(?:alternative|alternatively)[:\s]+([^.!?]+[.!?])/gi
  ];

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
    
    // Initialize LRU caches with size limits to prevent unbounded memory growth
    this.practicesCache = new LRUCache<string, BestPractice[]>({
      max: 100, // Maximum 100 topics/subtopics
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });

    this.resultsCache = new LRUCache<string, BestPracticeResult>({
      max: 200, // Maximum 200 cached results (topics × experience levels)
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });
  }

  /**
   * Normalize a key for case-insensitive cache lookups
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase().trim();
  }

  /**
   * Common stopwords to filter out during keyword extraction
   */
  private readonly stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'you', 'your', 'this', 'should',
    'must', 'can', 'may', 'use', 'using', 'uses', 'used'
  ]);

  /**
   * Extract meaningful keywords from text for similarity comparison
   * Filters out stopwords and short words
   */
  private extractKeywords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopwords.has(word));
    
    return new Set(words);
  }

  /**
   * Calculate Jaccard similarity between two texts based on keyword overlap
   * Returns a value between 0 (no similarity) and 1 (identical)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    if (keywords1.size === 0 || keywords2.size === 0) {
      return 0;
    }

    // Calculate intersection
    const intersection = new Set(
      [...keywords1].filter(word => keywords2.has(word))
    );

    // Calculate union
    const union = new Set([...keywords1, ...keywords2]);

    // Jaccard similarity = intersection / union
    return intersection.size / union.size;
  }

  /**
   * Calculate frequency of similar practices across all practices
   * Updates the frequency field of each practice
   */
  private calculateFrequency(practices: ScoredPractice[]): void {
    const similarityThreshold = 0.6; // Practices with >60% similarity are considered the same

    for (let i = 0; i < practices.length; i++) {
      let frequency = 1; // Start with 1 (the practice itself)

      for (let j = 0; j < practices.length; j++) {
        if (i !== j) {
          const similarity = this.calculateSimilarity(
            practices[i].practice,
            practices[j].practice
          );

          if (similarity >= similarityThreshold) {
            frequency++;
          }
        }
      }

      practices[i].frequency = frequency;
    }
  }

  /**
   * Score a practice based on multiple factors
   * Returns a score from 0 to ~215 (base 100 + bonuses)
   */
  private scorePractice(practice: ScoredPractice, topic: string): number {
    let score = 100; // Base score

    // Frequency bonus: +10 per occurrence, max +30
    const frequencyBonus = Math.min((practice.frequency - 1) * 10, 30);
    score += frequencyBonus;

    // Section priority bonus
    const officialSections = ['getting-started', 'features', 'reference', 'quick-start'];
    const guideSections = ['guides', 'how-to'];
    
    if (officialSections.includes(practice.sourceSection)) {
      score += 20;
    } else if (guideSections.includes(practice.sourceSection)) {
      score += 10;
    }

    // Example bonus: +15 for having examples, +5 per additional (max +25 total)
    if (practice.exampleCount > 0) {
      score += 15;
      score += Math.min((practice.exampleCount - 1) * 5, 10);
    }

    // Keyword relevance: match topic keywords
    const topicKeywords = this.getTopicKeywords(topic);
    const practiceKeywords = this.extractKeywords(
      practice.practice + ' ' + practice.rationale
    );
    
    const matchCount = topicKeywords.filter(kw => 
      [...practiceKeywords].some(pk => pk.includes(kw.toLowerCase()) || kw.toLowerCase().includes(pk))
    ).length;
    
    const relevanceBonus = Math.min(matchCount * 4, 20); // +4 per keyword match, max +20
    score += relevanceBonus;

    // Metadata bonuses
    if (practice.rationale && practice.rationale.length > 20) {
      score += 10; // Has meaningful rationale
    }
    if (practice.antipatterns && practice.antipatterns.length > 0) {
      score += 5; // Has antipatterns
    }
    if (practice.tradeoffs && practice.tradeoffs.length > 0) {
      score += 5; // Has tradeoffs
    }

    return score;
  }

  /**
   * Rank practices by calculating scores and sorting
   * Returns practices sorted by score (highest first)
   */
  private rankPractices(practices: ScoredPractice[], topic: string): ScoredPractice[] {
    // Calculate frequency across all practices
    this.calculateFrequency(practices);

    // Score each practice
    for (const practice of practices) {
      practice.score = this.scorePractice(practice, topic);
    }

    // Sort by score descending
    return practices.sort((a, b) => b.score - a.score);
  }

  /**
   * Map topics to their relevant search keywords
   */
  private getTopicKeywords(topic: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'module_organization': [
        'module',
        'structure',
        'organization',
        'layout',
        'hierarchy',
        'folder structure',
        'directory structure'
      ],
      'state_management': [
        'remote state',
        'backend',
        'state',
        'locking',
        's3',
        'azure storage',
        'gcs',
        'state file'
      ],
      'dependencies': [
        'dependency',
        'dependencies',
        'depends_on',
        'mock_outputs',
        'dependency block',
        'inter-module'
      ],
      'ci_cd': [
        'ci/cd',
        'ci cd',
        'pipeline',
        'automation',
        'github actions',
        'gitlab ci',
        'jenkins',
        'continuous integration',
        'continuous deployment'
      ],
      'security': [
        'security',
        'credentials',
        'secrets',
        'encryption',
        'authentication',
        'authorization',
        'iam',
        'permissions',
        'sensitive'
      ],
      'performance': [
        'performance',
        'caching',
        'speed',
        'optimization',
        'optimize',
        'fast',
        'slow',
        'parallel',
        'concurrency'
      ],
      'testing': [
        'test',
        'testing',
        'validation',
        'validate',
        'terratest',
        'unit test',
        'integration test',
        'verify'
      ]
    };

    const normalizedTopic = this.normalizeKey(topic);
    return keywordMap[normalizedTopic] || [];
  }

  /**
   * Search for documentation that matches the given topic
   */
  private async searchForPatterns(topic: string): Promise<TerragruntDoc[]> {
    const keywords = this.getTopicKeywords(topic);
    if (keywords.length === 0) {
      return [];
    }

    const allDocs = await this.docsManager.fetchLatestDocs();
    const contentLower = (doc: TerragruntDoc) => doc.content.toLowerCase();

    // Filter docs that contain at least one keyword
    return allDocs.filter(doc => {
      const content = contentLower(doc);
      return keywords.some(keyword => content.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Identify antipatterns from documentation content
   */
  private identifyAntipatterns(docs: TerragruntDoc[]): string[] {
    const antipatterns = new Set<string>();

    for (const doc of docs) {
      for (const pattern of this.antipatternPatterns) {
        // Reset regex lastIndex for global flag
        pattern.lastIndex = 0;
        
        const matches = [...doc.content.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const antipattern = match[1].trim();
            if (antipattern.length > 10) { // Filter out very short matches
              antipatterns.add(antipattern);
            }
          }
        }
      }
    }

    return Array.from(antipatterns);
  }

  /**
   * Extract code examples from documentation content
   */
  private extractExamples(content: string): string[] {
    const examples: string[] = [];
    
    // Extract code blocks with triple backticks
    const codeBlockPattern = /```(?:hcl|terraform|bash)?\s*\n([\s\S]*?)\n```/g;
    const codeBlocks = [...content.matchAll(codeBlockPattern)];
    
    for (const match of codeBlocks) {
      if (match[1] && match[1].trim().length > 0) {
        examples.push(match[1].trim());
      }
    }

    // Look for Example: or Usage: sections
    const exampleSectionPattern = /(?:Example|Usage):\s*\n((?:```[\s\S]*?```|(?:(?!#+).)+)+)/gi;
    const exampleSections = [...content.matchAll(exampleSectionPattern)];
    
    for (const match of exampleSections) {
      if (match[1] && match[1].trim().length > 0) {
        // Extract code from the section if it contains code blocks
        const sectionCodeBlocks = [...match[1].matchAll(codeBlockPattern)];
        for (const codeMatch of sectionCodeBlocks) {
          if (codeMatch[1] && !examples.includes(codeMatch[1].trim())) {
            examples.push(codeMatch[1].trim());
          }
        }
      }
    }

    // Limit to reasonable number of examples
    return examples.slice(0, 5);
  }

  /**
   * Extract the rationale for why a practice is recommended
   */
  private extractRationale(content: string, practice: string): string {
    // Find the practice in the content and extract surrounding context
    const practiceIndex = content.toLowerCase().indexOf(practice.toLowerCase());
    if (practiceIndex === -1) {
      return '';
    }

    // Extract context window (200 chars before, 300 chars after)
    const start = Math.max(0, practiceIndex - 200);
    const end = Math.min(content.length, practiceIndex + practice.length + 300);
    const context = content.substring(start, end);

    // Look for sentences that explain "why" or provide rationale
    const rationalePatterns = [
      /(?:because|since|as|this allows|this ensures|this helps|this prevents)\s+([^.!?]+[.!?])/gi,
      /(?:reason|benefit|advantage)[:\s]+([^.!?]+[.!?])/gi
    ];

    for (const pattern of rationalePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(context);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no explicit rationale found, return a snippet of the context
    const sentences = context.match(/[^.!?]+[.!?]/g) || [];
    return sentences.slice(0, 2).join(' ').trim();
  }

  /**
   * Extract tradeoffs and considerations from documentation content
   */
  private extractTradeoffs(content: string): string[] {
    const tradeoffs = new Set<string>();

    for (const pattern of this.tradeoffPatterns) {
      pattern.lastIndex = 0;
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        // Handle both capture group patterns and full match patterns
        const tradeoff = (match[1] || match[0]).trim();
        if (tradeoff.length > 15) { // Filter out very short matches
          tradeoffs.add(tradeoff);
        }
      }
    }

    return Array.from(tradeoffs).slice(0, 5); // Limit to top 5 tradeoffs
  }

  /**
   * Categorize a practice by experience level based on heuristics
   */
  private categorizeByExperience(practice: BestPractice, doc: TerragruntDoc): ExperienceLevel {
    // Prioritize practice-specific content over whole doc
    const practiceContent = (practice.practice + ' ' + practice.rationale).toLowerCase();
    const docContent = doc.content.toLowerCase();
    
    // Check doc section first for beginner content
    if (doc.section === 'getting-started' || doc.section === 'quick-start') {
      return 'beginner';
    }
    
    // Check practice-specific keywords first (more accurate)
    const beginnerKeywords = ['basic', 'simple', 'getting started', 'introduction', 'first', 'start', 'should use', 'beginners', 'for beginners'];
    if (beginnerKeywords.some(kw => practiceContent.includes(kw))) {
      return 'beginner';
    }
    
    // Check for advanced keywords in practice content
    const advancedKeywords = ['advanced', 'complex', 'optimize', 'performance', 'scale', 'enterprise', 'must write', 'critical', 'dependency graph', 'for advanced', 'advanced scenarios', 'advanced users'];
    if (advancedKeywords.some(kw => practiceContent.includes(kw))) {
      return 'advanced';
    }
    
    // Check broader doc content for advanced signals
    if (advancedKeywords.some(kw => docContent.includes(kw))) {
      return 'advanced';
    }
    
    // Check topic-based categorization
    const advancedTopics = ['testing', 'ci_cd', 'performance'];
    const intermediateTopics = ['module_organization', 'dependencies', 'state'];
    
    // Try to infer topic from content
    for (const topic of advancedTopics) {
      const keywords = this.getTopicKeywords(topic);
      if (keywords.some(kw => practiceContent.includes(kw.toLowerCase()) || docContent.includes(kw.toLowerCase()))) {
        return 'advanced';
      }
    }
    
    for (const topic of intermediateTopics) {
      const keywords = this.getTopicKeywords(topic);
      if (keywords.some(kw => practiceContent.includes(kw.toLowerCase()) || docContent.includes(kw.toLowerCase()))) {
        return 'intermediate';
      }
    }
    
    // Check if practice is from features section (usually intermediate)
    if (doc.section === 'features') {
      return 'intermediate';
    }
    
    // Default to intermediate
    return 'intermediate';
  }

  /**
   * Extract best practices from a set of documentation
   */
  private extractPracticesFromDocs(docs: TerragruntDoc[], _topic: string): ScoredPractice[] {
    const practices: ScoredPractice[] = [];
    const seenPractices = new Set<string>();

    for (const doc of docs) {
      for (const pattern of this.bestPracticePatterns) {
        pattern.lastIndex = 0;
        const matches = [...doc.content.matchAll(pattern)];

        for (const match of matches) {
          if (match[1]) {
            const practiceText = match[1].trim();
            
            // Skip if too short or already seen
            if (practiceText.length < 20 || seenPractices.has(practiceText.toLowerCase())) {
              continue;
            }

            seenPractices.add(practiceText.toLowerCase());

            // Extract surrounding context for better categorization (100 chars before match)
            const matchIndex = match.index || 0;
            const contextStart = Math.max(0, matchIndex - 100);
            const fullContext = doc.content.substring(contextStart, matchIndex + match[0].length).trim();
            
            const extractedRationale = this.extractRationale(doc.content, practiceText);
            // Prepend context to rationale for better categorization
            const rationale = fullContext + (extractedRationale ? ' ' + extractedRationale : '');

            const examples = this.extractExamples(doc.content);

            const practice: ScoredPractice = {
              practice: practiceText,
              rationale,
              example: examples[0] || '',
              antipatterns: this.identifyAntipatterns([doc]),
              tradeoffs: this.extractTradeoffs(doc.content),
              relatedDocs: [doc.url],
              // Scoring metadata
              score: 0,
              frequency: 1,
              sourceSection: doc.section || 'other',
              exampleCount: examples.length
            };

            practices.push(practice);
          }
        }
      }
    }

    return practices; // Don't slice yet - ranking will handle limiting
  }

  /**
   * Load and extract all best practices from documentation
   */
  async extractBestPractices(): Promise<void> {
    try {
      // Fetch all documentation
      await this.docsManager.fetchLatestDocs();

      // Clear existing cache
      this.practicesCache.clear();

      // Extract practices for each supported topic
      for (const topic of this.supportedTopics) {
        const relevantDocs = await this.searchForPatterns(topic);
        const scoredPractices = this.extractPracticesFromDocs(relevantDocs, topic);
        
        // Rank practices by score
        const rankedPractices = this.rankPractices(scoredPractices, topic);
        
        // Limit to top 20 after ranking
        const topPractices = rankedPractices.slice(0, 20);
        
        // Strip scoring metadata before caching (convert to BestPractice[])
        const practices: BestPractice[] = topPractices.map(sp => ({
          practice: sp.practice,
          rationale: sp.rationale,
          example: sp.example,
          antipatterns: sp.antipatterns,
          tradeoffs: sp.tradeoffs,
          relatedDocs: sp.relatedDocs
        }));
        
        this.practicesCache.set(this.normalizeKey(topic), practices);
      }

      this.practicesLoaded = true;
    } catch (error) {
      console.error('Failed to extract best practices:', error);
      this.practicesLoaded = false;
    }
  }

  /**
   * Convert a BestPractice to a PracticeRecommendation with additional metadata
   */
  private convertToPracticeRecommendation(
    practice: BestPractice,
    doc: TerragruntDoc,
    topic: string
  ): PracticeRecommendation {
    // Determine priority based on keywords
    const practiceText = practice.practice.toLowerCase();
    let priority: PracticePriority = 'recommended';

    if (practiceText.includes('must') || practiceText.includes('critical') || practiceText.includes('always')) {
      priority = 'critical';
    } else if (practiceText.includes('consider') || practiceText.includes('optional') || practiceText.includes('can')) {
      priority = 'optional';
    }

    // Get experience level
    const experienceLevel = this.categorizeByExperience(practice, doc);

    return {
      practice: practice.practice,
      priority,
      experienceLevel,
      category: topic,
      rationale: practice.rationale,
      examples: practice.example ? [practice.example] : [],
      antipatterns: practice.antipatterns,
      tradeoffs: practice.tradeoffs,
      relatedDocs: practice.relatedDocs
    };
  }

  /**
   * Analyze best practices for a specific topic
   * 
   * @param topic - The topic to analyze (e.g., 'state_management', 'dependencies')
   * @param level - Optional experience level filter
   * @returns Best practice analysis results
   */
  async analyzeTopic(
    topic: string,
    level?: 'beginner' | 'intermediate' | 'advanced'
  ): Promise<BestPracticeResult> {
    try {
      // Ensure practices are loaded
      if (!this.practicesLoaded) {
        await this.extractBestPractices();
      }

      // Check cache
      const cacheKey = `${this.normalizeKey(topic)}:${level || 'all'}`;
      const cached = this.resultsCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get practices for this topic
      const practices = this.practicesCache.get(this.normalizeKey(topic)) || [];
      if (practices.length === 0) {
        return this.createEmptyResult(topic);
      }

      // Get relevant docs for conversion
      const relevantDocs = await this.searchForPatterns(topic);
      const docMap = new Map(relevantDocs.map(d => [d.url, d]));

      // Convert to recommendations
      let recommendations: PracticeRecommendation[] = practices.map(practice => {
        const doc = docMap.get(practice.relatedDocs[0]) || relevantDocs[0];
        return this.convertToPracticeRecommendation(practice, doc, topic);
      });

      // Filter by experience level if provided
      if (level) {
        recommendations = recommendations.filter(r => r.experienceLevel === level);
      }

      // Generate summary
      const summary = this.generateSummary(topic, recommendations);

      // Extract common pitfalls (antipatterns)
      const commonPitfalls = this.extractCommonPitfalls(practices);

      // Group experience notes
      const experienceNotes = this.groupExperienceNotes(recommendations);

      // Extract real-world examples
      const realWorldExamples = this.extractRealWorldExamples(practices);

      const result: BestPracticeResult = {
        topic,
        recommendations,
        summary,
        commonPitfalls,
        experienceNotes,
        realWorldExamples
      };

      // Cache the result
      this.resultsCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`Failed to analyze topic ${topic}:`, error);
      return this.createEmptyResult(topic);
    }
  }

  /**
   * Create an empty result for when no practices are found
   */
  private createEmptyResult(topic: string): BestPracticeResult {
    return {
      topic,
      recommendations: [],
      summary: `No best practices found for topic: ${topic}`,
      commonPitfalls: [],
      experienceNotes: {
        beginner: [],
        intermediate: [],
        advanced: []
      },
      realWorldExamples: []
    };
  }

  /**
   * Generate a summary of the recommendations
   */
  private generateSummary(topic: string, recommendations: PracticeRecommendation[]): string {
    if (recommendations.length === 0) {
      return `No recommendations available for ${topic}`;
    }

    const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
    const recommendedCount = recommendations.filter(r => r.priority === 'recommended').length;
    
    return `Found ${recommendations.length} best practices for ${topic}: ` +
           `${criticalCount} critical, ${recommendedCount} recommended. ` +
           `Key areas: ${recommendations.slice(0, 3).map(r => r.practice.split(' ').slice(0, 5).join(' ')).join('; ')}.`;
  }

  /**
   * Extract common pitfalls from practices
   */
  private extractCommonPitfalls(practices: BestPractice[]): string[] {
    const pitfalls = new Set<string>();
    
    for (const practice of practices) {
      for (const antipattern of practice.antipatterns) {
        if (antipattern.length > 15) {
          pitfalls.add(antipattern);
        }
      }
    }

    return Array.from(pitfalls).slice(0, 10);
  }

  /**
   * Group experience notes by level
   */
  private groupExperienceNotes(recommendations: PracticeRecommendation[]): ExperienceNotes {
    const notes: ExperienceNotes = {
      beginner: [],
      intermediate: [],
      advanced: []
    };

    for (const rec of recommendations) {
      const note = `${rec.practice} - ${rec.rationale}`;
      notes[rec.experienceLevel].push(note);
    }

    // Limit each level to top 5 notes
    notes.beginner = notes.beginner.slice(0, 5);
    notes.intermediate = notes.intermediate.slice(0, 5);
    notes.advanced = notes.advanced.slice(0, 5);

    return notes;
  }

  /**
   * Extract real-world examples from practices
   */
  private extractRealWorldExamples(practices: BestPractice[]): string[] {
    const examples: string[] = [];
    
    for (const practice of practices) {
      if (practice.example && practice.example.length > 20) {
        examples.push(practice.example);
      }
    }

    return examples.slice(0, 5);
  }
}
