/**
 * Custom Template Loader
 * Loads a single template provided via API parameter
 */

import { ConfigTemplate } from '../../../types/templates.js';
import { TemplateLoader } from './base.js';
import { TemplateValidator } from '../validator.js';

/**
 * Loads a custom template provided directly via API
 * Highest priority loader (100)
 */
export class CustomTemplateLoader implements TemplateLoader {
  readonly priority = 100;
  private validator: TemplateValidator;
  private template: any;

  constructor(template: any) {
    this.template = template;
    this.validator = new TemplateValidator();
  }

  /**
   * Load and validate the custom template
   */
  async loadTemplates(): Promise<ConfigTemplate[]> {
    if (!this.template) {
      return [];
    }

    try {
      const validated = this.validator.validate(this.template, 'custom');
      return [validated];
    } catch (error) {
      console.error('[CustomTemplateLoader] Validation failed:', error);
      throw error;
    }
  }
}
