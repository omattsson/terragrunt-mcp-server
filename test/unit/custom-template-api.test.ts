/**
 * Integration test for custom templates via API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Custom Template API Integration', () => {
  let toolHandler: ToolHandler;

  beforeEach(() => {
    toolHandler = new ToolHandler();
  });

  it('should generate config with custom template via API', async () => {
    const customTemplate = {
      id: 'custom-s3-backend',
      name: 'Custom S3 Backend',
      description: 'Organization-specific S3 backend with KMS',
      category: 'backend',
      cloudProvider: 'aws',
      templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket         = "{{bucket_name}}"
    key            = "{{key_path}}"
    region         = "{{region}}"
    encrypt        = true
    kms_key_id     = "{{kms_key_id}}"
    dynamodb_table = "{{dynamodb_table}}"
  }
}`,
      variables: [
        {
          name: 'bucket_name',
          type: 'string',
          description: 'S3 bucket name',
          required: true,
          example: 'my-terraform-state'
        },
        {
          name: 'key_path',
          type: 'string',
          description: 'State file path',
          required: true,
          example: 'prod/terraform.tfstate'
        },
        {
          name: 'region',
          type: 'string',
          description: 'AWS region',
          required: true,
          example: 'us-east-1'
        },
        {
          name: 'kms_key_id',
          type: 'string',
          description: 'KMS key ID',
          required: true,
          example: 'arn:aws:kms:us-east-1:123456789012:key/...'
        },
        {
          name: 'dynamodb_table',
          type: 'string',
          description: 'DynamoDB table for locking',
          required: true,
          example: 'terraform-locks'
        }
      ],
      tags: ['aws', 's3', 'kms', 'custom']
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'remote_state',
      backend: 'custom-s3-backend',
      options: {
        bucket_name: 'acme-terraform-state',
        key_path: 'production/terraform.tfstate',
        region: 'us-west-2',
        kms_key_id: 'arn:aws:kms:us-west-2:123456789012:key/abc123',
        dynamodb_table: 'terraform-state-lock'
      },
      custom_template: customTemplate
    });

    expect(result.success).toBe(true);
    expect(result.usedCustomTemplate).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config).toContain('acme-terraform-state');
    expect(result.config).toContain('us-west-2');
    expect(result.config).toContain('arn:aws:kms:us-west-2:123456789012:key/abc123');
    expect(result.config).toContain('terraform-state-lock');
    expect(result.validation).toBeDefined();
    expect(result.validation.regex.syntaxValid).toBe(true);
  });

  it('should reject invalid custom template', async () => {
    const invalidTemplate = {
      id: 'invalid',
      name: 'Invalid Template',
      // Missing required fields: description, category, templateHcl
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'remote_state',
      options: {
        test: 'value'
      },
      custom_template: invalidTemplate
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Missing required field');
  });

  it('should work without custom template (backward compatibility)', async () => {
    const result = await toolHandler.executeTool('build_config', {
      useCase: 'remote_state',
      backend: 's3',
      options: {
        bucket: 'test-bucket',
        region: 'us-east-1',
        key: 'terraform.tfstate',
        dynamodb_table: 'terraform-locks'
      }
    });

    expect(result.success).toBe(true);
    expect(result.usedCustomTemplate).toBe(false);
    expect(result.config).toBeDefined();
    expect(result.validation).toBeDefined();
  });

  it('should validate HCL syntax in custom template', async () => {
    const templateWithInvalidHcl = {
      id: 'invalid-hcl',
      name: 'Invalid HCL Template',
      description: 'Template with invalid HCL',
      category: 'backend',
      templateHcl: 'remote_state { unclosed brace',
      variables: [],
      tags: []
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'remote_state',
      options: {},
      custom_template: templateWithInvalidHcl
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid HCL syntax');
  });

  it('should handle custom hook template', async () => {
    const hookTemplate = {
      id: 'security-scan-hook',
      name: 'Security Scan Hook',
      description: 'Runs security scan before apply',
      category: 'hooks',
      templateHcl: `terraform {
  before_hook "security_scan" {
    commands     = ["apply"]
    execute      = ["{{scanner_command}}", "."]
    run_on_error = false
  }
}`,
      variables: [
        {
          name: 'scanner_command',
          type: 'string',
          description: 'Security scanner command',
          required: true,
          example: 'tfsec'
        }
      ],
      tags: ['security', 'hooks']
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'hooks',
      backend: 'security-scan-hook',  // Pass template ID as backend
      options: {
        scanner_command: 'trivy'
      },
      custom_template: hookTemplate
    });

    expect(result.success).toBe(true);
    expect(result.usedCustomTemplate).toBe(true);
    expect(result.config).toContain('trivy');
    expect(result.config).toContain('before_hook');
    expect(result.validation.regex.syntaxValid).toBe(true);
  });

  it('should handle custom provider template', async () => {
    const providerTemplate = {
      id: 'multi-cloud-provider',
      name: 'Multi-Cloud Provider',
      description: 'AWS and Azure providers together',
      category: 'provider',
      cloudProvider: 'multi',
      templateHcl: `generate "providers" {
  path      = "providers.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "{{aws_region}}"
}

provider "azurerm" {
  features {}
  subscription_id = "{{azure_subscription_id}}"
}
EOF
}`,
      variables: [
        {
          name: 'aws_region',
          type: 'string',
          description: 'AWS region',
          required: true,
          example: 'us-east-1'
        },
        {
          name: 'azure_subscription_id',
          type: 'string',
          description: 'Azure subscription ID',
          required: true,
          example: '00000000-0000-0000-0000-000000000000'
        }
      ],
      tags: ['aws', 'azure', 'multi-cloud']
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'provider_generation',
      backend: 'multi-cloud-provider',  // Pass template ID as backend
      options: {
        aws_region: 'eu-west-1',
        azure_subscription_id: '12345678-1234-1234-1234-123456789012'
      },
      custom_template: providerTemplate
    });

    expect(result.success).toBe(true);
    expect(result.usedCustomTemplate).toBe(true);
    expect(result.config).toContain('eu-west-1');
    expect(result.config).toContain('12345678-1234-1234-1234-123456789012');
    expect(result.config).toContain('provider "aws"');
    expect(result.config).toContain('provider "azurerm"');
  });

  it('should have build_config tool with essential parameters', () => {
    const tools = toolHandler.getAvailableTools();
    const generateTool = tools.find(t => t.name === 'build_config');

    expect(generateTool).toBeDefined();
    // Custom template removed from schema to reduce token overhead
    // It's still supported via the implementation, just not advertised in schema
    expect(generateTool?.inputSchema.properties.useCase).toBeDefined();
    expect(generateTool?.inputSchema.properties.options).toBeDefined();
    expect(generateTool?.inputSchema.properties.write).toBeDefined();
    // Verify custom_template is NOT in schema (token reduction)
    expect(generateTool?.inputSchema.properties.custom_template).toBeUndefined();
  });

  it('should still accept custom_template parameter despite schema removal (backward compatibility)', async () => {
    // Verify backward compatibility: even though custom_template was removed from schema
    // to reduce tokens, the implementation still accepts the old nested object structure
    // and processes it correctly. This ensures old client code continues to work.
    const customTemplate = {
      id: 'backward-compat-test',
      name: 'Backward Compatibility Test',
      description: 'Test that custom_template still works',
      category: 'backend',
      cloudProvider: 'aws',
      templateHcl: `remote_state {
  backend = "s3"
  config = {
    bucket = "{{bucket}}"
    key    = "test.tfstate"
  }
}`,
      variables: [
        {
          name: 'bucket',
          type: 'string',
          description: 'S3 bucket',
          required: true
        }
      ]
    };

    const result = await toolHandler.executeTool('build_config', {
      useCase: 'remote_state',
      backend: 'backward-compat-test',  // Match the template ID
      options: {
        bucket: 'test-bucket'
      },
      custom_template: customTemplate
    });

    // Verify the custom template was used successfully
    expect(result.success).toBe(true);
    expect(result.usedCustomTemplate).toBe(true);
    expect(result.config).toContain('test-bucket');
    expect(result.config).toContain('test.tfstate');
  });
});
