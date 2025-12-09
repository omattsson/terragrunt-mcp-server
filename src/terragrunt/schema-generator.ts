/**
 * Schema to Template Generator
 * 
 * Converts backend schema JSON files into ConfigTemplate objects with
 * proper Mustache conditional syntax for use with TemplatesManager.
 * 
 * Part of Epic #138: Auto-Generate Complete Backend Templates
 * Implements Issue #143
 */

import { BackendSchema, BackendAttribute } from '../types/backend-schema.js';
import { ConfigTemplate, ConfigVariable } from '../types/templates.js';

/**
 * Options for template generation
 */
export interface TemplateGenerationOptions {
  /** Whether to include deprecated attributes in the template */
  includeDeprecated?: boolean;
  /** Custom template ID prefix (default: schema.id) */
  templateIdPrefix?: string;
  /** Additional tags to add to the template */
  additionalTags?: string[];
}

/**
 * SchemaToTemplateGenerator converts backend schema definitions into
 * complete ConfigTemplate objects with Mustache-compatible HCL templates.
 */
export class SchemaToTemplateGenerator {
  /**
   * Generate a complete ConfigTemplate from a backend schema
   * 
   * @param schema - Backend schema to convert
   * @param options - Generation options
   * @returns Complete ConfigTemplate ready for use
   */
  generateTemplate(schema: BackendSchema, options: TemplateGenerationOptions = {}): ConfigTemplate {
    // Generate all components
    const metadata = this.generateMetadata(schema, options);
    const variables = this.generateVariables(schema.attributes, options);
    const templateHcl = this.generateHcl(schema, options);
    const example = this.generateExample(schema, variables);

    return {
      ...metadata,
      variables,
      templateHcl,
      example,
    };
  }

  /**
   * Generate template metadata (id, name, description, tags, etc.)
   */
  private generateMetadata(
    schema: BackendSchema,
    options: TemplateGenerationOptions
  ): Omit<ConfigTemplate, 'variables' | 'templateHcl' | 'example'> {
    const templateId = options.templateIdPrefix
      ? `${options.templateIdPrefix}-${schema.id}`
      : schema.id;

    // Map schema provider to template cloudProvider
    const cloudProvider = this.mapProvider(schema.provider);

    // Generate tags
    const tags = [
      'remote-state',
      schema.backend,
      schema.provider,
      'backend',
      'complete',
      'generated',
      ...(options.additionalTags || []),
    ];

    return {
      id: templateId,
      name: schema.name,
      description: schema.description,
      category: 'backend',
      cloudProvider,
      source: 'builtin',
      version: schema.version || '1.0.0',
      tags,
    };
  }

  /**
   * Map schema provider string to ConfigTemplate cloudProvider type
   */
  private mapProvider(provider: string): 'aws' | 'azure' | 'gcp' | 'multi' | undefined {
    switch (provider.toLowerCase()) {
      case 'aws':
        return 'aws';
      case 'azure':
        return 'azure';
      case 'gcp':
        return 'gcp';
      case 'multi':
        return 'multi';
      default:
        return undefined;
    }
  }

  /**
   * Generate ConfigVariable array from schema attributes
   */
  generateVariables(
    attributes: BackendAttribute[],
    options: TemplateGenerationOptions = {}
  ): ConfigVariable[] {
    return attributes
      .filter(attr => options.includeDeprecated || !attr.deprecated)
      .map(attr => this.mapAttributeToVariable(attr));
  }

  /**
   * Map a single BackendAttribute to ConfigVariable
   */
  private mapAttributeToVariable(attr: BackendAttribute): ConfigVariable {
    const variable: ConfigVariable = {
      name: attr.name,
      description: this.enhanceDescription(attr),
      type: attr.type,
      required: attr.required,
    };

    // Add optional fields if present
    if (attr.example !== undefined) {
      variable.example = String(attr.example);
    }

    if (attr.defaultValue !== undefined) {
      variable.defaultValue = attr.defaultValue;
    }

    if (attr.sensitive) {
      variable.sensitive = true;
    }

    return variable;
  }

  /**
   * Enhance attribute description with additional metadata
   */
  private enhanceDescription(attr: BackendAttribute): string {
    let description = attr.description;

    // Add deprecation warning
    if (attr.deprecated && attr.deprecatedMessage) {
      description += ` [DEPRECATED: ${attr.deprecatedMessage}]`;
    } else if (attr.deprecated) {
      description += ' [DEPRECATED]';
    }

    // Add validation info
    if (attr.validValues && attr.validValues.length > 0) {
      const values = attr.validValues.slice(0, 5).join(', ');
      const more = attr.validValues.length > 5 ? '...' : '';
      description += ` Valid values: ${values}${more}`;
    }

    if (attr.pattern) {
      description += ` Pattern: ${attr.pattern}`;
    }

    if (attr.minValue !== undefined || attr.maxValue !== undefined) {
      const min = attr.minValue !== undefined ? attr.minValue : 'none';
      const max = attr.maxValue !== undefined ? attr.maxValue : 'none';
      description += ` Range: ${min} to ${max}`;
    }

    // Add conflict/dependency info
    if (attr.conflictsWith && attr.conflictsWith.length > 0) {
      description += ` Conflicts with: ${attr.conflictsWith.join(', ')}`;
    }

    if (attr.requiredWith && attr.requiredWith.length > 0) {
      description += ` Requires: ${attr.requiredWith.join(', ')}`;
    }

    return description;
  }

  /**
   * Generate HCL template with Mustache conditionals
   */
  generateHcl(schema: BackendSchema, options: TemplateGenerationOptions = {}): string {
    const attributes = options.includeDeprecated
      ? schema.attributes
      : schema.attributes.filter(attr => !attr.deprecated);

    const requiredAttrs = attributes.filter(attr => attr.required);
    const optionalAttrs = attributes.filter(attr => !attr.required);

    const lines: string[] = [];
    lines.push('remote_state {');
    lines.push(`  backend = "${schema.backend}"`);
    lines.push('  config = {');

    // Add required attributes first (no conditionals needed)
    for (const attr of requiredAttrs) {
      const line = this.generateAttributeLine(attr, 4);
      lines.push(line);
    }

    // Add optional attributes with Mustache conditionals
    for (const attr of optionalAttrs) {
      const conditionalBlock = this.generateConditionalBlock(attr, 4);
      lines.push(conditionalBlock);
    }

    lines.push('  }');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate a single HCL attribute line with proper type formatting
   */
  private generateAttributeLine(attr: BackendAttribute, indentLevel: number): string {
    const indent = this.indent(indentLevel);
    const value = this.formatAttributeValue(attr);
    return `${indent}${attr.name} = ${value}`;
  }

  /**
   * Format attribute value based on type for HCL output
   */
  private formatAttributeValue(attr: BackendAttribute): string {
    const varName = attr.name;

    switch (attr.type) {
      case 'string':
        return `"{{${varName}}}"`;
      
      case 'number':
      case 'boolean':
        return `{{${varName}}}`;
      
      case 'list':
        // For lists, we'll need special handling
        // For now, assume it's a list of strings
        return `{{${varName}}}`;
      
      case 'map':
        // Maps need special handling too
        return `{{${varName}}}`;
      
      case 'object':
        // Objects need custom rendering
        return `{{${varName}}}`;
      
      default:
        // Default to string formatting
        return `"{{${varName}}}"`;
    }
  }

  /**
   * Generate a Mustache conditional block for optional attributes
   */
  private generateConditionalBlock(attr: BackendAttribute, baseIndentLevel: number): string {
    const contentLine = this.generateAttributeLine(attr, baseIndentLevel);
    
    // Generate conditional wrapper
    const lines: string[] = [];
    lines.push(`{{#${attr.name}}}`);
    lines.push(contentLine);
    lines.push(`{{/${attr.name}}}`);
    
    return lines.join('\n');
  }

  /**
   * Generate indentation string
   */
  private indent(level: number): string {
    return ' '.repeat(level);
  }

  /**
   * Generate an example configuration showing all required fields
   */
  private generateExample(schema: BackendSchema, variables: ConfigVariable[]): string {
    const lines: string[] = [];
    lines.push('remote_state {');
    lines.push(`  backend = "${schema.backend}"`);
    lines.push('  config = {');

    // Show examples for required variables and a few optional ones
    const requiredVars = variables.filter(v => v.required);
    const optionalVars = variables.filter(v => !v.required).slice(0, 3); // Show up to 3 optional

    for (const variable of [...requiredVars, ...optionalVars]) {
      const exampleValue = this.getExampleValue(variable);
      const indent = this.indent(4);
      lines.push(`${indent}${variable.name} = ${exampleValue}`);
    }

    if (variables.filter(v => !v.required).length > 3) {
      lines.push('    # ... additional optional attributes available');
    }

    lines.push('  }');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Get a formatted example value for a variable
   */
  private getExampleValue(variable: ConfigVariable): string {
    // Use example if available
    if (variable.example) {
      return variable.type === 'string' ? `"${variable.example}"` : variable.example;
    }

    // Use default value if available
    if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
      return variable.type === 'string' 
        ? `"${variable.defaultValue}"` 
        : String(variable.defaultValue);
    }

    // Generate placeholder based on type
    switch (variable.type) {
      case 'string':
        return `"my-${variable.name}"`;
      case 'number':
        return '0';
      case 'boolean':
        return 'true';
      case 'list':
        return '[]';
      case 'map':
        return '{}';
      default:
        return `"${variable.name}-value"`;
    }
  }
}
