/**
 * CI/CD templates
 *
 * Opinionated Terragrunt configuration for running in CI/CD pipelines:
 * non-interactive runs, automation signalling, plan output for the pipeline,
 * and an optional auto-approve gate. The platform-specific pipeline YAML lives
 * in the Configuration Generator guide, not here — these templates are the
 * Terragrunt-side config each pipeline consumes.
 *
 * Syntax notes (verified against the pinned Terragrunt HCL reference):
 * - `extra_arguments` requires both `commands` and `arguments`; `env_vars` is
 *   optional. Each block below passes a real flag, not just env vars.
 * - Optional blocks use the generator's presence-based conditionals: provide
 *   the `auto_approve` variable to add the auto-approve block; omit it to leave
 *   it out.
 */

import { ConfigTemplate } from '../../../types/templates.js';

const planFileVariable = {
  name: 'plan_file',
  description: 'Plan file the after_hook renders as JSON for the pipeline',
  type: 'string',
  required: false,
  defaultValue: 'tfplan',
  example: 'tfplan',
};

const autoApproveVariable = {
  name: 'auto_approve',
  description: 'Provide this variable (e.g. auto_approve=true) to add an auto-approve block for apply/destroy. Omit it to require manual approval. Enable only for trusted, gated pipelines.',
  type: 'boolean',
  required: false,
  example: 'true',
};

export const cicdTemplates: ConfigTemplate[] = [
  // GitHub Actions
  {
    id: 'cicd-github-actions',
    name: 'GitHub Actions CI/CD Configuration',
    description: 'Terragrunt config for GitHub Actions: non-interactive runs, plan JSON for the job summary, optional auto-approve',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'github-actions', 'automation'],
    variables: [planFileVariable, autoApproveVariable],
    templateHcl: `terraform {
  # Non-interactive CI runs: never prompt, and signal automation to the CLI.
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  # plan does not persist a plan file by default; write it so the after_hook can read it.
  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "{{plan_file}}"]
  }

  # Emit the plan as JSON so a workflow step can post it to the job summary.
  after_hook "plan_summary" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "{{plan_file}}"]
    run_on_error = false
  }
{{#auto_approve}}

  # Auto-approve applies. Enable only for trusted, gated pipelines.
  extra_arguments "auto_approve" {
    commands  = ["apply", "destroy"]
    arguments = ["-auto-approve"]
  }
{{/auto_approve}}
}`,
    example: `terraform {
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "tfplan"]
  }

  after_hook "plan_summary" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "tfplan"]
    run_on_error = false
  }
}`,
  },

  // GitLab CI
  {
    id: 'cicd-gitlab',
    name: 'GitLab CI/CD Configuration',
    description: 'Terragrunt config for GitLab CI: non-interactive runs, plan JSON for a job artifact, optional auto-approve',
    category: 'cicd',
    cloudProvider: 'multi',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'gitlab', 'automation'],
    variables: [planFileVariable, autoApproveVariable],
    templateHcl: `terraform {
  # Non-interactive CI runs: never prompt, and signal automation to the CLI.
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  # plan does not persist a plan file by default; write it so the after_hook can read it.
  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "{{plan_file}}"]
  }

  # Emit the plan as JSON so the GitLab job can publish it as an artifact.
  after_hook "plan_artifact" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "{{plan_file}}"]
    run_on_error = false
  }
{{#auto_approve}}

  # Auto-approve applies. Enable only for trusted, gated pipelines.
  extra_arguments "auto_approve" {
    commands  = ["apply", "destroy"]
    arguments = ["-auto-approve"]
  }
{{/auto_approve}}
}`,
    example: `terraform {
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "tfplan"]
  }

  after_hook "plan_artifact" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "tfplan"]
    run_on_error = false
  }
}`,
  },

  // Azure DevOps
  {
    id: 'cicd-azure-devops',
    name: 'Azure DevOps Pipeline Configuration',
    description: 'Terragrunt config for Azure DevOps: non-interactive runs, plan JSON, optional auto-approve. ARM_* auth comes from the pipeline environment.',
    category: 'cicd',
    cloudProvider: 'azure',
    source: 'builtin',
    version: '1.0.0',
    tags: ['cicd', 'azure-devops', 'automation', 'azure'],
    variables: [planFileVariable, autoApproveVariable],
    templateHcl: `terraform {
  # Non-interactive CI runs: never prompt, and signal automation to the CLI.
  # The ARM_CLIENT_ID / ARM_CLIENT_SECRET / ARM_SUBSCRIPTION_ID / ARM_TENANT_ID
  # credentials are provided by the pipeline environment (service connection),
  # not hard-coded here.
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  # plan does not persist a plan file by default; write it so the after_hook can read it.
  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "{{plan_file}}"]
  }

  # Emit the plan as JSON for the pipeline to publish.
  after_hook "plan_output" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "{{plan_file}}"]
    run_on_error = false
  }
{{#auto_approve}}

  # Auto-approve applies. Enable only for trusted, gated pipelines.
  extra_arguments "auto_approve" {
    commands  = ["apply", "destroy"]
    arguments = ["-auto-approve"]
  }
{{/auto_approve}}
}`,
    example: `terraform {
  extra_arguments "non_interactive" {
    commands  = ["init", "plan", "apply", "destroy"]
    arguments = ["-input=false"]

    env_vars = {
      TF_IN_AUTOMATION = "true"
    }
  }

  extra_arguments "plan_out" {
    commands  = ["plan"]
    arguments = ["-out", "tfplan"]
  }

  after_hook "plan_output" {
    commands     = ["plan"]
    execute      = ["tofu", "show", "-json", "tfplan"]
    run_on_error = false
  }
}`,
  },
];
