/**
 * Integration tests for SchemaToTemplateGenerator with real schema files
 * Tests Issue #143: Schema-to-Template Generator with actual backend schemas
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { access } from 'fs/promises';
import { SchemaToTemplateGenerator } from '../../src/terragrunt/schema-generator.js';
import { loadBackendSchema } from '../../src/terragrunt/schema-loader.js';
import { validateHCL } from '../../src/terragrunt/hcl-validator.js';
import Mustache from 'mustache';

describe('SchemaToTemplateGenerator Integration Tests', () => {
  const generator = new SchemaToTemplateGenerator();

  describe('GCP GCS Backend Schema', () => {
    it('should load and generate template from GCS schema', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template).toBeDefined();
      expect(template.id).toBe('gcp-gcs-complete');
      expect(template.name).toBe('Google Cloud Storage Backend (Complete)');
      expect(template.category).toBe('backend');
      expect(template.cloudProvider).toBe('gcp');
      expect(template.tags).toContain('gcs');
    });

    it('should generate correct number of variables from GCS schema', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template.variables.length).toBeGreaterThan(0);
      
      // Check for key GCS attributes
      const varNames = template.variables.map(v => v.name);
      expect(varNames).toContain('bucket');
      expect(varNames).toContain('prefix');
      expect(varNames).toContain('credentials');
    });

    it('should generate valid HCL from GCS schema', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template.templateHcl).toContain('remote_state {');
      expect(template.templateHcl).toContain('backend = "gcs"');
      expect(template.templateHcl).toContain('config = {');
      expect(template.templateHcl).toContain('bucket = "{{bucket}}"');
    });

    it('should mark sensitive GCS attributes correctly', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      const sensitiveVars = template.variables.filter(v => v.sensitive);
      expect(sensitiveVars.length).toBeGreaterThan(0);
      
      const sensitiveNames = sensitiveVars.map(v => v.name);
      expect(sensitiveNames).toContain('credentials');
      expect(sensitiveNames).toContain('access_token');
      expect(sensitiveNames).toContain('encryption_key');
    });

    it('should handle required vs optional GCS attributes', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      const requiredVars = template.variables.filter(v => v.required);
      const optionalVars = template.variables.filter(v => !v.required);

      // GCS has bucket as required
      expect(requiredVars.length).toBeGreaterThanOrEqual(1);
      expect(requiredVars.map(v => v.name)).toContain('bucket');

      // Should have optional attributes like prefix, credentials
      expect(optionalVars.length).toBeGreaterThan(0);
    });

    it('should wrap optional GCS attributes in conditionals', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Optional attributes should have Mustache conditionals
      expect(template.templateHcl).toContain('{{#prefix}}');
      expect(template.templateHcl).toContain('{{/prefix}}');
      expect(template.templateHcl).toContain('{{#credentials}}');
      expect(template.templateHcl).toContain('{{/credentials}}');
    });

    it('should not wrap required GCS attributes in conditionals', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Required bucket should not have conditionals
      const lines = template.templateHcl.split('\n');
      const bucketLine = lines.find(l => l.includes('bucket ='));
      expect(bucketLine).toBeDefined();
      
      const bucketLineIndex = lines.indexOf(bucketLine!);
      expect(lines[bucketLineIndex - 1]).not.toContain('{{#bucket}}');
      expect(lines[bucketLineIndex + 1]).not.toContain('{{/bucket}}');
    });
  });

  describe('AWS S3 Backend Schema', () => {
    let s3SchemaExists = false;

    beforeAll(async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'aws-s3-complete.json');
      try {
        await access(schemaPath);
        s3SchemaExists = true;
      } catch {
        s3SchemaExists = false;
      }
    });

    it('should load and generate template from S3 schema if available', async () => {
      if (!s3SchemaExists) {
        return; // Skip test if schema doesn't exist
      }

      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'aws-s3-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      const template = generator.generateTemplate(schema);

      expect(template).toBeDefined();
      expect(template.id).toBe('aws-s3-complete');
      expect(template.cloudProvider).toBe('aws');
      expect(template.tags).toContain('s3');
    });
  });

  describe('Azure Blob Backend Schema', () => {
    let azureSchemaExists = false;

    beforeAll(async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'azure-blob.json');
      try {
        await access(schemaPath);
        azureSchemaExists = true;
      } catch {
        azureSchemaExists = false;
      }
    });

    it('should load and generate template from Azure Blob schema if available', async () => {
      if (!azureSchemaExists) {
        return; // Skip test if schema doesn't exist
      }

      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'azure-blob.json');
      const schema = await loadBackendSchema(schemaPath);
      const template = generator.generateTemplate(schema);

      expect(template).toBeDefined();
      expect(template.cloudProvider).toBe('azure');
    });
  });

  describe('Template Rendering with Mustache', () => {
    it('should render GCS template with all required variables', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Provide only required variables
      const values = {
        bucket: 'my-terraform-state',
      };

      // Disable HTML escaping for HCL
      Mustache.escape = (text: string) => text;

      const rendered = Mustache.render(template.templateHcl, values);

      expect(rendered).toContain('bucket = "my-terraform-state"');
      expect(rendered).not.toContain('{{bucket}}');
      
      // Optional attributes should be omitted
      expect(rendered).not.toContain('prefix =');
      expect(rendered).not.toContain('credentials =');
    });

    it('should render GCS template with optional variables', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      const values = {
        bucket: 'my-terraform-state',
        prefix: 'terraform/state',
        credentials: '~/.config/gcloud/credentials.json',
      };

      Mustache.escape = (text: string) => text;

      const rendered = Mustache.render(template.templateHcl, values);

      expect(rendered).toContain('bucket = "my-terraform-state"');
      expect(rendered).toContain('prefix = "terraform/state"');
      expect(rendered).toContain('credentials = "~/.config/gcloud/credentials.json"');
    });

    it('should render GCS template with boolean values correctly', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // If schema has boolean attributes
      const booleanVars = template.variables.filter(v => v.type === 'boolean');
      
      if (booleanVars.length > 0) {
        const values: Record<string, any> = {
          bucket: 'my-bucket',
        };
        
        // Add boolean variable
        values[booleanVars[0].name] = true;

        Mustache.escape = (text: string) => text;

        const rendered = Mustache.render(template.templateHcl, values);

        // Boolean should render without quotes
        expect(rendered).toContain(`${booleanVars[0].name} = true`);
        expect(rendered).not.toContain(`${booleanVars[0].name} = "true"`);
      }
    });

    it('should render GCS template with number values correctly', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // If schema has number attributes
      const numberVars = template.variables.filter(v => v.type === 'number');
      
      if (numberVars.length > 0) {
        const values: Record<string, any> = {
          bucket: 'my-bucket',
        };
        
        // Add number variable
        values[numberVars[0].name] = 42;

        Mustache.escape = (text: string) => text;

        const rendered = Mustache.render(template.templateHcl, values);

        // Number should render without quotes
        expect(rendered).toContain(`${numberVars[0].name} = 42`);
        expect(rendered).not.toContain(`${numberVars[0].name} = "42"`);
      }
    });
  });

  describe('HCL Validation', () => {
    it('should generate syntactically valid HCL from GCS schema', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Render with sample values
      const values = {
        bucket: 'test-bucket',
        prefix: 'terraform/state',
      };

      Mustache.escape = (text: string) => text;
      const rendered = Mustache.render(template.templateHcl, values);

      // Validate the rendered HCL
      const validation = validateHCL(rendered);

      expect(validation.syntaxValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should generate valid HCL with only required GCS attributes', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Render with only required values
      const values = {
        bucket: 'test-bucket',
      };

      Mustache.escape = (text: string) => text;
      const rendered = Mustache.render(template.templateHcl, values);

      const validation = validateHCL(rendered);

      expect(validation.syntaxValid).toBe(true);
    });

    it('should generate valid HCL with all GCS attributes', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      // Render with all values
      const values: Record<string, any> = {
        bucket: 'test-bucket',
      };

      // Add values for all optional string attributes
      template.variables
        .filter(v => !v.required && v.type === 'string')
        .forEach(v => {
          values[v.name] = `test-${v.name}`;
        });

      Mustache.escape = (text: string) => text;
      const rendered = Mustache.render(template.templateHcl, values);

      const validation = validateHCL(rendered);

      expect(validation.syntaxValid).toBe(true);
    });
  });

  describe('Template Tags and Metadata', () => {
    it('should generate appropriate tags for GCS backend', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template.tags).toContain('remote-state');
      expect(template.tags).toContain('gcs');
      expect(template.tags).toContain('gcp');
      expect(template.tags).toContain('backend');
      expect(template.tags).toContain('complete');
      expect(template.tags).toContain('generated');
    });

    it('should set correct source as builtin', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template.source).toBe('builtin');
    });

    it('should set correct category as backend', async () => {
      const schemaPath = join(process.cwd(), 'schemas', 'backends', 'gcp-gcs-complete.json');
      const schema = await loadBackendSchema(schemaPath);
      
      const template = generator.generateTemplate(schema);

      expect(template.category).toBe('backend');
    });
  });
});
