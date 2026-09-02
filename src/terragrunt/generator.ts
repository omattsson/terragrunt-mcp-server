import { TerragruntDocsManager } from './docs.js';
import { validateHCL } from './hcl-validator.js';
import { validateWithTerragrunt } from './cli-validator.js';
import { ConfigTemplateLibrary, UseCase } from './library.js';
import { ConfigTemplate, ConfigVariable } from '../types/templates.js';
import { GenerateConfigParams, GeneratedConfig, VariableValidationResult, TerragruntValidationResult } from '../types/generator.js';
import Mustache from 'mustache';

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
    const { useCase, backend, tier, options } = params;

    // Get appropriate template
    const template = await this.templateLibrary.getTemplate(useCase, backend, tier);
    if (!template) {
      const tierMsg = tier ? ` (tier: ${tier})` : '';
      throw new Error(`No template found for use case '${useCase}'${backend ? ` with backend '${backend}'` : ''}${tierMsg}`);
    }

    const resolvedOptions = { ...options };
    const supportsNativeS3Locking = template.variables.some(variable => variable.name === 'use_lockfile');
    if (
      useCase === 'remote_state'
      && supportsNativeS3Locking
      && options.use_lockfile === undefined
    ) {
      resolvedOptions.use_lockfile = options.dynamodb_table === undefined;
    }

    // Validate and resolve variables
    const validation = this.validateVariables(template, resolvedOptions);
    if (!validation.isValid) {
      throw new Error(`Missing required variables: ${validation.missingVariables.join(', ')}`);
    }

    // Generate configuration from template
    let config = await this.buildFromTemplate(template, validation.resolvedValues);

    // Tier 1: Always run regex-based validation
    const regexValidation = validateHCL(config);

    // Tier 2: Optionally run Terragrunt CLI validation
    let terragruntValidation: TerragruntValidationResult | undefined;
    let wasFormatted: boolean | undefined;

    if (params.strictValidation) {
      terragruntValidation = await validateWithTerragrunt(config);

      // If Terragrunt validation succeeded, use its formatted output
      if (terragruntValidation.available && terragruntValidation.syntaxValid && terragruntValidation.formattedConfig) {
        config = terragruntValidation.formattedConfig;
        wasFormatted = true;
      } else {
        wasFormatted = false;
      }

      // In strict mode, throw error if validation failed
      if (terragruntValidation.available && !terragruntValidation.syntaxValid) {
        throw new Error(`Terragrunt validation failed:\n${terragruntValidation.errors.map(e => `  - ${e}`).join('\n')}`);
      } else if (!terragruntValidation.available && !regexValidation.syntaxValid) {
        // Fallback to regex validation if Terragrunt not available
        throw new Error(`HCL validation failed:\n${regexValidation.errors.map(e => `  - ${e}`).join('\n')}`);
      }
    }

    // Generate explanation
    const explanation = await this.explainConfiguration(config, useCase, template);

    // Fetch related documentation
    const relatedDocs = await this.fetchRelevantDocs(useCase, backend);

    // Generate next steps
    const nextSteps = await this.generateNextSteps(useCase, backend, validation.resolvedValues);

    // Suggest additional options
    const additionalOptions = this.suggestAdditionalOptions(template, validation.resolvedValues);

    return {
      config,
      explanation,
      relatedDocs,
      nextSteps,
      additionalOptions,
      validation: {
        regex: regexValidation,
        terragrunt: terragruntValidation,
      },
      wasFormatted,
    };
  }

  /**
   * Validate variables and apply defaults
   */
  private validateVariables(template: ConfigTemplate, options: Record<string, string | number | boolean | undefined>): VariableValidationResult {
    const missingVariables: string[] = [];
    const resolvedValues: Record<string, string | number | boolean> = {};

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
   * Build configuration from template with variable substitution.
   * 
   * Uses two-phase rendering:
   * 1. Phase 1: Process Mustache conditionals ({{#var}}...{{/var}}, {{^var}}...{{/var}})
   * 2. Phase 2: Type-aware value substitution for remaining {{variable}} placeholders
   * 
   * This approach allows optional fields in templates while preserving
   * HCL type-aware formatting (strings quoted, booleans/numbers unquoted).
   */
  private async buildFromTemplate(template: ConfigTemplate, values: Record<string, string | number | boolean>): Promise<string> {
    // Find variable metadata for type-aware substitution
    const variableMap = new Map<string, ConfigVariable>();
    for (const variable of template.variables) {
      variableMap.set(variable.name, variable);
    }

    // ============================================================
    // Phase 1: Process Mustache conditionals
    // ============================================================
    // Create a context object for Mustache where:
    // - Variables with values are truthy (their presence enables conditional blocks)
    // - Variables without values are falsy (conditional blocks are removed)
    // 
    // We use placeholder markers instead of actual values so that
    // Phase 2 can do type-aware substitution.
    const mustacheContext: Record<string, string | boolean> = {};
    
    for (const variable of template.variables) {
      const value = values[variable.name];
      let present = value !== undefined && value !== null && value !== '';
      // Flag variables enable their conditional only on a truthy value, so an
      // explicit false (e.g. auto_approve = false) does not enable the block.
      if (present && variable.flag) {
        present = value !== false && value !== 'false' && value !== 0 && value !== '0';
      }
      if (present) {
        // Variable has a value - make it truthy for conditionals
        // Use a unique placeholder that won't conflict with other content
        mustacheContext[variable.name] = `__PLACEHOLDER_${variable.name}__`;
      }
      // If variable has no value, it won't be in context (falsy for Mustache)
    }

    // Disable Mustache's HTML escaping since we're generating HCL, not HTML
    Mustache.escape = (text: string) => text;
    
    // Render conditionals - this removes {{#var}}...{{/var}} blocks for missing variables
    // and keeps them (with placeholders) for present variables
    let config = Mustache.render(template.templateHcl, mustacheContext);

    // ============================================================
    // Phase 2: Type-aware value substitution
    // ============================================================
    // Now replace all placeholders with properly formatted values
    for (const [name, value] of Object.entries(values)) {
      const variable = variableMap.get(name);
      const placeholder = `__PLACEHOLDER_${name}__`;

      // Type-aware substitution
      let substitutedValue: string;
      if (variable?.type === 'boolean') {
        // Booleans without quotes
        substitutedValue = String(value);
      } else if (variable?.type === 'number') {
        // Numbers without quotes
        substitutedValue = String(value);
      } else {
        // Strings - escape special characters and handle quoting
        const stringValue = String(value);
        // Escape backslashes first, then quotes
        const escapedValue = stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        
        // Check if placeholder is already within quotes in template
        const quotedPattern = new RegExp(`"${placeholder}"`, 'g');
        if (config.match(quotedPattern)) {
          // Already quoted in template, substitute without adding quotes
          substitutedValue = escapedValue;
        } else {
          // Not quoted, add quotes
          substitutedValue = `"${escapedValue}"`;
        }
      }

      config = config.replace(new RegExp(placeholder, 'g'), substitutedValue);
    }

    // Also handle any remaining {{variable}} placeholders that weren't in conditionals
    // (backward compatibility with simple templates)
    for (const [name, value] of Object.entries(values)) {
      const variable = variableMap.get(name);
      const placeholder = `{{${name}}}`;

      // Type-aware substitution
      let substitutedValue: string;
      if (variable?.type === 'boolean') {
        substitutedValue = String(value);
      } else if (variable?.type === 'number') {
        substitutedValue = String(value);
      } else {
        const stringValue = String(value);
        const escapedValue = stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        
        const quotedPattern = new RegExp(`"${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
        if (config.match(quotedPattern)) {
          substitutedValue = escapedValue;
        } else {
          substitutedValue = `"${escapedValue}"`;
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
    
    // Scan for block_type { ... } with proper nested brace handling
    let i = 0;
    const len = config.length;
    
    while (i < len) {
      // Skip whitespace
      while (i < len && /\s/.test(config[i])) {
        i++;
      }
      
      // Match block type and opening brace
      const remaining = config.slice(i);
      const blockStart = remaining.match(/^(\w+)\s*\{/);
      
      if (blockStart) {
        const type = blockStart[1];
        // Move past the block type and opening brace
        i += blockStart[0].length;
        
        // Find matching closing brace using brace counting
        let braceCount = 1;
        const contentStart = i;
        let contentEnd = i;
        
        while (contentEnd < len && braceCount > 0) {
          if (config[contentEnd] === '{') {
            braceCount++;
          } else if (config[contentEnd] === '}') {
            braceCount--;
          }
          contentEnd++;
        }
        
        // Extract block content (excluding outer braces)
        const content = config.slice(contentStart, contentEnd - 1).trim();
        blocks.push({ type, content });
        i = contentEnd;
      } else {
        // Move to next line if no block found
        const nextNewline = config.indexOf('\n', i);
        if (nextNewline === -1) break;
        i = nextNewline + 1;
      }
    }

    return blocks;
  }

  /**
   * Explain a specific HCL block
   */
  private explainBlock(block: { type: string; content: string }, _useCase: UseCase): string {
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
      cicd: `## Next Steps for CI/CD:
- Set the pipeline's cloud credentials as environment variables (the config does not hard-code them)
- Set TG_NON_INTERACTIVE=true (or pass --non-interactive) in the pipeline so Terragrunt does not prompt; the config only makes OpenTofu/Terraform automation-friendly
- Gate applies behind a manual approval unless you enabled auto-approve
- Cache the .terraform directory between jobs to speed up init`,
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
      cicd: ['ci', 'cd', 'cicd', 'automation', 'extra_arguments', 'non-interactive', 'pipeline'],
    };

    searchTerms.push(...(useCaseTerms[useCase] || []));

    // Add backend specific terms
    if (backend) {
      searchTerms.push(backend);
    }

    // Search documentation for each term and combine results
    const allDocs: any[] = [];
    const seenUrls = new Set<string>();

    // Run searches concurrently for top 3 terms
    const termList = searchTerms.slice(0, 3);
    const searchPromises = termList.map(term =>
      this.docsManager.searchDocs(term)
        .catch(error => {
          console.error(`[Generator] Failed to search docs for term '${term}':`, error);
          return [];
        })
    );
    
    const results = await Promise.all(searchPromises);
    
    // Combine results, take top 2 per term, ensure uniqueness
    for (const docs of results) {
      for (const doc of docs.slice(0, 2)) { // Take top 2 results per term
        if (!seenUrls.has(doc.url)) {
          seenUrls.add(doc.url);
          allDocs.push(doc);
        }
      }
    }

    return allDocs.slice(0, 5); // Return top 5 unique docs
  }

  /**
   * Generate next steps for the user
   */
  private async generateNextSteps(
    useCase: UseCase,
    backend?: string,
    resolvedValues: Record<string, string | number | boolean> = {}
  ): Promise<string[]> {
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
        'Run `terragrunt dag graph` to visualize the dependency graph',
        'Apply dependencies first with `terragrunt apply` in dependency directories',
        'Use `terragrunt run --all -- apply` to apply all units in dependency order',
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
        'Run `terragrunt run --all -- validate` to check configuration',
        'Apply with `terragrunt apply`',
      ],
      cicd: [
        'Merge this terraform block into your terragrunt.hcl',
        'Provide cloud credentials as pipeline environment variables',
        'Set TG_NON_INTERACTIVE=true (or pass --non-interactive) in the pipeline so Terragrunt does not prompt',
        'Gate `terragrunt apply` behind an approval step unless auto-approve is enabled',
      ],
    };

    steps.push(...(useCaseSteps[useCase] || []));

    // Add backend specific steps
    if (backend && useCase === 'remote_state') {
      if (backend.toLowerCase().includes('s3')) {
        steps.push('Enable versioning on the S3 bucket for state history');
        if (resolvedValues.use_lockfile === true) {
          steps.push('Grant read, write, and delete permissions for the S3 lock file');
        }
        if (resolvedValues.dynamodb_table) {
          steps.push('Create the DynamoDB table used for state locking');
        }
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
  private suggestAdditionalOptions(template: ConfigTemplate, usedValues: Record<string, string | number | boolean>): string[] {
    const suggestions: string[] = [];

    // Find variables that weren't used
    for (const variable of template.variables) {
      if (!Object.prototype.hasOwnProperty.call(usedValues, variable.name)) {
        suggestions.push(`${variable.name}: ${variable.description}`);
      }
    }

    return suggestions;
  }
}
