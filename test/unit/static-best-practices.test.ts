import { describe, it, expect, beforeEach } from 'vitest';
import type { TerragruntDoc } from '../../src/terragrunt/docs.js';
import { 
  BestPracticesAnalyzer, 
  STATIC_BEST_PRACTICES
} from '../../src/terragrunt/best-practices.js';

/**
 * Mock DocsManager for testing without network calls
 */
class MockDocsManager {
  private docs: TerragruntDoc[];
  constructor(docs: TerragruntDoc[] = []) { 
    this.docs = docs; 
  }
  async fetchLatestDocs(): Promise<TerragruntDoc[]> { 
    return this.docs; 
  }
}

describe('Static Best Practices', () => {
  describe('STATIC_BEST_PRACTICES constant', () => {
    it('should contain best practices for all categories', () => {
      const categories = new Set(STATIC_BEST_PRACTICES.map(p => p.category));
      
      expect(categories.has('project_structure')).toBe(true);
      expect(categories.has('environment_config')).toBe(true);
      expect(categories.has('module_organization')).toBe(true);
      expect(categories.has('state_management')).toBe(true);
      expect(categories.has('dependencies')).toBe(true);
      expect(categories.has('ci_cd')).toBe(true);
      expect(categories.has('security')).toBe(true);
      expect(categories.has('performance')).toBe(true);
      expect(categories.has('testing')).toBe(true);
    });

    it('should have unique IDs for all practices', () => {
      const ids = STATIC_BEST_PRACTICES.map(p => p.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required fields populated', () => {
      for (const practice of STATIC_BEST_PRACTICES) {
        expect(practice.id).toBeTruthy();
        expect(practice.practice).toBeTruthy();
        expect(practice.rationale).toBeTruthy();
        expect(practice.category).toBeTruthy();
        expect(practice.priority).toBeTruthy();
        expect(practice.experienceLevel).toBeTruthy();
        expect(Array.isArray(practice.examples)).toBe(true);
        expect(practice.examples.length).toBeGreaterThan(0);
        expect(Array.isArray(practice.antipatterns)).toBe(true);
        expect(Array.isArray(practice.tradeoffs)).toBe(true);
        expect(Array.isArray(practice.relatedDocs)).toBe(true);
      }
    });

    it('should have valid priority values', () => {
      const validPriorities = ['critical', 'recommended', 'optional'];
      
      for (const practice of STATIC_BEST_PRACTICES) {
        expect(validPriorities).toContain(practice.priority);
      }
    });

    it('should have valid experience levels', () => {
      const validLevels = ['beginner', 'intermediate', 'advanced'];
      
      for (const practice of STATIC_BEST_PRACTICES) {
        expect(validLevels).toContain(practice.experienceLevel);
      }
    });

    it('should have at least 5 practices for project_structure', () => {
      const projectStructure = STATIC_BEST_PRACTICES.filter(
        p => p.category === 'project_structure'
      );
      expect(projectStructure.length).toBeGreaterThanOrEqual(5);
    });

    it('should have at least 5 practices for environment_config', () => {
      const envConfig = STATIC_BEST_PRACTICES.filter(
        p => p.category === 'environment_config'
      );
      expect(envConfig.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Project Structure Practices', () => {
    const projectStructurePractices = STATIC_BEST_PRACTICES.filter(
      p => p.category === 'project_structure'
    );

    it('should include live/modules separation practice', () => {
      const hasSeparation = projectStructurePractices.some(
        p => p.practice.toLowerCase().includes('live') || 
             p.practice.toLowerCase().includes('modules') ||
             p.practice.toLowerCase().includes('separate')
      );
      expect(hasSeparation).toBe(true);
    });

    it('should include root terragrunt.hcl practice', () => {
      const hasRoot = projectStructurePractices.some(
        p => p.practice.toLowerCase().includes('root') ||
             p.practice.toLowerCase().includes('terragrunt.hcl')
      );
      expect(hasRoot).toBe(true);
    });

    it('should include _envcommon pattern', () => {
      const hasEnvcommon = projectStructurePractices.some(
        p => p.practice.toLowerCase().includes('envcommon') ||
             p.practice.toLowerCase().includes('common')
      );
      expect(hasEnvcommon).toBe(true);
    });

    it('should include environment/region organization', () => {
      const hasOrganization = projectStructurePractices.some(
        p => p.practice.toLowerCase().includes('environment') ||
             p.practice.toLowerCase().includes('region')
      );
      expect(hasOrganization).toBe(true);
    });
  });

  describe('Environment Config Practices', () => {
    const envConfigPractices = STATIC_BEST_PRACTICES.filter(
      p => p.category === 'environment_config'
    );

    it('should include get_env for secrets practice', () => {
      const hasGetEnv = envConfigPractices.some(
        p => p.practice.toLowerCase().includes('get_env') ||
             p.practice.toLowerCase().includes('environment variable') ||
             p.practice.toLowerCase().includes('sensitive')
      );
      expect(hasGetEnv).toBe(true);
    });

    it('should include env-specific config files practice', () => {
      const hasEnvFiles = envConfigPractices.some(
        p => p.practice.toLowerCase().includes('env.hcl') ||
             p.practice.toLowerCase().includes('environment') ||
             p.practice.toLowerCase().includes('variables')
      );
      expect(hasEnvFiles).toBe(true);
    });

    it('should include merge_strategy practice', () => {
      const hasMerge = envConfigPractices.some(
        p => p.practice.toLowerCase().includes('merge') ||
             p.practice.toLowerCase().includes('include')
      );
      expect(hasMerge).toBe(true);
    });

    it('should include dependency blocks practice', () => {
      const hasDependency = envConfigPractices.some(
        p => p.practice.toLowerCase().includes('dependency') ||
             p.practice.toLowerCase().includes('mock_outputs')
      );
      expect(hasDependency).toBe(true);
    });
  });
});

describe('BestPracticesAnalyzer - Static Practice Integration', () => {
  let analyzer: BestPracticesAnalyzer;

  beforeEach(() => {
    // Create analyzer with empty docs to test static-only scenarios
    analyzer = new BestPracticesAnalyzer(new MockDocsManager([]) as any);
  });

  describe('getStaticPractices', () => {
    it('should return all static practices', () => {
      const practices = analyzer.getStaticPractices();
      
      expect(practices.length).toBe(STATIC_BEST_PRACTICES.length);
      expect(practices).not.toBe(STATIC_BEST_PRACTICES); // Should be a copy
    });

    it('should return a defensive copy', () => {
      const practices1 = analyzer.getStaticPractices();
      const practices2 = analyzer.getStaticPractices();
      
      expect(practices1).not.toBe(practices2);
    });
  });

  describe('getStaticPracticesByCategory', () => {
    it('should return practices for project_structure', () => {
      const practices = analyzer.getStaticPracticesByCategory('project_structure');
      
      expect(practices.length).toBeGreaterThan(0);
      expect(practices.every(p => p.category === 'project_structure')).toBe(true);
    });

    it('should return practices for environment_config', () => {
      const practices = analyzer.getStaticPracticesByCategory('environment_config');
      
      expect(practices.length).toBeGreaterThan(0);
      expect(practices.every(p => p.category === 'environment_config')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = analyzer.getStaticPracticesByCategory('project_structure');
      const upper = analyzer.getStaticPracticesByCategory('PROJECT_STRUCTURE');
      const mixed = analyzer.getStaticPracticesByCategory('Project_Structure');
      
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it('should return empty array for unknown category', () => {
      const practices = analyzer.getStaticPracticesByCategory('unknown_category');
      
      expect(practices).toEqual([]);
    });
  });

  describe('isStaticPractice', () => {
    it('should return true for valid practice IDs', () => {
      expect(analyzer.isStaticPractice('ps-001')).toBe(true);
      expect(analyzer.isStaticPractice('ec-001')).toBe(true);
      expect(analyzer.isStaticPractice('mo-001')).toBe(true);
    });

    it('should return false for invalid practice IDs', () => {
      expect(analyzer.isStaticPractice('invalid-id')).toBe(false);
      expect(analyzer.isStaticPractice('xyz-999')).toBe(false);
    });

    it('should return false for empty or whitespace input', () => {
      expect(analyzer.isStaticPractice('')).toBe(false);
      expect(analyzer.isStaticPractice('   ')).toBe(false);
    });
  });

  describe('analyzeTopic with static practices', () => {
    it('should return static practices for project_structure', async () => {
      const result = await analyzer.analyzeTopic('project_structure');
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.topic).toBe('project_structure');
    });

    it('should return static practices for environment_config', async () => {
      const result = await analyzer.analyzeTopic('environment_config');
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.topic).toBe('environment_config');
    });

    it('should filter by experience level', async () => {
      const beginnerResult = await analyzer.analyzeTopic('project_structure', 'beginner');
      const advancedResult = await analyzer.analyzeTopic('environment_config', 'advanced');
      
      expect(beginnerResult.recommendations.every(r => r.experienceLevel === 'beginner')).toBe(true);
      expect(advancedResult.recommendations.every(r => r.experienceLevel === 'advanced')).toBe(true);
    });

    it('should include common pitfalls from static practices', async () => {
      const result = await analyzer.analyzeTopic('project_structure');
      
      expect(result.commonPitfalls.length).toBeGreaterThan(0);
    });

    it('should include real-world examples from static practices', async () => {
      const result = await analyzer.analyzeTopic('project_structure');
      
      expect(result.realWorldExamples.length).toBeGreaterThan(0);
    });

    it('should have high confidence for topics with static practices', async () => {
      const projectResult = await analyzer.analyzeTopic('project_structure');
      const envResult = await analyzer.analyzeTopic('environment_config');
      const stateResult = await analyzer.analyzeTopic('state_management');
      
      // All should have >= 70% confidence due to static practices
      expect(projectResult.confidence).toBeGreaterThanOrEqual(70);
      expect(envResult.confidence).toBeGreaterThanOrEqual(70);
      expect(stateResult.confidence).toBeGreaterThanOrEqual(70);
    });

    it('should generate meaningful summary', async () => {
      const result = await analyzer.analyzeTopic('project_structure');
      
      expect(result.summary).toContain('project_structure');
      expect(result.summary.length).toBeGreaterThan(50);
    });
  });

  describe('analyzeTopic with experience notes', () => {
    it('should group recommendations by experience level', async () => {
      const result = await analyzer.analyzeTopic('project_structure');
      
      expect(result.experienceNotes.beginner.length).toBeGreaterThanOrEqual(0);
      expect(result.experienceNotes.intermediate.length).toBeGreaterThanOrEqual(0);
      expect(result.experienceNotes.advanced.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Static Practice Content Quality', () => {
  describe('Examples should be meaningful', () => {
    it('should have code examples with actual HCL content', () => {
      const practicesWithCodeExamples = STATIC_BEST_PRACTICES.filter(
        p => p.examples.some(e => e.includes('{') || e.includes('├──'))
      );
      
      // Most practices should have code examples
      expect(practicesWithCodeExamples.length).toBeGreaterThan(STATIC_BEST_PRACTICES.length * 0.8);
    });

    it('should have examples longer than 30 characters on average', () => {
      let totalLength = 0;
      let totalExamples = 0;
      
      for (const practice of STATIC_BEST_PRACTICES) {
        for (const example of practice.examples) {
          totalLength += example.length;
          totalExamples++;
        }
      }
      
      const averageLength = totalLength / totalExamples;
      expect(averageLength).toBeGreaterThan(100); // Average should be much longer
    });
  });

  describe('Rationale should be meaningful', () => {
    it('should have rationale longer than 50 characters', () => {
      for (const practice of STATIC_BEST_PRACTICES) {
        expect(practice.rationale.length).toBeGreaterThan(50);
      }
    });
  });

  describe('Practice descriptions should be clear', () => {
    it('should have practice descriptions longer than 20 characters', () => {
      for (const practice of STATIC_BEST_PRACTICES) {
        expect(practice.practice.length).toBeGreaterThan(20);
      }
    });
  });

  describe('Category distribution', () => {
    it('should have reasonable distribution across categories', () => {
      const categoryCount: Record<string, number> = {};
      
      for (const practice of STATIC_BEST_PRACTICES) {
        categoryCount[practice.category] = (categoryCount[practice.category] || 0) + 1;
      }
      
      // Each category should have at least 2 practices
      for (const count of Object.values(categoryCount)) {
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

describe('New Topics Keywords', () => {
  let analyzer: BestPracticesAnalyzer;

  beforeEach(() => {
    analyzer = new BestPracticesAnalyzer(new MockDocsManager([]) as any);
  });

  it('should recognize project_structure as a valid topic', async () => {
    const result = await analyzer.analyzeTopic('project_structure');
    
    // Should not return "did you mean" suggestions
    expect(result.suggestedTopics).toBeUndefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should recognize environment_config as a valid topic', async () => {
    const result = await analyzer.analyzeTopic('environment_config');
    
    // Should not return "did you mean" suggestions
    expect(result.suggestedTopics).toBeUndefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
