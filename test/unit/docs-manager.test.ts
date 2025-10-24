import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerragruntDocsManager, TerragruntDoc } from '../../src/terragrunt/docs.js';

// Mock node-fetch
vi.mock('node-fetch');

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn().mockRejectedValue(new Error('No cache')),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('No file')),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  access: vi.fn().mockRejectedValue(new Error('No cache')),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('No file')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('TerragruntDocsManager', () => {
  let docsManager: TerragruntDocsManager;
  
  beforeEach(() => {
    docsManager = new TerragruntDocsManager();
    vi.clearAllMocks();
  });

  describe('Cache Expiry Logic', () => {
    it('should determine cache needs refresh when no previous fetch', async () => {
      // Access private method through any
      const manager = docsManager as any;
      const needsRefresh = manager.shouldRefreshCache();
      expect(needsRefresh).toBe(true);
    });

    it('should determine cache needs refresh when expired (>24 hours)', async () => {
      const manager = docsManager as any;
      // Set lastFetchTime to 25 hours ago
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 25);
      manager.lastFetchTime = yesterday;
      
      const needsRefresh = manager.shouldRefreshCache();
      expect(needsRefresh).toBe(true);
    });

    it('should determine cache is fresh when within 24 hours', async () => {
      const manager = docsManager as any;
      // Set lastFetchTime to 1 hour ago
      const recentTime = new Date();
      recentTime.setHours(recentTime.getHours() - 1);
      manager.lastFetchTime = recentTime;
      
      const needsRefresh = manager.shouldRefreshCache();
      expect(needsRefresh).toBe(false);
    });
  });

  describe('Section Extraction', () => {
    it('should extract section from standard docs URL', () => {
      const manager = docsManager as any;
      const section = manager.extractSection('/docs/getting-started/quick-start/');
      expect(section).toBe('getting-started');
    });

    it('should extract section from reference URL', () => {
      const manager = docsManager as any;
      const section = manager.extractSection('/docs/reference/config-blocks/');
      expect(section).toBe('reference');
    });

    it('should extract section from features URL', () => {
      const manager = docsManager as any;
      const section = manager.extractSection('/docs/features/keep-your-code-dry/');
      expect(section).toBe('features');
    });

    it('should return "general" for malformed URLs', () => {
      const manager = docsManager as any;
      const section = manager.extractSection('/docs/');
      expect(section).toBe('general');
    });

    it('should return "general" for URLs without section', () => {
      const manager = docsManager as any;
      const section = manager.extractSection('/');
      expect(section).toBe('general');
    });
  });

  describe('Content Cleaning', () => {
    it('should remove extra whitespace', () => {
      const manager = docsManager as any;
      const cleaned = manager.cleanContent('Hello    world    test');
      expect(cleaned).toBe('Hello world test');
    });

    it('should normalize whitespace including newlines', () => {
      const manager = docsManager as any;
      const cleaned = manager.cleanContent('Hello\n\n\nworld');
      // First replacement converts all whitespace to single spaces
      expect(cleaned).toBe('Hello world');
    });

    it('should remove tabs', () => {
      const manager = docsManager as any;
      const cleaned = manager.cleanContent('Hello\t\tworld');
      expect(cleaned).toBe('Hello world');
    });

    it('should trim leading and trailing whitespace', () => {
      const manager = docsManager as any;
      const cleaned = manager.cleanContent('  Hello world  ');
      expect(cleaned).toBe('Hello world');
    });
  });

  describe('Search Functionality', () => {
    const mockDocs: TerragruntDoc[] = [
      {
        title: 'Remote State Configuration',
        url: 'https://example.com/remote-state',
        content: 'Configure remote state backend for Terragrunt',
        section: 'reference',
        lastUpdated: '2025-01-01'
      },
      {
        title: 'Quick Start Guide',
        url: 'https://example.com/quick-start',
        content: 'Getting started with Terragrunt dependencies',
        section: 'getting-started',
        lastUpdated: '2025-01-01'
      },
      {
        title: 'Dependency Management',
        url: 'https://example.com/dependencies',
        content: 'How to manage dependencies between modules',
        section: 'features',
        lastUpdated: '2025-01-01'
      }
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should find docs by title match', async () => {
      const results = await docsManager.searchDocs('remote state');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Remote State Configuration');
    });

    it('should find docs by content match', async () => {
      const results = await docsManager.searchDocs('dependencies');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(doc => doc.content.toLowerCase().includes('dependencies'))).toBe(true);
    });

    it('should find docs by section match', async () => {
      const results = await docsManager.searchDocs('reference');
      expect(results).toHaveLength(1);
      expect(results[0].section).toBe('reference');
    });

    it('should return all docs for empty query', async () => {
      const results = await docsManager.searchDocs('');
      expect(results).toHaveLength(mockDocs.length);
    });

    it('should return empty array for no matches', async () => {
      const results = await docsManager.searchDocs('nonexistentterm12345');
      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const results = await docsManager.searchDocs('REMOTE STATE');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Remote State Configuration');
    });

    it('should prioritize title matches over content matches', async () => {
      const results = await docsManager.searchDocs('dependency');
      expect(results[0].title).toBe('Dependency Management'); // Title match first
    });
  });

  describe('Get Documentation by Section', () => {
    const mockDocs: TerragruntDoc[] = [
      {
        title: 'Doc 1',
        url: 'https://example.com/1',
        content: 'Content 1',
        section: 'getting-started',
        lastUpdated: '2025-01-01'
      },
      {
        title: 'Doc 2',
        url: 'https://example.com/2',
        content: 'Content 2',
        section: 'reference',
        lastUpdated: '2025-01-01'
      },
      {
        title: 'Doc 3',
        url: 'https://example.com/3',
        content: 'Content 3',
        section: 'getting-started',
        lastUpdated: '2025-01-01'
      }
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should return docs for valid section', async () => {
      const results = await docsManager.getDocBySection('getting-started');
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.section === 'getting-started')).toBe(true);
    });

    it('should return empty array for non-existent section', async () => {
      const results = await docsManager.getDocBySection('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return correct count for single-doc section', async () => {
      const results = await docsManager.getDocBySection('reference');
      expect(results).toHaveLength(1);
    });
  });

  describe('Get Available Sections', () => {
    const mockDocs: TerragruntDoc[] = [
      { title: 'Doc 1', url: 'url1', content: 'content', section: 'getting-started' },
      { title: 'Doc 2', url: 'url2', content: 'content', section: 'reference' },
      { title: 'Doc 3', url: 'url3', content: 'content', section: 'features' },
      { title: 'Doc 4', url: 'url4', content: 'content', section: 'getting-started' } // duplicate
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should return unique sections', async () => {
      const sections = await docsManager.getAvailableSections();
      expect(sections).toHaveLength(3);
      expect(sections).toContain('getting-started');
      expect(sections).toContain('reference');
      expect(sections).toContain('features');
    });

    it('should return sorted sections', async () => {
      const sections = await docsManager.getAvailableSections();
      const sorted = [...sections].sort();
      expect(sections).toEqual(sorted);
    });

    it('should return empty array when no docs', async () => {
      const manager = docsManager as any;
      manager.docsCache = new Map();
      manager.lastFetchTime = new Date();
      
      const sections = await docsManager.getAvailableSections();
      expect(sections).toHaveLength(0);
    });
  });

  describe('CLI Command Help Lookup', () => {
    const mockDocs: TerragruntDoc[] = [
      {
        title: 'plan',
        url: 'https://example.com/cli/commands/plan/',
        content: 'Execute terraform plan with Terragrunt',
        section: 'reference'
      },
      {
        title: 'apply',
        url: 'https://example.com/cli/commands/apply/',
        content: 'Execute terraform apply with Terragrunt',
        section: 'reference'
      },
      {
        title: 'run-all',
        url: 'https://example.com/cli/commands/run-all/',
        content: 'Run command across all modules',
        section: 'reference'
      },
      {
        title: 'Features Overview',
        url: 'https://example.com/features/',
        content: 'Overview of features',
        section: 'features'
      }
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should find exact command match by title', async () => {
      const result = await docsManager.getCliCommandHelp('plan');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('plan');
    });

    it('should find exact command match by URL', async () => {
      const result = await docsManager.getCliCommandHelp('run-all');
      expect(result).not.toBeNull();
      expect(result?.url).toContain('/run-all/');
    });

    it('should return null for non-existent command', async () => {
      const result = await docsManager.getCliCommandHelp('nonexistent');
      expect(result).toBeNull();
    });

    it('should be case insensitive', async () => {
      const result = await docsManager.getCliCommandHelp('APPLY');
      expect(result).not.toBeNull();
      expect(result?.title.toLowerCase()).toBe('apply');
    });

    it('should only search in reference section', async () => {
      // This ensures we don't match "plan" in non-CLI documentation
      const result = await docsManager.getCliCommandHelp('features');
      expect(result).toBeNull(); // Should not match features section doc
    });
  });

  describe('HCL Config Reference Lookup', () => {
    const mockDocs: TerragruntDoc[] = [
      {
        title: 'terraform block',
        url: 'https://example.com/hcl/blocks/terraform',
        content: 'The terraform block configures Terraform settings',
        section: 'reference'
      },
      {
        title: 'remote_state',
        url: 'https://example.com/config-blocks-and-attributes/remote_state',
        content: 'Configure remote state backend',
        section: 'reference'
      },
      {
        title: 'dependency',
        url: 'https://example.com/hcl/blocks/dependency',
        content: 'Define dependencies between modules',
        section: 'reference'
      },
      {
        title: 'Getting Started',
        url: 'https://example.com/getting-started',
        content: 'How to get started',
        section: 'getting-started'
      }
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should find HCL block by title', async () => {
      const results = await docsManager.getHclConfigReference('terraform');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title.toLowerCase()).toContain('terraform');
    });

    it('should find HCL config by content match', async () => {
      const results = await docsManager.getHclConfigReference('remote state');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(doc => doc.content.toLowerCase().includes('remote state'))).toBe(true);
    });

    it('should return empty array for non-existent config', async () => {
      const results = await docsManager.getHclConfigReference('nonexistentconfig');
      expect(results).toHaveLength(0);
    });

    it('should only search in reference section with HCL URLs', async () => {
      const results = await docsManager.getHclConfigReference('getting started');
      expect(results).toHaveLength(0); // Should not match non-reference docs
    });

    it('should be case insensitive', async () => {
      const results = await docsManager.getHclConfigReference('DEPENDENCY');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Code Example Extraction', () => {
    const mockDocs: TerragruntDoc[] = [
      {
        title: 'Remote State Example',
        url: 'https://example.com/remote-state',
        content: `
          Configure remote state with:
          remote_state {
            backend = "s3"
            config = {
              bucket = "my-bucket"
            }
          }
          This is how you set it up.
        `,
        section: 'reference'
      },
      {
        title: 'Dependency Example',
        url: 'https://example.com/dependency',
        content: `
          Define dependencies:
          dependency "vpc" {
            config_path = "../vpc"
          }
          inputs = {
            vpc_id = dependency.vpc.outputs.vpc_id
          }
        `,
        section: 'features'
      },
      {
        title: 'No Code',
        url: 'https://example.com/nocode',
        content: 'This document has no code examples',
        section: 'general'
      }
    ];

    beforeEach(() => {
      const manager = docsManager as any;
      manager.docsCache = new Map(mockDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();
    });

    it('should extract code examples from relevant docs', async () => {
      const results = await docsManager.getCodeExamples('remote state');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].examples.length).toBeGreaterThan(0);
    });

    it('should return empty array when no code found', async () => {
      const results = await docsManager.getCodeExamples('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should extract dependency blocks', async () => {
      const results = await docsManager.getCodeExamples('dependency');
      expect(results.length).toBeGreaterThan(0);
      const hasDepExample = results.some(r => 
        r.examples.some(ex => ex.includes('dependency'))
      );
      expect(hasDepExample).toBe(true);
    });

    it('should limit results to prevent overwhelming output', async () => {
      // Create many matching docs
      const manager = docsManager as any;
      const manyDocs = Array.from({ length: 20 }, (_, i) => ({
        title: `Doc ${i}`,
        url: `https://example.com/${i}`,
        content: `dependency "test" { config_path = "../test${i}" }`,
        section: 'features'
      }));
      manager.docsCache = new Map(manyDocs.map(doc => [doc.url, doc]));
      manager.lastFetchTime = new Date();

      const results = await docsManager.getCodeExamples('dependency');
      expect(results.length).toBeLessThanOrEqual(10); // Should limit to 10
    });

    it('should not return docs without code examples', async () => {
      const results = await docsManager.getCodeExamples('no code');
      // The doc matches but has no code blocks
      expect(results.every(r => r.examples.length > 0)).toBe(true);
    });
  });

  describe('Code Block Extraction', () => {
    it('should extract terraform blocks', () => {
      const manager = docsManager as any;
      const content = `
        Example configuration:
        terraform {
          source = "git::https://github.com/example/repo.git"
        }
      `;
      const blocks = manager.extractCodeBlocks(content);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.some((b: string) => b.includes('terraform'))).toBe(true);
    });

    it('should extract remote_state blocks', () => {
      const manager = docsManager as any;
      const content = `
        remote_state {
          backend = "s3"
          config = { bucket = "test" }
        }
      `;
      const blocks = manager.extractCodeBlocks(content);
      expect(blocks.some((b: string) => b.includes('remote_state'))).toBe(true);
    });

    it('should extract dependency blocks', () => {
      const manager = docsManager as any;
      const content = `
        dependency "vpc" {
          config_path = "../vpc"
        }
      `;
      const blocks = manager.extractCodeBlocks(content);
      expect(blocks.some((b: string) => b.includes('dependency'))).toBe(true);
    });

    it('should limit extracted blocks to 5', () => {
      const manager = docsManager as any;
      const content = `
        dependency "a" { config_path = "../a" }
        dependency "b" { config_path = "../b" }
        dependency "c" { config_path = "../c" }
        dependency "d" { config_path = "../d" }
        dependency "e" { config_path = "../e" }
        dependency "f" { config_path = "../f" }
        dependency "g" { config_path = "../g" }
      `;
      const blocks = manager.extractCodeBlocks(content);
      expect(blocks.length).toBeLessThanOrEqual(5);
    });

    it('should remove duplicate blocks', () => {
      const manager = docsManager as any;
      const content = `
        dependency "vpc" { config_path = "../vpc" }
        dependency "vpc" { config_path = "../vpc" }
      `;
      const blocks = manager.extractCodeBlocks(content);
      const uniqueBlocks = new Set(blocks);
      expect(blocks.length).toBe(uniqueBlocks.size);
    });

    it('should return empty array when no code blocks', () => {
      const manager = docsManager as any;
      const content = 'This is just plain text with no code';
      const blocks = manager.extractCodeBlocks(content);
      expect(blocks).toHaveLength(0);
    });
  });
});
