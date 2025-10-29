/**
 * Base Template Loader Interface
 * Defines contract for all template loaders (builtin, custom, filesystem)
 */

import { ConfigTemplate } from '../../../types/templates.js';

/**
 * Template loader interface
 * Loaders are processed in priority order (higher priority wins for duplicate IDs)
 */
export interface TemplateLoader {
  /**
   * Priority of this loader (higher = more important)
   * - Custom (API): 100
   * - Filesystem: 50
   * - Builtin: 10
   */
  readonly priority: number;

  /**
   * Load templates from this source
   * @returns Array of validated templates
   */
  loadTemplates(): Promise<ConfigTemplate[]>;
}
