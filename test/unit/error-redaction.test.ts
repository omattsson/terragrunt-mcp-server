import { describe, it, expect } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

const matcher = new ErrorPatternMatcher(new TerragruntDocsManager());

describe('secret preservation in diagnosis', () => {
  it('redacts a secret carried in caller-supplied context', async () => {
    // The caller-supplied context is merged into the diagnosis and echoed on
    // each match, so a secret in it must be redacted. This fails if redaction
    // is removed, unlike a check that only inspects the raw (never-echoed) input.
    const errorText =
      'oci credential helper "docker-credential-ecr" for registry.example.com: exit status 1';
    const result = await matcher.diagnoseError(
      errorText,
      { module: 'password=SUPERSECRET123', filePath: 'token=abcTOKEN' },
      { enableFuzzyMatching: false },
    );
    const serialized = JSON.stringify(result);

    expect(result.matches[0]?.pattern.id).toBe('oci-credential-helper-failed');
    expect(serialized).not.toContain('SUPERSECRET123');
    expect(serialized).not.toContain('abcTOKEN');
    expect(serialized).toContain('password=***');
    expect(serialized).toContain('token=***');
  });

  it('redacts a secret carried in an extracted context field', async () => {
    // state-lock-error matches (0.95) and the module value carries a secret,
    // so the per-match context is attached and must be redacted before echoing.
    const errorText = 'error acquiring the state lock for module: password=HUNTER2SECRET';
    const result = await matcher.diagnoseError(errorText, {}, { enableFuzzyMatching: false });
    const serialized = JSON.stringify(result);

    expect(result.matches[0]?.pattern.id).toBe('state-lock-error');
    expect(serialized).not.toContain('HUNTER2SECRET');
    expect(serialized).toContain('password=***');
  });

  it('redacts a secret carried in an extracted stack trace', async () => {
    const errorText = 'engine init failed\nStack trace:\n    at token=SECRETLINE runEngine';
    const result = await matcher.diagnoseError(errorText, {}, { enableFuzzyMatching: false });
    const serialized = JSON.stringify(result);

    expect(result.matches[0]?.pattern.id).toBe('engine-init-failed');
    expect(serialized).not.toContain('SECRETLINE');
  });
});
