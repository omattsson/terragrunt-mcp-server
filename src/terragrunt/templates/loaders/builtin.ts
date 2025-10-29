/**
 * Builtin Template Loader
 * Loads templates defined in TypeScript category files
 */

import { ConfigTemplate } from '../../../types/templates.js';
import { TemplateLoader } from './base.js';
import { allTemplates } from '../registry.js';

/**
 * Load all built-in templates from the registry
 * Lowest priority loader (10)
 */
export class BuiltinTemplateLoader implements TemplateLoader {
  readonly priority = 10;

  async loadTemplates(): Promise<ConfigTemplate[]> {
    return allTemplates;
  }
}

/**
 * @deprecated Use BuiltinTemplateLoader class instead
 * Kept for backward compatibility
 */
export function loadBuiltinTemplates(): ConfigTemplate[] {
  return allTemplates;
}
