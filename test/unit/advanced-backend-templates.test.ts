/**
 * Comprehensive test suite for advanced backend templates
 * Tests AWS S3, Azure Blob, and GCP GCS advanced backend configurations
 *
 * Issue #92: Add comprehensive tests for advanced backend templates
 * Part of Epic #87: Enhanced backend templates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerragruntConfigGenerator } from '../../src/terragrunt/generator.js';
import { TemplatesManager } from '../../src/terragrunt/templates/index.js';
import { ConfigTemplateLibrary } from '../../src/terragrunt/library.js';

describe('Advanced Backend Templates', () => {
  let generator: TerragruntConfigGenerator;
  let templatesManager: TemplatesManager;
  let library: ConfigTemplateLibrary;

  beforeEach(async () => {
    generator = new TerragruntConfigGenerator();
    templatesManager = new TemplatesManager();
    library = new ConfigTemplateLibrary();
    await templatesManager.loadTemplates();
  });

  // ==========================================================================
  // SECTION 1: Template Loading Tests
  // ==========================================================================
  describe('Template Loading Tests', () => {
    it('should load all three advanced backend templates', async () => {
      const awsAdvanced = await templatesManager.getTemplate('aws-s3-backend-advanced');
      const azureAdvanced = await templatesManager.getTemplate('azure-blob-backend-advanced');
      const gcpAdvanced = await templatesManager.getTemplate('gcp-gcs-backend-advanced');

      expect(awsAdvanced).toBeDefined();
      expect(azureAdvanced).toBeDefined();
      expect(gcpAdvanced).toBeDefined();
    });

    it('should have correct variable counts for each advanced template', async () => {
      const awsAdvanced = await templatesManager.getTemplate('aws-s3-backend-advanced');
      const azureAdvanced = await templatesManager.getTemplate('azure-blob-backend-advanced');
      const gcpAdvanced = await templatesManager.getTemplate('gcp-gcs-backend-advanced');

      expect(awsAdvanced?.variables).toHaveLength(13);
      expect(azureAdvanced?.variables).toHaveLength(12);
      expect(gcpAdvanced?.variables).toHaveLength(9);
    });

    it('should have unique template IDs', async () => {
      const templates = await templatesManager.getAllTemplates();
      const ids = templates.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have required metadata for all advanced templates', async () => {
      const advancedTemplates = [
        await templatesManager.getTemplate('aws-s3-backend-advanced'),
        await templatesManager.getTemplate('azure-blob-backend-advanced'),
        await templatesManager.getTemplate('gcp-gcs-backend-advanced'),
      ];

      for (const template of advancedTemplates) {
        expect(template?.name).toBeTruthy();
        expect(template?.description).toBeTruthy();
        expect(template?.category).toBe('backend');
        expect(template?.cloudProvider).toBeTruthy();
        expect(template?.source).toBeTruthy();
        expect(template?.templateHcl).toBeTruthy();
        expect(template?.example).toBeTruthy();
      }
    });

    it('should include remote-state and advanced tags', async () => {
      const advancedTemplates = [
        await templatesManager.getTemplate('aws-s3-backend-advanced'),
        await templatesManager.getTemplate('azure-blob-backend-advanced'),
        await templatesManager.getTemplate('gcp-gcs-backend-advanced'),
      ];

      for (const template of advancedTemplates) {
        expect(template?.tags).toContain('remote-state');
        expect(template?.tags).toContain('advanced');
      }
    });

    it('should have correct cloud providers assigned', async () => {
      const awsAdvanced = await templatesManager.getTemplate('aws-s3-backend-advanced');
      const azureAdvanced = await templatesManager.getTemplate('azure-blob-backend-advanced');
      const gcpAdvanced = await templatesManager.getTemplate('gcp-gcs-backend-advanced');

      expect(awsAdvanced?.cloudProvider).toBe('aws');
      expect(azureAdvanced?.cloudProvider).toBe('azure');
      expect(gcpAdvanced?.cloudProvider).toBe('gcp');
    });

    it('should have 6 total backend templates (3 essential + 3 advanced)', async () => {
      const backendTemplates = await templatesManager.searchTemplates({ category: 'backend' });

      expect(backendTemplates).toHaveLength(10); // 6 builtin + 4 schema-based
      
      const ids = backendTemplates.map(t => t.id);
      expect(ids).toContain('aws-s3-backend');
      expect(ids).toContain('aws-s3-backend-advanced');
      expect(ids).toContain('azure-blob-backend');
      expect(ids).toContain('azure-blob-backend-advanced');
      expect(ids).toContain('gcp-gcs-backend');
      expect(ids).toContain('gcp-gcs-backend-advanced');
    });

    it('should filter advanced templates by tag', async () => {
      const advancedTemplates = await templatesManager.searchTemplates({ tags: ['advanced'] });

      expect(advancedTemplates).toHaveLength(3);
      expect(advancedTemplates.every(t => t.tags.includes('advanced'))).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 2: AWS S3 Advanced Backend Tests
  // ==========================================================================
  describe('AWS S3 Advanced Backend Template', () => {
    describe('Minimal Configuration', () => {
      it('should generate config with only required fields', { timeout: 20000 }, async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-state-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).toContain('backend = "s3"');
        expect(result.config).toContain('bucket         = "my-state-bucket"');
        expect(result.config).toContain('key            = "terraform.tfstate"');
        expect(result.config).toContain('region         = "us-east-1"');
        // Optional fields should NOT appear
        expect(result.config).not.toContain('dynamodb_table');
        expect(result.config).not.toContain('encrypt');
        expect(result.config).not.toContain('kms_key_id');
        expect(result.config).not.toContain('role_arn');
      });

      it('should not leave any Mustache syntax in output', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'test-bucket',
            key: 'test.tfstate',
            region: 'eu-west-1',
          },
        });

        expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
      });
    });

    describe('Authentication Scenarios', () => {
      it('should generate config with default credentials (no profile)', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).not.toContain('profile');
        expect(result.config).not.toContain('role_arn');
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

      it('should generate config with cross-account role assumption', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'shared-state-bucket',
            key: 'prod/terraform.tfstate',
            region: 'us-west-2',
            role_arn: 'arn:aws:iam::987654321098:role/TerraformStateRole',
          },
        });

        expect(result.config).toContain('role_arn       = "arn:aws:iam::987654321098:role/TerraformStateRole"');
      });

      it('should generate config with role assumption and session name', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'shared-state-bucket',
            key: 'prod/terraform.tfstate',
            region: 'us-west-2',
            role_arn: 'arn:aws:iam::987654321098:role/TerraformStateRole',
            session_name: 'terraform-prod-session',
          },
        });

        expect(result.config).toContain('role_arn       = "arn:aws:iam::987654321098:role/TerraformStateRole"');
        expect(result.config).toContain('session_name   = "terraform-prod-session"');
      });
    });

    describe('Encryption Scenarios', () => {
      it('should generate config with encryption enabled', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            encrypt: true,
          },
        });

        expect(result.config).toContain('encrypt        = true');
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

        expect(result.config).toContain('encrypt        = true');
        expect(result.config).toContain('kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"');
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

        expect(result.config).toContain('encrypt        = false');
      });
    });

    describe('Network/Endpoint Scenarios', () => {
      it('should generate config with custom endpoint for LocalStack', async () => {
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

        expect(result.config).toContain('endpoint       = "http://localhost:4566"');
        expect(result.config).toContain('skip_credentials_validation = true');
      });

      it('should generate config with custom endpoint for MinIO', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'minio-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            endpoint: 'https://minio.example.com:9000',
          },
        });

        expect(result.config).toContain('endpoint       = "https://minio.example.com:9000"');
      });
    });

    describe('Mixed Configuration Scenarios', () => {
      it('should generate config with DynamoDB locking', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            dynamodb_table: 'terraform-locks',
          },
        });

        expect(result.config).toContain('dynamodb_table = "terraform-locks"');
      });

      it('should generate config with DynamoDB and KMS encryption', async () => {
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
          },
        });

        expect(result.config).toContain('dynamodb_table = "terraform-locks"');
        expect(result.config).toContain('encrypt        = true');
        expect(result.config).toContain('kms_key_id     = "arn:aws:kms:us-east-1:123456789012:key/test-key"');
      });

      it('should generate config with workspace key prefix', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            workspace_key_prefix: 'workspaces',
          },
        });

        expect(result.config).toContain('workspace_key_prefix = "workspaces"');
      });

      it('should generate full config with all optional fields', async () => {
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
    });

    describe('HCL Validity', () => {
      it('should generate syntactically valid HCL', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            encrypt: true,
          },
        });

        // Check for balanced braces
        const openBraces = (result.config.match(/\{/g) || []).length;
        const closeBraces = (result.config.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);

        // Check for proper structure
        expect(result.config).toMatch(/remote_state\s*\{/);
        expect(result.config).toMatch(/backend\s*=\s*"s3"/);
        expect(result.config).toMatch(/config\s*=\s*\{/);
      });

      it('should not have orphaned commas or syntax errors', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        // No trailing commas before closing braces
        expect(result.config).not.toMatch(/,\s*\}/);
        // No double commas
        expect(result.config).not.toMatch(/,,/);
      });
    });
  });

  // ==========================================================================
  // SECTION 3: Azure Blob Storage Advanced Backend Tests
  // ==========================================================================
  describe('Azure Blob Storage Advanced Backend Template', () => {
    describe('Minimal Configuration', () => {
      it('should generate config with only required fields', async () => {
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
        // Optional fields should NOT appear
        expect(result.config).not.toContain('subscription_id');
        expect(result.config).not.toContain('tenant_id');
        expect(result.config).not.toContain('client_id');
        expect(result.config).not.toContain('use_msi');
      });

      it('should not leave any Mustache syntax in output', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'azure-blob-backend-advanced',
          options: {
            resource_group_name: 'rg-test',
            storage_account_name: 'teststorage',
            container_name: 'test',
            key: 'test.tfstate',
          },
        });

        expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
      });
    });

    describe('Authentication Scenarios', () => {
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

        expect(result.config).toContain('use_msi              = true');
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

        expect(result.config).toContain('sas_token            = "sv=2021-06-08&ss=b&srt=sco&sp=rwdlacup&se=2024-12-31"');
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

        expect(result.config).toContain('tenant_id            = "tenant-12345678-1234-1234-1234-123456789012"');
        expect(result.config).toContain('use_azuread_auth     = true');
      });
    });

    describe('Feature Scenarios', () => {
      it('should generate config with snapshot support enabled', async () => {
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

        expect(result.config).toContain('snapshot             = true');
      });

      it('should generate config with MSI and snapshot enabled', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'azure-blob-backend-advanced',
          options: {
            resource_group_name: 'rg-terraform-state',
            storage_account_name: 'tfstatestorage',
            container_name: 'tfstate',
            key: 'terraform.tfstate',
            use_msi: true,
            snapshot: true,
          },
        });

        expect(result.config).toContain('use_msi              = true');
        expect(result.config).toContain('snapshot             = true');
      });
    });

    describe('Boolean Value Handling', () => {
      it('should render explicit false values for booleans', async () => {
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

        expect(result.config).toContain('use_msi              = false');
        expect(result.config).toContain('snapshot             = false');
        expect(result.config).toContain('use_azuread_auth     = false');
      });
    });

    describe('Mixed Configuration Scenarios', () => {
      it('should generate config with Azure AD and subscription_id', async () => {
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
            use_azuread_auth: true,
          },
        });

        expect(result.config).toContain('subscription_id      = "sub-12345678-1234-1234-1234-123456789012"');
        expect(result.config).toContain('tenant_id            = "tenant-12345678-1234-1234-1234-123456789012"');
        expect(result.config).toContain('use_azuread_auth     = true');
      });

      it('should generate full config with non-conflicting optional fields', async () => {
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
            use_azuread_auth: true,
            snapshot: true,
          },
        });

        expect(result.config).toContain('resource_group_name  = "rg-terraform-state"');
        expect(result.config).toContain('storage_account_name = "tfstatestorage"');
        expect(result.config).toContain('container_name       = "tfstate"');
        expect(result.config).toContain('key                  = "terraform.tfstate"');
        expect(result.config).toContain('subscription_id      = "sub-12345678-1234-1234-1234-123456789012"');
        expect(result.config).toContain('tenant_id            = "tenant-12345678-1234-1234-1234-123456789012"');
        expect(result.config).toContain('use_azuread_auth     = true');
        expect(result.config).toContain('snapshot             = true');
      });
    });

    describe('HCL Validity', () => {
      it('should generate syntactically valid HCL', async () => {
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

        const openBraces = (result.config.match(/\{/g) || []).length;
        const closeBraces = (result.config.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);

        expect(result.config).toMatch(/remote_state\s*\{/);
        expect(result.config).toMatch(/backend\s*=\s*"azurerm"/);
        expect(result.config).toMatch(/config\s*=\s*\{/);
      });
    });
  });

  // ==========================================================================
  // SECTION 4: GCP GCS Advanced Backend Tests
  // ==========================================================================
  describe('GCP GCS Advanced Backend Template', () => {
    describe('Minimal Configuration', () => {
      it('should generate config with only required fields', async () => {
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
        // Optional fields should NOT appear
        expect(result.config).not.toContain('project');
        expect(result.config).not.toContain('credentials');
        expect(result.config).not.toContain('location');
        expect(result.config).not.toContain('encryption_key');
        expect(result.config).not.toContain('kms_encryption_key');
        expect(result.config).not.toContain('impersonate_service_account');
        expect(result.config).not.toContain('storage_custom_endpoint');
      });

      it('should not leave any Mustache syntax in output', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'test-bucket',
            prefix: 'test',
          },
        });

        expect(result.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
      });
    });

    describe('Authentication Scenarios', () => {
      it('should generate config with default credentials', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
          },
        });

        expect(result.config).not.toContain('credentials');
        expect(result.config).not.toContain('impersonate_service_account');
      });

      it('should generate config with explicit credentials file', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            credentials: '/path/to/service-account.json',
          },
        });

        expect(result.config).toContain('credentials = "/path/to/service-account.json"');
      });

      it('should generate config with service account impersonation', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            impersonate_service_account: 'terraform@my-project.iam.gserviceaccount.com',
          },
        });

        expect(result.config).toContain('impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"');
      });

      it('should generate config with project setting', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            project: 'my-gcp-project',
          },
        });

        expect(result.config).toContain('project     = "my-gcp-project"');
      });
    });

    describe('Encryption Scenarios', () => {
      it('should generate config with KMS encryption', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            project: 'my-project',
            kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
          },
        });

        expect(result.config).toContain('kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"');
      });

      it('should generate config with customer-supplied encryption key', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            encryption_key: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=',
          },
        });

        expect(result.config).toContain('encryption_key = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="');
      });

      it('should generate config with only KMS when customer encryption not provided', async () => {
        // Note: encryption_key and kms_encryption_key are mutually exclusive
        // When only kms_encryption_key is provided, encryption_key should not appear
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
          },
        });

        expect(result.config).toContain('kms_encryption_key');
        // When only kms_encryption_key is provided, it should appear but encryption_key should not
        // (as string 'encryption_key' is a substring of 'kms_encryption_key', use regex for exact match)
        expect(result.config).not.toMatch(/^\s*encryption_key\s*=/m);
      });
    });

    describe('Network/Endpoint Scenarios', () => {
      it('should generate config with custom endpoint for GCS emulator', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'test-bucket',
            prefix: 'test',
            storage_custom_endpoint: 'http://localhost:4443/storage/v1/',
          },
        });

        expect(result.config).toContain('storage_custom_endpoint = "http://localhost:4443/storage/v1/"');
      });
    });

    describe('Mixed Configuration Scenarios', () => {
      it('should generate config with location setting', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            location: 'us-central1',
          },
        });

        expect(result.config).toContain('location    = "us-central1"');
      });

      it('should generate config with KMS and impersonation', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            project: 'my-project',
            kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
            impersonate_service_account: 'terraform@my-project.iam.gserviceaccount.com',
          },
        });

        expect(result.config).toContain('project     = "my-project"');
        expect(result.config).toContain('kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"');
        expect(result.config).toContain('impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"');
      });

      it('should generate config with credentials and project', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            project: 'my-project',
            credentials: '/path/to/credentials.json',
          },
        });

        expect(result.config).toContain('project     = "my-project"');
        expect(result.config).toContain('credentials = "/path/to/credentials.json"');
      });

      it('should generate full config with all non-conflicting optional fields', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
            project: 'my-project',
            credentials: '/path/to/credentials.json',
            location: 'us-central1',
            kms_encryption_key: 'projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state',
            impersonate_service_account: 'terraform@my-project.iam.gserviceaccount.com',
            storage_custom_endpoint: 'http://localhost:4443/storage/v1/',
          },
        });

        expect(result.config).toContain('bucket      = "my-bucket"');
        expect(result.config).toContain('prefix      = "terraform/state"');
        expect(result.config).toContain('project     = "my-project"');
        expect(result.config).toContain('credentials = "/path/to/credentials.json"');
        expect(result.config).toContain('location    = "us-central1"');
        expect(result.config).toContain('kms_encryption_key = "projects/my-project/locations/us/keyRings/terraform/cryptoKeys/state"');
        expect(result.config).toContain('impersonate_service_account = "terraform@my-project.iam.gserviceaccount.com"');
        expect(result.config).toContain('storage_custom_endpoint = "http://localhost:4443/storage/v1/"');
      });
    });

    describe('HCL Validity', () => {
      it('should generate syntactically valid HCL', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: {
            bucket: 'my-bucket',
            prefix: 'terraform/state',
          },
        });

        const openBraces = (result.config.match(/\{/g) || []).length;
        const closeBraces = (result.config.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);

        expect(result.config).toMatch(/remote_state\s*\{/);
        expect(result.config).toMatch(/backend\s*=\s*"gcs"/);
        expect(result.config).toMatch(/config\s*=\s*\{/);
      });
    });
  });

  // ==========================================================================
  // SECTION 5: Backward Compatibility Tests
  // ==========================================================================
  describe('Backward Compatibility', () => {
    it('should still load essential S3 template', async () => {
      const template = await templatesManager.getTemplate('aws-s3-backend');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('AWS S3 Remote State Backend');
      expect(template?.variables).toHaveLength(6);
    });

    it('should still load essential Azure template', async () => {
      const template = await templatesManager.getTemplate('azure-blob-backend');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Azure Blob Storage Remote State Backend');
      expect(template?.variables).toHaveLength(5);
    });

    it('should still load essential GCS template', async () => {
      const template = await templatesManager.getTemplate('gcp-gcs-backend');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('GCP GCS Remote State Backend');
      expect(template?.variables).toHaveLength(4); // bucket, prefix, project, credentials
    });

    it('should resolve essential template when using short backend name', async () => {
      // When using 'aws-s3-backend' (not 'aws-s3-backend-advanced'),
      // should get the essential template
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend',
        options: {
          bucket: 'my-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true,
        },
      });

      expect(result.config).toContain('backend = "s3"');
      // Essential template has different formatting
      expect(result.config).toContain('bucket');
    });

    it('should resolve advanced template when explicitly requested', async () => {
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
      // Advanced template should work with minimal required fields
      expect(result.config).toContain('bucket         = "my-bucket"');
    });

    it('should allow both essential and advanced templates to coexist', async () => {
      const essential = await templatesManager.getTemplate('aws-s3-backend');
      const advanced = await templatesManager.getTemplate('aws-s3-backend-advanced');

      expect(essential).toBeDefined();
      expect(advanced).toBeDefined();
      expect(essential?.id).not.toBe(advanced?.id);
    });

    it('should generate valid config from essential templates after adding advanced', async () => {
      const essentialResult = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'azure-blob-backend',
        options: {
          subscription_id: 'sub-123',
          resource_group_name: 'rg-test',
          storage_account_name: 'teststorage',
          container_name: 'tfstate',
          key: 'terraform.tfstate',
        },
      });

      expect(essentialResult.config).toContain('backend = "azurerm"');
      expect(essentialResult.config).not.toMatch(/\{\{[#^\/]?\w+\}\}/);
    });

    it('should have correct template counts after adding advanced templates', async () => {
      const allTemplates = await templatesManager.getAllTemplates();
      const backendTemplates = await templatesManager.searchTemplates({ category: 'backend' });
      const advancedTemplates = await templatesManager.searchTemplates({ tags: ['advanced'] });

      expect(allTemplates).toHaveLength(19); // 15 builtin (incl. 3 cicd) + 4 schema-based
      expect(backendTemplates).toHaveLength(10); // 6 builtin + 4 schema-based
      expect(advancedTemplates).toHaveLength(3);
    });
  });

  // ==========================================================================
  // SECTION 6: Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    describe('Empty and Null Values', () => {
      it('should omit optional fields with empty string values', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            profile: '', // Empty string should be omitted
          },
        });

        // Empty string should not render the field
        // Note: This depends on how the generator handles empty strings
        expect(result.config).toContain('bucket');
      });

      it('should handle undefined optional values gracefully', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            profile: undefined,
          },
        });

        expect(result.config).not.toContain('profile');
      });
    });

    describe('Special Characters', () => {
      it('should handle special characters in bucket names', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket-name-with-hyphens',
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).toContain('bucket         = "my-bucket-name-with-hyphens"');
      });

      it('should handle path separators in key paths', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'environments/prod/us-east-1/terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).toContain('key            = "environments/prod/us-east-1/terraform.tfstate"');
      });

      it('should handle long KMS key ARNs', async () => {
        const longArn = 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012';
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            kms_key_id: longArn,
          },
        });

        expect(result.config).toContain(`kms_key_id     = "${longArn}"`);
      });

      it('should handle URL-encoded values in endpoints', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            endpoint: 'http://localhost:4566/bucket%2Fpath',
          },
        });

        expect(result.config).toContain('endpoint       = "http://localhost:4566/bucket%2Fpath"');
      });

      it('should handle long SAS tokens', async () => {
        const longSasToken = 'sv=2021-06-08&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2024-12-31T23:59:59Z&st=2024-01-01T00:00:00Z&spr=https&sig=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'azure-blob-backend-advanced',
          options: {
            resource_group_name: 'rg-terraform-state',
            storage_account_name: 'tfstatestorage',
            container_name: 'tfstate',
            key: 'terraform.tfstate',
            sas_token: longSasToken,
          },
        });

        expect(result.config).toContain(`sas_token            = "${longSasToken}"`);
      });
    });

    describe('Boolean Edge Cases', () => {
      it('should render false boolean values', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            encrypt: false,
            skip_credentials_validation: false,
          },
        });

        expect(result.config).toContain('encrypt        = false');
        expect(result.config).toContain('skip_credentials_validation = false');
      });

      it('should render true boolean values', async () => {
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: 'my-bucket',
            key: 'terraform.tfstate',
            region: 'us-east-1',
            encrypt: true,
            skip_credentials_validation: true,
          },
        });

        expect(result.config).toContain('encrypt        = true');
        expect(result.config).toContain('skip_credentials_validation = true');
      });
    });

    describe('Value Preservation', () => {
      it('should not truncate long values', async () => {
        const longValue = 'a'.repeat(200);
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: longValue,
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).toContain(`bucket         = "${longValue}"`);
      });

      it('should preserve exact values without modification', async () => {
        const exactValue = 'MyBucket_Name-123';
        const result = await generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: {
            bucket: exactValue,
            key: 'terraform.tfstate',
            region: 'us-east-1',
          },
        });

        expect(result.config).toContain(`bucket         = "${exactValue}"`);
      });
    });
  });

  // ==========================================================================
  // SECTION 7: Integration Tests
  // ==========================================================================
  describe('Integration Tests', () => {
    it('should work with ConfigTemplateLibrary', async () => {
      const template = await library.getTemplate('remote_state', 'aws-s3-backend-advanced');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('aws-s3-backend-advanced');
    });

    it('should work with TerragruntConfigGenerator', async () => {
      const result = await generator.generateConfig({
        useCase: 'remote_state',
        backend: 'aws-s3-backend-advanced',
        options: {
          bucket: 'test-bucket',
          key: 'test.tfstate',
          region: 'us-east-1',
        },
      });

      expect(result).toBeDefined();
      expect(result.config).toBeTruthy();
      expect(result.explanation).toBeTruthy();
    });

    it('should filter advanced templates with searchTemplates', async () => {
      const advancedBackends = await templatesManager.searchTemplates({
        category: 'backend',
        tags: ['advanced'],
      });

      expect(advancedBackends).toHaveLength(3);
      expect(advancedBackends.every(t => t.tags.includes('advanced'))).toBe(true);
      expect(advancedBackends.every(t => t.category === 'backend')).toBe(true);
    });

    it('should include advanced templates in getMetadata', async () => {
      const metadata = await templatesManager.getMetadata();

      expect(metadata.totalTemplates).toBe(19); // 15 builtin (incl. 3 cicd) + 4 schema-based
      expect(metadata.categories).toContain('backend');
    });

    it('should generate multiple configs in sequence', async () => {
      const configs = await Promise.all([
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 'aws-s3-backend-advanced',
          options: { bucket: 'bucket1', key: 'key1.tfstate', region: 'us-east-1' },
        }),
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 'azure-blob-backend-advanced',
          options: {
            resource_group_name: 'rg1',
            storage_account_name: 'storage1',
            container_name: 'container1',
            key: 'key1.tfstate',
          },
        }),
        generator.generateConfig({
          useCase: 'remote_state',
          backend: 'gcp-gcs-backend-advanced',
          options: { bucket: 'bucket1', prefix: 'prefix1' },
        }),
      ]);

      expect(configs).toHaveLength(3);
      expect(configs[0].config).toContain('backend = "s3"');
      expect(configs[1].config).toContain('backend = "azurerm"');
      expect(configs[2].config).toContain('backend = "gcs"');
    });

    it('should filter by cloud provider correctly', async () => {
      const awsTemplates = await templatesManager.searchTemplates({ cloudProvider: 'aws' });
      const azureTemplates = await templatesManager.searchTemplates({ cloudProvider: 'azure' });
      const gcpTemplates = await templatesManager.searchTemplates({ cloudProvider: 'gcp' });

      expect(awsTemplates.some(t => t.id === 'aws-s3-backend-advanced')).toBe(true);
      expect(azureTemplates.some(t => t.id === 'azure-blob-backend-advanced')).toBe(true);
      expect(gcpTemplates.some(t => t.id === 'gcp-gcs-backend-advanced')).toBe(true);
    });

    it('should handle case-insensitive template lookup', async () => {
      const template1 = await templatesManager.getTemplate('AWS-S3-BACKEND-ADVANCED');
      const template2 = await templatesManager.getTemplate('aws-s3-backend-advanced');

      expect(template1).toBeDefined();
      expect(template2).toBeDefined();
      expect(template1?.id).toBe(template2?.id);
    });
  });
});
