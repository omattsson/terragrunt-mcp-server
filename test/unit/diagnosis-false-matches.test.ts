import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

/**
 * diagnose_terragrunt_error must not return confident diagnoses for unrelated
 * input, and must recognise Terragrunt's own dependency errors (#294).
 */
describe('diagnose_terragrunt_error: false matches', () => {
  let toolHandler: ToolHandler;

  beforeAll(() => {
    toolHandler = new ToolHandler();
  });

  const diagnose = (errorMessage: string) =>
    toolHandler.executeTool('diagnose_terragrunt_error', { error_message: errorMessage });

  describe('no confident match', () => {
    it.each([
      'the quick brown fox jumped',
      'hello world',
      'something went wrong',
      'an unexpected problem occurred while running the command',
      'please check your configuration and try again',
      'lorem ipsum dolor sit amet consectetur',
      'qwerty12345 zxcvbn asdfgh completely nonsense jklmno pqrst'
    ])('returns an explicit no-match result for %j', async (text) => {
      const result = await diagnose(text);

      expect(result.success).toBe(true);
      expect(result.noConfidentMatch).toBe(true);
      expect(result.matchCount).toBe(0);
      expect(result.matches).toEqual([]);
      expect(result.overallConfidence).toBe(0);
      expect(result.message).toMatch(/no known error pattern matched/i);
      expect(result.debuggingSteps.length).toBeGreaterThan(0);
      expect(result.generalAdvice.length).toBeGreaterThan(0);
    });

    it('does not set noConfidentMatch when a pattern matches', async () => {
      const result = await diagnose('Error acquiring the state lock');

      expect(result.noConfidentMatch).toBeUndefined();
      expect(result.matches[0].patternId).toBe('state-lock-error');
    });
  });

  describe('dependency errors', () => {
    it.each([
      ['Error: Found a dependency cycle between modules: /infra/vpc -> /infra/app -> /infra/vpc', 'dep-circular'],
      ['read_terragrunt_config cycle detected: root.hcl -> env.hcl -> root.hcl', 'dep-read-config-cycle'],
      ['dependency cycle between vpc and app units', 'dep-circular']
    ])('diagnoses %j as %s', async (text, id) => {
      const result = await diagnose(text);

      expect(result.matches[0].patternId).toBe(id);
    });

    it('diagnoses empty dependency outputs and recommends mock_outputs', async () => {
      const result = await diagnose(`Error: Unsupported attribute

  on terragrunt.hcl line 12, in inputs:
  12:   vpc_id = dependency.vpc.outputs.vpc_id
    ├────────────────
    │ dependency.vpc.outputs is object with no attributes

This object does not have an attribute named "vpc_id".`);

      const top = result.matches[0];
      expect(top.patternId).toBe('dep-outputs-unavailable');
      expect(top.confidence).toBe(0.95);
      const commands = top.solutions.map((s: { command?: string }) => s.command ?? '').join('\n');
      expect(commands).toContain('mock_outputs =');
      expect(commands).toContain('mock_outputs_allowed_terraform_commands');
    });
  });

  describe('long output', () => {
    it('finds the error printed after long plan output', async () => {
      const plan = Array(200).fill('+ resource "aws_instance" "example" { ami = "ami-12345" }').join('\n');
      const result = await diagnose(`${plan}\n\nError: Error acquiring the state lock`);

      expect(result.matches[0].patternId).toBe('state-lock-error');
    });

    it('does not reuse cached results for long outputs that share a preamble', async () => {
      const plan = Array(200).fill('+ resource "aws_instance" "example" { ami = "ami-12345" }').join('\n');
      const lock = await diagnose(`${plan}\n\nError: Error acquiring the state lock`);
      const cycle = await diagnose(`${plan}\n\nError: Found a dependency cycle between modules: a -> b -> a`);

      expect(lock.matches[0].patternId).toBe('state-lock-error');
      expect(cycle.matches[0].patternId).toBe('dep-circular');
    });
  });
});
