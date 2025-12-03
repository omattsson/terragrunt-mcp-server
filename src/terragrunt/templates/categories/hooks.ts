/**
 * Hook templates
 * Before and after hooks for Terragrunt operations
 */

import { ConfigTemplate } from '../../../types/templates.js';

export const hookTemplates: ConfigTemplate[] = [
  // Before Hook
  {
    id: 'before-hook',
    name: 'Before Hook',
    description: 'Execute commands before Terragrunt operations',
    category: 'hooks',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['hooks', 'before', 'automation'],
    variables: [
      {
        name: 'name',
        description: 'Hook name',
        type: 'string',
        required: true,
        example: 'validate',
      },
      {
        name: 'commands',
        description: 'Comma-separated list of commands to run hook on',
        type: 'string',
        required: true,
        example: 'apply,plan',
      },
      {
        name: 'execute',
        description: 'Comma-separated list of shell commands to execute',
        type: 'string',
        required: true,
        example: 'echo "Running validation"',
      },
      {
        name: 'working_dir',
        description: 'Working directory for hook execution',
        type: 'string',
        required: false,
        example: '.',
      },
    ],
    templateHcl: `terraform {
  before_hook "{{name}}" {
    commands     = [{{#commands}}"{{.}}"{{^last}}, {{/last}}{{/commands}}]
    execute      = [{{#execute}}"{{.}}"{{^last}}, {{/last}}{{/execute}}]
{{#working_dir}}
    working_dir  = "{{working_dir}}"
{{/working_dir}}
  }
}`,
    example: `terraform {
  before_hook "validate" {
    commands     = ["apply", "plan"]
    execute      = ["echo", "Running validation"]
  }
}`,
  },

  // After Hook
  {
    id: 'after-hook',
    name: 'After Hook',
    description: 'Execute commands after Terragrunt operations',
    category: 'hooks',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['hooks', 'after', 'automation'],
    variables: [
      {
        name: 'name',
        description: 'Hook name',
        type: 'string',
        required: true,
        example: 'notify',
      },
      {
        name: 'commands',
        description: 'Comma-separated list of commands to run hook on',
        type: 'string',
        required: true,
        example: 'apply',
      },
      {
        name: 'execute',
        description: 'Comma-separated list of shell commands to execute',
        type: 'string',
        required: true,
        example: 'echo "Deployment complete"',
      },
      {
        name: 'run_on_error',
        description: 'Run hook even if command fails',
        type: 'boolean',
        required: false,
        example: 'true',
        defaultValue: 'false',
      },
    ],
    templateHcl: `terraform {
  after_hook "{{name}}" {
    commands     = [{{#commands}}"{{.}}"{{^last}}, {{/last}}{{/commands}}]
    execute      = [{{#execute}}"{{.}}"{{^last}}, {{/last}}{{/execute}}]
{{#run_on_error}}
    run_on_error = {{run_on_error}}
{{/run_on_error}}
  }
}`,
    example: `terraform {
  after_hook "notify" {
    commands     = ["apply"]
    execute      = ["echo", "Deployment complete"]
    run_on_error = true
  }
}`,
  },
];
