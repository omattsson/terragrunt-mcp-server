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

  it('gates known CLI options on their experiments', () => {
    const flagExperiment = (cmdName: string, flag: string): string | undefined => {
      const cmd = cli.getCommand(cmdName);
      return cmd?.options.find((o) => o.flag === flag)?.experiment;
    };
    // These four live in the shared getRunCommandOptions(), so 'run' exposes them.
    expect(flagExperiment('run', '--discovery-boundary')).toBe('bounded-discovery');
    expect(flagExperiment('run', '--no-hooks')).toBe('optional-hooks');
    expect(flagExperiment('run', '--no-dependency-outputs')).toBe('optional-dependency-outputs');
    expect(flagExperiment('run', '--dependency-fetch-output-from-state')).toBe('dependency-fetch-output-from-state');
    expect(flagExperiment('catalog', '--format')).toBe('catalog-format');
  });

  it('gates the dependency expansion attribute on block-iteration', () => {
    const dep = hcl.getBlock('dependency');
    expect(dep?.attributes.find((a) => a.name === 'expansion')?.experiment).toBe('block-iteration');
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
    // update_source_with_cas belongs to the completed CAS experiment (default), not gated.
    const stack = hcl.getBlock('stack');
    expect(stack?.attributes.find((a) => a.name === 'update_source_with_cas')?.experiment).toBeUndefined();
  });
});
