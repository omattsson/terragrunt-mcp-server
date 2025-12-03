/**
 * Block Comparison Manager
 * 
 * Provides functionality to compare similar HCL blocks and offer
 * pattern guidance for common Terragrunt configuration scenarios.
 */

import {
  BlockComparison,
  BlockComparisonResult,
  PatternGuidance,
  PatternGuidanceResult,
  SearchMatch,
} from '../types/comparisons.js';

// ============================================================================
// STATIC BLOCK COMPARISONS
// ============================================================================

/**
 * Curated block comparisons for commonly confused HCL blocks
 */
const BLOCK_COMPARISONS: BlockComparison[] = [
  // ---------------------------------------------------------------------------
  // dependency vs dependencies
  // ---------------------------------------------------------------------------
  {
    id: 'dependency-vs-dependencies',
    blocks: ['dependency', 'dependencies'],
    summary: 'dependency defines a single module dependency with output access; dependencies lists modules that must run first without output access.',
    block1Details: {
      name: 'dependency',
      purpose: 'Declare a dependency on another Terragrunt module and access its outputs',
      syntax: `dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id = "mock-vpc-id"
  }
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
      keyFeatures: [
        'Access outputs from dependent module via dependency.<name>.outputs',
        'Supports mock_outputs for plan/validate without applying dependencies',
        'Each dependency block has a unique name for reference',
        'Automatically determines execution order',
        'Can skip outputs with skip_outputs = true for performance',
      ],
    },
    block2Details: {
      name: 'dependencies',
      purpose: 'Declare execution order dependencies without needing output access',
      syntax: `dependencies {
  paths = ["../vpc", "../security-group", "../iam"]
}`,
      keyFeatures: [
        'Simple list of paths that must be applied first',
        'No access to outputs from listed modules',
        'Lightweight - no state file reading required',
        'Useful for ordering when outputs are not needed',
        'Can combine with dependency blocks',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Output Access',
        block1: 'Full access to dependent module outputs',
        block2: 'No output access - ordering only',
      },
      {
        aspect: 'Syntax',
        block1: 'Named block with config_path attribute',
        block2: 'Single block with paths list',
      },
      {
        aspect: 'Performance',
        block1: 'Reads state file to get outputs (slower)',
        block2: 'No state reading required (faster)',
      },
      {
        aspect: 'Mock Support',
        block1: 'Supports mock_outputs for planning',
        block2: 'Not applicable - no outputs to mock',
      },
      {
        aspect: 'Use Case',
        block1: 'When you need values from another module',
        block2: 'When you only need execution ordering',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'You need to pass outputs from one module to another (e.g., VPC ID)',
        'You want to validate configurations with mock values before dependencies exist',
        'You need conditional logic based on dependency outputs',
        'You want explicit, named references in your inputs block',
      ],
      useBlock2When: [
        'You only need to ensure modules run in a specific order',
        'Performance is critical and you don\'t need output values',
        'You have many dependencies but only need ordering guarantees',
        'The dependent modules don\'t expose outputs you need',
      ],
    },
    commonMistakes: [
      'Using dependencies when you actually need output values (no outputs.* available)',
      'Creating dependency blocks for every module when only ordering is needed (performance impact)',
      'Forgetting mock_outputs when using dependency - causes failures during plan before deps exist',
      'Circular dependency references between modules',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependency',
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependencies',
    ],
  },

  // ---------------------------------------------------------------------------
  // include (single) vs multiple includes
  // ---------------------------------------------------------------------------
  {
    id: 'include-single-vs-multiple',
    blocks: ['include', 'multiple includes'],
    summary: 'A single include inherits from one parent config; multiple includes allow composing configuration from several sources.',
    block1Details: {
      name: 'include (single)',
      purpose: 'Inherit configuration from a single parent terragrunt.hcl file',
      syntax: `include "root" {
  path = find_in_parent_folders()
}`,
      keyFeatures: [
        'Inherits all configuration from parent',
        'Supports expose = true to access parent locals',
        'Can merge or override parent values',
        'Traditional DRY pattern for Terragrunt',
        'Simple inheritance model',
      ],
    },
    block2Details: {
      name: 'multiple includes',
      purpose: 'Compose configuration from multiple parent files for modular reuse',
      syntax: `include "root" {
  path = find_in_parent_folders()
}

include "env" {
  path = find_in_parent_folders("env.hcl")
  expose = true
}

include "region" {
  path = find_in_parent_folders("region.hcl")
  expose = true
  merge_strategy = "deep"
}`,
      keyFeatures: [
        'Each include has a unique name',
        'Can include from different directory levels',
        'Supports different merge strategies per include',
        'Access exposed values via include.<name>.*',
        'Powerful composition for complex projects',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Composition',
        block1: 'Single source of inherited configuration',
        block2: 'Multiple sources composed together',
      },
      {
        aspect: 'Complexity',
        block1: 'Simple, linear inheritance',
        block2: 'More complex, requires understanding merge order',
      },
      {
        aspect: 'Flexibility',
        block1: 'Limited to one parent\'s configuration',
        block2: 'Mix and match configurations from multiple files',
      },
      {
        aspect: 'Naming',
        block1: 'Name is optional (defaults to empty string)',
        block2: 'Names required to distinguish includes',
      },
      {
        aspect: 'Merge Control',
        block1: 'Single merge with parent',
        block2: 'Per-include merge_strategy control',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'You have a simple project structure with one root config',
        'All shared configuration lives in a single parent file',
        'You\'re just starting with Terragrunt and want simplicity',
        'Your configuration hierarchy is strictly linear',
      ],
      useBlock2When: [
        'You want to separate concerns (env config, region config, common config)',
        'Different modules need different combinations of shared configs',
        'You have a complex multi-account, multi-region setup',
        'You want to compose behavior from reusable config fragments',
      ],
    },
    commonMistakes: [
      'Not understanding merge order when using multiple includes (last wins for conflicts)',
      'Forgetting expose = true when trying to access parent locals',
      'Creating circular include dependencies',
      'Over-engineering with too many includes when one would suffice',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#include',
      'https://terragrunt.gruntwork.io/docs/features/keep-your-terragrunt-architecture-dry/',
    ],
  },

  // ---------------------------------------------------------------------------
  // inputs vs locals
  // ---------------------------------------------------------------------------
  {
    id: 'inputs-vs-locals',
    blocks: ['inputs', 'locals'],
    summary: 'inputs passes values to Terraform as variables; locals defines reusable values within Terragrunt configuration only.',
    block1Details: {
      name: 'inputs',
      purpose: 'Define values that are passed to Terraform as input variables',
      syntax: `inputs = {
  environment = "production"
  instance_type = "t3.medium"
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
      keyFeatures: [
        'Values become TF_VAR_* environment variables',
        'Must match Terraform variable definitions',
        'Can reference locals, dependencies, and functions',
        'Merged with parent inputs when using include',
        'The bridge between Terragrunt and Terraform',
      ],
    },
    block2Details: {
      name: 'locals',
      purpose: 'Define reusable values for use within Terragrunt configuration',
      syntax: `locals {
  environment = "production"
  account_id = get_aws_account_id()
  name_prefix = "\${local.environment}-\${local.account_id}"
}

inputs = {
  name = local.name_prefix
}`,
      keyFeatures: [
        'Values only available within terragrunt.hcl',
        'Not passed to Terraform unless used in inputs',
        'Great for computed values and DRY configuration',
        'Can use Terragrunt functions',
        'Can be exposed to child configs via include',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Scope',
        block1: 'Passed to Terraform module',
        block2: 'Only available in Terragrunt config',
      },
      {
        aspect: 'Purpose',
        block1: 'Configure Terraform module behavior',
        block2: 'DRY helper values for Terragrunt',
      },
      {
        aspect: 'Visibility',
        block1: 'Visible in Terraform plan output',
        block2: 'Internal to Terragrunt only',
      },
      {
        aspect: 'Inheritance',
        block1: 'Merged from parent includes',
        block2: 'Must be explicitly exposed to children',
      },
      {
        aspect: 'Reference Syntax',
        block1: 'Used directly in Terraform as var.*',
        block2: 'Referenced as local.* in Terragrunt',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'Defining values that Terraform needs to configure resources',
        'Passing dependency outputs to Terraform',
        'Setting environment-specific configuration for modules',
        'Any value that needs to reach the Terraform layer',
      ],
      useBlock2When: [
        'Computing intermediate values used multiple times',
        'Extracting values from file paths or environment',
        'Building complex strings or data structures for inputs',
        'Defining values shared across multiple inputs',
      ],
    },
    commonMistakes: [
      'Putting computed values directly in inputs instead of using locals for reuse',
      'Expecting locals to be available in Terraform (they\'re not)',
      'Forgetting that inputs must match Terraform variable declarations',
      'Not using expose = true in includes when sharing locals',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#inputs',
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#locals',
    ],
  },

  // ---------------------------------------------------------------------------
  // generate vs terraform.source
  // ---------------------------------------------------------------------------
  {
    id: 'generate-vs-terraform-source',
    blocks: ['generate', 'terraform.source'],
    summary: 'generate creates additional .tf files in the working directory; terraform.source specifies which Terraform module to use.',
    block1Details: {
      name: 'generate',
      purpose: 'Generate Terraform configuration files dynamically',
      syntax: `generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"
}
EOF
}

generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "\${path_relative_to_include()}/terraform.tfstate"
    region = "us-east-1"
  }
}
EOF
}`,
      keyFeatures: [
        'Creates .tf files in the Terragrunt working directory',
        'Commonly used for provider and backend configuration',
        'Supports if_exists to control overwrite behavior',
        'Can use Terragrunt functions in contents',
        'Files are generated before Terraform runs',
      ],
    },
    block2Details: {
      name: 'terraform.source',
      purpose: 'Specify the Terraform module source to use',
      syntax: `terraform {
  source = "tfr:///terraform-aws-modules/vpc/aws?version=5.0.0"
}

# Or local source:
terraform {
  source = "../../../modules//vpc"
}

# Or Git source:
terraform {
  source = "git::https://github.com/org/modules.git//vpc?ref=v1.0.0"
}`,
      keyFeatures: [
        'Points to Terraform module code',
        'Supports registry, Git, local, S3, and other sources',
        'Double-slash (//) separates repo from subdirectory',
        'Can include version/ref for pinning',
        'The actual infrastructure code to execute',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Purpose',
        block1: 'Add configuration to existing module',
        block2: 'Specify which module to run',
      },
      {
        aspect: 'Output',
        block1: 'Creates .tf files in working directory',
        block2: 'Downloads/links module source',
      },
      {
        aspect: 'Common Use',
        block1: 'Providers, backends, common resources',
        block2: 'Module location (registry, git, local)',
      },
      {
        aspect: 'Required',
        block1: 'Optional - only when generating files',
        block2: 'Required - every Terragrunt config needs a source',
      },
      {
        aspect: 'Scope',
        block1: 'Supplements the module',
        block2: 'Defines the module itself',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'Adding provider configuration to modules that don\'t include it',
        'Dynamically configuring backend based on environment',
        'Injecting common resources across all modules',
        'Creating files that vary per environment/region',
      ],
      useBlock2When: [
        'Always - every Terragrunt module config needs a source',
        'Pointing to Terraform Registry modules',
        'Using Git repositories for module code',
        'Referencing local module directories',
      ],
    },
    commonMistakes: [
      'Thinking generate replaces terraform.source (they\'re complementary)',
      'Generating backend.tf when Terragrunt\'s remote_state block is better',
      'Not using if_exists correctly, causing file conflicts',
      'Forgetting the double-slash in terraform.source for subdirectories',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#generate',
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform',
    ],
  },

  // ---------------------------------------------------------------------------
  // before_hook vs after_hook
  // ---------------------------------------------------------------------------
  {
    id: 'before-hook-vs-after-hook',
    blocks: ['before_hook', 'after_hook'],
    summary: 'before_hook runs commands before Terraform; after_hook runs commands after Terraform completes.',
    block1Details: {
      name: 'before_hook',
      purpose: 'Execute commands before Terraform commands run',
      syntax: `terraform {
  before_hook "validate_inputs" {
    commands = ["apply", "plan"]
    execute  = ["./scripts/validate.sh"]
  }
  
  before_hook "cache_modules" {
    commands     = ["init"]
    execute      = ["./scripts/cache-modules.sh"]
    run_on_error = false
  }
}`,
      keyFeatures: [
        'Runs before specified Terraform commands',
        'Can validate, prepare, or set up prerequisites',
        'run_on_error controls execution on prior hook failures',
        'Useful for pre-flight checks and setup',
        'Can abort execution if hook fails',
      ],
    },
    block2Details: {
      name: 'after_hook',
      purpose: 'Execute commands after Terraform commands complete',
      syntax: `terraform {
  after_hook "notify_slack" {
    commands = ["apply"]
    execute  = ["./scripts/notify.sh", "Applied successfully"]
  }
  
  after_hook "cleanup" {
    commands     = ["apply", "destroy"]
    execute      = ["./scripts/cleanup.sh"]
    run_on_error = true
  }
}`,
      keyFeatures: [
        'Runs after specified Terraform commands',
        'Can notify, clean up, or post-process',
        'run_on_error allows cleanup even on failure',
        'Useful for notifications and logging',
        'Has access to Terraform command result',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Timing',
        block1: 'Before Terraform command executes',
        block2: 'After Terraform command completes',
      },
      {
        aspect: 'Abort Behavior',
        block1: 'Failure prevents Terraform from running',
        block2: 'Failure happens after Terraform already ran',
      },
      {
        aspect: 'Common Use Cases',
        block1: 'Validation, setup, pre-flight checks',
        block2: 'Notifications, cleanup, post-processing',
      },
      {
        aspect: 'Error Context',
        block1: 'Can\'t know Terraform result (hasn\'t run)',
        block2: 'Can react to Terraform success/failure',
      },
      {
        aspect: 'Idempotency',
        block1: 'Should be idempotent (may run multiple times)',
        block2: 'Should handle partial Terraform completion',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'Validating inputs or environment before Terraform runs',
        'Setting up prerequisites (credentials, files)',
        'Running pre-flight security or compliance checks',
        'Caching or preparing external dependencies',
      ],
      useBlock2When: [
        'Sending notifications about apply/destroy results',
        'Cleaning up temporary files or resources',
        'Triggering downstream processes after changes',
        'Logging or auditing Terraform actions',
      ],
    },
    commonMistakes: [
      'Using after_hook for validation (too late to prevent Terraform)',
      'Not setting run_on_error = true for cleanup hooks',
      'Making before_hooks non-idempotent (breaks retries)',
      'Ignoring hook failures that should abort the operation',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#terraform',
      'https://terragrunt.gruntwork.io/docs/features/hooks/',
    ],
  },

  // ---------------------------------------------------------------------------
  // remote_state vs dependency
  // ---------------------------------------------------------------------------
  {
    id: 'remote-state-vs-dependency',
    blocks: ['remote_state', 'dependency'],
    summary: 'remote_state configures where state is stored; dependency references another Terragrunt module\'s outputs.',
    block1Details: {
      name: 'remote_state',
      purpose: 'Configure Terraform backend for state storage',
      syntax: `remote_state {
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
}`,
      keyFeatures: [
        'Configures Terraform backend (S3, GCS, Azure, etc.)',
        'Can auto-generate backend.tf file',
        'Supports automatic bucket/table creation',
        'Centralizes state configuration in root',
        'Interpolates path for unique state keys',
      ],
    },
    block2Details: {
      name: 'dependency',
      purpose: 'Reference outputs from another Terragrunt-managed module',
      syntax: `dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id = "mock-vpc-id"
  }
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
      keyFeatures: [
        'Reads outputs from another module\'s state',
        'Creates implicit execution ordering',
        'Supports mock_outputs for planning',
        'Uses the other module\'s configured backend',
        'Type-safe output references',
      ],
    },
    keyDifferences: [
      {
        aspect: 'Purpose',
        block1: 'Where to store THIS module\'s state',
        block2: 'How to read ANOTHER module\'s outputs',
      },
      {
        aspect: 'Direction',
        block1: 'Outbound - writing state',
        block2: 'Inbound - reading state',
      },
      {
        aspect: 'Scope',
        block1: 'One per module (the backend config)',
        block2: 'Multiple per module (one per dependency)',
      },
      {
        aspect: 'State Access',
        block1: 'Configures access credentials and location',
        block2: 'Uses dependency\'s remote_state to read',
      },
      {
        aspect: 'Required',
        block1: 'Required for any module storing state remotely',
        block2: 'Only when you need another module\'s outputs',
      },
    ],
    whenToUse: {
      useBlock1When: [
        'Configuring where Terraform stores its state file',
        'Setting up state locking with DynamoDB/equivalent',
        'Enabling encryption for state files',
        'Defining consistent state paths across environments',
      ],
      useBlock2When: [
        'Passing values between Terragrunt modules',
        'Creating execution order based on data flow',
        'Reading VPC IDs, ARNs, or other outputs from infrastructure',
        'Building a dependency graph for run-all commands',
      ],
    },
    commonMistakes: [
      'Confusing remote_state (backend config) with dependency (output reading)',
      'Trying to use dependency to configure where state is stored',
      'Not realizing dependency reads FROM the other module\'s remote_state',
      'Forgetting that remote_state is about YOUR state, dependency is about OTHERS\' state',
    ],
    relatedDocs: [
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#remote_state',
      'https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/#dependency',
    ],
  },
];

// ============================================================================
// STATIC PATTERN GUIDANCE
// ============================================================================

/**
 * Curated pattern guidance for common configuration scenarios
 */
const PATTERN_GUIDANCE: PatternGuidance[] = [
  // ---------------------------------------------------------------------------
  // Module Dependency Management
  // ---------------------------------------------------------------------------
  {
    id: 'module-dependency-management',
    scenario: 'Managing dependencies between Terraform modules',
    question: 'How should I manage dependencies between my Terragrunt modules?',
    keywords: ['dependency', 'dependencies', 'outputs', 'order', 'execution', 'dag', 'graph'],
    decisionCriteria: [
      {
        criterion: 'You need to pass output values from one module to another',
        recommendation: 'Use dependency blocks',
        reason: 'dependency blocks expose .outputs for accessing values like VPC IDs, ARNs, etc.',
      },
      {
        criterion: 'You only need modules to run in a specific order, no data passing',
        recommendation: 'Use dependencies block',
        reason: 'dependencies is lighter weight - no state reading, just ordering',
      },
      {
        criterion: 'You have many dependencies but only need a few outputs',
        recommendation: 'Mix dependency and dependencies',
        reason: 'Use dependency for modules with outputs you need, dependencies for ordering-only',
      },
      {
        criterion: 'You want to plan before dependent modules exist',
        recommendation: 'Use dependency with mock_outputs',
        reason: 'mock_outputs provides fake values for planning without real dependencies',
      },
    ],
    patterns: [
      {
        name: 'Explicit Output Dependencies',
        description: 'Use named dependency blocks for each module whose outputs you need',
        example: `dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = {
    vpc_id         = "mock-vpc-id"
    public_subnets = ["subnet-1", "subnet-2"]
  }
}

dependency "security_group" {
  config_path = "../security-group"
  mock_outputs = {
    security_group_id = "mock-sg-id"
  }
}

inputs = {
  vpc_id            = dependency.vpc.outputs.vpc_id
  subnet_ids        = dependency.vpc.outputs.public_subnets
  security_group_id = dependency.security_group.outputs.security_group_id
}`,
        pros: [
          'Clear, explicit data flow',
          'Supports mock values for planning',
          'Self-documenting dependencies',
        ],
        cons: [
          'Reads state files (slower for many dependencies)',
          'Must maintain mock_outputs',
        ],
      },
      {
        name: 'Order-Only Dependencies',
        description: 'Use dependencies block when you only need execution ordering',
        example: `dependencies {
  paths = ["../iam-roles", "../kms-keys", "../logging"]
}

# No inputs from these - just need them to exist first`,
        pros: [
          'Fast - no state file reading',
          'Simple syntax for multiple deps',
          'Good for foundational resources',
        ],
        cons: [
          'Cannot access output values',
          'Less explicit about WHY the dependency exists',
        ],
      },
      {
        name: 'Hybrid Approach',
        description: 'Combine both patterns based on actual data needs',
        example: `# Need outputs from VPC
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs = { vpc_id = "mock" }
}

# Only need ordering for these
dependencies {
  paths = ["../iam-roles", "../cloudwatch-logs"]
}

inputs = {
  vpc_id = dependency.vpc.outputs.vpc_id
}`,
        pros: [
          'Optimized - only reads state when needed',
          'Clear distinction between data and ordering deps',
          'Best of both patterns',
        ],
        cons: [
          'Slightly more complex to understand',
          'Must decide per-dependency which to use',
        ],
      },
    ],
    relatedComparisons: ['dependency-vs-dependencies'],
  },

  // ---------------------------------------------------------------------------
  // Configuration Inheritance
  // ---------------------------------------------------------------------------
  {
    id: 'configuration-inheritance',
    scenario: 'DRY configuration inheritance across environments and regions',
    question: 'How should I structure configuration inheritance in my Terragrunt project?',
    keywords: ['include', 'inherit', 'dry', 'parent', 'root', 'common', 'shared', 'merge'],
    decisionCriteria: [
      {
        criterion: 'Simple project with one level of shared config',
        recommendation: 'Use single include with find_in_parent_folders()',
        reason: 'Straightforward inheritance from one root.hcl file',
      },
      {
        criterion: 'Multi-account/multi-region with different config layers',
        recommendation: 'Use multiple named includes',
        reason: 'Compose config from account.hcl, region.hcl, env.hcl, and root.hcl',
      },
      {
        criterion: 'Need to access parent locals in child configs',
        recommendation: 'Use expose = true on include blocks',
        reason: 'Exposes parent locals as include.<name>.locals.*',
      },
      {
        criterion: 'Complex merging requirements',
        recommendation: 'Use merge_strategy per include',
        reason: 'Control how each include\'s values merge with local config',
      },
    ],
    patterns: [
      {
        name: 'Simple Root Include',
        description: 'Single parent file for all shared configuration',
        example: `# In modules/app/terragrunt.hcl:
include "root" {
  path = find_in_parent_folders()
}

# Root terragrunt.hcl contains remote_state, common inputs, etc.`,
        pros: [
          'Simple to understand',
          'One place for all shared config',
          'Easy to get started',
        ],
        cons: [
          'Can become monolithic',
          'Hard to have env-specific overrides',
          'All or nothing inheritance',
        ],
      },
      {
        name: 'Layered Includes',
        description: 'Multiple include files for different concerns',
        example: `include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path   = find_in_parent_folders("env.hcl")
  expose = true
}

include "region" {
  path           = find_in_parent_folders("region.hcl")
  expose         = true
  merge_strategy = "deep"
}

locals {
  env    = include.env.locals.environment
  region = include.region.locals.aws_region
}`,
        pros: [
          'Separation of concerns',
          'Easy to override at any level',
          'Flexible composition',
        ],
        cons: [
          'More files to manage',
          'Must understand merge order',
          'Can be confusing for newcomers',
        ],
      },
      {
        name: 'Environment-Specific Overrides',
        description: 'Common base with environment-specific configurations',
        example: `# Directory structure:
# ├── _envcommon/
# │   └── app.hcl        # Common app config
# ├── prod/
# │   └── app/
# │       └── terragrunt.hcl
# └── dev/
#     └── app/
#         └── terragrunt.hcl

# In prod/app/terragrunt.hcl:
include "root" {
  path = find_in_parent_folders()
}

include "envcommon" {
  path   = "\${dirname(find_in_parent_folders())}/_envcommon/app.hcl"
  expose = true
}

inputs = {
  # Override envcommon defaults for prod
  instance_type = "m5.xlarge"
}`,
        pros: [
          'Shared module config with env overrides',
          'Clear what\'s common vs environment-specific',
          'Scales well for many environments',
        ],
        cons: [
          '_envcommon pattern has learning curve',
          'Path calculations can be complex',
          'Requires disciplined structure',
        ],
      },
    ],
    relatedComparisons: ['include-single-vs-multiple'],
  },

  // ---------------------------------------------------------------------------
  // Backend and State Management
  // ---------------------------------------------------------------------------
  {
    id: 'backend-state-management',
    scenario: 'Configuring Terraform state storage and backend',
    question: 'How should I configure my Terraform backend in Terragrunt?',
    keywords: ['backend', 'state', 'remote_state', 's3', 'gcs', 'azure', 'storage', 'lock', 'dynamodb'],
    decisionCriteria: [
      {
        criterion: 'Need automatic backend configuration with state locking',
        recommendation: 'Use remote_state with generate = true',
        reason: 'Terragrunt generates backend.tf and can create bucket/table automatically',
      },
      {
        criterion: 'Backend already configured in Terraform module',
        recommendation: 'Use remote_state with generate = false or skip it',
        reason: 'Avoid conflicts with existing backend configuration',
      },
      {
        criterion: 'Different backends for different environments',
        recommendation: 'Define remote_state in environment-level includes',
        reason: 'Each env can have its own state bucket/configuration',
      },
      {
        criterion: 'Need to reference state from other modules',
        recommendation: 'Use dependency blocks, not direct state access',
        reason: 'dependency provides typed access to outputs with mock support',
      },
    ],
    patterns: [
      {
        name: 'Centralized S3 Backend',
        description: 'Single state bucket with path-based keys',
        example: `# In root terragrunt.hcl:
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "company-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # Auto-create bucket and table
    skip_bucket_versioning         = false
    skip_bucket_ssencryption       = false
    enable_lock_table_ssencryption = true
  }
}`,
        pros: [
          'Single bucket for all state',
          'Automatic key paths prevent collisions',
          'Centralized lock table',
        ],
        cons: [
          'All eggs in one basket (bucket)',
          'Permissions management for single bucket',
          'Cross-account access can be complex',
        ],
      },
      {
        name: 'Per-Environment Backends',
        description: 'Separate state storage per environment',
        example: `# In environments/prod/env.hcl:
locals {
  environment = "prod"
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "prod-terraform-state"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "prod-terraform-locks"
  }
}

# In environments/dev/env.hcl - similar but different bucket`,
        pros: [
          'Isolation between environments',
          'Different permissions per env',
          'Easier disaster recovery',
        ],
        cons: [
          'More buckets/tables to manage',
          'Cross-env dependencies more complex',
          'Duplicate configuration',
        ],
      },
      {
        name: 'Workspaces Alternative',
        description: 'Use Terragrunt directory structure instead of Terraform workspaces',
        example: `# Instead of workspaces, use directory structure:
# environments/
# ├── dev/us-east-1/vpc/terragrunt.hcl
# ├── staging/us-east-1/vpc/terragrunt.hcl
# └── prod/us-east-1/vpc/terragrunt.hcl

# Each gets unique state key via path_relative_to_include():
# dev/us-east-1/vpc/terraform.tfstate
# staging/us-east-1/vpc/terraform.tfstate
# prod/us-east-1/vpc/terraform.tfstate`,
        pros: [
          'Explicit, visible environment separation',
          'No workspace switching needed',
          'Full isolation by default',
        ],
        cons: [
          'More directories to navigate',
          'Duplicate module configurations',
          'Different from Terraform-native approach',
        ],
      },
    ],
    relatedComparisons: ['remote-state-vs-dependency', 'generate-vs-terraform-source'],
  },
];

// ============================================================================
// BLOCK COMPARISON MANAGER CLASS
// ============================================================================

/**
 * Manager for block comparisons and pattern guidance.
 * Provides search and lookup functionality for helping users
 * understand differences between similar HCL blocks and choose
 * appropriate configuration patterns.
 */
export class BlockComparisonManager {
  private comparisons: Map<string, BlockComparison>;
  private patterns: Map<string, PatternGuidance>;
  private blockIndex: Map<string, string[]>; // block name -> comparison IDs
  private keywordIndex: Map<string, string[]>; // keyword -> pattern IDs

  constructor() {
    this.comparisons = new Map();
    this.patterns = new Map();
    this.blockIndex = new Map();
    this.keywordIndex = new Map();
    this.initializeData();
  }

  /**
   * Initialize indices from static data
   */
  private initializeData(): void {
    // Index comparisons
    for (const comparison of BLOCK_COMPARISONS) {
      this.comparisons.set(comparison.id, comparison);
      
      // Index both blocks
      for (const block of comparison.blocks) {
        const normalized = this.normalizeBlockName(block);
        const existing = this.blockIndex.get(normalized) || [];
        existing.push(comparison.id);
        this.blockIndex.set(normalized, existing);
      }
    }

    // Index patterns
    for (const pattern of PATTERN_GUIDANCE) {
      this.patterns.set(pattern.id, pattern);
      
      // Index keywords
      for (const keyword of pattern.keywords) {
        const normalized = keyword.toLowerCase();
        const existing = this.keywordIndex.get(normalized) || [];
        existing.push(pattern.id);
        this.keywordIndex.set(normalized, existing);
      }
    }
  }

  /**
   * Normalize a block name for consistent lookup
   */
  private normalizeBlockName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^terraform_?/, '') // Remove terraform prefix
      .replace(/_block$/, ''); // Remove _block suffix
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Check for substring match
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }

    // Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[s1.length][s2.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Find best matching block name using fuzzy matching
   */
  private findBestBlockMatch(query: string): { block: string; score: number } | null {
    const normalized = this.normalizeBlockName(query);
    
    // Exact match
    if (this.blockIndex.has(normalized)) {
      return { block: normalized, score: 1 };
    }

    // Fuzzy match against all known blocks
    let bestMatch: { block: string; score: number } | null = null;
    
    for (const block of this.blockIndex.keys()) {
      const score = this.calculateStringSimilarity(normalized, block);
      if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { block, score };
      }
    }

    return bestMatch;
  }

  /**
   * Parse a comparison query like "dependency vs dependencies"
   */
  private parseComparisonQuery(query: string): { block1: string; block2: string } | null {
    // Try to split on common separators
    const separators = [' vs ', ' versus ', ' compared to ', ' or ', ' and '];
    
    for (const sep of separators) {
      if (query.toLowerCase().includes(sep)) {
        const parts = query.toLowerCase().split(sep);
        if (parts.length === 2) {
          return {
            block1: parts[0].trim(),
            block2: parts[1].trim(),
          };
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Compare two HCL blocks.
   * Accepts either two separate block names or a natural language query.
   * 
   * @param block1OrQuery First block name or query like "dependency vs dependencies"
   * @param block2 Optional second block name
   * @returns Comparison result with details or suggestions
   */
  compareBlocks(block1OrQuery: string, block2?: string): BlockComparisonResult {
    let searchBlock1: string;
    let searchBlock2: string;

    // Parse query if only one argument
    if (!block2) {
      const parsed = this.parseComparisonQuery(block1OrQuery);
      if (parsed) {
        searchBlock1 = parsed.block1;
        searchBlock2 = parsed.block2;
      } else {
        // Single block - suggest comparisons involving it
        const match = this.findBestBlockMatch(block1OrQuery);
        if (match) {
          const comparisonIds = this.blockIndex.get(match.block) || [];
          const suggestions = comparisonIds.map(id => {
            const comp = this.comparisons.get(id)!;
            return `${comp.blocks[0]} vs ${comp.blocks[1]}`;
          });
          return {
            found: false,
            suggestions,
            error: `Please specify two blocks to compare. Available comparisons for "${block1OrQuery}": ${suggestions.join(', ')}`,
          };
        }
        return {
          found: false,
          suggestions: this.getAvailableComparisons(),
          error: `Could not parse comparison query. Try: "block1 vs block2" or specify two blocks.`,
        };
      }
    } else {
      searchBlock1 = block1OrQuery;
      searchBlock2 = block2;
    }

    // Find matches for both blocks
    const match1 = this.findBestBlockMatch(searchBlock1);
    const match2 = this.findBestBlockMatch(searchBlock2);

    if (!match1) {
      return {
        found: false,
        suggestions: [...this.blockIndex.keys()],
        error: `Unknown block: "${searchBlock1}". Available blocks: ${[...this.blockIndex.keys()].join(', ')}`,
      };
    }

    if (!match2) {
      return {
        found: false,
        suggestions: [...this.blockIndex.keys()],
        error: `Unknown block: "${searchBlock2}". Available blocks: ${[...this.blockIndex.keys()].join(', ')}`,
      };
    }

    // Find comparison containing both blocks
    const ids1 = new Set(this.blockIndex.get(match1.block) || []);
    const ids2 = new Set(this.blockIndex.get(match2.block) || []);
    
    const commonIds = [...ids1].filter(id => ids2.has(id));

    if (commonIds.length === 0) {
      return {
        found: false,
        suggestions: this.getAvailableComparisons(),
        error: `No comparison available for "${searchBlock1}" vs "${searchBlock2}". Available comparisons: ${this.getAvailableComparisons().join(', ')}`,
      };
    }

    const comparison = this.comparisons.get(commonIds[0])!;
    return {
      found: true,
      comparison,
    };
  }

  /**
   * Get pattern guidance for a scenario or by keywords.
   * 
   * @param query Scenario description or keywords
   * @returns Pattern guidance result with recommendations
   */
  getPatternGuidance(query: string): PatternGuidanceResult {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Direct ID match
    for (const [id, pattern] of this.patterns) {
      if (queryLower.includes(id.replace(/-/g, ' ')) || 
          id.replace(/-/g, ' ').includes(queryLower)) {
        return { found: true, guidance: pattern };
      }
    }

    // Keyword matching with scoring
    const scores: SearchMatch<PatternGuidance>[] = [];

    for (const [, pattern] of this.patterns) {
      let score = 0;
      const matchedOn: string[] = [];

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 0.3;
          matchedOn.push(`keyword:${keyword}`);
        }
      }

      // Check scenario
      const scenarioWords = pattern.scenario.toLowerCase().split(/\s+/);
      for (const word of queryWords) {
        if (scenarioWords.some(sw => sw.includes(word) || word.includes(sw))) {
          score += 0.2;
          matchedOn.push(`scenario:${word}`);
        }
      }

      // Check question
      if (pattern.question.toLowerCase().includes(queryLower) ||
          queryLower.includes(pattern.question.toLowerCase().replace(/\?/g, ''))) {
        score += 0.5;
        matchedOn.push('question');
      }

      if (score > 0) {
        scores.push({ item: pattern, score: Math.min(score, 1), matchedOn });
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0 && scores[0].score > 0.3) {
      return { found: true, guidance: scores[0].item };
    }

    // Return suggestions
    const suggestions = [...this.patterns.values()].map(p => p.scenario);
    return {
      found: false,
      suggestions,
      error: `No pattern guidance found for "${query}". Available topics: ${suggestions.join('; ')}`,
    };
  }

  /**
   * Get all available block comparisons
   */
  getAvailableComparisons(): string[] {
    return [...this.comparisons.values()].map(c => `${c.blocks[0]} vs ${c.blocks[1]}`);
  }

  /**
   * Get all available pattern guidance topics
   */
  getAvailablePatterns(): string[] {
    return [...this.patterns.values()].map(p => p.scenario);
  }

  /**
   * Get a specific comparison by ID
   */
  getComparisonById(id: string): BlockComparison | undefined {
    return this.comparisons.get(id);
  }

  /**
   * Get specific pattern guidance by ID
   */
  getPatternById(id: string): PatternGuidance | undefined {
    return this.patterns.get(id);
  }

  /**
   * List all comparison IDs
   */
  listComparisonIds(): string[] {
    return [...this.comparisons.keys()];
  }

  /**
   * List all pattern guidance IDs
   */
  listPatternIds(): string[] {
    return [...this.patterns.keys()];
  }

  /**
   * Search comparisons by keyword
   */
  searchComparisons(query: string): SearchMatch<BlockComparison>[] {
    const queryLower = query.toLowerCase();
    const results: SearchMatch<BlockComparison>[] = [];

    for (const comparison of this.comparisons.values()) {
      let score = 0;
      const matchedOn: string[] = [];

      // Check block names
      for (const block of comparison.blocks) {
        if (block.toLowerCase().includes(queryLower) || 
            queryLower.includes(block.toLowerCase())) {
          score += 0.4;
          matchedOn.push(`block:${block}`);
        }
      }

      // Check summary
      if (comparison.summary.toLowerCase().includes(queryLower)) {
        score += 0.3;
        matchedOn.push('summary');
      }

      // Check key differences
      for (const diff of comparison.keyDifferences) {
        if (diff.aspect.toLowerCase().includes(queryLower) ||
            diff.block1.toLowerCase().includes(queryLower) ||
            diff.block2.toLowerCase().includes(queryLower)) {
          score += 0.2;
          matchedOn.push(`difference:${diff.aspect}`);
        }
      }

      if (score > 0) {
        results.push({ item: comparison, score: Math.min(score, 1), matchedOn });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

// Export singleton instance for convenience
export const blockComparisonManager = new BlockComparisonManager();
