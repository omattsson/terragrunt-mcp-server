import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

// Mock fs/promises - need to mock the default export
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn()
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
  stat: vi.fn()
}));

describe('Error Handling - Network Failures', () => {
  let docsManager: TerragruntDocsManager;
  let mockFetch: any;
  let mockFs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked modules
    const fetchModule = await import('node-fetch');
    mockFetch = fetchModule.default as any;
    
    const fsModule = await import('fs/promises');
    mockFs = {
      readFile: fsModule.readFile as any,
      writeFile: fsModule.writeFile as any,
      mkdir: fsModule.mkdir as any,
      access: fsModule.access as any,
      stat: fsModule.stat as any
    };
    
    docsManager = new TerragruntDocsManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Failures During Doc Fetch', () => {
    it('should handle network timeout', async () => {
      // Mock fetch to simulate timeout
      mockFetch.mockRejectedValue(new Error('Network timeout'));
      
      // Mock disk cache to not exist
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      
      // Mock fixture file to exist as fallback
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      // Should fall back to fixture
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle HTTP 404 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle HTTP 500 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle DNS resolution failure', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle connection refused', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle SSL/TLS errors', async () => {
      mockFetch.mockRejectedValue(new Error('self signed certificate'));
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe('Malformed HTML/Parsing Errors', () => {
    it('should handle empty HTML response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => ''
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      // Should fall back to fixture when HTML is empty/unparseable
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle malformed HTML', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body><div class="unclosed'
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle HTML with no documentation content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body><h1>No docs here</h1></body></html>'
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle HTML with unexpected structure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body><div class="wrong-class">Content</div></body></html>'
      });
      
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe('Disk I/O Errors', () => {
    it('should handle permission denied when reading cache', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any).mockRejectedValueOnce(new Error('EACCES: permission denied'));
      
      // Should fall back to network fetch
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body></body></html>'
      });
      
      // Fixture fallback
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle permission denied when writing cache', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.mkdir as any).mockRejectedValue(new Error('EACCES: permission denied'));
      (mockFs.writeFile as any).mockRejectedValue(new Error('EACCES: permission denied'));
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body></body></html>'
      });
      
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      // Should still work even if cache write fails
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle disk full error when writing cache', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.mkdir as any).mockResolvedValue(undefined);
      (mockFs.writeFile as any).mockRejectedValue(new Error('ENOSPC: no space left on device'));
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body></body></html>'
      });
      
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle read-only filesystem', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      (mockFs.mkdir as any).mockRejectedValue(new Error('EROFS: read-only file system'));
      (mockFs.writeFile as any).mockRejectedValue(new Error('EROFS: read-only file system'));
      
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body></body></html>'
      });
      
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe('Invalid Cache File Format', () => {
    it('should handle corrupted JSON in cache file', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any)
        .mockResolvedValueOnce('{ invalid json }')  // Metadata file
        .mockResolvedValue(JSON.stringify([
          { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
        ]));  // Fixture fallback

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle cache file with wrong structure', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ lastFetchTime: new Date().toISOString() }))
        .mockResolvedValueOnce(JSON.stringify({ notAnArray: true }))  // Wrong structure
        .mockResolvedValue(JSON.stringify([
          { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
        ]));  // Fixture fallback

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle cache file with missing required fields', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ lastFetchTime: new Date().toISOString() }))
        .mockResolvedValueOnce(JSON.stringify([
          { title: 'Test' }  // Missing url, content, section
        ]))
        .mockResolvedValue(JSON.stringify([
          { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
        ]));  // Fixture fallback

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle metadata file with invalid timestamp', async () => {
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any)
        .mockResolvedValueOnce(JSON.stringify({ lastFetchTime: 'not-a-date' }))
        .mockResolvedValue(JSON.stringify([
          { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
        ]));  // Fixture fallback

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe('Empty/Missing Fixture File', () => {
    it('should handle missing fixture file', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      mockFetch.mockRejectedValue(new Error('Network error'));
      (mockFs.readFile as any).mockRejectedValue(new Error('ENOENT: fixture not found'));

      const docs = await docsManager.fetchLatestDocs();
      
      // Should return empty array when all fallbacks fail
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle empty fixture file', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      mockFetch.mockRejectedValue(new Error('Network error'));
      (mockFs.readFile as any).mockResolvedValue('');

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle corrupted fixture file', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      mockFetch.mockRejectedValue(new Error('Network error'));
      (mockFs.readFile as any).mockResolvedValue('{ corrupted json');

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });

    it('should handle fixture file with wrong format', async () => {
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      mockFetch.mockRejectedValue(new Error('Network error'));
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify({ notDocs: [] }));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });

  describe('Cascading Failures', () => {
    it('should handle all sources failing (network, cache, fixture)', async () => {
      // Network fails
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      // Cache fails
      (mockFs.access as any).mockRejectedValue(new Error('ENOENT'));
      
      // Fixture fails
      (mockFs.readFile as any).mockRejectedValue(new Error('ENOENT'));

      const docs = await docsManager.fetchLatestDocs();
      
      // Should gracefully return empty array
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBe(0);
    });

    it('should recover from cache corruption with network fallback', async () => {
      // Cache exists but is corrupted
      (mockFs.access as any).mockResolvedValue(undefined);
      (mockFs.readFile as any).mockResolvedValueOnce('{ corrupted }');
      
      // Network works
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html><body></body></html>'
      });
      
      // Fixture as final fallback
      (mockFs.readFile as any).mockResolvedValue(JSON.stringify([
        { title: 'Test', url: 'http://example.com', content: 'test', section: 'test', lastUpdated: '2025-01-01' }
      ]));

      const docs = await docsManager.fetchLatestDocs();
      
      expect(docs).toBeDefined();
      expect(Array.isArray(docs)).toBe(true);
    });
  });
});
