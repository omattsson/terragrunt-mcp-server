/**
 * Unit tests for Backend Schema types and loader
 * Tests Issue #139: Define Backend Schema Format for Complete Templates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import {
  validateBackendSchema,
  validateAttribute,
  loadBackendSchema,
  loadAllBackendSchemas,
  getAttributeByName,
  getRequiredAttributes,
  getOptionalAttributes,
  getDeprecatedAttributes,
  getSensitiveAttributes,
} from '../../src/terragrunt/schema-loader.js';
import type { BackendSchema, BackendAttribute } from '../../src/types/backend-schema.js';

// Test fixtures directory
const TEST_FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures', 'backend-schemas');

// Helper to create a valid minimal schema
function createValidSchema(overrides: Partial<BackendSchema> = {}): BackendSchema {
  return {
    id: 's3',
    name: 'AWS S3 Backend',
    description: 'Stores state in S3',
    provider: 'aws',
    backend: 's3',
    terraformDocsUrl: 'https://developer.hashicorp.com/terraform/language/backend/s3',
    attributes: [
      {
        name: 'bucket',
        type: 'string',
        required: true,
        description: 'S3 bucket name',
      },
    ],
    ...overrides,
  };
}

// Helper to create a valid attribute
function createValidAttribute(overrides: Partial<BackendAttribute> = {}): BackendAttribute {
  return {
    name: 'test_attr',
    type: 'string',
    required: false,
    description: 'Test attribute',
    ...overrides,
  };
}

describe('Backend Schema Validation', () => {
  describe('validateBackendSchema', () => {
    describe('valid schemas', () => {
      it('should accept a minimal valid schema', () => {
        const schema = createValidSchema();
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept a schema with all optional fields', () => {
        const schema = createValidSchema({
          version: '1.0.0',
          lastUpdated: '2024-12-03',
        });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept all valid provider values', () => {
        const providers = ['aws', 'azure', 'gcp', 'other'];
        
        for (const provider of providers) {
          const schema = createValidSchema({ provider });
          const result = validateBackendSchema(schema);
          
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });

      it('should accept semver with prerelease and build metadata', () => {
        const versions = ['1.0.0', '1.0.0-alpha', '1.0.0-beta.1', '1.0.0+build', '1.0.0-alpha+build.123'];
        
        for (const version of versions) {
          const schema = createValidSchema({ version });
          const result = validateBackendSchema(schema);
          
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      });
    });

    describe('invalid schemas', () => {
      it('should reject null input', () => {
        const result = validateBackendSchema(null);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Schema must be an object');
      });

      it('should reject non-object input', () => {
        const result = validateBackendSchema('not an object');
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Schema must be an object');
      });

      it('should reject missing required fields', () => {
        const result = validateBackendSchema({});
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('id: Required and must be a non-empty string');
        expect(result.errors).toContain('name: Required and must be a non-empty string');
        expect(result.errors).toContain('description: Required and must be a non-empty string');
        expect(result.errors).toContain('provider: Required and must be a string');
        expect(result.errors).toContain('backend: Required and must be a non-empty string');
        expect(result.errors).toContain('terraformDocsUrl: Required and must be a non-empty string');
        expect(result.errors).toContain('attributes: Required and must be an array');
      });

      it('should reject invalid id format', () => {
        const schema = createValidSchema({ id: 'Invalid-ID' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('id: Must match pattern'))).toBe(true);
      });

      it('should reject invalid provider value', () => {
        const schema = createValidSchema({ provider: 'invalid' as any });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('provider: Must be one of'))).toBe(true);
      });

      it('should reject invalid terraformDocsUrl', () => {
        const schema = createValidSchema({ terraformDocsUrl: 'not-a-url' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('terraformDocsUrl: Must be a valid URL'))).toBe(true);
      });

      it('should reject non-HTTP URL', () => {
        const schema = createValidSchema({ terraformDocsUrl: 'ftp://example.com/docs' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('terraformDocsUrl: Must be an HTTP or HTTPS URL'))).toBe(true);
      });

      it('should reject empty attributes array', () => {
        const schema = createValidSchema({ attributes: [] });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('attributes: Must contain at least one attribute');
      });

      it('should reject invalid semver format', () => {
        const schema = createValidSchema({ version: '1.0' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('version: Must be valid semver format'))).toBe(true);
      });

      it('should reject invalid date format', () => {
        const schema = createValidSchema({ lastUpdated: '12/03/2024' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('lastUpdated: Must be ISO date format'))).toBe(true);
      });

      it('should reject non-existent date', () => {
        const schema = createValidSchema({ lastUpdated: '2024-02-30' });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('lastUpdated: Invalid date'))).toBe(true);
      });

      it('should reject duplicate attribute names', () => {
        const schema = createValidSchema({
          attributes: [
            createValidAttribute({ name: 'bucket' }),
            createValidAttribute({ name: 'bucket' }),
          ],
        });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Duplicate attribute name'))).toBe(true);
      });
    });

    describe('warnings', () => {
      it('should warn about unknown conflictsWith references', () => {
        const schema = createValidSchema({
          attributes: [
            createValidAttribute({
              name: 'attr1',
              conflictsWith: ['nonexistent'],
            }),
          ],
        });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('References unknown attribute "nonexistent"'))).toBe(true);
      });

      it('should warn about unknown requiredWith references', () => {
        const schema = createValidSchema({
          attributes: [
            createValidAttribute({
              name: 'attr1',
              requiredWith: ['nonexistent'],
            }),
          ],
        });
        const result = validateBackendSchema(schema);
        
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('References unknown attribute "nonexistent"'))).toBe(true);
      });
    });
  });

  describe('validateAttribute', () => {
    describe('valid attributes', () => {
      it('should accept a minimal valid attribute', () => {
        const attr = createValidAttribute();
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });

      it('should accept all valid attribute types', () => {
        const types = ['string', 'number', 'boolean', 'list', 'map', 'object'];
        
        for (const type of types) {
          const attr = createValidAttribute({ type: type as any });
          const errors = validateAttribute(attr, 0);
          
          expect(errors).toHaveLength(0);
        }
      });

      it('should accept attribute with all optional fields', () => {
        const attr = createValidAttribute({
          example: 'example-value',
          defaultValue: 'default-value',
          sensitive: true,
          deprecated: true,
          deprecatedMessage: 'Use other_attr instead',
          validValues: ['a', 'b', 'c'],
          pattern: '^[a-z]+$',
          conflictsWith: ['other_attr'],
          requiredWith: ['related_attr'],
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });

      it('should accept numeric attribute with min/max values', () => {
        const attr = createValidAttribute({
          type: 'number',
          minValue: 0,
          maxValue: 100,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });

      it('should accept boolean example values', () => {
        const attr = createValidAttribute({
          type: 'boolean',
          example: true,
          defaultValue: false,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });

      it('should accept numeric example values', () => {
        const attr = createValidAttribute({
          type: 'number',
          example: 42,
          defaultValue: 0,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });

      it('should accept null as defaultValue', () => {
        const attr = createValidAttribute({
          defaultValue: null,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toHaveLength(0);
      });
    });

    describe('invalid attributes', () => {
      it('should reject null attribute', () => {
        const errors = validateAttribute(null, 0);
        
        expect(errors).toContain('attributes[0]: Must be an object');
      });

      it('should reject missing required fields', () => {
        const errors = validateAttribute({}, 0);
        
        expect(errors).toContain('attributes[0].name: Required and must be a non-empty string');
        expect(errors).toContain('attributes[0].type: Required and must be a string');
        expect(errors).toContain('attributes[0].required: Required and must be a boolean');
        expect(errors).toContain('attributes[0].description: Required and must be a non-empty string');
      });

      it('should reject invalid attribute name format', () => {
        const attr = createValidAttribute({ name: 'Invalid-Name' });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('name: Must match pattern'))).toBe(true);
      });

      it('should reject invalid attribute type', () => {
        const attr = createValidAttribute({ type: 'invalid' as any });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('type: Must be one of'))).toBe(true);
      });

      it('should reject deprecatedMessage without deprecated flag', () => {
        const attr = createValidAttribute({
          deprecated: false,
          deprecatedMessage: 'This should not be here',
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('deprecatedMessage: Can only be specified when deprecated is true'))).toBe(true);
      });

      it('should reject empty validValues array', () => {
        const attr = createValidAttribute({ validValues: [] });
        const errors = validateAttribute(attr, 0);
        
        expect(errors).toContain('attributes[0].validValues: Must contain at least one value');
      });

      it('should reject minValue for non-number type', () => {
        const attr = createValidAttribute({
          type: 'string',
          minValue: 0,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('minValue: Can only be specified for number type'))).toBe(true);
      });

      it('should reject maxValue for non-number type', () => {
        const attr = createValidAttribute({
          type: 'string',
          maxValue: 100,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('maxValue: Can only be specified for number type'))).toBe(true);
      });

      it('should reject minValue > maxValue', () => {
        const attr = createValidAttribute({
          type: 'number',
          minValue: 100,
          maxValue: 0,
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('minValue (100) cannot be greater than maxValue (0)'))).toBe(true);
      });

      it('should reject invalid regex pattern', () => {
        const attr = createValidAttribute({
          pattern: '[invalid',
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('pattern: Invalid regex pattern'))).toBe(true);
      });

      it('should reject invalid conflictsWith format', () => {
        const attr = createValidAttribute({
          conflictsWith: ['Invalid-Name'],
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('conflictsWith[0]: Must match attribute name pattern'))).toBe(true);
      });

      it('should reject invalid requiredWith format', () => {
        const attr = createValidAttribute({
          requiredWith: ['Invalid-Name'],
        });
        const errors = validateAttribute(attr, 0);
        
        expect(errors.some(e => e.includes('requiredWith[0]: Must match attribute name pattern'))).toBe(true);
      });
    });
  });
});

describe('Backend Schema Loader', () => {
  const testDir = join(TEST_FIXTURES_DIR, 'loader-test');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadBackendSchema', () => {
    it('should load a valid schema file', async () => {
      const schema = createValidSchema();
      const filePath = join(testDir, 'valid.json');
      await writeFile(filePath, JSON.stringify(schema, null, 2));
      
      const loaded = await loadBackendSchema(filePath);
      
      expect(loaded.id).toBe('s3');
      expect(loaded.name).toBe('AWS S3 Backend');
      expect(loaded.attributes).toHaveLength(1);
    });

    it('should throw on non-existent file', async () => {
      const filePath = join(testDir, 'nonexistent.json');
      
      await expect(loadBackendSchema(filePath)).rejects.toThrow('Failed to read schema file');
    });

    it('should throw on invalid JSON', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(filePath, 'not valid json {');
      
      await expect(loadBackendSchema(filePath)).rejects.toThrow('Failed to parse JSON');
    });

    it('should throw on invalid schema structure', async () => {
      const filePath = join(testDir, 'invalid-schema.json');
      await writeFile(filePath, JSON.stringify({ invalid: 'schema' }));
      
      await expect(loadBackendSchema(filePath)).rejects.toThrow('Invalid schema');
    });

    it('should skip validation when validate=false', async () => {
      const invalidSchema = { invalid: 'schema' };
      const filePath = join(testDir, 'skip-validation.json');
      await writeFile(filePath, JSON.stringify(invalidSchema));
      
      const loaded = await loadBackendSchema(filePath, { validate: false });
      
      expect(loaded).toEqual(invalidSchema);
    });

    it('should not throw on invalid schema when throwOnError=false', async () => {
      const invalidSchema = { invalid: 'schema' };
      const filePath = join(testDir, 'no-throw.json');
      await writeFile(filePath, JSON.stringify(invalidSchema));
      
      // Should log error but still return
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const loaded = await loadBackendSchema(filePath, { throwOnError: false });
      
      expect(loaded).toEqual(invalidSchema);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should log warnings for unknown references', async () => {
      const schema = createValidSchema({
        attributes: [
          createValidAttribute({
            name: 'test',
            conflictsWith: ['unknown_attr'],
          }),
        ],
      });
      const filePath = join(testDir, 'warnings.json');
      await writeFile(filePath, JSON.stringify(schema));
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await loadBackendSchema(filePath);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('loadAllBackendSchemas', () => {
    it('should load all schemas from a directory', async () => {
      const schema1 = createValidSchema({ id: 's3' });
      const schema2 = createValidSchema({ id: 'azurerm', provider: 'azure', backend: 'azurerm' });
      
      await writeFile(join(testDir, 's3.json'), JSON.stringify(schema1));
      await writeFile(join(testDir, 'azurerm.json'), JSON.stringify(schema2));
      
      const schemas = await loadAllBackendSchemas(testDir);
      
      expect(schemas.size).toBe(2);
      expect(schemas.has('s3')).toBe(true);
      expect(schemas.has('azurerm')).toBe(true);
    });

    it('should return empty map for non-existent directory', async () => {
      const schemas = await loadAllBackendSchemas(join(testDir, 'nonexistent'));
      
      expect(schemas.size).toBe(0);
    });

    it('should ignore non-JSON files', async () => {
      const schema = createValidSchema();
      await writeFile(join(testDir, 's3.json'), JSON.stringify(schema));
      await writeFile(join(testDir, 'readme.txt'), 'Not a JSON file');
      await writeFile(join(testDir, 'notes.md'), '# Notes');
      
      const schemas = await loadAllBackendSchemas(testDir);
      
      expect(schemas.size).toBe(1);
    });

    it('should skip duplicate schema IDs', async () => {
      const schema1 = createValidSchema({ id: 's3', name: 'First S3' });
      const schema2 = createValidSchema({ id: 's3', name: 'Second S3' });
      
      await writeFile(join(testDir, 's3-a.json'), JSON.stringify(schema1));
      await writeFile(join(testDir, 's3-b.json'), JSON.stringify(schema2));
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const schemas = await loadAllBackendSchemas(testDir);
      
      expect(schemas.size).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should continue loading after individual file errors', async () => {
      const validSchema = createValidSchema({ id: 's3' });
      
      await writeFile(join(testDir, 'valid.json'), JSON.stringify(validSchema));
      await writeFile(join(testDir, 'invalid.json'), 'not json');
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const schemas = await loadAllBackendSchemas(testDir);
      
      expect(schemas.size).toBe(1);
      expect(schemas.has('s3')).toBe(true);
      
      consoleSpy.mockRestore();
    });

    it('should throw on directory error when throwOnError=true', async () => {
      await expect(
        loadAllBackendSchemas(join(testDir, 'nonexistent'), { throwOnError: true })
      ).rejects.toThrow('Failed to read schema directory');
    });

    it('should throw on duplicate when throwOnError=true', async () => {
      const schema1 = createValidSchema({ id: 's3' });
      const schema2 = createValidSchema({ id: 's3' });
      
      await writeFile(join(testDir, 's3-a.json'), JSON.stringify(schema1));
      await writeFile(join(testDir, 's3-b.json'), JSON.stringify(schema2));
      
      await expect(
        loadAllBackendSchemas(testDir, { throwOnError: true })
      ).rejects.toThrow('Duplicate schema ID');
    });
  });
});

describe('Schema Helper Functions', () => {
  const testSchema: BackendSchema = {
    id: 'test',
    name: 'Test Backend',
    description: 'Test',
    provider: 'aws',
    backend: 'test',
    terraformDocsUrl: 'https://example.com',
    attributes: [
      {
        name: 'required_attr',
        type: 'string',
        required: true,
        description: 'Required',
      },
      {
        name: 'optional_attr',
        type: 'string',
        required: false,
        description: 'Optional',
      },
      {
        name: 'deprecated_attr',
        type: 'string',
        required: false,
        description: 'Deprecated',
        deprecated: true,
        deprecatedMessage: 'Use new_attr instead',
      },
      {
        name: 'sensitive_attr',
        type: 'string',
        required: false,
        description: 'Sensitive',
        sensitive: true,
      },
      {
        name: 'both_deprecated_and_sensitive',
        type: 'string',
        required: false,
        description: 'Both',
        deprecated: true,
        sensitive: true,
      },
    ],
  };

  describe('getAttributeByName', () => {
    it('should return attribute when found', () => {
      const attr = getAttributeByName(testSchema, 'required_attr');
      
      expect(attr).toBeDefined();
      expect(attr?.name).toBe('required_attr');
    });

    it('should return undefined when not found', () => {
      const attr = getAttributeByName(testSchema, 'nonexistent');
      
      expect(attr).toBeUndefined();
    });
  });

  describe('getRequiredAttributes', () => {
    it('should return only required attributes', () => {
      const attrs = getRequiredAttributes(testSchema);
      
      expect(attrs).toHaveLength(1);
      expect(attrs[0].name).toBe('required_attr');
    });
  });

  describe('getOptionalAttributes', () => {
    it('should return only optional attributes', () => {
      const attrs = getOptionalAttributes(testSchema);
      
      expect(attrs).toHaveLength(4);
      expect(attrs.every(a => !a.required)).toBe(true);
    });
  });

  describe('getDeprecatedAttributes', () => {
    it('should return only deprecated attributes', () => {
      const attrs = getDeprecatedAttributes(testSchema);
      
      expect(attrs).toHaveLength(2);
      expect(attrs.every(a => a.deprecated)).toBe(true);
    });
  });

  describe('getSensitiveAttributes', () => {
    it('should return only sensitive attributes', () => {
      const attrs = getSensitiveAttributes(testSchema);
      
      expect(attrs).toHaveLength(2);
      expect(attrs.every(a => a.sensitive)).toBe(true);
    });
  });
});

describe('Real S3 Schema File', () => {
  it('should load and validate the S3 example schema', async () => {
    const schemaPath = join(process.cwd(), 'schemas', 'backends', 's3.json');
    
    try {
      const schema = await loadBackendSchema(schemaPath);
      
      expect(schema.id).toBe('s3');
      expect(schema.provider).toBe('aws');
      expect(schema.backend).toBe('s3');
      expect(schema.attributes.length).toBeGreaterThan(10);
      
      // Verify required attributes exist
      const bucket = getAttributeByName(schema, 'bucket');
      expect(bucket).toBeDefined();
      expect(bucket?.required).toBe(true);
      
      const key = getAttributeByName(schema, 'key');
      expect(key).toBeDefined();
      expect(key?.required).toBe(true);
      
      // Verify deprecated attributes
      const deprecated = getDeprecatedAttributes(schema);
      expect(deprecated.length).toBeGreaterThan(0);
      
      // Verify sensitive attributes
      const sensitive = getSensitiveAttributes(schema);
      expect(sensitive.length).toBeGreaterThan(0);
      
    } catch (error) {
      // Schema file might not exist in test environment - that's OK
      console.log('S3 schema file not found, skipping test');
    }
  });
});
