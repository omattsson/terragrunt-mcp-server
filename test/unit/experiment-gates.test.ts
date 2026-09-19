import { describe, it, expect } from 'vitest';
import { CLICommandsManager } from '../../src/terragrunt/cli-commands.js';
import { HCLBlocksManager } from '../../src/terragrunt/hcl-blocks.js';
import { getExperiment } from '../../src/terragrunt/experiments.js';

describe('experiment gates on data', () => {
  const cli = new CLICommandsManager();
  const hcl = new HCLBlocksManager();

  it('gates browse on browse-tui', () => {
    expect(cli.getCommand('browse')?.experiment).toBe('browse-tui');
  });

  it('gates active CLI options on their experiments', () => {
    const flagExperiment = (cmdName: string, flag: string): string | undefined => {
      const cmd = cli.getCommand(cmdName);
      return cmd?.options.find((o) => o.flag === flag)?.experiment;
    };
    expect(flagExperiment('run', '--cas-offline')).toBe('offline-cas');
    expect(flagExperiment('run', '--cas-refresh')).toBe('offline-cas');
    expect(flagExperiment('run', '--cas-probe-ttl')).toBe('offline-cas');
  });

  it('gates the engine block on iac-engine', () => {
    expect(hcl.getBlock('engine')?.experiment).toBe('iac-engine');
  });

  it('only references known experiment names', () => {
    const names: (string | undefined)[] = [];
    for (const c of cli.getAllCommands()) {
      names.push(c.experiment);
      for (const o of c.options) names.push(o.experiment);
    }
    for (const b of hcl.listBlocks()) {
      names.push(b.experiment);
      for (const a of b.attributes) names.push(a.experiment);
    }
    const unknown = names.filter((n): n is string => !!n && !getExperiment(n));
    expect(unknown, `unknown experiment names on data: ${unknown.join(', ')}`).toEqual([]);
  });

  it('does not gate completed features as experiments', () => {
    const run = cli.getCommand('run');
    for (const flag of [
      '--discovery-boundary',
      '--no-hooks',
      '--no-dependency-outputs',
      '--dependency-fetch-output-from-state',
      '--no-dependency-fetch-output-from-state',
    ]) {
      expect(run?.options.find((option) => option.flag === flag)?.experiment, flag).toBeUndefined();
    }
    expect(cli.getCommand('catalog')?.options.find((option) => option.flag === '--format')?.experiment).toBeUndefined();

    for (const blockName of ['dependency', 'unit', 'stack']) {
      expect(hcl.getBlock(blockName)?.attributes.find((attribute) => attribute.name === 'expansion')?.experiment).toBeUndefined();
    }
    for (const blockName of ['unit', 'stack']) {
      expect(hcl.getBlock(blockName)?.attributes.find((attribute) => attribute.name === 'enabled')?.experiment).toBeUndefined();
    }
    expect(hcl.getBlock('terraform')?.attributes.find((attribute) => attribute.name === 'version')?.experiment).toBeUndefined();
    expect(hcl.getBlock('generate')?.attributes.find((attribute) => attribute.name === 'mutable')?.experiment).toBeUndefined();
  });
});
