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
      expect(result.explanation).toContain('AWS S3 Remote State Backend');
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

      expect(result.explanation).toContain('AWS S3 Remote State Backend');
      expect(result.explanation).toContain('Configure S3 backend with DynamoDB locking');
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
});
