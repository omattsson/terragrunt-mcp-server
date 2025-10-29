/**
 * Configuration templates
 * Inputs, version constraints, and other configuration settings
 */

import { ConfigTemplate } from '../../../types/templates.js';

export const configurationTemplates: ConfigTemplate[] = [
  // Basic Inputs Configuration
  {
    id: 'inputs-basic',
    name: 'Basic Inputs Configuration',
    description: 'Define input variables to pass to Terraform',
    category: 'inputs',
    cloudProvider: 'multi',
    source: 'builtin',
    tags: ['inputs', 'variables', 'configuration'],
    variables: [
      {
        name: 'environment',
        description: 'Environment name',
        type: 'string',
        required: false,
        example: 'production',
      },
      {
        name: 'region',
        description: 'Cloud region',
        type: 'string',
        required: false,
        example: 'us-east-1',
      },
    ],
    templateHcl: `inputs = {
{{#environment}}
  environment = "{{environment}}"
{{/environment}}
{{#region}}
  region      = "{{region}}"
{{/region}}
  # Add more inputs as needed
}`,
    example: `inputs = {
  environment = "production"
  region      = "us-east-1"
  project     = "my-project"
}`,
  },

  // Terraform Version Constraint
  {
    id: 'terraform-version',
    name: 'Terraform Version Constraint',
    description: 'Specify required Terraform version',
    category: 'configuration',
    cloudProvider: 'multi',
    source: 'builtin',
    tags: ['version', 'constraint', 'terraform'],
    variables: [
      {
        name: 'constraint',
        description: 'Version constraint expression',
        type: 'string',
        required: true,
        example: '>= 1.0.0, < 2.0.0',
      },
    ],
    templateHcl: `terraform_version_constraint = "{{constraint}}"`,
    example: `terraform_version_constraint = ">= 1.0.0, < 2.0.0"`,
  },
];
