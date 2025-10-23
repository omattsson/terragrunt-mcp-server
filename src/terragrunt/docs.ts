import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export interface TerragruntDoc {
  title: string;
  url: string;
  content: string;
  section: string;
  lastUpdated?: string;
}

export class TerragruntDocsManager {
  private readonly baseUrl = 'https://terragrunt.gruntwork.io';
  private docsCache: Map<string, TerragruntDoc> = new Map();
  private lastFetchTime: Date | null = null;
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  async fetchLatestDocs(): Promise<TerragruntDoc[]> {
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
}