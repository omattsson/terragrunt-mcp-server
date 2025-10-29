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
      tags: ['remote-state', 'azure', 'blob-storage', 'backend'],
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

    console.log('[TemplatesManager] Loaded 3 built-in templates');
  }

  /**
   * Clear all templates (useful for testing)
   */
  clear(): void {
    this.templates.clear();
    this.initialized = false;
  }
}
