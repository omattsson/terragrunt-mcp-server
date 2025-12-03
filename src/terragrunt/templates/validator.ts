/**
 * Template Validator
 * Validates custom templates for structure, HCL syntax, security, and versioning
 */

import { ConfigTemplate } from '../../types/templates.js';
import { validateHCL } from '../hcl-validator.js';

/**
 * Semver regex pattern for version validation
 * Matches: major.minor.patch with optional prerelease and build metadata
 * Examples: "1.0.0", "2.1.3-beta.1", "1.0.0-alpha+build.123"
 */
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Semver constraint regex for compatibility version constraints
 * Matches: >=, <=, >, <, = followed by version, or ~> (pessimistic)
 * Examples: ">=1.0.0", "~>0.50", ">= 1.0.0, < 2.0.0"
 */
const SEMVER_CONSTRAINT_REGEX = /^(>=?|<=?|=|~>)?\s*(0|[1-9]\d*)(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?(-[0-9a-zA-Z.-]+)?(\+[0-9a-zA-Z.-]+)?(,\s*(>=?|<=?|=|~>)?\s*(0|[1-9]\d*)(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?(-[0-9a-zA-Z.-]+)?(\+[0-9a-zA-Z.-]+)?)*$/;

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
    
    // Validate versioning fields (if present)
    this.validateVersioning(template);
    
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
        // Format errors for better readability
        const errorList = result.errors.map((err, idx) => `  ${idx + 1}. ${err}`).join('\n');
        throw new Error(`HCL validation failed with ${result.errors.length} error(s):\n${errorList}`);
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
    const normalized: ConfigTemplate = {
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

    // Add versioning fields if present
    if (template.version) {
      normalized.version = template.version;
    }
    if (template.changelog) {
      normalized.changelog = template.changelog;
    }
    if (template.deprecated) {
      normalized.deprecated = template.deprecated;
    }
    if (template.compatibility) {
      normalized.compatibility = template.compatibility;
    }

    return normalized;
  }

  /**
   * Validate versioning-related fields
   */
  private validateVersioning(template: any): void {
    // Validate version format (if provided)
    if (template.version !== undefined) {
      this.validateSemver(template.version, 'version', template);
    }

    // Validate changelog (if provided)
    if (template.changelog !== undefined) {
      this.validateChangelog(template.changelog, template);
    }

    // Validate deprecation info (if provided)
    if (template.deprecated !== undefined) {
      this.validateDeprecation(template.deprecated, template);
    }

    // Validate compatibility info (if provided)
    if (template.compatibility !== undefined) {
      this.validateCompatibility(template.compatibility, template);
    }
  }

  /**
   * Validate a semver version string
   */
  validateSemver(version: any, field: string, template?: any): boolean {
    if (typeof version !== 'string') {
      throw new TemplateValidationError(
        `Field "${field}" must be a string`,
        field,
        template
      );
    }

    if (!SEMVER_REGEX.test(version)) {
      throw new TemplateValidationError(
        `Invalid semver format for "${field}": "${version}". Expected format: major.minor.patch (e.g., "1.0.0")`,
        field,
        template
      );
    }

    return true;
  }

  /**
   * Validate a semver constraint string (e.g., ">=1.0.0", "~>0.50")
   */
  validateSemverConstraint(constraint: any, field: string, template?: any): boolean {
    if (typeof constraint !== 'string') {
      throw new TemplateValidationError(
        `Field "${field}" must be a string`,
        field,
        template
      );
    }

    if (!SEMVER_CONSTRAINT_REGEX.test(constraint)) {
      throw new TemplateValidationError(
        `Invalid semver constraint format for "${field}": "${constraint}". Expected format: ">=1.0.0" or "~>0.50"`,
        field,
        template
      );
    }

    return true;
  }

  /**
   * Validate changelog entries
   */
  private validateChangelog(changelog: any, template?: any): void {
    if (!Array.isArray(changelog)) {
      throw new TemplateValidationError(
        'Field "changelog" must be an array',
        'changelog',
        template
      );
    }

    for (let i = 0; i < changelog.length; i++) {
      const entry = changelog[i];
      
      if (!entry.version || typeof entry.version !== 'string') {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} missing required field "version"`,
          `changelog[${i}].version`,
          template
        );
      }
      
      this.validateSemver(entry.version, `changelog[${i}].version`, template);

      if (!entry.date || typeof entry.date !== 'string') {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} missing required field "date"`,
          `changelog[${i}].date`,
          template
        );
      }

      // Validate date format (ISO 8601: YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} has invalid date format: "${entry.date}". Expected ISO 8601 format (YYYY-MM-DD)`,
          `changelog[${i}].date`,
          template
        );
      }

      // Validate that the date is actually valid (not 2024-02-30, etc.)
      const parsedDate = new Date(entry.date);
      if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== entry.date) {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} has invalid date: "${entry.date}". The date does not exist.`,
          `changelog[${i}].date`,
          template
        );
      }

      if (!entry.changes || !Array.isArray(entry.changes)) {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} missing required field "changes" (must be an array)`,
          `changelog[${i}].changes`,
          template
        );
      }

      if (entry.changes.length === 0) {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} must have at least one change`,
          `changelog[${i}].changes`,
          template
        );
      }

      for (let j = 0; j < entry.changes.length; j++) {
        if (typeof entry.changes[j] !== 'string') {
          throw new TemplateValidationError(
            `Changelog entry change at index ${j} must be a string`,
            `changelog[${i}].changes[${j}]`,
            template
          );
        }
      }

      if (entry.breaking !== undefined && typeof entry.breaking !== 'boolean') {
        throw new TemplateValidationError(
          `Changelog entry at index ${i} field "breaking" must be a boolean`,
          `changelog[${i}].breaking`,
          template
        );
      }
    }
  }

  /**
   * Validate deprecation info
   */
  private validateDeprecation(deprecated: any, template?: any): void {
    if (typeof deprecated !== 'object' || deprecated === null) {
      throw new TemplateValidationError(
        'Field "deprecated" must be an object',
        'deprecated',
        template
      );
    }

    if (!deprecated.since || typeof deprecated.since !== 'string') {
      throw new TemplateValidationError(
        'Deprecation info missing required field "since"',
        'deprecated.since',
        template
      );
    }

    this.validateSemver(deprecated.since, 'deprecated.since', template);

    if (!deprecated.reason || typeof deprecated.reason !== 'string') {
      throw new TemplateValidationError(
        'Deprecation info missing required field "reason"',
        'deprecated.reason',
        template
      );
    }

    if (deprecated.replacement !== undefined && typeof deprecated.replacement !== 'string') {
      throw new TemplateValidationError(
        'Deprecation info field "replacement" must be a string',
        'deprecated.replacement',
        template
      );
    }
  }

  /**
   * Validate compatibility info
   */
  private validateCompatibility(compatibility: any, template?: any): void {
    if (typeof compatibility !== 'object' || compatibility === null) {
      throw new TemplateValidationError(
        'Field "compatibility" must be an object',
        'compatibility',
        template
      );
    }

    // Require at least one version constraint to be defined
    if (compatibility.terragruntVersion === undefined && compatibility.terraformVersion === undefined) {
      throw new TemplateValidationError(
        'Compatibility info must specify at least one of "terragruntVersion" or "terraformVersion"',
        'compatibility',
        template
      );
    }

    if (compatibility.terragruntVersion !== undefined) {
      this.validateSemverConstraint(
        compatibility.terragruntVersion,
        'compatibility.terragruntVersion',
        template
      );
    }

    if (compatibility.terraformVersion !== undefined) {
      this.validateSemverConstraint(
        compatibility.terraformVersion,
        'compatibility.terraformVersion',
        template
      );
    }
  }

  /**
   * Check if a template is deprecated
   * @returns true if the template is deprecated
   */
  isDeprecated(template: ConfigTemplate): boolean {
    return template.deprecated !== undefined;
  }

  /**
   * Get deprecation warning message for a template
   * @returns Warning message or null if not deprecated
   */
  getDeprecationWarning(template: ConfigTemplate): string | null {
    if (!template.deprecated) {
      return null;
    }

    let warning = `Template "${template.id}" is deprecated since version ${template.deprecated.since}: ${template.deprecated.reason}`;
    
    if (template.deprecated.replacement) {
      warning += `. Consider using "${template.deprecated.replacement}" instead.`;
    }

    return warning;
  }
}
