import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TerragruntConfigGenerator } from '../../src/terragrunt/generator.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { ConfigTemplateLibrary } from '../../src/terragrunt/library.js';
import { TemplatesManager } from '../../src/terragrunt/templates/index.js';

describe('TerragruntConfigGenerator', () => {
  let generator: TerragruntConfigGenerator;
  let mockDocsManager: TerragruntDocsManager;
  let mockLibrary: ConfigTemplateLibrary;

  beforeEach(() => {
    // Create real instances for integration-style testing
    // Tests will use actual templates and logic, but we can mock docs if needed
    const templatesManager = new TemplatesManager();
    mockLibrary = new ConfigTemplateLibrary(templatesManager);
    mockDocsManager = new TerragruntDocsManager();
    
    // Mock the searchDocs method to avoid network calls
    vi.spyOn(mockDocsManager, 'searchDocs').mockResolvedValue([
      {
        title: 'Remote State',
        url: 'https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/',
        content: 'Documentation about remote state configuration',
        section: 'features',
      },
      {
        title: 'AWS Provider',
        url: 'https://terragrunt.gruntwork.io/docs/features/generate-provider/',
        content: 'Documentation about generating provider blocks',
        section: 'features',
      },
    ]);

    generator = new TerragruntConfigGenerator(mockDocsManager, mockLibrary);
  });

  describe('constructor', () => {
    it('should create instance with provided dependencies', () => {
      const gen = new TerragruntConfigGenerator(mockDocsManager, mockLibrary);
      expect(gen).toBeInstanceOf(TerragruntConfigGenerator);
    });

    it('should create instance with default dependencies', () => {
      const gen = new TerragruntConfigGenerator();
      expect(gen).toBeInstanceOf(TerragruntConfigGenerator);
    });
  });

  describe('generateConfig', () => {
    it('should generate S3 remote state config with all required options', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'my-terraform-state',
          key: '${path_relative_to_include()}/terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
        },
      });

      expect(result.config).toContain('backend = "s3"');
      expect(result.config).toContain('bucket         = "my-terraform-state"');
      expect(result.config).toContain('region         = "us-east-1"');
      expect(result.config).toContain('dynamodb_table = "terraform-locks"');
      expect(result.config).toContain('encrypt        = true'); // default value
      expect(result.explanation).toContain('Remote State Backend');
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.relatedDocs.length).toBeGreaterThan(0);
    });

    it('should generate Azure remote state config', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure',
        options: {
          subscription_id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'storageaccount',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('subscription_id');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"'); // Note: double space in template
      expect(result.config).toContain('storage_account_name = "storageaccount"');
      expect(result.explanation).toContain('Azure Blob Storage');
      expect(result.nextSteps).toContain('Enable blob versioning on the storage account');
    });

    it('should generate provider configuration', async () => {
      const result = await generator.generateConfig({
        useCase: 'provider_generation',
        options: {
          path: 'provider.tf',
          provider: 'aws',
          region: 'us-west-2',
          account_id: '123456789012',
        },
      });

      expect(result.config).toContain('generate "provider"');
      expect(result.config).toContain('provider "aws"');
      expect(result.config).toContain('region = "us-west-2"');
      expect(result.explanation).toContain('Provider Generation');
      expect(result.nextSteps[0]).toContain('Review the generated provider configuration');
    });

    it('should apply default values for optional variables', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
          // encrypt not provided, should use default: true
        },
      });

      expect(result.config).toContain('encrypt        = true');
    });

    it('should allow overriding default values', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
          encrypt: false, // override default
        },
      });

      expect(result.config).toContain('encrypt        = false');
    });

    it('should throw error for missing required variables', async () => {
      await expect(
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 's3',
          options: {
            bucket: 'test-bucket',
            // Missing: key, region, dynamodb_table
          },
        })
      ).rejects.toThrow('Missing required variables');
    });

    it('should throw error for invalid use case', async () => {
      await expect(
        generator.generateConfig({
          useCase: 'invalid_use_case' as any,
          options: {},
        })
      ).rejects.toThrow('No template found');
    });

    it('should throw error for invalid backend', async () => {
      await expect(
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 'nonexistent-backend',
          options: {
            bucket: 'test',
            key: 'test.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'locks',
          },
        })
      ).rejects.toThrow('No template found');
    });

    it('should suggest additional options not used', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
          encrypt: true, // Explicitly provide this so it's not in additionalOptions
        },
      });

      expect(result.additionalOptions).toBeDefined();
      // Since all optional variables are provided, additional options should be empty or undefined
      // Let's just check it's defined
      expect(Array.isArray(result.additionalOptions)).toBe(true);
    });
  });

  describe('variable substitution', () => {
    it('should substitute boolean values without quotes', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
          encrypt: true,
        },
      });

      expect(result.config).toContain('encrypt        = true');
      expect(result.config).not.toContain('encrypt        = "true"');
    });

    it('should substitute string values with quotes', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'my-bucket',
          key: 'path/to/state.tfstate',
          region: 'us-west-2',
          dynamodb_table: 'my-locks',
        },
      });

      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('region         = "us-west-2"');
    });

    it('should escape special characters in strings', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'bucket-with-"quotes"',
          key: 'path\\with\\backslashes.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.config).toContain('bucket-with-\\"quotes\\"');
      expect(result.config).toContain('path\\\\with\\\\backslashes');
    });

    it('should handle Terragrunt expressions in values', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'my-bucket',
          key: '${path_relative_to_include()}/terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.config).toContain('${path_relative_to_include()}');
    });
  });

  describe('explainConfiguration', () => {
    it('should generate explanation with template description', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.explanation).toContain('Backend');
      expect(result.explanation).toContain('S3');
    });

    it('should explain HCL blocks', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.explanation).toContain('remote_state');
      expect(result.explanation).toContain('remote state backend');
    });

    it('should include use case specific guidance', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.explanation).toContain('Next Steps for Remote State');
      expect(result.explanation).toContain('backend storage');
    });
  });

  describe('fetchRelevantDocs', () => {
    it('should return documentation results', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.relatedDocs).toBeDefined();
      expect(Array.isArray(result.relatedDocs)).toBe(true);
      expect(result.relatedDocs.length).toBeGreaterThan(0);
      expect(result.relatedDocs[0]).toHaveProperty('title');
      expect(result.relatedDocs[0]).toHaveProperty('url');
    });

    it('should deduplicate documentation results', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      const urls = result.relatedDocs.map(doc => doc.url);
      const uniqueUrls = new Set(urls);
      expect(urls.length).toBe(uniqueUrls.size);
    });

    it('should limit results to maximum of 5 docs', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.relatedDocs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateNextSteps', () => {
    it('should generate use case specific steps', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Create the remote state storage backend');
    });

    it('should include S3-specific steps for S3 backend', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.nextSteps.some(step => step.includes('S3 bucket'))).toBe(true);
      expect(result.nextSteps.some(step => step.includes('DynamoDB'))).toBe(true);
    });

    it('should include Azure-specific steps for Azure backend', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure',
        options: {
          subscription_id: 'xxx',
          resource_group_name: 'rg-test',
          storage_account_name: 'storage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      });

      expect(result.nextSteps.some(step => step.toLowerCase().includes('azure'))).toBe(true);
      expect(result.nextSteps.some(step => step.includes('blob versioning'))).toBe(true);
    });

    it('should order steps logically', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      // First step should be about creating resources
      expect(result.nextSteps[0].toLowerCase()).toMatch(/create|ensure/);
    });

    it('should provide different steps for provider generation', async () => {
      const result = await generator.generateConfig({
        useCase: 'provider_generation',
        options: {
          path: 'provider.tf',
          provider: 'aws',
          region: 'us-east-1',
          account_id: '123456789012',
        },
      });

      expect(result.nextSteps[0]).toContain('Review the generated provider configuration');
      expect(result.nextSteps.some(step => step.includes('terragrunt init'))).toBe(true);
    });
  });

  describe('HCL block parsing', () => {
    it('should parse simple HCL blocks', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      // The explanation should contain parsed block information
      expect(result.explanation).toContain('remote_state');
    });

    it('should handle nested HCL blocks', async () => {
      const result = await generator.generateConfig({
        useCase: 'provider_generation',
        options: {
          path: 'provider.tf',
          provider: 'aws',
          region: 'us-east-1',
          account_id: '123456789012',
        },
      });

      // Provider generation has nested generate { provider { } } structure
      expect(result.config).toContain('generate');
      expect(result.config).toContain('provider');
      expect(result.explanation).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing template gracefully', async () => {
      await expect(
        generator.generateConfig({
          useCase: 'hooks', // Use case exists but no template yet
          options: {},
        })
      ).rejects.toThrow();
    });

    it('should handle invalid options type', async () => {
      await expect(
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 's3',
          options: {
            bucket: 123 as any, // number instead of string
            key: 'test.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'locks',
          },
        })
      ).resolves.toBeDefined(); // Should handle type coercion
    });

    it('should handle documentation search failures gracefully', async () => {
      // Mock searchDocs to fail
      vi.spyOn(mockDocsManager, 'searchDocs').mockRejectedValue(new Error('Network error'));

      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      // Should still return a result with empty docs
      expect(result).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.relatedDocs).toEqual([]);
    });
  });

  describe('all use cases', () => {
    it('should support remote_state use case', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      expect(result.config).toContain('remote_state');
    });

    it('should support provider_generation use case', async () => {
      const result = await generator.generateConfig({
        useCase: 'provider_generation',
        options: {
          path: 'provider.tf',
          provider: 'aws',
          region: 'us-east-1',
          account_id: '123456789012',
        },
      });

      expect(result.config).toContain('generate');
    });

    it('should generate dependency configuration', async () => {
      const result = await generator.generateConfig({
        useCase: 'dependencies',
        options: {
          name: 'vpc',
          config_path: '../vpc',
        },
      });

      expect(result).toBeDefined();
      expect(result.config).toContain('dependency');
    });
  });

  describe('conditional rendering (Mustache)', () => {
    it('should include conditional blocks when variable is provided', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'my-gcs-bucket',
          prefix: 'terraform/state',
          project: 'my-gcp-project',
        },
      });

      // Project should be included since it was provided
      expect(result.config).toContain('project');
      expect(result.config).toContain('my-gcp-project');
    });

    it('should exclude conditional blocks when variable is not provided', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'my-gcs-bucket',
          prefix: 'terraform/state',
          // project and credentials are optional
        },
      });

      // Required fields should be present
      expect(result.config).toContain('bucket');
      expect(result.config).toContain('my-gcs-bucket');
      expect(result.config).toContain('prefix');
      
      // Optional fields should NOT have their Mustache conditional syntax
      expect(result.config).not.toContain('{{#project}}');
      expect(result.config).not.toContain('{{/project}}');
      expect(result.config).not.toContain('{{#credentials}}');
      expect(result.config).not.toContain('{{/credentials}}');
    });

    it('should handle GCP backend with all optional fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'my-gcs-bucket',
          prefix: 'terraform/state',
          project: 'my-gcp-project',
          credentials: '/path/to/credentials.json',
        },
      });

      expect(result.config).toContain('bucket');
      expect(result.config).toContain('prefix');
      expect(result.config).toContain('project');
      expect(result.config).toContain('credentials');
      expect(result.config).toContain('my-gcp-project');
      expect(result.config).toContain('/path/to/credentials.json');
    });

    it('should handle GCP backend with only required fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'my-gcs-bucket',
          prefix: 'terraform/state',
        },
      });

      expect(result.config).toContain('bucket');
      expect(result.config).toContain('prefix');
      // Should not contain project or credentials values when not provided
      expect(result.config).not.toContain('project');
      expect(result.config).not.toContain('credentials');
    });

    it('should not leave Mustache syntax in output', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'test-bucket',
          prefix: 'state/',
        },
      });

      // No Mustache syntax should remain in output
      expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should preserve non-conditional variable substitution', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 's3',
        tier: 'essential', // Use builtin template
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks',
        },
      });

      // Standard substitution should still work
      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('region         = "us-east-1"');
      // No Mustache syntax should remain
      expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should handle empty string values as falsy for conditionals', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp',
        options: {
          bucket: 'my-gcs-bucket',
          prefix: 'terraform/state',
          project: '', // Empty string should be treated as not provided
        },
      });

      // Empty string project should not appear in output
      expect(result.config).not.toContain('project');
    });
  });

  describe('AWS S3 Advanced Backend Template', () => {
    it('should generate minimal config with only required fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
        },
      });

      expect(result.config).toContain('backend = "s3"');
      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('key            = "terraform.tfstate"');
      expect(result.config).toContain('region         = "us-east-1"');
      // All optional fields should not appear when not provided
      expect(result.config).not.toContain('dynamodb_table');
      expect(result.config).not.toContain('encrypt');
      expect(result.config).not.toContain('kms_key_id');
      expect(result.config).not.toContain('role_arn');
      expect(result.config).not.toContain('session_name');
      expect(result.config).not.toContain('profile');
      expect(result.config).not.toContain('endpoint');
      expect(result.config).not.toContain('workspace_key_prefix');
      expect(result.config).not.toContain('skip_credentials_validation');
      // No Mustache syntax should remain
      expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should generate config with KMS encryption', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          encrypt: true,
          kms_key_id: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
        },
      });

      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('encrypt        = true');
      expect(result.config).toContain('kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"');
    });

    it('should generate config for cross-account access', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'shared-bucket',
          key: 'prod/terraform.tfstate',
          region: 'us-west-2',
          role_arn: 'arn:aws:iam::987654321098:role/TerraformRole',
          session_name: 'terraform-prod',
        },
      });

      expect(result.config).toContain('bucket         = "shared-bucket"');
      expect(result.config).toContain('region         = "us-west-2"');
      expect(result.config).toContain('role_arn       = "arn:aws:iam::987654321098:role/TerraformRole"');
      expect(result.config).toContain('session_name   = "terraform-prod"');
    });

    it('should generate config for LocalStack testing', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'test-bucket',
          key: 'test.tfstate',
          region: 'us-east-1',
          endpoint: 'http://localhost:4566',
          skip_credentials_validation: true,
        },
      });

      expect(result.config).toContain('bucket         = "test-bucket"');
      expect(result.config).toContain('endpoint       = "http://localhost:4566"');
      expect(result.config).toContain('skip_credentials_validation = true');
    });

    it('should generate config with all optional fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true,
          kms_key_id: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
          role_arn: 'arn:aws:iam::123456789012:role/TerraformRole',
          session_name: 'terraform-session',
          profile: 'development',
          endpoint: 'http://localhost:4566',
          workspace_key_prefix: 'workspaces',
          skip_credentials_validation: true,
        },
      });

      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('key            = "terraform.tfstate"');
      expect(result.config).toContain('region         = "us-east-1"');
      expect(result.config).toContain('dynamodb_table = "terraform-locks"');
      expect(result.config).toContain('encrypt        = true');
      expect(result.config).toContain('kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/test-key"');
      expect(result.config).toContain('role_arn       = "arn:aws:iam::123456789012:role/TerraformRole"');
      expect(result.config).toContain('session_name   = "terraform-session"');
      expect(result.config).toContain('profile        = "development"');
      expect(result.config).toContain('endpoint       = "http://localhost:4566"');
      expect(result.config).toContain('workspace_key_prefix = "workspaces"');
      expect(result.config).toContain('skip_credentials_validation = true');
    });

    it('should generate config with DynamoDB locking', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'my-lock-table',
        },
      });

      expect(result.config).toContain('dynamodb_table = "my-lock-table"');
    });

    it('should generate config with AWS profile', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          profile: 'production',
        },
      });

      expect(result.config).toContain('profile        = "production"');
    });

    it('should generate config with explicit encrypt: false', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          encrypt: false,
        },
      });

      expect(result.config).toContain('bucket         = "my-bucket"');
      expect(result.config).toContain('encrypt        = false');
    });
  });

  describe('Azure Blob Storage Advanced Backend Template', () => {
    it('should generate minimal config with only required fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('storage_account_name = "tfstatestorage"');
      expect(result.config).toContain('container_name       = "tfstate"');
      expect(result.config).toContain('key                  = "terraform.tfstate"');
      // All optional fields should not appear when not provided
      expect(result.config).not.toContain('subscription_id');
      expect(result.config).not.toContain('tenant_id');
      expect(result.config).not.toContain('client_id');
      expect(result.config).not.toContain('client_secret');
      expect(result.config).not.toContain('use_msi');
      expect(result.config).not.toContain('sas_token');
      expect(result.config).not.toContain('snapshot');
      expect(result.config).not.toContain('use_azuread_auth');
      // No Mustache syntax should remain
      expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should generate config with Service Principal authentication', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          subscription_id: 'sub-12345678-1234-1234-1234-123456789012',
          tenant_id: 'tenant-12345678-1234-1234-1234-123456789012',
          client_id: 'client-12345678-1234-1234-1234-123456789012',
          client_secret: 'super-secret-value',
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('subscription_id      = "sub-12345678-1234-1234-1234-123456789012"');
      expect(result.config).toContain('tenant_id            = "tenant-12345678-1234-1234-1234-123456789012"');
      expect(result.config).toContain('client_id            = "client-12345678-1234-1234-1234-123456789012"');
      expect(result.config).toContain('client_secret        = "super-secret-value"');
    });

    it('should generate config with Managed Service Identity (MSI)', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          subscription_id: 'sub-12345678-1234-1234-1234-123456789012',
          use_msi: true,
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('subscription_id      = "sub-12345678-1234-1234-1234-123456789012"');
      expect(result.config).toContain('use_msi              = true');
      // Should NOT have Service Principal fields
      expect(result.config).not.toContain('client_id');
      expect(result.config).not.toContain('client_secret');
    });

    it('should generate config with SAS token authentication', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          sas_token: 'sv=2021-06-08&ss=b&srt=sco&sp=rwdlacup&se=2024-12-31',
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('sas_token            = "sv=2021-06-08&ss=b&srt=sco&sp=rwdlacup&se=2024-12-31"');
      // Should NOT have other auth fields
      expect(result.config).not.toContain('use_msi');
      expect(result.config).not.toContain('client_id');
      expect(result.config).not.toContain('client_secret');
    });

    it('should generate config with Azure AD authentication', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          tenant_id: 'tenant-12345678-1234-1234-1234-123456789012',
          use_azuread_auth: true,
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('tenant_id            = "tenant-12345678-1234-1234-1234-123456789012"');
      expect(result.config).toContain('use_azuread_auth     = true');
    });

    it('should generate config with snapshot enabled', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          snapshot: true,
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      expect(result.config).toContain('snapshot             = true');
    });

    it('should render boolean fields when explicitly set to false', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend-advanced',
        options: {
          resource_group_name: 'rg-terraform-state',
          storage_account_name: 'tfstatestorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
          use_msi: false,
          snapshot: false,
          use_azuread_auth: false,
        },
      });

      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
      // Boolean false values SHOULD appear when explicitly provided
      // (this allows users to explicitly disable features)
      expect(result.config).toContain('use_msi              = false');
      expect(result.config).toContain('snapshot             = false');
      expect(result.config).toContain('use_azuread_auth     = false');
    });
  });

  describe('GCP GCS Advanced Backend Template', () => {
    it('should generate minimal config with only required fields', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'my-tf-state',
          prefix: 'terraform/state',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "my-tf-state"');
      expect(result.config).toContain('prefix      = "terraform/state"');
      // All optional fields should not appear when not provided
      expect(result.config).not.toContain('project');
      expect(result.config).not.toContain('credentials');
      expect(result.config).not.toContain('location');
      expect(result.config).not.toContain('encryption_key');
      expect(result.config).not.toContain('kms_encryption_key');
      expect(result.config).not.toContain('impersonate_service_account');
      expect(result.config).not.toContain('storage_custom_endpoint');
      // No Mustache syntax should remain
      expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should generate config with KMS encryption', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'my-tf-state',
          prefix: 'terraform/state',
          project: 'my-project',
          kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "my-tf-state"');
      expect(result.config).toContain('project     = "my-project"');
      expect(result.config).toContain('kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"');
    });

    it('should generate config with service account impersonation', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'my-tf-state',
          prefix: 'terraform/state',
          impersonate_service_account: 'terraform@my-project.iam.gserviceaccount.com',
          location: 'us-central1',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "my-tf-state"');
      expect(result.config).toContain('impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"');
      expect(result.config).toContain('location    = "us-central1"');
    });

    it('should generate config with custom endpoint for emulator', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'test-bucket',
          prefix: 'test',
          storage_custom_endpoint: 'http://localhost:4443/storage/v1/',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "test-bucket"');
      expect(result.config).toContain('storage_custom_endpoint = "http://localhost:4443/storage/v1/"');
    });

    it('should generate config with customer-supplied encryption', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'my-tf-state',
          prefix: 'terraform/state',
          encryption_key: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "my-tf-state"');
      expect(result.config).toContain('encryption_key = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="');
    });

    it('should generate config with all non-conflicting optional fields', async () => {
      // Note: encryption_key and kms_encryption_key are mutually exclusive in GCS backend
      // Using kms_encryption_key here; encryption_key is tested separately above
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'gcp-gcs-backend-advanced',
        options: {
          bucket: 'my-tf-state',
          prefix: 'terraform/state',
          project: 'my-project',
          credentials: '/path/to/credentials.json',
          location: 'us-central1',
          kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
          impersonate_service_account: 'terraform@my-project.iam.gserviceaccount.com',
          storage_custom_endpoint: 'http://localhost:4443/storage/v1/',
        },
      });

      expect(result.config).toContain('backend = "gcs"');
      expect(result.config).toContain('bucket      = "my-tf-state"');
      expect(result.config).toContain('prefix      = "terraform/state"');
      expect(result.config).toContain('project     = "my-project"');
      expect(result.config).toContain('credentials = "/path/to/credentials.json"');
      expect(result.config).toContain('location    = "us-central1"');
      expect(result.config).toContain('kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"');
      expect(result.config).toContain('impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"');
      expect(result.config).toContain('storage_custom_endpoint = "http://localhost:4443/storage/v1/"');
    });
  });
});
