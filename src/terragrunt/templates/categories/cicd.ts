/**
 * CI/CD templates
 *
 * Opinionated Terragrunt configuration for running in CI/CD pipelines: it makes
 * runs non-interactive, signals automation to the CLI, and optionally adds an
 * auto-approve gate. Plan output and artifacts are a pipeline concern (they can
 * expose secrets in logs), so they live in the pipeline YAML documented in the
 * Configuration Generator guide, not in these templates.
 *
 * Syntax notes (verified against the pinned Terragrunt HCL reference):
 * - `extra_arguments` requires both `commands` and `arguments`; `env_vars` is
 *   optional. Each block below passes a real flag, not just env vars.
 * - `auto_approve` is a flag variable: only a truthy value enables its block, so
 *   `auto_approve = false` correctly leaves auto-approve off.
 */

import { ConfigTemplate } from '../../../types/templates.js';

const autoApproveVariable = {
  name: 'auto_approve',
  description: 'Set auto_approve=true to add an auto-approve block for apply/destroy. Omit it or set false to require manual approval. Enable only for trusted, gated pipelines.',
  type: 'boolean',
  required: false,
  flag: true,
  example: 'true',
};

const nonInteractiveBlock = `  # Non-interactive CI runs: never prompt, and signal automation to the CLI.
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }`;

const autoApproveBlock = `{{#auto_approve}}

  # Auto-approve applies. Enable only for trusted, gated pipelines.
  extra_arguments "auto_approve" {
    commands  = ["apply", "destroy"]
    arguments = ["-auto-approve"]
  }
{{/auto_approve}}`;

const exampleHcl = `terraform {
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }
}`;

export const cicdTemplates: ConfigTemplate[] = [
  // GitHub Actions
  {
    id: 'cicd-github-actions',
    name: 'GitHub Actions CI/CD Configuration',
    description: 'Terragrunt config for GitHub Actions: non-interactive runs, automation signalling, optional auto-approve',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'github-actions', 'automation'],
    variables: [autoApproveVariable],
    templateHcl: `terraform {
${nonInteractiveBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },

  // GitLab CI
  {
    id: 'cicd-gitlab',
    name: 'GitLab CI/CD Configuration',
    description: 'Terragrunt config for GitLab CI: non-interactive runs, automation signalling, optional auto-approve',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'gitlab', 'automation'],
    variables: [autoApproveVariable],
    templateHcl: `terraform {
${nonInteractiveBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },

  // Azure DevOps
  {
    id: 'cicd-azure-devops',
    name: 'Azure DevOps Pipeline Configuration',
    description: 'Terragrunt config for Azure DevOps: non-interactive runs, automation signalling, optional auto-approve. ARM_* auth comes from the pipeline environment.',
    category: 'cicd',
    cloudProvider: 'azure',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'azure-devops', 'automation', 'azure'],
    variables: [autoApproveVariable],
    templateHcl: `terraform {
  # The ARM_CLIENT_ID / ARM_CLIENT_SECRET / ARM_SUBSCRIPTION_ID / ARM_TENANT_ID
  # credentials come from the pipeline environment (service connection), not
  # hard-coded here.
${nonInteractiveBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },
];
