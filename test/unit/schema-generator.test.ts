/**
 * Unit tests for SchemaToTemplateGenerator
 * Tests Issue #143: Schema-to-Template Generator
 */

import { describe, it, expect } from 'vitest';
import { SchemaToTemplateGenerator } from '../../src/terragrunt/schema-generator.js';
import { BackendSchema, BackendAttribute } from '../../src/types/backend-schema.js';
import { ConfigTemplate } from '../../src/types/templates.js';

// Helper to create a minimal valid schema
function createTestSchema(overrides: Partial<BackendSchema> = {}): BackendSchema {
  return {
    id: 'test-backend',
    name: 'Test Backend',
    description: 'Test backend for unit testing',
    provider: 'aws',
    backend: 'test',
    terraformDocsUrl: 'https://example.com/docs',
    attributes: [
      {
        name: 'bucket',
        type: 'string',
        required: true,
        description: 'Test bucket',
      },
    ],
    ...overrides,
  };
}

// Helper to create a test attribute
function createTestAttribute(overrides: Partial<BackendAttribute> = {}): BackendAttribute {
  return {
    name: 'test_attr',
    type: 'string',
    required: false,
    description: 'Test attribute',
    ...overrides,
  };
}

describe('SchemaToTemplateGenerator', () => {
  const generator = new SchemaToTemplateGenerator();

  describe('generateTemplate', () => {
    it('should generate a complete ConfigTemplate from a schema', () => {
      const schema = createTestSchema();
      const template = generator.generateTemplate(schema);

      expect(template).toBeDefined();
      expect(template.id).toBe('test-backend');
      expect(template.name).toBe('Test Backend');
      expect(template.description).toBe('Test backend for unit testing');
      expect(template.category).toBe('backend');
      expect(template.cloudProvider).toBe('aws');
      expect(template.source).toBe('builtin');
      expect(template.version).toBe('1.0.0');
      expect(template.tags).toContain('remote-state');
      expect(template.tags).toContain('test');
      expect(template.tags).toContain('aws');
      expect(template.tags).toContain('generated');
      expect(template.variables).toHaveLength(1);
      expect(template.templateHcl).toContain('remote_state');
      expect(template.example).toBeDefined();
    });

    it('should use schema version if provided', () => {
      const schema = createTestSchema({ version: '2.5.3' });
      const template = generator.generateTemplate(schema);

      expect(template.version).toBe('2.5.3');
    });

    it('should apply custom template ID prefix', () => {
      const schema = createTestSchema();
      const template = generator.generateTemplate(schema, { templateIdPrefix: 'custom' });

      expect(template.id).toBe('custom-test-backend');
    });

    it('should include additional tags', () => {
      const schema = createTestSchema();
      const template = generator.generateTemplate(schema, {
        additionalTags: ['custom-tag', 'special'],
      });

      expect(template.tags).toContain('custom-tag');
      expect(template.tags).toContain('special');
    });

    it('should handle all cloud providers', () => {
      const providers: Array<{ input: string; expected: 'aws' | 'azure' | 'gcp' | 'multi' | undefined }> = [
        { input: 'aws', expected: 'aws' },
        { input: 'azure', expected: 'azure' },
        { input: 'gcp', expected: 'gcp' },
        { input: 'multi', expected: 'multi' },
        { input: 'other', expected: undefined },
      ];

      for (const { input, expected } of providers) {
        const schema = createTestSchema({ provider: input });
        const template = generator.generateTemplate(schema);
        expect(template.cloudProvider).toBe(expected);
      }
    });
  });

  describe('generateVariables', () => {
    it('should convert required attributes to variables', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({ name: 'bucket', required: true }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('bucket');
      expect(variables[0].required).toBe(true);
    });

    it('should convert optional attributes to variables', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({ name: 'optional', required: false }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('optional');
      expect(variables[0].required).toBe(false);
    });

    it('should preserve all attribute metadata', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          name: 'test',
          type: 'string',
          required: true,
          description: 'Test description',
          example: 'test-example',
          defaultValue: 'default',
          sensitive: true,
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].name).toBe('test');
      expect(variables[0].type).toBe('string');
      expect(variables[0].required).toBe(true);
      expect(variables[0].description).toBe('Test description');
      expect(variables[0].example).toBe('test-example');
      expect(variables[0].defaultValue).toBe('default');
      expect(variables[0].sensitive).toBe(true);
    });

    it('should handle numeric examples', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          name: 'port',
          type: 'number',
          example: 443,
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].example).toBe('443');
    });

    it('should handle boolean examples', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          name: 'encrypt',
          type: 'boolean',
          example: true,
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].example).toBe('true');
    });

    it('should add deprecation warnings to descriptions', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          deprecated: true,
          deprecatedMessage: 'Use new_attr instead',
        }),
      ];

      const variables = generator.generateVariables(attributes, { includeDeprecated: true });

      expect(variables[0].description).toContain('[DEPRECATED: Use new_attr instead]');
    });

    it('should add valid values to descriptions', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          validValues: ['a', 'b', 'c'],
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].description).toContain('Valid values: a, b, c');
    });

    it('should add pattern info to descriptions', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          pattern: '^[a-z]+$',
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].description).toContain('Pattern: ^[a-z]+$');
    });

    it('should add conflict info to descriptions', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          conflictsWith: ['other_attr'],
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].description).toContain('Conflicts with: other_attr');
    });

    it('should add dependency info to descriptions', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          requiredWith: ['required_attr'],
        }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].description).toContain('Requires: required_attr');
    });

    it('should exclude deprecated attributes by default', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({ name: 'current', deprecated: false }),
        createTestAttribute({ name: 'old', deprecated: true }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables).toHaveLength(1);
      expect(variables[0].name).toBe('current');
    });

    it('should include deprecated attributes when requested', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({ name: 'current', deprecated: false }),
        createTestAttribute({ name: 'old', deprecated: true }),
      ];

      const variables = generator.generateVariables(attributes, { includeDeprecated: true });

      expect(variables).toHaveLength(2);
      expect(variables.map(v => v.name)).toContain('old');
    });

    it('should handle all attribute types', () => {
      const types: Array<'string' | 'number' | 'boolean' | 'list' | 'map' | 'object'> = [
        'string', 'number', 'boolean', 'list', 'map', 'object',
      ];

      for (const type of types) {
        const attributes: BackendAttribute[] = [
          createTestAttribute({ type }),
        ];

        const variables = generator.generateVariables(attributes);

        expect(variables[0].type).toBe(type);
      }
    });
  });

  describe('generateHcl', () => {
    it('should generate basic remote_state block', () => {
      const schema = createTestSchema();
      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('remote_state {');
      expect(hcl).toContain('backend = "test"');
      expect(hcl).toContain('config = {');
      expect(hcl).toContain('}');
    });

    it('should generate required attributes without conditionals', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'bucket', type: 'string', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('bucket = "{{bucket}}"');
      expect(hcl).not.toContain('{{#bucket}}');
    });

    it('should generate optional attributes with Mustache conditionals', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'optional', type: 'string', required: false }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('{{#optional}}');
      expect(hcl).toContain('optional = "{{optional}}"');
      expect(hcl).toContain('{{/optional}}');
    });

    it('should format string attributes with quotes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'region', type: 'string', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('region = "{{region}}"');
    });

    it('should format boolean attributes without quotes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'encrypt', type: 'boolean', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('encrypt = {{encrypt}}');
      expect(hcl).not.toContain('"{{encrypt}}"');
    });

    it('should format number attributes without quotes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'port', type: 'number', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('port = {{port}}');
      expect(hcl).not.toContain('"{{port}}"');
    });

    it('should handle mixed required and optional attributes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'required1', required: true }),
          createTestAttribute({ name: 'optional1', required: false }),
          createTestAttribute({ name: 'required2', required: true }),
          createTestAttribute({ name: 'optional2', required: false }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      // Required attributes should not have conditionals
      expect(hcl).toContain('required1 = "{{required1}}"');
      expect(hcl).toContain('required2 = "{{required2}}"');
      expect(hcl).not.toContain('{{#required1}}');
      expect(hcl).not.toContain('{{#required2}}');

      // Optional attributes should have conditionals
      expect(hcl).toContain('{{#optional1}}');
      expect(hcl).toContain('{{#optional2}}');
    });

    it('should maintain proper indentation', () => {
      const schema = createTestSchema();
      const hcl = generator.generateHcl(schema);

      const lines = hcl.split('\n');
      expect(lines[0]).toBe('remote_state {');
      expect(lines[1]).toMatch(/^  backend/); // 2 spaces
      expect(lines[2]).toMatch(/^  config/); // 2 spaces
      expect(lines[3]).toMatch(/^    \w+/); // 4 spaces for config content
    });

    it('should exclude deprecated attributes by default', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'current', deprecated: false }),
          createTestAttribute({ name: 'old', deprecated: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('current');
      expect(hcl).not.toContain('old');
    });

    it('should include deprecated attributes when requested', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'current', deprecated: false }),
          createTestAttribute({ name: 'old', deprecated: true }),
        ],
      });

      const hcl = generator.generateHcl(schema, { includeDeprecated: true });

      expect(hcl).toContain('current');
      expect(hcl).toContain('old');
    });

    it('should handle list type attributes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'items', type: 'list', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('items = {{items}}');
    });

    it('should handle map type attributes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'tags', type: 'map', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('tags = {{tags}}');
    });
  });

  describe('generateExample', () => {
    it('should generate a complete example configuration', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({
            name: 'bucket',
            type: 'string',
            required: true,
            example: 'my-bucket',
          }),
        ],
      });

      const template = generator.generateTemplate(schema);

      expect(template.example).toBeDefined();
      expect(template.example).toContain('remote_state {');
      expect(template.example).toContain('backend = "test"');
      expect(template.example).toContain('bucket = "my-bucket"');
    });

    it('should use examples from attributes', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({
            name: 'region',
            type: 'string',
            required: true,
            example: 'us-east-1',
          }),
        ],
      });

      const template = generator.generateTemplate(schema);

      expect(template.example).toContain('region = "us-east-1"');
    });

    it('should use default values when no example provided', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({
            name: 'encrypt',
            type: 'boolean',
            required: true,
            defaultValue: true,
          }),
        ],
      });

      const template = generator.generateTemplate(schema);

      expect(template.example).toContain('encrypt = true');
    });

    it('should show required variables in example', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'required1', required: true }),
          createTestAttribute({ name: 'required2', required: true }),
          createTestAttribute({ name: 'optional', required: false }),
        ],
      });

      const template = generator.generateTemplate(schema);

      expect(template.example).toContain('required1');
      expect(template.example).toContain('required2');
    });

    it('should show some optional variables in example', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'required', required: true }),
          createTestAttribute({ name: 'optional1', required: false, example: 'opt1' }),
          createTestAttribute({ name: 'optional2', required: false, example: 'opt2' }),
        ],
      });

      const template = generator.generateTemplate(schema);

      // Should include at least one optional
      const hasOptional1 = template.example?.includes('optional1');
      const hasOptional2 = template.example?.includes('optional2');
      expect(hasOptional1 || hasOptional2).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty attributes array', () => {
      const schema = createTestSchema({ attributes: [] });
      const template = generator.generateTemplate(schema);

      expect(template.variables).toHaveLength(0);
      expect(template.templateHcl).toContain('remote_state');
      expect(template.templateHcl).toContain('config = {');
    });

    it('should handle attributes with special characters in names', () => {
      const schema = createTestSchema({
        attributes: [
          createTestAttribute({ name: 'special_attr', required: true }),
        ],
      });

      const hcl = generator.generateHcl(schema);

      expect(hcl).toContain('special_attr = "{{special_attr}}"');
    });

    it('should handle very long descriptions', () => {
      const longDesc = 'A'.repeat(1000);
      const attributes: BackendAttribute[] = [
        createTestAttribute({ description: longDesc }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].description).toContain(longDesc);
    });

    it('should handle attributes with null default values', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({ defaultValue: null }),
      ];

      const variables = generator.generateVariables(attributes);

      expect(variables[0].defaultValue).toBeNull();
    });

    it('should handle many valid values', () => {
      const attributes: BackendAttribute[] = [
        createTestAttribute({
          validValues: Array.from({ length: 20 }, (_, i) => `value${i}`),
        }),
      ];

      const variables = generator.generateVariables(attributes);

      // Should truncate to first 5 and add "..."
      expect(variables[0].description).toContain('value0');
      expect(variables[0].description).toContain('...');
    });
  });
});
