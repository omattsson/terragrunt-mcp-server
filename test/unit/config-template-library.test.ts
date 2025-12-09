import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigTemplateLibrary } from '../../src/terragrunt/library.js';
import { TemplatesManager } from '../../src/terragrunt/templates/index.js';

describe('ConfigTemplateLibrary', () => {
  let library: ConfigTemplateLibrary;
  let templatesManager: TemplatesManager;

  beforeEach(() => {
    templatesManager = new TemplatesManager();
    library = new ConfigTemplateLibrary(templatesManager);
  });

  describe('constructor', () => {
    it('should create instance with provided TemplatesManager', () => {
      const lib = new ConfigTemplateLibrary(templatesManager);
      expect(lib.getTemplatesManager()).toBe(templatesManager);
    });

    it('should create instance with default TemplatesManager', () => {
      const lib = new ConfigTemplateLibrary();
      expect(lib.getTemplatesManager()).toBeInstanceOf(TemplatesManager);
    });
  });

  describe('getTemplate', () => {
    it('should get remote_state template for S3 backend', async () => {
      const template = await library.getTemplate('remote_state', 's3');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('AWS S3 Backend'); // Schema-based template has priority over builtin
      expect(template?.category).toBe('backend');
      expect(template?.cloudProvider).toBe('aws');
    });

    it('should get remote_state template for Azure backend', async () => {
      const template = await library.getTemplate('remote_state', 'azure');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Azure Blob Storage Remote State Backend'); // Matches builtin by cloudProvider
      expect(template?.category).toBe('backend');
      expect(template?.cloudProvider).toBe('azure');
    });

    it('should get remote_state template for azurerm backend', async () => {
      const template = await library.getTemplate('remote_state', 'azurerm');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Azure Blob Storage Backend'); // Schema-based template has priority
    });

    it('should get provider_generation template', async () => {
      const template = await library.getTemplate('provider_generation', 'aws');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('AWS Provider Generation');
      expect(template?.category).toBe('provider');
    });

    it('should return first template when no backend specified', async () => {
      const template = await library.getTemplate('remote_state');
      
      expect(template).toBeDefined();
      expect(template?.category).toBe('backend');
    });

    it('should return undefined for non-existent use case', async () => {
      // @ts-expect-error - Testing invalid use case
      const template = await library.getTemplate('invalid_use_case');
      
      expect(template).toBeUndefined();
    });

    it('should return undefined for non-existent backend', async () => {
      const template = await library.getTemplate('remote_state', 'nonexistent');
      
      expect(template).toBeUndefined();
    });

    it('should match backend by tag', async () => {
      const template = await library.getTemplate('remote_state', 'blob');
      
      expect(template).toBeDefined();
      expect(template?.tags).toContain('blob-storage');
    });
  });

  describe('listAvailableUseCases', () => {
    it('should list available use cases', async () => {
      const useCases = await library.listAvailableUseCases();
      
      expect(useCases).toContain('remote_state');
      expect(useCases).toContain('provider_generation');
      expect(useCases.length).toBeGreaterThan(0);
    });

    it('should not have duplicate use cases', async () => {
      const useCases = await library.listAvailableUseCases();
      const uniqueUseCases = new Set(useCases);
      
      expect(uniqueUseCases.size).toBe(useCases.length);
    });
  });

  describe('listTemplatesForUseCase', () => {
    it('should list templates for remote_state use case', async () => {
      const templates = await library.listTemplatesForUseCase('remote_state');
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.category === 'backend')).toBe(true);
    });

    it('should list templates for provider_generation use case', async () => {
      const templates = await library.listTemplatesForUseCase('provider_generation');
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.category === 'provider')).toBe(true);
    });

    it('should return templates for use case with templates', async () => {
      const templates = await library.listTemplatesForUseCase('hooks');
      
      expect(templates.length).toBeGreaterThan(0); // Now we have hook templates
      expect(templates.every(t => t.category === 'hooks')).toBe(true);
    });

    it('should return multiple templates for same use case', async () => {
      const templates = await library.listTemplatesForUseCase('remote_state');
      
      // We have AWS S3 and Azure Blob templates
      expect(templates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct HCL template', () => {
      const template = `remote_state {
  backend = "s3"
  config = {
    bucket = "{{bucket}}"
    region = "{{region}}"
  }
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty template', () => {
      const result = library.validateTemplate('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template is empty');
    });

    it('should detect missing braces', () => {
      const result = library.validateTemplate('remote_state backend = "s3"');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template missing required braces { }');
    });

    it('should detect unbalanced braces', () => {
      const template = `remote_state {
  backend = "s3"
  config = {
    bucket = "test"
  }
`;
      
      const result = library.validateTemplate(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unbalanced braces'))).toBe(true);
    });

    it('should warn about missing recognized blocks', () => {
      const template = `{
  something = "value"
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.warnings.some(w => w.includes('recognized HCL block types'))).toBe(true);
    });

    it('should warn about missing variables', () => {
      const template = `remote_state {
  backend = "s3"
  config = {
    bucket = "hardcoded"
  }
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.warnings.some(w => w.includes('variable placeholders'))).toBe(true);
    });

    it('should validate generate block with heredoc', () => {
      const template = `generate "provider" {
  path = "provider.tf"
  contents = <<EOF
provider "aws" {
  region = "{{region}}"
}
EOF
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.isValid).toBe(true);
    });

    it('should warn about EOF without heredoc', () => {
      const template = `remote_state {
  EOF
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.warnings.some(w => w.includes('EOF marker'))).toBe(true);
    });

    it('should accept templates with locals', () => {
      const template = `remote_state {
  backend = "s3"
  config = {
    bucket = local.bucket_name
  }
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.isValid).toBe(true);
    });

    it('should accept templates with var references', () => {
      const template = `remote_state {
  backend = "s3"
  config = {
    region = var.aws_region
  }
}`;
      
      const result = library.validateTemplate(template);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('getTemplatesManager', () => {
    it('should return the underlying TemplatesManager', () => {
      const manager = library.getTemplatesManager();
      
      expect(manager).toBe(templatesManager);
    });
  });

  describe('use case mapping', () => {
    it('should map remote_state to backend category', async () => {
      const templates = await library.listTemplatesForUseCase('remote_state');
      
      expect(templates.every(t => t.category === 'backend')).toBe(true);
    });

    it('should map provider_generation to provider category', async () => {
      const templates = await library.listTemplatesForUseCase('provider_generation');
      
      expect(templates.every(t => t.category === 'provider')).toBe(true);
    });
  });

  describe('backend matching logic', () => {
    it('should prioritize cloudProvider match over tag match', async () => {
      const template = await library.getTemplate('remote_state', 'aws');
      
      expect(template?.cloudProvider).toBe('aws');
    });

    it('should fallback to tag match when no cloudProvider match', async () => {
      const template = await library.getTemplate('remote_state', 'dynamodb');
      
      expect(template?.tags).toContain('dynamodb');
    });

    it('should be case-insensitive for backend matching', async () => {
      const template1 = await library.getTemplate('remote_state', 'AWS');
      const template2 = await library.getTemplate('remote_state', 'aws');
      
      expect(template1?.id).toBe(template2?.id);
    });
  });
});
