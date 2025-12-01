/**
 * CLI Commands Manager for Terragrunt MCP Server
 * 
 * Provides comprehensive CLI command documentation with structured data
 * for all Terragrunt commands, options, usage patterns, and examples.
 */

import type {
  CLICommand,
  CLIOption,
  CLIExample,
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
      
      // Configuration Commands
      this.getHclFmtCommand(),
      this.getHclValidateCommand(),
      this.getRenderCommand(),
      this.getDagGraphCommand(),
      this.getValidateInputsCommand(),
      this.getInfoPrintCommand(),
      
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
      aliases: ['run-all'],
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
          description: 'Generate execution graph',
          command: 'terragrunt run --all --graph -- plan',
        },
        {
          description: 'Run with parallelism limit',
          command: 'terragrunt run --all --parallelism=2 -- apply -auto-approve',
        },
      ],
      relatedCommands: ['plan', 'apply', 'destroy', 'stack run'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/run/',
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
        shortFlag: '-g',
        description: 'Generate a visual dependency graph instead of running the command',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--filter',
        shortFlag: '-f',
        description: 'Filter which modules to include (comma-separated list of module names or paths)',
        type: 'list',
        example: '--filter=vpc,database,app',
      },
      {
        flag: '--exclude',
        description: 'Exclude specific modules (comma-separated list)',
        type: 'list',
        example: '--exclude=legacy,deprecated',
      },
      {
        flag: '--parallelism',
        shortFlag: '-p',
        description: 'Maximum number of modules to process in parallel',
        type: 'integer',
        defaultValue: '10',
        envVar: 'TERRAGRUNT_PARALLELISM',
      },
      {
        flag: '--ignore-dependency-errors',
        description: 'Continue processing even if a dependency fails',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--ignore-external-dependencies',
        description: 'Ignore external dependencies (modules outside current tree)',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--include-external-dependencies',
        description: 'Include external dependencies when running',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--terragrunt-config',
        description: 'Path to the Terragrunt configuration file',
        type: 'path',
        defaultValue: 'terragrunt.hcl',
        envVar: 'TERRAGRUNT_CONFIG',
      },
      {
        flag: '--terragrunt-working-dir',
        description: 'Directory to run Terragrunt in',
        type: 'path',
        envVar: 'TERRAGRUNT_WORKING_DIR',
      },
      {
        flag: '--terragrunt-source',
        description: 'Override the source URL for the module',
        type: 'string',
        envVar: 'TERRAGRUNT_SOURCE',
      },
      {
        flag: '--terragrunt-source-update',
        description: 'Delete the cached source and re-download',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--terragrunt-no-auto-init',
        description: 'Disable automatic terraform init',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--terragrunt-no-auto-retry',
        description: 'Disable automatic retry on retryable errors',
        type: 'boolean',
        defaultValue: 'false',
      },
      {
        flag: '--terragrunt-non-interactive',
        description: 'Run in non-interactive mode (no prompts)',
        type: 'boolean',
        defaultValue: 'false',
        envVar: 'TERRAGRUNT_NON_INTERACTIVE',
      },
      {
        flag: '--terragrunt-log-level',
        description: 'Set the log level (trace, debug, info, warn, error)',
        type: 'string',
        defaultValue: 'info',
        envVar: 'TERRAGRUNT_LOG_LEVEL',
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
          flag: '--terragrunt-config',
          description: 'Path to the Terragrunt configuration file',
          type: 'path',
          defaultValue: 'terragrunt.hcl',
        },
        {
          flag: '--terragrunt-working-dir',
          description: 'Directory to run the command in',
          type: 'path',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/exec/',
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
          flag: '--terragrunt-config',
          description: 'Path to the Terragrunt configuration file',
          type: 'path',
          defaultValue: 'terragrunt.hcl',
        },
      ],
      examples: [
        {
          description: 'Bootstrap the backend defined in terragrunt.hcl',
          command: 'terragrunt backend bootstrap',
        },
      ],
      relatedCommands: ['backend delete', 'backend migrate'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/backend/bootstrap/',
    };
  }

  private getBackendDeleteCommand(): CLICommand {
    return {
      name: 'backend delete',
      aliases: [],
      category: 'backend',
      description: 'Delete the remote state backend resources.',
      usage: 'terragrunt backend delete [flags]',
      details: `Removes the backend resources created by Terragrunt. Use with caution as this 
will delete the state storage. Make sure to back up any important state files first.`,
      options: [
        {
          flag: '--force',
          description: 'Skip confirmation prompt',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Delete backend resources with confirmation',
          command: 'terragrunt backend delete',
        },
        {
          description: 'Force delete without confirmation',
          command: 'terragrunt backend delete --force',
        },
      ],
      relatedCommands: ['backend bootstrap', 'backend migrate'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/backend/delete/',
      notes: [
        '⚠️ This is a destructive operation - ensure state is backed up',
        'Will prompt for confirmation unless --force is used',
      ],
    };
  }

  private getBackendMigrateCommand(): CLICommand {
    return {
      name: 'backend migrate',
      aliases: [],
      category: 'backend',
      description: 'Migrate state from one backend to another.',
      usage: 'terragrunt backend migrate [flags]',
      details: `Migrates Terraform state from the current backend to a new backend configuration.
This is useful when moving state between different storage backends or reconfiguring
backend settings.`,
      options: [
        {
          flag: '--from',
          description: 'Source backend configuration',
          type: 'string',
        },
        {
          flag: '--to',
          description: 'Destination backend configuration',
          type: 'string',
        },
      ],
      examples: [
        {
          description: 'Migrate state to new backend',
          command: 'terragrunt backend migrate',
        },
      ],
      relatedCommands: ['backend bootstrap', 'backend delete'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/backend/migrate/',
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
        },
        {
          flag: '--ignore-dependency-errors',
          description: 'Continue even if dependencies fail',
          type: 'boolean',
          defaultValue: 'false',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/stack/run/',
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
          flag: '--json',
          description: 'Output in JSON format',
          type: 'boolean',
          defaultValue: 'false',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/stack/output/',
    };
  }

  private getStackGenerateCommand(): CLICommand {
    return {
      name: 'stack generate',
      aliases: [],
      category: 'stack',
      description: 'Generate a stack configuration from existing Terragrunt modules.',
      usage: 'terragrunt stack generate [flags]',
      details: `Scans the directory tree for Terragrunt modules and generates a stack 
configuration file (terragrunt.stack.hcl) that defines the relationships
between modules.`,
      options: [
        {
          flag: '--output',
          shortFlag: '-o',
          description: 'Output file path',
          type: 'path',
          defaultValue: 'terragrunt.stack.hcl',
        },
      ],
      examples: [
        {
          description: 'Generate stack configuration',
          command: 'terragrunt stack generate',
        },
        {
          description: 'Generate to custom file',
          command: 'terragrunt stack generate -o my-stack.hcl',
        },
      ],
      relatedCommands: ['stack run', 'find', 'list'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/stack/generate/',
    };
  }

  private getStackCleanCommand(): CLICommand {
    return {
      name: 'stack clean',
      aliases: [],
      category: 'stack',
      description: 'Clean Terragrunt cache and generated files from the stack.',
      usage: 'terragrunt stack clean [flags]',
      details: `Removes Terragrunt cache directories (.terragrunt-cache) and optionally
other generated files from all modules in the stack.`,
      options: [
        {
          flag: '--all',
          description: 'Clean all generated files, not just cache',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Clean cache from all modules',
          command: 'terragrunt stack clean',
        },
        {
          description: 'Clean all generated files',
          command: 'terragrunt stack clean --all',
        },
      ],
      relatedCommands: ['stack run'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/stack/clean/',
    };
  }

  // ==================== CATALOG COMMANDS ====================

  private getCatalogCommand(): CLICommand {
    return {
      name: 'catalog',
      aliases: [],
      category: 'catalog',
      description: 'Browse and interact with a catalog of Terraform modules.',
      usage: 'terragrunt catalog [flags]',
      details: `Opens an interactive browser for exploring Terraform module catalogs.
You can browse available modules, view their documentation, and scaffold
new projects using modules from the catalog.`,
      options: [
        {
          flag: '--url',
          description: 'URL of the catalog to browse',
          type: 'string',
        },
      ],
      examples: [
        {
          description: 'Browse the default catalog',
          command: 'terragrunt catalog',
        },
        {
          description: 'Browse a custom catalog',
          command: 'terragrunt catalog --url=https://example.com/catalog',
        },
      ],
      relatedCommands: ['scaffold'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/catalog/',
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
          flag: '--output',
          shortFlag: '-o',
          description: 'Output directory for the scaffolded configuration',
          type: 'path',
          defaultValue: '.',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/scaffold/',
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
          flag: '--json',
          description: 'Output results in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--hidden',
          description: 'Include hidden directories',
          type: 'boolean',
          defaultValue: 'false',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/find/',
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
          flag: '--json',
          description: 'Output in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--tree',
          description: 'Show as dependency tree',
          type: 'boolean',
          defaultValue: 'false',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/list/',
    };
  }

  // ==================== CONFIGURATION COMMANDS ====================

  private getHclFmtCommand(): CLICommand {
    return {
      name: 'hcl fmt',
      aliases: ['hclfmt', 'fmt'],
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
          flag: '--recursive',
          description: 'Recursively format files in subdirectories',
          type: 'boolean',
          defaultValue: 'true',
        },
        {
          flag: '--write',
          description: 'Write formatted output to files',
          type: 'boolean',
          defaultValue: 'true',
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
          command: 'terragrunt hcl fmt ./modules/vpc/terragrunt.hcl',
        },
      ],
      relatedCommands: ['hcl validate', 'render'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/hcl/fmt/',
      notes: [
        'Useful in CI/CD to enforce consistent formatting',
        'The --check flag is commonly used in pre-commit hooks',
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
      ],
      examples: [
        {
          description: 'Validate all Terragrunt files',
          command: 'terragrunt hcl validate',
        },
        {
          description: 'Validate with strict mode',
          command: 'terragrunt hcl validate --strict',
        },
        {
          description: 'Output validation results as JSON',
          command: 'terragrunt hcl validate --json',
        },
      ],
      relatedCommands: ['hcl fmt', 'validate-inputs', 'render'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/hcl/validate/',
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/render/',
    };
  }

  private getDagGraphCommand(): CLICommand {
    return {
      name: 'dag graph',
      aliases: ['graph'],
      category: 'configuration',
      description: 'Generate a visual dependency graph of Terragrunt modules.',
      usage: 'terragrunt dag graph [flags]',
      details: `Generates a DOT format graph showing the dependencies between Terragrunt
modules. The output can be rendered using Graphviz or other DOT viewers.
Useful for understanding and documenting infrastructure dependencies.`,
      options: [
        {
          flag: '--format',
          description: 'Output format (dot, json, mermaid)',
          type: 'string',
          defaultValue: 'dot',
        },
        {
          flag: '--output',
          shortFlag: '-o',
          description: 'Output file path',
          type: 'path',
        },
      ],
      examples: [
        {
          description: 'Generate DOT graph',
          command: 'terragrunt dag graph',
        },
        {
          description: 'Generate and render with Graphviz',
          command: 'terragrunt dag graph | dot -Tpng -o graph.png',
        },
        {
          description: 'Output as Mermaid diagram',
          command: 'terragrunt dag graph --format=mermaid',
        },
      ],
      relatedCommands: ['list', 'find', 'run --graph'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/dag/graph/',
    };
  }

  private getValidateInputsCommand(): CLICommand {
    return {
      name: 'validate-inputs',
      aliases: ['validate inputs'],
      category: 'configuration',
      description: 'Validate that all required inputs are provided and match expected types.',
      usage: 'terragrunt validate-inputs [flags]',
      details: `Validates that all inputs required by the Terraform module are provided
in the Terragrunt configuration. Also validates that the input types match
what the module expects. Useful for catching configuration errors early.`,
      options: [
        {
          flag: '--strict',
          description: 'Fail on any validation warning',
          type: 'boolean',
          defaultValue: 'false',
        },
        {
          flag: '--json',
          description: 'Output results in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Validate inputs for current module',
          command: 'terragrunt validate-inputs',
        },
        {
          description: 'Strict validation',
          command: 'terragrunt validate-inputs --strict',
        },
      ],
      relatedCommands: ['hcl validate', 'render', 'plan'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/validate-inputs/',
      notes: [
        'Run this before plan to catch input errors early',
        'Works well in CI/CD pipelines as a validation step',
      ],
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
      options: [
        {
          flag: '--json',
          description: 'Output in JSON format',
          type: 'boolean',
          defaultValue: 'false',
        },
      ],
      examples: [
        {
          description: 'Print configuration info',
          command: 'terragrunt info print',
        },
        {
          description: 'Print info as JSON',
          command: 'terragrunt info print --json',
        },
      ],
      relatedCommands: ['render'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/commands/info/print/',
    };
  }

  // ==================== SHORTCUT COMMANDS ====================

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
      options: [
        {
          flag: '--all',
          description: 'Run plan on all modules in the stack',
          type: 'boolean',
          defaultValue: 'false',
        },
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
      ],
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
      relatedCommands: ['apply', 'destroy', 'run', 'validate-inputs'],
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/',
      notes: [
        'Equivalent to: terragrunt run -- plan',
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
      options: [
        {
          flag: '--all',
          description: 'Apply on all modules in the stack',
          type: 'boolean',
          defaultValue: 'false',
        },
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
      ],
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/',
      notes: [
        'Equivalent to: terragrunt run -- apply',
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
      options: [
        {
          flag: '--all',
          description: 'Destroy all modules in the stack',
          type: 'boolean',
          defaultValue: 'false',
        },
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
      ],
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/',
      notes: [
        '⚠️ Destructive operation - use with caution',
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
      options: [
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
      ],
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/',
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
      options: [
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
      ],
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
      documentationUrl: 'https://terragrunt.gruntwork.io/docs/reference/cli/',
      notes: [
        'Terragrunt typically runs init automatically when needed',
        'Use -upgrade periodically to get provider updates',
      ],
    };
  }
}

