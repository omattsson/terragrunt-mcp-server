import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceHandler, Resource } from '../../src/handlers/resources.js';
import { TerragruntDoc } from '../../src/terragrunt/docs.js';

// Create mock instance that will be reused
const mockDocsManager = {
  fetchLatestDocs: vi.fn(),
  getAvailableSections: vi.fn(),
  getDocBySection: vi.fn(),
  searchDocs: vi.fn()
};

// Mock the TerragruntDocsManager module
vi.mock('../../src/terragrunt/docs.js', () => {
  return {
    TerragruntDocsManager: class {
      fetchLatestDocs = mockDocsManager.fetchLatestDocs;
      getAvailableSections = mockDocsManager.getAvailableSections;
      getDocBySection = mockDocsManager.getDocBySection;
      searchDocs = mockDocsManager.searchDocs;
    }
  };
});

describe('ResourceHandler', () => {
  let resourceHandler: ResourceHandler;

  const mockDocs: TerragruntDoc[] = [
    {
      title: 'Quick Start',
      url: 'https://terragrunt.gruntwork.io/docs/getting-started/quick-start/',
      content: 'Getting started guide',
      section: 'getting-started',
      lastUpdated: '2025-01-01'
    },
    {
      title: 'Remote State',
      url: 'https://terragrunt.gruntwork.io/docs/reference/remote-state/',
      content: 'Remote state configuration',
      section: 'reference',
      lastUpdated: '2025-01-01'
    },
    {
      title: 'Dependencies',
      url: 'https://terragrunt.gruntwork.io/docs/features/dependencies/',
      content: 'Dependency management',
      section: 'features',
      lastUpdated: '2025-01-01'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock return values
    mockDocsManager.fetchLatestDocs.mockResolvedValue(mockDocs);
    mockDocsManager.getAvailableSections.mockResolvedValue(['getting-started', 'reference', 'features']);
    mockDocsManager.getDocBySection.mockImplementation((section: string) => 
      Promise.resolve(mockDocs.filter(doc => doc.section === section))
    );
    mockDocsManager.searchDocs.mockResolvedValue([]);
    
    // Create new instance for each test
    resourceHandler = new ResourceHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Resource Listing', () => {
    it('should list all resource types', async () => {
      const resources = await resourceHandler.listResources();
      
      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
    });

    it('should include overview resource', async () => {
      const resources = await resourceHandler.listResources();
      
      const overview = resources.find(r => r.uri === 'terragrunt://docs/overview');
      expect(overview).toBeDefined();
      expect(overview?.name).toBe('Terragrunt Documentation Overview');
    });

    it('should include section resources', async () => {
      const resources = await resourceHandler.listResources();
      
      const sections = resources.filter(r => r.uri.startsWith('terragrunt://docs/section/'));
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.some(s => s.uri === 'terragrunt://docs/section/getting-started')).toBe(true);
      expect(sections.some(s => s.uri === 'terragrunt://docs/section/reference')).toBe(true);
    });

    it('should include page resources', async () => {
      const resources = await resourceHandler.listResources();
      
      const pages = resources.filter(r => r.uri.startsWith('terragrunt://docs/page/'));
      expect(pages.length).toBeGreaterThan(0);
    });

    it('should limit page resources to 50', async () => {
      // Create more than 50 docs
      const manyDocs = Array.from({ length: 100 }, (_, i) => ({
        title: `Doc ${i}`,
        url: `https://example.com/${i}`,
        content: 'content',
        section: 'test'
      }));

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce(manyDocs);
      mockDocsManager.getAvailableSections.mockResolvedValueOnce(['test']);

      const resources = await resourceHandler.listResources();
      const pages = resources.filter(r => r.uri.startsWith('terragrunt://docs/page/'));
      
      expect(pages.length).toBeLessThanOrEqual(50);
    });

    it('should include mimeType for all resources', async () => {
      const resources = await resourceHandler.listResources();
      
      expect(resources.every(r => r.mimeType)).toBe(true);
    });

    it('should handle docs fetch failure gracefully', async () => {
      mockDocsManager.fetchLatestDocs.mockRejectedValueOnce(new Error('Network error'));

      const resources = await resourceHandler.listResources();
      
      expect(resources).toBeDefined();
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.some(r => r.uri === 'terragrunt://error')).toBe(true);
    });
  });

  describe('Resource URI Parsing', () => {
    it('should correctly encode page URLs in URIs', async () => {
      const resources = await resourceHandler.listResources();
      
      const pageResource = resources.find(r => r.uri.startsWith('terragrunt://docs/page/'));
      expect(pageResource).toBeDefined();
      
      // URI should have encoded URL
      const urlPart = pageResource!.uri.replace('terragrunt://docs/page/', '');
      expect(urlPart).toBeTruthy();
      
      // Decode and verify it's a valid URL
      const decodedUrl = decodeURIComponent(urlPart);
      expect(decodedUrl).toMatch(/^https?:\/\//);
    });

    it('should handle URLs with special characters', async () => {
      const specialDoc: TerragruntDoc = {
        title: 'Special & Char',
        url: 'https://example.com/docs/test?param=value&other=test',
        content: 'content',
        section: 'test',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce([specialDoc]);
      mockDocsManager.getAvailableSections.mockResolvedValueOnce(['test']);

      const resources = await resourceHandler.listResources();
      const pageResource = resources.find(r => r.name === specialDoc.title);
      
      expect(pageResource).toBeDefined();
      const urlPart = pageResource!.uri.replace('terragrunt://docs/page/', '');
      const decoded = decodeURIComponent(urlPart);
      expect(decoded).toBe(specialDoc.url);
    });
  });

  describe('Resource Content Retrieval', () => {
    it('should retrieve overview resource content', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');
      
      expect(resource).toBeDefined();
      expect(resource.contents).toHaveLength(1);
      expect(resource.contents[0].type).toBe('text');
      expect(resource.contents[0].text).toContain('Terragrunt Documentation Overview');
      expect(resource.mimeType).toBe('text/markdown');
    });

    it('should include section counts in overview', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');
      
      expect(resource.contents[0].text).toContain('getting-started');
      expect(resource.contents[0].text).toContain('reference');
      expect(resource.contents[0].text).toContain('features');
    });

    it('should retrieve section resource content', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/section/getting-started');
      
      expect(resource).toBeDefined();
      expect(resource.contents).toHaveLength(1);
      expect(resource.contents[0].text).toContain('getting-started');
      expect(resource.mimeType).toBe('text/markdown');
    });

    it('should retrieve page resource content', async () => {
      const url = encodeURIComponent('https://terragrunt.gruntwork.io/docs/getting-started/quick-start/');
      const resource = await resourceHandler.getResource(`terragrunt://docs/page/${url}`);
      
      expect(resource).toBeDefined();
      expect(resource.contents).toHaveLength(1);
      expect(resource.mimeType).toBe('text/markdown');
    });

    it('should handle invalid section gracefully', async () => {
      mockDocsManager.getDocBySection.mockResolvedValueOnce([]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/nonexistent');
      
      expect(resource).toBeDefined();
      expect(resource.contents[0].text).toContain('No documentation found');
    });

    it('should handle invalid page URL gracefully', async () => {
      const url = encodeURIComponent('https://invalid.com/nonexistent');
      
      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce([]);
      
      const resource = await resourceHandler.getResource(`terragrunt://docs/page/${url}`);
      
      expect(resource).toBeDefined();
      expect(resource.contents[0].text).toContain('not found');
    });

    it('should handle unknown URI scheme', async () => {
      const resource = await resourceHandler.getResource('unknown://invalid');
      
      expect(resource).toBeDefined();
      expect(resource.contents[0].text).toContain('Unknown resource');
    });
  });

  describe('Error Handling', () => {
    it('should return error resource on docs manager failure', async () => {
      mockDocsManager.fetchLatestDocs.mockRejectedValueOnce(new Error('Fetch failed'));

      const resources = await resourceHandler.listResources();
      
      expect(resources.some(r => r.name === 'Documentation Error')).toBe(true);
    });

    it('should not throw on getResource errors', async () => {
      mockDocsManager.fetchLatestDocs.mockRejectedValueOnce(new Error('Error'));

      await expect(
        resourceHandler.getResource('terragrunt://docs/overview')
      ).resolves.toBeDefined();
    });

    it('should provide helpful error messages', async () => {
      mockDocsManager.getDocBySection.mockResolvedValueOnce([]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/invalid');
      
      expect(resource.contents[0].text).toMatch(/No documentation found/i);
    });
  });

  describe('Search Documentation', () => {
    beforeEach(() => {
      mockDocsManager.searchDocs.mockImplementation((query: string) => {
        return Promise.resolve(
          mockDocs.filter(doc => 
            doc.title.toLowerCase().includes(query.toLowerCase()) ||
            doc.content.toLowerCase().includes(query.toLowerCase())
          )
        );
      });
    });

    it('should search documentation through docsManager', async () => {
      const results = await resourceHandler.searchDocumentation('remote');
      
      expect(mockDocsManager.searchDocs).toHaveBeenCalledWith('remote');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return search results', async () => {
      const results = await resourceHandler.searchDocumentation('dependencies');
      
      expect(results.some(doc => doc.title === 'Dependencies')).toBe(true);
    });

    it('should handle empty search query', async () => {
      mockDocsManager.searchDocs.mockResolvedValueOnce(mockDocs);
      
      const results = await resourceHandler.searchDocumentation('');
      
      expect(results).toHaveLength(mockDocs.length);
    });
  });

  describe('Content Formatting', () => {
    it('should format section content with titles and URLs', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/section/features');
      
      const text = resource.contents[0].text;
      expect(text).toContain('Dependencies'); // Title from mockDocs
      expect(text).toContain('Dependency management'); // Content from mockDocs
      expect(text).toContain('# Terragrunt features Documentation'); // Section header
    });

    it('should truncate long section lists in overview', async () => {
      const manyDocs = Array.from({ length: 20 }, (_, i) => ({
        title: `Doc ${i}`,
        url: `https://example.com/${i}`,
        content: 'content',
        section: 'test',
        lastUpdated: '2025-01-01'
      }));

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce(manyDocs);
      mockDocsManager.getAvailableSections.mockResolvedValueOnce(['test']);
      mockDocsManager.getDocBySection.mockImplementation((section: string) => 
        Promise.resolve(manyDocs.filter(doc => doc.section === section))
      );

      const resource = await resourceHandler.getResource('terragrunt://docs/overview');
      
      // Overview should show "... and X more pages" when there are more than 10 docs in a section
      expect(resource.contents[0].text).toContain('and');
      expect(resource.contents[0].text).toContain('more');
    });

    it('should show page count in overview', async () => {
      const resource = await resourceHandler.getResource('terragrunt://docs/overview');
      
      expect(resource.contents[0].text).toMatch(/Total documentation pages: \d+/);
    });
  });

  describe('Content Truncation', () => {
    it('should truncate long section content to 250 chars per doc', async () => {
      const longContent = 'A'.repeat(500); // Content longer than limit
      const longDoc = {
        title: 'Long Doc',
        url: 'https://example.com/long',
        content: longContent,
        section: 'test-section',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.getDocBySection.mockResolvedValueOnce([longDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/test-section');
      const text = resource.contents[0].text;

      // Should be truncated - verify total length is reasonable
      // Text should include: section header, doc title, truncated content (250 chars), help message
      expect(text).toContain('...'); // Truncation marker
      expect(text.length).toBeLessThan(longContent.length); // Must be shorter than original
      expect(text).toContain('This is a truncated summary'); // Help message
      expect(text).toContain('get_terragrunt_documentation'); // Tool suggestion
    });

    it('should truncate long page content to 1200 chars', async () => {
      const longContent = 'B'.repeat(3000); // Content longer than limit
      const longDoc = {
        title: 'Long Page',
        url: 'https://example.com/long-page',
        content: longContent,
        section: 'test',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce([longDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/page/https%3A%2F%2Fexample.com%2Flong-page');
      const text = resource.contents[0].text;

      // Should be truncated
      expect(text).toContain('...'); // Truncation marker
      expect(text).toContain('This is a truncated preview'); // Help message
      expect(text).toContain('get_terragrunt_documentation'); // Tool suggestion
    });

    it('should preserve short section content without truncation', async () => {
      const shortContent = 'Short content here';
      const shortDoc = {
        title: 'Short Doc',
        url: 'https://example.com/short',
        content: shortContent,
        section: 'test-section',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.getDocBySection.mockResolvedValueOnce([shortDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/test-section');
      const text = resource.contents[0].text;

      // Should not be truncated
      expect(text).toContain(shortContent);
      expect(text).not.toContain('This is a truncated summary');
    });

    it('should preserve short page content without truncation', async () => {
      const shortContent = 'Brief page content';
      const shortDoc = {
        title: 'Short Page',
        url: 'https://example.com/short-page',
        content: shortContent,
        section: 'test',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce([shortDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/page/https%3A%2F%2Fexample.com%2Fshort-page');
      const text = resource.contents[0].text;

      // Should not be truncated
      expect(text).toContain(shortContent);
      expect(text).not.toContain('This is a truncated preview');
    });

    it('should truncate at word boundaries when possible', async () => {
      // Create content with a space near the 250 char limit
      const contentWithSpaces = 'A'.repeat(200) + ' some more words here that should be cut off because they exceed the limit';
      const docWithSpaces = {
        title: 'Boundary Doc',
        url: 'https://example.com/boundary',
        content: contentWithSpaces,
        section: 'test-section',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.getDocBySection.mockResolvedValueOnce([docWithSpaces]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/test-section');
      const text = resource.contents[0].text;

      // Should truncate at the space, not mid-word
      expect(text).toContain('...'); // Truncation marker
      // The truncation should happen at a space within the last 20% of the limit (80% threshold)
      // We have 200 'A's, so should retain at least 75% of them (150+ chars)
      const aCount = (text.match(/A/g) || []).length;
      const originalACount = 200;
      expect(aCount).toBeGreaterThan(Math.floor(originalACount * 0.75)); // At least 75% of A's retained
      expect(text).not.toContain('exceed the limit'); // Should not have the end
    });

    it('should include helpful message with query suggestion for sections', async () => {
      const longContent = 'C'.repeat(500);
      const longDoc = {
        title: 'Long Doc',
        url: 'https://example.com/long',
        content: longContent,
        section: 'my-section',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.getDocBySection.mockResolvedValueOnce([longDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/section/my-section');
      const text = resource.contents[0].text;

      // Help message should reference the section name
      expect(text).toContain('query="my-section"');
      expect(text).toContain('@copilot /tools');
    });

    it('should include helpful message with title suggestion for pages', async () => {
      const longContent = 'D'.repeat(3000);
      const longDoc = {
        title: 'My Long Page',
        url: 'https://example.com/long-page',
        content: longContent,
        section: 'test',
        lastUpdated: '2025-01-01'
      };

      mockDocsManager.fetchLatestDocs.mockResolvedValueOnce([longDoc]);

      const resource = await resourceHandler.getResource('terragrunt://docs/page/https%3A%2F%2Fexample.com%2Flong-page');
      const text = resource.contents[0].text;

      // Help message should reference the page title
      expect(text).toContain('query="My Long Page"');
      expect(text).toContain('@copilot /tools');
    });
  });
});
