/**
 * Template Versioning Tests
 * Tests for semver validation, changelog, deprecation, and compatibility features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateValidator, TemplateValidationError } from '../../src/terragrunt/templates/validator.js';
import { ConfigTemplate } from '../../src/types/templates.js';

describe('Template Versioning', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  // Helper to create a valid base template
  const createBaseTemplate = (overrides: Partial<ConfigTemplate> = {}): any => ({
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    category: 'backend',
    templateHcl: 'remote_state { backend = "s3" }',
    variables: [],
    tags: ['test'],
    ...overrides,
  });

  describe('Semver Version Validation', () => {
    it('should accept valid semver versions', () => {
      const validVersions = [
        '1.0.0',
        '0.1.0',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-beta.2',
        '1.0.0-rc.1',
        '1.0.0+build.123',
        '1.0.0-alpha+build.456',
        '2.1.3-beta.1+20231201',
      ];

      for (const version of validVersions) {
        const template = createBaseTemplate({ version });
        const result = validator.validate(template, 'custom');
        expect(result.version).toBe(version);
      }
    });

    it('should reject invalid semver versions', () => {
      const invalidVersions = [
        '1',
        '1.0',
        'v1.0.0',
        '1.0.0.0',
        'latest',
        '1.0.0-',
        '1.0.0+',
        '01.0.0',
        '1.00.0',
        '',
        'abc',
      ];

      for (const version of invalidVersions) {
        const template = createBaseTemplate({ version });
        expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
      }
    });

    it('should allow templates without version field', () => {
      const template = createBaseTemplate();
      delete template.version;
      const result = validator.validate(template, 'custom');
      expect(result.version).toBeUndefined();
    });

    it('should reject non-string version', () => {
      const template = createBaseTemplate({ version: 123 as any });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });
  });

  describe('Changelog Validation', () => {
    it('should accept valid changelog entries', () => {
      const template = createBaseTemplate({
        version: '1.1.0',
        changelog: [
          {
            version: '1.1.0',
            date: '2024-01-15',
            changes: ['Added new feature X', 'Fixed bug Y'],
            breaking: false,
          },
          {
            version: '1.0.0',
            date: '2024-01-01',
            changes: ['Initial release'],
          },
        ],
      });

      const result = validator.validate(template, 'custom');
      expect(result.changelog).toHaveLength(2);
      expect(result.changelog![0].version).toBe('1.1.0');
    });

    it('should accept changelog with breaking changes', () => {
      const template = createBaseTemplate({
        version: '2.0.0',
        changelog: [
          {
            version: '2.0.0',
            date: '2024-02-01',
            changes: ['Major refactoring', 'Removed deprecated options'],
            breaking: true,
          },
        ],
      });

      const result = validator.validate(template, 'custom');
      expect(result.changelog![0].breaking).toBe(true);
    });

    it('should reject changelog that is not an array', () => {
      const template = createBaseTemplate({ changelog: 'not an array' as any });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry without version', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            date: '2024-01-01',
            changes: ['Something changed'],
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry with invalid version format', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: 'invalid',
            date: '2024-01-01',
            changes: ['Something changed'],
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry without date', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: '1.0.0',
            changes: ['Something changed'],
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry with invalid date format', () => {
      const invalidDates = ['01-01-2024', '2024/01/01', 'Jan 1, 2024', '2024-1-1'];
      
      for (const date of invalidDates) {
        const template = createBaseTemplate({
          changelog: [
            {
              version: '1.0.0',
              date,
              changes: ['Something changed'],
            },
          ],
        });
        expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
      }
    });

    it('should reject changelog entry without changes array', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: '1.0.0',
            date: '2024-01-01',
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry with empty changes array', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: '1.0.0',
            date: '2024-01-01',
            changes: [],
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry with non-string change', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: '1.0.0',
            date: '2024-01-01',
            changes: [123 as any],
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject changelog entry with non-boolean breaking flag', () => {
      const template = createBaseTemplate({
        changelog: [
          {
            version: '1.0.0',
            date: '2024-01-01',
            changes: ['Change'],
            breaking: 'yes' as any,
          },
        ],
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });
  });

  describe('Deprecation Validation', () => {
    it('should accept valid deprecation info', () => {
      const template = createBaseTemplate({
        version: '1.0.0',
        deprecated: {
          since: '1.0.0',
          reason: 'Replaced by newer template',
          replacement: 'new-template-id',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.deprecated).toBeDefined();
      expect(result.deprecated!.since).toBe('1.0.0');
      expect(result.deprecated!.reason).toBe('Replaced by newer template');
      expect(result.deprecated!.replacement).toBe('new-template-id');
    });

    it('should accept deprecation without replacement', () => {
      const template = createBaseTemplate({
        deprecated: {
          since: '2.0.0',
          reason: 'No longer supported',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.deprecated!.replacement).toBeUndefined();
    });

    it('should reject deprecated that is not an object', () => {
      const template = createBaseTemplate({ deprecated: 'deprecated' as any });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject deprecation without since field', () => {
      const template = createBaseTemplate({
        deprecated: {
          reason: 'Some reason',
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject deprecation with invalid since version', () => {
      const template = createBaseTemplate({
        deprecated: {
          since: 'invalid',
          reason: 'Some reason',
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject deprecation without reason field', () => {
      const template = createBaseTemplate({
        deprecated: {
          since: '1.0.0',
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject deprecation with non-string replacement', () => {
      const template = createBaseTemplate({
        deprecated: {
          since: '1.0.0',
          reason: 'Some reason',
          replacement: 123 as any,
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });
  });

  describe('Compatibility Validation', () => {
    it('should accept valid compatibility info', () => {
      const template = createBaseTemplate({
        version: '1.0.0',
        compatibility: {
          terragruntVersion: '>=0.50.0',
          terraformVersion: '>=1.0.0',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.compatibility).toBeDefined();
      expect(result.compatibility!.terragruntVersion).toBe('>=0.50.0');
      expect(result.compatibility!.terraformVersion).toBe('>=1.0.0');
    });

    it('should accept various semver constraint formats', () => {
      const validConstraints = [
        '>=1.0.0',
        '<=2.0.0',
        '>1.0.0',
        '<2.0.0',
        '=1.0.0',
        '~>0.50',
        '~>1.0',
        '>=1.0.0, <2.0.0',
        '>=1.0',
        '>=1',
      ];

      for (const constraint of validConstraints) {
        const template = createBaseTemplate({
          compatibility: {
            terragruntVersion: constraint,
          },
        });
        const result = validator.validate(template, 'custom');
        expect(result.compatibility!.terragruntVersion).toBe(constraint);
      }
    });

    it('should accept compatibility with only terragruntVersion', () => {
      const template = createBaseTemplate({
        compatibility: {
          terragruntVersion: '>=0.50.0',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.compatibility!.terragruntVersion).toBe('>=0.50.0');
      expect(result.compatibility!.terraformVersion).toBeUndefined();
    });

    it('should accept compatibility with only terraformVersion', () => {
      const template = createBaseTemplate({
        compatibility: {
          terraformVersion: '>=1.5.0',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.compatibility!.terraformVersion).toBe('>=1.5.0');
      expect(result.compatibility!.terragruntVersion).toBeUndefined();
    });

    it('should reject compatibility that is not an object', () => {
      const template = createBaseTemplate({ compatibility: 'compatible' as any });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject invalid terragruntVersion constraint', () => {
      const template = createBaseTemplate({
        compatibility: {
          terragruntVersion: 'latest',
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });

    it('should reject invalid terraformVersion constraint', () => {
      const template = createBaseTemplate({
        compatibility: {
          terraformVersion: 'v1.0.0',
        },
      });
      expect(() => validator.validate(template, 'custom')).toThrow(TemplateValidationError);
    });
  });

  describe('Deprecation Warning Utilities', () => {
    it('should identify deprecated templates', () => {
      const template: ConfigTemplate = {
        ...createBaseTemplate(),
        deprecated: {
          since: '1.0.0',
          reason: 'Replaced by newer template',
        },
      };

      expect(validator.isDeprecated(template)).toBe(true);
    });

    it('should identify non-deprecated templates', () => {
      const template: ConfigTemplate = createBaseTemplate();
      expect(validator.isDeprecated(template)).toBe(false);
    });

    it('should generate deprecation warning message', () => {
      const template: ConfigTemplate = {
        ...createBaseTemplate(),
        deprecated: {
          since: '1.0.0',
          reason: 'Replaced by newer template',
          replacement: 'new-template-id',
        },
      };

      const warning = validator.getDeprecationWarning(template);
      expect(warning).toContain('test-template');
      expect(warning).toContain('deprecated since version 1.0.0');
      expect(warning).toContain('Replaced by newer template');
      expect(warning).toContain('new-template-id');
    });

    it('should generate warning without replacement', () => {
      const template: ConfigTemplate = {
        ...createBaseTemplate(),
        deprecated: {
          since: '2.0.0',
          reason: 'No longer supported',
        },
      };

      const warning = validator.getDeprecationWarning(template);
      expect(warning).toContain('No longer supported');
      expect(warning).not.toContain('Consider using');
    });

    it('should return null for non-deprecated templates', () => {
      const template: ConfigTemplate = createBaseTemplate();
      expect(validator.getDeprecationWarning(template)).toBeNull();
    });
  });

  describe('Combined Versioning Fields', () => {
    it('should validate template with all versioning fields', () => {
      const template = createBaseTemplate({
        version: '2.0.0',
        changelog: [
          {
            version: '2.0.0',
            date: '2024-02-01',
            changes: ['Major refactoring'],
            breaking: true,
          },
          {
            version: '1.0.0',
            date: '2024-01-01',
            changes: ['Initial release'],
          },
        ],
        deprecated: {
          since: '2.0.0',
          reason: 'Deprecated in favor of new approach',
          replacement: 'new-template',
        },
        compatibility: {
          terragruntVersion: '>=0.50.0',
          terraformVersion: '>=1.5.0',
        },
      });

      const result = validator.validate(template, 'custom');
      expect(result.version).toBe('2.0.0');
      expect(result.changelog).toHaveLength(2);
      expect(result.deprecated).toBeDefined();
      expect(result.compatibility).toBeDefined();
    });
  });

  describe('Builtin Templates Versioning', () => {
    it('all builtin templates should have version field', async () => {
      // Import builtin templates dynamically
      const { backendTemplates } = await import('../../src/terragrunt/templates/categories/backends.js');
      const { configurationTemplates } = await import('../../src/terragrunt/templates/categories/configuration.js');
      const { dependencyTemplates } = await import('../../src/terragrunt/templates/categories/dependencies.js');
      const { hookTemplates } = await import('../../src/terragrunt/templates/categories/hooks.js');
      const { providerTemplates } = await import('../../src/terragrunt/templates/categories/providers.js');

      const allTemplates = [
        ...backendTemplates,
        ...configurationTemplates,
        ...dependencyTemplates,
        ...hookTemplates,
        ...providerTemplates,
      ];

      expect(allTemplates.length).toBe(12);

      for (const template of allTemplates) {
        expect(template.version).toBeDefined();
        expect(template.version).toBe('1.0.0');
      }
    });
  });
});
