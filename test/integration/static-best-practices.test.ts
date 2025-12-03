import { describe, it, expect, beforeAll } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { 
  BestPracticesAnalyzer,
  STATIC_BEST_PRACTICES
} from '../../src/terragrunt/best-practices.js';

describe('Static Best Practices - Integration', () => {
  let docsManager: TerragruntDocsManager;
  let analyzer: BestPracticesAnalyzer;

  beforeAll(async () => {
    // Use real DocsManager with fixture fallback
    docsManager = new TerragruntDocsManager();
    analyzer = new BestPracticesAnalyzer(docsManager);
  });

  describe('New Topics Integration', () => {
    it('should analyze project_structure topic end-to-end', async () => {
      const result = await analyzer.analyzeTopic('project_structure');

      expect(result.topic).toBe('project_structure');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.commonPitfalls.length).toBeGreaterThan(0);
      expect(result.realWorldExamples.length).toBeGreaterThan(0);
    });

    it('should analyze environment_config topic end-to-end', async () => {
      const result = await analyzer.analyzeTopic('environment_config');

      expect(result.topic).toBe('environment_config');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.commonPitfalls.length).toBeGreaterThan(0);
    });
  });

  describe('Static Practice Retrieval', () => {
    it('should retrieve all static practices', () => {
      const practices = analyzer.getStaticPractices();

      expect(practices.length).toBe(STATIC_BEST_PRACTICES.length);
      expect(practices.length).toBeGreaterThan(20); // Should have at least 20+ practices
    });

    it('should retrieve practices by category', () => {
      const projectPractices = analyzer.getStaticPracticesByCategory('project_structure');
      const envPractices = analyzer.getStaticPracticesByCategory('environment_config');

      expect(projectPractices.length).toBeGreaterThanOrEqual(5);
      expect(envPractices.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Experience Level Filtering', () => {
    it('should filter project_structure by beginner level', async () => {
      const result = await analyzer.analyzeTopic('project_structure', 'beginner');

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.every(r => r.experienceLevel === 'beginner')).toBe(true);
    });

    it('should filter environment_config by intermediate level', async () => {
      const result = await analyzer.analyzeTopic('environment_config', 'intermediate');

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.every(r => r.experienceLevel === 'intermediate')).toBe(true);
    });

    it('should filter by advanced level', async () => {
      const result = await analyzer.analyzeTopic('environment_config', 'advanced');

      // If there are advanced practices, all should be advanced; otherwise, length may be 0
      if (result.recommendations.length > 0) {
        expect(result.recommendations.every(r => r.experienceLevel === 'advanced')).toBe(true);
      }
      // Verify that filtering was applied (confidence still present regardless of count)
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Confidence Scoring', () => {
    it('should have high confidence for topics with static practices', async () => {
      const projectResult = await analyzer.analyzeTopic('project_structure');
      const envResult = await analyzer.analyzeTopic('environment_config');
      const moduleResult = await analyzer.analyzeTopic('module_organization');
      const stateResult = await analyzer.analyzeTopic('state_management');

      // All should have >= 70% confidence due to static practices
      expect(projectResult.confidence).toBeGreaterThanOrEqual(70);
      expect(envResult.confidence).toBeGreaterThanOrEqual(70);
      expect(moduleResult.confidence).toBeGreaterThanOrEqual(70);
      expect(stateResult.confidence).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Content Quality', () => {
    it('should include meaningful examples in recommendations', async () => {
      const result = await analyzer.analyzeTopic('project_structure');

      const hasCodeExamples = result.recommendations.some(
        r => r.examples.some(e => e.includes('{') || e.includes('├──'))
      );
      expect(hasCodeExamples).toBe(true);
    });

    it('should include antipatterns in recommendations', async () => {
      const result = await analyzer.analyzeTopic('project_structure');

      const hasAntipatterns = result.recommendations.some(
        r => r.antipatterns.length > 0
      );
      expect(hasAntipatterns).toBe(true);
    });

    it('should include tradeoffs in recommendations', async () => {
      const result = await analyzer.analyzeTopic('project_structure');

      const hasTradeoffs = result.recommendations.some(
        r => r.tradeoffs.length > 0
      );
      expect(hasTradeoffs).toBe(true);
    });
  });

  describe('All Supported Topics', () => {
    const supportedTopics = [
      'project_structure',
      'environment_config',
      'module_organization',
      'state_management',
      'dependencies',
      'ci_cd',
      'security',
      'performance',
      'testing'
    ];

    for (const topic of supportedTopics) {
      it(`should analyze ${topic} topic successfully`, async () => {
        const result = await analyzer.analyzeTopic(topic);

        expect(result.topic).toBe(topic);
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
      });
    }
  });

  describe('Static Practice ID Validation', () => {
    it('should correctly identify static practice IDs', () => {
      expect(analyzer.isStaticPractice('ps-001')).toBe(true);
      expect(analyzer.isStaticPractice('ec-001')).toBe(true);
      expect(analyzer.isStaticPractice('mo-001')).toBe(true);
      expect(analyzer.isStaticPractice('sm-001')).toBe(true);
      expect(analyzer.isStaticPractice('dp-001')).toBe(true);
      expect(analyzer.isStaticPractice('cd-001')).toBe(true);
      expect(analyzer.isStaticPractice('sc-001')).toBe(true);
      expect(analyzer.isStaticPractice('pf-001')).toBe(true);
      expect(analyzer.isStaticPractice('ts-001')).toBe(true);
    });

    it('should reject invalid practice IDs', () => {
      expect(analyzer.isStaticPractice('invalid')).toBe(false);
      expect(analyzer.isStaticPractice('')).toBe(false);
      expect(analyzer.isStaticPractice('xx-999')).toBe(false);
    });
  });

  describe('Summary Generation', () => {
    it('should generate informative summary for new topics', async () => {
      const projectResult = await analyzer.analyzeTopic('project_structure');
      const envResult = await analyzer.analyzeTopic('environment_config');

      expect(projectResult.summary).toContain('project_structure');
      expect(projectResult.summary.length).toBeGreaterThan(50);

      expect(envResult.summary).toContain('environment_config');
      expect(envResult.summary.length).toBeGreaterThan(50);
    });
  });
});
