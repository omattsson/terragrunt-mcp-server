/**
 * CI/CD templates
 *
 * Opinionated Terragrunt configuration for running in CI/CD pipelines: it makes
 * OpenTofu/Terraform runs automation-friendly (no variable prompts, automation
 * output) and optionally adds an auto-approve gate. Plan output and artifacts
 * are a pipeline concern (they can expose secrets in logs), so they live in the
 * pipeline YAML documented in the Configuration Generator guide.
 *
 * Note: `-input=false` and `TF_IN_AUTOMATION` only affect OpenTofu/Terraform.
 * To stop Terragrunt's own confirmation prompts, set `TG_NON_INTERACTIVE=true`
 * (or pass `--non-interactive`) in the pipeline — that is not something the
 * terraform block can configure.
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

const automationBlock = `  # Automation-friendly OpenTofu/Terraform: no variable prompts, automation output.
  # This does not disable Terragrunt's own prompts — set TG_NON_INTERACTIVE=true
  # (or pass --non-interactive) in the pipeline for that.
  extra_arguments "automation" {
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
  extra_arguments "automation" {
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
    description: 'Terragrunt config for GitHub Actions: automation-friendly OpenTofu args, optional auto-approve (set TG_NON_INTERACTIVE in the pipeline)',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'github-actions', 'automation'],
    variables: [autoApproveVariable],
    templateHcl: `terraform {
${automationBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },

  // GitLab CI
  {
    id: 'cicd-gitlab',
    name: 'GitLab CI/CD Configuration',
    description: 'Terragrunt config for GitLab CI: automation-friendly OpenTofu args, optional auto-approve (set TG_NON_INTERACTIVE in the pipeline)',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'gitlab', 'automation'],
    variables: [autoApproveVariable],
    templateHcl: `terraform {
${automationBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },

  // Azure DevOps
  {
    id: 'cicd-azure-devops',
    name: 'Azure DevOps Pipeline Configuration',
    description: 'Terragrunt config for Azure DevOps: automation-friendly OpenTofu args, optional auto-approve (set TG_NON_INTERACTIVE in the pipeline). ARM_* auth comes from the pipeline environment.',
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
${automationBlock}
${autoApproveBlock}
}`,
    example: exampleHcl,
  },
];
