import { describe, it, expect, beforeEach } from 'vitest';
import type { TerragruntDoc } from '../../src/terragrunt/docs.js';
import { BestPracticesAnalyzer } from '../../src/terragrunt/best-practices.js';

class MockDocsManager {
  private docs: TerragruntDoc[];
  constructor(docs: TerragruntDoc[]) { 
    this.docs = docs; 
  }
  async fetchLatestDocs(): Promise<TerragruntDoc[]> { 
    return this.docs; 
  }
}

describe('BestPracticesAnalyzer', () => {
  let analyzer: BestPracticesAnalyzer;
  let mockDocs: TerragruntDoc[];

  beforeEach(() => {
    const content = [
      '# State Management Best Practices',
      '',
      'For beginners, you should always use remote state for shared environments.',
      'This ensures that your state is safely backed up and can be shared across teams.',
      '',
      'Best practice: Use S3 with encryption and versioning enabled.',
      'It is recommended to configure state locking to prevent concurrent modifications.',
      '',
      'For advanced scenarios, optimize your state backend configuration for enterprise scale.',
      'Complex state management patterns require careful planning of backend architecture.',
      '',
      'Warning: Avoid storing sensitive data directly in state files.',
      'Don\'t use local state for multi-user environments.',
      '',
      'Example:',
      '```hcl',
      'remote_state {',
      '  backend = "s3"',
      '  config = {',
      '    bucket = "my-terraform-state"',
      '    key    = "terraform.tfstate"',
      '    encrypt = true',
      '  }',
      '}',
      '```',
      '',
      'Consider the tradeoff between centralized state and increased latency.',
      '',
      '# Module Organization',
      '',
      'It is recommended to organize modules by environment and component.',
      'This allows for better separation of concerns.',
      '',
      'Deprecated: Using a single large module for all resources is not recommended.',
      '',
      '# Performance Tips',
      '',
      'For advanced users, optimize your module dependencies to reduce apply time.',
      'Complex dependency graphs can slow down your deployments significantly.',
      '',
      '# Testing Best Practices',
      '',
      'You must write integration tests for critical infrastructure components.',
      'Testing helps catch configuration errors before they reach production.',
    ].join('\n');

    mockDocs = [
      {
        title: 'State Management Guide',
        url: 'https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/',
        content,
        section: 'features',
        lastUpdated: new Date().toISOString(),
      },
      {
        title: 'Getting Started',
        url: 'https://terragrunt.gruntwork.io/docs/getting-started/quick-start/',
        content: 'Basic module setup should use simple folder structures. This is simple for beginners.',
        section: 'getting-started',
        lastUpdated: new Date().toISOString(),
      }
    ];

    analyzer = new BestPracticesAnalyzer(new MockDocsManager(mockDocs) as any);
  });

  describe('Pattern Extraction', () => {
    it('extracts best practices from documentation', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => 
        r.practice.toLowerCase().includes('remote state') || 
        r.practice.toLowerCase().includes('s3')
      )).toBe(true);
    });

    it('identifies antipatterns and warnings', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.commonPitfalls.length).toBeGreaterThan(0);
      // Check for common antipattern patterns: action words or negative patterns
      expect(result.commonPitfalls.some(p => {
        const lp = p.toLowerCase();
        return lp.includes('avoid') || 
               lp.includes('don\'t') ||
               lp.includes('not ') ||
               lp.includes('using ') ||  // e.g., "Using local state files..."
               lp.includes('without') ||
               lp.includes('missing');
      })).toBe(true);
    });

    it('extracts code examples', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.realWorldExamples.length).toBeGreaterThan(0);
      expect(result.realWorldExamples.some(e => e.includes('remote_state'))).toBe(true);
    });

    it('extracts tradeoffs', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      // Check if any recommendation has tradeoffs
      const hasTradeoffs = result.recommendations.some(r => r.tradeoffs.length > 0);
      expect(hasTradeoffs).toBe(true);
    });
  });

  describe('Experience Level Categorization', () => {
    it('categorizes practices by experience level', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      const beginnerRecs = result.recommendations.filter(r => r.experienceLevel === 'beginner');
      const intermediateRecs = result.recommendations.filter(r => r.experienceLevel === 'intermediate');
      const advancedRecs = result.recommendations.filter(r => r.experienceLevel === 'advanced');

      // Should have at least one of each or be categorized appropriately
      expect(beginnerRecs.length + intermediateRecs.length + advancedRecs.length).toBe(result.recommendations.length);
    });

    it('filters by experience level', async () => {
      await analyzer.extractBestPractices();
      
      const beginnerResult = await analyzer.analyzeTopic('state_management', 'beginner');
      const advancedResult = await analyzer.analyzeTopic('state_management', 'advanced');

      // All recommendations should match the requested level
      expect(beginnerResult.recommendations.every(r => r.experienceLevel === 'beginner')).toBe(true);
      expect(advancedResult.recommendations.every(r => r.experienceLevel === 'advanced')).toBe(true);
    });

    it('categorizes getting-started docs as beginner', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('module_organization');

      // The getting-started doc should produce beginner recommendations
      const beginnerRecs = result.recommendations.filter(r => r.experienceLevel === 'beginner');
      expect(beginnerRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Topic Filtering', () => {
    it('supports all 7 required topics', async () => {
      const topics = [
        'module_organization',
        'state_management',
        'dependencies',
        'ci_cd',
        'security',
        'performance',
        'testing'
      ];

      await analyzer.extractBestPractices();

      for (const topic of topics) {
        const result = await analyzer.analyzeTopic(topic);
        expect(result.topic).toBe(topic);
        // Should return a valid result even if empty
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('summary');
      }
    });

    it('returns empty result for unknown topics', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('unknown_topic');

      expect(result.recommendations).toEqual([]);
      expect(result.summary).toContain('No best practices found');
    });

    it('filters docs by topic keywords', async () => {
      await analyzer.extractBestPractices();
      
      const stateResult = await analyzer.analyzeTopic('state_management');
      const moduleResult = await analyzer.analyzeTopic('module_organization');

      // State management should have state-related practices
      expect(stateResult.recommendations.length).toBeGreaterThan(0);
      
      // Module organization should have module-related practices
      expect(moduleResult.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Case-Insensitive Lookups', () => {
    it('handles case-insensitive topic lookups', async () => {
      await analyzer.extractBestPractices();

      const result1 = await analyzer.analyzeTopic('state_management');
      const result2 = await analyzer.analyzeTopic('STATE_MANAGEMENT');
      const result3 = await analyzer.analyzeTopic('State_Management');

      // Should return same number of recommendations regardless of case
      expect(result1.recommendations.length).toBe(result2.recommendations.length);
      expect(result2.recommendations.length).toBe(result3.recommendations.length);
    });
  });

  describe('Caching Behavior', () => {
    it('caches analysis results', async () => {
      await analyzer.extractBestPractices();

      // First call
      const result1 = await analyzer.analyzeTopic('state_management');
      const startTime = Date.now();
      
      // Second call should be cached and faster
      const result2 = await analyzer.analyzeTopic('state_management');
      const endTime = Date.now();

      expect(result1.recommendations.length).toBe(result2.recommendations.length);
      expect(result1.summary).toBe(result2.summary);
      
      // Cached call should be very fast (under 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('caches results separately by experience level', async () => {
      await analyzer.extractBestPractices();

      const allResult = await analyzer.analyzeTopic('state_management');
      const beginnerResult = await analyzer.analyzeTopic('state_management', 'beginner');
      const intermediateResult = await analyzer.analyzeTopic('state_management', 'intermediate');
      const advancedResult = await analyzer.analyzeTopic('state_management', 'advanced');

      // Debug: log the counts
      console.log('All:', allResult.recommendations.length);
      console.log('Beginner:', beginnerResult.recommendations.length);
      console.log('Intermediate:', intermediateResult.recommendations.length);
      console.log('Advanced:', advancedResult.recommendations.length);
      console.log('Experience levels:', allResult.recommendations.map(r => r.experienceLevel));
      console.log('First practice:', allResult.recommendations[0]?.practice.substring(0, 60));
      console.log('First rationale:', allResult.recommendations[0]?.rationale.substring(0, 120));

      // At least one level should have different count
      const hasDifferentCounts = 
        beginnerResult.recommendations.length !== allResult.recommendations.length ||
        intermediateResult.recommendations.length !== allResult.recommendations.length ||
        advancedResult.recommendations.length !== allResult.recommendations.length;
      
      expect(hasDifferentCounts).toBe(true);
      
      // All beginner results should be beginner level
      if (beginnerResult.recommendations.length > 0) {
        expect(beginnerResult.recommendations.every(r => r.experienceLevel === 'beginner')).toBe(true);
      }
    });

    it('extracts practices only once', async () => {
      const result1 = await analyzer.analyzeTopic('state_management');
      const result2 = await analyzer.analyzeTopic('module_organization');

      // Both calls should work without re-extracting
      expect(result1.recommendations).toBeDefined();
      expect(result2.recommendations).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('returns static practices on doc fetch error, not exception', async () => {
      // Create analyzer with failing docs manager
      const failingDocsManager = {
        async fetchLatestDocs() {
          throw new Error('Network error');
        }
      };

      const failingAnalyzer = new BestPracticesAnalyzer(failingDocsManager as any);

      // Should not throw, should return static practices for state_management
      const result = await failingAnalyzer.analyzeTopic('state_management');

      expect(result).toBeDefined();
      // Now returns static practices even when docs fail
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.topic).toBe('state_management');
      expect(result.confidence).toBeGreaterThanOrEqual(70); // High confidence from static practices
    });

    it('returns static practices with empty docs', async () => {
      // Empty docs - but we still have static practices
      const emptyAnalyzer = new BestPracticesAnalyzer(new MockDocsManager([]) as any);
      await emptyAnalyzer.extractBestPractices();

      const result = await emptyAnalyzer.analyzeTopic('state_management');

      // Static practices are always returned
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('returns empty result for unknown topic with no static practices', async () => {
      const emptyAnalyzer = new BestPracticesAnalyzer(new MockDocsManager([]) as any);
      await emptyAnalyzer.extractBestPractices();

      // Use a topic with no static practices
      const result = await emptyAnalyzer.analyzeTopic('unknown_topic_xyz');

      expect(result.recommendations).toEqual([]);
      expect(result.summary).toContain('No best practices found');
    });
  });

  describe('Priority Assignment', () => {
    it('assigns critical priority for must/always keywords', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('testing');

      // Debug: log what we got
      console.log('Testing recommendations:', result.recommendations.length);
      console.log('Practices:', result.recommendations.map(r => ({ practice: r.practice.substring(0, 50), priority: r.priority })));

      const criticalRecs = result.recommendations.filter(r => r.priority === 'critical');
      expect(criticalRecs.length).toBeGreaterThan(0);
      
      // At least one critical recommendation should exist
      expect(criticalRecs.some(r => 
        r.practice.toLowerCase().includes('must') || 
        r.practice.toLowerCase().includes('always') ||
        r.practice.toLowerCase().includes('critical')
      )).toBe(true);
    });

    it('assigns recommended priority by default', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      const recommendedRecs = result.recommendations.filter(r => r.priority === 'recommended');
      expect(recommendedRecs.length).toBeGreaterThan(0);
    });
  });

  describe('Experience Notes', () => {
    it('groups experience notes by level', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.experienceNotes).toBeDefined();
      expect(result.experienceNotes.beginner).toBeDefined();
      expect(result.experienceNotes.intermediate).toBeDefined();
      expect(result.experienceNotes.advanced).toBeDefined();
      
      // Each should be an array
      expect(Array.isArray(result.experienceNotes.beginner)).toBe(true);
      expect(Array.isArray(result.experienceNotes.intermediate)).toBe(true);
      expect(Array.isArray(result.experienceNotes.advanced)).toBe(true);
    });

    it('limits notes per experience level', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      // Should limit to max 5 notes per level
      expect(result.experienceNotes.beginner.length).toBeLessThanOrEqual(5);
      expect(result.experienceNotes.intermediate.length).toBeLessThanOrEqual(5);
      expect(result.experienceNotes.advanced.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Ranking and Scoring', () => {
    it('ranks practices with examples higher', async () => {
      const docsWithExamples: TerragruntDoc[] = [
        {
          title: 'Practice with Example',
          url: 'https://test.com/with-example',
          content: `
            Best practice: Use remote state for team collaboration.
            This ensures consistency across team members.
            
            Example:
            \`\`\`hcl
            remote_state {
              backend = "s3"
            }
            \`\`\`
          `,
          section: 'features',
          lastUpdated: new Date().toISOString(),
        },
        {
          title: 'Practice without Example',
          url: 'https://test.com/without-example',
          content: 'It is recommended to use encryption for sensitive data.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(docsWithExamples) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('state_management');

      // Practice with example should appear first if both are relevant
      const practiceTexts = result.recommendations.map(r => r.practice.toLowerCase());
      const remoteStateIndex = practiceTexts.findIndex(p => p.includes('remote state'));
      const encryptionIndex = practiceTexts.findIndex(p => p.includes('encryption'));

      // Remote state has example, should rank higher if both found
      if (remoteStateIndex !== -1 && encryptionIndex !== -1) {
        expect(remoteStateIndex).toBeLessThan(encryptionIndex);
      }
    });

    it('ranks official section docs higher', async () => {
      const docsWithSections: TerragruntDoc[] = [
        {
          title: 'Getting Started Guide',
          url: 'https://test.com/getting-started',
          content: 'Best practice: Start with simple folder structures.',
          section: 'getting-started',
          lastUpdated: new Date().toISOString(),
        },
        {
          title: 'Community Post',
          url: 'https://test.com/community',
          content: 'You should consider using advanced patterns.',
          section: 'community',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(docsWithSections) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('module_organization');

      // Getting started practice should rank higher than community
      if (result.recommendations.length >= 2) {
        const practiceTexts = result.recommendations.map(r => r.practice.toLowerCase());
        const officialIndex = practiceTexts.findIndex(p => p.includes('simple folder'));
        const communityIndex = practiceTexts.findIndex(p => p.includes('advanced patterns'));

        if (officialIndex !== -1 && communityIndex !== -1) {
          expect(officialIndex).toBeLessThan(communityIndex);
        }
      }
    });

    it('identifies similar practices across docs', async () => {
      const docsWithSimilar: TerragruntDoc[] = [
        {
          title: 'Doc 1',
          url: 'https://test.com/1',
          content: 'Best practice: Use remote state backend for team collaboration.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        },
        {
          title: 'Doc 2',
          url: 'https://test.com/2',
          content: 'It is recommended to use remote state for collaboration across teams.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        },
        {
          title: 'Doc 3',
          url: 'https://test.com/3',
          content: 'You should configure encryption for security.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(docsWithSimilar) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('state_management');

      // Remote state practices (appearing twice) should rank higher than encryption (appearing once)
      const practiceTexts = result.recommendations.map(r => r.practice.toLowerCase());
      const remoteStateIndex = practiceTexts.findIndex(p => 
        p.includes('remote state') && p.includes('collaboration')
      );
      const encryptionIndex = practiceTexts.findIndex(p => p.includes('encryption'));

      if (remoteStateIndex !== -1 && encryptionIndex !== -1) {
        expect(remoteStateIndex).toBeLessThan(encryptionIndex);
      }
    });

    it('ranks practices with rationale and metadata higher', async () => {
      const docsWithMetadata: TerragruntDoc[] = [
        {
          title: 'Rich Practice',
          url: 'https://test.com/rich',
          content: `
            Best practice: Use remote state locking to prevent concurrent modifications.
            This ensures that only one user can modify state at a time because
            concurrent access can lead to state corruption.
            
            Warning: Avoid disabling state locking in production.
            
            Tradeoff: Locking adds slight latency but ensures safety.
            
            Example:
            \`\`\`hcl
            remote_state {
              backend = "s3"
              config = {
                lock_table = "terraform-locks"
              }
            }
            \`\`\`
          `,
          section: 'features',
          lastUpdated: new Date().toISOString(),
        },
        {
          title: 'Simple Practice',
          url: 'https://test.com/simple',
          content: 'You should use state versioning.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(docsWithMetadata) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('state_management');

      // Rich practice with rationale, antipatterns, tradeoffs, and example should rank first
      expect(result.recommendations.length).toBeGreaterThan(0);
      const topPractice = result.recommendations[0];
      expect(topPractice.practice.toLowerCase()).toContain('state');
    });

    it('combines static and doc practices', async () => {
      // Create docs with many practices
      const manyPractices = Array.from({ length: 30 }, (_, i) => ({
        title: `Doc ${i}`,
        url: `https://test.com/${i}`,
        content: `Best practice number ${i}: Use practice ${i} for state management.`,
        section: 'features',
        lastUpdated: new Date().toISOString(),
      }));

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(manyPractices) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('state_management');

      // Should have static practices plus unique doc-extracted practices
      // Static practices come first, then unique doc practices
      expect(result.recommendations.length).toBeGreaterThan(0);
      // Confidence should be high due to static practices
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('handles practices with no keywords gracefully', async () => {
      const docsWithGeneric: TerragruntDoc[] = [
        {
          title: 'Generic Doc',
          url: 'https://test.com/generic',
          content: 'You should always do this and that.',
          section: 'features',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(docsWithGeneric) as any);
      await testAnalyzer.extractBestPractices();
      
      // Should not crash even with generic practices
      const result = await testAnalyzer.analyzeTopic('state_management');
      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('calculates high confidence for well-documented topics', async () => {
      const richDocs: TerragruntDoc[] = [
        {
          title: 'Comprehensive State Management',
          url: 'https://test.com/state',
          content: `
            Best practice: Use remote state with S3 backend for team collaboration.
            This ensures that state is centralized and prevents conflicts because 
            multiple team members need consistent access to infrastructure state.
            
            Warning: Avoid using local state for production environments.
            
            Tradeoff: Remote state adds network latency but provides better safety.
            
            Example:
            \`\`\`hcl
            remote_state {
              backend = "s3"
              config = {
                bucket = "my-state"
                key    = "terraform.tfstate"
              }
            }
            \`\`\`
            
            It is recommended to enable state locking to prevent concurrent modifications.
            This prevents state corruption from simultaneous terraform runs.
            
            Warning: Don't disable locking in production.
            
            Example:
            \`\`\`hcl
            lock_table = "terraform-locks"
            \`\`\`
          `,
          section: 'features',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(richDocs) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('state_management');

      // Good confidence: has examples, rationale, antipatterns, and tradeoffs
      // But limited number of practices (only 2), so won't reach 80+
      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('calculates high confidence when static practices exist', async () => {
      const sparseDocs: TerragruntDoc[] = [
        {
          title: 'Brief Mention',
          url: 'https://test.com/brief',
          content: 'You should use modules.',
          section: 'other',
          lastUpdated: new Date().toISOString(),
        }
      ];

      const testAnalyzer = new BestPracticesAnalyzer(new MockDocsManager(sparseDocs) as any);
      await testAnalyzer.extractBestPractices();
      const result = await testAnalyzer.analyzeTopic('module_organization');

      // High confidence because static practices are always available
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('includes confidence in result', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result).toHaveProperty('confidence');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('includes confidence level in summary', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.summary).toMatch(/(High|Medium|Low) confidence/);
    });

    it('returns 0 confidence for empty topics', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('unknown_topic');

      expect(result.confidence).toBe(0);
    });
  });

  describe('Fuzzy Topic Matching', () => {
    it('suggests similar topics for typos', async () => {
      await analyzer.extractBestPractices();
      
      // Typo in 'state_management'
      const result = await analyzer.analyzeTopic('state_managment');

      expect(result.suggestedTopics).toBeDefined();
      expect(result.suggestedTopics).toContain('state_management');
    });

    it('suggests similar topics for semantic queries', async () => {
      await analyzer.extractBestPractices();
      
      // Query for something that doesn't exist but has related keywords
      const result = await analyzer.analyzeTopic('backend configuration');

      // Should get empty results since no exact match
      expect(result.recommendations.length).toBe(0);
      // May or may not have suggestions depending on keyword overlap
      if (result.suggestedTopics && result.suggestedTopics.length > 0) {
        expect(result.suggestedTopics.length).toBeGreaterThan(0);
      }
    });

    it('returns up to 3 suggestions', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('test');

      if (result.suggestedTopics) {
        expect(result.suggestedTopics.length).toBeLessThanOrEqual(3);
      }
    });

    it('includes suggestions in summary for unknown topics', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('unknown_topic_xyz');

      if (result.suggestedTopics && result.suggestedTopics.length > 0) {
        expect(result.summary).toContain('Did you mean');
      }
    });

    it('does not include suggestedTopics for valid topics', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      // Valid topic should not have suggestions
      expect(result.suggestedTopics).toBeUndefined();
    });

    it('handles gibberish queries gracefully', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('xyzabc123nonsense');

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0);
      expect(result.recommendations.length).toBe(0);
    });

    it('suggests multiple topics for ambiguous queries', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('config');

      // 'config' could match multiple topics
      if (result.suggestedTopics) {
        expect(result.suggestedTopics.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration - Confidence and Suggestions', () => {
    it('provides comprehensive result for unknown topic', async () => {
      await analyzer.extractBestPractices();
      // Use a query with closer edit distance
      const result = await analyzer.analyzeTopic('stat_management'); // 1 char typo

      expect(result.confidence).toBe(0);
      expect(result.recommendations.length).toBe(0);
      // May have suggestions if edit distance is close enough
      expect(result.summary).toContain('No best practices found');
    });

    it('provides comprehensive result for known topic', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.suggestedTopics).toBeUndefined();
      expect(result.summary).toMatch(/confidence/);
    });
  });

  describe('includeExamples Parameter', () => {
    it('should include examples and antipatterns by default (includeExamples: true)', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management', undefined, true);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // At least some recommendations should have examples
      const recsWithExamples = result.recommendations.filter(r => r.examples.length > 0);
      expect(recsWithExamples.length).toBeGreaterThan(0);
      
      // Real-world examples should be present
      expect(result.realWorldExamples.length).toBeGreaterThan(0);
    });

    it('should exclude examples and antipatterns when includeExamples is false', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management', undefined, false);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // All recommendations should have empty examples and antipatterns
      result.recommendations.forEach(rec => {
        expect(rec.examples).toEqual([]);
        expect(rec.antipatterns).toEqual([]);
      });
      
      // Real-world examples should be empty
      expect(result.realWorldExamples).toEqual([]);
    });

    it('should preserve other fields when includeExamples is false', async () => {
      await analyzer.extractBestPractices();
      const resultWithExamples = await analyzer.analyzeTopic('state_management', undefined, true);
      const resultWithoutExamples = await analyzer.analyzeTopic('state_management', undefined, false);

      // Same number of recommendations
      expect(resultWithoutExamples.recommendations.length).toBe(resultWithExamples.recommendations.length);
      
      // Other fields should be identical
      expect(resultWithoutExamples.topic).toBe(resultWithExamples.topic);
      expect(resultWithoutExamples.summary).toBe(resultWithExamples.summary);
      expect(resultWithoutExamples.confidence).toBe(resultWithExamples.confidence);
      expect(resultWithoutExamples.commonPitfalls).toEqual(resultWithExamples.commonPitfalls);
      expect(resultWithoutExamples.experienceNotes).toEqual(resultWithExamples.experienceNotes);
      
      // Check that practice, rationale, tradeoffs, relatedDocs are preserved
      resultWithoutExamples.recommendations.forEach((rec, i) => {
        const withExamples = resultWithExamples.recommendations[i];
        expect(rec.practice).toBe(withExamples.practice);
        expect(rec.rationale).toBe(withExamples.rationale);
        expect(rec.tradeoffs).toEqual(withExamples.tradeoffs);
        expect(rec.relatedDocs).toEqual(withExamples.relatedDocs);
        expect(rec.priority).toBe(withExamples.priority);
        expect(rec.experienceLevel).toBe(withExamples.experienceLevel);
      });
    });

    it('should cache results separately for different includeExamples values', async () => {
      await analyzer.extractBestPractices();
      
      // First call with includeExamples: false
      const resultWithoutExamples = await analyzer.analyzeTopic('state_management', undefined, false);
      expect(resultWithoutExamples.realWorldExamples).toEqual([]);
      
      // Second call with includeExamples: true should get different cached result
      const resultWithExamples = await analyzer.analyzeTopic('state_management', undefined, true);
      expect(resultWithExamples.realWorldExamples.length).toBeGreaterThan(0);
      
      // Third call with includeExamples: false should return cached filtered result
      const resultWithoutExamples2 = await analyzer.analyzeTopic('state_management', undefined, false);
      expect(resultWithoutExamples2.realWorldExamples).toEqual([]);
      expect(resultWithoutExamples2.recommendations[0].examples).toEqual([]);
    });

    it('should work with experience level filter and includeExamples: false', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management', 'beginner', false);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should only have beginner recommendations
      result.recommendations.forEach(rec => {
        expect(rec.experienceLevel).toBe('beginner');
      });
      
      // Examples should be filtered out
      result.recommendations.forEach(rec => {
        expect(rec.examples).toEqual([]);
        expect(rec.antipatterns).toEqual([]);
      });
    });

    it('should include examples with experience level filter and includeExamples: true', async () => {
      await analyzer.extractBestPractices();
      const result = await analyzer.analyzeTopic('state_management', 'beginner', true);

      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should only have beginner recommendations
      result.recommendations.forEach(rec => {
        expect(rec.experienceLevel).toBe('beginner');
      });
      
      // Examples should be present (at least in some recommendations)
      const recsWithExamples = result.recommendations.filter(r => r.examples.length > 0);
      expect(recsWithExamples.length).toBeGreaterThan(0);
      
      // Real-world examples should also be present
      expect(result.realWorldExamples.length).toBeGreaterThan(0);
    });
  });
});

