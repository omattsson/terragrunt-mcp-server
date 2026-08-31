/**
 * Unit tests for CLICommandsManager
 * 
 * Tests for the CLI command help documentation feature (Issue #101)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CLICommandsManager } from '../../src/terragrunt/cli-commands.js';
import { TERRAGRUNT_DOC_MANIFEST } from '../../src/terragrunt/docs-manifest.js';
import type { CLICommand, CLICommandCategory } from '../../src/types/cli-commands.js';

describe('CLICommandsManager', () => {
    let manager: CLICommandsManager;

    beforeEach(() => {
        manager = new CLICommandsManager();
    });

    describe('getCommand', () => {
        describe('exact name matching', () => {
            it('should get command by exact name', () => {
                const cmd = manager.getCommand('run');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('run');
                expect(cmd?.category).toBe('main');
            });

            it('should get plan command', () => {
                const cmd = manager.getCommand('plan');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('plan');
                expect(cmd?.category).toBe('shortcut');
            });

            it('should get apply command', () => {
                const cmd = manager.getCommand('apply');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('apply');
                expect(cmd?.description).toContain('terraform apply');
            });

            it('should get destroy command', () => {
                const cmd = manager.getCommand('destroy');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('destroy');
                expect(cmd?.notes).toBeDefined();
                expect(cmd?.notes?.some(n => n.includes('Destructive'))).toBe(true);
            });

            it('should get hcl fmt command', () => {
                const cmd = manager.getCommand('hcl fmt');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('hcl fmt');
                expect(cmd?.category).toBe('configuration');
            });

            it('should get browse command', () => {
                const cmd = manager.getCommand('browse');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('browse');
                expect(cmd?.category).toBe('discovery');
            });

            it('should not expose removed validate-inputs command', () => {
                expect(manager.getCommand('validate-inputs')).toBeNull();
            });

            it('should be case-insensitive', () => {
                const cmd1 = manager.getCommand('RUN');
                const cmd2 = manager.getCommand('Run');
                const cmd3 = manager.getCommand('run');
                
                expect(cmd1?.name).toBe('run');
                expect(cmd2?.name).toBe('run');
                expect(cmd3?.name).toBe('run');
            });

            it('should handle whitespace normalization', () => {
                const cmd = manager.getCommand('  hcl   fmt  ');
                expect(cmd?.name).toBe('hcl fmt');
            });

            it('should return null for unknown command', () => {
                const cmd = manager.getCommand('nonexistent-command');
                expect(cmd).toBeNull();
            });
        });

        describe('alias and migration lookup resolution', () => {
            it('should resolve removed run-all name to run command', () => {
                const cmd = manager.getCommand('run-all');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('run');
                expect(cmd?.aliases).not.toContain('run-all');
                expect(cmd?.legacyNames).toContain('run-all');
            });

            it('should resolve removed hclfmt name to hcl fmt command', () => {
                const cmd = manager.getCommand('hclfmt');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('hcl fmt');
                expect(cmd?.aliases).not.toContain('hclfmt');
                expect(cmd?.legacyNames).toContain('hclfmt');
            });

            it('should resolve fmt alias to hcl fmt command', () => {
                const cmd = manager.getCommand('fmt');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('hcl fmt');
            });

            it('should resolve graph alias to dag graph command', () => {
                const cmd = manager.getCommand('graph');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('dag graph');
            });

            it('should resolve bootstrap alias to backend bootstrap', () => {
                const cmd = manager.getCommand('bootstrap');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('backend bootstrap');
            });

            it('should resolve hclvalidate alias to hcl validate', () => {
                const cmd = manager.getCommand('hclvalidate');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('hcl validate');
            });

            it('should resolve render-json alias to render', () => {
                const cmd = manager.getCommand('render-json');
                expect(cmd).not.toBeNull();
                expect(cmd?.name).toBe('render');
            });
        });
    });

    describe('searchCommands', () => {
        it('should find exact matches with highest score', () => {
            const results = manager.searchCommands('plan');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].command.name).toBe('plan');
            expect(results[0].score).toBe(1.0);
            expect(results[0].matchType).toBe('exact');
        });

        it('should identify removed command name matches', () => {
            const results = manager.searchCommands('run-all');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].command.name).toBe('run');
            expect(results[0].matchType).toBe('legacy');
        });

        it('should find partial matches in command names', () => {
            const results = manager.searchCommands('validate');
            expect(results.length).toBeGreaterThan(0);
            const names = results.map(r => r.command.name);
            expect(names).toContain('hcl validate');
        });

        it('should find fuzzy matches in descriptions', () => {
            const results = manager.searchCommands('format');
            expect(results.length).toBeGreaterThan(0);
            // hcl fmt description mentions "Format"
            const names = results.map(r => r.command.name);
            expect(names).toContain('hcl fmt');
        });

        it('should sort results by score descending', () => {
            const results = manager.searchCommands('apply');
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });

        it('should return empty array for no matches', () => {
            const results = manager.searchCommands('xyznonexistent123');
            expect(results).toEqual([]);
        });

        it('should deduplicate results', () => {
            const results = manager.searchCommands('run');
            const names = results.map(r => r.command.name);
            const uniqueNames = [...new Set(names)];
            expect(names.length).toBe(uniqueNames.length);
        });
    });

    describe('getAllCommands', () => {
        it('should return all defined commands', () => {
            const commands = manager.getAllCommands();
            expect(commands.length).toBeGreaterThan(15);
        });

        it('should include all major command categories', () => {
            const commands = manager.getAllCommands();
            const categories = new Set(commands.map(c => c.category));
            
            expect(categories.has('main')).toBe(true);
            expect(categories.has('shortcut')).toBe(true);
            expect(categories.has('configuration')).toBe(true);
            expect(categories.has('backend')).toBe(true);
        });

        it('should include required fields for all commands', () => {
            const commands = manager.getAllCommands();
            
            for (const cmd of commands) {
                expect(cmd.name).toBeDefined();
                expect(cmd.name.length).toBeGreaterThan(0);
                expect(cmd.description).toBeDefined();
                expect(cmd.description.length).toBeGreaterThan(0);
                expect(cmd.usage).toBeDefined();
                expect(cmd.category).toBeDefined();
                expect(Array.isArray(cmd.aliases)).toBe(true);
                expect(Array.isArray(cmd.options)).toBe(true);
                expect(Array.isArray(cmd.examples)).toBe(true);
                expect(Array.isArray(cmd.relatedCommands)).toBe(true);
            }
        });
    });

    describe('getCommandsByCategory', () => {
        it('should return main commands', () => {
            const commands = manager.getCommandsByCategory('main');
            expect(commands.length).toBeGreaterThan(0);
            expect(commands.every(c => c.category === 'main')).toBe(true);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('run');
            expect(names).toContain('exec');
        });

        it('should return shortcut commands', () => {
            const commands = manager.getCommandsByCategory('shortcut');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('plan');
            expect(names).toContain('apply');
            expect(names).toContain('destroy');
            expect(names).toContain('init');
            expect(names).toContain('output');
        });

        it('should return configuration commands', () => {
            const commands = manager.getCommandsByCategory('configuration');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('hcl fmt');
            expect(names).toContain('hcl validate');
            expect(names).toContain('render');
        });

        it('should return backend commands', () => {
            const commands = manager.getCommandsByCategory('backend');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('backend bootstrap');
            expect(names).toContain('backend delete');
            expect(names).toContain('backend migrate');
        });

        it('should return stack commands', () => {
            const commands = manager.getCommandsByCategory('stack');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('stack run');
            expect(names).toContain('stack output');
        });

        it('should return catalog commands', () => {
            const commands = manager.getCommandsByCategory('catalog');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('catalog');
            expect(names).toContain('scaffold');
        });

        it('should return discovery commands', () => {
            const commands = manager.getCommandsByCategory('discovery');
            expect(commands.length).toBeGreaterThan(0);
            
            const names = commands.map(c => c.name);
            expect(names).toContain('find');
            expect(names).toContain('list');
            expect(names).toContain('browse');
        });

        it('should return empty array for invalid category', () => {
            // TypeScript should catch this, but testing runtime behavior
            const commands = manager.getCommandsByCategory('invalid' as CLICommandCategory);
            expect(commands).toEqual([]);
        });
    });

    describe('getCategories', () => {
        it('should return all categories with commands', () => {
            const categories = manager.getCategories();
            expect(categories.length).toBeGreaterThan(0);
        });

        it('should include category metadata', () => {
            const categories = manager.getCategories();
            
            for (const cat of categories) {
                expect(cat.id).toBeDefined();
                expect(cat.name).toBeDefined();
                expect(cat.description).toBeDefined();
                expect(Array.isArray(cat.commands)).toBe(true);
                expect(cat.commands.length).toBeGreaterThan(0);
            }
        });

        it('should have descriptive category names', () => {
            const categories = manager.getCategories();
            const names = categories.map(c => c.name);
            
            expect(names).toContain('Main Commands');
            expect(names).toContain('Shortcut Commands');
            expect(names).toContain('Configuration Commands');
        });

        it('should list command names in each category', () => {
            const categories = manager.getCategories();
            const mainCategory = categories.find(c => c.id === 'main');
            
            expect(mainCategory).toBeDefined();
            expect(mainCategory?.commands).toContain('run');
        });
    });

    describe('formatCommandHelp', () => {
        it('should format command as markdown', () => {
            const cmd = manager.getCommand('plan');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('# plan');
            expect(help).toContain('## Usage');
            expect(help).toContain('```bash');
            expect(help).toContain('terragrunt plan');
        });

        it('should include options section', () => {
            const cmd = manager.getCommand('run');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Options');
            expect(help).toContain('--all');
            expect(help).toContain('--parallelism');
        });

        it('should include examples section', () => {
            const cmd = manager.getCommand('hcl fmt');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Examples');
            expect(help).toContain('terragrunt hcl fmt');
        });

        it('should include aliases section when aliases exist', () => {
            const cmd = manager.getCommand('hcl fmt');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Aliases');
            expect(help).toContain('`fmt`');
            expect(help).toContain('## Removed Command Names');
            expect(help).toContain('`hclfmt`');
        });

        it('should include related commands', () => {
            const cmd = manager.getCommand('plan');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Related Commands');
            expect(help).toContain('apply');
        });

        it('should include notes when present', () => {
            const cmd = manager.getCommand('destroy');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Notes');
            expect(help).toContain('Destructive');
        });

        it('should include documentation URL when present', () => {
            const cmd = manager.getCommand('run');
            expect(cmd).not.toBeNull();
            
            const help = manager.formatCommandHelp(cmd!);
            
            expect(help).toContain('## Documentation');
            expect(help).toContain('docs.terragrunt.com');
        });
    });

    describe('command data completeness', () => {
        describe('run command', () => {
            let cmd: CLICommand | null;

            beforeEach(() => {
                cmd = manager.getCommand('run');
            });

            it('should have comprehensive options', () => {
                expect(cmd?.options.length).toBeGreaterThan(10);
                
                const flagNames = cmd?.options.map(o => o.flag);
                expect(flagNames).toContain('--all');
                expect(flagNames).toContain('--graph');
                expect(flagNames).toContain('--filter');
                expect(flagNames).toContain('--parallelism');
                expect(flagNames).toContain('--config');
                expect(flagNames).toContain('--no-cas');
                expect(flagNames).toContain('--cas-clone-depth');
                expect(flagNames).toContain('--discovery-boundary');
                expect(flagNames).toContain('--graph-root');
                expect(flagNames).toContain('--no-dependency-outputs');
                expect(flagNames).toContain('--out-dir');
                expect(flagNames).toContain('--provider-cache');
                expect(flagNames).toContain('--provider-cache-token');
                expect(flagNames).toContain('--dependency-fetch-output-from-state');
                expect(flagNames).toContain('--no-hooks');
                expect(flagNames).toContain('--destroy-dependencies-check');
                expect(flagNames).toContain('--report-file');
                expect(flagNames).toContain('--report-schema-file');
                expect(flagNames).not.toContain('--terragrunt-config');
            });

            it('should use current TG_ environment variables', () => {
                const optionsWithEnv = cmd?.options.filter(option => option.envVar) ?? [];

                expect(optionsWithEnv.length).toBeGreaterThan(0);
                expect(optionsWithEnv.every(option => option.envVar?.startsWith('TG_'))).toBe(true);
                expect(optionsWithEnv.map(option => option.envVar)).toContain('TG_CONFIG');
            });

            it('should have --all option with correct properties', () => {
                const allOption = cmd?.options.find(o => o.flag === '--all');
                expect(allOption).toBeDefined();
                expect(allOption?.shortFlag).toBe('-a');
                expect(allOption?.type).toBe('boolean');
                expect(allOption?.description).toContain('all modules');
            });

            it('should have multiple examples', () => {
                expect(cmd?.examples.length).toBeGreaterThan(3);
            });

            it('should retain run-all only as a migration lookup name', () => {
                expect(cmd?.aliases).not.toContain('run-all');
                expect(cmd?.legacyNames).toContain('run-all');
            });

            it('should not advertise unsupported short flags or hidden deprecated queue flags', () => {
                const graph = cmd?.options.find(option => option.flag === '--graph');
                const filter = cmd?.options.find(option => option.flag === '--filter');
                const parallelism = cmd?.options.find(option => option.flag === '--parallelism');

                expect(graph?.shortFlag).toBeUndefined();
                expect(filter?.shortFlag).toBeUndefined();
                expect(parallelism?.shortFlag).toBeUndefined();
                expect(cmd?.options.some(option => option.flag === '--queue-exclude-external')).toBe(false);
            });
        });

        describe('hcl fmt command', () => {
            let cmd: CLICommand | null;

            beforeEach(() => {
                cmd = manager.getCommand('hcl fmt');
            });

            it('should have formatting options', () => {
                const flagNames = cmd?.options.map(o => o.flag);
                expect(flagNames).toContain('--check');
                expect(flagNames).toContain('--diff');
                expect(flagNames).toContain('--file');
                expect(flagNames).toContain('--stdin');
                expect(flagNames).toContain('--exclude-dir');
                expect(flagNames).not.toContain('--write');
            });

            it('should distinguish the fmt alias from removed hclfmt command', () => {
                expect(cmd?.aliases).toContain('fmt');
                expect(cmd?.legacyNames).toContain('hclfmt');
            });

            it('should include CI/CD usage note', () => {
                expect(cmd?.notes?.some(n => n.includes('CI') || n.includes('pre-commit'))).toBe(true);
            });
        });

        describe('browse command', () => {
            it('should document the required experiment', () => {
                const cmd = manager.getCommand('browse');

                expect(cmd?.usage).toContain('--experiment browse-tui');
                expect(cmd?.notes).toContain('Requires the browse-tui experiment.');
                expect(cmd?.relatedCommands).toEqual(expect.arrayContaining(['find', 'list']));
                expect(cmd?.options.map(option => option.envVar)).toEqual(expect.arrayContaining([
                    'TG_BROWSE_FEATURE',
                    'TG_BROWSE_NO_DISCOVERY_AUTH_PROVIDER_CMD',
                ]));
            });
        });

        describe('hcl validate command', () => {
            it('should replace validate-inputs with the inputs flag', () => {
                const cmd = manager.getCommand('hcl validate');
                const flagNames = cmd?.options.map(option => option.flag);

                expect(flagNames).toContain('--inputs');
                expect(cmd?.examples.some(example => example.command.includes('--inputs'))).toBe(true);
            });
        });

        describe('catalog command', () => {
            it('should document current output formats and experiment gate', () => {
                const cmd = manager.getCommand('catalog');
                const format = cmd?.options.find(option => option.flag === '--format');

                expect(format?.description).toContain('jsonl');
                expect(format?.description).toContain('md');
                expect(cmd?.notes?.some(note => note.includes('catalog-format'))).toBe(true);
            });
        });

        describe('plan command', () => {
            let cmd: CLICommand | null;

            beforeEach(() => {
                cmd = manager.getCommand('plan');
            });

            it('should be a shortcut command', () => {
                expect(cmd?.category).toBe('shortcut');
            });

            it('should have terraform-style options', () => {
                const flagNames = cmd?.options.map(o => o.flag);
                expect(flagNames).toContain('-out');
                expect(flagNames).toContain('-target');
                expect(flagNames).toContain('-var');
            });

            it('should mention equivalence to run -- plan', () => {
                expect(cmd?.notes?.some(n => n.includes('run -- plan'))).toBe(true);
                expect(cmd?.notes?.some(n => n.includes('run --all -- plan'))).toBe(true);
            });

            it('should inherit current run options', () => {
                const flagNames = cmd?.options.map(option => option.flag);

                expect(flagNames).toContain('--filter');
                expect(flagNames).toContain('--provider-cache');
                expect(flagNames).toContain('--report-file');
            });
        });

        describe('corrected command metadata', () => {
            it('should document backend delete safety semantics', () => {
                const cmd = manager.getCommand('backend delete');
                const force = cmd?.options.find(option => option.flag === '--force');

                expect(cmd?.description).toContain('state');
                expect(cmd?.details).toContain('does not delete the backing bucket');
                expect(force?.description).toContain('versioning');
            });

            it('should document backend migrate positional arguments', () => {
                const cmd = manager.getCommand('backend migrate');

                expect(cmd?.usage).toContain('<src-unit> <dst-unit>');
                expect(cmd?.options.map(option => option.flag)).not.toEqual(expect.arrayContaining(['--from', '--to']));
                expect(cmd?.examples[0].command).toContain('./old-unit ./new-unit');
            });

            it('should describe stack clean as generated-stack cleanup', () => {
                const cmd = manager.getCommand('stack clean');

                expect(cmd?.examples[0].description).toBe('Remove the generated stack');
            });

            it('should use the current scaffold output-folder option', () => {
                const cmd = manager.getCommand('scaffold');

                expect(cmd?.options.some(option => option.flag === '--output-folder')).toBe(true);
                expect(cmd?.options.some(option => option.flag === '--output')).toBe(false);
            });

            it('should document dag graph as fixed DOT output', () => {
                const cmd = manager.getCommand('dag graph');

                expect(cmd?.options).toEqual([]);
                expect(cmd?.details).toContain('DOT graph');
                expect(cmd?.examples.some(example => example.command.includes('mermaid'))).toBe(false);
            });

            it('should not advertise an unsupported info print json flag', () => {
                const cmd = manager.getCommand('info print');

                expect(cmd?.options.some(option => option.flag === '--json')).toBe(false);
                expect(cmd?.options.some(option => option.flag === '--filter')).toBe(true);
            });
        });

        describe('backend bootstrap command', () => {
            let cmd: CLICommand | null;

            beforeEach(() => {
                cmd = manager.getCommand('backend bootstrap');
            });

            it('should exist with bootstrap alias', () => {
                expect(cmd).not.toBeNull();
                expect(cmd?.aliases).toContain('bootstrap');
            });

            it('should describe backend creation', () => {
                expect(cmd?.description).toContain('remote state');
            });

            it('should relate to other backend commands', () => {
                expect(cmd?.relatedCommands).toContain('backend delete');
                expect(cmd?.relatedCommands).toContain('backend migrate');
            });
        });
    });

    describe('option data completeness', () => {
        it('should have required fields for all options', () => {
            const commands = manager.getAllCommands();
            
            for (const cmd of commands) {
                for (const opt of cmd.options) {
                    expect(opt.flag).toBeDefined();
                    expect(opt.flag.startsWith('-')).toBe(true);
                    expect(opt.type).toBeDefined();
                    expect(['boolean', 'string', 'integer', 'list', 'path']).toContain(opt.type);
                    expect(opt.description).toBeDefined();
                    expect(opt.description.length).toBeGreaterThan(0);
                }
            }
        });

        it('should have consistent short flag format', () => {
            const commands = manager.getAllCommands();
            
            for (const cmd of commands) {
                for (const opt of cmd.options) {
                    if (opt.shortFlag) {
                        expect(opt.shortFlag.startsWith('-')).toBe(true);
                        expect(opt.shortFlag.length).toBe(2); // e.g., "-a"
                    }
                }
            }
        });
    });

    describe('example data completeness', () => {
        it('should have required fields for all examples', () => {
            const commands = manager.getAllCommands();
            
            for (const cmd of commands) {
                for (const ex of cmd.examples) {
                    expect(ex.description).toBeDefined();
                    expect(ex.description.length).toBeGreaterThan(0);
                    expect(ex.command).toBeDefined();
                    expect(ex.command.length).toBeGreaterThan(0);
                    expect(ex.command).toContain('terragrunt');
                }
            }
        });

        it('should have at least one example per command', () => {
            const commands = manager.getAllCommands();

            for (const cmd of commands) {
                expect(cmd.examples.length).toBeGreaterThan(0);
            }
        });
    });

    describe('upstream CLI command parity', () => {
        // Documented command pages become space-joined command names:
        //   /reference/cli/commands/backend/migrate/ -> "backend migrate"
        //   /reference/cli/commands/info/strict/     -> "info strict"
        // opentofu-shortcuts is a page for the shortcut commands, checked separately.
        const documentedCommands = TERRAGRUNT_DOC_MANIFEST
            .map((entry) => entry[1])
            .filter((p) => p.startsWith('/reference/cli/commands/'))
            .map((p) => p.replace('/reference/cli/commands/', '').replace(/\/$/, ''))
            .filter((slug) => slug !== 'opentofu-shortcuts')
            .map((slug) => slug.split('/').join(' '));

        it('resolves every documented command in the manager', () => {
            // Guard against a vacuous pass: if the manifest shape/paths changed
            // and no command pages were discovered, `missing` would be empty and
            // the test would pass without checking. The pinned revision has 20.
            expect(documentedCommands.length, 'no documented command pages found — manifest shape may have changed').toBeGreaterThanOrEqual(15);
            const manager = new CLICommandsManager();
            const missing = documentedCommands.filter((name) => manager.getCommand(name) === null);
            expect(missing, `Documented upstream commands missing from CLICommandsManager: ${missing.join(', ')}`).toEqual([]);
        });

        it('provides the OpenTofu shortcut commands', () => {
            const manager = new CLICommandsManager();
            for (const shortcut of ['plan', 'apply', 'destroy']) {
                expect(manager.getCommand(shortcut), shortcut).not.toBeNull();
            }
        });
    });

    describe('info strict command', () => {
        it('exposes info strict with the strict-controls description', () => {
            const manager = new CLICommandsManager();
            const cmd = manager.getCommand('info strict');
            expect(cmd).not.toBeNull();
            expect(cmd?.category).toBe('configuration');
            expect(cmd?.description.toLowerCase()).toContain('strict controls');
            expect(cmd?.documentationUrl).toContain('/reference/cli/commands/info/strict/');
        });
    });
});
