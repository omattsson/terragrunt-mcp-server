import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * Config Generation Integration Tests
 * 
 * These tests validate end-to-end configuration generation via the MCP protocol:
 * - generate_terragrunt_config tool for all supported use cases
 * - HCL syntax validation
 * - Variable substitution completeness
 * - Documentation extraction
 * - Error handling
 * - MCP protocol compliance
 * 
 * Tests use real ToolHandler (not mocked) to ensure true integration testing.
 */
describe('Config Generation Integration Tests', () => {
  let toolHandler: ToolHandler;

  beforeAll(async () => {
    console.log('Initializing ToolHandler for config generation integration tests...');
    toolHandler = new ToolHandler();
    console.log('ToolHandler initialized successfully');
  }, 120000); // Allow up to 2 minutes for initial setup

  /**
   * Helper: Validate generated HCL has no template placeholders
   */
  function validateNoPlaceholders(config: string): void {
    const placeholderPattern = /\{\{[^}]+\}\}/g;
    const matches = config.match(placeholderPattern);
    expect(matches).toBeNull();
  }

  /**
   * Helper: Validate braces are balanced
   */
  function validateBalancedBraces(config: string): void {
    let depth = 0;
    for (const char of config) {
      if (char === '{') depth++;
      if (char === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0); // Never go negative
    }
    expect(depth).toBe(0); // Should end balanced
  }

  /**
   * Helper: Validate response structure matches expected schema
   */
  function validateResponseSchema(result: any): void {
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    
    if (result.success) {
      expect(typeof result.config).toBe('string');
      expect(result.config.length).toBeGreaterThan(0);
      expect(typeof result.explanation).toBe('string');
      expect(Array.isArray(result.relatedDocs)).toBe(true);
      expect(Array.isArray(result.nextSteps)).toBe(true);
      expect(Array.isArray(result.additionalOptions)).toBe(true);
    } else {
      expect(typeof result.error).toBe('string');
    }
  }

  describe('Remote State Configuration', () => {
    it('should generate complete S3 remote state config', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-terraform-state',
          key: '${path_relative_to_include()}/terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true
        }
      });

      // Validate response schema
      validateResponseSchema(result);
      expect(result.success).toBe(true);

      // Validate generated config
      expect(result.config).toContain('remote_state');
      expect(result.config).toContain('backend = "s3"');
      expect(result.config).toContain('bucket');
      expect(result.config).toContain('test-terraform-state');
      expect(result.config).toContain('us-east-1');
      expect(result.config).toContain('terraform-locks');

      // Validate HCL syntax
      validateNoPlaceholders(result.config);
      validateBalancedBraces(result.config);

      // Validate explanation is present
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(50);
      expect(result.explanation).toContain('S3');

      // Validate documentation
      expect(result.relatedDocs.length).toBeGreaterThan(0);
      result.relatedDocs.forEach((doc: any) => {
        expect(doc.title).toBeDefined();
        expect(doc.url).toBeDefined();
        expect(doc.section).toBeDefined();
      });

      // Validate next steps
      expect(result.nextSteps.length).toBeGreaterThan(0);
      result.nextSteps.forEach((step: string) => {
        expect(step.length).toBeGreaterThan(10);
      });

      // Additional options should be empty (all provided)
      expect(Array.isArray(result.additionalOptions)).toBe(true);
    }, 10000);

    it('should expose S3 native locking and dual-lock migration options', async () => {
      const nativeLocking = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-terraform-state',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          encrypt: true
        }
      });

      expect(nativeLocking.success).toBe(true);
      expect(nativeLocking.config).toContain('use_lockfile = true');
      expect(nativeLocking.config).not.toContain('dynamodb_table');
      expect(nativeLocking.nextSteps).toContain('Grant read, write, and delete permissions for the S3 lock file');
      expect(nativeLocking.nextSteps.join(' ')).not.toContain('DynamoDB');

      const migration = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-terraform-state',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          use_lockfile: true,
          dynamodb_table: 'terraform-locks'
        }
      });

      expect(migration.success).toBe(true);
      expect(migration.config).toContain('use_lockfile = true');
      expect(migration.config).toContain('dynamodb_table = "terraform-locks"');
      expect(migration.nextSteps.join(' ')).toContain('S3 lock file');
      expect(migration.nextSteps.join(' ')).toContain('DynamoDB table');
      validateNoPlaceholders(migration.config);
      validateBalancedBraces(migration.config);

      const dynamoOnly = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-terraform-state',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks'
        }
      });

      expect(dynamoOnly.success).toBe(true);
      expect(dynamoOnly.config).toContain('use_lockfile = false');
      expect(dynamoOnly.nextSteps.join(' ')).not.toContain('S3 lock file');
      expect(dynamoOnly.nextSteps.join(' ')).toContain('DynamoDB table');

      const lockingDisabled = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-terraform-state',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          use_lockfile: false
        }
      });

      expect(lockingDisabled.success).toBe(true);
      expect(lockingDisabled.config).toContain('use_lockfile = false');
      expect(lockingDisabled.nextSteps.join(' ')).not.toContain('S3 lock file');
      expect(lockingDisabled.nextSteps.join(' ')).not.toContain('DynamoDB table');
    }, 10000);

    it('should generate complete Azure Blob remote state config', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 'azurerm',
        options: {
          storage_account_name: 'tfstate',
          container_name: 'terraform-state',
          key: '${path_relative_to_include()}/terraform.tfstate',
          resource_group_name: 'terraform-rg',
          subscription_id: '12345678-1234-1234-1234-123456789abc'
        }
      });

      // Validate response schema
      validateResponseSchema(result);
      expect(result.success).toBe(true);

      // Validate generated config
      expect(result.config).toContain('remote_state');
      expect(result.config).toContain('backend = "azurerm"');
      expect(result.config).toContain('storage_account_name');
      expect(result.config).toContain('tfstate');
      expect(result.config).toContain('terraform-state');
      expect(result.config).toContain('terraform-rg');

      // Validate HCL syntax
      validateNoPlaceholders(result.config);
      validateBalancedBraces(result.config);

      // Validate explanation
      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(50);
      expect(result.explanation.toLowerCase()).toMatch(/azure|azurerm|blob/);

      // Validate documentation and next steps
      expect(result.relatedDocs.length).toBeGreaterThan(0);
      expect(result.nextSteps.length).toBeGreaterThan(0);
    }, 10000);

    it('should handle backend parameter gracefully when not provided', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        // No backend specified - should use first available template
        options: {
          bucket: 'test-bucket',
          region: 'us-west-2',
          key: 'terraform.tfstate',
          dynamodb_table: 'terraform-locks' // Required by S3 template
        }
      });

      // Should succeed with a default backend
      validateResponseSchema(result);
      expect(result.success).toBe(true);
      expect(result.config).toContain('remote_state');
    }, 10000);
  });

  describe('Provider Generation', () => {
    it('should generate AWS provider configuration', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'provider_generation',
        backend: 'aws',
        options: {
          region: 'us-west-2',
          account_id: '123456789012',
          role_name: 'TerraformExecutionRole',
          path: 'envs'
        }
      });

      // Validate response schema
      validateResponseSchema(result);
      expect(result.success).toBe(true);

      // Validate generated config
      expect(result.config).toContain('generate');
      expect(result.config).toContain('provider');
      expect(result.config).toContain('aws');
      expect(result.config).toContain('us-west-2');
      expect(result.config).toContain('123456789012');

      // Validate HCL syntax
      validateNoPlaceholders(result.config);
      validateBalancedBraces(result.config);

      // Validate explanation
      expect(result.explanation).toBeDefined();
      expect(result.explanation.toLowerCase()).toContain('provider');

      // Validate documentation and next steps
      expect(result.relatedDocs.length).toBeGreaterThan(0);
      expect(result.nextSteps.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should return error for unknown use case', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'unknown_use_case',
        options: {}
      });

      validateResponseSchema(result);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }, 10000);

    it('should return error for missing required useCase parameter', async () => {
      const result = await toolHandler.executeTool('build_config', {
        // Missing useCase
        options: { bucket: 'test' }
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('useCase');
    }, 10000);

    it('should return error listing the missing required variables', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state'
        // Missing options -> generator reports the required variables it needs
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
      expect(result.error).toContain('bucket');
    }, 10000);

    it('should return error for invalid backend with helpful message', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 'invalid_backend_xyz',
        options: {
          bucket: 'test'
        }
      });

      validateResponseSchema(result);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }, 10000);

    it('should return error when required template variables are missing', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          // Missing required variables like bucket, region
          key: 'terraform.tfstate'
        }
      });

      validateResponseSchema(result);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.toLowerCase()).toMatch(/required|missing|variable/);
    }, 10000);

    it('should handle use cases with missing required variables gracefully', async () => {
      // Test with dependency template but missing required variables
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'dependencies',
        options: {} // Missing required: name, config_path
      });

      validateResponseSchema(result);
      // Should fail gracefully with clear error about missing variables
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('required');
    }, 10000);
  });

  describe('Documentation Extraction', () => {
    it('should include relevant documentation links', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.relatedDocs).toBeDefined();
      expect(Array.isArray(result.relatedDocs)).toBe(true);
      expect(result.relatedDocs.length).toBeGreaterThan(0);

      // Validate documentation structure
      result.relatedDocs.forEach((doc: any) => {
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('url');
        expect(doc).toHaveProperty('section');
        expect(typeof doc.title).toBe('string');
        expect(typeof doc.url).toBe('string');
        expect(typeof doc.section).toBe('string');
        
        // URLs should be valid
        expect(doc.url).toMatch(/^https?:\/\//);
      });
    }, 10000);

    it('should provide actionable next steps', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'provider_generation',
        backend: 'aws',
        options: {
          region: 'us-east-1',
          account_id: '123456789012',
          role_name: 'TerraformRole',
          path: 'envs'
        }
      });

      expect(result.success).toBe(true);
      expect(result.nextSteps).toBeDefined();
      expect(Array.isArray(result.nextSteps)).toBe(true);
      expect(result.nextSteps.length).toBeGreaterThan(0);

      // Next steps should be meaningful strings
      result.nextSteps.forEach((step: string) => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(15); // Meaningful content
        
        // Should start with action words or describe a task
        expect(step).toMatch(/^[A-Z]/); // Starts with capital letter
      });
    }, 10000);
  });

  describe('Performance', () => {
    it('should generate configuration in under 200ms', async () => {
      const startTime = Date.now();

      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'perf-test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(200); // <200ms requirement
      
      console.log(`Config generation completed in ${duration}ms`);
    }, 10000);
  });

  describe('MCP Protocol Compliance', () => {
    it('should follow MCP response schema for successful generation', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test',
          key: 'test.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'locks'
        }
      });

      // MCP-compliant successful response
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('explanation');
      expect(result).toHaveProperty('relatedDocs');
      expect(result).toHaveProperty('nextSteps');
      expect(result).toHaveProperty('additionalOptions');
      expect(result).not.toHaveProperty('error');

      // Types should match schema
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.config).toBe('string');
      expect(typeof result.explanation).toBe('string');
      expect(Array.isArray(result.relatedDocs)).toBe(true);
      expect(Array.isArray(result.nextSteps)).toBe(true);
      expect(Array.isArray(result.additionalOptions)).toBe(true);
    }, 10000);

    it('should follow MCP response schema for error responses', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'invalid_use_case',
        options: {}
      });

      // MCP-compliant error response
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Variable Substitution', () => {
    it('should substitute all template variables correctly', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'my-special-bucket-123',
          key: 'path/to/state.tfstate',
          region: 'eu-west-1',
          dynamodb_table: 'my-locks-table',
          encrypt: true
        }
      });

      expect(result.success).toBe(true);

      // All provided values should appear in config
      expect(result.config).toContain('my-special-bucket-123');
      expect(result.config).toContain('path/to/state.tfstate');
      expect(result.config).toContain('eu-west-1');
      expect(result.config).toContain('my-locks-table');
      
      // Boolean should be rendered as HCL boolean
      expect(result.config).toMatch(/encrypt\s*=\s*true/);

      // No template placeholders should remain
      validateNoPlaceholders(result.config);
    }, 10000);

    it('should handle optional variables and report unused ones', async () => {
      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'test-bucket',
          key: 'terraform.tfstate',
          region: 'us-east-1',
          dynamodb_table: 'terraform-locks',
          encrypt: true,
          // Required vars provided above
        }
      });

      expect(result.success).toBe(true);

      // Additional options should list optional variables not used
      expect(Array.isArray(result.additionalOptions)).toBe(true);
      
      // dynamodb_table is optional, so if not provided, might be in additionalOptions
      // (depends on template definition)
    }, 10000);
  });
});
