import { TemplatesManager } from './templates/index.js';
import { ConfigTemplate } from '../types/templates.js';

/**
 * Use case categories for template organization
 */
export type UseCase = 'remote_state' | 'provider_generation' | 'dependencies' | 'hooks' | 'inputs';

/**
 * Validation result for template syntax and structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ConfigTemplateLibrary provides use-case-based access to Terragrunt templates.
 * This is a higher-level abstraction over TemplatesManager that organizes
 * templates by their primary use case.
 */
export class ConfigTemplateLibrary {
  private templatesManager: TemplatesManager;

  /**
   * Mapping of use cases to template categories
   */
  private static readonly CATEGORY_MAP: Record<UseCase, string> = {
    remote_state: 'backend',
    provider_generation: 'provider',
    dependencies: 'dependency',
    hooks: 'hooks',
    inputs: 'inputs',
  };

  /**
   * Reverse mapping of template categories to use cases
   */
  private static readonly REVERSE_CATEGORY_MAP: Record<string, UseCase> = {
    backend: 'remote_state',
    provider: 'provider_generation',
    dependency: 'dependencies',
    hooks: 'hooks',
    inputs: 'inputs',
  };

  constructor(templatesManager?: TemplatesManager) {
    this.templatesManager = templatesManager || new TemplatesManager();
  }

  /**
   * Get a template by use case and optional backend/cloud provider
   * 
   * @param useCase - The primary use case (remote_state, provider_generation, etc.)
   * @param backend - Optional backend/cloud provider filter (s3, azurerm, aws, etc.) or template ID
   * @param tier - Optional template tier (essential, advanced, complete). Defaults to essential for backward compatibility.
   * @returns ConfigTemplate if found, undefined otherwise
   */
  async getTemplate(useCase: UseCase, backend?: string, tier?: 'essential' | 'advanced' | 'complete'): Promise<ConfigTemplate | undefined> {
    await this.templatesManager.loadTemplates();
    
    const category = ConfigTemplateLibrary.CATEGORY_MAP[useCase];
    if (!category) {
      return undefined;
    }

    // Search templates by category
    const templates = await this.templatesManager.searchTemplates({ category });

    if (templates.length === 0) {
      return undefined;
    }

    // If backend specified, filter by template ID, cloud provider, or tags
    if (backend) {
      const backendLower = backend.toLowerCase();
      
      // If tier specified, try tier-specific ID first
      // Pattern: {cloud}-{backend}-backend or {cloud}-{backend}-backend-{tier}
      if (tier) {
        const tierSuffix = tier === 'essential' ? '' : `-${tier}`;
        
        // Try multiple patterns for tier matching
        const tierPatterns = [
          `${backendLower}-backend${tierSuffix}`,  // e.g., "s3-backend-complete"
          `${backendLower}${tierSuffix}`,           // e.g., "s3-complete"
        ];
        
        for (const pattern of tierPatterns) {
          const tierMatch = templates.find(t => 
            t.id.toLowerCase().includes(pattern)
          );
          if (tierMatch) {
            return tierMatch;
          }
        }
      }
      
      // Try to match by template ID first (for custom templates)
      const idMatch = templates.find(t => t.id.toLowerCase() === backendLower);
      if (idMatch) {
        return idMatch;
      }
      
      // Try to match by cloudProvider
      const cloudMatch = templates.find(t => t.cloudProvider === backendLower);
      if (cloudMatch) {
        return cloudMatch;
      }

      // Try to match by tags (e.g., 's3', 'blob-storage')
      const tagMatch = templates.find(t => 
        t.tags.some(tag => tag.toLowerCase().includes(backendLower))
      );
      if (tagMatch) {
        return tagMatch;
      }

      // No match for specific backend
      return undefined;
    }

    // No backend specified, return first template for the use case
    return templates[0];
  }

  /**
   * List all available use cases
   * 
   * @returns Array of available use case strings
   */
  async listAvailableUseCases(): Promise<UseCase[]> {
    const metadata = await this.templatesManager.getMetadata();
    const useCases = new Set<UseCase>();

    for (const category of metadata.categories) {
      const useCase = ConfigTemplateLibrary.REVERSE_CATEGORY_MAP[category];
      if (useCase) {
        useCases.add(useCase);
      }
    }

    return Array.from(useCases);
  }

  /**
   * List all templates for a specific use case
   * 
   * @param useCase - The use case to list templates for
   * @returns Array of templates matching the use case
   */
  async listTemplatesForUseCase(useCase: UseCase): Promise<ConfigTemplate[]> {
    const category = ConfigTemplateLibrary.CATEGORY_MAP[useCase];
    if (!category) {
      return [];
    }

    return await this.templatesManager.searchTemplates({ category });
  }

  /**
   * Validate a template's HCL syntax and structure
   * 
   * @param template - The HCL template string to validate
   * @returns ValidationResult with errors and warnings
   */
  validateTemplate(template: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation checks
    if (!template || template.trim().length === 0) {
      errors.push('Template is empty');
      return { isValid: false, errors, warnings };
    }

    // Check for basic HCL structure
    const hasOpenBrace = template.includes('{');
    const hasCloseBrace = template.includes('}');
    
    if (!hasOpenBrace || !hasCloseBrace) {
      errors.push('Template missing required braces { }');
    }

    // Check for balanced braces
    const openCount = (template.match(/{/g) || []).length;
    const closeCount = (template.match(/}/g) || []).length;
    
    if (openCount !== closeCount) {
      errors.push(`Unbalanced braces: ${openCount} opening, ${closeCount} closing`);
    }

    // Check for common HCL block types
    const hasValidBlock = /\b(remote_state|generate|terraform|dependency|dependencies|inputs|locals)\s*{/.test(template);
    if (!hasValidBlock) {
      warnings.push('Template does not contain recognized HCL block types');
    }

    // Check for potential variable placeholders
    const hasVariables = /\{\{[\w_]+\}\}/.test(template);
    if (!hasVariables && !template.includes('local.') && !template.includes('var.')) {
      warnings.push('Template does not contain variable placeholders or references');
    }

    // Check for EOF marker issues
    if (template.includes('EOF') && !template.includes('<<EOF')) {
      warnings.push('EOF marker found without heredoc syntax (<<EOF)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get the underlying TemplatesManager instance
   * Useful for advanced operations not covered by ConfigTemplateLibrary
   */
  getTemplatesManager(): TemplatesManager {
    return this.templatesManager;
  }
}
