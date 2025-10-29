/**
 * Template Registry
 * Central registry that aggregates all templates from all categories
 */

import { ConfigTemplate } from '../../types/templates.js';
import {
  backendTemplates,
  providerTemplates,
  hookTemplates,
  dependencyTemplates,
  configurationTemplates,
} from './categories/index.js';

/**
 * All built-in templates aggregated from categories
 */
export const allTemplates: ConfigTemplate[] = [
  ...backendTemplates,
  ...providerTemplates,
  ...hookTemplates,
  ...dependencyTemplates,
  ...configurationTemplates,
];

/**
 * Get count of templates by category
 */
export function getTemplateCounts() {
  return {
    backends: backendTemplates.length,
    providers: providerTemplates.length,
    hooks: hookTemplates.length,
    dependencies: dependencyTemplates.length,
    configuration: configurationTemplates.length,
    total: allTemplates.length,
  };
}
