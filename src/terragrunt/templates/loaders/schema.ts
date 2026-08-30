/**
 * Schema Template Loader
 * Loads backend schema JSON files and generates ConfigTemplate objects
 * using SchemaToTemplateGenerator for auto-generated Complete tier templates
 */

import { TemplateLoader } from './base.js';
import { ConfigTemplate } from '../../../types/templates.js';
import { SchemaToTemplateGenerator } from '../../schema-generator.js';
import { loadBackendSchema } from '../../schema-loader.js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Load schema-based templates from JSON schema files
 * Priority 15 (between builtin:10 and filesystem:50)
 * 
 * Generates "Complete" tier templates with all backend attributes
 */
export class SchemaTemplateLoader implements TemplateLoader {
  readonly priority = 15;
  
  private schemaDir: string;
  private generator: SchemaToTemplateGenerator;

  /**
   * @param schemaDir - Directory containing backend schema JSON files (default: schemas/backends)
   */
  constructor(schemaDir?: string) {
    this.schemaDir = schemaDir || fileURLToPath(new URL('../../../../schemas/backends', import.meta.url));
    this.generator = new SchemaToTemplateGenerator();
  }

  /**
   * Load all schema files and generate ConfigTemplate objects
   * @returns Array of generated templates
   */
  async loadTemplates(): Promise<ConfigTemplate[]> {
    const templates: ConfigTemplate[] = [];
    
    try {
      const files = await readdir(this.schemaDir);
      const schemaFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of schemaFiles) {
        try {
          const schemaPath = join(this.schemaDir, file);
          const schema = await loadBackendSchema(schemaPath);
          const template = this.generator.generateTemplate(schema, {
            includeDeprecatedAttributes: schema.backend === 's3' ? ['dynamodb_table'] : [],
          });
          
          templates.push(template);
        } catch (error) {
          console.error(`[SchemaTemplateLoader] Error loading ${file}:`, error);
          // Continue with other files
        }
      }
      
      console.log(`[SchemaTemplateLoader] Loaded ${templates.length} schema-based templates`);
    } catch (error) {
      console.error('[SchemaTemplateLoader] Error reading schema directory:', error);
      // Return empty array if directory doesn't exist or can't be read
    }
    
    return templates;
  }
}
