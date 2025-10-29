import { ConfigTemplate, TemplateMetadata, TemplateSearchOptions } from '../../types/templates.js';
import { loadBuiltinTemplates } from './loaders/builtin.js';

/**
 * Manages Terragrunt configuration templates extracted from documentation
 * and real-world examples (Gruntwork, Azure configs)
 */
export class TemplatesManager {
  private templates: Map<string, ConfigTemplate> = new Map();
  private initialized = false;

  constructor() {
    // Templates will be loaded lazily on first use
  }

  /**
   * Load all templates into memory
   */
  async loadTemplates(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load built-in templates from registry
    const builtinTemplates = loadBuiltinTemplates();
    for (const template of builtinTemplates) {
      this.templates.set(template.id.toLowerCase(), template);
    }

    this.initialized = true;
    console.log(`[TemplatesManager] Loaded ${this.templates.size} templates`);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<ConfigTemplate | undefined> {
    await this.loadTemplates();
    return this.templates.get(id.toLowerCase());
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<ConfigTemplate[]> {
    await this.loadTemplates();
    return Array.from(this.templates.values());
  }

  /**
   * Search templates by criteria
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<ConfigTemplate[]> {
    await this.loadTemplates();
    
    let results = Array.from(this.templates.values());

    if (options.category) {
      results = results.filter(t => t.category === options.category);
    }

    if (options.cloudProvider) {
      results = results.filter(t => 
        t.cloudProvider === options.cloudProvider
      );
    }

    if (options.source) {
      results = results.filter(t => t.source === options.source);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags.includes(tag))
      );
    }

    return results;
  }

  /**
   * Get metadata about available templates
   */
  async getMetadata(): Promise<TemplateMetadata> {
    await this.loadTemplates();

    const categories = new Set<string>();
    const cloudProviders = new Set<string>();
    const sources = new Set<string>();

    for (const template of this.templates.values()) {
      categories.add(template.category);
      if (template.cloudProvider) {
        cloudProviders.add(template.cloudProvider);
      }
      sources.add(template.source);
    }

    return {
      totalTemplates: this.templates.size,
      categories: Array.from(categories),
      cloudProviders: Array.from(cloudProviders),
      sources: Array.from(sources),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Clear all templates (useful for testing)
   */
  clear(): void {
    this.templates.clear();
    this.initialized = false;
  }
}
