/**
 * Custom Template Tests
 * Tests for custom user-provided templates functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplatesManager } from '../../src/terragrunt/templates/index.js';
import { TemplateValidator, TemplateValidationError } from '../../src/terragrunt/templates/validator.js';
import { CustomTemplateLoader } from '../../src/terragrunt/templates/loaders/custom.js';
import { FilesystemTemplateLoader } from '../../src/terragrunt/templates/loaders/filesystem.js';
import { BuiltinTemplateLoader } from '../../src/terragrunt/templates/loaders/builtin.js';
import { ConfigTemplate } from '../../src/types/templates.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Template Validator', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('Valid Templates', () => {
    it('should validate a minimal valid template', () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        category: 'backend',
        templateHcl: 'terraform { source = "test" }',
        variables: [],
        tags: [],
      };

      const result = validator.validate(template);
      expect(result).toBeDefined();
      expect(result.id).toBe('test-template');
      expect(result.source).toBe('custom');
    });

    it('should validate a template with all fields', () => {
      const template = {
        id: 'full-template',
        name: 'Full Template',
        description: 'A complete template',
        category: 'provider',
        cloudProvider: 'aws',
        templateHcl: 'provider "aws" { region = var.region }',
        variables: [
          {
            name: 'region',
            type: 'string',
            description: 'AWS region',
            required: true,
            example: 'us-east-1',
          },
        ],
        tags: ['aws', 'provider'],
        example: 'region = "us-east-1"',
      };

      const result = validator.validate(template);
      expect(result).toBeDefined();
      expect(result.cloudProvider).toBe('aws');
      expect(result.variables).toHaveLength(1);
      expect(result.tags).toEqual(['aws', 'provider']);
    });

    it('should normalize template with defaults', () => {
      const template = {
        id: '  test-id  ',
        name: '  Test Name  ',
        description: '  Test Desc  ',
        category: 'hooks',
        templateHcl: 'hook { command = "test" }',
      };

      const result = validator.validate(template);
      expect(result.id).toBe('test-id');
      expect(result.name).toBe('Test Name');
      expect(result.description).toBe('Test Desc');
      expect(result.variables).toEqual([]);
      expect(result.tags).toEqual([]);
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject template missing id', () => {
      const template = {
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Missing required field: id');
    });

    it('should reject template missing name', () => {
      const template = {
        id: 'test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Missing required field: name');
    });

    it('should reject template missing description', () => {
      const template = {
        id: 'test',
        name: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Missing required field: description');
    });

    it('should reject template missing category', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Missing required field: category');
    });

    it('should reject template missing templateHcl', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Missing required field: templateHcl');
    });

    it('should reject template with empty string fields', () => {
      const template = {
        id: '   ',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
    });
  });

  describe('Field Type Validation', () => {
    it('should reject invalid category', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'invalid-category',
        templateHcl: 'terraform {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Invalid category');
    });

    it('should reject invalid cloudProvider', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'provider',
        cloudProvider: 'invalid-provider',
        templateHcl: 'provider "test" {}',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Invalid cloudProvider');
    });

    it('should reject non-array variables', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
        variables: 'not-an-array',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('variables" must be an array');
    });

    it('should reject non-array tags', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
        tags: 'not-an-array',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('tags" must be an array');
    });
  });

  describe('HCL Validation', () => {
    it('should reject invalid HCL syntax', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform { unclosed brace',
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('Invalid HCL syntax');
    });

    it('should accept valid HCL with interpolations', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform { source = "${var.region}/module" }',
        variables: [],
      };

      const result = validator.validate(template);
      expect(result).toBeDefined();
    });
  });

  describe('Variables Validation', () => {
    it('should reject variable missing name', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
        variables: [{ type: 'string', required: true }],
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('missing required field "name"');
    });

    it('should reject variable missing type', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
        variables: [{ name: 'var1', required: true }],
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('missing required field "type"');
    });

    it('should reject variable missing required flag', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'backend',
        templateHcl: 'terraform {}',
        variables: [{ name: 'var1', type: 'string' }],
      };

      expect(() => validator.validate(template)).toThrow(TemplateValidationError);
      expect(() => validator.validate(template)).toThrow('missing required field "required"');
    });
  });
});

describe('Custom Template Loader', () => {
  it('should have priority 100', () => {
    const loader = new CustomTemplateLoader({ id: 'test', name: 'Test', description: 'Test', category: 'backend', templateHcl: 'terraform {}' });
    expect(loader.priority).toBe(100);
  });

  it('should load and validate custom template', async () => {
    const template = {
      id: 'custom-backend',
      name: 'Custom Backend',
      description: 'My custom backend',
      category: 'backend',
      templateHcl: 'remote_state { backend = "s3" }',
      variables: [],
      tags: ['s3'],
    };

    const loader = new CustomTemplateLoader(template);
    const result = await loader.loadTemplates();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('custom-backend');
    expect(result[0].source).toBe('custom');
  });

  it('should return empty array if no template provided', async () => {
    const loader = new CustomTemplateLoader(null);
    const result = await loader.loadTemplates();
    expect(result).toEqual([]);
  });

  it('should throw on invalid template', async () => {
    const invalidTemplate = {
      id: 'invalid',
      // missing required fields
    };

    const loader = new CustomTemplateLoader(invalidTemplate);
    await expect(loader.loadTemplates()).rejects.toThrow(TemplateValidationError);
  });
});

describe('Filesystem Template Loader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `terragrunt-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should have priority 50', () => {
    const loader = new FilesystemTemplateLoader(tempDir);
    expect(loader.priority).toBe(50);
  });

  it('should load templates from filesystem', async () => {
    const template1 = {
      id: 'fs-template-1',
      name: 'FS Template 1',
      description: 'Filesystem template 1',
      category: 'backend',
      templateHcl: 'terraform { source = "test1" }',
      variables: [],
      tags: [],
    };

    const template2 = {
      id: 'fs-template-2',
      name: 'FS Template 2',
      description: 'Filesystem template 2',
      category: 'provider',
      templateHcl: 'provider "aws" {}',
      variables: [],
      tags: [],
    };

    await writeFile(join(tempDir, 'template1.json'), JSON.stringify(template1));
    await writeFile(join(tempDir, 'template2.json'), JSON.stringify(template2));

    const loader = new FilesystemTemplateLoader(tempDir);
    const result = await loader.loadTemplates();

    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toContain('fs-template-1');
    expect(result.map(t => t.id)).toContain('fs-template-2');
    expect(result.every(t => t.source === 'filesystem')).toBe(true);
  });

  it('should ignore non-JSON files', async () => {
    const template = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      category: 'backend',
      templateHcl: 'terraform {}',
      variables: [],
      tags: [],
    };

    await writeFile(join(tempDir, 'template.json'), JSON.stringify(template));
    await writeFile(join(tempDir, 'not-json.txt'), 'ignored');

    const loader = new FilesystemTemplateLoader(tempDir);
    const result = await loader.loadTemplates();

    expect(result).toHaveLength(1);
  });

  it('should handle empty directory', async () => {
    const loader = new FilesystemTemplateLoader(tempDir);
    const result = await loader.loadTemplates();
    expect(result).toEqual([]);
  });

  it('should handle non-existent directory', async () => {
    const loader = new FilesystemTemplateLoader(join(tempDir, 'non-existent'));
    const result = await loader.loadTemplates();
    expect(result).toEqual([]);
  });

  it('should skip invalid template files', async () => {
    const validTemplate = {
      id: 'valid',
      name: 'Valid',
      description: 'Valid template',
      category: 'backend',
      templateHcl: 'terraform {}',
      variables: [],
      tags: [],
    };

    await writeFile(join(tempDir, 'valid.json'), JSON.stringify(validTemplate));
    await writeFile(join(tempDir, 'invalid.json'), '{"invalid": "template"}');

    const loader = new FilesystemTemplateLoader(tempDir);
    const result = await loader.loadTemplates();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });
});

describe('Builtin Template Loader', () => {
  it('should have priority 10', () => {
    const loader = new BuiltinTemplateLoader();
    expect(loader.priority).toBe(10);
  });

  it('should load builtin templates', async () => {
    const loader = new BuiltinTemplateLoader();
    const result = await loader.loadTemplates();

    expect(result.length).toBeGreaterThan(0);
    // Builtin templates can have various sources (gruntwork, azure-config, builtin, etc.)
    expect(result.every(t => ['gruntwork', 'azure-config', 'builtin'].includes(t.source))).toBe(true);
  });
});

describe('TemplatesManager with Custom Loaders', () => {
  it('should use builtin loader by default', async () => {
    const manager = new TemplatesManager();
    await manager.loadTemplates();

    const templates = await manager.getAllTemplates();
    expect(templates.length).toBeGreaterThan(0);
    // Built-in templates can have various sources (gruntwork, azure-config, builtin, etc.)
    expect(templates.every(t => ['gruntwork', 'azure-config', 'builtin'].includes(t.source))).toBe(true);
  });

  it('should support custom template loader', async () => {
    const customTemplate = {
      id: 'my-custom-template',
      name: 'My Custom Template',
      description: 'A custom template',
      category: 'backend',
      templateHcl: 'remote_state { backend = "custom" }',
      variables: [],
      tags: [],
    };

    const manager = new TemplatesManager([
      new BuiltinTemplateLoader(),
      new CustomTemplateLoader(customTemplate),
    ]);
    await manager.loadTemplates();

    const template = await manager.getTemplate('my-custom-template');
    expect(template).toBeDefined();
    expect(template?.source).toBe('custom');
  });

  it('should override builtin templates with custom ones', async () => {
    // Get a builtin template ID first
    const builtinManager = new TemplatesManager();
    await builtinManager.loadTemplates();
    const builtinTemplates = await builtinManager.getAllTemplates();
    const builtinId = builtinTemplates[0].id;

    // Create custom template with same ID
    const customTemplate = {
      id: builtinId,
      name: 'Overridden Template',
      description: 'This overrides the builtin',
      category: 'backend',
      templateHcl: 'remote_state { backend = "overridden" }',
      variables: [],
      tags: ['custom'],
    };

    const manager = new TemplatesManager([
      new BuiltinTemplateLoader(),
      new CustomTemplateLoader(customTemplate),
    ]);
    await manager.loadTemplates();

    const template = await manager.getTemplate(builtinId);
    expect(template).toBeDefined();
    expect(template?.source).toBe('custom');
    expect(template?.name).toBe('Overridden Template');
    expect(template?.tags).toContain('custom');
  });

  it('should respect loader priority (custom > filesystem > builtin)', async () => {
    const tempDir = join(tmpdir(), `terragrunt-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      const templateId = 'priority-test';

      // Filesystem template
      const fsTemplate = {
        id: templateId,
        name: 'Filesystem Template',
        description: 'From filesystem',
        category: 'backend',
        templateHcl: 'remote_state { backend = "filesystem" }',
        variables: [],
        tags: ['fs'],
      };
      await writeFile(join(tempDir, 'template.json'), JSON.stringify(fsTemplate));

      // Custom template (highest priority)
      const customTemplate = {
        id: templateId,
        name: 'Custom Template',
        description: 'From API',
        category: 'backend',
        templateHcl: 'remote_state { backend = "custom" }',
        variables: [],
        tags: ['custom'],
      };

      const manager = new TemplatesManager([
        new BuiltinTemplateLoader(),
        new FilesystemTemplateLoader(tempDir),
        new CustomTemplateLoader(customTemplate),
      ]);
      await manager.loadTemplates();

      const template = await manager.getTemplate(templateId);
      expect(template).toBeDefined();
      expect(template?.source).toBe('custom');
      expect(template?.name).toBe('Custom Template');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should load from multiple filesystem locations', async () => {
    const tempDir1 = join(tmpdir(), `terragrunt-test-1-${Date.now()}`);
    const tempDir2 = join(tmpdir(), `terragrunt-test-2-${Date.now()}`);
    await mkdir(tempDir1, { recursive: true });
    await mkdir(tempDir2, { recursive: true });

    try {
      const template1 = {
        id: 'template-1',
        name: 'Template 1',
        description: 'From dir 1',
        category: 'backend',
        templateHcl: 'terraform { source = "test1" }',
        variables: [],
        tags: [],
      };

      const template2 = {
        id: 'template-2',
        name: 'Template 2',
        description: 'From dir 2',
        category: 'backend',
        templateHcl: 'terraform { source = "test2" }',
        variables: [],
        tags: [],
      };

      await writeFile(join(tempDir1, 'template1.json'), JSON.stringify(template1));
      await writeFile(join(tempDir2, 'template2.json'), JSON.stringify(template2));

      const manager = new TemplatesManager([
        new BuiltinTemplateLoader(),
        new FilesystemTemplateLoader(tempDir1),
        new FilesystemTemplateLoader(tempDir2),
      ]);
      await manager.loadTemplates();

      const t1 = await manager.getTemplate('template-1');
      const t2 = await manager.getTemplate('template-2');

      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t1?.source).toBe('filesystem');
      expect(t2?.source).toBe('filesystem');
    } finally {
      await rm(tempDir1, { recursive: true, force: true });
      await rm(tempDir2, { recursive: true, force: true });
    }
  });
});
