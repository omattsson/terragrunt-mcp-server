import { TerragruntDocsManager, TerragruntDoc } from './docs.js';
import { LRUCache } from 'lru-cache';

/**
 * Category for static best practices
 */
export type BestPracticeCategory = 
  | 'project_structure'
  | 'environment_config'
  | 'module_organization'
  | 'state_management'
  | 'dependencies'
  | 'ci_cd'
  | 'security'
  | 'performance'
  | 'testing';

/**
 * Static best practice definition - curated recommendations always available
 */
export interface StaticBestPractice {
  id: string;                      // Unique identifier
  practice: string;                // The recommendation
  rationale: string;               // Why this is important
  category: BestPracticeCategory;  // Topic category
  priority: 'critical' | 'recommended' | 'optional';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  examples: string[];              // Code examples
  antipatterns: string[];          // What to avoid
  tradeoffs: string[];             // Considerations
  relatedDocs: string[];           // Documentation URLs
}

/**
 * Static curated best practices for Terragrunt.
 * These provide reliable recommendations even when doc extraction fails.
 */
export const STATIC_BEST_PRACTICES: StaticBestPractice[] = [
  // ============ PROJECT STRUCTURE ============
  {
    id: 'ps-001',
    practice: 'Separate live infrastructure from reusable modules using distinct directories',
    rationale: 'Keeping live environment configurations separate from reusable module definitions provides clear separation of concerns, makes it easier to manage environment-specific settings, and enables module reuse across projects.',
    category: 'project_structure',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Recommended project structure
├── live/                    # Environment-specific configurations
│   ├── dev/
│   │   ├── us-east-1/
│   │   │   ├── vpc/
│   │   │   │   └── terragrunt.hcl
│   │   │   └── eks/
│   │   │       └── terragrunt.hcl
│   │   └── terragrunt.hcl   # Dev environment root
│   ├── staging/
│   └── prod/
├── modules/                 # Reusable Terraform modules
│   ├── vpc/
│   ├── eks/
│   └── rds/
└── terragrunt.hcl          # Root configuration`
    ],
    antipatterns: [
      'Mixing environment configs and module code in the same directory',
      'Duplicating module code across environments instead of referencing shared modules',
      'Using a flat structure without environment/region organization'
    ],
    tradeoffs: [
      'More directories to navigate but clearer organization',
      'Requires understanding of include/dependency patterns'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/getting-started/quick-start/']
  },
  {
    id: 'ps-002',
    practice: 'Use a root terragrunt.hcl for common configuration shared across all environments',
    rationale: 'A root configuration file prevents duplication of common settings like remote state backend configuration, provider generation, and shared variables. Child configurations can include and override as needed.',
    category: 'project_structure',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Root terragrunt.hcl
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

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
}
EOF
}`,
      `# Child terragrunt.hcl (live/dev/us-east-1/vpc/terragrunt.hcl)
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../../modules/vpc"
}

inputs = {
  vpc_cidr = "10.0.0.0/16"
  environment = "dev"
}`
    ],
    antipatterns: [
      'Copying remote_state configuration to every child module',
      'Not using include to reference parent configurations',
      'Hardcoding backend keys instead of using path_relative_to_include()'
    ],
    tradeoffs: [
      'All environments share the same backend configuration pattern',
      'Changes to root config affect all environments'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/']
  },
  {
    id: 'ps-003',
    practice: 'Use _envcommon directory for configurations shared within an environment',
    rationale: 'The _envcommon pattern allows you to define module configurations that are common across all deployments within an environment, reducing duplication while allowing per-deployment overrides.',
    category: 'project_structure',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# Directory structure with _envcommon
├── live/
│   ├── _envcommon/
│   │   ├── vpc.hcl          # Common VPC config
│   │   └── eks.hcl          # Common EKS config
│   ├── dev/
│   │   ├── us-east-1/
│   │   │   └── vpc/
│   │   │       └── terragrunt.hcl  # Includes _envcommon/vpc.hcl
│   │   └── eu-west-1/
│   │       └── vpc/
│   │           └── terragrunt.hcl  # Includes _envcommon/vpc.hcl`,
      `# _envcommon/vpc.hcl
terraform {
  source = "\${local.base_source_url}//modules/vpc?ref=v1.0.0"
}

locals {
  base_source_url = "git::git@github.com:myorg/infrastructure-modules.git"
}

inputs = {
  enable_dns_hostnames = true
  enable_dns_support   = true
}`,
      `# live/dev/us-east-1/vpc/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

include "envcommon" {
  path   = "\${dirname(find_in_parent_folders())}/live/_envcommon/vpc.hcl"
  merge_strategy = "deep"
}

inputs = {
  vpc_cidr = "10.0.0.0/16"  # Override for this specific deployment
}`
    ],
    antipatterns: [
      'Duplicating module source and common inputs in every terragrunt.hcl',
      'Not leveraging merge_strategy for flexible overrides'
    ],
    tradeoffs: [
      'Additional indirection can make debugging harder',
      'Must understand merge_strategy options (deep, shallow, no_merge)'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-terragrunt-architecture-dry/']
  },
  {
    id: 'ps-004',
    practice: 'Organize directories by environment, then region/account, then component',
    rationale: 'A consistent hierarchy of environment > region > component makes it easy to understand what infrastructure exists where, enables targeted operations on specific environments or regions, and supports multi-region deployments.',
    category: 'project_structure',
    priority: 'recommended',
    experienceLevel: 'beginner',
    examples: [
      `# Recommended hierarchy
live/
├── dev/
│   ├── account.hcl          # Dev AWS account ID
│   ├── us-east-1/
│   │   ├── region.hcl       # Region-specific settings
│   │   ├── vpc/
│   │   ├── eks/
│   │   └── rds/
│   └── us-west-2/
│       ├── region.hcl
│       └── vpc/
├── staging/
│   └── us-east-1/
└── prod/
    ├── us-east-1/
    └── eu-west-1/`,
      `# Using read_terragrunt_config to load hierarchy configs
# live/dev/us-east-1/vpc/terragrunt.hcl
locals {
  environment_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region_vars      = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  account_vars     = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  
  environment = local.environment_vars.locals.environment
  region      = local.region_vars.locals.aws_region
  account_id  = local.account_vars.locals.account_id
}`
    ],
    antipatterns: [
      'Flat structure mixing all environments in one directory',
      'Organizing by component first (all VPCs together) instead of by environment',
      'Inconsistent hierarchy across different parts of the codebase'
    ],
    tradeoffs: [
      'Deeper directory nesting',
      'More files to maintain (env.hcl, region.hcl per level)'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/getting-started/quick-start/']
  },
  {
    id: 'ps-005',
    practice: 'Use consistent naming conventions for terragrunt.hcl files and directories',
    rationale: 'Consistent naming makes automation easier, improves discoverability, and helps team members navigate the codebase. Use lowercase with hyphens or underscores.',
    category: 'project_structure',
    priority: 'recommended',
    experienceLevel: 'beginner',
    examples: [
      `# Good naming conventions
live/
├── dev/
│   └── us-east-1/
│       ├── vpc-main/           # Descriptive, lowercase, hyphens
│       ├── eks-cluster/
│       ├── rds-postgres/
│       └── lambda-api/`,
      `# Use descriptive names for multiple instances
live/prod/us-east-1/
├── vpc-primary/
├── vpc-secondary/
├── eks-platform/
├── eks-data-processing/
└── rds-users-db/`
    ],
    antipatterns: [
      'Using generic names like "module1", "infra", "stuff"',
      'Mixing naming conventions (camelCase, PascalCase, snake_case)',
      'Names that don\'t indicate what the module deploys'
    ],
    tradeoffs: [
      'Longer directory names vs clarity',
      'May need to update automation scripts when renaming'
    ],
    relatedDocs: []
  },

  // ============ ENVIRONMENT CONFIGURATION ============
  {
    id: 'ec-001',
    practice: 'Use get_env() for sensitive values and credentials from environment variables',
    rationale: 'Environment variables keep secrets out of version control, integrate well with CI/CD systems and secret managers, and follow the twelve-factor app methodology.',
    category: 'environment_config',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Using get_env for sensitive values
locals {
  db_password = get_env("DB_PASSWORD", "")
  api_key     = get_env("API_KEY")  # Required, no default
}

inputs = {
  database_password = local.db_password
  api_key           = local.api_key
}`,
      `# With validation
locals {
  db_password = get_env("DB_PASSWORD", "")
}

# Fail early if required env var is missing
terraform {
  before_hook "validate_env" {
    commands = ["apply", "plan"]
    execute  = ["bash", "-c", "test -n \\"$DB_PASSWORD\\" || (echo 'DB_PASSWORD not set' && exit 1)"]
  }
}`
    ],
    antipatterns: [
      'Hardcoding passwords or API keys in terragrunt.hcl',
      'Committing .env files with real credentials',
      'Using default values for sensitive data in production'
    ],
    tradeoffs: [
      'Requires environment variable setup in CI/CD',
      'Local development needs .env file or exports'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/built-in-functions/#get_env']
  },
  {
    id: 'ec-002',
    practice: 'Define environment-specific variables in dedicated configuration files per environment level',
    rationale: 'Centralizing environment variables in env.hcl, account.hcl, or region.hcl files makes it easy to understand what differs between environments and reduces duplication.',
    category: 'environment_config',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# live/dev/env.hcl
locals {
  environment = "dev"
  
  # Environment-specific settings
  instance_type    = "t3.small"
  min_size         = 1
  max_size         = 3
  enable_deletion_protection = false
}`,
      `# live/prod/env.hcl
locals {
  environment = "prod"
  
  # Production settings - larger, more resilient
  instance_type    = "t3.large"
  min_size         = 3
  max_size         = 10
  enable_deletion_protection = true
}`,
      `# Using environment config in child modules
include "root" {
  path = find_in_parent_folders()
}

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals
}

inputs = {
  environment     = local.env.environment
  instance_type   = local.env.instance_type
  min_size        = local.env.min_size
  max_size        = local.env.max_size
}`
    ],
    antipatterns: [
      'Scattering environment-specific values across many files',
      'Using conditionals based on path to determine environment',
      'Not having a clear source of truth for environment settings'
    ],
    tradeoffs: [
      'Requires consistent file naming across environments',
      'Changes to structure affect all child modules'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/built-in-functions/#read_terragrunt_config']
  },
  {
    id: 'ec-003',
    practice: 'Use include with merge_strategy for flexible configuration inheritance',
    rationale: 'The merge_strategy option controls how included configurations combine with local settings. Understanding and using this correctly enables DRY configurations while maintaining flexibility.',
    category: 'environment_config',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# deep merge - recursively merges maps and lists
include "envcommon" {
  path           = "\${dirname(find_in_parent_folders())}/live/_envcommon/vpc.hcl"
  merge_strategy = "deep"
  expose         = true  # Access included locals via include.envcommon.locals
}

# Local inputs are deep merged with included inputs
inputs = {
  tags = {
    Team = "platform"  # Merged with tags from _envcommon
  }
}`,
      `# shallow merge - only top-level keys are merged
include "base" {
  path           = find_in_parent_folders("base.hcl")
  merge_strategy = "shallow"
}

# Local inputs completely replace included inputs at top level
inputs = {
  vpc_cidr = "10.1.0.0/16"  # Replaces, not merges
}`,
      `# no_merge - included config is available but not merged
include "reference" {
  path           = "\${get_terragrunt_dir()}/../../common/reference.hcl"
  merge_strategy = "no_merge"
  expose         = true
}

# Selectively use values from included config
inputs = {
  ami_id = include.reference.locals.approved_ami_ids["ubuntu-22.04"]
}`
    ],
    antipatterns: [
      'Not specifying merge_strategy and relying on defaults',
      'Using deep merge when you want to replace entire blocks',
      'Not using expose when you need to reference included locals'
    ],
    tradeoffs: [
      'deep merge can produce unexpected results with complex nested structures',
      'no_merge requires more explicit configuration'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#include']
  },
  {
    id: 'ec-004',
    practice: 'Use locals for computed values and keep inputs simple',
    rationale: 'The locals block is for computing values, transforming data, and assembling configuration. Inputs should receive final values, not contain complex logic.',
    category: 'environment_config',
    priority: 'recommended',
    experienceLevel: 'beginner',
    examples: [
      `locals {
  # Load configuration files
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  
  # Extract commonly used values
  environment = local.env_vars.locals.environment
  region      = local.region_vars.locals.aws_region
  account_id  = local.account_vars.locals.account_id
  
  # Compute derived values
  name_prefix = "\${local.environment}-\${local.region}"
  
  # Standard tags
  common_tags = {
    Environment = local.environment
    Region      = local.region
    ManagedBy   = "terragrunt"
    Project     = "infrastructure"
  }
}

# Inputs are clean and simple
inputs = {
  name_prefix = local.name_prefix
  tags        = local.common_tags
  vpc_cidr    = local.env_vars.locals.vpc_cidr
}`
    ],
    antipatterns: [
      'Putting complex expressions directly in inputs block',
      'Repeating the same read_terragrunt_config calls in multiple places',
      'Not extracting repeated values into named locals'
    ],
    tradeoffs: [
      'More lines of code in locals block',
      'Must scroll to find actual input values'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#locals']
  },
  {
    id: 'ec-005',
    practice: 'Use dependency blocks with mock_outputs for cross-module data sharing',
    rationale: 'Dependencies allow modules to reference outputs from other modules. mock_outputs enable planning and applying modules in isolation during development.',
    category: 'environment_config',
    priority: 'critical',
    experienceLevel: 'intermediate',
    examples: [
      `dependency "vpc" {
  config_path = "../vpc"
  
  # Mock outputs for plan/apply when VPC doesn't exist yet
  mock_outputs = {
    vpc_id     = "vpc-mock-12345"
    subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs_merge_strategy_with_state  = "shallow"
}

dependency "security_group" {
  config_path = "../security-group"
  
  mock_outputs = {
    security_group_id = "sg-mock-12345"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  vpc_id            = dependency.vpc.outputs.vpc_id
  subnet_ids        = dependency.vpc.outputs.subnet_ids
  security_group_id = dependency.security_group.outputs.security_group_id
}`
    ],
    antipatterns: [
      'Hardcoding resource IDs instead of using dependencies',
      'Not providing mock_outputs, breaking isolated plans',
      'Using data sources when a dependency would be cleaner'
    ],
    tradeoffs: [
      'Creates implicit ordering requirements',
      'Mock values may not reflect real resource behavior'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependency']
  },
  {
    id: 'ec-006',
    practice: 'Use feature flags for gradual rollouts and environment-specific features',
    rationale: 'Feature flags allow enabling/disabling functionality per environment without code changes. Terragrunt feature blocks provide a clean pattern for this.',
    category: 'environment_config',
    priority: 'optional',
    experienceLevel: 'advanced',
    examples: [
      `# Define feature flags
feature "enable_monitoring" {
  default = false
}

feature "use_spot_instances" {
  default = false
}

locals {
  # Feature flags from environment
  monitoring_enabled = feature.enable_monitoring.value
  use_spot           = feature.use_spot_instances.value
}

inputs = {
  enable_cloudwatch_alarms = local.monitoring_enabled
  enable_datadog           = local.monitoring_enabled
  use_spot_instances       = local.use_spot
}`,
      `# Override in specific environment using env vars
# TG_FEATURE_enable_monitoring=true terragrunt apply`
    ],
    antipatterns: [
      'Using complex conditionals based on environment name',
      'Hardcoding feature availability per environment in code',
      'Not having a centralized way to manage feature flags'
    ],
    tradeoffs: [
      'Additional complexity for simple on/off decisions',
      'Must track which features are enabled where'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#feature']
  },

  // ============ MODULE ORGANIZATION ============
  {
    id: 'mo-001',
    practice: 'Keep Terraform modules small, focused, and single-purpose',
    rationale: 'Small modules are easier to understand, test, and reuse. They have fewer inputs, clearer interfaces, and can be composed together for complex deployments.',
    category: 'module_organization',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Good: Single-purpose modules
modules/
├── vpc/                    # Just VPC, subnets, route tables
├── eks-cluster/           # Just EKS control plane
├── eks-node-group/        # Just node groups
├── rds-instance/          # Just RDS, no networking
└── security-group/        # Just security group rules`,
      `# Compose in Terragrunt
# live/prod/eks/terragrunt.hcl
dependency "vpc" {
  config_path = "../vpc"
}

dependency "node_security_group" {
  config_path = "../eks-node-sg"
}

terraform {
  source = "../../../modules/eks-cluster"
}

inputs = {
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.private_subnet_ids
  # Composed from multiple small modules
}`
    ],
    antipatterns: [
      'Creating "god modules" that deploy entire environments',
      'Modules with 50+ input variables',
      'Combining unrelated resources (e.g., VPC + database + application)'
    ],
    tradeoffs: [
      'More modules to maintain',
      'More dependency relationships to manage',
      'May need wrapper modules for common patterns'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-terraform-code-dry/']
  },
  {
    id: 'mo-002',
    practice: 'Version your Terraform modules and pin versions in Terragrunt',
    rationale: 'Version pinning ensures reproducible deployments, allows controlled upgrades, and prevents breaking changes from affecting production unexpectedly.',
    category: 'module_organization',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Pin to specific version tag
terraform {
  source = "git::git@github.com:myorg/modules.git//vpc?ref=v1.2.3"
}`,
      `# Pin to commit SHA for exact reproducibility
terraform {
  source = "git::git@github.com:myorg/modules.git//vpc?ref=abc123def456"
}`,
      `# Use version ranges in _envcommon, exact in prod
# _envcommon/vpc.hcl (dev/staging can use latest minor)
terraform {
  source = "git::git@github.com:myorg/modules.git//vpc?ref=v1.2"
}

# live/prod/vpc/terragrunt.hcl (exact version)
terraform {
  source = "git::git@github.com:myorg/modules.git//vpc?ref=v1.2.3"
}`
    ],
    antipatterns: [
      'Using ref=main or ref=master for production',
      'Not versioning modules at all',
      'Different production instances using different versions unintentionally'
    ],
    tradeoffs: [
      'Requires discipline to upgrade versions',
      'May miss important bug fixes if not updated regularly'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-terraform-code-dry/']
  },
  {
    id: 'mo-003',
    practice: 'Document module interfaces with clear input/output descriptions',
    rationale: 'Good documentation in variable and output blocks makes modules self-documenting, helps consumers understand expected values, and enables better IDE/tooling support.',
    category: 'module_organization',
    priority: 'recommended',
    experienceLevel: 'beginner',
    examples: [
      `# In Terraform module: variables.tf
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC. Must be a valid IPv4 CIDR (e.g., 10.0.0.0/16)"
  
  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "enable_dns_hostnames" {
  type        = bool
  default     = true
  description = "Enable DNS hostnames in the VPC. Required for EKS and many AWS services."
}`,
      `# In Terraform module: outputs.tf
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the created VPC"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "List of private subnet IDs for deploying internal resources"
}`
    ],
    antipatterns: [
      'Variables without descriptions',
      'Outputs without descriptions',
      'Generic descriptions like "the value" or "input variable"'
    ],
    tradeoffs: [
      'More time writing documentation',
      'Descriptions can become outdated if not maintained'
    ],
    relatedDocs: []
  },

  // ============ STATE MANAGEMENT ============
  {
    id: 'sm-001',
    practice: 'Always use remote state with locking for team environments',
    rationale: 'Remote state enables collaboration, provides state locking to prevent concurrent modifications, and ensures state is safely backed up and versioned.',
    category: 'state_management',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Root terragrunt.hcl with S3 backend
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "mycompany-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
    
    # Prevent accidental bucket deletion
    skip_bucket_versioning = false
  }
}`
    ],
    antipatterns: [
      'Using local state files for shared infrastructure',
      'Not enabling state locking (DynamoDB for S3)',
      'Not enabling encryption for state files',
      'Multiple teams using the same state file'
    ],
    tradeoffs: [
      'Additional infrastructure to manage (S3 bucket, DynamoDB table)',
      'Costs associated with state storage and locking'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/']
  },
  {
    id: 'sm-002',
    practice: 'Use path_relative_to_include() for unique state keys',
    rationale: 'This function generates unique state file paths based on directory structure, preventing state file collisions and making it clear which infrastructure corresponds to which state.',
    category: 'state_management',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Root terragrunt.hcl
remote_state {
  backend = "s3"
  config = {
    bucket = "terraform-state"
    key    = "\${path_relative_to_include()}/terraform.tfstate"
    # Results in keys like:
    # live/dev/us-east-1/vpc/terraform.tfstate
    # live/prod/us-west-2/eks/terraform.tfstate
  }
}`
    ],
    antipatterns: [
      'Hardcoding state keys',
      'Using the same state key for different modules',
      'Manual key construction that can lead to collisions'
    ],
    tradeoffs: [
      'State key structure mirrors directory structure',
      'Renaming directories requires state migration'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/built-in-functions/#path_relative_to_include']
  },

  // ============ DEPENDENCIES ============
  {
    id: 'dp-001',
    practice: 'Always provide mock_outputs for dependencies to enable isolated planning',
    rationale: 'Mock outputs allow terragrunt plan to succeed even when dependent modules haven\'t been applied yet. This is essential for CI/CD pipelines and developing new modules.',
    category: 'dependencies',
    priority: 'critical',
    experienceLevel: 'intermediate',
    examples: [
      `dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id            = "vpc-00000000000000000"
    vpc_cidr          = "10.0.0.0/16"
    private_subnet_ids = ["subnet-00000000000000001", "subnet-00000000000000002"]
    public_subnet_ids  = ["subnet-00000000000000003", "subnet-00000000000000004"]
  }
  
  # Only use mocks for validate and plan
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}`
    ],
    antipatterns: [
      'No mock outputs, breaking CI/CD plans',
      'Mock outputs that don\'t match real output structure',
      'Allowing mock outputs during apply'
    ],
    tradeoffs: [
      'Must keep mock outputs in sync with module outputs',
      'Mocks may not catch type/structure mismatches'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependency']
  },
  {
    id: 'dp-002',
    practice: 'Minimize dependency depth to avoid long apply chains',
    rationale: 'Deep dependency chains increase apply time, make troubleshooting harder, and create more points of failure. Design for shallow, parallel-friendly dependency graphs.',
    category: 'dependencies',
    priority: 'recommended',
    experienceLevel: 'advanced',
    examples: [
      `# Good: Shallow dependencies (max 2-3 levels)
vpc (no deps)
├── security-groups (depends on vpc)
├── eks-cluster (depends on vpc, security-groups)
└── rds (depends on vpc, security-groups)

# Avoid: Deep chains
vpc -> subnet -> route-table -> nat-gateway -> security-group -> eks -> nodegroup`
    ],
    antipatterns: [
      'Linear chains of 5+ dependencies',
      'Every module depending on a "base" module',
      'Circular dependencies (Terragrunt will error)'
    ],
    tradeoffs: [
      'May need to combine some resources to reduce deps',
      'Flatter structures may have more parallel applies'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/execute-terraform-commands-on-multiple-modules-at-once/']
  },

  // ============ CI/CD ============
  {
    id: 'cd-001',
    practice: 'Use run --all with bounded parallelism for efficient CI/CD pipelines',
    rationale: 'The run --all command applies changes to multiple units while respecting dependencies. Bounded parallelism speeds up execution while staying within API rate limits.',
    category: 'ci_cd',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# Apply all modules in dependency order with parallelism
terragrunt run --all --parallelism 5 -- apply

# Plan all and save output
terragrunt run --all --parallelism 10 --out-dir tfplans -- plan`,
      `# GitHub Actions example
- name: Terragrunt Apply
  run: |
    cd live/prod
    terragrunt run --all \
      --parallelism 5 \
      --non-interactive \
      -- apply -auto-approve`
    ],
    antipatterns: [
      'Applying modules one at a time in scripts',
      'Unlimited parallelism (API rate limiting)',
      'Not using --non-interactive in CI'
    ],
    tradeoffs: [
      'Higher parallelism = faster but more API calls',
      'run --all applies might be harder to debug'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/execute-terraform-commands-on-multiple-modules-at-once/']
  },
  {
    id: 'cd-002',
    practice: 'Implement plan/apply separation with artifact storage in pipelines',
    rationale: 'Storing plan files as artifacts ensures the exact planned changes are what gets applied, enables review workflows, and provides audit trails.',
    category: 'ci_cd',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# GitLab CI example
plan:
  stage: plan
  script:
    - cd live/\${ENVIRONMENT}
    - terragrunt run --all --out-dir tfplans -- plan
  artifacts:
    paths:
      - live/\${ENVIRONMENT}/**/tfplan
      - live/\${ENVIRONMENT}/**/plan.json
    expire_in: 1 day

apply:
  stage: apply
  needs: [plan]
  when: manual
  script:
    - cd live/\${ENVIRONMENT}
    - terragrunt run --all --out-dir tfplans -- apply`
    ],
    antipatterns: [
      'Running plan and apply in the same job',
      'Not storing plan artifacts',
      'Applying without the saved plan file'
    ],
    tradeoffs: [
      'More complex pipeline configuration',
      'Plan files can become stale if not applied promptly'
    ],
    relatedDocs: []
  },

  // ============ SECURITY ============
  {
    id: 'sc-001',
    practice: 'Never commit sensitive values to version control',
    rationale: 'Credentials, passwords, and API keys in version control are a major security risk. They persist in git history even after deletion and can be easily exposed.',
    category: 'security',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# Use environment variables
locals {
  db_password = get_env("DB_PASSWORD")
}

# Use secret managers
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/database/password"
}`,
      `# .gitignore
*.tfvars
*secret*
.env
.env.*`
    ],
    antipatterns: [
      'Hardcoding passwords in terragrunt.hcl',
      'Committing .env files with real values',
      'Using default values for secrets'
    ],
    tradeoffs: [
      'Requires external secret management setup',
      'Local development needs secret access configured'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/built-in-functions/#get_env']
  },
  {
    id: 'sc-002',
    practice: 'Enable encryption for remote state storage',
    rationale: 'State files can contain sensitive data like passwords and private keys. Server-side encryption protects data at rest.',
    category: 'security',
    priority: 'critical',
    experienceLevel: 'beginner',
    examples: [
      `# S3 backend with encryption
remote_state {
  backend = "s3"
  config = {
    bucket  = "terraform-state"
    key     = "\${path_relative_to_include()}/terraform.tfstate"
    encrypt = true  # Server-side encryption
    
    # Optional: Use KMS key for additional control
    kms_key_id = "arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789"
  }
}`
    ],
    antipatterns: [
      'Unencrypted state files',
      'Public S3 buckets for state',
      'State buckets without access logging'
    ],
    tradeoffs: [
      'KMS encryption adds cost and complexity',
      'Must manage KMS key access permissions'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/']
  },

  // ============ PERFORMANCE ============
  {
    id: 'pf-001',
    practice: 'Use the Terragrunt cache to speed up repeated operations',
    rationale: 'Terragrunt caches downloaded modules and providers. Preserving this cache between CI runs significantly speeds up operations.',
    category: 'performance',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# GitHub Actions cache example
- name: Cache Terragrunt
  uses: actions/cache@v3
  with:
    path: |
      ~/.terragrunt-cache
      ~/.terraform.d/plugin-cache
    key: \${{ runner.os }}-terragrunt-\${{ hashFiles('**/*.hcl') }}`,
      `# Configure provider caching
# ~/.terraformrc or terraform.rc
plugin_cache_dir = "$HOME/.terraform.d/plugin-cache"`
    ],
    antipatterns: [
      'Downloading providers on every CI run',
      'Not caching Terragrunt module downloads',
      'Clearing caches unnecessarily'
    ],
    tradeoffs: [
      'Cache management complexity',
      'Stale caches can cause issues'
    ],
    relatedDocs: []
  },
  {
    id: 'pf-002',
    practice: 'Use run --all with appropriate parallelism based on provider rate limits',
    rationale: 'Too much parallelism can hit API rate limits; too little wastes time. Tune based on your cloud provider and module count.',
    category: 'performance',
    priority: 'recommended',
    experienceLevel: 'advanced',
    examples: [
      `# AWS: Generally safe with 5-10 parallel operations
terragrunt run --all --parallelism 5 -- apply

# For many small modules, can go higher
terragrunt run --all --parallelism 20 -- plan

# For rate-limited APIs or large state files, go lower
terragrunt run --all --parallelism 2 -- apply`
    ],
    antipatterns: [
      'Unlimited parallelism causing rate limit errors',
      'Serial execution (parallelism=1) for independent modules',
      'Not adjusting parallelism for different operations'
    ],
    tradeoffs: [
      'Higher parallelism = faster but riskier',
      'May need to tune based on time of day/load'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/features/execute-terraform-commands-on-multiple-modules-at-once/']
  },

  // ============ TESTING ============
  {
    id: 'ts-001',
    practice: 'Validate Terragrunt configurations before apply using hooks',
    rationale: 'Before hooks can run validation scripts, linters, and policy checks before any Terraform operation, catching errors early.',
    category: 'testing',
    priority: 'recommended',
    experienceLevel: 'intermediate',
    examples: [
      `# Root terragrunt.hcl
terraform {
  before_hook "validate" {
    commands = ["apply", "plan"]
    execute  = ["tflint", "--config=.tflint.hcl"]
  }
  
  before_hook "security_scan" {
    commands = ["apply"]
    execute  = ["tfsec", "."]
  }
}`,
      `# Validate HCL syntax
terraform {
  before_hook "hcl_validate" {
    commands = ["apply", "plan"]
    execute  = ["terragrunt", "hcl", "fmt", "--check"]
  }
}`
    ],
    antipatterns: [
      'Applying without any validation',
      'Skipping validation in CI to save time',
      'Not using policy-as-code tools'
    ],
    tradeoffs: [
      'Adds time to each operation',
      'Must maintain validation tooling and configs'
    ],
    relatedDocs: ['https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform']
  },
  {
    id: 'ts-002',
    practice: 'Use terragrunt hcl validate --inputs to catch input errors early',
    rationale: 'The hcl validate --inputs command checks that configured inputs align with variables defined by OpenTofu or Terraform, catching configuration errors before plan/apply.',
    category: 'testing',
    priority: 'recommended',
    experienceLevel: 'beginner',
    examples: [
      `# Validate inputs for a single module
terragrunt hcl validate --inputs

# Validate recursively with strict input checks
terragrunt hcl validate --inputs --strict`,
      `# In CI pipeline
- name: Validate Inputs
  run: |
    cd live/prod
    terragrunt hcl validate --inputs --strict`
    ],
    antipatterns: [
      'Discovering missing inputs during apply',
      'Not validating in CI before merge',
      'Ignoring validation errors'
    ],
    tradeoffs: [
      'Adds step to workflow',
      'Requires accurate variable definitions in modules'
    ],
    relatedDocs: ['https://docs.terragrunt.com/reference/cli/commands/hcl/validate/']
  }
];

/**
 * Pre-computed Set of static practice IDs for O(1) lookup
 */
const STATIC_PRACTICE_IDS = new Set(
  STATIC_BEST_PRACTICES.map(p => p.id)
);

/**
 * Represents a best practice extracted from Terragrunt documentation
 */
export interface BestPractice {
  practice: string;           // The best practice recommendation
  rationale: string;          // Why this is recommended
  example: string;            // Code example demonstrating it
  antipatterns: string[];     // What to avoid
  tradeoffs: string[];        // Tradeoffs to consider
  relatedDocs: string[];      // URLs to related documentation
}

/**
 * Priority level for a practice recommendation
 */
export type PracticePriority = 'critical' | 'recommended' | 'optional';

/**
 * Experience level for a practice recommendation
 */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A structured recommendation for a specific practice
 */
export interface PracticeRecommendation {
  practice: string;
  priority: PracticePriority;
  experienceLevel: ExperienceLevel;
  category: string;           // Topic/category it belongs to
  rationale: string;
  examples: string[];
  antipatterns: string[];
  tradeoffs: string[];
  relatedDocs: string[];
}

/**
 * Experience-specific notes grouped by level
 */
export interface ExperienceNotes {
  beginner: string[];
  intermediate: string[];
  advanced: string[];
}

/**
 * Result of analyzing best practices for a topic
 */
export interface BestPracticeResult {
  query: string;
  recommendations: PracticeRecommendation[];
  summary: string;
  commonPitfalls: string[];
  experienceNotes: ExperienceNotes;
  realWorldExamples: string[];
  confidence: number;            // Confidence score 0-100 based on data quality
  suggestedTopics?: string[];    // Similar topics (only for unknown topics)
}

/**
 * Internal interface for scoring and ranking practices
 * Extends BestPractice with metadata for ranking algorithm
 */
interface ScoredPractice extends BestPractice {
  score: number;           // Calculated ranking score
  frequency: number;       // How many similar practices found
  sourceSection: string;   // Documentation section (for priority)
  exampleCount: number;    // Number of code examples
  keywords: string[];      // Cached extracted keywords for performance
}

/**
 * Manages extraction and analysis of best practices from Terragrunt documentation.
 * 
 * This class extracts best practices, antipatterns, and recommendations from
 * documentation content using pattern matching and heuristics. It supports
 * categorization by experience level and topic-based filtering.
 * 
 * Supported topics:
 * - module_organization: How to structure modules
 * - state_management: Remote state best practices
 * - dependencies: Managing dependencies between modules
 * - ci_cd: CI/CD integration patterns
 * - security: Security considerations
 * - performance: Performance optimization
 * - testing: Testing strategies
 */
export class BestPracticesAnalyzer {
  private readonly docsManager: TerragruntDocsManager;
  private readonly practicesCache: LRUCache<string, BestPractice[]>;
  private readonly resultsCache: LRUCache<string, BestPracticeResult>;
  private practicesLoaded: boolean = false;

  /**
   * Supported topics for best practices analysis
   */
  private readonly supportedTopics: string[] = [
    'module_organization',
    'project_structure',
    'environment_config',
    'state_management',
    'dependencies',
    'ci_cd',
    'security',
    'performance',
    'testing'
  ];

  /**
   * Configuration constants for confidence scoring algorithm
   */
  
  /** Maximum number of practices needed to achieve full data availability score (30 points) */
  private readonly MAX_PRACTICES_FOR_FULL_SCORE = 20;
  
  /** Minimum character length for an example to be considered meaningful */
  private readonly MIN_EXAMPLE_LENGTH = 20;
  
  /** Minimum character length for a rationale to be considered meaningful */
  private readonly MIN_RATIONALE_LENGTH = 50;

  /**
   * Configuration constants for fuzzy topic matching algorithm
   */
  
  /** Maximum edit distance (Levenshtein) to consider a topic as a likely typo */
  private readonly MAX_EDIT_DISTANCE_FOR_TYPO = 3;
  
  /** Penalty coefficient applied per edit distance unit (1.0 - distance * penalty) */
  private readonly EDIT_DISTANCE_PENALTY = 0.3;
  
  /** Minimum similarity score (0-1) required to suggest a topic */
  private readonly MIN_SIMILARITY_THRESHOLD = 0.3;

  /**
   * Regex patterns for extracting best practices from documentation
   */
  private readonly bestPracticePatterns = [
    /(?:should|recommended|best practice|prefer|always|must)\s+([^.!?]+[.!?])/gi,
    /it\s+is\s+(?:recommended|preferred)\s+(?:to\s+)?([^.!?]+[.!?])/gi,
    /(?:we|you)\s+(?:should|must|recommend)\s+([^.!?]+[.!?])/gi
  ];

  /**
   * Regex patterns for identifying antipatterns and warnings
   */
  private readonly antipatternPatterns = [
    /(?:avoid|don't|do not)\s+([^.!?]+[.!?])/gi,
    /(?:deprecated|not recommended|discouraged)[:\s]+([^.!?]+[.!?])/gi,
    /(?:warning|caution|note)[:\s]+([^.!?]+[.!?])/gi,
    /(?:never|shouldn't|should not)\s+([^.!?]+[.!?])/gi
  ];

  /**
   * Regex patterns for extracting tradeoffs and considerations
   */
  private readonly tradeoffPatterns = [
    /(?:tradeoff|trade-off)[:\s]+([^.!?]+[.!?])/gi,
    // Only match "consider" when followed by context suggesting weighing options
    /consider\s+(?:whether|if|the)\s+([^.!?]+[.!?])/gi,
    // Only match "however", "but", "although" when sentence contains tradeoff context
    /(?:however|but|although)[^.!?]*?\b(?:cost|performance|vs\.?|instead|downside|upside|benefit|drawback|advantage|disadvantage)\b[^.!?]*?[.!?]/gi,
    /(?:alternative|alternatively)[:\s]+([^.!?]+[.!?])/gi
  ];

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
    
    // Initialize LRU caches with size limits to prevent unbounded memory growth
    this.practicesCache = new LRUCache<string, BestPractice[]>({
      max: 100, // Maximum 100 topics/subtopics
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });

    this.resultsCache = new LRUCache<string, BestPracticeResult>({
      max: 200, // Maximum 200 cached results (topics × experience levels)
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });
  }

  /**
   * Normalize a key for case-insensitive cache lookups
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase().trim();
  }

  /**
   * Returns all static best practice definitions.
   * These are curated, authoritative recommendations always available.
   * @returns Array of all static best practice definitions
   */
  getStaticPractices(): StaticBestPractice[] {
    return [...STATIC_BEST_PRACTICES];
  }

  /**
   * Returns static best practices filtered by category.
   * @param category The category to filter by
   * @returns Array of static practices for the given category
   */
  getStaticPracticesByCategory(category: string): StaticBestPractice[] {
    const normalizedCategory = this.normalizeKey(category);
    return STATIC_BEST_PRACTICES.filter(
      p => this.normalizeKey(p.category) === normalizedCategory
    );
  }

  /**
   * Check if a practice ID is defined in the static best practices list.
   * Uses pre-computed Set for O(1) lookup performance.
   * @param id The practice ID to check
   * @returns true if the practice is in the static definitions
   */
  isStaticPractice(id: string): boolean {
    if (!id || !id.trim()) {
      return false;
    }
    return STATIC_PRACTICE_IDS.has(id);
  }

  /**
   * Convert a static practice to a PracticeRecommendation.
   * @param staticPractice The static practice to convert
   * @returns A PracticeRecommendation
   */
  private convertStaticToPracticeRecommendation(
    staticPractice: StaticBestPractice
  ): PracticeRecommendation {
    return {
      practice: staticPractice.practice,
      priority: staticPractice.priority,
      experienceLevel: staticPractice.experienceLevel,
      category: staticPractice.category,
      rationale: staticPractice.rationale,
      examples: staticPractice.examples,
      antipatterns: staticPractice.antipatterns,
      tradeoffs: staticPractice.tradeoffs,
      relatedDocs: staticPractice.relatedDocs
    };
  }

  /**
   * Common stopwords to filter out during keyword extraction
   */
  private readonly stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'you', 'your', 'this', 'should',
    'must', 'can', 'may', 'use', 'using', 'uses', 'used'
  ]);

  /**
   * Extract meaningful keywords from text for similarity comparison
   * Filters out stopwords and short words
   */
  private extractKeywords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopwords.has(word));
    
    return new Set(words);
  }

  /**
   * Calculate Jaccard similarity between two texts based on keyword overlap
   * Returns a value between 0 (no similarity) and 1 (identical)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);
    return this.calculateJaccardSimilarity(keywords1, keywords2);
  }

  /**
   * Calculate Jaccard similarity between two pre-extracted keyword sets.
   * Optimized version that avoids repeated keyword extraction.
   * @param keywords1 Pre-extracted keyword set from first text
   * @param keywords2 Pre-extracted keyword set from second text
   * @returns Similarity score between 0 and 1
   */
  private calculateJaccardSimilarity(keywords1: Set<string>, keywords2: Set<string>): number {
    if (keywords1.size === 0 || keywords2.size === 0) {
      return 0;
    }

    // Calculate intersection
    const intersection = new Set(
      [...keywords1].filter(word => keywords2.has(word))
    );

    // Calculate union
    const union = new Set([...keywords1, ...keywords2]);

    // Jaccard similarity = intersection / union
    return intersection.size / union.size;
  }

  /**
   * Calculate frequency of similar practices across all practices
   * Updates the frequency field of each practice
   * Optimized to compare each unique pair only once (n(n-1)/2 comparisons)
   */
  private calculateFrequency(practices: ScoredPractice[]): void {
    const similarityThreshold = 0.6; // Practices with >60% similarity are considered the same

    // Initialize all frequencies to 1 (the practice itself)
    for (let i = 0; i < practices.length; i++) {
      practices[i].frequency = 1;
    }

    // Only compare each unique pair once
    for (let i = 0; i < practices.length; i++) {
      for (let j = i + 1; j < practices.length; j++) {
        const similarity = this.calculateSimilarity(
          practices[i].practice,
          practices[j].practice
        );

        if (similarity >= similarityThreshold) {
          practices[i].frequency++;
          practices[j].frequency++;
        }
      }
    }
  }

  /**
   * Score a practice based on multiple factors
   * Returns a score from 0 to ~215 (base 100 + bonuses)
   */
  private scorePractice(practice: ScoredPractice, topic: string): number {
    let score = 100; // Base score

    // Frequency bonus: +10 per occurrence, max +30
    const frequencyBonus = Math.min((practice.frequency - 1) * 10, 30);
    score += frequencyBonus;

    // Section priority bonus
    const officialSections = ['getting-started', 'features', 'reference', 'quick-start'];
    const guideSections = ['guides', 'how-to'];
    
    if (officialSections.includes(practice.sourceSection)) {
      score += 20;
    } else if (guideSections.includes(practice.sourceSection)) {
      score += 10;
    }

    // Example bonus: +15 for having examples, +5 per additional (max +25 total)
    if (practice.exampleCount > 0) {
      score += 15;
      score += Math.min((practice.exampleCount - 1) * 5, 10);
    }

    // Keyword relevance: match topic keywords
    const topicKeywords = this.getTopicKeywords(topic).map(kw => kw.toLowerCase());
    
    // Use cached keywords (already computed and stored in practice.keywords)
    // Efficient substring matching: avoid repeated Set conversions and lowercasing
    const matchCount = topicKeywords.filter(kw =>
      practice.keywords.some(pk => pk.includes(kw) || kw.includes(pk))
    ).length;
    
    const relevanceBonus = Math.min(matchCount * 4, 20); // +4 per keyword match, max +20
    score += relevanceBonus;

    // Metadata bonuses
    if (practice.rationale && practice.rationale.length > 20) {
      score += 10; // Has meaningful rationale
    }
    if (practice.antipatterns && practice.antipatterns.length > 0) {
      score += 5; // Has antipatterns
    }
    if (practice.tradeoffs && practice.tradeoffs.length > 0) {
      score += 5; // Has tradeoffs
    }

    return score;
  }

  /**
   * Rank practices by calculating scores and sorting
   * Returns a new sorted array without mutating the input
   */
  private rankPractices(practices: ScoredPractice[], topic: string): ScoredPractice[] {
    // Work on a new array of shallow-copied objects to avoid mutating the input
    const practicesCopy: ScoredPractice[] = practices.map(practice => ({ ...practice }));

    // Calculate frequency across all practices (on the copy)
    this.calculateFrequency(practicesCopy);

    // Score each practice (on the copy)
    for (const practice of practicesCopy) {
      practice.score = this.scorePractice(practice, topic);
    }

    // Sort by score descending and return the new array
    return practicesCopy.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate confidence score (0-100) based on data quality and completeness
   * 
   * Scoring factors:
   * - Data availability: 0-30 points (more practices = higher confidence)
   * - Example quality: 0-20 points (practices with code examples)
   * - Rationale completeness: 0-20 points (meaningful rationale text)
   * - Antipattern coverage: 0-15 points (identifies what to avoid)
   * - Tradeoff analysis: 0-15 points (explains pros/cons)
   * 
   * @param practices - Array of best practices
   * @param recommendations - Array of recommendations (for additional validation)
   * @returns Confidence score 0-100
   */
  private calculateConfidence(
    practices: BestPractice[],
    _recommendations: PracticeRecommendation[]
  ): number {
    if (practices.length === 0) {
      return 0;
    }

    let score = 0;

    // 1. Data availability (0-30 points): more practices = higher confidence
    const dataScore = Math.min((practices.length / this.MAX_PRACTICES_FOR_FULL_SCORE) * 30, 30);
    score += dataScore;

    // 2. Example quality (0-20 points): practices with code examples
    const withExamples = practices.filter(p => p.example && p.example.length > this.MIN_EXAMPLE_LENGTH).length;
    const exampleScore = (withExamples / practices.length) * 20;
    score += exampleScore;

    // 3. Rationale completeness (0-20 points): meaningful rationale
    const withRationale = practices.filter(p => p.rationale && p.rationale.length > this.MIN_RATIONALE_LENGTH).length;
    const rationaleScore = (withRationale / practices.length) * 20;
    score += rationaleScore;

    // 4. Antipattern coverage (0-15 points): identifies what to avoid
    const withAntipatterns = practices.filter(p => p.antipatterns && p.antipatterns.length > 0).length;
    const antipatternScore = (withAntipatterns / practices.length) * 15;
    score += antipatternScore;

    // 5. Tradeoff analysis (0-15 points): explains pros/cons
    const withTradeoffs = practices.filter(p => p.tradeoffs && p.tradeoffs.length > 0).length;
    const tradeoffScore = (withTradeoffs / practices.length) * 15;
    score += tradeoffScore;

    return Math.round(score);
  }

  /**
   * Calculate Levenshtein edit distance between two strings
   * Used for typo detection in topic matching
   * 
   * @param s1 - First string
   * @param s2 - Second string
   * @returns Edit distance (number of edits needed to transform s1 into s2)
   */
  private calculateEditDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;

    // Create 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize base cases
    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }

    // Fill the dp table
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return dp[len1][len2];
  }

  /**
   * Find similar topics using fuzzy matching
   * Combines typo detection (edit distance) and semantic matching (keyword overlap)
   * 
   * @param query - User's topic query
   * @returns Array of similar topic names (top 3 with similarity > MIN_SIMILARITY_THRESHOLD)
   */
  private findSimilarTopics(query: string): string[] {
    const normalizedQuery = this.normalizeKey(query);
    const similarTopics: Array<{ topic: string; score: number }> = [];

    for (const topic of this.supportedTopics) {
      const normalizedTopic = this.normalizeKey(topic);
      let similarityScore = 0;

      // 1. Check edit distance for typo detection (< MAX_EDIT_DISTANCE_FOR_TYPO edits = likely typo)
      const editDistance = this.calculateEditDistance(normalizedQuery, normalizedTopic);
      if (editDistance < this.MAX_EDIT_DISTANCE_FOR_TYPO) {
        // High similarity for close typos: distance 0 = 1.0, distance 1 = 0.7, distance 2 = 0.4
        similarityScore = Math.max(1.0 - (editDistance * this.EDIT_DISTANCE_PENALTY), 0);
      }

      // 2. Semantic matching using keyword overlap
      const queryKeywords = this.extractKeywords(query);
      const topicKeywords = this.getTopicKeywords(topic);
      
      // Convert topic keywords to normalized set for comparison
      const topicKeywordSet = new Set(
        topicKeywords.map(kw => kw.toLowerCase()).flatMap(kw => 
          Array.from(this.extractKeywords(kw))
        )
      );

      if (queryKeywords.size > 0 && topicKeywordSet.size > 0) {
        // Calculate Jaccard similarity
        const intersection = [...queryKeywords].filter(kw => topicKeywordSet.has(kw)).length;
        const union = new Set([...queryKeywords, ...topicKeywordSet]).size;
        const keywordSimilarity = union > 0 ? intersection / union : 0;
        
        // Use higher of edit distance or keyword similarity
        similarityScore = Math.max(similarityScore, keywordSimilarity);
      }

      if (similarityScore > this.MIN_SIMILARITY_THRESHOLD) {
        similarTopics.push({ topic, score: similarityScore });
      }
    }

    // Sort by score descending and return top 3
    return similarTopics
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(t => t.topic);
  }

  /**
   * Map topics to their relevant search keywords
   */
  private getTopicKeywords(topic: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'module_organization': [
        'module',
        'structure',
        'organization',
        'layout',
        'hierarchy',
        'folder structure',
        'directory structure'
      ],
      'state_management': [
        'remote state',
        'backend',
        'state',
        'locking',
        's3',
        'azure storage',
        'gcs',
        'state file'
      ],
      'dependencies': [
        'dependency',
        'dependencies',
        'depends_on',
        'mock_outputs',
        'dependency block',
        'inter-module'
      ],
      'ci_cd': [
        'ci/cd',
        'ci cd',
        'pipeline',
        'automation',
        'github actions',
        'gitlab ci',
        'jenkins',
        'continuous integration',
        'continuous deployment'
      ],
      'security': [
        'security',
        'credentials',
        'secrets',
        'encryption',
        'authentication',
        'authorization',
        'iam',
        'permissions',
        'sensitive'
      ],
      'performance': [
        'performance',
        'caching',
        'speed',
        'optimization',
        'optimize',
        'fast',
        'slow',
        'parallel',
        'concurrency'
      ],
      'testing': [
        'test',
        'testing',
        'validation',
        'validate',
        'terratest',
        'unit test',
        'integration test',
        'verify'
      ],
      'project_structure': [
        'project structure',
        'directory structure',
        'folder structure',
        'live',
        'modules',
        'root terragrunt',
        'include',
        '_envcommon',
        'hierarchy',
        'layout',
        'organization',
        'terragrunt.hcl'
      ],
      'environment_config': [
        'environment',
        'env',
        'dev',
        'staging',
        'prod',
        'production',
        'get_env',
        'locals',
        'inputs',
        'override',
        'inheritance',
        'merge',
        'deep_merge',
        'shallow_merge'
      ]
    };

    const normalizedTopic = this.normalizeKey(topic);
    return keywordMap[normalizedTopic] || [];
  }

  /**
   * Search for documentation that matches the given topic
   */
  private async searchForPatterns(topic: string): Promise<TerragruntDoc[]> {
    const keywords = this.getTopicKeywords(topic);
    if (keywords.length === 0) {
      return [];
    }

    const allDocs = await this.docsManager.fetchLatestDocs();
    const contentLower = (doc: TerragruntDoc) => doc.content.toLowerCase();

    // Filter docs that contain at least one keyword
    return allDocs.filter(doc => {
      const content = contentLower(doc);
      return keywords.some(keyword => content.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Identify antipatterns from documentation content
   */
  private identifyAntipatterns(docs: TerragruntDoc[]): string[] {
    const antipatterns = new Set<string>();

    for (const doc of docs) {
      for (const pattern of this.antipatternPatterns) {
        // Reset regex lastIndex for global flag
        pattern.lastIndex = 0;
        
        const matches = [...doc.content.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const antipattern = match[1].trim();
            if (antipattern.length > 10) { // Filter out very short matches
              antipatterns.add(antipattern);
            }
          }
        }
      }
    }

    return Array.from(antipatterns);
  }

  /**
   * Extract code examples from documentation content
   */
  private extractExamples(content: string): string[] {
    const examples: string[] = [];
    
    // Extract code blocks with triple backticks
    const codeBlockPattern = /```(?:hcl|terraform|bash)?\s*\n([\s\S]*?)\n```/g;
    const codeBlocks = [...content.matchAll(codeBlockPattern)];
    
    for (const match of codeBlocks) {
      if (match[1] && match[1].trim().length > 0) {
        examples.push(match[1].trim());
      }
    }

    // Look for Example: or Usage: sections
    const exampleSectionPattern = /(?:Example|Usage):\s*\n((?:```[\s\S]*?```|(?:(?!#+).)+)+)/gi;
    const exampleSections = [...content.matchAll(exampleSectionPattern)];
    
    for (const match of exampleSections) {
      if (match[1] && match[1].trim().length > 0) {
        // Extract code from the section if it contains code blocks
        const sectionCodeBlocks = [...match[1].matchAll(codeBlockPattern)];
        for (const codeMatch of sectionCodeBlocks) {
          if (codeMatch[1] && !examples.includes(codeMatch[1].trim())) {
            examples.push(codeMatch[1].trim());
          }
        }
      }
    }

    // Limit to reasonable number of examples
    return examples.slice(0, 5);
  }

  /**
   * Extract the rationale for why a practice is recommended
   */
  private extractRationale(content: string, practice: string): string {
    // Find the practice in the content and extract surrounding context
    const practiceIndex = content.toLowerCase().indexOf(practice.toLowerCase());
    if (practiceIndex === -1) {
      return '';
    }

    // Extract context window (200 chars before, 300 chars after)
    const start = Math.max(0, practiceIndex - 200);
    const end = Math.min(content.length, practiceIndex + practice.length + 300);
    const context = content.substring(start, end);

    // Look for sentences that explain "why" or provide rationale
    const rationalePatterns = [
      /(?:because|since|as|this allows|this ensures|this helps|this prevents)\s+([^.!?]+[.!?])/gi,
      /(?:reason|benefit|advantage)[:\s]+([^.!?]+[.!?])/gi
    ];

    for (const pattern of rationalePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(context);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no explicit rationale found, return a snippet of the context
    const sentences = context.match(/[^.!?]+[.!?]/g) || [];
    return sentences.slice(0, 2).join(' ').trim();
  }

  /**
   * Extract tradeoffs and considerations from documentation content
   */
  private extractTradeoffs(content: string): string[] {
    const tradeoffs = new Set<string>();

    for (const pattern of this.tradeoffPatterns) {
      pattern.lastIndex = 0;
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        // Handle both capture group patterns and full match patterns
        const tradeoff = (match[1] || match[0]).trim();
        if (tradeoff.length > 15) { // Filter out very short matches
          tradeoffs.add(tradeoff);
        }
      }
    }

    return Array.from(tradeoffs).slice(0, 5); // Limit to top 5 tradeoffs
  }

  /**
   * Categorize a practice by experience level based on heuristics
   */
  private categorizeByExperience(practice: BestPractice, doc: TerragruntDoc): ExperienceLevel {
    // Prioritize practice-specific content over whole doc
    const practiceContent = (practice.practice + ' ' + practice.rationale).toLowerCase();
    const docContent = doc.content.toLowerCase();
    
    // Check doc section first for beginner content
    if (doc.section === 'getting-started' || doc.section === 'quick-start') {
      return 'beginner';
    }
    
    // Check practice-specific keywords first (more accurate)
    const beginnerKeywords = ['basic', 'simple', 'getting started', 'introduction', 'first', 'start', 'should use', 'beginners', 'for beginners'];
    if (beginnerKeywords.some(kw => practiceContent.includes(kw))) {
      return 'beginner';
    }
    
    // Check for advanced keywords in practice content
    const advancedKeywords = ['advanced', 'complex', 'optimize', 'performance', 'scale', 'enterprise', 'must write', 'critical', 'dependency graph', 'for advanced', 'advanced scenarios', 'advanced users'];
    if (advancedKeywords.some(kw => practiceContent.includes(kw))) {
      return 'advanced';
    }
    
    // Check broader doc content for advanced signals
    if (advancedKeywords.some(kw => docContent.includes(kw))) {
      return 'advanced';
    }
    
    // Check topic-based categorization
    const advancedTopics = ['testing', 'ci_cd', 'performance'];
    const intermediateTopics = ['module_organization', 'dependencies', 'state'];
    
    // Try to infer topic from content
    for (const topic of advancedTopics) {
      const keywords = this.getTopicKeywords(topic);
      if (keywords.some(kw => practiceContent.includes(kw.toLowerCase()) || docContent.includes(kw.toLowerCase()))) {
        return 'advanced';
      }
    }
    
    for (const topic of intermediateTopics) {
      const keywords = this.getTopicKeywords(topic);
      if (keywords.some(kw => practiceContent.includes(kw.toLowerCase()) || docContent.includes(kw.toLowerCase()))) {
        return 'intermediate';
      }
    }
    
    // Check if practice is from features section (usually intermediate)
    if (doc.section === 'features') {
      return 'intermediate';
    }
    
    // Default to intermediate
    return 'intermediate';
  }

  /**
   * Extract best practices from a set of documentation
   */
  private extractPracticesFromDocs(docs: TerragruntDoc[], _topic: string): ScoredPractice[] {
    const practices: ScoredPractice[] = [];
    const seenPractices = new Set<string>();

    for (const doc of docs) {
      for (const pattern of this.bestPracticePatterns) {
        pattern.lastIndex = 0;
        const matches = [...doc.content.matchAll(pattern)];

        for (const match of matches) {
          if (match[1]) {
            const practiceText = match[1].trim();
            
            // Skip if too short or already seen
            if (practiceText.length < 20 || seenPractices.has(practiceText.toLowerCase())) {
              continue;
            }

            seenPractices.add(practiceText.toLowerCase());

            // Extract surrounding context for better categorization (100 chars before match)
            const matchIndex = match.index || 0;
            const contextStart = Math.max(0, matchIndex - 100);
            const fullContext = doc.content.substring(contextStart, matchIndex + match[0].length).trim();
            
            const extractedRationale = this.extractRationale(doc.content, practiceText);
            // Prepend context to rationale for better categorization
            const rationale = fullContext + (extractedRationale ? ' ' + extractedRationale : '');

            const examples = this.extractExamples(doc.content);

            // Extract and cache keywords for performance (avoid repeated extraction during scoring)
            const keywords = Array.from(
              this.extractKeywords(practiceText + ' ' + rationale)
            );

            const practice: ScoredPractice = {
              practice: practiceText,
              rationale,
              example: examples[0] || '',
              antipatterns: this.identifyAntipatterns([doc]),
              tradeoffs: this.extractTradeoffs(doc.content),
              relatedDocs: [doc.url],
              // Scoring metadata
              score: 0,
              frequency: 1,
              sourceSection: doc.section || 'other',
              exampleCount: examples.length,
              keywords
            };

            practices.push(practice);
          }
        }
      }
    }

    return practices; // Don't slice yet - ranking will handle limiting
  }

  /**
   * Load and extract all best practices from documentation
   */
  async extractBestPractices(): Promise<void> {
    try {
      // Fetch all documentation
      await this.docsManager.fetchLatestDocs();

      // Clear existing cache
      this.practicesCache.clear();

      // Extract practices for each supported topic
      for (const topic of this.supportedTopics) {
        const relevantDocs = await this.searchForPatterns(topic);
        const scoredPractices = this.extractPracticesFromDocs(relevantDocs, topic);
        
        // Rank practices by score
        const rankedPractices = this.rankPractices(scoredPractices, topic);
        
        // Limit to top 20 after ranking
        const topPractices = rankedPractices.slice(0, 20);
        
        // Strip scoring metadata before caching (convert to BestPractice[])
        const practices: BestPractice[] = topPractices.map(sp => ({
          practice: sp.practice,
          rationale: sp.rationale,
          example: sp.example,
          antipatterns: sp.antipatterns,
          tradeoffs: sp.tradeoffs,
          relatedDocs: sp.relatedDocs
        }));
        
        this.practicesCache.set(this.normalizeKey(topic), practices);
      }

      this.practicesLoaded = true;
    } catch (error) {
      console.error('Failed to extract best practices from docs:', error);
      // Still mark as loaded - we have static practices available
      // This prevents repeated extraction attempts
      this.practicesLoaded = true;
    }
  }

  /**
   * Convert a BestPractice to a PracticeRecommendation with additional metadata
   */
  private convertToPracticeRecommendation(
    practice: BestPractice,
    doc: TerragruntDoc,
    topic: string
  ): PracticeRecommendation {
    // Determine priority based on keywords
    const practiceText = practice.practice.toLowerCase();
    let priority: PracticePriority = 'recommended';

    if (practiceText.includes('must') || practiceText.includes('critical') || practiceText.includes('always')) {
      priority = 'critical';
    } else if (practiceText.includes('consider') || practiceText.includes('optional') || practiceText.includes('can')) {
      priority = 'optional';
    }

    // Get experience level
    const experienceLevel = this.categorizeByExperience(practice, doc);

    return {
      practice: practice.practice,
      priority,
      experienceLevel,
      category: topic,
      rationale: practice.rationale,
      examples: practice.example ? [practice.example] : [],
      antipatterns: practice.antipatterns,
      tradeoffs: practice.tradeoffs,
      relatedDocs: practice.relatedDocs
    };
  }

  /**
   * Analyze best practices for a specific topic with confidence scoring and fuzzy matching
   * 
   * @param topic - The topic to analyze (e.g., 'state_management', 'dependencies')
   * @param level - Optional experience level filter
   * @returns Best practice analysis results with confidence score and suggestions
   * 
   * **Confidence Scoring**: Returns a 0-100 confidence score based on:
   * - Data availability (30 points): Number of practices extracted
   * - Example quality (20 points): Presence of code examples
   * - Rationale completeness (20 points): Presence of explanations
   * - Antipattern coverage (15 points): Common pitfalls identified
   * - Tradeoff analysis (15 points): Benefits/limitations discussed
   * 
   * Typical confidence scores:
   * - High (80-100): Well-documented topics with many examples and comprehensive coverage
   * - Medium (60-79): Good documentation with some examples and explanations
   * - Low (40-59): Basic documentation with limited examples or rationale
   * - Very Low (0-39): Sparse documentation or unknown topics
   * 
   * **Fuzzy Topic Matching**: For unknown topics, suggests similar topics using:
   * - Edit distance (Levenshtein) < 3 for typo detection ('state_managment' → 'state_management')
   * - Keyword similarity > 0.3 for semantic matching ('remote state' → 'state_management')
   * - Returns top 3 suggestions in BestPracticeResult.suggestedTopics
   */
  async analyzeTopic(
    topic: string,
    level?: 'beginner' | 'intermediate' | 'advanced',
    includeExamples: boolean = true
  ): Promise<BestPracticeResult> {
    try {
      // Ensure practices are loaded
      if (!this.practicesLoaded) {
        await this.extractBestPractices();
      }

      // Check cache - include includeExamples in cache key
      const cacheKey = `${this.normalizeKey(topic)}:${level || 'all'}:${includeExamples ? 'ex' : 'no-ex'}`;
      const cached = this.resultsCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Step 1: Get static practices for this topic (always available, authoritative)
      // Filter by experience level early to avoid unnecessary conversion and deduplication work
      let staticPractices = this.getStaticPracticesByCategory(topic);
      if (level) {
        staticPractices = staticPractices.filter(sp => sp.experienceLevel === level);
      }
      const staticRecommendations: PracticeRecommendation[] = staticPractices.map(
        sp => this.convertStaticToPracticeRecommendation(sp)
      );

      // Step 2: Get doc-extracted practices for this topic
      let practices = this.practicesCache.get(this.normalizeKey(topic)) || [];
      // Filter doc practices by experience level early too (if level specified)
      // Note: doc practices don't have experienceLevel until converted, so we filter recommendations later

      // If no static practices and no doc practices, return empty result
      if (staticPractices.length === 0 && practices.length === 0) {
        return this.createEmptyResult(topic);
      }

      // Get relevant docs for conversion - gracefully handle failures
      let relevantDocs: TerragruntDoc[] = [];
      try {
        relevantDocs = await this.searchForPatterns(topic);
      } catch (searchError) {
        console.error(`Failed to search for patterns for ${topic}:`, searchError);
        // Continue with empty relevantDocs - static practices can still work
      }
      const docMap = new Map(relevantDocs.map(d => [d.url, d]));

      // Convert doc-extracted practices to recommendations (only if we have relevantDocs)
      let docRecommendations: PracticeRecommendation[] = [];
      if (relevantDocs.length > 0) {
        docRecommendations = practices.map(practice => {
          const doc = docMap.get(practice.relatedDocs[0]) || relevantDocs[0];
          return this.convertToPracticeRecommendation(practice, doc, topic);
        });
        // Filter doc recommendations by experience level if specified
        if (level) {
          docRecommendations = docRecommendations.filter(r => r.experienceLevel === level);
        }
      }

      // Step 3: Merge static and doc recommendations
      // Static practices come first (authoritative), then unique doc-extracted ones
      // Pre-compute keyword sets for static practices to optimize O(n*m) deduplication
      const staticKeywordSets = staticRecommendations.map(r => 
        this.extractKeywords(r.practice.toLowerCase().trim())
      );
      
      // Only add doc recommendations that are sufficiently different from static ones
      // Optimized: pre-extracted keywords avoid repeated extraction in loop
      const uniqueDocRecs = docRecommendations.filter(dr => {
        const drKeywords = this.extractKeywords(dr.practice.toLowerCase().trim());
        // Check if this is substantially similar to any static practice
        for (const staticKeywords of staticKeywordSets) {
          if (this.calculateJaccardSimilarity(drKeywords, staticKeywords) > 0.7) {
            return false; // Too similar to static, skip
          }
        }
        return true;
      });

      // Combine recommendations: static first, then unique doc-extracted
      let recommendations = [...staticRecommendations, ...uniqueDocRecs];

      // Limit total recommendations to 20 (static practices prioritized)
      recommendations = recommendations.slice(0, 20);

      // Extract common pitfalls from both sources
      const allPitfalls = [
        ...staticPractices.flatMap(sp => sp.antipatterns),
        ...practices.flatMap(p => p.antipatterns)
      ];
      const commonPitfalls = [...new Set(allPitfalls.filter(p => p.length > 15))].slice(0, 10);

      // Group experience notes
      const experienceNotes = this.groupExperienceNotes(recommendations);

      // Extract real-world examples from both sources
      const allExamples = [
        ...staticPractices.flatMap(sp => sp.examples),
        ...practices.map(p => p.example).filter(e => e && e.length > this.MIN_EXAMPLE_LENGTH)
      ];
      const realWorldExamples = [...new Set(allExamples)].slice(0, 5);

      // Calculate confidence score - higher when we have static practices
      // Use total static practices for confidence calculation (not filtered by experience)
      const totalStaticCount = this.getStaticPracticesByCategory(topic).length;
      let confidence: number;
      if (totalStaticCount > 0) {
        // Base confidence from static practices (minimum 70)
        const staticConfidence = Math.min(70 + totalStaticCount * 5, 90);
        // Bonus from doc-extracted practices (up to 10 more)
        const docBonus = Math.min(practices.length * 2, 10);
        confidence = Math.min(staticConfidence + docBonus, 100);
      } else {
        // Only doc-extracted practices - use original calculation
        confidence = this.calculateConfidence(practices, recommendations);
      }

      // Generate summary with confidence
      const summary = this.generateSummary(topic, recommendations, confidence);

      // Filter examples if not requested
      let filteredRecommendations = recommendations;
      let filteredExamples = realWorldExamples;
      if (!includeExamples) {
        filteredRecommendations = recommendations.map(rec => ({
          ...rec,
          examples: [],
          antipatterns: []
        }));
        filteredExamples = [];
      }

      const result: BestPracticeResult = {
        query: topic,
        recommendations: filteredRecommendations,
        summary,
        commonPitfalls,
        experienceNotes,
        realWorldExamples: filteredExamples,
        confidence
      };

      // Cache the result
      this.resultsCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`Failed to analyze topic ${topic}:`, error);
      return this.createEmptyResult(topic);
    }
  }

  /**
   * Create an empty result for when no practices are found
   * Includes suggestions for similar topics using fuzzy matching
   */
  private createEmptyResult(topic: string): BestPracticeResult {
    const suggestedTopics = this.findSimilarTopics(topic);
    
    let summary = `No best practices found for topic: ${topic}`;
    if (suggestedTopics.length > 0) {
      summary += `. Did you mean: ${suggestedTopics.join(', ')}?`;
    }

    return {
      query: topic,
      recommendations: [],
      summary,
      commonPitfalls: [],
      experienceNotes: {
        beginner: [],
        intermediate: [],
        advanced: []
      },
      realWorldExamples: [],
      confidence: 0,
      suggestedTopics: suggestedTopics.length > 0 ? suggestedTopics : undefined
    };
  }

  /**
   * Generate a summary of the recommendations
   * Includes confidence level for better user feedback
   */
  private generateSummary(
    topic: string,
    recommendations: PracticeRecommendation[],
    confidence: number
  ): string {
    if (recommendations.length === 0) {
      return `No recommendations available for ${topic}`;
    }

    const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
    const recommendedCount = recommendations.filter(r => r.priority === 'recommended').length;
    
    // Determine confidence level label
    let confidenceLabel = 'Low';
    if (confidence >= 80) {
      confidenceLabel = 'High';
    } else if (confidence >= 60) {
      confidenceLabel = 'Medium';
    }
    
    return `Found ${recommendations.length} best practices for ${topic} ` +
           `(${confidenceLabel} confidence): ` +
           `${criticalCount} critical, ${recommendedCount} recommended. ` +
           `Key areas: ${recommendations.slice(0, 3).map(r => r.practice.split(' ').slice(0, 5).join(' ')).join('; ')}.`;
  }

  /**
   * Extract common pitfalls from practices
   */
  private extractCommonPitfalls(practices: BestPractice[]): string[] {
    const pitfalls = new Set<string>();
    
    for (const practice of practices) {
      for (const antipattern of practice.antipatterns) {
        if (antipattern.length > 15) {
          pitfalls.add(antipattern);
        }
      }
    }

    return Array.from(pitfalls).slice(0, 10);
  }

  /**
   * Group experience notes by level
   */
  private groupExperienceNotes(recommendations: PracticeRecommendation[]): ExperienceNotes {
    const notes: ExperienceNotes = {
      beginner: [],
      intermediate: [],
      advanced: []
    };

    for (const rec of recommendations) {
      const note = `${rec.practice} - ${rec.rationale}`;
      notes[rec.experienceLevel].push(note);
    }

    // Limit each level to top 5 notes
    notes.beginner = notes.beginner.slice(0, 5);
    notes.intermediate = notes.intermediate.slice(0, 5);
    notes.advanced = notes.advanced.slice(0, 5);

    return notes;
  }

  /**
   * Extract real-world examples from practices
   */
  private extractRealWorldExamples(practices: BestPractice[]): string[] {
    const examples: string[] = [];
    
    for (const practice of practices) {
      if (practice.example && practice.example.length > this.MIN_EXAMPLE_LENGTH) {
        examples.push(practice.example);
      }
    }

    return examples.slice(0, 5);
  }
}
