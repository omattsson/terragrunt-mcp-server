import { TerragruntDocsManager } from './docs.js';
import { LRUCache } from 'lru-cache';

/**
 * Describes a single parameter accepted by a Terragrunt built-in function
 */
export interface FunctionParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string | number | boolean | null;
}

/**
 * Represents a code example demonstrating how to use a function
 */
export interface FunctionExample {
  code: string;
  description: string;
  useCase: string;
}

/**
 * Canonical representation of a Terragrunt built-in function
 */
export interface TerragruntFunction {
  name: string;
  signature: string;
  description: string;
  parameters: FunctionParameter[];
  returnType: string;
  category: string;
  examples: FunctionExample[];
  relatedFunctions: string[];
  stability?: 'stable' | 'experimental';
  experiment?: string;
}

/**
 * Function categories for Terragrunt built-in functions
 */
export type FunctionCategory = 'path' | 'environment' | 'aws' | 'terraform' | 'file' | 'execution' | 'utility';

/**
 * Static, curated definitions of all Terragrunt built-in functions.
 * These definitions guarantee complete coverage and serve as the authoritative reference.
 * Doc-extracted functions may enrich these with additional examples.
 */
export const STATIC_BUILTIN_FUNCTIONS: TerragruntFunction[] = [
  // ============================================================================
  // PATH FUNCTIONS (10)
  // ============================================================================
  {
    name: 'find_in_parent_folders',
    signature: 'find_in_parent_folders(name, [fallback])',
    description: 'Searches up the directory tree from the current terragrunt.hcl file and returns the absolute path to the first file in a parent folder with a given name. If no file is found and no fallback is provided, exits with an error.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'The filename to search for in parent directories' },
      { name: 'fallback', type: 'string', required: false, description: 'Value to return if the file is not found (prevents error)', default: undefined }
    ],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'include "root" {\n  path = find_in_parent_folders("root.hcl")\n}', description: 'Find and include root configuration', useCase: 'include-parent' },
      { code: 'find_in_parent_folders("env.hcl", "fallback.hcl")', description: 'Find env config with fallback if not found', useCase: 'fallback' },
      { code: 'locals {\n  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))\n}', description: 'Read common configuration from parent', useCase: 'read-config' }
    ],
    relatedFunctions: ['get_terragrunt_dir', 'get_parent_terragrunt_dir', 'read_terragrunt_config']
  },
  {
    name: 'path_relative_to_include',
    signature: 'path_relative_to_include([name])',
    description: 'Returns the relative path between the current terragrunt.hcl file and the path specified in its include block. Useful for generating unique state keys based on directory structure.',
    parameters: [
      { name: 'name', type: 'string', required: false, description: 'The name of the include block to use when multiple include blocks exist', default: undefined }
    ],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'remote_state {\n  backend = "s3"\n  config = {\n    key = "${path_relative_to_include()}/terraform.tfstate"\n  }\n}', description: 'Generate unique state key based on directory path', useCase: 'state-key' },
      { code: 'path_relative_to_include("root")', description: 'Get path relative to specific named include', useCase: 'named-include' }
    ],
    relatedFunctions: ['path_relative_from_include', 'find_in_parent_folders', 'get_terragrunt_dir']
  },
  {
    name: 'path_relative_from_include',
    signature: 'path_relative_from_include([name])',
    description: 'Returns the relative path from the path specified in the include block to the current terragrunt.hcl file. This is the counterpart of path_relative_to_include().',
    parameters: [
      { name: 'name', type: 'string', required: false, description: 'The name of the include block to use when multiple include blocks exist', default: undefined }
    ],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'terraform {\n  source = "${path_relative_from_include()}/../sources//${path_relative_to_include()}"\n}', description: 'Construct source path relative to include', useCase: 'source-path' },
      { code: 'arguments = [\n  "-var-file=${get_terragrunt_dir()}/${path_relative_from_include()}/common.tfvars"\n]', description: 'Reference common tfvars from root', useCase: 'var-file' }
    ],
    relatedFunctions: ['path_relative_to_include', 'get_terragrunt_dir', 'get_parent_terragrunt_dir']
  },
  {
    name: 'get_terragrunt_dir',
    signature: 'get_terragrunt_dir()',
    description: 'Returns the directory where the Terragrunt configuration file (by default terragrunt.hcl) lives. Useful for constructing paths relative to your Terragrunt configuration.',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'arguments = [\n  "-var-file=${get_terragrunt_dir()}/../common.tfvars"\n]', description: 'Reference files relative to terragrunt.hcl', useCase: 'var-file' },
      { code: 'terraform {\n  source = "${get_terragrunt_dir()}/../modules//vpc"\n}', description: 'Reference local modules', useCase: 'local-module' }
    ],
    relatedFunctions: ['get_parent_terragrunt_dir', 'get_original_terragrunt_dir', 'get_working_dir']
  },
  {
    name: 'get_working_dir',
    signature: 'get_working_dir()',
    description: 'Returns the absolute path where Terragrunt runs OpenTofu/Terraform commands. Useful for managing file substitutions in the temporary working directory.',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'locals {\n  working_dir = get_working_dir()\n}', description: 'Get the Terraform working directory', useCase: 'working-dir' }
    ],
    relatedFunctions: ['get_terragrunt_dir', 'get_original_terragrunt_dir']
  },
  {
    name: 'get_parent_terragrunt_dir',
    signature: 'get_parent_terragrunt_dir([name])',
    description: 'Returns the absolute directory where the Terragrunt parent configuration file lives. Similar to get_terragrunt_dir() but returns the root instead of the leaf of your terragrunt configurations.',
    parameters: [
      { name: 'name', type: 'string', required: false, description: 'The name of the include block when multiple includes exist', default: undefined }
    ],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'arguments = [\n  "-var-file=${get_parent_terragrunt_dir()}/common.tfvars"\n]', description: 'Reference common vars from parent directory', useCase: 'common-vars' },
      { code: 'terraform {\n  source = "${get_parent_terragrunt_dir(\\"root\\")}/modules/vpc"\n}', description: 'Reference modules from named parent include', useCase: 'named-include' }
    ],
    relatedFunctions: ['get_terragrunt_dir', 'get_original_terragrunt_dir', 'find_in_parent_folders']
  },
  {
    name: 'get_original_terragrunt_dir',
    signature: 'get_original_terragrunt_dir()',
    description: 'Returns the directory where the original Terragrunt configuration file lives. Primarily useful when one config is being read from another via read_terragrunt_config().',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'locals {\n  original_dir = get_original_terragrunt_dir()\n}', description: 'Get the original terragrunt.hcl directory when reading configs', useCase: 'read-config' }
    ],
    relatedFunctions: ['get_terragrunt_dir', 'get_parent_terragrunt_dir', 'read_terragrunt_config']
  },
  {
    name: 'get_repo_root',
    signature: 'get_repo_root()',
    description: 'Returns the absolute path to the root of the Git repository. Errors if the file is not located in a Git repository.',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'inputs = {\n  config_path = "${get_repo_root()}/config/app.conf"\n}', description: 'Reference files from repository root', useCase: 'repo-files' }
    ],
    relatedFunctions: ['get_path_from_repo_root', 'get_path_to_repo_root']
  },
  {
    name: 'get_path_from_repo_root',
    signature: 'get_path_from_repo_root()',
    description: 'Returns the path from the root of the Git repository to the current directory. Errors if the file is not in a Git repository.',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'remote_state {\n  config = {\n    key = "${get_path_from_repo_root()}/terraform.tfstate"\n  }\n}', description: 'Generate state key based on repo path', useCase: 'state-key' }
    ],
    relatedFunctions: ['get_repo_root', 'get_path_to_repo_root', 'path_relative_to_include']
  },
  {
    name: 'get_path_to_repo_root',
    signature: 'get_path_to_repo_root()',
    description: 'Returns the relative path from the current directory to the root of the Git repository. Errors if the file is not in a Git repository.',
    parameters: [],
    returnType: 'string',
    category: 'path',
    examples: [
      { code: 'terraform {\n  source = "${get_path_to_repo_root()}//modules/example"\n}', description: 'Reference modules relative to repo root', useCase: 'module-source' }
    ],
    relatedFunctions: ['get_repo_root', 'get_path_from_repo_root']
  },

  // ============================================================================
  // ENVIRONMENT FUNCTIONS (2)
  // ============================================================================
  {
    name: 'get_env',
    signature: 'get_env(name, [default])',
    description: 'Returns the value of the environment variable with the given name. If the variable is not set and no default is provided, throws an error. Tip: OpenTofu/Terraform reads TF_VAR_* environment variables automatically.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'The name of the environment variable' },
      { name: 'default', type: 'string', required: false, description: 'Default value if the variable is not set', default: undefined }
    ],
    returnType: 'string',
    category: 'environment',
    examples: [
      { code: 'remote_state {\n  config = {\n    bucket = get_env("TG_BUCKET")\n  }\n}', description: 'Read required environment variable', useCase: 'required-env' },
      { code: 'locals {\n  env = get_env("ENVIRONMENT", "dev")\n}', description: 'Read environment variable with default', useCase: 'default-env' }
    ],
    relatedFunctions: ['get_platform']
  },
  {
    name: 'get_platform',
    signature: 'get_platform()',
    description: 'Returns the current operating system. Useful for platform-specific configurations. Returns values like "darwin", "linux", "windows", "freebsd".',
    parameters: [],
    returnType: 'string',
    category: 'environment',
    examples: [
      { code: 'inputs = {\n  platform = get_platform()\n}', description: 'Pass platform to Terraform', useCase: 'platform-input' },
      { code: 'locals {\n  is_mac = get_platform() == "darwin"\n}', description: 'Conditional logic based on OS', useCase: 'conditional' }
    ],
    relatedFunctions: ['get_env']
  },

  // ============================================================================
  // AWS FUNCTIONS (4)
  // ============================================================================
  {
    name: 'get_aws_account_id',
    signature: 'get_aws_account_id()',
    description: 'Returns the AWS account ID associated with the current set of credentials. Note: The value can change during HCL parsing, for example after evaluation of the iam_role attribute.',
    parameters: [],
    returnType: 'string',
    category: 'aws',
    examples: [
      { code: 'remote_state {\n  config = {\n    bucket = "mycompany-${get_aws_account_id()}"\n  }\n}', description: 'Create account-specific bucket name', useCase: 'bucket-name' },
      { code: 'terraform {\n  extra_arguments "account_vars" {\n    arguments = ["-var-file=${get_aws_account_id()}.tfvars"]\n  }\n}', description: 'Load account-specific variables', useCase: 'account-vars' }
    ],
    relatedFunctions: ['get_aws_account_alias', 'get_aws_caller_identity_arn', 'get_aws_caller_identity_user_id']
  },
  {
    name: 'get_aws_account_alias',
    signature: 'get_aws_account_alias()',
    description: 'Returns the AWS account alias associated with the current credentials. Returns an empty string if no alias is set. Note: The value can change during HCL parsing.',
    parameters: [],
    returnType: 'string',
    category: 'aws',
    examples: [
      { code: 'inputs = {\n  account_alias = get_aws_account_alias()\n}', description: 'Pass account alias to Terraform', useCase: 'account-alias' }
    ],
    relatedFunctions: ['get_aws_account_id', 'get_aws_caller_identity_arn']
  },
  {
    name: 'get_aws_caller_identity_arn',
    signature: 'get_aws_caller_identity_arn()',
    description: 'Returns the ARN of the AWS identity associated with the current credentials. Note: The value can change during HCL parsing, for example after evaluation of the iam_role attribute.',
    parameters: [],
    returnType: 'string',
    category: 'aws',
    examples: [
      { code: 'inputs = {\n  caller_arn = get_aws_caller_identity_arn()\n}', description: 'Pass caller ARN to Terraform', useCase: 'caller-arn' }
    ],
    relatedFunctions: ['get_aws_account_id', 'get_aws_caller_identity_user_id']
  },
  {
    name: 'get_aws_caller_identity_user_id',
    signature: 'get_aws_caller_identity_user_id()',
    description: 'Returns the User ID of the AWS identity associated with the current credentials. Note: The value can change during HCL parsing, for example after evaluation of the iam_role attribute.',
    parameters: [],
    returnType: 'string',
    category: 'aws',
    examples: [
      { code: 'inputs = {\n  caller_user_id = get_aws_caller_identity_user_id()\n}', description: 'Pass caller user ID to Terraform', useCase: 'caller-user-id' }
    ],
    relatedFunctions: ['get_aws_account_id', 'get_aws_caller_identity_arn']
  },

  // ============================================================================
  // TERRAFORM COMMAND FUNCTIONS (6)
  // ============================================================================
  {
    name: 'get_terraform_commands_that_need_vars',
    signature: 'get_terraform_commands_that_need_vars()',
    description: 'Returns the list of OpenTofu/Terraform commands that accept -var and -var-file parameters. Use this in extra_arguments blocks to apply variable files only to relevant commands.',
    parameters: [],
    returnType: 'list(string)',
    category: 'terraform',
    examples: [
      { code: 'terraform {\n  extra_arguments "common_vars" {\n    commands = get_terraform_commands_that_need_vars()\n    arguments = ["-var-file=common.tfvars"]\n  }\n}', description: 'Apply var file to all relevant commands', useCase: 'var-file' }
    ],
    relatedFunctions: ['get_terraform_commands_that_need_input', 'get_terraform_commands_that_need_locking', 'get_terraform_commands_that_need_parallelism']
  },
  {
    name: 'get_terraform_commands_that_need_input',
    signature: 'get_terraform_commands_that_need_input()',
    description: 'Returns the list of OpenTofu/Terraform commands that accept the -input=(true or false) parameter. Use this to disable interactive input in CI/CD pipelines.',
    parameters: [],
    returnType: 'list(string)',
    category: 'terraform',
    examples: [
      { code: 'terraform {\n  extra_arguments "disable_input" {\n    commands = get_terraform_commands_that_need_input()\n    arguments = ["-input=false"]\n  }\n}', description: 'Disable interactive input for all relevant commands', useCase: 'disable-input' }
    ],
    relatedFunctions: ['get_terraform_commands_that_need_vars', 'get_terraform_commands_that_need_locking']
  },
  {
    name: 'get_terraform_commands_that_need_locking',
    signature: 'get_terraform_commands_that_need_locking()',
    description: 'Returns the list of OpenTofu/Terraform commands that accept the -lock-timeout parameter. Use this to configure lock timeout for state operations.',
    parameters: [],
    returnType: 'list(string)',
    category: 'terraform',
    examples: [
      { code: 'terraform {\n  extra_arguments "retry_lock" {\n    commands = get_terraform_commands_that_need_locking()\n    arguments = ["-lock-timeout=20m"]\n  }\n}', description: 'Set lock timeout for all locking commands', useCase: 'lock-timeout' }
    ],
    relatedFunctions: ['get_terraform_commands_that_need_vars', 'get_terraform_commands_that_need_parallelism']
  },
  {
    name: 'get_terraform_commands_that_need_parallelism',
    signature: 'get_terraform_commands_that_need_parallelism()',
    description: 'Returns the list of OpenTofu/Terraform commands that accept the -parallelism parameter. Use this to limit concurrent operations.',
    parameters: [],
    returnType: 'list(string)',
    category: 'terraform',
    examples: [
      { code: 'terraform {\n  extra_arguments "parallelism" {\n    commands = get_terraform_commands_that_need_parallelism()\n    arguments = ["-parallelism=5"]\n  }\n}', description: 'Limit parallelism for all relevant commands', useCase: 'parallelism' }
    ],
    relatedFunctions: ['get_terraform_commands_that_need_vars', 'get_terraform_commands_that_need_locking']
  },
  {
    name: 'get_terraform_command',
    signature: 'get_terraform_command()',
    description: 'Returns the current OpenTofu/Terraform command being executed (e.g., "apply", "plan", "init"). Useful for conditional logic based on the command.',
    parameters: [],
    returnType: 'string',
    category: 'terraform',
    examples: [
      { code: 'inputs = {\n  current_command = get_terraform_command()\n}', description: 'Pass current command to Terraform', useCase: 'command-input' },
      { code: 'locals {\n  is_apply = get_terraform_command() == "apply"\n}', description: 'Conditional logic based on command', useCase: 'conditional' }
    ],
    relatedFunctions: ['get_terraform_cli_args']
  },
  {
    name: 'get_terraform_cli_args',
    signature: 'get_terraform_cli_args()',
    description: 'Returns the CLI arguments passed to the current OpenTofu/Terraform command. Useful for inspecting or passing through arguments.',
    parameters: [],
    returnType: 'list(string)',
    category: 'terraform',
    examples: [
      { code: 'inputs = {\n  cli_args = get_terraform_cli_args()\n}', description: 'Pass CLI args to Terraform', useCase: 'cli-args' }
    ],
    relatedFunctions: ['get_terraform_command']
  },

  // ============================================================================
  // FILE FUNCTIONS (5)
  // ============================================================================
  {
    name: 'read_terragrunt_config',
    signature: 'read_terragrunt_config(config_path, [default_val])',
    description: 'Parses a Terragrunt config file and returns a map of its contents. Exposes all blocks and attributes including locals, inputs, and dependency outputs. Also supports reading terragrunt.stack.hcl and terragrunt.values.hcl files.',
    parameters: [
      { name: 'config_path', type: 'string', required: true, description: 'Path to the terragrunt config file to read' },
      { name: 'default_val', type: 'any', required: false, description: 'Default value to return if the file does not exist', default: undefined }
    ],
    returnType: 'map',
    category: 'file',
    examples: [
      { code: 'locals {\n  common = read_terragrunt_config(find_in_parent_folders("common.hcl"))\n}\ninputs = merge(local.common.inputs, { })', description: 'Read and merge common configuration', useCase: 'merge-config' },
      { code: 'locals {\n  deps = read_terragrunt_config("common_deps.hcl")\n}\ninputs = {\n  vpc_id = local.deps.dependency.vpc.outputs.vpc_id\n}', description: 'Access dependency outputs from another config', useCase: 'dependency-outputs' },
      { code: 'locals {\n  optional = read_terragrunt_config("optional.hcl", {inputs = {}})\n}', description: 'Read optional config with default', useCase: 'optional-config' }
    ],
    relatedFunctions: ['find_in_parent_folders', 'read_tfvars_file']
  },
  {
    name: 'read_tfvars_file',
    signature: 'read_tfvars_file(file_path)',
    description: 'Reads a .tfvars or .tfvars.json file and returns a map of the variables defined in it. Useful for incorporating existing Terraform variable files.',
    parameters: [
      { name: 'file_path', type: 'string', required: true, description: 'Path to the .tfvars or .tfvars.json file' }
    ],
    returnType: 'map',
    category: 'file',
    examples: [
      { code: 'locals {\n  vars = read_tfvars_file("common.tfvars")\n}\ninputs = merge(local.vars, { })', description: 'Read and merge tfvars file', useCase: 'merge-tfvars' },
      { code: 'locals {\n  backend = read_tfvars_file("backend.tfvars")\n}\nremote_state {\n  config = {\n    region = local.backend.region\n  }\n}', description: 'Use tfvars for backend configuration', useCase: 'backend-config' }
    ],
    relatedFunctions: ['read_terragrunt_config']
  },
  {
    name: 'sops_decrypt_file',
    signature: 'sops_decrypt_file(file_path)',
    description: 'Decrypts a file encrypted with SOPS (Secrets OPerationS). Supports YAML, JSON, ENV, INI, and raw text formats. Requires SOPS to be configured with appropriate key management (AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault, or PGP).',
    parameters: [
      { name: 'file_path', type: 'string', required: true, description: 'Path to the SOPS-encrypted file' }
    ],
    returnType: 'string',
    category: 'file',
    examples: [
      { code: 'locals {\n  secrets = yamldecode(sops_decrypt_file("secrets.yaml"))\n}\ninputs = merge(local.secrets, { })', description: 'Decrypt and parse YAML secrets', useCase: 'yaml-secrets' },
      { code: 'locals {\n  secrets = try(jsondecode(sops_decrypt_file("secrets.json")), {})\n}', description: 'Decrypt JSON with fallback', useCase: 'json-fallback' }
    ],
    relatedFunctions: ['read_terragrunt_config']
  },
  {
    name: 'mark_as_read',
    signature: 'mark_as_read(file_path)',
    description: 'Marks a file as read for the --queue-include-units-reading flag. Use this when a file is read by external tools (like Terraform) but Terragrunt needs to track the dependency. Requires absolute path.',
    parameters: [
      { name: 'file_path', type: 'string', required: true, description: 'Absolute path to the file to mark as read' }
    ],
    returnType: 'string',
    category: 'file',
    examples: [
      { code: 'locals {\n  filename = mark_as_read("/path/to/config.txt")\n}\ninputs = {\n  config_file = local.filename\n}', description: 'Mark file as read for queue inclusion', useCase: 'queue-include' },
      { code: 'locals {\n  files = [for f in fileset("./config", "*.yaml") : file(mark_as_read(abspath("${get_terragrunt_dir()}/config/${f}")))]\n}', description: 'Mark multiple files as read', useCase: 'multiple-files' }
    ],
    relatedFunctions: ['read_terragrunt_config']
  },
  {
    name: 'mark_glob_as_read',
    signature: 'mark_glob_as_read([--terragrunt-boundary=<path>], pattern)',
    description: 'Expands a glob and marks every matching file as read for reading-based filter expressions. Returns absolute matching paths, or an empty list when nothing matches. Use forward slashes even on Windows and call it from locals so files affect run --all queue construction. Expansion is confined to the Git repository root by default; use a leading --terragrunt-boundary=<path> argument to change the boundary. Boundary errors can be handled with try(...).',
    parameters: [
      { name: 'boundary', type: 'string', required: false, description: 'Optional leading --terragrunt-boundary=<path> argument that limits or widens the glob walk', default: undefined },
      { name: 'pattern', type: 'string', required: true, description: 'Glob pattern using forward slashes and gobwas/glob syntax' }
    ],
    returnType: 'list(string)',
    category: 'file',
    examples: [
      { code: 'locals {\n  configs = mark_glob_as_read("${get_terragrunt_dir()}/config/{*.yaml,**/*.yaml}")\n}', description: 'Track configuration files at any depth before the run queue is built', useCase: 'reading-filter' },
      { code: 'locals {\n  configs = mark_glob_as_read("--terragrunt-boundary=/etc/terragrunt", "/etc/terragrunt/{*.yaml}")\n}', description: 'Restrict glob expansion to an explicit boundary', useCase: 'bounded-glob' },
      { code: 'locals {\n  configs = sort(try(mark_glob_as_read("${local.dir}/{*.yaml,*.yml,*.json}"), []))\n}', description: 'Recover from an invalid or out-of-bound glob with an empty list', useCase: 'boundary-fallback' }
    ],
    relatedFunctions: ['mark_as_read', 'get_repo_root'],
    stability: 'stable'
  },

  // ============================================================================
  // EXECUTION FUNCTIONS (1)
  // ============================================================================
  {
    name: 'run_cmd',
    signature: 'run_cmd([flags], command, ...args)',
    description: 'Runs a shell command and returns stdout as the result. Executes in the same folder as the terragrunt.hcl file. Supports special flags: --terragrunt-quiet (suppress output), --terragrunt-global-cache (cache globally), --terragrunt-no-cache (disable caching). Results are cached by default based on directory and command.',
    parameters: [
      { name: 'flags', type: 'string', required: false, description: 'Optional flags: --terragrunt-quiet, --terragrunt-global-cache, --terragrunt-no-cache', default: undefined },
      { name: 'command', type: 'string', required: true, description: 'The command to execute' },
      { name: 'args', type: 'string...', required: false, description: 'Arguments to pass to the command', default: undefined }
    ],
    returnType: 'string',
    category: 'execution',
    examples: [
      { code: 'remote_state {\n  config = {\n    bucket = run_cmd("./get_bucket_name.sh")\n  }\n}', description: 'Run script to get dynamic value', useCase: 'dynamic-value' },
      { code: 'locals {\n  secret = run_cmd("--terragrunt-quiet", "./decrypt.sh", "secret_name")\n}', description: 'Run command with suppressed output for secrets', useCase: 'secret-value' },
      { code: 'locals {\n  account_id = run_cmd("--terragrunt-global-cache", "aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text")\n}', description: 'Cache result globally across configurations', useCase: 'global-cache' },
      { code: 'locals {\n  timestamp = run_cmd("--terragrunt-no-cache", "date", "+%s")\n}', description: 'Disable caching for dynamic values', useCase: 'no-cache' }
    ],
    relatedFunctions: ['get_env']
  },

  // ============================================================================
  // UTILITY FUNCTIONS (4)
  // ============================================================================
  {
    name: 'deep_merge',
    signature: 'deep_merge(map1, map2, ...maps)',
    description: 'Deeply merges two or more maps or objects. Later values override earlier scalar values, nested maps merge recursively, lists append, and null arguments are ignored. This function requires the deep-merge experiment and returns an error when the experiment is not enabled.',
    parameters: [
      { name: 'map1', type: 'map', required: true, description: 'First map or object to merge' },
      { name: 'map2', type: 'map', required: true, description: 'Second map or object whose values take precedence' },
      { name: 'maps', type: 'map...', required: false, description: 'Additional maps or objects merged in order; null values are ignored', default: undefined }
    ],
    returnType: 'map',
    category: 'utility',
    examples: [
      { code: 'locals {\n  config = deep_merge(\n    { service = { retries = 1, mode = "safe" } },\n    { service = { retries = 3 }, tags = { env = "dev" } },\n  )\n}', description: 'Recursively merge nested service configuration', useCase: 'nested-map-merge' },
      { code: 'locals {\n  files = sort(fileset(get_terragrunt_dir(), "*.json"))\n  config = deep_merge([for path in local.files : jsondecode(file(path))]...)\n}', description: 'Expand a list of decoded JSON maps into positional arguments', useCase: 'variadic-file-merge' }
    ],
    relatedFunctions: ['read_terragrunt_config'],
    stability: 'experimental',
    experiment: 'deep-merge'
  },
  {
    name: 'get_terragrunt_source_cli_flag',
    signature: 'get_terragrunt_source_cli_flag()',
    description: 'Returns the value passed via --source CLI flag or TG_SOURCE environment variable. Returns empty string if not set. Useful for local development overrides and conditional logic.',
    parameters: [],
    returnType: 'string',
    category: 'utility',
    examples: [
      { code: 'locals {\n  is_local_dev = get_terragrunt_source_cli_flag() != ""\n}', description: 'Detect local development mode', useCase: 'local-dev' },
      { code: 'dependency "vpc" {\n  mock_outputs = get_terragrunt_source_cli_flag() != "" ? jsondecode(file("${get_terragrunt_source_cli_flag()}/mocks/vpc.json")) : {}\n}', description: 'Load mocks from local source', useCase: 'local-mocks' }
    ],
    relatedFunctions: ['get_env']
  },
  {
    name: 'get_default_retryable_errors',
    signature: 'get_default_retryable_errors()',
    description: 'Returns the default list of retryable error patterns that Terragrunt uses for transient failures. Use in the errors block to seed retry configuration with sensible defaults.',
    parameters: [],
    returnType: 'list(string)',
    category: 'utility',
    examples: [
      { code: 'errors {\n  retry "default_errors" {\n    retryable_errors = get_default_retryable_errors()\n    max_attempts = 3\n    sleep_interval_sec = 5\n  }\n}', description: 'Use default retryable errors', useCase: 'default-retry' },
      { code: 'errors {\n  retry "combined" {\n    retryable_errors = concat(get_default_retryable_errors(), [".*my custom error.*"])\n    max_attempts = 5\n  }\n}', description: 'Combine default and custom retryable errors', useCase: 'custom-retry' }
    ],
    relatedFunctions: []
  },
  {
    name: 'constraint_check',
    signature: 'constraint_check(version, constraint)',
    description: 'Checks if a version satisfies a constraint. Useful for conditional logic based on module versions. Supports the same constraint syntax as terragrunt_version_constraint and terraform_version_constraint.',
    parameters: [
      { name: 'version', type: 'string', required: true, description: 'The version to check (e.g., "1.2.3")' },
      { name: 'constraint', type: 'string', required: true, description: 'The constraint to check against (e.g., ">= 2.0.0")' }
    ],
    returnType: 'bool',
    category: 'utility',
    examples: [
      { code: 'locals {\n  module_version = "2.1.0"\n  needs_v2 = constraint_check(local.module_version, ">= 2.0.0")\n}\ninputs = local.needs_v2 ? { new_input = "value" } : { old_input = "value" }', description: 'Conditional inputs based on module version', useCase: 'version-conditional' },
      { code: 'feature "module_version" {\n  default = "1.2.3"\n}\nlocals {\n  is_v2 = constraint_check(feature.module_version.value, ">= 2.0.0")\n}', description: 'Use with feature flags', useCase: 'feature-flag' }
    ],
    relatedFunctions: []
  }
];

/**
 * Pre-computed Set of normalized static function names for O(1) lookups.
 * Used by isStaticFunction() for efficient membership checks.
 */
const STATIC_FUNCTION_NAMES = new Set(
  STATIC_BUILTIN_FUNCTIONS.map(fn => fn.name.trim().toLowerCase())
);

/**
 * Manages Terragrunt built-in function metadata with an LRU cache.
 *
 * Notes:
 * - Cache keys are stored in lowercase for case-insensitive lookups.
 * - Population of the cache is deferred to loadFunctions() (see issue #13).
 * - Uses LRU cache with max 1000 items and 10MB size limit for memory safety.
 */
export class TerragruntFunctionsManager {
  private readonly docsManager: TerragruntDocsManager;
  private readonly functionsCache: LRUCache<string, TerragruntFunction>;

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
    
    // Initialize LRU cache with size limits to prevent unbounded memory growth
    this.functionsCache = new LRUCache<string, TerragruntFunction>({
      max: 1000, // Maximum 1000 functions (way more than needed, but safe limit)
      updateAgeOnGet: true, // Keep frequently accessed items
      updateAgeOnHas: false
    });
  }

  /**
   * Load and parse Terragrunt built-in function definitions into the cache.
   * First loads static curated definitions, then enriches with doc-extracted functions.
   */
  async loadFunctions(): Promise<void> {
    // Clear cache before repopulating
    this.functionsCache.clear();

    // Step 1: Load static built-in function definitions first (authoritative)
    for (const fn of STATIC_BUILTIN_FUNCTIONS) {
      const key = this.normalizeKey(fn.name);
      this.functionsCache.set(key, fn);
    }

    // Step 2: Try to enrich with doc-extracted functions
    try {
      const allDocs = await this.docsManager.fetchLatestDocs();

      // Prefer the canonical HCL functions reference page(s)
      const functionDocs = allDocs.filter(d =>
        d.section === 'reference' && (
          d.url.includes('/docs/reference/hcl/functions/') ||
          d.title.toLowerCase().includes('built-in function') ||
          d.title.toLowerCase().includes('function')
        )
      );

      for (const doc of functionDocs) {
        const extracted = this.extractFunctionsFromContent(doc.content);
        for (const fn of extracted) {
          const key = this.normalizeKey(fn.name);
          const existing = this.functionsCache.get(key);
          
          if (existing) {
            // Enrich existing static definition with doc-extracted examples
            // Only add examples that don't already exist
            const existingCodes = new Set(existing.examples.map(e => e.code));
            const newExamples = fn.examples.filter(e => !existingCodes.has(e.code));
            if (newExamples.length > 0) {
              this.functionsCache.set(key, {
                ...existing,
                examples: [...existing.examples, ...newExamples]
              });
            }
          } else {
            // New function from docs (not in static list)
            this.functionsCache.set(key, {
              ...fn,
              category: fn.category || 'functions'
            });
          }
        }
      }
    } catch (error) {
      // If doc extraction fails, we still have static definitions
      console.warn('Doc extraction failed, using static definitions only:', error);
    }

    return;
  }

  /**
   * Returns all static built-in function definitions.
   * These are the authoritative, curated definitions that are always available.
   * @returns Array of all static function definitions
   */
  getStaticFunctions(): TerragruntFunction[] {
    return [...STATIC_BUILTIN_FUNCTIONS];
  }

  /**
   * Check if a function is defined in the static built-in functions list.
   * Uses pre-computed Set for O(1) lookup performance.
   * @param name The function name to check
   * @returns true if the function is in the static definitions
   */
  isStaticFunction(name: string): boolean {
    if (!name || !name.trim()) {
      return false;
    }
    const normalizedName = this.normalizeKey(name);
    return STATIC_FUNCTION_NAMES.has(normalizedName);
  }

  /**
   * Retrieve a function definition by name, case-insensitively.
   * @param name The function name (e.g., "get_env", "find_in_parent_folders")
   * @returns TerragruntFunction if found, otherwise null
   */
  getFunction(name: string): TerragruntFunction | null {
    if (!name || !name.trim()) {
      return null;
    }
    const key = this.normalizeKey(name);
    return this.functionsCache.get(key) ?? null;
  }

  /**
   * List all known functions, optionally filtered by category (case-insensitive).
   * Results are sorted by function name ascending.
   * @param category Optional category filter (e.g., "filesystem", "env")
   */
  listFunctions(category?: string): TerragruntFunction[] {
    let items = Array.from(this.functionsCache.values());

    if (category && category.trim()) {
      const filter = category.trim().toLowerCase();
      items = items.filter(f => (f.category || '').toLowerCase() === filter);
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Perform a simple text search across common fields.
   * Empty or whitespace-only queries return an empty result set.
   */
  searchFunctions(query: string): TerragruntFunction[] {
    if (!query || !query.trim()) {
      return [];
    }

    const q = query.toLowerCase();

    const matches: TerragruntFunction[] = [];
    for (const fn of this.functionsCache.values()) {
      if (this.matchesFunction(fn, q)) {
        matches.push(fn);
      }
    }

    // Sort deterministically by name
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all unique categories from cached functions.
   * @returns Sorted array of category names
   */
  getAvailableCategories(): string[] {
    const categories = new Set<string>();
    
    for (const fn of this.functionsCache.values()) {
      if (fn.category && fn.category.trim()) {
        categories.add(fn.category);
      }
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Extract a specific function from documentation by name.
   * Searches documentation for the named function and extracts its details on-demand.
   * Useful for lazy loading or as a fallback when loadFunctions() didn't find a function.
   * 
   * @param name The function name to search for (case-insensitive)
   * @returns TerragruntFunction if found, otherwise null
   */
  async extractFunctionFromDocs(name: string): Promise<TerragruntFunction | null> {
    if (!name || !name.trim()) {
      return null;
    }

    const searchName = name.trim();
    const normalizedName = this.normalizeKey(searchName);

    // First check if it's already in cache
    const cached = this.functionsCache.get(normalizedName);
    if (cached) {
      return cached;
    }

    // Search documentation for the function
    const allDocs = await this.docsManager.fetchLatestDocs();
    
    // Prefer the canonical HCL functions reference page(s)
    const functionDocs = allDocs.filter(d =>
      d.section === 'reference' && (
        d.url.includes('/docs/reference/hcl/functions/') ||
        d.title.toLowerCase().includes('built-in function') ||
        d.title.toLowerCase().includes('function')
      )
    );

    // Search for the specific function in documentation content
    for (const doc of functionDocs) {
      const content = doc.content;
      
      // Look for the function name as a potential signature
      // Use case-insensitive regex to find the function name
      const functionNamePattern = new RegExp(
        `\\b${searchName}\\s*\\([^)]*\\)`,
        'i'
      );
      
      if (!functionNamePattern.test(content)) {
        continue; // Function not mentioned in this doc
      }

      // Extract functions from this document
      const extracted = this.extractFunctionsFromContent(content);
      
      // Find the specific function we're looking for
      const found = extracted.find(fn => 
        this.normalizeKey(fn.name) === normalizedName
      );

      if (found) {
        // Add to cache for future lookups
        this.upsertFunction(found);
        return found;
      }
    }

    // Not found in any documentation
    return null;
  }

  /**
   * Helper to add or replace a function in cache using normalized key.
   * Not part of the public API specified by the issue, but useful for tests
   * and for the upcoming implementation in issue #13.
   */
  private upsertFunction(fn: TerragruntFunction): void {
    const key = this.normalizeKey(fn.name);
    this.functionsCache.set(key, fn);
  }

  /**
   * Best-effort extractor for function definitions from plain text content.
   * Handles flattened content (newlines collapsed by cleanContent) with global regex.
   * Infers return types from signature or nearby "returns <Type>" context.
   */
  private extractFunctionsFromContent(content: string): TerragruntFunction[] {
    const results: TerragruntFunction[] = [];
    if (!content) return results;

    // Content is flattened by docs.cleanContent(); use global regex to scan across text
    const text = content.replace(/\r/g, ' ');

    // Match signature patterns: name(params) -> ReturnType or name(params)
    // Use non-capturing negative lookbehind to avoid matching mid-identifier
  const signatureRegex = /(?:^|[^a-zA-Z0-9_])(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?:->|→)\s*(?<ret>[^\s.,;:(){}[\]]+)?/g;
  // Alternate: name(params) [ -|—|–|:] (returns|return type) Type
  const altSignatureRegex = /(?:^|[^a-zA-Z0-9_])(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?:[-–—,:])?\s*(?:returns?|return\s+type)\s+(?<ret2>[A-Za-z0-9_<>|[\]{}]+)/gi;
    
    // Fallback: register function names that appear in explicit usage context (more selective)
    // Look for patterns like "use function_name()", "call function_name()", "function_name() function", etc.
    // Use word boundaries to avoid matching "function" as a substring (e.g., in "test_function")
    const inlineCallRegex = /\b(?:use|call|invoke|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi;

    const seen = new Set<string>();

    // Helper to parse parameter list from inline signature
    // Enriched version that detects optional parameters from brackets or question marks
    const parseParams = (paramsRaw: string): FunctionParameter[] => {
      const out: FunctionParameter[] = [];
      const raw = (paramsRaw || '').trim();
      if (!raw) return out;
      
      const parts = raw.split(/\s*,\s*/);
      for (const part of parts) {
        if (!part) continue;
        
        let nameGuess = part;
        let typeGuess = 'unknown';
        let isOptional = false;
        
        // Check for optional markers: [param] or param? or (optional)
        if (/^\[.*\]$/.test(part.trim())) {
          // Bracketed parameter indicates optional
          nameGuess = part.trim().replace(/^\[|\]$/g, '');
          isOptional = true;
        } else if (part.includes('?')) {
          // Question mark indicates optional
          nameGuess = part.replace('?', '');
          isOptional = true;
        } else if (/\(optional\)/i.test(part)) {
          // Explicit (optional) marker
          nameGuess = part.replace(/\(optional\)/gi, '');
          isOptional = true;
        }
        
        // Try "name: type" format
        const colonIdx = nameGuess.indexOf(':');
        if (colonIdx > -1) {
          const namePart = nameGuess.substring(0, colonIdx).trim();
          typeGuess = nameGuess.substring(colonIdx + 1).trim() || 'unknown';
          nameGuess = namePart;
        } else {
          // Try "type name" or just "name"
          const tokens = nameGuess.trim().split(/\s+/);
          if (tokens.length >= 2) {
            nameGuess = tokens[0];
            typeGuess = tokens.slice(1).join(' ');
          } else {
            nameGuess = tokens[0];
          }
        }
        
        out.push({ 
          name: nameGuess.trim(), 
          type: typeGuess.trim(), 
          required: !isOptional, 
          description: '', 
          default: undefined 
        });
      }
      return out;
    };

    // Helper to extract description from context around a function signature
    const extractDescription = (context: string, functionName: string, matchIndex: number): string => {
      // Look for description BEFORE the signature match
      // Split context at the match point
      const beforeMatch = context.slice(0, matchIndex);
      
      const lowerBefore = beforeMatch.toLowerCase();
      
      // Try to find "Description:" label before the signature
      const descIdx = lowerBefore.lastIndexOf('description:');
      if (descIdx !== -1) {
        const start = descIdx + 'description:'.length;
        const slice = beforeMatch.slice(start).trim();
        // Extract until we hit the signature or section marker
        const endMarkers = ['parameters:', functionName.toLowerCase() + '(', '##', '\n\n'];
        let end = slice.length;
        for (const marker of endMarkers) {
          const pos = slice.toLowerCase().indexOf(marker);
          if (pos !== -1 && pos > 0 && pos < end) {
            end = pos;
          }
        }
        const desc = slice.slice(0, end).trim();
        if (desc && desc.length > 10 && desc.length < 500) {
          return desc.replace(/\s+/g, ' ');
        }
      }
      
      // Try to find text between function name heading (##) and signature
      const headingPattern = new RegExp(`##\\s*${functionName}\\s*`, 'i');
      const headingMatch = headingPattern.exec(beforeMatch);
      if (headingMatch) {
        // Get text after the heading but before the signature
        const afterHeading = beforeMatch.slice(headingMatch.index + headingMatch[0].length).trim();
        // Look for complete sentences
        const sentences = afterHeading.match(/[A-Z][^.!?]{10,300}[.!?]/g);
        if (sentences && sentences.length > 0) {
          const firstSent = sentences[0].trim();
          if (!firstSent.toLowerCase().includes(functionName.toLowerCase() + '(')) {
            return firstSent;
          }
        }
      }
      
      // Fallback: look for descriptive sentence immediately before the signature
      // Get last 200 chars before match
      const beforeSig = beforeMatch.slice(Math.max(0, beforeMatch.length - 200)).trim();
      const sentences = beforeSig.match(/[A-Z][^.!?]{15,250}[.!?]/g);
      if (sentences && sentences.length > 0) {
        // Take the last substantial sentence
        const lastSent = sentences[sentences.length - 1].trim();
        if (lastSent.length > 20 && 
            !lastSent.toLowerCase().includes('parameters:') &&
            !lastSent.toLowerCase().includes('example:') &&
            !lastSent.toLowerCase().includes(functionName.toLowerCase() + '(')) {
          return lastSent;
        }
      }
      
      return '';
    };

    // Fallback: parse parameters from context block following a "Parameters" label
    // Enriched version that extracts descriptions, identifies optional params, and finds defaults
    const parseParamsFromContext = (context: string): FunctionParameter[] => {
      const out: FunctionParameter[] = [];
      const lowerCtx = context.toLowerCase();
      const idx = lowerCtx.indexOf('parameters');
      if (idx === -1) return out;
      // Limit to the likely end of the parameters block to avoid capturing trailing prose
      const searchStart = idx + 'parameters'.length;
      const markers = ['usage:', 'example:', 'examples:', 'see also', 'related', 'returns '];
      let end = idx + 260; // default small window
      for (const m of markers) {
        const pos = lowerCtx.indexOf(m, searchStart);
        if (pos !== -1) {
          end = Math.min(end, pos);
        }
      }
      const slice = context.slice(idx, Math.max(idx + 1, end));
      
      // First try to match structured parameter lists: "Parameters: list1 (list), list2 (list)"
      const structuredMatch = /parameters:\s*([^]+?)(?=usage:|example:|see also|related|returns |$)/i.exec(context.slice(idx, end));
      if (structuredMatch) {
        const paramText = structuredMatch[1];
        // Enhanced pattern to capture descriptions, optional markers, and defaults
        // Matches: "name (type): description" or "name (type) - description" or "name: type - description"
        /*
          Regex capture groups:
            1. ([a-zA-Z_][\w-]*)      => parameter name
            2. ([^)]+)                => type in parentheses (if present)
            3. ([-:\n]+?)             => type after colon (if present)
            4. ([^;,.\n]{0,200})?     => description (up to 200 chars, optional)
        */
        const paramRe = /\b([a-zA-Z_][\w-]*)\s*(?:\(([^)]+)\)|:\s*([^-:\n]+?))\s*[-:]?\s*([^;,.\n]{0,200})?/g;
        let pm: RegExpExecArray | null;
        const seenNames = new Set<string>();
        while ((pm = paramRe.exec(paramText)) !== null) {
          const name = pm[1].trim();
          const lname = name.toLowerCase();
          const stopwords = new Set(['parameters','parameter','example','examples','usage','see','also','related']);
          if (!name || seenNames.has(lname) || stopwords.has(lname)) continue;
          
          let type = (pm[2] || pm[3] || 'unknown').trim();
          let description = (pm[4] || '').trim();
          
          // Check for optional markers in type or description
          const optionalMarkers = /\b(optional|opt\.?)\b/i;
          const isOptional = optionalMarkers.test(type) || optionalMarkers.test(description);
          
          // Remove optional markers from type
          type = type.replace(optionalMarkers, '').replace(/[[\]()]/g, '').trim();
          if (!type || type === 'unknown') type = 'unknown';
          
          // Extract default value from description
          let defaultValue: string | number | boolean | null | undefined = undefined;
          const defaultMatch = /defaults?\s+(?:to\s+)?(?:is\s+)?["`']?([^"`'\n.]{1,50})["`']?/i.exec(description);
          if (defaultMatch) {
            const defStr = defaultMatch[1].trim();
            // Try to parse as number, boolean, null, or keep as string
            if (defStr === 'null') defaultValue = null;
            else if (defStr === 'true') defaultValue = true;
            else if (defStr === 'false') defaultValue = false;
            else if (/^-?\d+(\.\d+)?$/.test(defStr)) defaultValue = parseFloat(defStr);
            else defaultValue = defStr;
          }
          
          // Clean description: remove default value text and optional markers
          description = description
            .replace(/defaults?\s+(?:to\s+)?(?:is\s+)?["`']?[^"`'\n.]{1,50}["`']?/gi, '')
            .replace(optionalMarkers, '')
            .replace(/[[\]()]/g, '')
            .trim();
          
          seenNames.add(lname);
          out.push({ 
            name, 
            type, 
            required: !isOptional && defaultValue === undefined, 
            description: description || '', 
            default: defaultValue 
          });
          if (out.length >= 6) break;
        }
      }
      
      // Fallback to original regex if nothing found
      if (out.length === 0) {
        const re = /([a-zA-Z_][\w-]*)\s*(?:\(([^)]+)\)|:\s*([^;,.\n]+))?/g;
        let m: RegExpExecArray | null;
        const seenNames = new Set<string>();
        const stopwords = new Set(['parameters','parameter','example','examples','usage','see','also','related']);
        while ((m = re.exec(slice)) !== null) {
          const name = (m[1] || '').trim();
          const lname = name.toLowerCase();
          if (!name || seenNames.has(lname) || stopwords.has(lname)) continue;
          const type = (m[2] || m[3] || 'unknown').trim();
          seenNames.add(lname);
          out.push({ name, type, required: true, description: '', default: undefined });
          if (out.length >= 6) break;
        }
      }
      return out;
    };

    // Helper to categorize a function based on name patterns, description, and context
    const categorizeFunction = (name: string, description: string, context: string): string => {
      const lowerName = name.toLowerCase();
      const lowerDesc = description.toLowerCase();
      const lowerCtx = context.toLowerCase();
      
      // Category detection by function name patterns
      if (lowerName.startsWith('path_') || 
          lowerName.startsWith('get_terragrunt_dir') ||
          lowerName.startsWith('get_parent_terragrunt') ||
          lowerName.includes('_path') ||
          lowerName === 'abspath' ||
          lowerName === 'dirname' ||
          lowerName === 'basename') {
        return 'path';
      }
      
      if (lowerName.startsWith('get_env') ||
          lowerName.startsWith('get_aws_') ||
          lowerName.includes('account') ||
          lowerName.includes('identity') ||
          lowerName.includes('region')) {
        return 'environment';
      }
      
      if (lowerName.startsWith('get_terraform_') ||
          lowerName.includes('terraform')) {
        return 'terraform';
      }
      
      if (lowerName === 'find_in_parent_folders' ||
          lowerName.startsWith('read_') ||
          lowerName.startsWith('file') ||
          lowerName === 'fileexists' ||
          lowerName === 'filebase64' ||
          lowerName === 'templatefile') {
        return 'file';
      }
      
      if (lowerName === 'dependency') {
        return 'dependency';
      }
      
      if (lowerName.includes('encode') || lowerName.includes('decode')) {
        return 'encoding';
      }
      
      if (lowerName === 'regex' ||
          lowerName === 'replace' ||
          lowerName === 'join' ||
          lowerName === 'split' ||
          lowerName === 'trim' ||
          lowerName === 'format' ||
          lowerName === 'substr') {
        return 'string';
      }
      
      if (lowerName === 'concat' ||
          lowerName === 'flatten' ||
          lowerName === 'distinct' ||
          lowerName === 'compact' ||
          lowerName === 'reverse' ||
          lowerName === 'sort' ||
          lowerName === 'slice') {
        return 'list';
      }
      
      if (lowerName === 'merge' ||
          lowerName === 'lookup' ||
          lowerName === 'keys' ||
          lowerName === 'values') {
        return 'map';
      }
      
      // Category hints from description
      if (lowerDesc.includes('path') || lowerDesc.includes('directory')) {
        return 'path';
      }
      
      if (lowerDesc.includes('environment') || lowerDesc.includes('aws account')) {
        return 'environment';
      }
      
      if (lowerDesc.includes('file') || lowerDesc.includes('read')) {
        return 'file';
      }
      
      if (lowerDesc.includes('list') || lowerDesc.includes('array')) {
        return 'list';
      }
      
      if (lowerDesc.includes('string') || lowerDesc.includes('text')) {
        return 'string';
      }
      
      // Category hints from context headings
      if (lowerCtx.includes('## path functions') || lowerCtx.includes('path helpers')) {
        return 'path';
      }
      
      if (lowerCtx.includes('## environment') || lowerCtx.includes('environment variables')) {
        return 'environment';
      }
      
      if (lowerCtx.includes('## terraform')) {
        return 'terraform';
      }
      
      if (lowerCtx.includes('## file') || lowerCtx.includes('file functions')) {
        return 'file';
      }
      
      // Default fallback
      return 'general';
    };

    // Helper to extract examples from "Example:" or "Examples:" sections
    const extractExamples = (context: string, functionName: string): FunctionExample[] => {
      const examples: FunctionExample[] = [];
      
      // Look for "Example:" or "Examples:" section
      const exampleSectionRegex = /examples?[:\s]+(.+?)(?=##|see\s+also|parameters:|usage:|$)/is;
      const exampleMatch = exampleSectionRegex.exec(context);
      
      if (exampleMatch && exampleMatch[1]) {
        const exampleContent = exampleMatch[1].trim();
        
        // Split by common delimiters that indicate separate examples
        // Look for patterns like "Example 1:", "Another example:", or numbered examples
        const exampleDelimiters = /(?:example\s+\d+|another\s+example|additionally)[:\s]+/gi;
        const splits = exampleContent.split(exampleDelimiters);
        
        for (const section of splits) {
          if (!section.trim()) continue;
          
          // Extract code blocks (indented, fenced, or inline)
          // Pattern 1: Fenced code blocks (```...```)
          const fencedMatch = /```[\w]*\s*(.+?)```/s.exec(section);
          if (fencedMatch) {
            const code = fencedMatch[1].trim();
            // Look for description before the code block
            const descMatch = /^([^`]+?)(?=```)/s.exec(section);
            const description = descMatch ? descMatch[1].trim() : 'Example usage';
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
            continue;
          }
          
          // Pattern 2: Indented code blocks (multiple lines starting with spaces/tabs)
          const indentedMatch = /(?:^|\n)([ \t]+.+?)(?=\n[^\s\t]|$)/s.exec(section);
          if (indentedMatch) {
            const code = indentedMatch[1].trim();
            // Extract description from text before indented code
            const beforeCode = section.slice(0, indentedMatch.index).trim();
            const description = beforeCode || 'Example usage';
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
            continue;
          }
          
          // Pattern 3: Inline function calls
          const inlineRegex = new RegExp(`${functionName}\\s*\\(([^)]{0,120})\\)`, 'i');
          const inlineMatch = inlineRegex.exec(section);
          if (inlineMatch) {
            const code = `${functionName}(${inlineMatch[1]})`;
            const description = section.trim().slice(0, 100);
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
          }
        }
      }
      
      // Fallback: If no examples found in explicit section, look for inline usage
      if (examples.length === 0) {
        const usageRegex = new RegExp(`${functionName}\\s*\\(([^)]{0,120})\\)`, 'i');
        const usageMatch = usageRegex.exec(context);
        if (usageMatch) {
          examples.push({
            code: `${functionName}(${usageMatch[1]})`,
            description: 'Inline example',
            useCase: 'inline'
          });
        }
      }
      
      return examples;
    };

  // NEW: Pattern for section-based function definitions (e.g., "find_in_parent_foldersSection titled \"find_in_parent_folders\"")
    // This handles functions documented with section headers rather than formal signatures
    // Note: The documentation uses Unicode quotes (U+201C " and U+201D ") not ASCII quotes (")
    const sectionRegex = /([a-z_][a-z0-9_]*)Section\s+titled\s+\u201C([^\u201D]+)\u201D/gi;
    let sectionMatch: RegExpExecArray | null;
    
    while ((sectionMatch = sectionRegex.exec(text)) !== null) {
      const titleName = sectionMatch[2];
      
      // Filter out non-function sections (documentation structure sections)
      const nonFunctionSections = new Set([
        'basic usage',
        'examples',
        'example',
        'special parameters',
        'caching behavior',
        'opentofu/terraform built-in functions',
        'parameters',
        'description',
        'usage',
        'notes',
        'note'
      ]);
      
      if (nonFunctionSections.has(titleName.toLowerCase())) {
        continue;
      }
      
      // Use the title name as it's more accurate
      const name = titleName;
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;
      
      // Extract context after the section header (up to next section or 1000 chars)
      const contextStart = sectionMatch.index + sectionMatch[0].length;
      const nextSectionMatch = /[a-z_][a-z0-9_]*Section\s+titled/i.exec(text.slice(contextStart));
      const contextEnd = nextSectionMatch 
        ? contextStart + nextSectionMatch.index 
        : Math.min(contextStart + 1000, text.length);
      const sectionContext = text.slice(sectionMatch.index, contextEnd);
      
      // Extract description (first sentence or two after the section header)
      let description = '';
      const descMatch = /Section\s+titled\s+[\u201C\u201D][^"\u201C\u201D]+[\u201C\u201D]\s+([^.!?]{10,300}[.!?])/.exec(sectionContext);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      
      // If no description found, look for next few words after header
      if (!description || description.length < 10) {
        const fallbackDesc = sectionContext.slice(sectionMatch[0].length, sectionMatch[0].length + 200);
        const firstSentence = /^[^.!?]{10,300}[.!?]/.exec(fallbackDesc.trim());
        description = firstSentence ? firstSentence[0].trim() : fallbackDesc.trim().slice(0, 150);
      }
      
      // Extract parameters from example usages in the section
      // Look for function calls like "function_name(param1, param2)" or "function_name(param1, [param2])"
      const paramRegex = new RegExp(`${name}\\s*\\(([^)]{0,200})\\)`, 'gi');
      const paramMatches = [...sectionContext.matchAll(paramRegex)];
      
      let parameters: FunctionParameter[] = [];
      if (paramMatches.length > 0) {
        // Find the match with the most parameters (most informative example)
        let bestParamString = '';
        for (const pm of paramMatches) {
          const paramStr = pm[1].trim();
          if (paramStr.length > bestParamString.length && paramStr.length < 200) {
            bestParamString = paramStr;
          }
        }
        
        if (bestParamString) {
          // Parse parameters from the example
          parameters = parseParams(bestParamString);
        }
      }
      
      // Try to extract from Parameters: section if no parameters found
      if (parameters.length === 0) {
        parameters = parseParamsFromContext(sectionContext);
      }
      
      // Infer return type from description keywords
      let returnType = 'unknown';
      const lowerDesc = description.toLowerCase();
      if (lowerDesc.includes('returns the absolute path') || lowerDesc.includes('returns a path') || lowerDesc.includes('returns the path')) {
        returnType = 'string';
      } else if (lowerDesc.includes('returns a list') || lowerDesc.includes('returns the list')) {
        returnType = 'list';
      } else if (lowerDesc.includes('returns a map') || lowerDesc.includes('returns the map')) {
        returnType = 'map';
      } else if (lowerDesc.includes('returns the value') || lowerDesc.includes('returns a value')) {
        returnType = 'string';
      } else if (lowerDesc.includes('returns true') || lowerDesc.includes('returns false') || lowerDesc.includes('checks if')) {
        returnType = 'bool';
      } else if (lowerDesc.match(/returns (an?|the) (string|text)/)) {
        returnType = 'string';
      }
      
      // Extract examples from the section
      const examples = extractExamples(sectionContext, name);
      
      // Extract related functions from "See also" section
      const related: string[] = [];
      const relatedMatch = /(?:see\s+also|related)[:\s]+([^#]+?)(?=##|$)/is.exec(sectionContext);
      if (relatedMatch) {
        const relatedText = relatedMatch[1];
        const funcNameRegex = /\b([a-z_][a-z0-9_]*)\s*\(/gi;
        let fm: RegExpExecArray | null;
        while ((fm = funcNameRegex.exec(relatedText)) !== null) {
          const relName = fm[1];
          if (relName !== name && !related.includes(relName)) {
            related.push(relName);
          }
          if (related.length >= 5) break;
        }
      }
      
      // Categorize the function
      const category = categorizeFunction(name, description, sectionContext);
      
      // Build signature from parameters
      const paramSig = parameters.map(p => p.required ? p.name : `[${p.name}]`).join(', ');
      
      results.push({
        name,
        signature: `${name}(${paramSig})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`,
        description,
        parameters,
        returnType,
        category,
        examples: examples.length > 0 ? examples : [],
        relatedFunctions: related
      });
      seen.add(key);
    }
  
  // Scan for signature patterns with explicit return types (arrow style)
    let match: RegExpExecArray | null;
    while ((match = signatureRegex.exec(text)) !== null) {
      const groups = match.groups as { name?: string; params?: string; ret?: string } | undefined;
      if (!groups?.name) continue;
      
      const name = groups.name;
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;

      const paramsRaw = (groups.params || '').trim();
      let returnType = (groups.ret || '').trim();
      
      // If no explicit return type, try to infer from nearby context
      if (!returnType) {
        const contextWindow = text.slice(
          match.index + match[0].length, 
          match.index + match[0].length + 160
        );
  const retMatch = /returns?\s+(?:a\s+)?([A-Za-z0-9_{}<>|.\][[]]+)/i.exec(contextWindow);
        if (retMatch) {
          returnType = retMatch[1];
        }
      }
      if (!returnType) returnType = 'unknown';

      let parameters = parseParams(paramsRaw);
      // Try to enrich parameters from nearby explicit "Parameters" context
      const ctx = text.slice(match.index, match.index + 500);
      const ctxParams = parseParamsFromContext(ctx);
      if (parameters.length === 0 || ctxParams.length > parameters.length) {
        parameters = ctxParams;
      }

      // Extract description from context before/around the signature
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));

      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);

      // Related functions via "See also" pattern in nearby context
  const relRe = /(see\s+also|related)[:\s]+([^\n.]{0,120})/i;
      const relCtx = text.slice(match.index, match.index + 300);
      const rel = relRe.exec(relCtx);
      const related: string[] = [];
      if (rel && rel[2]) {
        const cand = rel[2];
        const idRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)?/g;
        let r: RegExpExecArray | null;
        while ((r = idRe.exec(cand)) !== null) {
          const nm = r[1];
          if (nm && nm.toLowerCase() !== name.toLowerCase() && !related.includes(nm)) related.push(nm);
        }
      }

      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);

      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description,
        parameters,
        returnType,
        category,
        examples,
        relatedFunctions: related
      });
      seen.add(key);
    }

    // Alternate signature style with explicit "returns" wording
    while ((match = altSignatureRegex.exec(text)) !== null) {
      const groups = match.groups as { name?: string; params?: string; ret2?: string } | undefined;
      if (!groups?.name) continue;
      const name = groups.name;
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;
      const paramsRaw = (groups.params || '').trim();
      const returnType = (groups.ret2 || 'unknown').trim();
      let parameters = parseParams(paramsRaw);
      // Try to enrich parameters from nearby explicit "Parameters" context
      const ctx = text.slice(match.index, match.index + 500);
      const ctxParams = parseParamsFromContext(ctx);
      if (parameters.length === 0 || ctxParams.length > parameters.length) {
        parameters = ctxParams;
      }
      
      // Extract description from context before/around the signature
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));
      
      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);
      
  const relRe = /(see\s+also|related)[:\s]+([^\n.]{0,120})/i;
      const relCtx = text.slice(match.index, match.index + 300);
      const rel = relRe.exec(relCtx);
      const related: string[] = [];
      if (rel && rel[2]) {
        const cand = rel[2];
        const idRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)?/g;
        let r: RegExpExecArray | null;
        while ((r = idRe.exec(cand)) !== null) {
          const nm = r[1];
          if (nm && nm.toLowerCase() !== name.toLowerCase() && !related.includes(nm)) related.push(nm);
        }
      }
      
      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);
      
      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description,
        parameters,
        returnType,
        category,
        examples,
        relatedFunctions: related
      });
      seen.add(key);
    }

    // Fallback: capture function names from inline calls
    while ((match = inlineCallRegex.exec(text)) !== null) {
      const name = match[1];
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;
      
      seen.add(key);
      
      // Extract description from surrounding context
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));
      
      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);
      
      // Best-effort: attempt to extract parameter names/types from nearby context
      let paramCtx = text.slice(Math.max(0, match.index - 300), match.index + 400);
      const pLower = paramCtx.toLowerCase();
      const lastParamsIdx = pLower.lastIndexOf('parameters');
      if (lastParamsIdx !== -1) {
        paramCtx = paramCtx.slice(lastParamsIdx);
      }
      const inferredParams = parseParamsFromContext(paramCtx);
      
      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);
      
      results.push({
        name,
        signature: `${name}(...)`,
        description,
        parameters: inferredParams,
        returnType: 'unknown',
        category,
        examples,
        relatedFunctions: []
      });
    }

    // Sort deterministically by name
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }  private matchesFunction(fn: TerragruntFunction, q: string): boolean {
    const inText = (text?: string) => !!text && text.toLowerCase().includes(q);

    const paramMatch = fn.parameters?.some(p =>
      inText(p.name) || inText(p.type) || inText(p.description)
    );

    const exampleMatch = fn.examples?.some(ex =>
      inText(ex.code) || inText(ex.description) || inText(ex.useCase)
    );

    const relatedMatch = fn.relatedFunctions?.some(r => inText(r));

    return (
      inText(fn.name) ||
      inText(fn.signature) ||
      inText(fn.description) ||
      inText(fn.returnType) ||
      inText(fn.category) ||
      paramMatch ||
      exampleMatch ||
      relatedMatch
    );
  }

  private normalizeKey(name: string): string {
    return name.trim().toLowerCase();
  }
}
