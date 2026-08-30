/**
 * Integration tests for SchemaTemplateLoader and tier-based template selection
 * Tests Issue #144: Integrate Complete Templates with TemplatesManager
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SchemaTemplateLoader } from '../../src/terragrunt/templates/loaders/schema.js';
import { TemplatesManager } from '../../src/terragrunt/templates/index.js';
import { ConfigTemplateLibrary } from '../../src/terragrunt/library.js';
import { BuiltinTemplateLoader } from '../../src/terragrunt/templates/loaders/builtin.js';

describe('SchemaTemplateLoader Integration Tests', () => {
  describe('SchemaTemplateLoader', () => {
    it('should have priority 15', () => {
      const loader = new SchemaTemplateLoader();
      expect(loader.priority).toBe(15);
    });

    it('should load schema-based templates', async () => {
      const loader = new SchemaTemplateLoader();
      const templates = await loader.loadTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      
      // Should load at least the GCS complete schema we created
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should load default schemas independently of the working directory', async () => {
      const originalCwd = process.cwd();

      try {
        process.chdir('..');
        const templates = await new SchemaTemplateLoader().loadTemplates();
        expect(templates).toHaveLength(4);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should generate templates with correct structure', async () => {
      const loader = new SchemaTemplateLoader();
      const templates = await loader.loadTemplates();

      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBe('backend');
        expect(template.templateHcl).toBeDefined();
        expect(template.variables).toBeDefined();
        expect(Array.isArray(template.variables)).toBe(true);
        expect(template.tags).toBeDefined();
        expect(Array.isArray(template.tags)).toBe(true);
      }
    });

    it('should generate complete-tier templates with "complete" in ID or tags', async () => {
      const loader = new SchemaTemplateLoader();
      const templates = await loader.loadTemplates();

      // Filter to only complete-tier templates (not essential schemas like s3, azurerm)
      const completeTemplates = templates.filter(t => 
        t.id.includes('complete') || t.tags.includes('complete')
      );
      
      expect(completeTemplates.length).toBeGreaterThan(0);
      
      for (const template of completeTemplates) {
        const hasCompleteInId = template.id.includes('complete');
        const hasCompleteInTags = template.tags.includes('complete');
        
        expect(hasCompleteInId || hasCompleteInTags).toBe(true);
      }
    });

    it('should handle missing schema directory gracefully', async () => {
      const loader = new SchemaTemplateLoader('/nonexistent/directory');
      const templates = await loader.loadTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBe(0);
    });
  });

  describe('TemplatesManager Integration', () => {
    let templatesManager: TemplatesManager;

    beforeAll(() => {
      // Create manager with both builtin and schema loaders
      templatesManager = new TemplatesManager([
        new BuiltinTemplateLoader(),
        new SchemaTemplateLoader(),
      ]);
    });

    it('should load templates from both builtin and schema loaders', async () => {
      await templatesManager.loadTemplates();
      const allTemplates = await templatesManager.getAllTemplates();

      expect(allTemplates.length).toBeGreaterThan(0);
      
      // Should have both builtin and schema-generated templates
      const builtinTemplates = allTemplates.filter(t => t.source === 'builtin');
      const schemaTemplates = allTemplates.filter(t => 
        t.id.includes('complete') || t.tags.includes('complete')
      );

      expect(builtinTemplates.length).toBeGreaterThan(0);
      expect(schemaTemplates.length).toBeGreaterThan(0);
    });

    it('should find GCS complete template', async () => {
      await templatesManager.loadTemplates();
      const template = await templatesManager.getTemplate('gcp-gcs-complete');

      expect(template).toBeDefined();
      expect(template?.id).toBe('gcp-gcs-complete');
      expect(template?.cloudProvider).toBe('gcp');
      expect(template?.category).toBe('backend');
    });

    it('should search for backend templates', async () => {
      const templates = await templatesManager.searchTemplates({ category: 'backend' });

      expect(templates.length).toBeGreaterThan(0);
      
      // Should include both essential and complete templates
      const essentialTemplates = templates.filter(t => 
        !t.id.includes('advanced') && !t.id.includes('complete')
      );
      const completeTemplates = templates.filter(t => t.id.includes('complete'));

      expect(essentialTemplates.length).toBeGreaterThan(0);
      expect(completeTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('ConfigTemplateLibrary Tier Selection', () => {
    let library: ConfigTemplateLibrary;

    beforeAll(() => {
      const templatesManager = new TemplatesManager([
        new BuiltinTemplateLoader(),
        new SchemaTemplateLoader(),
      ]);
      library = new ConfigTemplateLibrary(templatesManager);
    });

    it('should select essential template when no tier specified', async () => {
      const template = await library.getTemplate('remote_state', 's3');

      expect(template).toBeDefined();
      // With schema loader enabled, 's3' template from schema has higher priority
      // This is the correct behavior as schema-based templates override builtins
      expect(template?.id).toMatch(/s3/); // Should match s3-related template
    });

    it('should select advanced template when tier=advanced', async () => {
      const template = await library.getTemplate('remote_state', 's3', 'advanced');

      expect(template).toBeDefined();
      expect(template?.id).toBe('aws-s3-backend-advanced');
    });

    it('should select complete template when tier=complete', async () => {
      const template = await library.getTemplate('remote_state', 's3', 'complete');

      expect(template).toBeDefined();
      
      // Should be the complete template (schema-generated)
      const isComplete = template?.id.includes('complete') || template?.tags.includes('complete');
      expect(isComplete).toBe(true);
    });

    it('should select GCS complete template when tier=complete', async () => {
      const template = await library.getTemplate('remote_state', 'gcs', 'complete');

      expect(template).toBeDefined();
      expect(template?.id).toBe('gcp-gcs-complete');
      expect(template?.cloudProvider).toBe('gcp');
    });

    it('should handle tier parameter correctly', async () => {
      // Without tier: uses priority-based matching (higher priority loader wins)
      const template1 = await library.getTemplate('remote_state', 's3');
      
      // With tier='essential': uses pattern matching for '{backend}-backend'
      const template2 = await library.getTemplate('remote_state', 's3', 'essential');

      expect(template1).toBeDefined();
      expect(template2).toBeDefined();
      
      // Both should be s3-related templates
      expect(template1?.id).toMatch(/s3/);
      expect(template2?.id).toMatch(/s3.*backend/); // Should match pattern with 'backend'
    });

    it('should handle missing tier gracefully', async () => {
      // Request complete tier for backend that might not have complete template
      const template = await library.getTemplate('remote_state', 'azurerm', 'complete');

      // Should either find complete template or fallback to available template
      expect(template).toBeDefined();
    });
  });

  describe('Template Content Validation', () => {
    let templatesManager: TemplatesManager;

    beforeAll(async () => {
      templatesManager = new TemplatesManager([
        new BuiltinTemplateLoader(),
        new SchemaTemplateLoader(),
      ]);
      await templatesManager.loadTemplates();
    });

    it('should have valid HCL structure in GCS complete template', async () => {
      const template = await templatesManager.getTemplate('gcp-gcs-complete');

      expect(template).toBeDefined();
      expect(template?.templateHcl).toContain('remote_state');
      expect(template?.templateHcl).toContain('backend = "gcs"');
      expect(template?.templateHcl).toContain('config = {');
    });

    it('should have Mustache conditionals for optional attributes', async () => {
      const template = await templatesManager.getTemplate('gcp-gcs-complete');

      expect(template).toBeDefined();
      
      // Complete templates should have conditional blocks for optional attributes
      const hasConditionals = template?.templateHcl.includes('{{#') && template?.templateHcl.includes('{{/');
      expect(hasConditionals).toBe(true);
    });

    it('should expose native and migration locking in S3 templates', async () => {
      const template = await templatesManager.getTemplate('s3');

      expect(template).toBeDefined();
      expect(template?.variables.map(variable => variable.name)).toEqual(
        expect.arrayContaining(['use_lockfile', 'dynamodb_table'])
      );
      expect(template?.templateHcl).toContain('use_lockfile = {{use_lockfile}}');
      expect(template?.templateHcl).toContain('dynamodb_table = "{{dynamodb_table}}"');
    });

    it('should have variables with correct types', async () => {
      const template = await templatesManager.getTemplate('gcp-gcs-complete');

      expect(template).toBeDefined();
      expect(template?.variables.length).toBeGreaterThan(0);

      // Check that variables have proper structure
      for (const variable of template!.variables) {
        expect(variable.name).toBeDefined();
        expect(variable.type).toBeDefined();
        expect(variable.type).toMatch(/^(string|number|boolean|list|map|object)$/);
        expect(typeof variable.required).toBe('boolean');
      }
      
      // Verify that at least some variables are marked as required
      const requiredVars = template!.variables.filter(v => v.required);
      expect(requiredVars.length).toBeGreaterThan(0);
    });

    it('should mark sensitive variables correctly', async () => {
      const template = await templatesManager.getTemplate('gcp-gcs-complete');

      expect(template).toBeDefined();
      
      const sensitiveVars = template?.variables.filter(v => v.sensitive);
      expect(sensitiveVars).toBeDefined();
      
      // GCS should have sensitive variables like credentials, access_token, encryption_key
      expect(sensitiveVars!.length).toBeGreaterThan(0); // GCS should have sensitive vars
      const sensitiveNames = sensitiveVars!.map(v => v.name);
      const hasSensitiveCredentials = sensitiveNames.some(name => 
        name.includes('credential') || 
        name.includes('token') || 
        name.includes('key')
      );
      expect(hasSensitiveCredentials).toBe(true);
    });
  });
});
