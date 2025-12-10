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
class BackendDocsScraper {
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 1000;

  /**
   * Fetch and parse backend documentation to extract attributes
   */
  async scrapeBackendAttributes(url: string): Promise<AttributeInfo[]> {
    console.error(`Fetching documentation from ${url}...`);
    
    const html = await this.fetchWithRetry(url);
    const $ = load(html);
    
    const attributes: AttributeInfo[] = [];
    
    // Strategy 1: Look for "Configuration" or "Arguments" section with proper attribute list parsing
    const configSection = $('#configuration, #arguments, #argument-reference, [id*="configuration"]').first();
    
    if (configSection.length > 0) {
      // Find list items that contain attribute definitions
      const nextElements = configSection.parent().nextAll();
      
      nextElements.each((_, elem) => {
        // Stop at next major heading
        if ($(elem).is('h1, h2')) return false;
        
        // Look for list items (ul/ol li) that define parameters
        $(elem).find('li').each((_, li) => {
          const liText = $(li).text();
          
          // Look for patterns like "attribute_name - description" or "attribute_name: description"
          const match = liText.match(/^([a-z_][a-z0-9_]*)\s*[-:]\s*(.+)/i);
          
          if (match) {
            const name = match[1].trim();
            const description = match[2].trim().substring(0, 200);
            
            // Skip example values that might look like attributes
            if (name.includes('my') || name.includes('example') || name.includes('test')) {
              return;
            }
            
            // Check if marked as deprecated
            const deprecated = liText.toLowerCase().includes('deprecated') || 
                              liText.toLowerCase().includes('legacy');
            
            attributes.push({
              name,
              description: description || undefined,
              deprecated
            });
          } else {
            // Also try to find code elements at the start of list items
            const firstCode = $(li).find('code').first();
            if (firstCode.length > 0) {
              const name = firstCode.text().trim();
              
              // Valid attribute name pattern, not an example
              if (/^[a-z_][a-z0-9_]*$/i.test(name) && 
                  !name.includes('my') && 
                  !name.includes('example')) {
                
                const description = $(li).text()
                  .replace(name, '')
                  .trim()
                  .substring(0, 200);
                
                const deprecated = $(li).text().toLowerCase().includes('deprecated');
                
                attributes.push({
                  name,
                  description: description || undefined,
                  deprecated
                });
              }
            }
          }
        });
      });
    }
    
    // Strategy 2: Look for parameter tables (common in HashiCorp docs)
    $('table').each((_, table) => {
      const headers = $(table).find('th').map((_, th) => $(th).text().toLowerCase()).get();
      
      // Check if this looks like a parameter table
      if (headers.some(h => h.includes('name') || h.includes('parameter') || h.includes('argument'))) {
        $(table).find('tbody tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length > 0) {
            const nameCell = cells.first();
            const name = nameCell.find('code').text().trim() || nameCell.text().trim();
            
            if (/^[a-z_][a-z0-9_]*$/i.test(name)) {
              const description = cells.eq(1).text().trim().substring(0, 200);
              const rowText = $(row).text().toLowerCase();
              const deprecated = rowText.includes('deprecated') || rowText.includes('legacy');
              
              attributes.push({
                name,
                description: description || undefined,
                deprecated
              });
            }
          }
        });
      }
    });
    
    // Deduplicate by name
    const uniqueAttrs = new Map<string, AttributeInfo>();
    for (const attr of attributes) {
      if (!uniqueAttrs.has(attr.name)) {
        uniqueAttrs.set(attr.name, attr);
      }
    }
    
    const result = Array.from(uniqueAttrs.values());
    console.error(`Found ${result.length} attributes in documentation`);
    
    return result;
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
class SchemaComparator {
  private readonly schemasDir: string;

  constructor(schemasDir: string = 'schemas/backends') {
    this.schemasDir = schemasDir;
  }

  /**
   * Load schema file
   */
  async loadSchema(filename: string): Promise<BackendSchema> {
    const filePath = path.join(this.schemasDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
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
function formatMarkdown(report: DriftReport): string {
  let output = '# Schema Drift Report\n\n';
  output += `**Generated:** ${report.timestamp}\n\n`;
  output += `**Status:** ${report.hasDrift ? '⚠️ Drift Detected' : '✅ No Drift'}\n\n`;
  
  if (!report.hasDrift) {
    output += 'All schema files are up to date with Terraform documentation.\n';
    return output;
  }
  
  for (const [backendId, results] of Object.entries(report.backends)) {
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
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'json';
  const backendFilter = args.find(a => a.startsWith('--backend='))?.split('=')[1];
  
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
  
  if (backendsToCheck.length === 0) {
    console.error(`Error: Backend '${backendFilter}' not found`);
    process.exit(1);
  }
  
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
          console.error(`  Error loading ${schemaFile}:`, error);
        }
      }
      
      report.backends[backend.id] = backendResults;
      
      // Add delay between backends to be respectful
      if (backendsToCheck.indexOf(backend) < backendsToCheck.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error checking ${backend.name}:`, error);
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
import { fileURLToPath } from 'url';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
