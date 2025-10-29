import { ConfigTemplate, TemplateMetadata, TemplateSearchOptions } from '../types/templates.js';

/**
 * Manages Terragrunt configuration templates extracted from documentation
 * and real-world examples (Gruntwork, Azure configs)
 */
export class TemplatesManager {
  private templates: Map<string, ConfigTemplate> = new Map();
  private initialized = false;

  constructor() {
    // Templates will be loaded lazily on first use
  }

  /**
   * Load all templates into memory
   */
  async loadTemplates(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load built-in templates
    this.loadBuiltinTemplates();

    this.initialized = true;
    console.log(`[TemplatesManager] Loaded ${this.templates.size} templates`);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<ConfigTemplate | undefined> {
    await this.loadTemplates();
    return this.templates.get(id.toLowerCase());
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<ConfigTemplate[]> {
    await this.loadTemplates();
    return Array.from(this.templates.values());
  }

  /**
   * Search templates by criteria
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<ConfigTemplate[]> {
    await this.loadTemplates();
    
    let results = Array.from(this.templates.values());

    if (options.category) {
      results = results.filter(t => t.category === options.category);
    }

    if (options.cloudProvider) {
      results = results.filter(t => 
        t.cloudProvider === options.cloudProvider
      );
    }

    if (options.source) {
      results = results.filter(t => t.source === options.source);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags.includes(tag))
      );
    }

    return results;
  }

  /**
   * Get metadata about available templates
   */
  async getMetadata(): Promise<TemplateMetadata> {
    await this.loadTemplates();

    const categories = new Set<string>();
    const cloudProviders = new Set<string>();
    const sources = new Set<string>();

    for (const template of this.templates.values()) {
      categories.add(template.category);
      if (template.cloudProvider) {
        cloudProviders.add(template.cloudProvider);
      }
      sources.add(template.source);
    }

    return {
      totalTemplates: this.templates.size,
      categories: Array.from(categories),
      cloudProviders: Array.from(cloudProviders),
      sources: Array.from(sources),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Load built-in templates (MVP: 3 core templates)
   */
  private loadBuiltinTemplates(): void {
    // Template 1: AWS S3 Remote State (from Gruntwork)
    this.templates.set('aws-s3-backend', {
      id: 'aws-s3-backend',
      name: 'AWS S3 Remote State Backend',
      description: 'Configure S3 backend with DynamoDB locking for AWS',
      category: 'backend',
      cloudProvider: 'aws',
      source: 'gruntwork',
      tags: ['remote-state', 's3', 'dynamodb', 'aws', 'backend'],
      variables: [
        {
          name: 'bucket',
          description: 'S3 bucket name for Terraform state',
          type: 'string',
          required: true,
          example: 'my-terraform-state',
        },
        {
          name: 'key',
          description: 'Path to state file within bucket',
          type: 'string',
          required: true,
          example: '${path_relative_to_include()}/terraform.tfstate',
        },
        {
          name: 'region',
          description: 'AWS region for S3 bucket',
          type: 'string',
          required: true,
          example: 'us-east-1',
        },
        {
          name: 'dynamodb_table',
          description: 'DynamoDB table for state locking',
          type: 'string',
          required: true,
          example: 'terraform-locks',
        },
        {
          name: 'encrypt',
          description: 'Enable encryption at rest',
          type: 'boolean',
          required: false,
          defaultValue: true,
        },
      ],
      templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket         = "{{bucket}}"
    key            = "{{key}}"
    region         = "{{region}}"
    encrypt        = {{encrypt}}
    dynamodb_table = "{{dynamodb_table}}"
  }
}`,
      example: `remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}`,
    });

    // Template 2: Azure Blob Storage Backend (from azure-config repo)
    this.templates.set('azure-blob-backend', {
      id: 'azure-blob-backend',
      name: 'Azure Blob Storage Remote State Backend',
      description: 'Configure Azure Blob Storage backend with Azure AD authentication',
      category: 'backend',
      cloudProvider: 'azure',
      source: 'azure-config',
      tags: ['remote-state', 'azure', 'azurerm', 'blob-storage', 'backend'],
      variables: [
        {
          name: 'subscription_id',
          description: 'Azure subscription ID',
          type: 'string',
          required: true,
          example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        },
        {
          name: 'resource_group_name',
          description: 'Resource group containing storage account',
          type: 'string',
          required: true,
          example: 'rg-terraform-state',
        },
        {
          name: 'storage_account_name',
          description: 'Storage account name',
          type: 'string',
          required: true,
          example: 'tfstatestorage',
        },
        {
          name: 'container_name',
          description: 'Blob container name',
          type: 'string',
          required: true,
          example: 'tfstate',
        },
        {
          name: 'key',
          description: 'Path to state file within container',
          type: 'string',
          required: true,
          example: '${path_relative_to_include("site")}/terraform.tfstate',
        },
      ],
      templateHcl: `remote_state {
  backend = "azurerm"
  config = {
    subscription_id      = "{{subscription_id}}"
    resource_group_name  = "{{resource_group_name}}"
    storage_account_name = "{{storage_account_name}}"
    container_name       = "{{container_name}}"
    key                  = "{{key}}"
  }
}`,
      example: `remote_state {
  backend = "azurerm"
  config = {
    subscription_id      = local.subscription_id
    resource_group_name  = local.deployment_storage_resource_group_name
    storage_account_name = local.deployment_storage_account_name
    container_name       = local.tf_container_name
    key                  = "\${path_relative_to_include(\"site\")}/terraform.tfstate"
  }
}`,
    });

    // Template 3: Generate Provider Block (AWS example from Gruntwork)
    this.templates.set('aws-generate-provider', {
      id: 'aws-generate-provider',
      name: 'AWS Provider Generation',
      description: 'Generate AWS provider configuration with account validation',
      category: 'provider',
      cloudProvider: 'aws',
      source: 'gruntwork',
      tags: ['provider', 'aws', 'generate'],
      variables: [
        {
          name: 'path',
          description: 'Path to generated provider file',
          type: 'string',
          required: true,
          example: 'provider.tf',
        },
        {
          name: 'if_exists',
          description: 'What to do if file exists',
          type: 'string',
          required: false,
          defaultValue: 'overwrite_terragrunt',
        },
        {
          name: 'region',
          description: 'AWS region',
          type: 'string',
          required: true,
          example: 'us-east-1',
        },
        {
          name: 'account_id',
          description: 'AWS account ID for validation',
          type: 'string',
          required: true,
          example: '123456789012',
        },
      ],
      templateHcl: `generate "provider" {
  path      = "{{path}}"
  if_exists = "{{if_exists}}"
  contents  = <<EOF
provider "aws" {
  region = "{{region}}"
  allowed_account_ids = ["{{account_id}}"]
}
EOF
}`,
      example: `generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  allowed_account_ids = ["123456789012"]
}
EOF
}`,
    });

    // Template 4: GCP GCS Remote State Backend
    this.templates.set('gcp-gcs-backend', {
      id: 'gcp-gcs-backend',
      name: 'GCP GCS Remote State Backend',
      description: 'Configure Google Cloud Storage as remote state backend',
      category: 'backend',
      cloudProvider: 'gcp',
      source: 'builtin',
      tags: ['remote-state', 'gcs', 'gcp', 'backend'],
      variables: [
        {
          name: 'bucket',
          description: 'GCS bucket name for remote state',
          type: 'string',
          required: true,
          example: 'my-terraform-state',
        },
        {
          name: 'prefix',
          description: 'Path prefix within bucket',
          type: 'string',
          required: true,
          example: 'terraform/state',
        },
        {
          name: 'project',
          description: 'GCP project ID',
          type: 'string',
          required: false,
          example: 'my-gcp-project',
        },
        {
          name: 'credentials',
          description: 'Path to GCP credentials file',
          type: 'string',
          required: false,
          example: '/path/to/credentials.json',
        },
      ],
      templateHcl: `remote_state {
  backend = "gcs"
  config = {
    bucket      = "{{bucket}}"
    prefix      = "{{prefix}}"
{{#project}}
    project     = "{{project}}"
{{/project}}
{{#credentials}}
    credentials = "{{credentials}}"
{{/credentials}}
  }
}`,
      example: `remote_state {
  backend = "gcs"
  config = {
    bucket      = "my-terraform-state"
    prefix      = "terraform/state"
    project     = "my-gcp-project"
  }
}`,
    });

    // Template 5: Before Hook
    this.templates.set('before-hook', {
      id: 'before-hook',
      name: 'Before Hook',
      description: 'Execute commands before Terragrunt operations',
      category: 'hooks',
      cloudProvider: 'multi',
      source: 'builtin',
      tags: ['hooks', 'before', 'automation'],
      variables: [
        {
          name: 'name',
          description: 'Hook name',
          type: 'string',
          required: true,
          example: 'validate',
        },
        {
          name: 'commands',
          description: 'Comma-separated list of commands to run hook on',
          type: 'string',
          required: true,
          example: 'apply,plan',
        },
        {
          name: 'execute',
          description: 'Comma-separated list of shell commands to execute',
          type: 'string',
          required: true,
          example: 'echo "Running validation"',
        },
        {
          name: 'working_dir',
          description: 'Working directory for hook execution',
          type: 'string',
          required: false,
          example: '.',
        },
      ],
      templateHcl: `terraform {
  before_hook "{{name}}" {
    commands     = [{{#commands}}"{{.}}"{{^last}}, {{/last}}{{/commands}}]
    execute      = [{{#execute}}"{{.}}"{{^last}}, {{/last}}{{/execute}}]
{{#working_dir}}
    working_dir  = "{{working_dir}}"
{{/working_dir}}
  }
}`,
      example: `terraform {
  before_hook "validate" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Running validation"]
  }
}`,
    });

    // Template 6: After Hook
    this.templates.set('after-hook', {
      id: 'after-hook',
      name: 'After Hook',
      description: 'Execute commands after Terragrunt operations',
      category: 'hooks',
      cloudProvider: 'multi',
      source: 'builtin',
      tags: ['hooks', 'after', 'automation'],
      variables: [
        {
          name: 'name',
          description: 'Hook name',
          type: 'string',
          required: true,
          example: 'notify',
        },
        {
          name: 'commands',
          description: 'Comma-separated list of commands to run hook on',
          type: 'string',
          required: true,
          example: 'apply',
        },
        {
          name: 'execute',
          description: 'Comma-separated list of shell commands to execute',
          type: 'string',
          required: true,
          example: 'echo "Deployment complete"',
        },
        {
          name: 'run_on_error',
          description: 'Run hook even if command fails',
          type: 'boolean',
          required: false,
          example: 'true',
          defaultValue: 'false',
        },
      ],
      templateHcl: `terraform {
  after_hook "{{name}}" {
    commands     = [{{#commands}}"{{.}}"{{^last}}, {{/last}}{{/commands}}]
    execute      = [{{#execute}}"{{.}}"{{^last}}, {{/last}}{{/execute}}]
{{#run_on_error}}
    run_on_error = {{run_on_error}}
{{/run_on_error}}
  }
}`,
      example: `terraform {
  after_hook "notify" {
    commands     = ["apply"]
    execute      = ["echo", "Deployment complete"]
    run_on_error = true
  }
}`,
    });

    // Template 7: Single Module Dependency
    this.templates.set('dependency-single', {
      id: 'dependency-single',
      name: 'Single Module Dependency',
      description: 'Configure dependency on another Terragrunt module',
      category: 'dependency',
      cloudProvider: 'multi',
      source: 'builtin',
      tags: ['dependency', 'module', 'outputs'],
      variables: [
        {
          name: 'name',
          description: 'Dependency name (used to reference outputs)',
          type: 'string',
          required: true,
          example: 'vpc',
        },
        {
          name: 'config_path',
          description: 'Path to dependency terragrunt.hcl',
          type: 'string',
          required: true,
          example: '../vpc',
        },
        {
          name: 'mock_outputs_allowed',
          description: 'Allow using mock outputs when dependency not applied',
          type: 'boolean',
          required: false,
          example: 'true',
          defaultValue: 'false',
        },
      ],
      templateHcl: `dependency "{{name}}" {
  config_path = "{{config_path}}"
{{#mock_outputs_allowed}}
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    # Add mock outputs here
  }
{{/mock_outputs_allowed}}
}`,
      example: `dependency "vpc" {
  config_path = "../vpc"
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    vpc_id = "mock-vpc-id"
  }
}`,
    });

    // Template 8: Basic Inputs Configuration
    this.templates.set('inputs-basic', {
      id: 'inputs-basic',
      name: 'Basic Inputs Configuration',
      description: 'Define input variables to pass to Terraform',
      category: 'inputs',
      cloudProvider: 'multi',
      source: 'builtin',
      tags: ['inputs', 'variables', 'configuration'],
      variables: [
        {
          name: 'environment',
          description: 'Environment name',
          type: 'string',
          required: false,
          example: 'production',
        },
        {
          name: 'region',
          description: 'Cloud region',
          type: 'string',
          required: false,
          example: 'us-east-1',
        },
      ],
      templateHcl: `inputs = {
{{#environment}}
  environment = "{{environment}}"
{{/environment}}
{{#region}}
  region      = "{{region}}"
{{/region}}
  # Add more inputs as needed
}`,
      example: `inputs = {
  environment = "production"
  region      = "us-east-1"
  project     = "my-project"
}`,
    });

    // Template 9: Terraform Version Constraint
    this.templates.set('terraform-version', {
      id: 'terraform-version',
      name: 'Terraform Version Constraint',
      description: 'Specify required Terraform version',
      category: 'configuration',
      cloudProvider: 'multi',
      source: 'builtin',
      tags: ['version', 'constraint', 'terraform'],
      variables: [
        {
          name: 'constraint',
          description: 'Version constraint expression',
          type: 'string',
          required: true,
          example: '>= 1.0.0, < 2.0.0',
        },
      ],
      templateHcl: `terraform_version_constraint = "{{constraint}}"`,
      example: `terraform_version_constraint = ">= 1.0.0, < 2.0.0"`,
    });

    console.log('[TemplatesManager] Loaded 9 built-in templates');
  }

  /**
   * Clear all templates (useful for testing)
   */
  clear(): void {
    this.templates.clear();
    this.initialized = false;
  }
}
