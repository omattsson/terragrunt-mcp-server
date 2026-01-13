#!/usr/bin/env tsx
/**
 * Update backend schemas based on drift detection results
 * This script adds missing attributes and marks deprecated ones
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface SchemaAttribute {
  name: string;
  type: string;
  required: boolean;
  description: string;
  deprecated?: boolean;
  example?: any;
  defaultValue?: any;
  pattern?: string;
  validValues?: string[];
}

interface BackendSchema {
  $schema: string;
  id: string;
  name: string;
  description: string;
  provider: string;
  backend: string;
  terraformDocsUrl: string;
  version: string;
  lastUpdated: string;
  attributes: SchemaAttribute[];
}

// Missing attributes for s3.json (essential)
const s3MissingAttributes: Partial<SchemaAttribute>[] = [
  {
    name: 'use_lockfile',
    type: 'boolean',
    required: false,
    description: 'Whether to use a lockfile for locking the state file. Defaults to false.',
    defaultValue: false
  },
  {
    name: 'allowed_account_ids',
    type: 'list',
    required: false,
    description: 'List of allowed AWS account IDs to prevent potential destruction of a live environment. Conflicts with forbidden_account_ids.'
  },
  {
    name: 'forbidden_account_ids',
    type: 'list',
    required: false,
    description: 'List of forbidden AWS account IDs to prevent potential destruction of a live environment. Conflicts with allowed_account_ids.'
  },
  {
    name: 'custom_ca_bundle',
    type: 'string',
    required: false,
    description: 'File containing custom root and intermediate certificates. Can also be set using the AWS_CA_BUNDLE environment variable.'
  },
  {
    name: 'ec2_metadata_service_endpoint',
    type: 'string',
    required: false,
    description: 'Custom endpoint URL for the EC2 Instance Metadata Service (IMDS) API. Can also be set with the AWS_EC2_METADATA_SERVICE_ENDPOINT environment variable.'
  },
  {
    name: 'ec2_metadata_service_endpoint_mode',
    type: 'string',
    required: false,
    description: 'Mode to use in communicating with the metadata service. Valid values are IPv4 and IPv6. Can also be set with the AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE environment variable.',
    validValues: ['IPv4', 'IPv6']
  },
  {
    name: 'http_proxy',
    type: 'string',
    required: false,
    description: 'URL of a proxy to use for HTTP requests when accessing the AWS API. Can also be set using the HTTP_PROXY or http_proxy environment variables.'
  },
  {
    name: 'https_proxy',
    type: 'string',
    required: false,
    description: 'URL of a proxy to use for HTTPS requests when accessing the AWS API. Can also be set using the HTTPS_PROXY or https_proxy environment variables.'
  },
  {
    name: 'insecure',
    type: 'boolean',
    required: false,
    description: 'Whether to explicitly allow the backend to perform "insecure" SSL requests. If omitted, the default value is false.',
    defaultValue: false
  },
  {
    name: 'no_proxy',
    type: 'string',
    required: false,
    description: 'Comma-separated list of hosts that should not use HTTP or HTTPS proxies.'
  },
  {
    name: 'retry_mode',
    type: 'string',
    required: false,
    description: 'Specifies how retries are attempted. Valid values are standard and adaptive. Can also be configured using the AWS_RETRY_MODE environment variable.',
    validValues: ['standard', 'adaptive']
  },
  {
    name: 'sts_region',
    type: 'string',
    required: false,
    description: 'AWS region for STS. If unset, AWS will use the same region for STS as other non-STS operations.'
  },
  {
    name: 'use_dualstack_endpoint',
    type: 'boolean',
    required: false,
    description: 'Force the backend to resolve endpoints with DualStack capability. Can also be set with the AWS_USE_DUALSTACK_ENDPOINT environment variable.'
  },
  {
    name: 'use_fips_endpoint',
    type: 'boolean',
    required: false,
    description: 'Force the backend to resolve endpoints with FIPS capability. Can also be set with the AWS_USE_FIPS_ENDPOINT environment variable.'
  },
  // Deprecated but still documented
  {
    name: 'dynamodb_endpoint',
    type: 'string',
    required: false,
    deprecated: true,
    description: '(Deprecated) Custom endpoint URL for the AWS DynamoDB API. Use endpoints.dynamodb instead.'
  },
  {
    name: 'iam_endpoint',
    type: 'string',
    required: false,
    deprecated: true,
    description: '(Deprecated) Custom endpoint URL for the AWS IAM API. Use endpoints.iam instead.'
  },
  {
    name: 'sts_endpoint',
    type: 'string',
    required: false,
    deprecated: true,
    description: '(Deprecated) Custom endpoint URL for the AWS STS API. Use endpoints.sts instead.'
  },
  {
    name: 'endpoint',
    type: 'string',
    required: false,
    deprecated: true,
    description: '(Deprecated) Custom endpoint URL for the AWS S3 API. Use endpoints.s3 instead.'
  },
  {
    name: 'shared_credentials_file',
    type: 'string',
    required: false,
    deprecated: true,
    description: '(Deprecated, use shared_credentials_files instead) Path to the AWS shared credentials file. Defaults to ~/.aws/credentials.'
  }
];

// Missing attributes for azure-blob.json
const azureMissingAttributes: Partial<SchemaAttribute>[] = [
  {
    name: 'use_microsoft_graph',
    type: 'boolean',
    required: false,
    description: 'Should the Azure Storage API use Microsoft Graph for authorization? Defaults to false.',
    defaultValue: false
  }
];

// Attributes to mark as deprecated
const s3DeprecatedAttributes = ['dynamodb_table', 'force_path_style'];

async function updateSchema(schemaPath: string, missingAttrs: Partial<SchemaAttribute>[], deprecatedAttrs: string[]) {
  console.log(`\nUpdating ${path.basename(schemaPath)}...`);
  
  const content = await fs.readFile(schemaPath, 'utf-8');
  const schema: BackendSchema = JSON.parse(content);
  
  // Mark existing attributes as deprecated
  let deprecatedCount = 0;
  for (const attr of schema.attributes) {
    if (deprecatedAttrs.includes(attr.name) && !attr.deprecated) {
      attr.deprecated = true;
      if (!attr.description.includes('Deprecated')) {
        attr.description = `(Deprecated) ${attr.description}`;
      }
      deprecatedCount++;
      console.log(`  ✓ Marked ${attr.name} as deprecated`);
    }
  }
  
  // Add missing attributes
  const existingNames = new Set(schema.attributes.map(a => a.name));
  let addedCount = 0;
  
  for (const missingAttr of missingAttrs) {
    if (!existingNames.has(missingAttr.name!)) {
      schema.attributes.push(missingAttr as SchemaAttribute);
      addedCount++;
      console.log(`  ✓ Added ${missingAttr.name}${missingAttr.deprecated ? ' (deprecated)' : ''}`);
    }
  }
  
  // Update metadata
  schema.version = '1.1.0';
  schema.lastUpdated = new Date().toISOString().split('T')[0];
  
  // Write back
  await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2) + '\n', 'utf-8');
  
  console.log(`  ✅ Updated: ${addedCount} attributes added, ${deprecatedCount} marked deprecated`);
  console.log(`  📦 New version: ${schema.version}`);
  
  return { added: addedCount, deprecated: deprecatedCount };
}

async function main() {
  const schemasDir = path.join(process.cwd(), 'schemas/backends');
  
  console.log('🔧 Updating backend schemas from drift detection...\n');
  
  try {
    // Update s3.json
    const s3Stats = await updateSchema(
      path.join(schemasDir, 's3.json'),
      s3MissingAttributes,
      s3DeprecatedAttributes
    );
    
    // Update azure-blob.json
    const azureStats = await updateSchema(
      path.join(schemasDir, 'azure-blob.json'),
      azureMissingAttributes,
      []
    );
    
    console.log('\n✅ Schema update complete!');
    console.log(`\nSummary:`);
    console.log(`  - s3.json: +${s3Stats.added} attributes, ${s3Stats.deprecated} deprecated`);
    console.log(`  - azure-blob.json: +${azureStats.added} attributes, ${azureStats.deprecated} deprecated`);
    
  } catch (error) {
    console.error('❌ Error updating schemas:', error);
    process.exit(1);
  }
}

main();
