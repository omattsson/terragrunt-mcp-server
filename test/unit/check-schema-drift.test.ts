import { describe, it, expect, beforeEach } from 'vitest';
import { 
  parseArguments,
  BackendDocsScraper,
  SchemaComparator,
  formatMarkdown
} from '../../scripts/check-schema-drift.js';

/**
 * Unit tests for check-schema-drift.ts
 * 
 * These tests verify the actual production code behavior rather than duplicating logic.
 * All exported classes and functions are tested here.
 */

describe('Argument Parsing (Real Implementation)', () => {
  describe('parseArguments - Valid Inputs', () => {
    it('should parse valid JSON format', () => {
      const result = parseArguments(['--format=json']);
      expect(result.format).toBe('json');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse valid markdown format', () => {
      const result = parseArguments(['--format=markdown']);
      expect(result.format).toBe('markdown');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse valid backend filter', () => {
      const result = parseArguments(['--backend=s3']);
      expect(result.backendFilter).toBe('s3');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse multiple arguments', () => {
      const result = parseArguments(['--format=markdown', '--backend=azurerm']);
      expect(result.format).toBe('markdown');
      expect(result.backendFilter).toBe('azurerm');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle help flag', () => {
      const result1 = parseArguments(['--help']);
      expect(result1.showHelp).toBe(true);

      const result2 = parseArguments(['-h']);
      expect(result2.showHelp).toBe(true);
    });

    it('should handle empty arguments array with defaults', () => {
      const result = parseArguments([]);
      expect(result.format).toBe('json');
      expect(result.backendFilter).toBeUndefined();
      expect(result.showHelp).toBe(false);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parseArguments - Error Handling', () => {
    it('should reject empty format value (--format=)', () => {
      const result = parseArguments(['--format=']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('--format requires a value');
    });

    it('should reject invalid format value', () => {
      const result = parseArguments(['--format=xml']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Invalid format 'xml'");
      expect(result.errors[0]).toContain("Must be 'json' or 'markdown'");
    });

    it('should reject empty backend value (--backend=)', () => {
      const result = parseArguments(['--backend=']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('--backend requires a value');
    });

    it('should reject invalid backend value', () => {
      const result = parseArguments(['--backend=invalid']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Backend 'invalid' not found");
      expect(result.errors[0]).toContain('s3');
      expect(result.errors[0]).toContain('azurerm');
      expect(result.errors[0]).toContain('gcs');
    });

    it('should reject unknown arguments', () => {
      const result = parseArguments(['--unknown']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Unknown argument '--unknown'");
    });

    it('should collect multiple errors', () => {
      const result = parseArguments(['--format=', '--backend=invalid', '--unknown']);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain('--format requires a value');
      expect(result.errors[1]).toContain("Backend 'invalid' not found");
      expect(result.errors[2]).toContain("Unknown argument '--unknown'");
    });
  });

  describe('parseArguments - Edge Cases (from Copilot review)', () => {
    it('should distinguish --format vs --format=', () => {
      // --format without = should be treated as unknown argument
      const result1 = parseArguments(['--format']);
      expect(result1.errors).toHaveLength(1);
      expect(result1.errors[0]).toContain("Unknown argument '--format'");

      // --format= with empty value should specifically error about missing value
      const result2 = parseArguments(['--format=']);
      expect(result2.errors).toHaveLength(1);
      expect(result2.errors[0]).toContain('--format requires a value');
    });

    it('should distinguish --backend vs --backend=', () => {
      // --backend without = should be treated as unknown argument
      const result1 = parseArguments(['--backend']);
      expect(result1.errors).toHaveLength(1);
      expect(result1.errors[0]).toContain("Unknown argument '--backend'");

      // --backend= with empty value should specifically error about missing value
      const result2 = parseArguments(['--backend=']);
      expect(result2.errors).toHaveLength(1);
      expect(result2.errors[0]).toContain('--backend requires a value');
    });

    it('should validate all supported backends', () => {
      const validBackends = ['s3', 'azurerm', 'gcs'];
      
      for (const backend of validBackends) {
        const result = parseArguments([`--backend=${backend}`]);
        expect(result.errors).toHaveLength(0);
        expect(result.backendFilter).toBe(backend);
      }
    });

    it('should handle case-sensitive backend names', () => {
      // Backend names should be case-sensitive
      const result = parseArguments(['--backend=S3']);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Backend 'S3' not found");
    });

    it('should default to json format when not specified', () => {
      const result = parseArguments(['--backend=s3']);
      expect(result.format).toBe('json');
    });

    it('should handle format before backend', () => {
      const result = parseArguments(['--format=markdown', '--backend=gcs']);
      expect(result.format).toBe('markdown');
      expect(result.backendFilter).toBe('gcs');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle backend before format', () => {
      const result = parseArguments(['--backend=azurerm', '--format=json']);
      expect(result.format).toBe('json');
      expect(result.backendFilter).toBe('azurerm');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle help flag with other arguments', () => {
      // When help is shown, parsing stops and other arguments don't matter
      const result = parseArguments(['--format=json', '--help']);
      expect(result.showHelp).toBe(true);
    });
  });

  describe('parseArguments - Format Validation', () => {
    it('should only accept json or markdown formats', () => {
      const validFormats = ['json', 'markdown'];
      const invalidFormats = ['xml', 'yaml', 'txt', 'html', ''];

      for (const format of validFormats) {
        const result = parseArguments([`--format=${format}`]);
        expect(result.errors).toHaveLength(0);
      }

      for (const format of invalidFormats) {
        const result = parseArguments([`--format=${format}`]);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should be case-sensitive for format values', () => {
      const result1 = parseArguments(['--format=JSON']);
      expect(result1.errors).toHaveLength(1);
      expect(result1.errors[0]).toContain("Invalid format 'JSON'");

      const result2 = parseArguments(['--format=Markdown']);
      expect(result2.errors).toHaveLength(1);
      expect(result2.errors[0]).toContain("Invalid format 'Markdown'");
    });
  });

  describe('parseArguments - Backend Validation', () => {
    it('should list valid backend options in error message', () => {
      const result = parseArguments(['--backend=unknown']);
      expect(result.errors).toHaveLength(1);
      const errorMsg = result.errors[0];
      
      // Error should include all valid options
      expect(errorMsg).toContain('s3');
      expect(errorMsg).toContain('azurerm');
      expect(errorMsg).toContain('gcs');
    });

    it('should handle backend-specific parsing', () => {
      const result1 = parseArguments(['--backend=s3']);
      expect(result1.backendFilter).toBe('s3');
      expect(result1.errors).toHaveLength(0);

      const result2 = parseArguments(['--backend=azurerm']);
      expect(result2.backendFilter).toBe('azurerm');
      expect(result2.errors).toHaveLength(0);

      const result3 = parseArguments(['--backend=gcs']);
      expect(result3.backendFilter).toBe('gcs');
      expect(result3.errors).toHaveLength(0);
    });
  });

  describe('parseArguments - Help Flag Priority', () => {
    it('should short-circuit on help flag', () => {
      // Help should take precedence, returning immediately without parsing other args
      const result1 = parseArguments(['--help', '--invalid', '--format=']);
      expect(result1.showHelp).toBe(true);
      // No other errors should be collected when help is shown

      const result2 = parseArguments(['-h', '--backend=invalid']);
      expect(result2.showHelp).toBe(true);
    });
  });

  describe('parseArguments - Argument Order Independence', () => {
    it('should produce same result regardless of argument order', () => {
      const args1 = ['--format=markdown', '--backend=s3'];
      const args2 = ['--backend=s3', '--format=markdown'];

      const result1 = parseArguments(args1);
      const result2 = parseArguments(args2);

      expect(result1.format).toBe(result2.format);
      expect(result1.backendFilter).toBe(result2.backendFilter);
      expect(result1.errors).toEqual(result2.errors);
    });
  });
});

describe('BackendDocsScraper', () => {
  let scraper: BackendDocsScraper;

  beforeEach(() => {
    scraper = new BackendDocsScraper();
  });

  describe('isLikelyExampleAttribute (via type assertion)', () => {
    // Access private method for testing
    const isExample = (name: string) => (scraper as any).isLikelyExampleAttribute(name);

    it('should identify my_bucket as example', () => {
      expect(isExample('my_bucket')).toBe(true);
    });

    it('should identify example as example', () => {
      expect(isExample('example')).toBe(true);
    });

    it('should identify my_ prefix as example', () => {
      expect(isExample('my_state_file')).toBe(true);
      expect(isExample('my_key')).toBe(true);
      expect(isExample('my_anything')).toBe(true);
    });

    it('should identify example_ prefix as example', () => {
      expect(isExample('example_bucket')).toBe(true);
      expect(isExample('example_key')).toBe(true);
      expect(isExample('example_value')).toBe(true);
    });

    it('should identify test_ prefix as example', () => {
      expect(isExample('test_bucket')).toBe(true);
      expect(isExample('test_value')).toBe(true);
      expect(isExample('test_anything')).toBe(true);
    });

    it('should not identify valid attributes as examples', () => {
      expect(isExample('bucket')).toBe(false);
      expect(isExample('region')).toBe(false);
      expect(isExample('encrypt')).toBe(false);
      expect(isExample('kms_key_id')).toBe(false);
      expect(isExample('dynamodb_table')).toBe(false);
      expect(isExample('access_key')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isExample('MY_BUCKET')).toBe(true);
      expect(isExample('Example')).toBe(true);
      expect(isExample('TEST_Value')).toBe(true);
      expect(isExample('EXAMPLE_KEY')).toBe(true);
    });

    it('should handle edge cases', () => {
      // Attributes that start with valid prefixes but aren't examples
      expect(isExample('testimony')).toBe(false); // starts with 'test' but not 'test_'
      expect(isExample('exemplar')).toBe(false); // starts with 'exam' but not 'example'
      
      // Edge case: just the prefix
      expect(isExample('my_')).toBe(true);
      expect(isExample('example_')).toBe(true);
      expect(isExample('test_')).toBe(true);
    });
  });
});

describe('SchemaComparator', () => {
  let comparator: SchemaComparator;

  beforeEach(() => {
    comparator = new SchemaComparator();
  });

  describe('compareDrift', () => {
    it('should detect missing attributes (in docs, not in schema)', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'region', type: 'string', required: false }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'region' },
        { name: 'encrypt' },
        { name: 'kms_key_id' }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.missing).toHaveLength(2);
      expect(drift.missing.map(a => a.name)).toEqual(['encrypt', 'kms_key_id']);
    });

    it('should detect extra attributes (in schema, not in docs)', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'region', type: 'string', required: false },
          { name: 'old_attribute', type: 'string', required: false },
          { name: 'removed_attribute', type: 'string', required: false }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'region' }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.extra).toHaveLength(2);
      expect(drift.extra).toContain('old_attribute');
      expect(drift.extra).toContain('removed_attribute');
    });

    it('should detect deprecated attributes', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'lock_table', type: 'string', required: false },
          { name: 'dynamodb_table', type: 'string', required: false }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'lock_table', deprecated: true },
        { name: 'dynamodb_table' }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.deprecated).toHaveLength(1);
      expect(drift.deprecated).toEqual(['lock_table']);
    });

    it('should not include deprecated attributes not in schema', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'old_attribute', deprecated: true }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.deprecated).toHaveLength(0);
      expect(drift.missing).toHaveLength(1);
    });

    it('should return no drift when schemas match', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'region', type: 'string', required: false },
          { name: 'encrypt', type: 'boolean', required: false }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'region' },
        { name: 'encrypt' }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.missing).toHaveLength(0);
      expect(drift.extra).toHaveLength(0);
      expect(drift.deprecated).toHaveLength(0);
    });

    it('should handle empty schemas', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: []
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'region' }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.missing).toHaveLength(2);
      expect(drift.extra).toHaveLength(0);
    });

    it('should handle empty doc attributes', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'region', type: 'string', required: false }
        ]
      };
      
      const docAttributes: Array<{name: string, deprecated?: boolean}> = [];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.missing).toHaveLength(0);
      expect(drift.extra).toHaveLength(2);
    });

    it('should include backend and schema file in result', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [{ name: 'bucket', type: 'string', required: true }]
      };
      
      const docAttributes = [{ name: 'bucket' }];
      
      const drift = comparator.compareDrift('aws-s3-complete.json', schema, docAttributes);
      
      expect(drift.backend).toBe('s3');
      expect(drift.schemaFile).toBe('aws-s3-complete.json');
    });

    it('should handle all three drift types simultaneously', () => {
      const schema = {
        id: 's3',
        name: 'AWS S3',
        attributes: [
          { name: 'bucket', type: 'string', required: true },
          { name: 'old_attr', type: 'string', required: false },
          { name: 'lock_table', type: 'string', required: false }
        ]
      };
      
      const docAttributes = [
        { name: 'bucket' },
        { name: 'new_attr' },
        { name: 'lock_table', deprecated: true }
      ];
      
      const drift = comparator.compareDrift('s3.json', schema, docAttributes);
      
      expect(drift.missing).toHaveLength(1);
      expect(drift.missing[0].name).toBe('new_attr');
      expect(drift.extra).toHaveLength(1);
      expect(drift.extra[0]).toBe('old_attr');
      expect(drift.deprecated).toHaveLength(1);
      expect(drift.deprecated[0]).toBe('lock_table');
    });
  });
});

describe('formatMarkdown', () => {
  it('should format report with no drift', () => {
    const report = {
      hasDrift: false,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {}
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('# Schema Drift Report');
    expect(markdown).toContain('**Generated:** 2025-12-10T12:00:00Z');
    expect(markdown).toContain('**Status:** ✅ No Drift');
    expect(markdown).toContain('All schema files are up to date with Terraform documentation');
  });

  it('should format report with missing attributes', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [
            { name: 'new_attribute', description: 'A new attribute for testing' }
          ],
          extra: [],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('# Schema Drift Report');
    expect(markdown).toContain('**Status:** ⚠️ Drift Detected');
    expect(markdown).toContain('## S3 - s3.json');
    expect(markdown).toContain('### ⚠️ Missing Attributes');
    expect(markdown).toContain('`new_attribute`');
    expect(markdown).toContain('A new attribute for testing');
  });

  it('should format report with extra attributes', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [],
          extra: ['old_attribute', 'removed_attribute'],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('### ℹ️ Extra Attributes');
    expect(markdown).toContain('`old_attribute`');
    expect(markdown).toContain('`removed_attribute`');
    expect(markdown).toContain('Deprecated (removed from docs)');
  });

  it('should format report with deprecated attributes', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [],
          extra: [],
          deprecated: ['lock_table', 'legacy_option']
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('### 🔄 Deprecated Attributes');
    expect(markdown).toContain('`lock_table`');
    expect(markdown).toContain('`legacy_option`');
  });

  it('should include next steps section', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [{ name: 'test' }],
          extra: [],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('## Next Steps');
    expect(markdown).toContain('Review the drift report');
    expect(markdown).toContain('Verify changes in Terraform documentation');
    expect(markdown).toContain('Update schema files as needed');
  });

  it('should handle multiple backends', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [{ name: 's3_attr' }],
          extra: [],
          deprecated: []
        }],
        azurerm: [{
          backend: 'azurerm',
          schemaFile: 'azure-blob.json',
          missing: [{ name: 'azure_attr' }],
          extra: [],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('## S3 - s3.json');
    expect(markdown).toContain('`s3_attr`');
    expect(markdown).toContain('## AZURERM - azure-blob.json');
    expect(markdown).toContain('`azure_attr`');
  });

  it('should skip backends with no drift', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [],
          extra: [],
          deprecated: []
        }],
        azurerm: [{
          backend: 'azurerm',
          schemaFile: 'azure-blob.json',
          missing: [{ name: 'azure_attr' }],
          extra: [],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).not.toContain('## S3');
    expect(markdown).toContain('## AZURERM - azure-blob.json');
  });

  it('should handle attributes without descriptions', () => {
    const report = {
      hasDrift: true,
      timestamp: '2025-12-10T12:00:00Z',
      backends: {
        s3: [{
          backend: 's3',
          schemaFile: 's3.json',
          missing: [{ name: 'no_description_attr' }],
          extra: [],
          deprecated: []
        }]
      }
    };

    const markdown = formatMarkdown(report);
    
    expect(markdown).toContain('`no_description_attr`');
    expect(markdown).not.toContain('undefined');
  });
});
