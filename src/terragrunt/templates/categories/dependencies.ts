/**
 * Dependency templates
 * Module dependency configurations
 */

import { ConfigTemplate } from '../../../types/templates.js';

export const dependencyTemplates: ConfigTemplate[] = [
  // Single Module Dependency
  {
    id: 'dependency-single',
    name: 'Single Module Dependency',
    description: 'Configure dependency on another Terragrunt module',
    category: 'dependency',
    cloudProvider: 'multi',
    source: 'builtin',
    tags: ['dependency', 'module', 'outputs'],
    variables: [
      {
        name: 'name',
        description: 'Dependency name (used to reference outputs)',
        type: 'string',
        required: true,
        example: 'vpc',
      },
      {
        name: 'config_path',
        description: 'Path to dependency terragrunt.hcl',
        type: 'string',
        required: true,
        example: '../vpc',
      },
      {
        name: 'mock_outputs_allowed',
        description: 'Allow using mock outputs when dependency not applied',
        type: 'boolean',
        required: false,
        example: 'true',
        defaultValue: 'false',
      },
    ],
    templateHcl: `dependency "{{name}}" {
  config_path = "{{config_path}}"
{{#mock_outputs_allowed}}
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    # Add mock outputs here
  }
{{/mock_outputs_allowed}}
}`,
    example: `dependency "vpc" {
  config_path = "../vpc"
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    vpc_id = "mock-vpc-id"
  }
}`,
  },
];
