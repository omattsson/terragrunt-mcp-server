import { ConfigTemplate, TemplateMetadata, TemplateSearchOptions } from '../../types/templates.js';
import { TemplateLoader } from './loaders/base.js';
import { BuiltinTemplateLoader } from './loaders/builtin.js';
import { SchemaTemplateLoader } from './loaders/schema.js';

/**
 * Manages Terragrunt configuration templates extracted from documentation
 * and real-world examples (Gruntwork, Azure configs)
 * 
 * Supports multiple template loaders with priority-based override:
 * - Custom templates (API parameter): priority 100
 * - Filesystem templates: priority 50
 * - Built-in templates: priority 10
 */
export class TemplatesManager {
  private templates: Map<string, ConfigTemplate> = new Map();
  private initialized = false;
  private loaders: TemplateLoader[];

  /**
   * @param loaders - Template loaders to use (defaults to BuiltinTemplateLoader [priority 10] and SchemaTemplateLoader [priority 15]; schema templates will override builtin templates when IDs match)
   */
  constructor(loaders?: TemplateLoader[]) {
    this.loaders = loaders && loaders.length > 0 
      ? loaders 
      : [
          new BuiltinTemplateLoader(),
          new SchemaTemplateLoader(),
        ];
  }

  /**
   * Load all templates into memory from all loaders
   * Templates from higher-priority loaders override those from lower-priority loaders
   */
  async loadTemplates(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Sort loaders by priority (ascending, so we process lowest first)
    const sortedLoaders = [...this.loaders].sort((a, b) => a.priority - b.priority);
    
    // Load templates in priority order
    for (const loader of sortedLoaders) {
      try {
        const templates = await loader.loadTemplates();
        for (const template of templates) {
          this.templates.set(template.id.toLowerCase(), template);
          // Later loaders (higher priority) overwrite earlier ones
        }
      } catch (error) {
        console.error(`[TemplatesManager] Error loading from loader (priority ${loader.priority}):`, error);
        // Continue with other loaders
      }
    }

    this.initialized = true;
    console.log(`[TemplatesManager] Loaded ${this.templates.size} templates from ${this.loaders.length} loader(s)`);
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
