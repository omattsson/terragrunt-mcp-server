/**
 * Builtin Template Loader
 * Loads templates defined in TypeScript category files
 */

import { ConfigTemplate } from '../../../types/templates.js';
import { allTemplates } from '../registry.js';

/**
 * Load all built-in templates from the registry
 */
export function loadBuiltinTemplates(): ConfigTemplate[] {
  return allTemplates;
}
