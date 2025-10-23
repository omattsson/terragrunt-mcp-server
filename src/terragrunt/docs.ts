import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface TerragruntDoc {
  title: string;
  url: string;
  content: string;
  section: string;
  lastUpdated?: string;
}

interface CacheMetadata {
  lastFetchTime: string;
  docsCount: number;
}

export class TerragruntDocsManager {
  private readonly baseUrl = 'https://terragrunt.gruntwork.io';
  private docsCache: Map<string, TerragruntDoc> = new Map();
  private lastFetchTime: Date | null = null;
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private readonly metadataFile: string;

  constructor() {
    // Get the directory where this file is located
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Store cache in project root under .cache/terragrunt-docs
    this.cacheDir = path.join(__dirname, '..', '..', '.cache', 'terragrunt-docs');
    this.cacheFile = path.join(this.cacheDir, 'docs-cache.json');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private async loadCacheFromDisk(): Promise<boolean> {
    try {
      // Check if cache files exist
      const [docsExists, metadataExists] = await Promise.all([
        fs.access(this.cacheFile).then(() => true).catch(() => false),
        fs.access(this.metadataFile).then(() => true).catch(() => false)
      ]);

      if (!docsExists || !metadataExists) {
        console.log('No disk cache found');
        return false;
      }

      // Read metadata first
      const metadataContent = await fs.readFile(this.metadataFile, 'utf-8');
      const metadata: CacheMetadata = JSON.parse(metadataContent);

      // Check if cache is expired
      const cacheAge = Date.now() - new Date(metadata.lastFetchTime).getTime();
      if (cacheAge > this.cacheExpiry) {
        console.log('Disk cache expired');
        return false;
      }

      // Load docs from disk
      const docsContent = await fs.readFile(this.cacheFile, 'utf-8');
      const docs: TerragruntDoc[] = JSON.parse(docsContent);

      // Populate in-memory cache
      this.docsCache.clear();
      docs.forEach(doc => this.docsCache.set(doc.url, doc));
      this.lastFetchTime = new Date(metadata.lastFetchTime);

      console.log(`Loaded ${docs.length} docs from disk cache (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      return true;
    } catch (error) {
      console.error('Failed to load cache from disk:', error);
      return false;
    }
  }

  private async saveCacheToDisk(): Promise<void> {
    try {
      await this.ensureCacheDir();

      const docs = Array.from(this.docsCache.values());
      const metadata: CacheMetadata = {
        lastFetchTime: this.lastFetchTime?.toISOString() || new Date().toISOString(),
        docsCount: docs.length
      };

      // Write both files atomically
      await Promise.all([
        fs.writeFile(this.cacheFile, JSON.stringify(docs, null, 2), 'utf-8'),
        fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8')
      ]);

      console.log(`Saved ${docs.length} docs to disk cache`);
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  async fetchLatestDocs(): Promise<TerragruntDoc[]> {
    // Try loading from disk cache first if in-memory cache is empty
    if (this.docsCache.size === 0) {
      const loaded = await this.loadCacheFromDisk();
      if (loaded && !this.shouldRefreshCache()) {
        return Array.from(this.docsCache.values());
      }
    }

    // Refresh if needed
    if (this.shouldRefreshCache()) {
      await this.refreshDocsCache();
    }
    
    return Array.from(this.docsCache.values());
  }

  private shouldRefreshCache(): boolean {
    return !this.lastFetchTime ||
      Date.now() - this.lastFetchTime.getTime() > this.cacheExpiry;
  }

  private async refreshDocsCache(): Promise<void> {
    try {
      console.log('Refreshing Terragrunt documentation cache...');
      const docPages = await this.getDocumentationPages();
      this.docsCache.clear();

      for (const page of docPages) {
        const doc = await this.fetchDocumentPage(page);
        if (doc) {
          this.docsCache.set(doc.url, doc);
        }
      }

      this.lastFetchTime = new Date();
      console.log(`Cached ${this.docsCache.size} documentation pages`);
      
      // Save to disk after successful fetch
      await this.saveCacheToDisk();
    } catch (error) {
      console.error('Failed to refresh Terragrunt docs cache:', error);
    }
  }

  private async getDocumentationPages(): Promise<Array<{ url: string, title: string, section: string }>> {
    const response = await fetch(`${this.baseUrl}/docs/`);
    const html = await response.text();
    const $ = cheerio.load(html);

    const pages: Array<{ url: string, title: string, section: string }> = [];

    // Extract main documentation links from navigation
    $('nav a[href^="/docs/"], .sidebar a[href^="/docs/"], .menu a[href^="/docs/"]').each((_: any, element: any) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (href && title && !pages.some(p => p.url === `${this.baseUrl}${href}`)) {
        const section = this.extractSection(href);
        pages.push({
          url: `${this.baseUrl}${href}`,
          title,
          section
        });
      }
    });

    // Also extract links from content area
    $('.content a[href^="/docs/"], main a[href^="/docs/"]').each((_: any, element: any) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (href && title && !pages.some(p => p.url === `${this.baseUrl}${href}`)) {
        const section = this.extractSection(href);
        pages.push({
          url: `${this.baseUrl}${href}`,
          title,
          section
        });
      }
    });

    // Add some core documentation pages if not found
    const coreDocs = [
      { url: `${this.baseUrl}/docs/getting-started/quick-start/`, title: 'Quick Start', section: 'getting-started' },
      { url: `${this.baseUrl}/docs/reference/config-blocks-and-attributes/`, title: 'Configuration Reference', section: 'reference' },
      { url: `${this.baseUrl}/docs/features/keep-your-terraform-code-dry/`, title: 'Keep Your Code DRY', section: 'features' },
      { url: `${this.baseUrl}/docs/features/execute-terraform-commands-on-multiple-modules-at-once/`, title: 'Multiple Modules', section: 'features' },
    ];

    for (const coreDoc of coreDocs) {
      if (!pages.some(p => p.url === coreDoc.url)) {
        pages.push(coreDoc);
      }
    }

    return pages;
  }

  private extractSection(href: string): string {
    const pathParts = href.split('/').filter(part => part);
    if (pathParts.length >= 2) {
      return pathParts[1]; // /docs/[section]/...
    }
    return 'general';
  }

  private async fetchDocumentPage(page: { url: string, title: string, section: string }): Promise<TerragruntDoc | null> {
    try {
      const response = await fetch(page.url);

      if (!response.ok) {
        console.warn(`Failed to fetch ${page.url}: ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove navigation and other non-content elements
      $('nav, .sidebar, .menu, .header, .footer, script, style').remove();

      // Extract main content from various possible containers
      let content = '';
      const contentSelectors = ['.content', '.markdown', 'main', '.post-content', '.doc-content', 'article'];

      for (const selector of contentSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          content = element.text().trim();
          break;
        }
      }

      // Fallback to body if no content container found
      if (!content) {
        $('body nav, body .sidebar, body .menu, body .header, body .footer').remove();
        content = $('body').text().trim();
      }

      if (!content) {
        console.warn(`No content found for ${page.url}`);
        return null;
      }

      return {
        title: page.title,
        url: page.url,
        content: this.cleanContent(content),
        section: page.section,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch doc page ${page.url}:`, error);
      return null;
    }
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\t+/g, ' ')
      .trim();
  }

  async searchDocs(query: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    const lowercaseQuery = query.toLowerCase();

    return docs.filter(doc =>
      doc.title.toLowerCase().includes(lowercaseQuery) ||
      doc.content.toLowerCase().includes(lowercaseQuery) ||
      doc.section.toLowerCase().includes(lowercaseQuery)
    ).sort((a, b) => {
      // Prioritize title matches
      const aTitle = a.title.toLowerCase().includes(lowercaseQuery);
      const bTitle = b.title.toLowerCase().includes(lowercaseQuery);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;

      // Then prioritize section matches
      const aSection = a.section.toLowerCase().includes(lowercaseQuery);
      const bSection = b.section.toLowerCase().includes(lowercaseQuery);
      if (aSection && !bSection) return -1;
      if (!aSection && bSection) return 1;

      return 0;
    });
  }

  async getDocBySection(section: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    return docs.filter(doc => doc.section === section);
  }

  async getAvailableSections(): Promise<string[]> {
    const docs = await this.fetchLatestDocs();
    return Array.from(new Set(docs.map(doc => doc.section))).sort();
  }

  async getCliCommandHelp(command: string): Promise<TerragruntDoc | null> {
    const docs = await this.fetchLatestDocs();
    
    // Search in reference section for CLI commands
    const cliDocs = docs.filter(doc => 
      doc.section === 'reference' && 
      doc.url.includes('/cli/commands/')
    );

    // Try exact match first
    const exactMatch = cliDocs.find(doc => 
      doc.title.toLowerCase() === command.toLowerCase() ||
      doc.url.toLowerCase().includes(`/${command.toLowerCase()}/`) ||
      doc.url.toLowerCase().endsWith(`/${command.toLowerCase()}`)
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Try partial match
    const partialMatch = cliDocs.find(doc =>
      doc.title.toLowerCase().includes(command.toLowerCase()) ||
      doc.content.toLowerCase().includes(`${command} `)
    );

    return partialMatch || null;
  }

  async getHclConfigReference(blockOrAttribute: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    const query = blockOrAttribute.toLowerCase();

    // Search in reference section for HCL configuration
    const hclDocs = docs.filter(doc =>
      doc.section === 'reference' && (
        doc.url.includes('/hcl/blocks') ||
        doc.url.includes('/hcl/attributes') ||
        doc.url.includes('/hcl/functions') ||
        doc.url.includes('/config-blocks-and-attributes')
      )
    );

    // Find relevant docs
    return hclDocs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query)
    );
  }

  async getCodeExamples(topic: string): Promise<Array<{ doc: TerragruntDoc, examples: string[] }>> {
    const docs = await this.fetchLatestDocs();
    const query = topic.toLowerCase();
    const results: Array<{ doc: TerragruntDoc, examples: string[] }> = [];

    // Search docs that match the topic
    const relevantDocs = docs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query)
    );

    // Extract code examples from each relevant doc
    for (const doc of relevantDocs.slice(0, 10)) { // Limit to 10 docs
      const examples = this.extractCodeBlocks(doc.content);
      if (examples.length > 0) {
        results.push({ doc, examples });
      }
    }

    return results;
  }

  private extractCodeBlocks(content: string): string[] {
    const examples: string[] = [];
    
    // Match code blocks patterns in markdown-like content
    // Looking for common patterns like: "terragrunt", "terraform {", "remote_state {", etc.
    const codePatterns = [
      /terragrunt\s+\w+[^\n]*/gi,
      /terraform\s*{[\s\S]*?}/gi,
      /remote_state\s*{[\s\S]*?}/gi,
      /dependency\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /include\s*"[^"]+"\s*{[\s\S]*?}/gi,
      /inputs\s*=\s*{[\s\S]*?}/gi,
    ];

    for (const pattern of codePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        examples.push(...matches.map(m => m.trim()));
      }
    }

    // Remove duplicates and limit
    return Array.from(new Set(examples)).slice(0, 5);
  }
}