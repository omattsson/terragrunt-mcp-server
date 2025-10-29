import { describe, it, expect, beforeEach } from 'vitest';
import { TemplatesManager } from '../../src/terragrunt/templates.js';

describe('TemplatesManager', () => {
  let manager: TemplatesManager;

  beforeEach(() => {
    manager = new TemplatesManager();
  });

  describe('loadTemplates', () => {
    it('should load built-in templates', async () => {
      await manager.loadTemplates();
      const templates = await manager.getAllTemplates();
      
      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.length).toBe(9); // Total templates after Sprint 2
    });

    it('should only load templates once', async () => {
      await manager.loadTemplates();
      const firstLoad = await manager.getAllTemplates();
      
      await manager.loadTemplates();
      const secondLoad = await manager.getAllTemplates();
      
      expect(firstLoad).toEqual(secondLoad);
    });
  });

  describe('getTemplate', () => {
    it('should retrieve AWS S3 backend template', async () => {
      const template = await manager.getTemplate('aws-s3-backend');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('AWS S3 Remote State Backend');
      expect(template?.category).toBe('backend');
      expect(template?.cloudProvider).toBe('aws');
      expect(template?.source).toBe('gruntwork');
    });

    it('should retrieve Azure Blob backend template', async () => {
      const template = await manager.getTemplate('azure-blob-backend');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Azure Blob Storage Remote State Backend');
      expect(template?.category).toBe('backend');
      expect(template?.cloudProvider).toBe('azure');
      expect(template?.source).toBe('azure-config');
    });

    it('should retrieve AWS provider generation template', async () => {
      const template = await manager.getTemplate('aws-generate-provider');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('AWS Provider Generation');
      expect(template?.category).toBe('provider');
      expect(template?.cloudProvider).toBe('aws');
    });

    it('should handle case-insensitive ID lookup', async () => {
      const template = await manager.getTemplate('AWS-S3-BACKEND');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('aws-s3-backend');
    });

    it('should return undefined for non-existent template', async () => {
      const template = await manager.getTemplate('non-existent');
      
      expect(template).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', async () => {
      const templates = await manager.getAllTemplates();
      
      expect(templates).toHaveLength(9);
      
      const ids = templates.map(t => t.id);
      expect(ids).toContain('aws-s3-backend');
      expect(ids).toContain('azure-blob-backend');
      expect(ids).toContain('aws-generate-provider');
    });

    it('should return templates with complete data', async () => {
      const templates = await manager.getAllTemplates();
      
      for (const template of templates) {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(template.category).toBeTruthy();
        expect(template.cloudProvider).toBeTruthy();
        expect(template.source).toBeTruthy();
        expect(template.variables).toBeInstanceOf(Array);
        expect(template.tags).toBeInstanceOf(Array);
        expect(template.templateHcl).toBeTruthy();
      }
    });
  });

  describe('searchTemplates', () => {
    it('should filter by category', async () => {
      const backendTemplates = await manager.searchTemplates({ category: 'backend' });
      
      expect(backendTemplates).toHaveLength(3); // AWS S3, Azure Blob, GCP GCS
      expect(backendTemplates.every(t => t.category === 'backend')).toBe(true);
    });

    it('should filter by cloud provider', async () => {
      const awsTemplates = await manager.searchTemplates({ cloudProvider: 'aws' });
      
      expect(awsTemplates).toHaveLength(2);
      expect(awsTemplates.every(t => t.cloudProvider === 'aws')).toBe(true);
    });

    it('should filter by source', async () => {
      const gruntworkTemplates = await manager.searchTemplates({ source: 'gruntwork' });
      
      expect(gruntworkTemplates).toHaveLength(2);
      expect(gruntworkTemplates.every(t => t.source === 'gruntwork')).toBe(true);
    });

    it('should filter by tags', async () => {
      const remoteStateTemplates = await manager.searchTemplates({ 
        tags: ['remote-state'] 
      });
      
      expect(remoteStateTemplates).toHaveLength(3); // AWS S3, Azure Blob, GCP GCS
      expect(remoteStateTemplates.every(t => t.tags.includes('remote-state'))).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const results = await manager.searchTemplates({
        category: 'backend',
        cloudProvider: 'aws',
        source: 'gruntwork',
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('aws-s3-backend');
    });

    it('should return empty array when no matches', async () => {
      const results = await manager.searchTemplates({
        category: 'backend',
        cloudProvider: 'gcp',
      });
      
      expect(results).toHaveLength(1); // GCP template has 'gcp' tag
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', async () => {
      const metadata = await manager.getMetadata();
      
      expect(metadata.totalTemplates).toBe(9);
      expect(metadata.categories).toContain('backend');
      expect(metadata.categories).toContain('provider');
      expect(metadata.cloudProviders).toContain('aws');
      expect(metadata.cloudProviders).toContain('azure');
      expect(metadata.sources).toContain('gruntwork');
      expect(metadata.sources).toContain('azure-config');
      expect(metadata.lastUpdated).toBeTruthy();
    });

    it('should not have duplicate entries', async () => {
      const metadata = await manager.getMetadata();
      
      const uniqueCategories = new Set(metadata.categories);
      expect(uniqueCategories.size).toBe(metadata.categories.length);
      
      const uniqueProviders = new Set(metadata.cloudProviders);
      expect(uniqueProviders.size).toBe(metadata.cloudProviders.length);
      
      const uniqueSources = new Set(metadata.sources);
      expect(uniqueSources.size).toBe(metadata.sources.length);
    });
  });

  describe('template structure', () => {
    it('should have valid variables for AWS S3 backend', async () => {
      const template = await manager.getTemplate('aws-s3-backend');
      
      expect(template?.variables).toHaveLength(5);
      
      const requiredVars = template?.variables.filter(v => v.required);
      expect(requiredVars?.length).toBe(4);
      
      const varNames = template?.variables.map(v => v.name);
      expect(varNames).toContain('bucket');
      expect(varNames).toContain('key');
      expect(varNames).toContain('region');
      expect(varNames).toContain('dynamodb_table');
      expect(varNames).toContain('encrypt');
    });

    it('should have valid variables for Azure Blob backend', async () => {
      const template = await manager.getTemplate('azure-blob-backend');
      
      expect(template?.variables).toHaveLength(5);
      
      const varNames = template?.variables.map(v => v.name);
      expect(varNames).toContain('subscription_id');
      expect(varNames).toContain('resource_group_name');
      expect(varNames).toContain('storage_account_name');
      expect(varNames).toContain('container_name');
      expect(varNames).toContain('key');
    });

    it('should have valid HCL template syntax', async () => {
      const templates = await manager.getAllTemplates();
      
      for (const template of templates) {
        // Check for mustache-style variables
        expect(template.templateHcl).toMatch(/\{\{.*?\}\}/);
        
        // Check for HCL block structure
        expect(template.templateHcl).toMatch(/\{[\s\S]*\}/);
      }
    });

    it('should have examples for all templates', async () => {
      const templates = await manager.getAllTemplates();
      
      for (const template of templates) {
        expect(template.example).toBeTruthy();
        // terraform_version_constraint is a simple assignment, not a block
        if (template.id !== 'terraform-version') {
          expect(template.example).toContain('{');
        }
      }
    });
  });

  describe('clear', () => {
    it('should clear all templates', async () => {
      await manager.loadTemplates();
      const beforeClear = await manager.getAllTemplates();
      expect(beforeClear.length).toBeGreaterThan(0);
      
      manager.clear();
      
      const afterClear = await manager.getAllTemplates();
      // After clear, loadTemplates will reinitialize
      expect(afterClear.length).toBe(9);
    });
  });
});
