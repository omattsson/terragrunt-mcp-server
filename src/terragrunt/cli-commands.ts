/**
 * CLI Commands Manager for Terragrunt MCP Server
 * 
 * Provides comprehensive CLI command documentation with structured data
 * for all Terragrunt commands, options, usage patterns, and examples.
 */

import type {
  CLICommand,
  CLIOption,
  CLICommandCategory,
  CLICommandSearchResult,
  CLICommandCategoryInfo,
} from '../types/cli-commands.js';

/**
 * Manager for Terragrunt CLI command documentation
 */
export class CLICommandsManager {
  private commands: Map<string, CLICommand> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private initialized = false;

  constructor() {
    this.initializeCommands();
  }

  /**
   * Initialize all command definitions
   */
  private initializeCommands(): void {
    if (this.initialized) return;

    const commandDefinitions = this.getCommandDefinitions();
    
    for (const cmd of commandDefinitions) {
      // Store by primary name (normalized)
      const normalizedName = this.normalizeCommandName(cmd.name);
      this.commands.set(normalizedName, cmd);
      
      // Map aliases to primary name
      for (const alias of cmd.aliases) {
        this.aliasMap.set(this.normalizeCommandName(alias), normalizedName);
      }
      for (const legacyName of cmd.legacyNames ?? []) {
        this.aliasMap.set(this.normalizeCommandName(legacyName), normalizedName);
      }
    }

    this.initialized = true;
  }

  /**
   * Normalize a command name for lookup
   */
  private normalizeCommandName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get a command by name or alias
   */
  getCommand(name: string): CLICommand | null {
    const normalized = this.normalizeCommandName(name);
    
    // Check direct match
    if (this.commands.has(normalized)) {
      return this.commands.get(normalized) || null;
    }
    
    // Check alias
    const primaryName = this.aliasMap.get(normalized);
    if (primaryName) {
      return this.commands.get(primaryName) || null;
    }

    return null;
  }

  /**
   * Search for commands matching a query
   */
  searchCommands(query: string): CLICommandSearchResult[] {
    const results: CLICommandSearchResult[] = [];
    const normalized = this.normalizeCommandName(query);

    for (const [name, cmd] of this.commands) {
      // Exact match
      if (name === normalized) {
        results.push({ command: cmd, score: 1.0, matchType: 'exact' });
        continue;
      }

      // Alias match
      if (cmd.aliases.some(alias => this.normalizeCommandName(alias) === normalized)) {
        results.push({ command: cmd, score: 0.95, matchType: 'alias' });
        continue;
      }

      if (cmd.legacyNames?.some(name => this.normalizeCommandName(name) === normalized)) {
        results.push({ command: cmd, score: 0.9, matchType: 'legacy' });
        continue;
      }

      // Partial match in name
      if (name.includes(normalized) || normalized.includes(name)) {
        results.push({ command: cmd, score: 0.7, matchType: 'partial' });
        continue;
      }

      // Fuzzy match in description
      if (cmd.description.toLowerCase().includes(normalized)) {
        results.push({ command: cmd, score: 0.5, matchType: 'fuzzy' });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Remove duplicates (keep highest score)
    const seen = new Set<string>();
    return results.filter(r => {
      const name = r.command.name;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  /**
   * Get all commands
   */
  getAllCommands(): CLICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: CLICommandCategory): CLICommand[] {
    return this.getAllCommands().filter(cmd => cmd.category === category);
  }

  /**
   * Get all command categories with their commands
   */
  getCategories(): CLICommandCategoryInfo[] {
    const categoryDescriptions: Record<CLICommandCategory, { name: string; description: string }> = {
      main: {
        name: 'Main Commands',
        description: 'Primary Terragrunt commands for executing Terraform operations',
      },
      backend: {
        name: 'Backend Commands',
        description: 'Commands for managing Terraform state backends',
      },
      stack: {
        name: 'Stack Commands',
        description: 'Commands for managing multiple modules (stacks)',
      },
      catalog: {
        name: 'Catalog Commands',
        description: 'Commands for browsing and using module catalogs',
      },
      discovery: {
        name: 'Discovery Commands',
        description: 'Commands for finding and listing modules',
      },
      configuration: {
        name: 'Configuration Commands',
        description: 'Commands for working with HCL configuration',
      },
      shortcut: {
        name: 'Shortcut Commands',
        description: 'Convenience shortcuts for common Terraform commands',
      },
    };

    const categories: CLICommandCategoryInfo[] = [];
    
    for (const [id, info] of Object.entries(categoryDescriptions)) {
      const commands = this.getCommandsByCategory(id as CLICommandCategory);
      if (commands.length > 0) {
        categories.push({
          id: id as CLICommandCategory,
          name: info.name,
          description: info.description,
          commands: commands.map(c => c.name),
        });
      }
    }

    return categories;
  }

  /**
   * Format a command for display
   */
  formatCommandHelp(cmd: CLICommand): string {
    const lines: string[] = [];
    
    lines.push(`# ${cmd.name}`);
    lines.push('');
    lines.push(cmd.description);
    lines.push('');
    
    // Usage
    lines.push('## Usage');
    lines.push('```bash');
    lines.push(cmd.usage);
    lines.push('```');
    lines.push('');
    
    // Aliases
    if (cmd.aliases.length > 0) {
      lines.push('## Aliases');
      lines.push(cmd.aliases.map(a => `- \`${a}\``).join('\n'));
      lines.push('');
    }

    if (cmd.legacyNames && cmd.legacyNames.length > 0) {
      lines.push('## Removed Command Names');
      lines.push(cmd.legacyNames.map(name => `- \`${name}\``).join('\n'));
      lines.push('');
      lines.push('These names are accepted by this reference tool for migration help, but current Terragrunt does not execute them.');
      lines.push('');
    }
    
    // Details
    if (cmd.details) {
      lines.push('## Details');
      lines.push(cmd.details);
      lines.push('');
    }
    
    // Options
    if (cmd.options.length > 0) {
      lines.push('## Options');
      lines.push('');
      for (const opt of cmd.options) {
        const flags = opt.shortFlag ? `\`${opt.shortFlag}\`, \`${opt.flag}\`` : `\`${opt.flag}\``;
        lines.push(`### ${flags}`);
        lines.push(`- **Type:** ${opt.type}`);
        if (opt.defaultValue) lines.push(`- **Default:** \`${opt.defaultValue}\``);
        if (opt.envVar) lines.push(`- **Env Var:** \`${opt.envVar}\``);
        if (opt.required) lines.push(`- **Required:** Yes`);
        lines.push(`- **Description:** ${opt.description}`);
        if (opt.example) lines.push(`- **Example:** \`${opt.example}\``);
        lines.push('');
      }
    }
    
    // Examples
    if (cmd.examples.length > 0) {
      lines.push('## Examples');
      lines.push('');
      for (const ex of cmd.examples) {
        lines.push(`### ${ex.description}`);
        lines.push('```bash');
        lines.push(ex.command);
        lines.push('```');
        if (ex.output) {
          lines.push('Output:');
          lines.push('```');
          lines.push(ex.output);
          lines.push('```');
        }
        lines.push('');
      }
    }
    
    // Notes
    if (cmd.notes && cmd.notes.length > 0) {
      lines.push('## Notes');
      for (const note of cmd.notes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
    
    // Deprecation warning
    if (cmd.deprecated) {
      lines.push('## ⚠️ Deprecation Notice');
      lines.push(cmd.deprecated);
      lines.push('');
    }
    
    // Related commands
    if (cmd.relatedCommands.length > 0) {
      lines.push('## Related Commands');
      lines.push(cmd.relatedCommands.map(c => `- \`${c}\``).join('\n'));
      lines.push('');
    }
    
    // Documentation link
    if (cmd.documentationUrl) {
      lines.push('## Documentation');
      lines.push(`[Official Documentation](${cmd.documentationUrl})`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get all command definitions
   */
  private getCommandDefinitions(): CLICommand[] {
    return [
      // Main Commands
      this.getRunCommand(),
      this.getExecCommand(),
      
      // Backend Commands
      this.getBackendBootstrapCommand(),
      this.getBackendDeleteCommand(),
      this.getBackendMigrateCommand(),
      
      // Stack Commands
      this.getStackRunCommand(),
      this.getStackOutputCommand(),
      this.getStackGenerateCommand(),
      this.getStackCleanCommand(),
      
      // Catalog Commands
      this.getCatalogCommand(),
      this.getScaffoldCommand(),
      
      // Discovery Commands
      this.getFindCommand(),
      this.getListCommand(),
      this.getBrowseCommand(),
      
      // Configuration Commands
      this.getHclFmtCommand(),
      this.getHclValidateCommand(),
      this.getRenderCommand(),
      this.getDagGraphCommand(),
      this.getInfoPrintCommand(),
      this.getInfoStrictCommand(),

      // Shortcut Commands
      this.getPlanCommand(),
      this.getApplyCommand(),
      this.getDestroyCommand(),
      this.getOutputCommand(),
      this.getInitCommand(),
    ];
  }

  // ==================== MAIN COMMANDS ====================

  private getRunCommand(): CLICommand {
    return {
      name: 'run',
      aliases: [],
      legacyNames: ['run-all'],
      category: 'main',
      description: 'Run one or more Terraform/OpenTofu commands against a single unit or a stack of units.',
      usage: 'terragrunt run [flags] -- [terraform command]',
      details: `The run command is the primary way to execute Terraform/OpenTofu commands through Terragrunt. 
It can operate on a single module (unit) or across multiple modules (stack) using the --all flag.

When running against a stack, Terragrunt automatically determines the correct execution order based on 
dependencies defined in terragrunt.hcl files.`,
      options: this.getRunCommandOptions(),
      examples: [
        {
          description: 'Run terraform plan on current module',
          command: 'terragrunt run -- plan',
        },
        {
          description: 'Run terraform apply on all modules in dependency order',
          command: 'terragrunt run --all -- apply',
        },
        {
          description: 'Run terraform apply with auto-approve on all modules',
          command: 'terragrunt run --all -- apply -auto-approve',
        },
        {
          description: 'Run on specific modules using filter',
          command: 'terragrunt run --all --filter=vpc,database -- plan',
        },
        {
          description: 'Run plan following dependency graph order',
          command: 'terragrunt run --graph -- plan',
        },
        {
          description: 'Run with parallelism limit',
          command: 'terragrunt run --all --parallelism=2 -- apply -auto-approve',
        },
      ],
      relatedCommands: ['plan', 'apply', 'destroy', 'stack run'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/run/',
      notes: [
        'The `run-all` alias is deprecated in favor of `run --all`',
        'Use `--` to separate Terragrunt flags from Terraform command and arguments',
        'Dependencies are automatically resolved when using --all',
      ],
    };
  }

  private getRunCommandOptions(): CLIOption[] {
    return [
      {
        flag: '--all',
        shortFlag: '-a',
        description: 'Run the command against all modules in the stack (directory tree)',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--graph',
        description: 'Run the command following the dependency DAG. Cannot be combined with --all.',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--graph-root',
        description: 'Root directory from which to build graph dependencies.',
        type: 'path',
        envVar: 'TG_GRAPH_ROOT',
      },
      {
        flag: '--filter',
        description: 'Filter units and stacks using Terragrunt filter expressions. Repeat the flag to form a union.',
        type: 'list',
        example: '--filter "./prod/** | name=app"',
      },
      {
        flag: '--discovery-boundary',
        description: 'Bound graph discovery to a directory. Requires the bounded-discovery experiment.',
        type: 'path',
        envVar: 'TG_DISCOVERY_BOUNDARY',
        example: '--discovery-boundary ./prod',
      },
      {
        flag: '--parallelism',
        description: 'Maximum number of modules to process in parallel',
        type: 'integer',
        defaultValue: '10',
        envVar: 'TG_PARALLELISM',
      },
      {
        flag: '--out-dir',
        description: 'Directory in which to store plan files for run --all.',
        type: 'path',
        envVar: 'TG_OUT_DIR',
      },
      {
        flag: '--json-out-dir',
        description: 'Directory in which to store JSON plan files for run --all.',
        type: 'path',
        envVar: 'TG_JSON_OUT_DIR',
      },
      {
        flag: '--queue-ignore-errors',
        description: 'Continue processing even if a dependency fails',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_QUEUE_IGNORE_ERRORS',
      },
      {
        flag: '--queue-include-external',
        description: 'Include external dependencies when running',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_QUEUE_INCLUDE_EXTERNAL',
      },
      {
        flag: '--config',
        description: 'Path to the Terragrunt configuration file',
        type: 'path',
        defaultValue: 'terragrunt.hcl',
        envVar: 'TG_CONFIG',
      },
      {
        flag: '--working-dir',
        description: 'Directory to run Terragrunt in',
        type: 'path',
        envVar: 'TG_WORKING_DIR',
      },
      {
        flag: '--source',
        description: 'Override the source URL for the module',
        type: 'string',
        envVar: 'TG_SOURCE',
      },
      {
        flag: '--source-map',
        description: 'Replace matching source URL prefixes, including dependency sources.',
        type: 'list',
        envVar: 'TG_SOURCE_MAP',
        example: '--source-map git::ssh://git@example.com/=../modules/',
      },
      {
        flag: '--source-update',
        description: 'Delete the cached source and re-download',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_SOURCE_UPDATE',
      },
      {
        flag: '--no-auto-init',
        description: 'Disable automatic terraform init',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_AUTO_INIT',
      },
      {
        flag: '--no-auto-retry',
        description: 'Disable automatic retry on retryable errors',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_AUTO_RETRY',
      },
      {
        flag: '--no-auto-approve',
        description: 'Do not append -auto-approve automatically during run --all.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_AUTO_APPROVE',
      },
      {
        flag: '--no-auto-provider-cache-dir',
        description: 'Disable automatic OpenTofu provider cache directory configuration.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_AUTO_PROVIDER_CACHE_DIR',
      },
      {
        flag: '--no-hooks',
        description: 'Disable Terragrunt hooks. Requires the optional-hooks experiment.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_HOOKS',
      },
      {
        flag: '--no-stack-generate',
        description: 'Disable automatic stack regeneration before running the command.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_STACK_GENERATE',
      },
      {
        flag: '--non-interactive',
        description: 'Run in non-interactive mode (no prompts)',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NON_INTERACTIVE',
      },
      {
        flag: '--log-level',
        description: 'Set the log level (trace, debug, info, warn, error)',
        type: 'string',
        defaultValue: 'info',
        envVar: 'TG_LOG_LEVEL',
      },
      {
        flag: '--no-cas',
        description: 'Disable the content-addressable store, which is enabled by default.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_CAS',
      },
      {
        flag: '--cas-clone-depth',
        description: 'Git clone depth used by CAS. Use -1 for full history.',
        type: 'integer',
        defaultValue: '1',
        envVar: 'TG_CAS_CLONE_DEPTH',
        example: '--cas-clone-depth=-1',
      },
      {
        flag: '--no-dependency-outputs',
        description: 'Skip dependency output resolution. Requires the optional-dependency-outputs experiment.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_NO_DEPENDENCY_OUTPUTS',
      },
      {
        flag: '--dependency-fetch-output-from-state',
        description: 'Fetch dependency outputs directly from state and enable the dependency-fetch-output-from-state experiment.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_DEPENDENCY_FETCH_OUTPUT_FROM_STATE',
      },
      {
        flag: '--destroy-dependencies-check',
        description: 'Check for dependent units when destroying infrastructure.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_DESTROY_DEPENDENCIES_CHECK',
      },
      {
        flag: '--use-partial-parse-config-cache',
        description: 'Cache includes during partial parsing operations.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_USE_PARTIAL_PARSE_CONFIG_CACHE',
      },
      {
        flag: '--provider-cache',
        description: 'Enable the Terragrunt provider cache server.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_PROVIDER_CACHE',
      },
      {
        flag: '--provider-cache-dir',
        description: 'Directory used by the Terragrunt provider cache.',
        type: 'path',
        envVar: 'TG_PROVIDER_CACHE_DIR',
      },
      {
        flag: '--provider-cache-hostname',
        description: 'Hostname used by the Terragrunt provider cache server.',
        type: 'string',
        defaultValue: 'localhost',
        envVar: 'TG_PROVIDER_CACHE_HOSTNAME',
      },
      {
        flag: '--provider-cache-port',
        description: 'Port used by the Terragrunt provider cache server.',
        type: 'integer',
        envVar: 'TG_PROVIDER_CACHE_PORT',
      },
      {
        flag: '--provider-cache-token',
        description: 'Authentication token for the Terragrunt provider cache server.',
        type: 'string',
        envVar: 'TG_PROVIDER_CACHE_TOKEN',
      },
      {
        flag: '--provider-cache-registry-names',
        description: 'Remote registries served by the Terragrunt provider cache.',
        type: 'list',
        envVar: 'TG_PROVIDER_CACHE_REGISTRY_NAMES',
      },
      {
        flag: '--version-manager-file-name',
        description: 'Version-manager file names included when computing cache keys.',
        type: 'list',
        envVar: 'TG_VERSION_MANAGER_FILE_NAME',
      },
      {
        flag: '--tf-forward-stdout',
        description: 'Forward OpenTofu/Terraform stdout without integrating it into Terragrunt logs.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_TF_FORWARD_STDOUT',
      },
      {
        flag: '--summary-disable',
        description: 'Disable the execution summary.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_SUMMARY_DISABLE',
      },
      {
        flag: '--summary-per-unit',
        description: 'Include duration information for each unit in the summary.',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TG_SUMMARY_PER_UNIT',
      },
      {
        flag: '--report-file',
        description: 'Path at which to write a run report.',
        type: 'path',
        envVar: 'TG_REPORT_FILE',
      },
      {
        flag: '--report-format',
        description: 'Run report format: csv or json.',
        type: 'string',
        envVar: 'TG_REPORT_FORMAT',
      },
      {
        flag: '--report-schema-file',
        description: 'Path at which to write the run report schema.',
        type: 'path',
        envVar: 'TG_REPORT_SCHEMA_FILE',
      },
    ];
  }

  private getExecCommand(): CLICommand {
    return {
      name: 'exec',
      aliases: [],
      category: 'main',
      description: 'Execute an arbitrary shell command with Terragrunt environment variables.',
      usage: 'terragrunt exec [flags] -- [command]',
      details: `The exec command runs an arbitrary shell command while setting up the Terragrunt 
environment variables and context. This is useful for running custom scripts that need access 
to Terragrunt's resolved configuration values.`,
      options: [
        {
          flag: '--config',
          description: 'Path to the Terragrunt configuration file',
          type: 'path',
          defaultValue: 'terragrunt.hcl',
          envVar: 'TG_CONFIG',
        },
        {
          flag: '--working-dir',
          description: 'Directory to run the command in',
          type: 'path',
          envVar: 'TG_WORKING_DIR',
        },
      ],
      examples: [
        {
          description: 'Run a custom script with Terragrunt context',
          command: 'terragrunt exec -- ./scripts/deploy.sh',
        },
        {
          description: 'Echo resolved configuration values',
          command: 'terragrunt exec -- echo $TF_VAR_environment',
        },
      ],
      relatedCommands: ['run'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/exec/',
    };
  }

  // ==================== BACKEND COMMANDS ====================

  private getBackendBootstrapCommand(): CLICommand {
    return {
      name: 'backend bootstrap',
      aliases: ['bootstrap'],
      category: 'backend',
      description: 'Create and configure the remote state backend (S3 bucket, DynamoDB table, etc.).',
      usage: 'terragrunt backend bootstrap [flags]',
      details: `Automatically creates the backend resources needed for remote state storage. 
For AWS, this includes the S3 bucket and DynamoDB table for state locking.
For GCP, this creates the GCS bucket. For Azure, it creates the storage account and container.`,
      options: [
        {
          flag: '--config',
          description: 'Path to the Terragrunt configuration file',
          type: 'path',
          defaultValue: 'terragrunt.hcl',
          envVar: 'TG_CONFIG',
        },
      ],
      examples: [
        {
          description: 'Bootstrap the backend defined in terragrunt.hcl',
          command: 'terragrunt backend bootstrap',
        },
      ],
      relatedCommands: ['backend delete', 'backend migrate'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/backend/bootstrap/',
    };
  }

  private getBackendDeleteCommand(): CLICommand {
    return {
      name: 'backend delete',
      aliases: [],
      category: 'backend',
      description: 'Delete OpenTofu/Terraform state from the configured remote backend.',
      usage: 'terragrunt backend delete [flags]',
      details: `Deletes the state object for the current unit, or for discovered units with --all.
    It does not delete the backing bucket. Terragrunt refuses deletion when backend versioning is disabled unless --force is provided.`,
      options: [
        {
          flag: '--force',
          description: 'Delete state even when backend versioning is disabled.',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Delete state after versioning safety checks',
          command: 'terragrunt backend delete',
        },
        {
          description: 'Delete state even when the backend is not versioned',
          command: 'terragrunt backend delete --force',
        },
      ],
      relatedCommands: ['backend bootstrap', 'backend migrate'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/backend/delete/',
      notes: [
        '⚠️ This permanently deletes remote state; ensure it is backed up.',
        '--force bypasses the backend-versioning safety check.',
      ],
    };
  }

  private getBackendMigrateCommand(): CLICommand {
    return {
      name: 'backend migrate',
      aliases: [],
      category: 'backend',
      description: 'Migrate state from one backend to another.',
      usage: 'terragrunt backend migrate [flags] <src-unit> <dst-unit>',
      details: `Migrates Terraform state from the current backend to a new backend configuration.
This is useful when moving state between different storage backends or reconfiguring
backend settings.`,
      options: [
        {
          flag: '--force',
          description: 'Migrate state even when the source backend is not versioned.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_FORCE',
        },
      ],
      examples: [
        {
          description: 'Migrate state to new backend',
          command: 'terragrunt backend migrate ./old-unit ./new-unit',
        },
      ],
      relatedCommands: ['backend bootstrap', 'backend delete'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/backend/migrate/',
    };
  }

  // ==================== STACK COMMANDS ====================

  private getStackRunCommand(): CLICommand {
    return {
      name: 'stack run',
      aliases: [],
      category: 'stack',
      description: 'Run a Terraform command across all modules in a stack.',
      usage: 'terragrunt stack run [flags] -- [terraform command]',
      details: `Execute Terraform commands across all modules defined in a stack configuration.
The stack run command respects dependency ordering and can run modules in parallel.`,
      options: [
        {
          flag: '--parallelism',
          description: 'Maximum parallel operations',
          type: 'integer',
          defaultValue: '10',
          envVar: 'TG_PARALLELISM',
        },
        {
          flag: '--queue-ignore-errors',
          description: 'Continue even if dependencies fail',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_QUEUE_IGNORE_ERRORS',
        },
      ],
      examples: [
        {
          description: 'Plan all modules in the stack',
          command: 'terragrunt stack run -- plan',
        },
        {
          description: 'Apply all modules with limited parallelism',
          command: 'terragrunt stack run --parallelism=3 -- apply -auto-approve',
        },
      ],
      relatedCommands: ['run --all', 'stack output', 'stack clean'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/stack/run/',
    };
  }

  private getStackOutputCommand(): CLICommand {
    return {
      name: 'stack output',
      aliases: [],
      category: 'stack',
      description: 'Show outputs from all modules in a stack.',
      usage: 'terragrunt stack output [flags]',
      details: `Displays the Terraform outputs from all modules in the stack. Useful for 
getting a summary of all resources and their outputs across the entire infrastructure.`,
      options: [
        {
          flag: '--format',
          description: 'Output format: json or raw.',
          type: 'string',
          envVar: 'TG_FORMAT',
          example: '--format json',
        },
        {
          flag: '--json',
          description: 'Output in JSON format.',
          type: 'boolean',
        },
        {
          flag: '--raw',
          description: 'Output raw values.',
          type: 'boolean',
        },
      ],
      examples: [
        {
          description: 'Show all stack outputs',
          command: 'terragrunt stack output',
        },
        {
          description: 'Show outputs in JSON format',
          command: 'terragrunt stack output --json',
        },
      ],
      relatedCommands: ['stack run', 'output'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/stack/output/',
    };
  }

  private getStackGenerateCommand(): CLICommand {
    return {
      name: 'stack generate',
      aliases: [],
      category: 'stack',
      description: 'Generate stack contents from the terragrunt.stack.hcl file in the current directory.',
      usage: 'terragrunt stack generate [flags]',
      details: `Reads terragrunt.stack.hcl and materializes its unit and nested stack definitions.
Generation includes validation by default.`,
      options: [
        {
          flag: '--no-stack-validate',
          description: 'Disable automatic stack validation after generation.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_NO_STACK_VALIDATE',
        },
      ],
      examples: [
        {
          description: 'Generate stack configuration',
          command: 'terragrunt stack generate',
        },
      ],
      relatedCommands: ['stack run', 'find', 'list'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/stack/generate/',
    };
  }

  private getStackCleanCommand(): CLICommand {
    return {
      name: 'stack clean',
      aliases: [],
      category: 'stack',
      description: 'Remove the stack generated from the current directory.',
      usage: 'terragrunt stack clean',
      details: 'Removes generated stack contents for the current terragrunt.stack.hcl.',
      options: [],
      examples: [
        {
          description: 'Remove the generated stack',
          command: 'terragrunt stack clean',
        },
      ],
      relatedCommands: ['stack run'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/stack/clean/',
    };
  }

  // ==================== CATALOG COMMANDS ====================

  private getCatalogCommand(): CLICommand {
    return {
      name: 'catalog',
      aliases: [],
      category: 'catalog',
      description: 'Browse and interact with a catalog of Terraform modules.',
      usage: 'terragrunt catalog [flags] [repository]',
      details: `Opens an interactive browser for exploring Terraform module catalogs.
You can browse available modules, view their documentation, and scaffold
new projects using modules from the catalog.`,
      options: [
        {
          flag: '--format',
          description: 'Output format: tui, jsonl, or md. Non-TUI formats require the catalog-format experiment.',
          type: 'string',
          defaultValue: 'tui',
          envVar: 'TG_FORMAT',
        },
        {
          flag: '--ignore-file',
          description: 'Additional ignore file layered over .terragrunt-catalog-ignore.',
          type: 'path',
          envVar: 'TG_IGNORE_FILE',
        },
        {
          flag: '--no-cas',
          description: 'Disable the content-addressable store.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_NO_CAS',
        },
      ],
      examples: [
        {
          description: 'Browse the default catalog',
          command: 'terragrunt catalog',
        },
        {
          description: 'Browse a custom catalog',
          command: 'terragrunt catalog github.com/acme/infrastructure-modules',
        },
        {
          description: 'Render a Markdown catalog',
          command: 'terragrunt --experiment catalog-format catalog --format md',
        },
      ],
      relatedCommands: ['scaffold'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/catalog/',
      notes: ['The jsonl and md formats require the catalog-format experiment.'],
    };
  }

  private getScaffoldCommand(): CLICommand {
    return {
      name: 'scaffold',
      aliases: [],
      category: 'catalog',
      description: 'Generate a new Terragrunt configuration from a module in the catalog.',
      usage: 'terragrunt scaffold [flags] [module-url]',
      details: `Creates a new Terragrunt configuration file by scaffolding from a module
in the catalog. This generates the necessary terragrunt.hcl with all inputs
and configuration pre-filled based on the module's interface.`,
      options: [
        {
          flag: '--output-folder',
          description: 'Output directory for the scaffolded configuration',
          type: 'path',
        },
        {
          flag: '--var',
          description: 'Set input variables for the scaffold',
          type: 'list',
          example: '--var=environment=prod --var=region=us-east-1',
        },
      ],
      examples: [
        {
          description: 'Scaffold a VPC module',
          command: 'terragrunt scaffold github.com/gruntwork-io/terraform-aws-vpc//modules/vpc',
        },
        {
          description: 'Scaffold with variables',
          command: 'terragrunt scaffold --var=env=prod github.com/example/module',
        },
      ],
      relatedCommands: ['catalog'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/scaffold/',
    };
  }

  // ==================== DISCOVERY COMMANDS ====================

  private getFindCommand(): CLICommand {
    return {
      name: 'find',
      aliases: [],
      category: 'discovery',
      description: 'Find Terragrunt modules in a directory tree.',
      usage: 'terragrunt find [flags] [path]',
      details: `Searches for all Terragrunt configuration files (terragrunt.hcl) in the 
specified directory tree. This is useful for discovering all modules in
a large infrastructure repository.`,
      options: [
        {
          flag: '--format',
          description: 'Output format: text or json.',
          type: 'string',
          defaultValue: 'text',
          envVar: 'TG_FORMAT',
        },
        {
          flag: '--json',
          description: 'Output results in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--dag',
          description: 'Sort and group output in DAG mode.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_DAG',
        },
        {
          flag: '--no-hidden',
          description: 'Exclude hidden directories from results.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_NO_HIDDEN',
        },
      ],
      examples: [
        {
          description: 'Find all modules in current directory',
          command: 'terragrunt find',
        },
        {
          description: 'Find modules in a specific path',
          command: 'terragrunt find ./infrastructure',
        },
        {
          description: 'Output as JSON',
          command: 'terragrunt find --json',
        },
      ],
      relatedCommands: ['list', 'dag graph'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/find/',
    };
  }

  private getListCommand(): CLICommand {
    return {
      name: 'list',
      aliases: [],
      category: 'discovery',
      description: 'List all Terragrunt modules with their status and dependencies.',
      usage: 'terragrunt list [flags]',
      details: `Lists all Terragrunt modules in the current stack with information about
their status, dependencies, and configuration. More detailed than 'find'.`,
      options: [
        {
          flag: '--format',
          description: 'Output format: text, tree, long, or dot.',
          type: 'string',
          defaultValue: 'text',
          envVar: 'TG_FORMAT',
        },
        {
          flag: '--tree',
          description: 'Show as dependency tree',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_TREE',
        },
        {
          flag: '--long',
          description: 'Show long output including dependency details.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_LONG',
        },
        {
          flag: '--dag',
          description: 'Sort and group output in DAG mode.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_DAG',
        },
        {
          flag: '--no-hidden',
          description: 'Exclude hidden directories from results.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_NO_HIDDEN',
        },
      ],
      examples: [
        {
          description: 'List all modules',
          command: 'terragrunt list',
        },
        {
          description: 'Show dependency tree',
          command: 'terragrunt list --tree',
        },
      ],
      relatedCommands: ['find', 'dag graph'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/list/',
    };
  }

  private getBrowseCommand(): CLICommand {
    return {
      name: 'browse',
      aliases: [],
      category: 'discovery',
      description: 'Browse Terragrunt units and stacks in an interactive Miller-columns interface.',
      usage: 'terragrunt --experiment browse-tui browse [flags]',
      details: `Discovers Terragrunt configurations and opens an interactive browser for navigating
units and stacks. The command requires the browse-tui experiment.`,
      options: [
        {
          flag: '--feature',
          description: 'Override a Terragrunt feature flag during discovery.',
          type: 'list',
          envVar: 'TG_BROWSE_FEATURE',
          example: '--feature environment=dev',
        },
        {
          flag: '--no-discovery-auth-provider-cmd',
          description: 'Skip the configured authentication provider command during discovery.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_BROWSE_NO_DISCOVERY_AUTH_PROVIDER_CMD',
        },
      ],
      examples: [
        {
          description: 'Browse configurations interactively',
          command: 'terragrunt --experiment browse-tui browse',
        },
      ],
      relatedCommands: ['find', 'list'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/browse/',
      notes: ['Requires the browse-tui experiment.'],
    };
  }

  // ==================== CONFIGURATION COMMANDS ====================

  private getHclFmtCommand(): CLICommand {
    return {
      name: 'hcl fmt',
      aliases: ['fmt'],
      legacyNames: ['hclfmt'],
      category: 'configuration',
      description: 'Format Terragrunt HCL configuration files.',
      usage: 'terragrunt hcl fmt [flags] [path]',
      details: `Formats Terragrunt configuration files (terragrunt.hcl) to a canonical format.
Similar to terraform fmt but for Terragrunt-specific HCL syntax. Can be run
recursively to format all files in a directory tree.`,
      options: [
        {
          flag: '--check',
          description: 'Check if files are formatted (exit 1 if not)',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--diff',
          description: 'Show diff of formatting changes',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--file',
          description: 'Format one HCL file.',
          type: 'path',
          envVar: 'TG_FILE',
        },
        {
          flag: '--stdin',
          description: 'Format HCL from stdin and write the result to stdout.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_STDIN',
        },
        {
          flag: '--exclude-dir',
          description: 'Skip HCL formatting in selected directories.',
          type: 'list',
          envVar: 'TG_EXCLUDE_DIR',
        },
      ],
      examples: [
        {
          description: 'Format all Terragrunt files',
          command: 'terragrunt hcl fmt',
        },
        {
          description: 'Check formatting without changing files',
          command: 'terragrunt hcl fmt --check',
        },
        {
          description: 'Show what would change',
          command: 'terragrunt hcl fmt --check --diff',
        },
        {
          description: 'Format a specific file',
          command: 'terragrunt hcl fmt --file ./modules/vpc/terragrunt.hcl',
        },
      ],
      relatedCommands: ['hcl validate', 'render'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/hcl/fmt/',
      notes: [
        'Useful in CI/CD to enforce consistent formatting',
        'The --check flag is commonly used in pre-commit hooks',
        'The legacy top-level hclfmt command is deprecated; use hcl fmt.',
      ],
    };
  }

  private getHclValidateCommand(): CLICommand {
    return {
      name: 'hcl validate',
      aliases: ['hclvalidate', 'validate-hcl'],
      category: 'configuration',
      description: 'Validate the syntax of Terragrunt HCL configuration files.',
      usage: 'terragrunt hcl validate [flags] [path]',
      details: `Validates that Terragrunt configuration files have correct HCL syntax.
This checks for parsing errors, unknown blocks, and invalid attribute references.
Does not validate Terraform configurations.`,
      options: [
        {
          flag: '--json',
          description: 'Output validation results in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--strict',
          description: 'Enable strict validation (treat warnings as errors)',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--inputs',
          description: 'Check Terragrunt inputs against variables defined by OpenTofu or Terraform.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_INPUTS',
        },
        {
          flag: '--show-config-path',
          description: 'List configuration files that fail validation.',
          type: 'boolean',
          defaultValue: 'false',
          envVar: 'TG_SHOW_CONFIG_PATH',
        },
      ],
      examples: [
        {
          description: 'Validate all Terragrunt files',
          command: 'terragrunt hcl validate',
        },
        {
          description: 'Validate with strict mode',
          command: 'terragrunt hcl validate --inputs --strict',
        },
        {
          description: 'Output validation results as JSON',
          command: 'terragrunt hcl validate --json',
        },
      ],
      relatedCommands: ['hcl fmt', 'render'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/hcl/validate/',
    };
  }

  private getRenderCommand(): CLICommand {
    return {
      name: 'render',
      aliases: ['render-json'],
      category: 'configuration',
      description: 'Render the final Terragrunt configuration after all processing.',
      usage: 'terragrunt render [flags]',
      details: `Outputs the final, merged Terragrunt configuration after processing all
includes, dependencies, and function calls. This is useful for debugging
configuration issues and understanding the effective configuration.`,
      options: [
        {
          flag: '--json',
          description: 'Output as JSON (default is HCL)',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--with-metadata',
          description: 'Include metadata about where values came from',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Render configuration as HCL',
          command: 'terragrunt render',
        },
        {
          description: 'Render configuration as JSON',
          command: 'terragrunt render --json',
        },
        {
          description: 'Render with source metadata',
          command: 'terragrunt render --with-metadata',
        },
      ],
      relatedCommands: ['hcl validate', 'info print'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/render/',
    };
  }

  private getDagGraphCommand(): CLICommand {
    return {
      name: 'dag graph',
      aliases: [],
      legacyNames: ['graph'],
      category: 'configuration',
      description: 'Generate a visual dependency graph of Terragrunt modules.',
      usage: 'terragrunt dag graph [flags]',
      details: `Generates a DOT graph showing Terragrunt dependencies. It is equivalent to
list --format=dot --dag --dependencies --external. Pipe the output to a DOT renderer to create an image.`,
      options: [],
      examples: [
        {
          description: 'Generate DOT graph',
          command: 'terragrunt dag graph',
        },
        {
          description: 'Generate and render with Graphviz',
          command: 'terragrunt dag graph | dot -Tpng -o graph.png',
        },
      ],
      relatedCommands: ['list', 'find', 'run --graph'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/dag/graph/',
    };
  }

  private getInfoPrintCommand(): CLICommand {
    return {
      name: 'info print',
      aliases: ['info'],
      category: 'configuration',
      description: 'Print information about the Terragrunt configuration and environment.',
      usage: 'terragrunt info print [flags]',
      details: `Displays detailed information about the current Terragrunt configuration,
including paths, versions, environment variables, and resolved configuration values.`,
      options: this.getRunCommandOptions(),
      examples: [
        {
          description: 'Print configuration info',
          command: 'terragrunt info print',
        },
      ],
      relatedCommands: ['render'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/info/print/',
    };
  }

  private getInfoStrictCommand(): CLICommand {
    return {
      name: 'info strict',
      aliases: [],
      category: 'configuration',
      description: 'List and inspect strict controls.',
      usage: 'terragrunt info strict list [--all] [name]',
      details: `Strict controls turn specific deprecation warnings into errors. Bare
\`info strict\` prints help; the \`list\` subcommand lists the active controls,
\`--all\` also includes completed ones, and passing a control name inspects
that control and its subcontrols.`,
      options: [
        {
          flag: '--all',
          description: 'Show all controls, including completed ones (the default lists only active controls).',
          type: 'boolean',
        },
      ],
      examples: [
        {
          description: 'List active strict controls',
          command: 'terragrunt info strict list',
        },
        {
          description: 'Include completed controls',
          command: 'terragrunt info strict list --all',
        },
        {
          description: 'Inspect a single strict control by name',
          command: 'terragrunt info strict list <name>',
        },
      ],
      relatedCommands: ['info print'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/commands/info/strict/',
    };
  }

  // ==================== SHORTCUT COMMANDS ====================

  private getShortcutCommandOptions(options: CLIOption[]): CLIOption[] {
    return [...this.getRunCommandOptions(), ...options];
  }

  private getPlanCommand(): CLICommand {
    return {
      name: 'plan',
      aliases: [],
      category: 'shortcut',
      description: 'Shortcut for running terraform plan through Terragrunt.',
      usage: 'terragrunt plan [flags]',
      details: `A convenience shortcut equivalent to 'terragrunt run -- plan'. 
Runs terraform plan with all Terragrunt configuration applied, including
input variables, backend configuration, and any before/after hooks.`,
      options: this.getShortcutCommandOptions([
        {
          flag: '-out',
          description: 'Save the plan to a file',
          type: 'path',
          example: '-out=tfplan',
        },
        {
          flag: '-target',
          description: 'Target specific resources',
          type: 'string',
          example: '-target=module.vpc',
        },
        {
          flag: '-var',
          description: 'Set a variable',
          type: 'string',
          example: '-var="environment=prod"',
        },
        {
          flag: '-var-file',
          description: 'Load variables from a file',
          type: 'path',
          example: '-var-file=prod.tfvars',
        },
      ]),
      examples: [
        {
          description: 'Run plan on current module',
          command: 'terragrunt plan',
        },
        {
          description: 'Plan all modules',
          command: 'terragrunt plan --all',
        },
        {
          description: 'Save plan to file',
          command: 'terragrunt plan -out=tfplan',
        },
        {
          description: 'Plan specific resources',
          command: 'terragrunt plan -target=module.vpc',
        },
      ],
      relatedCommands: ['apply', 'destroy', 'run', 'hcl validate'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/',
      notes: [
        'Equivalent to: terragrunt run -- plan',
        'With --all, equivalent to: terragrunt run --all -- plan',
        'Terragrunt automatically runs init if needed',
        'Use -out to save plan for later apply',
      ],
    };
  }

  private getApplyCommand(): CLICommand {
    return {
      name: 'apply',
      aliases: [],
      category: 'shortcut',
      description: 'Shortcut for running terraform apply through Terragrunt.',
      usage: 'terragrunt apply [flags] [plan-file]',
      details: `A convenience shortcut equivalent to 'terragrunt run -- apply'.
Applies Terraform changes with all Terragrunt configuration applied.
Can apply a saved plan file or run interactively.`,
      options: this.getShortcutCommandOptions([
        {
          flag: '-auto-approve',
          description: 'Skip interactive approval',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '-target',
          description: 'Target specific resources',
          type: 'string',
        },
        {
          flag: '-var',
          description: 'Set a variable',
          type: 'string',
        },
        {
          flag: '-parallelism',
          description: 'Limit concurrent operations',
          type: 'integer',
          defaultValue: '10',
        },
      ]),
      examples: [
        {
          description: 'Apply changes interactively',
          command: 'terragrunt apply',
        },
        {
          description: 'Apply without confirmation',
          command: 'terragrunt apply -auto-approve',
        },
        {
          description: 'Apply all modules',
          command: 'terragrunt apply --all -auto-approve',
        },
        {
          description: 'Apply a saved plan',
          command: 'terragrunt apply tfplan',
        },
      ],
      relatedCommands: ['plan', 'destroy', 'run'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/',
      notes: [
        'Equivalent to: terragrunt run -- apply',
        'With --all, equivalent to: terragrunt run --all -- apply',
        'Always review plan before applying in production',
        'Use -auto-approve only in CI/CD with proper safeguards',
      ],
    };
  }

  private getDestroyCommand(): CLICommand {
    return {
      name: 'destroy',
      aliases: [],
      category: 'shortcut',
      description: 'Shortcut for running terraform destroy through Terragrunt.',
      usage: 'terragrunt destroy [flags]',
      details: `A convenience shortcut equivalent to 'terragrunt run -- destroy'.
Destroys all resources managed by Terraform in the module.
Use with extreme caution as this is destructive.`,
      options: this.getShortcutCommandOptions([
        {
          flag: '-auto-approve',
          description: 'Skip interactive approval',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '-target',
          description: 'Target specific resources',
          type: 'string',
        },
      ]),
      examples: [
        {
          description: 'Destroy resources interactively',
          command: 'terragrunt destroy',
        },
        {
          description: 'Force destroy without confirmation',
          command: 'terragrunt destroy -auto-approve',
        },
        {
          description: 'Destroy all modules (reverse dependency order)',
          command: 'terragrunt destroy --all -auto-approve',
        },
      ],
      relatedCommands: ['apply', 'plan', 'run'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/',
      notes: [
        '⚠️ Destructive operation - use with caution',
        'Equivalent to terragrunt run -- destroy, or terragrunt run --all -- destroy with --all.',
        'When using --all, modules are destroyed in reverse dependency order',
        'Always verify what will be destroyed with plan -destroy first',
      ],
    };
  }

  private getOutputCommand(): CLICommand {
    return {
      name: 'output',
      aliases: [],
      category: 'shortcut',
      description: 'Shortcut for running terraform output through Terragrunt.',
      usage: 'terragrunt output [flags] [name]',
      details: `A convenience shortcut equivalent to 'terragrunt run -- output'.
Shows the outputs from the Terraform state for the current module.`,
      options: this.getShortcutCommandOptions([
        {
          flag: '-json',
          description: 'Output in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '-raw',
          description: 'Output raw value (for single output)',
          type: 'boolean',
          defaultValue: 'false',
        },
      ]),
      examples: [
        {
          description: 'Show all outputs',
          command: 'terragrunt output',
        },
        {
          description: 'Show specific output',
          command: 'terragrunt output vpc_id',
        },
        {
          description: 'Get output as JSON',
          command: 'terragrunt output -json',
        },
        {
          description: 'Get raw value for scripting',
          command: 'terragrunt output -raw vpc_id',
        },
      ],
      relatedCommands: ['stack output', 'apply'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/',
    };
  }

  private getInitCommand(): CLICommand {
    return {
      name: 'init',
      aliases: [],
      category: 'shortcut',
      description: 'Shortcut for running terraform init through Terragrunt.',
      usage: 'terragrunt init [flags]',
      details: `A convenience shortcut equivalent to 'terragrunt run -- init'.
Initializes the Terraform working directory, downloading providers
and configuring the backend.`,
      options: this.getShortcutCommandOptions([
        {
          flag: '-upgrade',
          description: 'Upgrade provider versions',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '-reconfigure',
          description: 'Reconfigure backend, ignoring saved configuration',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '-migrate-state',
          description: 'Migrate state from one backend to another',
          type: 'boolean',
          defaultValue: 'false',
        },
      ]),
      examples: [
        {
          description: 'Initialize the module',
          command: 'terragrunt init',
        },
        {
          description: 'Upgrade providers',
          command: 'terragrunt init -upgrade',
        },
        {
          description: 'Reconfigure backend',
          command: 'terragrunt init -reconfigure',
        },
      ],
      relatedCommands: ['plan', 'apply'],
      documentationUrl: 'https://docs.terragrunt.com/reference/cli/',
      notes: [
        'Terragrunt typically runs init automatically when needed',
        'Use -upgrade periodically to get provider updates',
      ],
    };
  }
}

