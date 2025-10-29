/**
 * Provider generation templates
 * Generate provider configuration blocks for cloud providers
 */

import { ConfigTemplate } from '../../../types/templates.js';

export const providerTemplates: ConfigTemplate[] = [
  // AWS Provider Generation
  {
    id: 'aws-generate-provider',
    name: 'AWS Provider Generation',
    description: 'Generate AWS provider configuration with account validation',
    category: 'provider',
    cloudProvider: 'aws',
    source: 'gruntwork',
    tags: ['provider', 'aws', 'generate'],
    variables: [
      {
        name: 'path',
        description: 'Path to generated provider file',
        type: 'string',
        required: true,
        example: 'provider.tf',
      },
      {
        name: 'if_exists',
        description: 'What to do if file exists',
        type: 'string',
        required: false,
        defaultValue: 'overwrite_terragrunt',
      },
      {
        name: 'region',
        description: 'AWS region',
        type: 'string',
        required: true,
        example: 'us-east-1',
      },
      {
        name: 'account_id',
        description: 'AWS account ID for validation',
        type: 'string',
        required: true,
        example: '123456789012',
      },
    ],
    templateHcl: `generate "provider" {
  path      = "{{path}}"
  if_exists = "{{if_exists}}"
  contents  = <<EOF
provider "aws" {
  region = "{{region}}"
  allowed_account_ids = ["{{account_id}}"]
}
EOF
}`,
    example: `generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
  allowed_account_ids = ["123456789012"]
}
EOF
}`,
  },
];
