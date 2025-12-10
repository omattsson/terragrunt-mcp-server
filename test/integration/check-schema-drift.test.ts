import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Integration tests for check-schema-drift.ts
 * These tests verify real schema files and ensure the validator works end-to-end
 */

describe('Schema Drift Detection Integration', () => {
  const schemasDir = path.join(process.cwd(), 'schemas', 'backends');

  describe('Schema File Structure', () => {
    it('should have valid s3.json schema file', async () => {
      const schemaPath = path.join(schemasDir, 's3.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      expect(schema).toHaveProperty('id');
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('attributes');
      expect(Array.isArray(schema.attributes)).toBe(true);
      
      // Verify attributes have required structure
      if (schema.attributes.length > 0) {
        const attr = schema.attributes[0];
        expect(attr).toHaveProperty('name');
        expect(attr).toHaveProperty('type');
        expect(attr).toHaveProperty('required');
      }
    });

    it('should have valid aws-s3-complete.json schema file', async () => {
      const schemaPath = path.join(schemasDir, 'aws-s3-complete.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      expect(schema).toHaveProperty('id');
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('attributes');
      expect(Array.isArray(schema.attributes)).toBe(true);
    });

    it('should have valid azure-blob.json schema file', async () => {
      const schemaPath = path.join(schemasDir, 'azure-blob.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      expect(schema).toHaveProperty('id');
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('attributes');
      expect(Array.isArray(schema.attributes)).toBe(true);
    });

    it('should have valid gcp-gcs-complete.json schema file', async () => {
      const schemaPath = path.join(schemasDir, 'gcp-gcs-complete.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      expect(schema).toHaveProperty('id');
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('attributes');
      expect(Array.isArray(schema.attributes)).toBe(true);
    });
  });

  describe('Schema Attribute Validation', () => {
    it('should have common S3 attributes', async () => {
      const schemaPath = path.join(schemasDir, 's3.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      const attrNames = schema.attributes.map((a: any) => a.name);
      
      // Core S3 backend attributes
      expect(attrNames).toContain('bucket');
      expect(attrNames).toContain('key');
      expect(attrNames).toContain('region');
    });

    it('should have common Azure attributes', async () => {
      const schemaPath = path.join(schemasDir, 'azure-blob.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      const attrNames = schema.attributes.map((a: any) => a.name);
      
      // Core Azure backend attributes
      expect(attrNames).toContain('storage_account_name');
      expect(attrNames).toContain('container_name');
      expect(attrNames).toContain('key');
    });

    it('should have common GCS attributes', async () => {
      const schemaPath = path.join(schemasDir, 'gcp-gcs-complete.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      const attrNames = schema.attributes.map((a: any) => a.name);
      
      // Core GCS backend attributes
      expect(attrNames).toContain('bucket');
      expect(attrNames).toContain('prefix');
    });
  });

  describe('Schema Completeness', () => {
    it('should have complete schema with more attributes than essential', async () => {
      const essentialPath = path.join(schemasDir, 's3.json');
      const completePath = path.join(schemasDir, 'aws-s3-complete.json');
      
      const essentialContent = await fs.readFile(essentialPath, 'utf-8');
      const completeContent = await fs.readFile(completePath, 'utf-8');
      
      const essentialSchema = JSON.parse(essentialContent);
      const completeSchema = JSON.parse(completeContent);

      // Complete schema should have more or equal attributes
      expect(completeSchema.attributes.length).toBeGreaterThanOrEqual(
        essentialSchema.attributes.length
      );
    });

    it('should not have duplicate attribute names in schemas', async () => {
      const files = ['s3.json', 'aws-s3-complete.json', 'azure-blob.json', 'gcp-gcs-complete.json'];
      
      for (const file of files) {
        const schemaPath = path.join(schemasDir, file);
        const content = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(content);
        
        const attrNames = schema.attributes.map((a: any) => a.name);
        const uniqueNames = new Set(attrNames);
        
        expect(uniqueNames.size).toBe(attrNames.length);
      }
    });

    it('should have valid attribute types', async () => {
      const files = ['s3.json', 'aws-s3-complete.json', 'azure-blob.json', 'gcp-gcs-complete.json'];
      const validTypes = ['string', 'boolean', 'number', 'integer', 'object', 'array', 'list', 'map'];
      
      for (const file of files) {
        const schemaPath = path.join(schemasDir, file);
        const content = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(content);
        
        for (const attr of schema.attributes) {
          expect(validTypes).toContain(attr.type);
        }
      }
    });
  });

  describe('Schema Metadata', () => {
    it('should have correct backend IDs', async () => {
      const testCases = [
        { file: 's3.json', expectedId: 's3' },
        { file: 'aws-s3-complete.json', expectedId: 'aws-s3-complete' },
        { file: 'azure-blob.json', expectedId: 'azurerm' },
        { file: 'gcp-gcs-complete.json', expectedId: 'gcp-gcs-complete' }
      ];
      
      for (const { file, expectedId } of testCases) {
        const schemaPath = path.join(schemasDir, file);
        const content = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(content);
        
        expect(schema.id).toBe(expectedId);
      }
    });

    it('should have descriptive names', async () => {
      const files = ['s3.json', 'aws-s3-complete.json', 'azure-blob.json', 'gcp-gcs-complete.json'];
      
      for (const file of files) {
        const schemaPath = path.join(schemasDir, file);
        const content = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(content);
        
        expect(schema.name).toBeTruthy();
        expect(schema.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Path Security', () => {
    it('should reject path traversal attempts', () => {
      const isValidFilename = (filename: string) => {
        return /^[a-z0-9-]+\.json$/i.test(filename);
      };

      // Valid filenames
      expect(isValidFilename('s3.json')).toBe(true);
      expect(isValidFilename('aws-s3-complete.json')).toBe(true);
      
      // Invalid filenames (path traversal attempts)
      expect(isValidFilename('../s3.json')).toBe(false);
      expect(isValidFilename('../../etc/passwd')).toBe(false);
      expect(isValidFilename('/etc/passwd')).toBe(false);
      expect(isValidFilename('s3.json..')).toBe(false);
      expect(isValidFilename('.json')).toBe(false);
    });

    it('should normalize paths before validation', () => {
      const isPathWithinBaseDir = (filePath: string, baseDir: string) => {
        const resolvedPath = path.normalize(path.resolve(filePath));
        const resolvedDir = path.normalize(path.resolve(baseDir));
        
        // Path is valid if it's equal to baseDir OR starts with baseDir + separator
        return resolvedPath === resolvedDir || resolvedPath.startsWith(resolvedDir + path.sep);
      };

      const baseDir = path.join(process.cwd(), 'schemas', 'backends');
      
      // Valid paths (returns true = path is safe)
      const validPath = path.join(baseDir, 's3.json');
      expect(isPathWithinBaseDir(validPath, baseDir)).toBe(true);
      
      // Invalid paths (returns false = path is dangerous)
      expect(isPathWithinBaseDir('/etc/passwd', baseDir)).toBe(false);
      expect(isPathWithinBaseDir(path.join(baseDir, '..', '..', 'etc', 'passwd'), baseDir)).toBe(false);
    });
  });

  describe('Attribute Structure', () => {
    it('should have required attribute properties', async () => {
      const schemaPath = path.join(schemasDir, 's3.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      for (const attr of schema.attributes) {
        expect(attr).toHaveProperty('name');
        expect(attr).toHaveProperty('type');
        expect(attr).toHaveProperty('required');
        expect(typeof attr.name).toBe('string');
        expect(typeof attr.type).toBe('string');
        expect(typeof attr.required).toBe('boolean');
      }
    });

    it('should have valid attribute name format', async () => {
      const files = ['s3.json', 'aws-s3-complete.json', 'azure-blob.json', 'gcp-gcs-complete.json'];
      const validNamePattern = /^[a-z_][a-z0-9_]*$/i;
      
      for (const file of files) {
        const schemaPath = path.join(schemasDir, file);
        const content = await fs.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(content);
        
        for (const attr of schema.attributes) {
          expect(attr.name).toMatch(validNamePattern);
        }
      }
    });

    it('should have descriptions for attributes (when present)', async () => {
      const schemaPath = path.join(schemasDir, 's3.json');
      const content = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(content);

      for (const attr of schema.attributes) {
        if (attr.description) {
          expect(typeof attr.description).toBe('string');
          expect(attr.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Backend Coverage', () => {
    it('should cover all major cloud providers', async () => {
      const files = await fs.readdir(schemasDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const content = await Promise.all(
        jsonFiles.map(async f => {
          const data = await fs.readFile(path.join(schemasDir, f), 'utf-8');
          return JSON.parse(data);
        })
      );
      
      const backendIds = content.map(s => s.id);
      
      // Verify major cloud providers are covered (checking for actual schema IDs)
      const hasAWS = backendIds.some(id => id === 's3' || id === 'aws-s3-complete');
      const hasAzure = backendIds.some(id => id === 'azurerm');
      const hasGCP = backendIds.some(id => id === 'gcs' || id === 'gcp-gcs-complete');
      
      expect(hasAWS).toBe(true); // AWS
      expect(hasAzure).toBe(true); // Azure
      expect(hasGCP).toBe(true); // GCP
    });

    it('should have at least one schema per backend type', async () => {
      const files = await fs.readdir(schemasDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      // Should have multiple schema files
      expect(jsonFiles.length).toBeGreaterThanOrEqual(4);
      
      // All should be valid JSON
      for (const file of jsonFiles) {
        const content = await fs.readFile(path.join(schemasDir, file), 'utf-8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });
  });
});
