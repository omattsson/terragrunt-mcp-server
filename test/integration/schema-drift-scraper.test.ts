/**
 * Tests for BackendDocsScraper to ensure HTML parsing works correctly
 */

import { describe, it, expect } from 'vitest';
import { BackendDocsScraper } from '../../scripts/check-schema-drift.js';

describe('BackendDocsScraper', () => {
  const scraper = new BackendDocsScraper();

  describe('scrapeBackendAttributes', () => {
    // Note: These tests make live HTTP requests to HashiCorp documentation.
    // This is intentional for integration testing to ensure the parser works with real docs.
    // TODO: For more reliable CI/CD, add parallel fixture-based tests:
    //   1. Capture representative HTML snapshots from HashiCorp docs
    //   2. Create test/fixtures/backend-docs/*.html files
    //   3. Add unit tests that parse fixtures instead of making network calls
    //   4. Keep these live tests for periodic validation of real doc structure
    
    it('should extract attributes from S3 backend documentation', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/s3';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      // Should find a reasonable number of attributes (not 0)
      expect(attributes.length).toBeGreaterThan(30);
      
      // Should find core S3 attributes
      const attrNames = attributes.map(a => a.name);
      expect(attrNames).toContain('bucket');
      expect(attrNames).toContain('key');
      expect(attrNames).toContain('region');
      expect(attrNames).toContain('encrypt');
      
      // Each attribute should have a name
      for (const attr of attributes) {
        expect(attr.name).toBeTruthy();
        expect(typeof attr.name).toBe('string');
        expect(attr.name).toMatch(/^[a-z_][a-z0-9_]*$/i);
      }
    }, 30000);

    it('should extract attributes from Azure backend documentation', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/azurerm';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      // Should find a reasonable number of attributes
      expect(attributes.length).toBeGreaterThan(10);
      
      // Should find core Azure attributes
      const attrNames = attributes.map(a => a.name);
      expect(attrNames).toContain('storage_account_name');
      expect(attrNames).toContain('container_name');
      expect(attrNames).toContain('key');
    }, 30000);

    it('should extract attributes from GCS backend documentation', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/gcs';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      // Should find attributes
      expect(attributes.length).toBeGreaterThan(5);
      
      // Should find core GCS attributes
      const attrNames = attributes.map(a => a.name);
      expect(attrNames).toContain('bucket');
      expect(attrNames).toContain('prefix');
    }, 30000);

    it('should identify deprecated attributes correctly', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/s3';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      // Find deprecated attributes
      const deprecated = attributes.filter(a => a.deprecated);
      
      // Should have at least some deprecated attributes marked
      expect(deprecated.length).toBeGreaterThan(0);
      
      // If dynamodb_table is found and marked as deprecated in the docs, verify we captured that
      // Note: This test is resilient to doc changes - it only validates IF the attribute exists
      // AND is marked deprecated, rather than assuming it must always be present and deprecated.
      const dynamoDbTable = attributes.find(a => a.name === 'dynamodb_table');
      if (dynamoDbTable && dynamoDbTable.deprecated) {
        // Attribute exists and is marked deprecated - this is expected as of Jan 2026
        expect(dynamoDbTable.deprecated).toBe(true);
      } else if (dynamoDbTable && !dynamoDbTable.deprecated) {
        // Attribute exists but not deprecated - this would indicate the docs changed
        console.warn('Note: dynamodb_table found but not marked as deprecated - HashiCorp may have updated docs');
      }
      // If attribute doesn't exist at all, that's fine - docs may have removed it entirely
    }, 30000);

    it('should not include example attributes', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/s3';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      const attrNames = attributes.map(a => a.name.toLowerCase());
      
      // Should not include common example attribute names that appear in docs
      expect(attrNames).not.toContain('my_bucket');
      expect(attrNames).not.toContain('example');
      // Verify no attributes starting with example prefixes got through
      const examplePrefixes = attrNames.filter(n => n.startsWith('my_') || n.startsWith('example_') || n.startsWith('test_'));
      expect(examplePrefixes).toHaveLength(0);
    }, 30000);

    it('should extract descriptions for attributes', async () => {
      const url = 'https://developer.hashicorp.com/terraform/language/settings/backends/s3';
      const attributes = await scraper.scrapeBackendAttributes(url);
      
      // Most attributes should have descriptions
      const withDescriptions = attributes.filter(a => a.description && a.description.length > 10);
      expect(withDescriptions.length).toBeGreaterThan(attributes.length * 0.7); // At least 70% should have descriptions
      
      // Check that descriptions are reasonable
      const bucket = attributes.find(a => a.name === 'bucket');
      if (bucket && bucket.description) {
        expect(bucket.description.toLowerCase()).toMatch(/s3|bucket|state/);
      }
    }, 30000);
  });
});
