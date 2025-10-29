import { TerragruntDocsManager } from './docs.js';
import { ConfigTemplateLibrary, UseCase } from './library.js';
import { ConfigTemplate, ConfigVariable } from '../types/templates.js';
import { GenerateConfigParams, GeneratedConfig, VariableValidationResult } from '../types/generator.js';

/**
 * TerragruntConfigGenerator generates complete terragrunt.hcl configurations
 * from templates with variable substitution, explanations, and documentation.
 */
export class TerragruntConfigGenerator {
  private docsManager: TerragruntDocsManager;
  private templateLibrary: ConfigTemplateLibrary;

  constructor(docsManager?: TerragruntDocsManager, templateLibrary?: ConfigTemplateLibrary) {
    this.docsManager = docsManager || new TerragruntDocsManager();
    this.templateLibrary = templateLibrary || new ConfigTemplateLibrary();
  }

  /**
   * Generate a complete Terragrunt configuration from parameters
   */
  async generateConfig(params: GenerateConfigParams): Promise<GeneratedConfig> {
    const { useCase, backend, options } = params;

    // Get appropriate template
    const template = await this.templateLibrary.getTemplate(useCase, backend);
    if (!template) {
      throw new Error(`No template found for use case '${useCase}'${backend ? ` with backend '${backend}'` : ''}`);
    }

    // Validate and resolve variables
    const validation = this.validateVariables(template, options);
    if (!validation.isValid) {
      throw new Error(`Missing required variables: ${validation.missingVariables.join(', ')}`);
    }

    // Build configuration from template
    const config = await this.buildFromTemplate(template, validation.resolvedValues);

    // Generate explanation
    const explanation = await this.explainConfiguration(config, useCase, template);

    // Fetch related documentation
    const relatedDocs = await this.fetchRelevantDocs(useCase, backend);

    // Generate next steps
    const nextSteps = await this.generateNextSteps(useCase, backend);

    // Suggest additional options
    const additionalOptions = this.suggestAdditionalOptions(template, validation.resolvedValues);

    return {
      config,
      explanation,
      relatedDocs,
      nextSteps,
      additionalOptions,
    };
  }

  /**
   * Validate variables and apply defaults
   */
  private validateVariables(template: ConfigTemplate, options: Record<string, any>): VariableValidationResult {
    const missingVariables: string[] = [];
    const resolvedValues: Record<string, any> = {};

    for (const variable of template.variables) {
      const value = options[variable.name];

      if (value !== undefined && value !== null) {
        // User provided value
        resolvedValues[variable.name] = value;
      } else if (variable.defaultValue !== undefined) {
        // Use default value
        resolvedValues[variable.name] = variable.defaultValue;
      } else if (variable.required) {
        // Required but not provided
        missingVariables.push(variable.name);
      }
    }

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
      resolvedValues,
    };
  }

  /**
   * Build configuration from template with variable substitution
   */
  private async buildFromTemplate(template: ConfigTemplate, values: Record<string, any>): Promise<string> {
    let config = template.templateHcl;

    // Find variable metadata for type-aware substitution
    const variableMap = new Map<string, ConfigVariable>();
    for (const variable of template.variables) {
      variableMap.set(variable.name, variable);
    }

    // Replace all {{variable}} placeholders
    for (const [name, value] of Object.entries(values)) {
      const variable = variableMap.get(name);
      const placeholder = `{{${name}}}`;

      // Type-aware substitution
      let substitutedValue: string;
      if (variable?.type === 'boolean') {
        // Booleans without quotes
        substitutedValue = String(value);
      } else if (variable?.type === 'number') {
        // Numbers without quotes
        substitutedValue = String(value);
      } else {
        // Strings - value might already be in a quoted context in template
        // Check if placeholder is already within quotes in template
        const quotedPattern = new RegExp(`"${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
        if (config.match(quotedPattern)) {
          // Already quoted in template, substitute without adding quotes
          substitutedValue = String(value);
        } else {
          // Not quoted, add quotes
          substitutedValue = `"${value}"`;
        }
      }

      config = config.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), substitutedValue);
    }

    return config;
  }

  /**
   * Generate explanation of the configuration
   */
  private async explainConfiguration(config: string, useCase: UseCase, template: ConfigTemplate): Promise<string> {
    const sections: string[] = [];

    // Add template description
    sections.push(`# ${template.name}\n\n${template.description}\n`);

    // Parse and explain blocks
    const blocks = this.parseHclBlocks(config);
    
    if (blocks.length > 0) {
      sections.push('## Configuration Sections:\n');
      
      for (const block of blocks) {
        const blockExplanation = this.explainBlock(block, useCase);
        sections.push(`### ${block.type} block`);
        sections.push(blockExplanation);
        sections.push('');
      }
    }

    // Add use case specific guidance
    sections.push(this.getUseCaseGuidance(useCase));

    return sections.join('\n');
  }

  /**
   * Parse HCL blocks from configuration
   */
  private parseHclBlocks(config: string): Array<{ type: string; content: string }> {
    const blocks: Array<{ type: string; content: string }> = [];
    
    // Match HCL blocks: block_type { ... }
    const blockRegex = /(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;

    while ((match = blockRegex.exec(config)) !== null) {
      blocks.push({
        type: match[1],
        content: match[2],
      });
    }

    return blocks;
  }

  /**
   * Explain a specific HCL block
   */
  private explainBlock(block: { type: string; content: string }, useCase: UseCase): string {
    const explanations: Record<string, string> = {
      remote_state: 'Configures remote state backend for storing Terraform state in a shared location. This enables team collaboration and state locking to prevent concurrent modifications.',
      generate: 'Automatically generates configuration files before Terraform runs. Useful for creating provider configurations, backend configs, or other repetitive files.',
      dependency: 'Declares dependencies on other Terragrunt modules. Terragrunt will ensure dependencies are applied before this module.',
      terraform: 'Configures Terraform settings including the source module location and version constraints.',
      locals: 'Defines local variables that can be referenced throughout the configuration.',
      inputs: 'Specifies input variables to pass to the Terraform module.',
      hooks: 'Defines before/after hooks to run custom commands at specific points in the Terragrunt lifecycle.',
    };

    return explanations[block.type] || `Configures ${block.type} settings for this Terragrunt module.`;
  }

  /**
   * Get use case specific guidance
   */
  private getUseCaseGuidance(useCase: UseCase): string {
    const guidance: Record<UseCase, string> = {
      remote_state: `## Next Steps for Remote State:
- Ensure the backend storage (bucket/container) exists before running Terragrunt
- Configure appropriate IAM/RBAC permissions for state access
- Consider enabling versioning and encryption on the storage backend
- Use consistent naming conventions across your infrastructure`,
      
      provider_generation: `## Next Steps for Provider Generation:
- Verify provider version constraints match your Terraform modules
- Ensure credentials/authentication is configured for the provider
- Consider using environment variables for sensitive values
- Test provider configuration in a development environment first`,
      
      dependencies: `## Next Steps for Dependencies:
- Ensure dependency modules are defined and accessible
- Verify the dependency graph doesn't create cycles
- Use mock outputs for testing without deploying dependencies
- Consider using dependency blocks with enabled = false for conditional dependencies`,
      
      hooks: `## Next Steps for Hooks:
- Test hooks in isolation before adding to production
- Ensure hook commands are available in the execution environment
- Use hooks for validation, notification, or custom automation
- Consider error handling for hook failures`,
      
      inputs: `## Next Steps for Inputs:
- Validate input values match the types expected by your Terraform module
- Use locals for computed or derived values
- Consider using dependency outputs as input values
- Document required vs. optional inputs`,
    };

    return guidance[useCase] || '';
  }

  /**
   * Fetch relevant documentation for the use case
   */
  private async fetchRelevantDocs(useCase: UseCase, backend?: string): Promise<any[]> {
    const searchTerms: string[] = [];

    // Add use case related terms
    const useCaseTerms: Record<UseCase, string[]> = {
      remote_state: ['remote state', 'backend', 's3', 'gcs', 'azurerm', 'state locking'],
      provider_generation: ['generate', 'provider', 'aws provider', 'azure provider', 'gcp provider'],
      dependencies: ['dependency', 'dependencies', 'depend on'],
      hooks: ['hooks', 'before_hook', 'after_hook'],
      inputs: ['inputs', 'variables', 'input variables'],
    };

    searchTerms.push(...(useCaseTerms[useCase] || []));

    // Add backend specific terms
    if (backend) {
      searchTerms.push(backend);
    }

    // Search documentation for each term and combine results
    const allDocs: any[] = [];
    const seenUrls = new Set<string>();

    for (const term of searchTerms.slice(0, 3)) { // Limit to top 3 terms
      try {
        const docs = await this.docsManager.searchDocs(term);
        for (const doc of docs.slice(0, 2)) { // Take top 2 results per term
          if (!seenUrls.has(doc.url)) {
            seenUrls.add(doc.url);
            allDocs.push(doc);
          }
        }
      } catch (error) {
        console.error(`[Generator] Failed to search docs for term '${term}':`, error);
      }
    }

    return allDocs.slice(0, 5); // Return top 5 unique docs
  }

  /**
   * Generate next steps for the user
   */
  private async generateNextSteps(useCase: UseCase, backend?: string): Promise<string[]> {
    const steps: string[] = [];

    // Use case specific next steps
    const useCaseSteps: Record<UseCase, string[]> = {
      remote_state: [
        'Create the remote state storage backend (S3 bucket, GCS bucket, or Azure Storage Account)',
        'Configure backend authentication and access permissions',
        'Initialize Terragrunt with `terragrunt init`',
        'Verify state is being stored remotely with `terragrunt state list`',
      ],
      provider_generation: [
        'Review the generated provider configuration',
        'Add the configuration to your root terragrunt.hcl',
        'Run `terragrunt init` to initialize the provider',
        'Verify provider authentication is working',
      ],
      dependencies: [
        'Ensure dependency modules exist and are accessible',
        'Run `terragrunt graph-dependencies` to visualize the dependency graph',
        'Apply dependencies first with `terragrunt apply` in dependency directories',
        'Use `terragrunt run-all apply` to apply all modules in correct order',
      ],
      hooks: [
        'Test your hook commands independently',
        'Add hooks to your terragrunt.hcl configuration',
        'Run `terragrunt plan` to verify hooks execute correctly',
        'Check hook output in Terragrunt logs',
      ],
      inputs: [
        'Add the inputs block to your terragrunt.hcl',
        'Verify input values match expected types in your Terraform module',
        'Run `terragrunt run-all validate` to check configuration',
        'Apply with `terragrunt apply`',
      ],
    };

    steps.push(...(useCaseSteps[useCase] || []));

    // Add backend specific steps
    if (backend && useCase === 'remote_state') {
      if (backend.toLowerCase().includes('s3')) {
        steps.push('Enable versioning on the S3 bucket for state history');
        steps.push('Create DynamoDB table for state locking');
      } else if (backend.toLowerCase().includes('azure') || backend.toLowerCase().includes('azurerm')) {
        steps.push('Enable blob versioning on the storage account');
        steps.push('Configure Azure AD authentication for secure access');
      } else if (backend.toLowerCase().includes('gcs')) {
        steps.push('Enable versioning on the GCS bucket');
        steps.push('Configure GCS IAM roles for state access');
      }
    }

    return steps;
  }

  /**
   * Suggest additional options that could be added to the configuration
   */
  private suggestAdditionalOptions(template: ConfigTemplate, usedValues: Record<string, any>): string[] {
    const suggestions: string[] = [];

    // Find variables that weren't used
    for (const variable of template.variables) {
      if (!usedValues.hasOwnProperty(variable.name)) {
        suggestions.push(`${variable.name}: ${variable.description}`);
      }
    }

    return suggestions;
  }
}
