import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ReadEnv = (name: string) => string | undefined;

describe('readEnv', () => {
  let readEnv: ReadEnv;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    delete process.env.TERRAGRUNT_MCP_ENVTEST;
    delete process.env.TERRAGRUNT_ENVTEST;
    vi.resetModules(); // the one-time warning state lives in the module
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    ({ readEnv } = await import('../../src/terragrunt/env.js'));
  });

  afterEach(() => {
    errorSpy.mockRestore();
    stdoutSpy.mockRestore();
    delete process.env.TERRAGRUNT_MCP_ENVTEST;
    delete process.env.TERRAGRUNT_ENVTEST;
  });

  it('prefers the TERRAGRUNT_MCP_ name without a warning', () => {
    process.env.TERRAGRUNT_MCP_ENVTEST = 'new';
    process.env.TERRAGRUNT_ENVTEST = 'old';
    expect(readEnv('ENVTEST')).toBe('new');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('falls back to the old name and warns once on stderr', () => {
    process.env.TERRAGRUNT_ENVTEST = 'old';
    expect(readEnv('ENVTEST')).toBe('old');
    expect(readEnv('ENVTEST')).toBe('old');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toContain('TERRAGRUNT_ENVTEST');
    expect(message).toContain('TERRAGRUNT_MCP_ENVTEST');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('returns undefined when neither is set', () => {
    expect(readEnv('ENVTEST')).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
