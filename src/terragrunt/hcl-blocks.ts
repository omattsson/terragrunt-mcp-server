/**
 * HCL Blocks Manager - Comprehensive reference for Terragrunt HCL configuration blocks
 * 
 * Provides structured documentation for all Terragrunt HCL blocks including:
 * - Block syntax and attributes
 * - Required vs optional attributes
 * - Usage examples
 * - Related blocks
 */

import {
  HCLBlock,
  HCLBlockCategory,
  HCLBlockCategoryInfo,
  HCLBlockSearchResult,
} from '../types/hcl-blocks.js';

/**
 * All Terragrunt HCL blocks with full documentation
 */
const HCL_BLOCKS: HCLBlock[] = [
  // ============================================================================
  // CORE BLOCKS
  // ============================================================================
  {
    name: 'terraform',
    displayName: 'Terraform Block',
    description: 'Specifies the Terraform source code to use and allows configuration of how Terragrunt interacts with Terraform. This is the primary block for defining what Terraform module to deploy.',
    category: 'core',
    syntax: 'terraform { ... }',
    attributes: [
      {
        name: 'source',
        type: 'string',
        required: true,
        description: 'The source URL for the Terraform module. Supports local paths, Git URLs, S3, GCS, and Terraform Registry.',
        example: '"git::https://github.com/gruntwork-io/terragrunt.git//modules/vpc?ref=v0.1.0"',
      },
      {
        name: 'include_in_copy',
        type: 'list',
        required: false,
        description: 'List of glob patterns for additional files to copy to the Terraform working directory.',
        example: '["*.json", "templates/**/*.tpl"]',
      },
      {
        name: 'extra_arguments',
        type: 'block',
        required: false,
        description: 'Nested block to pass additional CLI arguments to specific Terraform commands.',
        nestedAttributes: [
          { name: 'commands', type: 'list', required: true, description: 'List of Terraform commands to apply arguments to.', example: '["apply", "plan"]' },
          { name: 'arguments', type: 'list', required: false, description: 'List of arguments to pass.', example: '["-var-file=common.tfvars"]' },
          { name: 'required_var_files', type: 'list', required: false, description: 'Required variable files that must exist.', example: '["${get_terragrunt_dir()}/common.tfvars"]' },
          { name: 'optional_var_files', type: 'list', required: false, description: 'Optional variable files (no error if missing).', example: '["${get_terragrunt_dir()}/local.tfvars"]' },
          { name: 'env_vars', type: 'map', required: false, description: 'Environment variables to set.', example: '{ TF_VAR_region = "us-east-1" }' },
        ],
      },
      {
        name: 'before_hook',
        type: 'block',
        required: false,
        description: 'Nested block to execute commands before Terraform runs.',
        nestedAttributes: [
          { name: 'commands', type: 'list', required: true, description: 'Terraform commands that trigger this hook.', example: '["apply", "plan"]' },
          { name: 'execute', type: 'list', required: true, description: 'Command and arguments to execute.', example: '["echo", "Running Terraform"]' },
          { name: 'working_dir', type: 'string', required: false, description: 'Working directory for the command.', example: '"."' },
          { name: 'run_on_error', type: 'boolean', required: false, description: 'Whether to run if previous commands failed.', defaultValue: false },
          { name: 'suppress_stdout', type: 'boolean', required: false, description: 'Suppress stdout output.', defaultValue: false },
        ],
      },
      {
        name: 'after_hook',
        type: 'block',
        required: false,
        description: 'Nested block to execute commands after Terraform runs.',
        nestedAttributes: [
          { name: 'commands', type: 'list', required: true, description: 'Terraform commands that trigger this hook.', example: '["apply", "plan"]' },
          { name: 'execute', type: 'list', required: true, description: 'Command and arguments to execute.', example: '["./scripts/notify.sh"]' },
          { name: 'working_dir', type: 'string', required: false, description: 'Working directory for the command.', example: '"."' },
          { name: 'run_on_error', type: 'boolean', required: false, description: 'Whether to run if Terraform command failed.', defaultValue: false },
          { name: 'suppress_stdout', type: 'boolean', required: false, description: 'Suppress stdout output.', defaultValue: false },
        ],
      },
      {
        name: 'error_hook',
        type: 'block',
        required: false,
        description: 'Nested block to execute commands when Terraform encounters an error.',
        nestedAttributes: [
          { name: 'commands', type: 'list', required: true, description: 'Terraform commands that trigger this hook on error.', example: '["apply", "plan"]' },
          { name: 'execute', type: 'list', required: true, description: 'Command and arguments to execute.', example: '["./scripts/alert.sh"]' },
          { name: 'on_errors', type: 'list', required: false, description: 'Specific error patterns to match.', example: '[".*"]' },
          { name: 'working_dir', type: 'string', required: false, description: 'Working directory for the command.', example: '"."' },
          { name: 'suppress_stdout', type: 'boolean', required: false, description: 'Suppress stdout output.', defaultValue: false },
        ],
      },
    ],
    examples: [
      {
        description: 'Basic Terraform source from Git',
        code: `terraform {
  source = "git::https://github.com/gruntwork-io/terragrunt.git//modules/vpc?ref=v0.1.0"
}`,
      },
      {
        description: 'Local module with extra arguments',
        code: `terraform {
  source = "../modules/vpc"
  
  extra_arguments "common_vars" {
    commands = ["apply", "plan", "import", "push", "refresh"]
    arguments = ["-var-file=\${get_terragrunt_dir()}/common.tfvars"]
  }
}`,
      },
      {
        description: 'With before and after hooks',
        code: `terraform {
  source = "git::https://github.com/org/modules.git//app"
  
  before_hook "validate" {
    commands = ["apply", "plan"]
    execute  = ["tflint", "--init"]
  }
  
  after_hook "notify" {
    commands     = ["apply"]
    execute      = ["slack-notify", "Deployment complete"]
    run_on_error = false
  }
}`,
      },
    ],
    relatedBlocks: ['remote_state', 'include', 'dependency'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform',
  },
  {
    name: 'remote_state',
    displayName: 'Remote State Block',
    description: 'Configures the Terraform remote state backend. Terragrunt will automatically create the remote state resources (S3 bucket, DynamoDB table, etc.) if they don\'t exist.',
    category: 'core',
    syntax: 'remote_state { ... }',
    attributes: [
      {
        name: 'backend',
        type: 'string',
        required: true,
        description: 'The type of remote backend to use (s3, gcs, azurerm, etc.).',
        example: '"s3"',
        validValues: ['s3', 'gcs', 'azurerm', 'consul', 'cos', 'http', 'kubernetes', 'oss', 'pg', 'remote'],
      },
      {
        name: 'config',
        type: 'map',
        required: true,
        description: 'Backend-specific configuration options.',
        example: '{ bucket = "my-terraform-state", key = "terraform.tfstate", region = "us-east-1" }',
      },
      {
        name: 'generate',
        type: 'object',
        required: false,
        description: 'Generate a backend.tf file with the remote state configuration.',
        nestedAttributes: [
          { name: 'path', type: 'string', required: true, description: 'Path for the generated file.', example: '"backend.tf"' },
          { name: 'if_exists', type: 'string', required: false, description: 'What to do if file exists.', validValues: ['overwrite', 'overwrite_terragrunt', 'skip', 'error'] },
        ],
      },
      {
        name: 'disable_init',
        type: 'boolean',
        required: false,
        description: 'Disable automatic remote state initialization.',
        defaultValue: false,
      },
      {
        name: 'disable_dependency_optimization',
        type: 'boolean',
        required: false,
        description: 'Disable the dependency optimization that skips state fetching.',
        defaultValue: false,
      },
    ],
    examples: [
      {
        description: 'S3 backend with DynamoDB locking',
        code: `remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}`,
      },
      {
        description: 'GCS backend',
        code: `remote_state {
  backend = "gcs"
  config = {
    bucket   = "my-terraform-state"
    prefix   = "\${path_relative_to_include()}"
    project  = "my-gcp-project"
    location = "us"
  }
}`,
      },
    ],
    relatedBlocks: ['terraform', 'generate'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state',
  },
  {
    name: 'locals',
    displayName: 'Locals Block',
    description: 'Defines local variables that can be referenced elsewhere in the Terragrunt configuration. Locals are evaluated lazily and can reference other locals, inputs, and built-in functions.',
    category: 'core',
    syntax: 'locals { ... }',
    attributes: [
      {
        name: '<variable_name>',
        type: 'any',
        required: false,
        description: 'Any valid HCL expression. Variables defined here can be referenced as local.<variable_name>.',
        example: 'region = "us-east-1"',
      },
    ],
    examples: [
      {
        description: 'Define reusable local variables',
        code: `locals {
  environment = "production"
  region      = "us-east-1"
  
  # Computed values
  name_prefix = "\${local.environment}-app"
  
  # Load from files
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  account_id   = local.account_vars.locals.account_id
}`,
      },
      {
        description: 'Complex local with conditionals',
        code: `locals {
  is_prod = local.environment == "production"
  
  instance_type = local.is_prod ? "m5.xlarge" : "t3.micro"
  
  tags = {
    Environment = local.environment
    ManagedBy   = "Terragrunt"
  }
}`,
      },
    ],
    relatedBlocks: ['inputs', 'include'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#locals',
  },
  {
    name: 'inputs',
    displayName: 'Inputs Block',
    description: 'Specifies the input variables to pass to the Terraform module. These values are automatically converted to TF_VAR_* environment variables when Terraform is executed.',
    category: 'core',
    syntax: 'inputs = { ... }',
    attributes: [
      {
        name: '<variable_name>',
        type: 'any',
        required: false,
        description: 'Key-value pairs matching the Terraform module\'s input variables.',
        example: 'instance_type = "t3.micro"',
      },
    ],
    examples: [
      {
        description: 'Basic inputs from locals',
        code: `inputs = {
  instance_type = local.instance_type
  environment   = local.environment
  tags          = local.tags
}`,
      },
      {
        description: 'Merge inputs from dependency outputs',
        code: `inputs = merge(
  local.common_vars,
  {
    vpc_id     = dependency.vpc.outputs.vpc_id
    subnet_ids = dependency.vpc.outputs.private_subnet_ids
  }
)`,
      },
    ],
    relatedBlocks: ['locals', 'dependency'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#inputs',
  },

  // ============================================================================
  // MODULE COMPOSITION BLOCKS
  // ============================================================================
  {
    name: 'include',
    displayName: 'Include Block',
    description: 'Includes configuration from another terragrunt.hcl file, enabling DRY (Don\'t Repeat Yourself) configuration patterns. Commonly used to include a root configuration with shared remote state and provider settings.',
    category: 'modules',
    syntax: 'include "<label>" { ... }',
    requiresLabel: true,
    allowMultiple: true,
    attributes: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'Path to the terragrunt.hcl file to include. Often uses find_in_parent_folders().',
        example: 'find_in_parent_folders()',
      },
      {
        name: 'expose',
        type: 'boolean',
        required: false,
        description: 'When true, exposes the included config\'s locals and inputs for access via include.<label>.',
        defaultValue: false,
      },
      {
        name: 'merge_strategy',
        type: 'string',
        required: false,
        description: 'How to merge the included configuration with the current one.',
        validValues: ['no_merge', 'shallow', 'deep'],
        defaultValue: 'shallow',
      },
    ],
    examples: [
      {
        description: 'Include root configuration',
        code: `include "root" {
  path = find_in_parent_folders()
}`,
      },
      {
        description: 'Include with exposed locals',
        code: `include "root" {
  path   = find_in_parent_folders()
  expose = true
}

locals {
  # Access exposed variables from included config
  account_id = include.root.locals.account_id
}`,
      },
      {
        description: 'Multiple includes with merge strategy',
        code: `include "root" {
  path           = find_in_parent_folders()
  merge_strategy = "deep"
}

include "env" {
  path           = find_in_parent_folders("env.hcl")
  expose         = true
  merge_strategy = "deep"
}`,
      },
    ],
    relatedBlocks: ['locals', 'terraform', 'remote_state'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#include',
  },
  {
    name: 'dependency',
    displayName: 'Dependency Block',
    description: 'Declares a dependency on another Terragrunt module, allowing access to its outputs. Terragrunt ensures dependencies are applied in the correct order when using run-all commands.',
    category: 'modules',
    syntax: 'dependency "<label>" { ... }',
    requiresLabel: true,
    allowMultiple: true,
    attributes: [
      {
        name: 'config_path',
        type: 'string',
        required: true,
        description: 'Relative or absolute path to the dependency\'s terragrunt.hcl directory.',
        example: '"../vpc"',
      },
      {
        name: 'enabled',
        type: 'boolean',
        required: false,
        description: 'Whether this dependency is enabled. Useful for conditional dependencies.',
        defaultValue: true,
      },
      {
        name: 'skip_outputs',
        type: 'boolean',
        required: false,
        description: 'Skip fetching outputs from this dependency (useful for destroy operations).',
        defaultValue: false,
      },
      {
        name: 'mock_outputs',
        type: 'map',
        required: false,
        description: 'Mock output values to use when the dependency hasn\'t been applied yet.',
        example: '{ vpc_id = "mock-vpc-id" }',
      },
      {
        name: 'mock_outputs_allowed_terraform_commands',
        type: 'list',
        required: false,
        description: 'Terraform commands where mock outputs are allowed.',
        example: '["validate", "plan"]',
      },
      {
        name: 'mock_outputs_merge_strategy_with_state',
        type: 'string',
        required: false,
        description: 'How to merge mock outputs with actual state outputs.',
        validValues: ['no_merge', 'shallow', 'deep'],
      },
    ],
    examples: [
      {
        description: 'Simple dependency on VPC module',
        code: `dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
      },
      {
        description: 'Dependency with mock outputs for plan/validate',
        code: `dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id            = "vpc-mock12345"
    private_subnet_ids = ["subnet-mock1", "subnet-mock2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}`,
      },
      {
        description: 'Conditional dependency',
        code: `dependency "database" {
  config_path = "../database"
  enabled     = local.create_database
  
  mock_outputs = {
    connection_string = "mock-connection-string"
  }
}`,
      },
    ],
    relatedBlocks: ['dependencies', 'inputs'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependency',
  },
  {
    name: 'dependencies',
    displayName: 'Dependencies Block',
    description: 'Shorthand for declaring multiple dependencies when you only need ordering (not outputs). Use this when you want Terragrunt to apply modules in a specific order but don\'t need to reference their outputs.',
    category: 'modules',
    syntax: 'dependencies { ... }',
    attributes: [
      {
        name: 'paths',
        type: 'list',
        required: true,
        description: 'List of paths to dependency modules.',
        example: '["../vpc", "../security-groups"]',
      },
    ],
    examples: [
      {
        description: 'Simple dependency ordering',
        code: `dependencies {
  paths = ["../vpc", "../security-groups"]
}`,
      },
      {
        description: 'Combined with dependency block',
        code: `# Use dependencies for ordering only
dependencies {
  paths = ["../iam"]
}

# Use dependency when you need outputs
dependency "vpc" {
  config_path = "../vpc"
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
      },
    ],
    relatedBlocks: ['dependency'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependencies',
  },

  // ============================================================================
  // GENERATION BLOCKS
  // ============================================================================
  {
    name: 'generate',
    displayName: 'Generate Block',
    description: 'Generates a file in the Terraform working directory before Terraform runs. Commonly used to generate provider configurations, backend blocks, or shared variable files.',
    category: 'generation',
    syntax: 'generate "<label>" { ... }',
    requiresLabel: true,
    allowMultiple: true,
    attributes: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'Path to the file to generate (relative to the Terraform working directory).',
        example: '"provider.tf"',
      },
      {
        name: 'if_exists',
        type: 'string',
        required: false,
        description: 'What to do if the file already exists.',
        validValues: ['overwrite', 'overwrite_terragrunt', 'skip', 'error'],
        defaultValue: 'overwrite_terragrunt',
      },
      {
        name: 'contents',
        type: 'string',
        required: true,
        description: 'The content to write to the file. Supports heredoc syntax.',
        example: '<<EOF\nprovider "aws" { region = "us-east-1" }\nEOF',
      },
      {
        name: 'comment_prefix',
        type: 'string',
        required: false,
        description: 'Prefix for the auto-generated comment. Empty string disables comment.',
        defaultValue: '# ',
      },
      {
        name: 'disable_signature',
        type: 'boolean',
        required: false,
        description: 'Disable the "Generated by Terragrunt" signature in the file.',
        defaultValue: false,
      },
    ],
    examples: [
      {
        description: 'Generate AWS provider',
        code: `generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "\${local.region}"
  
  default_tags {
    tags = {
      Environment = "\${local.environment}"
      ManagedBy   = "Terragrunt"
    }
  }
}
EOF
}`,
      },
      {
        description: 'Generate required providers',
        code: `generate "versions" {
  path      = "versions.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
EOF
}`,
      },
    ],
    relatedBlocks: ['terraform', 'remote_state'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#generate',
  },

  // ============================================================================
  // EXECUTION CONTROL
  // ============================================================================
  {
    name: 'skip',
    displayName: 'Skip Attribute',
    description: 'When set to true, Terragrunt will skip this module during run-all commands. Useful for temporarily disabling modules or for modules that should only run under certain conditions.',
    category: 'execution',
    syntax: 'skip = <boolean>',
    attributes: [
      {
        name: 'skip',
        type: 'boolean',
        required: false,
        description: 'Whether to skip this module.',
        defaultValue: false,
      },
    ],
    examples: [
      {
        description: 'Conditionally skip based on environment',
        code: `skip = local.environment == "development"`,
      },
      {
        description: 'Skip deprecated module',
        code: `# This module is deprecated, skip it
skip = true`,
      },
    ],
    relatedBlocks: ['prevent_destroy'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#skip',
  },
  {
    name: 'prevent_destroy',
    displayName: 'Prevent Destroy Attribute',
    description: 'When set to true, Terragrunt will prevent any destroy operations on this module. This is a safety mechanism to protect critical infrastructure.',
    category: 'execution',
    syntax: 'prevent_destroy = <boolean>',
    attributes: [
      {
        name: 'prevent_destroy',
        type: 'boolean',
        required: false,
        description: 'Whether to prevent destroy operations.',
        defaultValue: false,
      },
    ],
    examples: [
      {
        description: 'Protect production database',
        code: `prevent_destroy = local.environment == "production"`,
      },
      {
        description: 'Always prevent destroy',
        code: `# Critical infrastructure - never destroy
prevent_destroy = true`,
      },
    ],
    relatedBlocks: ['skip'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#prevent_destroy',
  },
  {
    name: 'retryable_errors',
    displayName: 'Retryable Errors Attribute',
    description: 'List of regex patterns for errors that should trigger automatic retry. Useful for handling transient errors like rate limiting or network issues.',
    category: 'execution',
    syntax: 'retryable_errors = [...]',
    attributes: [
      {
        name: 'retryable_errors',
        type: 'list',
        required: false,
        description: 'Regex patterns for errors that should be retried.',
        example: '[".*RequestLimitExceeded.*"]',
      },
    ],
    examples: [
      {
        description: 'Retry AWS rate limiting errors',
        code: `retryable_errors = [
  ".*RequestLimitExceeded.*",
  ".*Throttling.*",
  ".*rate exceeded.*"
]`,
      },
    ],
    relatedBlocks: ['retry_max_attempts', 'retry_sleep_interval_sec'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#retryable_errors',
  },
  {
    name: 'retry_max_attempts',
    displayName: 'Retry Max Attempts Attribute',
    description: 'Maximum number of retry attempts for retryable errors. Works in conjunction with retryable_errors.',
    category: 'execution',
    syntax: 'retry_max_attempts = <number>',
    attributes: [
      {
        name: 'retry_max_attempts',
        type: 'number',
        required: false,
        description: 'Maximum number of retry attempts.',
        defaultValue: 3,
      },
    ],
    examples: [
      {
        description: 'Set maximum retry attempts',
        code: `retry_max_attempts = 5`,
      },
    ],
    relatedBlocks: ['retryable_errors', 'retry_sleep_interval_sec'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#retry_max_attempts',
  },
  {
    name: 'retry_sleep_interval_sec',
    displayName: 'Retry Sleep Interval Attribute',
    description: 'Number of seconds to wait between retry attempts. Works in conjunction with retryable_errors.',
    category: 'execution',
    syntax: 'retry_sleep_interval_sec = <number>',
    attributes: [
      {
        name: 'retry_sleep_interval_sec',
        type: 'number',
        required: false,
        description: 'Seconds to wait between retries.',
        defaultValue: 5,
      },
    ],
    examples: [
      {
        description: 'Configure retry interval',
        code: `retry_sleep_interval_sec = 30`,
      },
    ],
    relatedBlocks: ['retryable_errors', 'retry_max_attempts'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#retry_sleep_interval_sec',
  },

  // ============================================================================
  // IAM / AUTHENTICATION
  // ============================================================================
  {
    name: 'iam_role',
    displayName: 'IAM Role Attribute',
    description: 'AWS IAM role ARN that Terragrunt will assume before running Terraform. Useful for cross-account deployments.',
    category: 'iam',
    syntax: 'iam_role = "<role_arn>"',
    attributes: [
      {
        name: 'iam_role',
        type: 'string',
        required: false,
        description: 'IAM role ARN to assume.',
        example: '"arn:aws:iam::123456789012:role/TerraformRole"',
      },
    ],
    examples: [
      {
        description: 'Assume role for deployment',
        code: `iam_role = "arn:aws:iam::\${local.account_id}:role/TerraformDeployRole"`,
      },
    ],
    relatedBlocks: ['iam_assume_role_duration', 'iam_assume_role_session_name'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#iam_role',
  },
  {
    name: 'iam_assume_role_duration',
    displayName: 'IAM Assume Role Duration Attribute',
    description: 'Duration in seconds for the assumed IAM role session. Defaults to 3600 (1 hour).',
    category: 'iam',
    syntax: 'iam_assume_role_duration = <number>',
    attributes: [
      {
        name: 'iam_assume_role_duration',
        type: 'number',
        required: false,
        description: 'Session duration in seconds.',
        defaultValue: 3600,
      },
    ],
    examples: [
      {
        description: 'Extend session duration',
        code: `iam_assume_role_duration = 7200  # 2 hours`,
      },
    ],
    relatedBlocks: ['iam_role', 'iam_assume_role_session_name'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#iam_assume_role_duration',
  },
  {
    name: 'iam_assume_role_session_name',
    displayName: 'IAM Assume Role Session Name Attribute',
    description: 'Session name for the assumed IAM role. Useful for CloudTrail auditing.',
    category: 'iam',
    syntax: 'iam_assume_role_session_name = "<session_name>"',
    attributes: [
      {
        name: 'iam_assume_role_session_name',
        type: 'string',
        required: false,
        description: 'Session name for IAM role assumption.',
        example: '"terragrunt-deploy"',
      },
    ],
    examples: [
      {
        description: 'Set session name for auditing',
        code: `iam_assume_role_session_name = "terragrunt-\${local.environment}-deploy"`,
      },
    ],
    relatedBlocks: ['iam_role', 'iam_assume_role_duration'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#iam_assume_role_session_name',
  },
  {
    name: 'iam_web_identity_token',
    displayName: 'IAM Web Identity Token Attribute',
    description: 'Path to a web identity token file for OIDC-based authentication. Used in CI/CD environments like GitHub Actions with AWS.',
    category: 'iam',
    syntax: 'iam_web_identity_token = "<path_to_token>"',
    attributes: [
      {
        name: 'iam_web_identity_token',
        type: 'string',
        required: false,
        description: 'Path to OIDC web identity token file.',
        example: '"/var/run/secrets/token"',
      },
    ],
    examples: [
      {
        description: 'Use OIDC token for AWS authentication',
        code: `iam_web_identity_token = get_env("AWS_WEB_IDENTITY_TOKEN_FILE", "")`,
      },
    ],
    relatedBlocks: ['iam_role'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#iam_web_identity_token',
  },

  // ============================================================================
  // TERRAFORM CONFIGURATION
  // ============================================================================
  {
    name: 'terraform_binary',
    displayName: 'Terraform Binary Attribute',
    description: 'Path to a custom Terraform binary. Useful when you need to use a specific version or a wrapper like Terraform Enterprise CLI.',
    category: 'terraform',
    syntax: 'terraform_binary = "<path>"',
    attributes: [
      {
        name: 'terraform_binary',
        type: 'string',
        required: false,
        description: 'Path to Terraform binary.',
        example: '"/usr/local/bin/terraform-1.5"',
        defaultValue: 'terraform',
      },
    ],
    examples: [
      {
        description: 'Use specific Terraform version',
        code: `terraform_binary = "/usr/local/bin/terraform-1.5.7"`,
      },
      {
        description: 'Use tfenv-managed version',
        code: `terraform_binary = "~/.tfenv/bin/terraform"`,
      },
    ],
    relatedBlocks: ['terraform_version_constraint'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform_binary',
  },
  {
    name: 'terraform_version_constraint',
    displayName: 'Terraform Version Constraint Attribute',
    description: 'Specifies the required Terraform version. Terragrunt will check this before running and fail if the version doesn\'t match.',
    category: 'terraform',
    syntax: 'terraform_version_constraint = "<constraint>"',
    attributes: [
      {
        name: 'terraform_version_constraint',
        type: 'string',
        required: false,
        description: 'Terraform version constraint (uses same syntax as Terraform).',
        example: '">= 1.0"',
      },
    ],
    examples: [
      {
        description: 'Require minimum version',
        code: `terraform_version_constraint = ">= 1.0"`,
      },
      {
        description: 'Pin to specific minor version',
        code: `terraform_version_constraint = "~> 1.5.0"`,
      },
    ],
    relatedBlocks: ['terraform_binary'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform_version_constraint',
  },
  {
    name: 'download_dir',
    displayName: 'Download Directory Attribute',
    description: 'Custom directory where Terragrunt downloads and caches Terraform modules. Defaults to a temporary directory.',
    category: 'terraform',
    syntax: 'download_dir = "<path>"',
    attributes: [
      {
        name: 'download_dir',
        type: 'string',
        required: false,
        description: 'Path to download directory.',
        example: '"/tmp/terragrunt-cache"',
      },
    ],
    examples: [
      {
        description: 'Use custom cache directory',
        code: `download_dir = "\${get_env("HOME")}/.terragrunt-cache"`,
      },
    ],
    relatedBlocks: ['terraform'],
    docsUrl: 'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#download_dir',
  },
];

/**
 * Category metadata
 */
const CATEGORY_INFO: Record<HCLBlockCategory, { name: string; description: string }> = {
  core: {
    name: 'Core Configuration',
    description: 'Essential blocks for Terraform source, state, and inputs',
  },
  modules: {
    name: 'Module Composition',
    description: 'Blocks for including configs and declaring dependencies',
  },
  generation: {
    name: 'Code Generation',
    description: 'Blocks for generating files in the Terraform working directory',
  },
  execution: {
    name: 'Execution Control',
    description: 'Attributes for controlling execution flow and retry behavior',
  },
  iam: {
    name: 'AWS IAM Integration',
    description: 'Attributes for IAM role assumption and OIDC authentication',
  },
  terraform: {
    name: 'Terraform Configuration',
    description: 'Attributes for customizing Terraform binary and version',
  },
};

/**
 * HCL Blocks Manager class
 */
export class HCLBlocksManager {
  private blocks: Map<string, HCLBlock>;
  private aliases: Map<string, string>;

  constructor() {
    this.blocks = new Map();
    this.aliases = new Map();
    this.initializeBlocks();
  }

  private initializeBlocks(): void {
    for (const block of HCL_BLOCKS) {
      this.blocks.set(block.name, block);
    }

    // Set up common aliases
    this.aliases.set('state', 'remote_state');
    this.aliases.set('backend', 'remote_state');
    this.aliases.set('source', 'terraform');
    this.aliases.set('dep', 'dependency');
    this.aliases.set('deps', 'dependencies');
    this.aliases.set('inc', 'include');
    this.aliases.set('gen', 'generate');
    this.aliases.set('local', 'locals');
    this.aliases.set('input', 'inputs');
    this.aliases.set('vars', 'inputs');
    this.aliases.set('hook', 'terraform'); // hooks are in terraform block
    this.aliases.set('before_hook', 'terraform');
    this.aliases.set('after_hook', 'terraform');
    this.aliases.set('error_hook', 'terraform');
    this.aliases.set('extra_arguments', 'terraform');
  }

  /**
   * Get a specific HCL block by name
   */
  getBlock(name: string): HCLBlock | null {
    const normalized = name.trim().toLowerCase().replace(/[-_\s]/g, '_');
    
    // Direct lookup
    if (this.blocks.has(normalized)) {
      return this.blocks.get(normalized) || null;
    }

    // Alias lookup
    if (this.aliases.has(normalized)) {
      const aliasTarget = this.aliases.get(normalized)!;
      return this.blocks.get(aliasTarget) || null;
    }

    return null;
  }

  /**
   * List all blocks, optionally filtered by category
   */
  listBlocks(category?: HCLBlockCategory): HCLBlock[] {
    const allBlocks = Array.from(this.blocks.values());
    
    if (category) {
      return allBlocks.filter(b => b.category === category);
    }
    
    return allBlocks;
  }

  /**
   * Search blocks by query string
   */
  searchBlocks(query: string): HCLBlockSearchResult[] {
    const normalized = query.toLowerCase();
    const results: HCLBlockSearchResult[] = [];

    for (const block of this.blocks.values()) {
      // Exact name match
      if (block.name === normalized) {
        results.push({ block, score: 1.0, matchType: 'exact' });
        continue;
      }

      // Name contains query
      if (block.name.includes(normalized)) {
        results.push({ block, score: 0.9, matchType: 'name' });
        continue;
      }

      // Alias match
      for (const [alias, target] of this.aliases) {
        if (alias.includes(normalized) && target === block.name) {
          results.push({ block, score: 0.85, matchType: 'alias' });
          break;
        }
      }

      // Description match
      if (block.description.toLowerCase().includes(normalized)) {
        results.push({ block, score: 0.7, matchType: 'description' });
        continue;
      }

      // Attribute name match
      const attrMatch = block.attributes.some(a => 
        a.name.toLowerCase().includes(normalized)
      );
      if (attrMatch) {
        results.push({ block, score: 0.6, matchType: 'attribute' });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get category information
   */
  getCategories(): HCLBlockCategoryInfo[] {
    const categories: HCLBlockCategoryInfo[] = [];
    
    for (const [category, info] of Object.entries(CATEGORY_INFO)) {
      const blockCount = this.listBlocks(category as HCLBlockCategory).length;
      categories.push({
        category: category as HCLBlockCategory,
        name: info.name,
        description: info.description,
        blockCount,
      });
    }

    return categories;
  }

  /**
   * Format a block as markdown documentation
   */
  formatBlockAsMarkdown(block: HCLBlock): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${block.displayName}`);
    lines.push('');
    lines.push(block.description);
    lines.push('');

    // Syntax
    lines.push('## Syntax');
    lines.push('');
    lines.push('```hcl');
    lines.push(block.syntax);
    lines.push('```');
    lines.push('');

    // Attributes
    if (block.attributes.length > 0) {
      lines.push('## Attributes');
      lines.push('');
      lines.push('| Attribute | Type | Required | Description |');
      lines.push('|-----------|------|----------|-------------|');
      
      for (const attr of block.attributes) {
        const required = attr.required ? '✅' : '❌';
        const desc = attr.description.replace(/\|/g, '\\|');
        lines.push(`| \`${attr.name}\` | ${attr.type} | ${required} | ${desc} |`);
        
        // Nested attributes
        if (attr.nestedAttributes && attr.nestedAttributes.length > 0) {
          for (const nested of attr.nestedAttributes) {
            const nestedReq = nested.required ? '✅' : '❌';
            const nestedDesc = nested.description.replace(/\|/g, '\\|');
            lines.push(`| ↳ \`${nested.name}\` | ${nested.type} | ${nestedReq} | ${nestedDesc} |`);
          }
        }
      }
      lines.push('');
    }

    // Examples
    if (block.examples.length > 0) {
      lines.push('## Examples');
      lines.push('');
      
      for (const example of block.examples) {
        lines.push(`### ${example.description}`);
        lines.push('');
        lines.push('```hcl');
        lines.push(example.code);
        lines.push('```');
        lines.push('');
      }
    }

    // Related blocks
    if (block.relatedBlocks && block.relatedBlocks.length > 0) {
      lines.push('## Related');
      lines.push('');
      lines.push(block.relatedBlocks.map(r => `\`${r}\``).join(', '));
      lines.push('');
    }

    // Docs link
    if (block.docsUrl) {
      lines.push('## Documentation');
      lines.push('');
      lines.push(`[Official Terragrunt Documentation](${block.docsUrl})`);
    }

    return lines.join('\n');
  }

  /**
   * Get total block count
   */
  getBlockCount(): number {
    return this.blocks.size;
  }
}
