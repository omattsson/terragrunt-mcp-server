/**
 * Template Validator
 * Validates custom templates for structure, HCL syntax, and security
 */

import { ConfigTemplate, ConfigVariable } from '../../types/templates.js';
import { validateHCL } from '../hcl-validator.js';

/**
 * Validation error with context
 */
export class TemplateValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly template?: Partial<ConfigTemplate>
  ) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

/**
 * Template validator
 */
export class TemplateValidator {
  constructor() {
    // No initialization needed
  }

  /**
   * Validate a custom template
   * @param template - Template object to validate
   * @param source - Source type for the template
   * @returns Validated and normalized template
   * @throws TemplateValidationError if validation fails
   */
  validate(template: any, source: 'custom' | 'filesystem' = 'custom'): ConfigTemplate {
    // Validate required fields
    this.validateRequiredFields(template);
    
    // Validate field types and formats
    this.validateFieldTypes(template);
    
    // Validate HCL syntax
    this.validateHCL(template.templateHcl, template.id);
    
    // Validate variables
    this.validateVariables(template.variables || []);
    
    // Return normalized template
    return this.normalizeTemplate(template, source);
  }

  /**
   * Validate required fields are present
   */
  private validateRequiredFields(template: any): void {
    const requiredFields = ['id', 'name', 'description', 'category', 'templateHcl'];
    
    for (const field of requiredFields) {
      if (!template[field] || (typeof template[field] === 'string' && template[field].trim() === '')) {
        throw new TemplateValidationError(
          `Missing required field: ${field}`,
          field,
          template
        );
      }
    }
  }

  /**
   * Validate field types and enum values
   */
  private validateFieldTypes(template: any): void {
    // Validate category enum
    const validCategories = ['backend', 'provider', 'dependency', 'hooks', 'inputs', 'advanced', 'configuration'];
    if (!validCategories.includes(template.category)) {
      throw new TemplateValidationError(
        `Invalid category: ${template.category}. Must be one of: ${validCategories.join(', ')}`,
        'category',
        template
      );
    }

    // Validate cloudProvider enum (if provided)
    if (template.cloudProvider) {
      const validProviders = ['aws', 'azure', 'gcp', 'multi'];
      if (!validProviders.includes(template.cloudProvider)) {
        throw new TemplateValidationError(
          `Invalid cloudProvider: ${template.cloudProvider}. Must be one of: ${validProviders.join(', ')}`,
          'cloudProvider',
          template
        );
      }
    }

    // Validate arrays
    if (template.variables && !Array.isArray(template.variables)) {
      throw new TemplateValidationError(
        'Field "variables" must be an array',
        'variables',
        template
      );
    }

    if (template.tags && !Array.isArray(template.tags)) {
      throw new TemplateValidationError(
        'Field "tags" must be an array',
        'tags',
        template
      );
    }
  }

  /**
   * Validate HCL syntax
   */
  private validateHCL(hcl: string, templateId: string): void {
    try {
      const result = validateHCL(hcl);
      if (!result.syntaxValid || result.errors.length > 0) {
        throw new Error(result.errors.join('; '));
      }
    } catch (error) {
      throw new TemplateValidationError(
        `Invalid HCL syntax in template "${templateId}": ${error instanceof Error ? error.message : String(error)}`,
        'templateHcl',
        { id: templateId }
      );
    }
  }

  /**
   * Validate variables array
   */
  private validateVariables(variables: any[]): void {
    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      
      if (!variable.name || typeof variable.name !== 'string') {
        throw new TemplateValidationError(
          `Variable at index ${i} missing required field "name"`,
          `variables[${i}].name`
        );
      }

      if (!variable.type || typeof variable.type !== 'string') {
        throw new TemplateValidationError(
          `Variable "${variable.name}" missing required field "type"`,
          `variables[${i}].type`
        );
      }

      if (typeof variable.required !== 'boolean') {
        throw new TemplateValidationError(
          `Variable "${variable.name}" missing required field "required"`,
          `variables[${i}].required`
        );
      }
    }
  }

  /**
   * Normalize template with defaults
   */
  private normalizeTemplate(template: any, source: 'custom' | 'filesystem'): ConfigTemplate {
    return {
      id: template.id.trim(),
      name: template.name.trim(),
      description: template.description.trim(),
      category: template.category,
      cloudProvider: template.cloudProvider,
      variables: template.variables || [],
      templateHcl: template.templateHcl,
      example: template.example,
      source,
      tags: template.tags || [],
    };
  }
}
