/**
 * Advanced Examples Manager
 * Provides curated, well-documented code examples for complex Terragrunt patterns
 * Issue #103: Enhancement - Add Advanced Code Example Responses
 */

import type {
  AdvancedExample,
  AdvancedExampleCategory,
  AdvancedExampleSearchResult,
  AdvancedExampleCategoryInfo,
} from '../types/advanced-examples.js';

/**
 * Category metadata definitions
 */
const CATEGORY_INFO: Record<AdvancedExampleCategory, Omit<AdvancedExampleCategoryInfo, 'exampleCount'>> = {
  hooks: {
    category: 'hooks',
    name: 'Hooks',
    description: 'Before and after hooks for command execution, validation, notifications, and error handling',
  },
  generate: {
    category: 'generate',
    name: 'Generate Blocks',
    description: 'Dynamic file generation for providers, backends, terraform configurations, and more',
  },
  environment: {
    category: 'environment',
    name: 'Environment Configuration',
    description: 'Environment-specific configurations, hierarchical setups, and variable merging patterns',
  },
  dependencies: {
    category: 'dependencies',
    name: 'Dependency Patterns',
    description: 'Cross-module dependencies, mock outputs, and dependency graph management',
  },
  'dry-patterns': {
    category: 'dry-patterns',
    name: 'DRY Patterns',
    description: 'Don\'t Repeat Yourself patterns using includes, read_terragrunt_config, and shared configurations',
  },
};

/**
 * All advanced examples organized by category
 */
const ADVANCED_EXAMPLES: AdvancedExample[] = [
  // =============================================================================
  // HOOKS CATEGORY
  // =============================================================================
  {
    id: 'before-hook-validation',
    name: 'Pre-Apply Validation Hook',
    description: 'Run validation scripts before apply to catch issues early',
    category: 'hooks',
    complexity: 'intermediate',
    code: `terraform {
  before_hook "validate_inputs" {
    commands     = ["apply", "plan"]
    execute      = ["./scripts/validate-inputs.sh"]
    working_dir  = get_repo_root()
  }

  before_hook "check_dependencies" {
    commands     = ["apply"]
    execute      = ["terraform", "validate"]
  }
}`,
    useCases: [
      'Validate input variables before expensive operations',
      'Run custom compliance checks before apply',
      'Ensure prerequisites are met before deployment',
    ],
    bestPractices: [
      'Keep validation scripts fast to avoid slowing down workflows',
      'Use exit codes to signal validation failures',
      'Log validation results for debugging',
    ],
    pitfalls: [
      'Long-running validations can frustrate developers',
      'Validation scripts must be idempotent',
      'Ensure scripts are available in CI/CD environments',
    ],
    relatedExamples: [
      { id: 'after-hook-notification', relationship: 'Pair with notifications for complete workflow' },
      { id: 'hook-error-handling', relationship: 'Add error handling for robustness' },
    ],
    tags: ['hooks', 'validation', 'before_hook', 'apply', 'plan'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#terraform',
  },
  {
    id: 'after-hook-notification',
    name: 'Post-Apply Notification Hook',
    description: 'Send notifications after successful deployments',
    category: 'hooks',
    complexity: 'intermediate',
    code: `terraform {
  after_hook "notify_slack" {
    commands     = ["apply"]
    execute      = [
      "curl", "-X", "POST",
      "-H", "Content-Type: application/json",
      "-d", "{\\"text\\": \\"Deployment completed for \${path_relative_to_include()}\\"}",
      "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    ]
    run_on_error = false
  }

  after_hook "update_deployment_log" {
    commands     = ["apply"]
    execute      = ["./scripts/log-deployment.sh", path_relative_to_include()]
    run_on_error = true
  }
}`,
    useCases: [
      'Notify team members of successful deployments',
      'Update deployment tracking systems',
      'Trigger downstream processes after infrastructure changes',
    ],
    bestPractices: [
      'Use run_on_error=false for success-only notifications',
      'Include context like module path in notifications',
      'Keep notification hooks lightweight and non-blocking',
    ],
    pitfalls: [
      'Don\'t include sensitive data in notifications',
      'Webhook URLs should be stored securely (use environment variables)',
      'Notification failures shouldn\'t block deployments',
    ],
    relatedExamples: [
      { id: 'before-hook-validation', relationship: 'Complete workflow with pre-apply validation' },
      { id: 'hook-error-handling', relationship: 'Handle errors gracefully' },
    ],
    tags: ['hooks', 'notification', 'after_hook', 'slack', 'apply'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#terraform',
  },
  {
    id: 'hook-error-handling',
    name: 'Error Handling Hooks',
    description: 'Hooks that run on errors for cleanup and alerting',
    category: 'hooks',
    complexity: 'advanced',
    code: `terraform {
  # Cleanup hook that runs even on failure
  after_hook "cleanup_temp_files" {
    commands     = ["apply", "plan", "destroy"]
    execute      = ["rm", "-rf", ".terraform-temp"]
    run_on_error = true
  }

  # Error notification hook - runs only when command fails
  after_hook "notify_on_failure" {
    commands     = ["apply"]
    execute      = ["./scripts/alert-failure.sh", "\${path_relative_to_include()}"]
    run_on_error = true  # Only runs on error, no need to check exit code
  }

  # State backup before risky operations
  before_hook "backup_state" {
    commands     = ["apply", "destroy"]
    execute      = ["./scripts/backup-state.sh", get_terragrunt_dir()]
  }
}`,
    useCases: [
      'Clean up temporary resources on failure',
      'Alert on-call teams when deployments fail',
      'Create state backups before risky operations',
    ],
    bestPractices: [
      'Always use run_on_error=true for cleanup hooks',
      'Keep error handling hooks simple and reliable',
      'Test error scenarios in non-production environments',
    ],
    pitfalls: [
      'Error hooks themselves can fail - keep them simple',
      'Don\'t create infinite loops with error notifications',
      'State backup hooks should handle large state files efficiently',
    ],
    relatedExamples: [
      { id: 'before-hook-validation', relationship: 'Prevent errors with validation' },
      { id: 'after-hook-notification', relationship: 'Complement with success notifications' },
    ],
    tags: ['hooks', 'error-handling', 'cleanup', 'run_on_error', 'alerting'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#terraform',
  },
  {
    id: 'hook-multi-command',
    name: 'Multi-Command Hook Pipeline',
    description: 'Complex hook with multiple commands for different operations',
    category: 'hooks',
    complexity: 'advanced',
    code: `terraform {
  # Format check before any terraform operation
  before_hook "terraform_fmt" {
    commands     = ["apply", "plan", "validate"]
    execute      = ["terraform", "fmt", "-check", "-recursive"]
  }

  # Security scan before apply
  before_hook "security_scan" {
    commands     = ["apply"]
    execute      = ["tfsec", "."]
    working_dir  = get_terragrunt_dir()
  }

  # Cost estimation before apply
  before_hook "cost_estimate" {
    commands     = ["apply"]
    execute      = ["infracost", "breakdown", "--path", "."]
    working_dir  = get_terragrunt_dir()
  }

  # Documentation generation after successful apply
  after_hook "generate_docs" {
    commands     = ["apply"]
    execute      = ["terraform-docs", "markdown", ".", "--output-file", "README.md"]
    working_dir  = get_terragrunt_dir()
    run_on_error = false
  }
}`,
    useCases: [
      'Enforce code formatting standards',
      'Run security scans before deployments',
      'Generate cost estimates for review',
      'Auto-generate documentation',
    ],
    bestPractices: [
      'Order hooks by execution priority',
      'Use working_dir to ensure correct context',
      'Make non-critical hooks optional with conditions',
    ],
    pitfalls: [
      'Too many hooks can significantly slow down operations',
      'External tools must be available in execution environment',
      'Consider caching for expensive operations like security scans',
    ],
    relatedExamples: [
      { id: 'before-hook-validation', relationship: 'Simpler validation example' },
      { id: 'hook-error-handling', relationship: 'Add error handling' },
    ],
    tags: ['hooks', 'pipeline', 'security', 'formatting', 'documentation', 'cost'],
  },

  // =============================================================================
  // GENERATE CATEGORY
  // =============================================================================
  {
    id: 'generate-backend',
    name: 'Dynamic Backend Generation',
    description: 'Generate backend configuration dynamically based on environment',
    category: 'generate',
    complexity: 'intermediate',
    code: `# Generate backend configuration for S3
generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  backend "s3" {
    bucket         = "\${local.backend_bucket}"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "\${local.aws_region}"
    encrypt        = true
    dynamodb_table = "\${local.lock_table}"
  }
}
EOF
}

locals {
  # Load environment-specific config
  env_config = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  
  backend_bucket = local.env_config.locals.backend_bucket
  aws_region     = local.env_config.locals.aws_region
  lock_table     = local.env_config.locals.lock_table
}`,
    useCases: [
      'Centralize backend configuration',
      'Use different state buckets per environment',
      'Dynamically compute state file paths',
    ],
    bestPractices: [
      'Use if_exists = "overwrite_terragrunt" to prevent manual edits',
      'Derive state key from path_relative_to_include() for unique paths',
      'Enable encryption and locking for production backends',
    ],
    pitfalls: [
      'Changing backend config requires state migration',
      'Ensure bucket and table exist before first run',
      'Don\'t hardcode credentials in generated files',
    ],
    relatedExamples: [
      { id: 'generate-provider', relationship: 'Generate provider alongside backend' },
      { id: 'env-hierarchy', relationship: 'Load backend config from hierarchy' },
    ],
    tags: ['generate', 'backend', 's3', 'state', 'dynamodb'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#generate',
  },
  {
    id: 'generate-provider',
    name: 'Dynamic Provider Generation',
    description: 'Generate provider configuration with assume role and region',
    category: 'generate',
    complexity: 'intermediate',
    code: `# Generate AWS provider with assume role
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "\${local.aws_region}"

  assume_role {
    role_arn     = "arn:aws:iam::\${local.account_id}:role/TerraformRole"
    session_name = "terragrunt-\${local.environment}"
  }

  default_tags {
    tags = {
      Environment = "\${local.environment}"
      ManagedBy   = "Terragrunt"
      Project     = "\${local.project_name}"
    }
  }
}
EOF
}

locals {
  env_config   = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  
  aws_region   = local.env_config.locals.aws_region
  environment  = local.env_config.locals.environment
  account_id   = local.account_vars.locals.account_id
  project_name = "my-infrastructure"
}`,
    useCases: [
      'Standardize provider configuration across modules',
      'Implement cross-account access with assume role',
      'Apply consistent default tags to all resources',
    ],
    bestPractices: [
      'Use assume_role for cross-account deployments',
      'Set default_tags for consistent resource tagging',
      'Include session_name for CloudTrail auditability',
    ],
    pitfalls: [
      'Ensure IAM roles have proper trust policies',
      'Session names have length limits (64 chars)',
      'Default tags don\'t apply to all resource types',
    ],
    relatedExamples: [
      { id: 'generate-backend', relationship: 'Generate backend with same locals' },
      { id: 'generate-versions', relationship: 'Pin provider versions' },
    ],
    tags: ['generate', 'provider', 'aws', 'assume-role', 'tags'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#generate',
  },
  {
    id: 'generate-versions',
    name: 'Version Constraints Generation',
    description: 'Generate required providers and terraform version constraints',
    category: 'generate',
    complexity: 'basic',
    code: `# Generate version constraints
generate "versions" {
  path      = "versions.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}
EOF
}

# Optional: Generate .terraform-version file for tfenv
generate "tfversion" {
  path      = ".terraform-version"
  if_exists = "overwrite_terragrunt"
  contents  = "1.5.7"
}`,
    useCases: [
      'Enforce consistent Terraform versions across team',
      'Pin provider versions for reproducibility',
      'Support tfenv/tgenv version management',
    ],
    bestPractices: [
      'Use version ranges that allow patch updates',
      'Keep version constraints in one place',
      'Document version upgrade procedures',
    ],
    pitfalls: [
      'Too strict constraints block security patches',
      'Too loose constraints can break builds',
      'Coordinate version changes across team',
    ],
    relatedExamples: [
      { id: 'generate-provider', relationship: 'Generate provider with version constraints' },
    ],
    tags: ['generate', 'versions', 'terraform', 'providers', 'tfenv'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#generate',
  },
  {
    id: 'generate-conditional',
    name: 'Conditional File Generation',
    description: 'Generate files conditionally based on environment or configuration',
    category: 'generate',
    complexity: 'advanced',
    code: `locals {
  env_config   = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment  = local.env_config.locals.environment
  is_prod      = local.environment == "production"
}

# Only generate monitoring in production
generate "monitoring" {
  path      = "monitoring.tf"
  if_exists = "overwrite_terragrunt"
  disable   = !local.is_prod
  contents  = <<EOF
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "\${local.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU utilization exceeded 80%"
}
EOF
}

# Generate different configs per environment
generate "logging" {
  path      = "logging.tf"
  if_exists = "overwrite_terragrunt"
  contents  = local.is_prod ? <<EOF
# Production logging with long retention
resource "aws_cloudwatch_log_group" "app" {
  name              = "/app/\${local.environment}"
  retention_in_days = 365
}
EOF
: <<EOF
# Non-production logging with short retention
resource "aws_cloudwatch_log_group" "app" {
  name              = "/app/\${local.environment}"
  retention_in_days = 7
}
EOF
}`,
    useCases: [
      'Add monitoring only to production',
      'Use different configurations per environment',
      'Disable expensive resources in development',
    ],
    bestPractices: [
      'Use disable attribute for cleaner conditional generation',
      'Keep environment differences minimal',
      'Document why certain resources are environment-specific',
    ],
    pitfalls: [
      'Complex conditionals become hard to maintain',
      'Environment drift can cause deployment issues',
      'Test conditional logic in all environments',
    ],
    relatedExamples: [
      { id: 'env-hierarchy', relationship: 'Load environment config' },
      { id: 'generate-provider', relationship: 'Environment-specific providers' },
    ],
    tags: ['generate', 'conditional', 'environment', 'disable'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#generate',
  },

  // =============================================================================
  // ENVIRONMENT CATEGORY
  // =============================================================================
  {
    id: 'env-hierarchy',
    name: 'Hierarchical Environment Configuration',
    description: 'Multi-level configuration hierarchy for root/account/region/environment',
    category: 'environment',
    complexity: 'advanced',
    code: `# In each terragrunt.hcl, merge configurations from the hierarchy

locals {
  # Parse the file path to extract environment components
  parsed = regex(".*/(?P<account>.*)/(?P<region>.*)/(?P<env>.*)/(?P<module>.*)$", get_terragrunt_dir())
  
  # Load configs from each level of the hierarchy
  root_config    = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  account_config = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  region_config  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  env_config     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  
  # Merge configurations (later values override earlier)
  merged_tags = merge(
    local.root_config.locals.tags,
    local.account_config.locals.tags,
    local.region_config.locals.tags,
    local.env_config.locals.tags,
    {
      Module = local.parsed.module
    }
  )
  
  # Extract commonly used values
  account_id  = local.account_config.locals.account_id
  aws_region  = local.region_config.locals.aws_region
  environment = local.env_config.locals.environment
}

# Include the root configuration
include "root" {
  path = find_in_parent_folders("root.hcl")
}

inputs = {
  tags = local.merged_tags
}`,
    useCases: [
      'Manage multi-account AWS organizations',
      'Support multiple regions with consistent config',
      'Layer configurations from global to specific',
    ],
    bestPractices: [
      'Keep each level focused on its scope',
      'Use merge() to combine configurations predictably',
      'Document the hierarchy in a README',
    ],
    pitfalls: [
      'Deep hierarchies become complex to debug',
      'Circular dependencies can occur with complex includes',
      'Performance impact from reading many files',
    ],
    relatedExamples: [
      { id: 'env-merging', relationship: 'Variable merging patterns' },
      { id: 'include-multiple', relationship: 'Using multiple includes' },
    ],
    tags: ['environment', 'hierarchy', 'multi-account', 'organization'],
    docsUrl: 'https://docs.terragrunt.com/features/units/includes/',
  },
  {
    id: 'env-merging',
    name: 'Environment Variable Merging',
    description: 'Merge variables from multiple configuration files with overrides',
    category: 'environment',
    complexity: 'intermediate',
    code: `locals {
  # Default values (lowest priority)
  defaults = {
    instance_type = "t3.micro"
    min_size      = 1
    max_size      = 3
    enable_ha     = false
  }
  
  # Environment-specific overrides
  env_config = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env_vars   = try(local.env_config.locals.app_config, {})
  
  # Module-specific overrides (highest priority)
  module_vars = {
    # Override specific values for this module
    min_size = 2
  }
  
  # Merge all configurations
  # Order matters: later maps override earlier ones
  config = merge(
    local.defaults,
    local.env_vars,
    local.module_vars
  )
}

inputs = {
  instance_type = local.config.instance_type
  min_size      = local.config.min_size
  max_size      = local.config.max_size
  enable_ha     = local.config.enable_ha
}`,
    useCases: [
      'Define sensible defaults with environment overrides',
      'Allow module-specific customizations',
      'Reduce duplication across similar modules',
    ],
    bestPractices: [
      'Document the merge order clearly',
      'Use try() to handle optional configurations',
      'Keep defaults conservative (smallest, cheapest)',
    ],
    pitfalls: [
      'Deep merge doesn\'t merge nested maps by default',
      'Can be hard to trace where a value came from',
      'Type mismatches cause confusing errors',
    ],
    relatedExamples: [
      { id: 'env-hierarchy', relationship: 'Full hierarchy example' },
      { id: 'dry-locals', relationship: 'DRY patterns with locals' },
    ],
    tags: ['environment', 'merge', 'variables', 'overrides', 'defaults'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/functions/#opentofuterraform-built-in-functions',
  },
  {
    id: 'env-workspace',
    name: 'Workspace-Based Environment Selection',
    description: 'Use Terraform workspaces with Terragrunt for environment isolation',
    category: 'environment',
    complexity: 'intermediate',
    code: `locals {
  # Map workspace names to environment configurations
  workspace_configs = {
    default = {
      environment   = "dev"
      instance_type = "t3.micro"
      replica_count = 1
    }
    staging = {
      environment   = "staging"
      instance_type = "t3.small"
      replica_count = 2
    }
    production = {
      environment   = "production"
      instance_type = "t3.large"
      replica_count = 3
    }
  }
  
  # Get current workspace or default
  workspace = get_env("TF_WORKSPACE", "default")
  
  # Select configuration for current workspace
  config = lookup(local.workspace_configs, local.workspace, local.workspace_configs["default"])
}

inputs = {
  environment   = local.config.environment
  instance_type = local.config.instance_type
  replica_count = local.config.replica_count
  
  tags = {
    Environment = local.config.environment
    Workspace   = local.workspace
  }
}`,
    useCases: [
      'Test infrastructure changes before production',
      'Quick environment switching for development',
      'CI/CD pipelines with workspace-based deployments',
    ],
    bestPractices: [
      'Always define a default workspace configuration',
      'Keep workspace differences minimal',
      'Use separate state files per workspace',
    ],
    pitfalls: [
      'Workspaces share the same backend configuration',
      'Easy to accidentally apply to wrong workspace',
      'Not recommended for production multi-tenant isolation',
    ],
    relatedExamples: [
      { id: 'env-hierarchy', relationship: 'Alternative: folder-based environments' },
    ],
    tags: ['environment', 'workspace', 'isolation', 'TF_WORKSPACE'],
  },
  {
    id: 'env-feature-flags',
    name: 'Environment Feature Flags',
    description: 'Toggle features based on environment using configuration flags',
    category: 'environment',
    complexity: 'intermediate',
    code: `locals {
  env_config = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment = local.env_config.locals.environment
  
  # Feature flags per environment
  feature_flags = {
    dev = {
      enable_debug_logging = true
      enable_encryption    = false
      enable_backups       = false
      enable_monitoring    = false
      enable_waf           = false
    }
    staging = {
      enable_debug_logging = true
      enable_encryption    = true
      enable_backups       = true
      enable_monitoring    = true
      enable_waf           = false
    }
    production = {
      enable_debug_logging = false
      enable_encryption    = true
      enable_backups       = true
      enable_monitoring    = true
      enable_waf           = true
    }
  }
  
  # Get flags for current environment
  flags = local.feature_flags[local.environment]
}

inputs = {
  enable_debug_logging = local.flags.enable_debug_logging
  enable_encryption    = local.flags.enable_encryption
  enable_backups       = local.flags.enable_backups
  enable_monitoring    = local.flags.enable_monitoring
  enable_waf           = local.flags.enable_waf
}`,
    useCases: [
      'Gradually roll out features to production',
      'Reduce costs in non-production environments',
      'Toggle security features per environment',
    ],
    bestPractices: [
      'Default flags to the most secure/conservative option',
      'Document what each flag controls',
      'Keep flag names descriptive and consistent',
    ],
    pitfalls: [
      'Too many flags increase complexity',
      'Feature parity issues between environments',
      'Forgetting to enable critical features in production',
    ],
    relatedExamples: [
      { id: 'generate-conditional', relationship: 'Conditional generation based on flags' },
      { id: 'env-merging', relationship: 'Merge flags from multiple sources' },
    ],
    tags: ['environment', 'feature-flags', 'toggle', 'configuration'],
  },

  // =============================================================================
  // DEPENDENCIES CATEGORY
  // =============================================================================
  {
    id: 'dependency-basic',
    name: 'Basic Cross-Module Dependency',
    description: 'Reference outputs from another Terragrunt module',
    category: 'dependencies',
    complexity: 'basic',
    code: `# Define dependency on VPC module
dependency "vpc" {
  config_path = "../vpc"
}

# Define dependency on security groups module
dependency "security_groups" {
  config_path = "../security-groups"
}

inputs = {
  # Use outputs from dependencies
  vpc_id            = dependency.vpc.outputs.vpc_id
  subnet_ids        = dependency.vpc.outputs.private_subnet_ids
  security_group_id = dependency.security_groups.outputs.app_sg_id
}`,
    useCases: [
      'Share VPC IDs across multiple modules',
      'Reference security group IDs',
      'Chain module deployments in correct order',
    ],
    bestPractices: [
      'Keep dependency paths relative',
      'Document which outputs are being used',
      'Minimize the number of cross-module dependencies',
    ],
    pitfalls: [
      'Circular dependencies cause errors',
      'Output changes can break dependent modules',
      'Long dependency chains slow down planning',
    ],
    relatedExamples: [
      { id: 'dependency-mock-outputs', relationship: 'Mock outputs for faster development' },
      { id: 'dependency-skip', relationship: 'Skip dependencies in certain scenarios' },
    ],
    tags: ['dependency', 'outputs', 'cross-module', 'vpc'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#dependency',
  },
  {
    id: 'dependency-mock-outputs',
    name: 'Mock Outputs for Dependencies',
    description: 'Define mock outputs to enable plan without applying dependencies',
    category: 'dependencies',
    complexity: 'intermediate',
    code: `dependency "vpc" {
  config_path = "../vpc"
  
  # Mock outputs for planning when VPC doesn't exist yet
  mock_outputs = {
    vpc_id             = "vpc-mock-12345"
    private_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
    public_subnet_ids  = ["subnet-mock-3", "subnet-mock-4"]
    vpc_cidr_block     = "10.0.0.0/16"
  }
  
  # Only use mocks when allowed (not in production)
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "database" {
  config_path = "../rds"
  
  mock_outputs = {
    endpoint        = "mock-db.example.com:5432"
    connection_url  = "postgresql://mock:mock@mock-db.example.com:5432/app"
    read_replica_endpoints = []
  }
  
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  vpc_id          = dependency.vpc.outputs.vpc_id
  subnet_ids      = dependency.vpc.outputs.private_subnet_ids
  database_url    = dependency.database.outputs.connection_url
}`,
    useCases: [
      'Run terraform plan without applying dependencies first',
      'Faster development feedback loops',
      'CI validation of individual modules',
    ],
    bestPractices: [
      'Keep mock outputs realistic (correct types)',
      'Limit mock commands to validate and plan only',
      'Use shallow merge strategy for partial state',
    ],
    pitfalls: [
      'Mocks can hide dependency issues until apply',
      'Mock values that pass validation may fail at apply',
      'Don\'t allow mocks for apply commands',
    ],
    relatedExamples: [
      { id: 'dependency-basic', relationship: 'Basic dependency usage' },
      { id: 'dependency-skip', relationship: 'Skip dependencies entirely' },
    ],
    tags: ['dependency', 'mock', 'outputs', 'plan', 'development'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#dependency',
  },
  {
    id: 'dependency-skip',
    name: 'Conditional Dependency Skipping',
    description: 'Skip dependencies in specific scenarios like destroy or first deployment',
    category: 'dependencies',
    complexity: 'intermediate',
    code: `dependency "vpc" {
  config_path = "../vpc"
  
  # Skip dependency during destroy to avoid order issues
  skip_outputs = true
}

# Alternative: Use locals to conditionally handle dependencies
locals {
  # Check if this is a destroy operation
  is_destroy = get_env("TG_COMMAND", "") == "destroy"
  
  # Check if VPC module has been applied
  vpc_exists = fileexists("\${get_terragrunt_dir()}/../vpc/.terragrunt-cache")
}

dependency "database" {
  config_path = "../rds"
  
  # Skip outputs during destroy or if not yet created
  skip_outputs = local.is_destroy
  
  mock_outputs = {
    endpoint = "localhost:5432"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  # Handle case where dependency outputs might not exist
  database_endpoint = local.is_destroy ? "" : dependency.database.outputs.endpoint
}`,
    useCases: [
      'Destroy resources in correct order',
      'First-time deployment of new environments',
      'Handling optional dependencies',
    ],
    bestPractices: [
      'Use skip_outputs for destroy operations',
      'Provide sensible defaults when skipping',
      'Document why dependencies are skipped',
    ],
    pitfalls: [
      'Skipping can mask real dependency issues',
      'State may become inconsistent',
      'Test skip scenarios carefully',
    ],
    relatedExamples: [
      { id: 'dependency-mock-outputs', relationship: 'Alternative: mock outputs' },
      { id: 'dependency-basic', relationship: 'Basic dependency pattern' },
    ],
    tags: ['dependency', 'skip', 'destroy', 'conditional'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#dependency',
  },
  {
    id: 'dependency-graph',
    name: 'Complex Dependency Graph',
    description: 'Multi-level dependencies with diamond pattern handling',
    category: 'dependencies',
    complexity: 'advanced',
    code: `# This module depends on multiple modules that share common dependencies
# Dependency graph:
#
#     network
#    /       \\
#   db       cache
#    \\       /
#      app (this module)

dependency "network" {
  config_path = "../network"
}

dependency "database" {
  config_path = "../database"
  
  # Database depends on network, but we also need network
  # Terragrunt handles this automatically
}

dependency "cache" {
  config_path = "../cache"
  
  # Cache also depends on network
}

locals {
  # Aggregate outputs from all dependencies
  all_security_groups = concat(
    [dependency.database.outputs.security_group_id],
    [dependency.cache.outputs.security_group_id]
  )
}

inputs = {
  vpc_id                  = dependency.network.outputs.vpc_id
  subnet_ids              = dependency.network.outputs.app_subnet_ids
  
  database_endpoint       = dependency.database.outputs.endpoint
  database_port           = dependency.database.outputs.port
  
  cache_endpoint          = dependency.cache.outputs.endpoint
  cache_port              = dependency.cache.outputs.port
  
  allowed_security_groups = local.all_security_groups
}

# Specify explicit dependencies for destroy ordering
dependencies {
  paths = ["../network", "../database", "../cache"]
}`,
    useCases: [
      'Microservices with shared infrastructure',
      'Applications with multiple data stores',
      'Complex multi-tier architectures',
    ],
    bestPractices: [
      'Document the dependency graph in comments',
      'Use dependencies block for explicit ordering',
      'Consider module consolidation to reduce complexity',
    ],
    pitfalls: [
      'Deep graphs slow down terragrunt plan-all',
      'Circular dependencies are forbidden',
      'Changes to shared dependencies affect many modules',
    ],
    relatedExamples: [
      { id: 'dependency-basic', relationship: 'Simpler dependency example' },
      { id: 'dependency-skip', relationship: 'Handle complex destroy ordering' },
    ],
    tags: ['dependency', 'graph', 'multi-level', 'diamond', 'complex'],
    docsUrl: 'https://docs.terragrunt.com/features/stacks/',
  },

  // =============================================================================
  // DRY PATTERNS CATEGORY
  // =============================================================================
  {
    id: 'include-root',
    name: 'Root Include Pattern',
    description: 'Include common configuration from a root terragrunt.hcl',
    category: 'dry-patterns',
    complexity: 'basic',
    code: `# root.hcl at repository root
locals {
  # Common tags for all resources
  common_tags = {
    ManagedBy   = "Terragrunt"
    Repository  = "my-infrastructure"
    LastUpdated = timestamp()
  }
}

# Remote state configuration (inherited by all modules)
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "my-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# -------------------------------------------
# In child module terragrunt.hcl:

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  root_config = read_terragrunt_config(find_in_parent_folders("root.hcl"))
}

inputs = {
  tags = local.root_config.locals.common_tags
}`,
    useCases: [
      'Centralize remote state configuration',
      'Share common tags across all modules',
      'Define organization-wide defaults',
    ],
    bestPractices: [
      'Keep root.hcl minimal and focused',
      'Use path_relative_to_include() for unique state paths',
      'Document what the root config provides',
    ],
    pitfalls: [
      'Changes to root affect all modules',
      'Overriding root settings can be confusing',
      'Test root changes in non-production first',
    ],
    relatedExamples: [
      { id: 'include-multiple', relationship: 'Multiple include pattern' },
      { id: 'include-expose', relationship: 'Expose include for advanced usage' },
    ],
    tags: ['include', 'root', 'DRY', 'remote-state', 'common'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#include',
  },
  {
    id: 'include-multiple',
    name: 'Multiple Includes Pattern',
    description: 'Include configurations from multiple parent files',
    category: 'dry-patterns',
    complexity: 'intermediate',
    code: `# Multiple includes allow composing configurations from different sources

# Include the root configuration
include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

# Include environment-specific configuration
include "env" {
  path   = find_in_parent_folders("env.hcl")
  expose = true
}

# Include module-type specific configuration (e.g., for all ECS services)
include "ecs" {
  path           = "\${get_terragrunt_dir()}/../../_modules/ecs-service.hcl"
  expose         = true
  merge_strategy = "deep"
}

locals {
  # Access exposed values from includes
  environment = include.env.locals.environment
  aws_region  = include.env.locals.aws_region
  common_tags = include.root.locals.common_tags
  
  # ECS-specific settings from module include
  ecs_cluster = include.ecs.locals.cluster_name
}

inputs = {
  environment  = local.environment
  region       = local.aws_region
  cluster_name = local.ecs_cluster
  
  tags = merge(
    local.common_tags,
    {
      Environment = local.environment
      Service     = "my-service"
    }
  )
}`,
    useCases: [
      'Compose configurations from multiple sources',
      'Share module-type-specific configurations',
      'Separate concerns across different config files',
    ],
    bestPractices: [
      'Name includes descriptively',
      'Use expose = true to access included locals',
      'Document the purpose of each include',
    ],
    pitfalls: [
      'Include order affects merge behavior',
      'Can be hard to trace where values come from',
      'Avoid deeply nested includes',
    ],
    relatedExamples: [
      { id: 'include-root', relationship: 'Basic single include' },
      { id: 'include-expose', relationship: 'Expose include details' },
    ],
    tags: ['include', 'multiple', 'compose', 'DRY', 'merge'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#include',
  },
  {
    id: 'include-expose',
    name: 'Exposed Include for Overrides',
    description: 'Expose included configurations and selectively override',
    category: 'dry-patterns',
    complexity: 'intermediate',
    code: `# _envcommon/service.hcl - shared service configuration
locals {
  # Default service configuration
  default_cpu    = 256
  default_memory = 512
  default_port   = 8080
  
  health_check = {
    path     = "/health"
    interval = 30
    timeout  = 5
  }
}

terraform {
  source = "git::git@github.com:my-org/terraform-modules.git//ecs-service?ref=v1.0.0"
}

# -------------------------------------------
# In module terragrunt.hcl:

include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "service" {
  path   = "\${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/service.hcl"
  expose = true
}

locals {
  # Override specific values while keeping defaults
  cpu    = 512  # Override: need more CPU
  memory = include.service.locals.default_memory  # Keep default
  port   = include.service.locals.default_port    # Keep default
  
  # Deep merge health check with overrides
  health_check = merge(
    include.service.locals.health_check,
    {
      path = "/api/health"  # Custom health endpoint
    }
  )
}

inputs = {
  cpu          = local.cpu
  memory       = local.memory
  port         = local.port
  health_check = local.health_check
}`,
    useCases: [
      'Define service templates with defaults',
      'Override specific values per module',
      'Share configuration across similar modules',
    ],
    bestPractices: [
      'Provide sensible defaults in shared configs',
      'Document which values can be overridden',
      'Use merge() for partial overrides of maps',
    ],
    pitfalls: [
      'Exposed locals create coupling',
      'Changing defaults affects all consumers',
      'Type mismatches between override and default',
    ],
    relatedExamples: [
      { id: 'include-multiple', relationship: 'Using multiple includes' },
      { id: 'dry-read-config', relationship: 'Alternative with read_terragrunt_config' },
    ],
    tags: ['include', 'expose', 'override', 'defaults', 'template'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/blocks/#include',
  },
  {
    id: 'dry-read-config',
    name: 'Read Terragrunt Config Pattern',
    description: 'Use read_terragrunt_config for selective configuration reuse',
    category: 'dry-patterns',
    complexity: 'intermediate',
    code: `# _shared/common.hcl - shared configuration (not included, just read)
locals {
  aws_account_ids = {
    dev        = "111111111111"
    staging    = "222222222222"
    production = "333333333333"
  }
  
  vpc_cidrs = {
    dev        = "10.0.0.0/16"
    staging    = "10.1.0.0/16"
    production = "10.2.0.0/16"
  }
  
  database_configs = {
    dev = {
      instance_class = "db.t3.micro"
      multi_az       = false
    }
    staging = {
      instance_class = "db.t3.small"
      multi_az       = false
    }
    production = {
      instance_class = "db.r5.large"
      multi_az       = true
    }
  }
}

# -------------------------------------------
# In module terragrunt.hcl:

locals {
  # Read environment from folder structure
  env_config  = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  environment = local.env_config.locals.environment
  
  # Read shared configuration
  shared = read_terragrunt_config(
    "\${dirname(find_in_parent_folders("root.hcl"))}/_shared/common.hcl"
  )
  
  # Look up values for current environment
  account_id = local.shared.locals.aws_account_ids[local.environment]
  vpc_cidr   = local.shared.locals.vpc_cidrs[local.environment]
  db_config  = local.shared.locals.database_configs[local.environment]
}

inputs = {
  account_id     = local.account_id
  vpc_cidr       = local.vpc_cidr
  instance_class = local.db_config.instance_class
  multi_az       = local.db_config.multi_az
}`,
    useCases: [
      'Lookup tables for environment-specific values',
      'Shared constants without full include',
      'Selective reuse of specific configurations',
    ],
    bestPractices: [
      'Use read_terragrunt_config for data lookups',
      'Keep shared configs as pure data (no side effects)',
      'Use include for behavior, read for data',
    ],
    pitfalls: [
      'File must exist or terragrunt fails',
      'No dependency tracking between read files',
      'Can\'t use all HCL features in read files',
    ],
    relatedExamples: [
      { id: 'include-expose', relationship: 'Alternative with exposed include' },
      { id: 'dry-locals', relationship: 'Combining with locals patterns' },
    ],
    tags: ['read_terragrunt_config', 'lookup', 'shared', 'data', 'DRY'],
    docsUrl: 'https://docs.terragrunt.com/reference/hcl/functions/#read_terragrunt_config',
  },
  {
    id: 'dry-locals',
    name: 'DRY Locals Pattern',
    description: 'Compute derived values in locals to avoid repetition',
    category: 'dry-patterns',
    complexity: 'basic',
    code: `locals {
  # Parse environment from directory structure
  # Example path: live/production/us-east-1/app/web-server
  path_parts  = split("/", path_relative_to_include())
  environment = local.path_parts[0]  # production
  region      = local.path_parts[1]  # us-east-1
  app_name    = local.path_parts[2]  # app
  module_name = local.path_parts[3]  # web-server
  
  # Derive resource naming convention
  name_prefix = "\${local.environment}-\${local.region}-\${local.app_name}"
  full_name   = "\${local.name_prefix}-\${local.module_name}"
  
  # Common tags derived from parsed values
  common_tags = {
    Environment = local.environment
    Region      = local.region
    Application = local.app_name
    Module      = local.module_name
    ManagedBy   = "Terragrunt"
    FullName    = local.full_name
  }
  
  # Conditional values based on environment
  is_production = local.environment == "production"
  
  instance_settings = local.is_production ? {
    instance_type = "m5.large"
    min_size      = 3
    max_size      = 10
  } : {
    instance_type = "t3.micro"
    min_size      = 1
    max_size      = 2
  }
}

inputs = {
  name          = local.full_name
  instance_type = local.instance_settings.instance_type
  min_size      = local.instance_settings.min_size
  max_size      = local.instance_settings.max_size
  tags          = local.common_tags
}`,
    useCases: [
      'Derive values from directory structure',
      'Consistent naming conventions',
      'Environment-conditional configurations',
    ],
    bestPractices: [
      'Parse path once, reuse throughout',
      'Use descriptive local names',
      'Keep conditional logic simple',
    ],
    pitfalls: [
      'Path parsing is fragile to structure changes',
      'Complex locals are hard to debug',
      'Don\'t repeat logic that belongs in modules',
    ],
    relatedExamples: [
      { id: 'env-merging', relationship: 'Merge with external configs' },
      { id: 'dry-read-config', relationship: 'Read external configurations' },
    ],
    tags: ['locals', 'DRY', 'naming', 'conditional', 'parsing'],
  },
];

/**
 * Manager for advanced Terragrunt code examples
 */
export class AdvancedExamplesManager {
  private examples: Map<string, AdvancedExample>;
  private loaded: boolean = false;

  constructor() {
    this.examples = new Map();
  }

  /**
   * Load examples into the manager
   */
  private loadExamples(): void {
    if (this.loaded) return;
    
    for (const example of ADVANCED_EXAMPLES) {
      this.examples.set(example.id, example);
    }
    this.loaded = true;
  }

  /**
   * Get an example by its ID
   */
  getExample(id: string): AdvancedExample | undefined {
    this.loadExamples();
    return this.examples.get(id);
  }

  /**
   * List all examples, optionally filtered by category
   */
  listExamples(category?: AdvancedExampleCategory): AdvancedExample[] {
    this.loadExamples();
    const all = Array.from(this.examples.values());
    
    if (category) {
      return all.filter(e => e.category === category);
    }
    return all;
  }

  /**
   * Search examples by query string
   * Searches id, name, description, tags, and use cases
   */
  searchExamples(query: string): AdvancedExampleSearchResult[] {
    this.loadExamples();
    const results: AdvancedExampleSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    for (const example of this.examples.values()) {
      let matchType: AdvancedExampleSearchResult['matchType'] | null = null;
      let score = 0;

      // Exact ID match (highest priority)
      if (example.id.toLowerCase() === queryLower) {
        matchType = 'id';
        score = 1.0;
      }
      // Partial ID match
      else if (example.id.toLowerCase().includes(queryLower)) {
        matchType = 'id';
        score = 0.9;
      }
      // Name match
      else if (example.name.toLowerCase().includes(queryLower)) {
        matchType = 'name';
        score = 0.85;
      }
      // Tag exact match
      else if (example.tags.some(t => t.toLowerCase() === queryLower)) {
        matchType = 'tag';
        score = 0.8;
      }
      // Tag partial match
      else if (example.tags.some(t => t.toLowerCase().includes(queryLower))) {
        matchType = 'tag';
        score = 0.7;
      }
      // Description match
      else if (example.description.toLowerCase().includes(queryLower)) {
        matchType = 'description';
        score = 0.6;
      }
      // Use case match
      else if (example.useCases.some(uc => uc.toLowerCase().includes(queryLower))) {
        matchType = 'use-case';
        score = 0.5;
      }
      // Multi-term search: check if all terms appear somewhere
      else if (queryTerms.length > 1) {
        const searchableText = [
          example.id,
          example.name,
          example.description,
          ...example.tags,
          ...example.useCases,
        ].join(' ').toLowerCase();
        
        const matchedTerms = queryTerms.filter(term => searchableText.includes(term));
        if (matchedTerms.length === queryTerms.length) {
          matchType = 'description';
          score = 0.4 + (matchedTerms.length / queryTerms.length) * 0.2;
        }
      }

      if (matchType) {
        results.push({ example, matchType, score });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get all category information with example counts
   */
  getCategories(): AdvancedExampleCategoryInfo[] {
    this.loadExamples();
    
    const categories: AdvancedExampleCategory[] = [
      'hooks',
      'generate',
      'environment',
      'dependencies',
      'dry-patterns',
    ];

    return categories.map(cat => ({
      ...CATEGORY_INFO[cat],
      exampleCount: this.listExamples(cat).length,
    }));
  }

  /**
   * Get the total number of examples
   */
  getExampleCount(): number {
    this.loadExamples();
    return this.examples.size;
  }

  /**
   * Format an example as Markdown
   */
  formatExampleAsMarkdown(example: AdvancedExample): string {
    const lines: string[] = [];
    
    lines.push(`# ${example.name}`);
    lines.push('');
    lines.push(`**Category:** ${CATEGORY_INFO[example.category].name}`);
    lines.push(`**Complexity:** ${example.complexity}`);
    lines.push(`**ID:** \`${example.id}\``);
    lines.push('');
    lines.push('## Description');
    lines.push('');
    lines.push(example.description);
    lines.push('');
    lines.push('## Code Example');
    lines.push('');
    lines.push('```hcl');
    lines.push(example.code);
    lines.push('```');
    lines.push('');
    
    if (example.useCases.length > 0) {
      lines.push('## Use Cases');
      lines.push('');
      for (const uc of example.useCases) {
        lines.push(`- ${uc}`);
      }
      lines.push('');
    }
    
    if (example.bestPractices.length > 0) {
      lines.push('## Best Practices');
      lines.push('');
      for (const bp of example.bestPractices) {
        lines.push(`- ${bp}`);
      }
      lines.push('');
    }
    
    if (example.pitfalls.length > 0) {
      lines.push('## Common Pitfalls');
      lines.push('');
      for (const pf of example.pitfalls) {
        lines.push(`- ⚠️ ${pf}`);
      }
      lines.push('');
    }
    
    if (example.relatedExamples.length > 0) {
      lines.push('## Related Examples');
      lines.push('');
      for (const rel of example.relatedExamples) {
        lines.push(`- \`${rel.id}\`: ${rel.relationship}`);
      }
      lines.push('');
    }
    
    lines.push('## Tags');
    lines.push('');
    lines.push(example.tags.map(t => `\`${t}\``).join(', '));
    
    if (example.docsUrl) {
      lines.push('');
      lines.push('## Documentation');
      lines.push('');
      lines.push(`[Official Docs](${example.docsUrl})`);
    }
    
    return lines.join('\n');
  }
}
