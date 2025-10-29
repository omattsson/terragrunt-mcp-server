/**
 * Filesystem Template Loader
 * Loads templates from filesystem directory
 */

import { ConfigTemplate } from '../../../types/templates.js';
import { TemplateLoader } from './base.js';
import { TemplateValidator } from '../validator.js';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { homedir } from 'os';

/**
 * Loads templates from filesystem
 * Medium priority loader (50)
 */
export class FilesystemTemplateLoader implements TemplateLoader {
  readonly priority = 50;
  private validator: TemplateValidator;
  private templatePath: string;

  /**
   * @param templatePath - Path to templates directory (defaults to ~/.terragrunt-mcp/templates/)
   */
  constructor(templatePath?: string) {
    this.templatePath = templatePath || join(homedir(), '.terragrunt-mcp', 'templates');
    this.validator = new TemplateValidator();
  }

  /**
   * Load all templates from filesystem
   */
  async loadTemplates(): Promise<ConfigTemplate[]> {
    const templates: ConfigTemplate[] = [];

    try {
      // Check if directory exists
      const files = await readdir(this.templatePath).catch(() => []);
      
      if (files.length === 0) {
        console.log(`[FilesystemTemplateLoader] No templates found in ${this.templatePath}`);
        return [];
      }

      // Load each .json file
      for (const file of files) {
        if (extname(file) === '.json') {
          try {
            const template = await this.loadTemplateFile(join(this.templatePath, file));
            if (template) {
              templates.push(template);
            }
          } catch (error) {
            console.error(`[FilesystemTemplateLoader] Failed to load ${file}:`, error);
            // Continue loading other templates
          }
        }
      }

      console.log(`[FilesystemTemplateLoader] Loaded ${templates.length} templates from ${this.templatePath}`);
      return templates;
    } catch (error) {
      console.error('[FilesystemTemplateLoader] Error loading templates:', error);
      return [];
    }
  }

  /**
   * Load and validate a single template file
   */
  private async loadTemplateFile(filePath: string): Promise<ConfigTemplate | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const template = JSON.parse(content);
      
      // Validate template
      const validated = this.validator.validate(template, 'filesystem');
      return validated;
    } catch (error) {
      console.error(`[FilesystemTemplateLoader] Error loading file ${filePath}:`, error);
      return null;
    }
  }
}
