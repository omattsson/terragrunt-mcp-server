#!/usr/bin/env ts-node
/**
 * Schema Drift Detection Script
 * 
 * Compares Terraform backend documentation with our schema files to detect:
 * - Missing attributes (in docs, not in our schema)
 * - Extra attributes (in our schema, not in docs)
 * - Deprecated attributes (marked as deprecated in docs)
 * 
 * Usage:
 *   npm run check-schema-drift
 *   ts-node scripts/check-schema-drift.ts --format=markdown
 *   ts-node scripts/check-schema-drift.ts --backend=s3
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { load } from 'cheerio';

// Backend configuration mapping
interface BackendConfig {
  id: string;
  name: string;
  docsUrl: string;
  schemaFiles: string[]; // Can have multiple schemas (essential, complete, etc.)
}

const BACKENDS: BackendConfig[] = [
  {
    id: 's3',
    name: 'AWS S3',
    docsUrl: 'https://developer.hashicorp.com/terraform/language/settings/backends/s3',
    schemaFiles: ['s3.json', 'aws-s3-complete.json']
  },
  {
    id: 'azurerm',
    name: 'Azure Blob Storage',
    docsUrl: 'https://developer.hashicorp.com/terraform/language/settings/backends/azurerm',
    schemaFiles: ['azure-blob.json']
  },
  {
    id: 'gcs',
    name: 'Google Cloud Storage',
    docsUrl: 'https://developer.hashicorp.com/terraform/language/settings/backends/gcs',
    schemaFiles: ['gcp-gcs-complete.json']
  }
];

// Types
interface AttributeInfo {
  name: string;
  description?: string;
  deprecated?: boolean;
}

interface SchemaAttribute {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  deprecated?: boolean;
}

interface BackendSchema {
  id: string;
  name: string;
  attributes: SchemaAttribute[];
}

interface DriftResult {
  backend: string;
  schemaFile: string;
  missing: AttributeInfo[];
  extra: string[];
  deprecated: string[];
}

interface DriftReport {
  hasDrift: boolean;
  timestamp: string;
  backends: Record<string, DriftResult[]>;
}

/**
 * BackendDocsScraper - Fetches and parses Terraform backend documentation
 */
export class BackendDocsScraper {
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;

  /**
   * Escapes special regex characters in a string to be used in RegExp constructor
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if attribute name looks like an example value
   */
  private isLikelyExampleAttribute(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName === 'my_bucket' ||
           lowerName === 'example' ||
           lowerName.startsWith('my_') ||
           lowerName.startsWith('example_') ||
           lowerName.startsWith('test_');
  }

  /**
   * Fetch and parse backend documentation to extract attributes
   */
  async scrapeBackendAttributes(url: string): Promise<AttributeInfo[]> {
    console.error(`Fetching documentation from ${url}...`);
    
    const html = await this.fetchWithRetry(url);
    const $ = load(html);
    
    const attributes: AttributeInfo[] = [];
    
    // Extraction strategy overview:
    // - We apply three independent parsing strategies against the same document:
    //   1) Anchor IDs (modern docs structure)
    //   2) Definition lists / bullet lists around configuration sections
    //   3) Legacy tables format used by some older backend docs
    // - All strategies run for each page; their results are merged and deduplicated
    //   so that a given attribute only appears once in the final attributes array.
    // - Strategy 3 (tables) exists primarily as a fallback for legacy docs that have
    //   not yet been migrated to the newer anchor- or list-based formats.
    
    // Strategy 1: Extract attributes from anchor IDs (modern HashiCorp docs structure)
    // The new docs use <a id="attribute_name"> elements to mark each attribute
    $('a[id]').each((_, anchor) => {
      const id = $(anchor).attr('id');
      if (!id) return;
      
      // Valid attribute name pattern
      if (/^[a-z_][a-z0-9_]*$/i.test(id) && !this.isLikelyExampleAttribute(id)) {
        // Find the parent list item or containing element
        const listItem = $(anchor).closest('li');
        
        if (listItem.length > 0) {
          const liText = listItem.text();
          
          // Extract description (text after the attribute name)
          // Remove the attribute name itself and common prefixes
          let description = liText
            .replace(new RegExp(`^${this.escapeRegExp(id)}`, 'i'), '')
            .replace(/^\s*[-:]\s*/, '')
            .replace(/^\s*\(Optional\)\s*/i, '')
            .replace(/^\s*\(Required\)\s*/i, '')
            .trim()
            .substring(0, 200);
          
          // Check if marked as deprecated
          const deprecated = liText.toLowerCase().includes('deprecated') || 
                            liText.toLowerCase().includes('legacy');
          
          attributes.push({
            name: id,
            description: description || undefined,
            deprecated
          });
        }
      }
    });
    
    // Strategy 2: Look for list items with code elements (fallback for different structures)
    $('.mdx-lists_listItem__nkqhg, li').each((_, li) => {
      const codeElem = $(li).find('code').first();
      if (codeElem.length > 0) {
        const name = codeElem.text().trim();
        
        // Valid attribute name pattern, not an example
        if (/^[a-z_][a-z0-9_]*$/i.test(name) && 
            !this.isLikelyExampleAttribute(name)) {
          
          const liText = $(li).text();
          const description = liText
            .replace(new RegExp(this.escapeRegExp(name), 'i'), '')
            .replace(/^\s*[-:]\s*/, '')
            .replace(/^\s*\(Optional\)\s*/i, '')
            .replace(/^\s*\(Required\)\s*/i, '')
            .trim()
            .substring(0, 200);
          
          const deprecated = liText.toLowerCase().includes('deprecated') ||
                            liText.toLowerCase().includes('legacy');
          
          // Only add if not already captured by Strategy 1
          if (!attributes.some(a => a.name === name)) {
            attributes.push({
              name,
              description: description || undefined,
              deprecated
            });
          }
        }
      }
    });
    
    // Strategy 3: Look for parameter tables (legacy docs format)
    $('table').each((_, table) => {
      const headers = $(table).find('th').map((_, th) => $(th).text().toLowerCase()).get();
      
      // Check if this looks like a parameter table
      if (headers.some(h => h.includes('name') || h.includes('parameter') || h.includes('argument'))) {
        $(table).find('tbody tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length > 0) {
            const nameCell = cells.first();
            const name = nameCell.find('code').text().trim() || nameCell.text().trim();
            
            if (/^[a-z_][a-z0-9_]*$/i.test(name) && !this.isLikelyExampleAttribute(name)) {
              const description = cells.length > 1 
                ? cells.eq(1).text().trim().substring(0, 200) 
                : '';
              const rowText = $(row).text().toLowerCase();
              const deprecated = rowText.includes('deprecated') || rowText.includes('legacy');
              
              // Only add if not already captured by previous strategies
              if (!attributes.some(a => a.name === name)) {
                attributes.push({
                  name,
                  description: description || undefined,
                  deprecated
                });
              }
            }
          }
        });
      }
    });
    
    // Deduplicate by name, merging information from multiple sources
    const uniqueAttrs = new Map<string, AttributeInfo>();
    for (const attr of attributes) {
      const existing = uniqueAttrs.get(attr.name);
      if (!existing) {
        uniqueAttrs.set(attr.name, attr);
      } else {
        // Merge: prefer longer/richer description, preserve deprecated flag
        uniqueAttrs.set(attr.name, {
          name: attr.name,
          description: (existing.description && existing.description.length >= (attr.description?.length || 0))
            ? existing.description
            : attr.description,
          deprecated: existing.deprecated || attr.deprecated
        });
      }
    }
    
    const result = Array.from(uniqueAttrs.values());
    console.error(`Found ${result.length} attributes in documentation`);
    
    // Sanity check: warn if core attributes are missing (indicates parsing failure)
    this.validateCoreAttributes(result, url);
    
    return result;
  }

  /**
   * Validate that core attributes are found (sanity check for parsing accuracy)
   */
  private validateCoreAttributes(attributes: AttributeInfo[], url: string): void {
    const attrNames = new Set(attributes.map(a => a.name));
    
    // Define expected core attributes per backend type
    const coreAttributes: Record<string, string[]> = {
      's3': ['bucket', 'key', 'region'],
      'azurerm': ['storage_account_name', 'container_name', 'key'],
      'gcs': ['bucket', 'prefix']
    };
    
    // Determine backend type from URL
    for (const [backend, required] of Object.entries(coreAttributes)) {
      if (url.includes(`/${backend}`) || url.endsWith(`/${backend}`)) {
        const missing = required.filter(attr => !attrNames.has(attr));
        if (missing.length > 0) {
          console.error(`⚠️  WARNING: Core attributes missing for ${backend} backend: ${missing.join(', ')}`);
          console.error(`    This likely indicates a parsing failure. Manual verification recommended.`);
        }
        break;
      }
    }
  }

  /**
   * Fetch URL with retry logic
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<string> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        console.error(`Fetch failed (attempt ${attempt}/${this.retryAttempts}), retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * SchemaComparator - Loads and compares schema files with documentation
 */
export class SchemaComparator {
  private readonly schemasDir: string;

  constructor(schemasDir: string = 'schemas/backends') {
    this.schemasDir = schemasDir;
  }

  /**
   * Load schema file
   */
  async loadSchema(filename: string): Promise<BackendSchema> {
    // Whitelist validation: only allow valid schema filenames
    if (!/^[a-z0-9-]+\.json$/i.test(filename)) {
      throw new Error(`Invalid schema filename: ${filename}`);
    }
    const filePath = path.join(this.schemasDir, filename);
    // Verify the resolved path is still within schemasDir
    // Only allow files strictly within schemasDir, not the directory itself
    const resolvedPath = path.normalize(path.resolve(filePath));
    const resolvedDir = path.normalize(path.resolve(this.schemasDir));
    if (resolvedPath !== resolvedDir && !resolvedPath.startsWith(resolvedDir + path.sep)) {
      throw new Error(`Schema file path outside of schemas directory: ${filename}`);
    }
    const content = await fs.readFile(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in schema file ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Compare documentation attributes with schema
   */
  compareDrift(
    schemaFile: string,
    schema: BackendSchema,
    docAttributes: AttributeInfo[]
  ): DriftResult {
    const schemaAttrNames = new Set(schema.attributes.map(a => a.name));
    const docAttrNames = new Set(docAttributes.map(a => a.name));
    
    // Find missing attributes (in docs, not in schema)
    const missing = docAttributes.filter(attr => !schemaAttrNames.has(attr.name));
    
    // Find extra attributes (in schema, not in docs)
    const extra = schema.attributes
      .filter(attr => !docAttrNames.has(attr.name))
      .map(attr => attr.name);
    
    // Find deprecated attributes
    const deprecated = docAttributes
      .filter(attr => attr.deprecated && schemaAttrNames.has(attr.name))
      .map(attr => attr.name);
    
    return {
      backend: schema.id,
      schemaFile,
      missing,
      extra,
      deprecated
    };
  }
}

/**
 * Format drift report as markdown
 */
export function formatMarkdown(report: DriftReport): string {
  let output = '# Schema Drift Report\n\n';
  output += `**Generated:** ${report.timestamp}\n\n`;
  output += `**Status:** ${report.hasDrift ? '⚠️ Drift Detected' : '✅ No Drift'}\n\n`;
  
  if (!report.hasDrift) {
    output += 'All schema files are up to date with Terraform documentation.\n';
    return output;
  }
  
  for (const results of Object.values(report.backends)) {
    for (const result of results) {
      const hasDrift = result.missing.length > 0 || result.extra.length > 0 || result.deprecated.length > 0;
      
      if (!hasDrift) continue;
      
      output += `## ${result.backend.toUpperCase()} - ${result.schemaFile}\n\n`;
      
      if (result.missing.length > 0) {
        output += '### ⚠️ Missing Attributes (in docs, not in schema)\n\n';
        for (const attr of result.missing) {
          output += `- **\`${attr.name}\`**`;
          if (attr.description) {
            output += `: ${attr.description}`;
          }
          output += '\n';
        }
        output += '\n';
      }
      
      if (result.extra.length > 0) {
        output += '### ℹ️ Extra Attributes (in schema, not in docs)\n\n';
        output += 'These attributes exist in our schema but were not found in the documentation. They may be:\n';
        output += '- Deprecated (removed from docs)\n';
        output += '- Documented elsewhere\n';
        output += '- Terraform version-specific\n\n';
        for (const attr of result.extra) {
          output += `- \`${attr}\`\n`;
        }
        output += '\n';
      }
      
      if (result.deprecated.length > 0) {
        output += '### 🔄 Deprecated Attributes\n\n';
        output += 'These attributes are marked as deprecated in the documentation:\n\n';
        for (const attr of result.deprecated) {
          output += `- \`${attr}\`\n`;
        }
        output += '\n';
      }
      
      output += '---\n\n';
    }
  }
  
  output += '## Next Steps\n\n';
  output += '1. Review the drift report above\n';
  output += '2. Verify changes in Terraform documentation\n';
  output += '3. Update schema files as needed\n';
  output += '4. Test generated templates with new attributes\n';
  output += '5. Update documentation if backend options changed\n';
  
  return output;
}

/**
 * Parse command-line arguments
 * Exported for testing
 */
export function parseArguments(args: string[]): {
  format: 'json' | 'markdown';
  backendFilter?: string;
  showHelp: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let format: 'json' | 'markdown' = 'json';
  let backendFilter: string | undefined = undefined;
  let showHelp = false;

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp = true;
    return { format, backendFilter, showHelp, errors };
  }

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      const value = arg.split('=', 2)[1]?.trim();
      if (typeof value === 'undefined' || value === '') {
        errors.push('Error: --format requires a non-empty value');
      } else if (value !== 'json' && value !== 'markdown') {
        errors.push(`Error: Invalid format '${value}'. Must be 'json' or 'markdown'.`);
      } else {
        format = value as 'json' | 'markdown';
      }
    } else if (arg.startsWith('--backend=')) {
      const value = arg.split('=', 2)[1]?.trim();
      if (typeof value === 'undefined' || value === '') {
        errors.push('Error: --backend requires a non-empty value');
      } else {
        const backendIds = BACKENDS.map(b => b.id);
        if (!backendIds.includes(value)) {
          errors.push(`Error: Backend '${value}' not found. Valid options: ${backendIds.join(', ')}`);
        } else {
          backendFilter = value;
        }
      }
    } else if (arg === '--help' || arg === '-h') {
      // already handled above
    } else if (arg.startsWith('--')) {
      errors.push(`Error: Unknown argument '${arg}'`);
    }
  }

  return { format, backendFilter, showHelp, errors };
}

/**
 * Main execution
 */
async function main() {
  function printUsage() {
    console.log('Usage: check-schema-drift [options]');
    console.log('Options:');
    console.log('  --format=<json|markdown>    Output format (default: json)');
    console.log('  --backend=<s3|azurerm|gcs>  Check specific backend only');
    console.log('  --help, -h                  Show this help message');
  }

  const args = process.argv.slice(2);
  const parsed = parseArguments(args);

  // Show help if requested
  if (parsed.showHelp) {
    printUsage();
    process.exit(0);
  }

  // Exit on errors
  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      console.error(error);
    }
    printUsage();
    process.exit(1);
  }

  const { format, backendFilter } = parsed;
  
  const scraper = new BackendDocsScraper();
  const comparator = new SchemaComparator();
  
  const report: DriftReport = {
    hasDrift: false,
    timestamp: new Date().toISOString(),
    backends: {}
  };
  
  // Filter backends if specified
  const backendsToCheck = backendFilter
    ? BACKENDS.filter(b => b.id === backendFilter)
    : BACKENDS;
  
  for (const backend of backendsToCheck) {
    console.error(`\nChecking ${backend.name} (${backend.id})...`);
    
    try {
      // Scrape documentation
      const docAttributes = await scraper.scrapeBackendAttributes(backend.docsUrl);
      
      // Compare with each schema file
      const backendResults: DriftResult[] = [];
      
      for (const schemaFile of backend.schemaFiles) {
        try {
          console.error(`  Comparing with ${schemaFile}...`);
          const schema = await comparator.loadSchema(schemaFile);
          const drift = comparator.compareDrift(schemaFile, schema, docAttributes);
          
          const hasDrift = drift.missing.length > 0 || drift.extra.length > 0 || drift.deprecated.length > 0;
          if (hasDrift) {
            report.hasDrift = true;
            console.error(`  ⚠️  Drift detected: ${drift.missing.length} missing, ${drift.extra.length} extra, ${drift.deprecated.length} deprecated`);
          } else {
            console.error(`  ✅ No drift`);
          }
          
          backendResults.push(drift);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`  ❌ Error loading ${schemaFile}: ${errMsg}`);
        }
      }
      
      report.backends[backend.id] = backendResults;
      
      // Add delay between backends to be respectful
      if (backendsToCheck.indexOf(backend) < backendsToCheck.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error checking ${backend.name}: ${errMsg}`);
    }
  }
  
  // Output report
  if (format === 'markdown') {
    console.log(formatMarkdown(report));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  
  // Exit with success even if drift found (CI shouldn't fail)
  process.exit(0);
}

// Run if executed directly
// Always run main (script is intended to be executed directly)
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
