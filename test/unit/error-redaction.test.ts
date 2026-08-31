import { describe, it, expect } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';

const matcher = new ErrorPatternMatcher(new TerragruntDocsManager());

describe('secret preservation in diagnosis', () => {
  it('does not echo credentials from an OCI credential-helper failure', async () => {
    const errorText =
      'oci credential helper "docker-credential-ecr" for registry.example.com: ' +
      'exit status 1: password=SUPERSECRET123 token=abcTOKEN Authorization: Bearer zzzBEARER';

    const result = await matcher.diagnoseError(errorText, {}, { enableFuzzyMatching: false });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('SUPERSECRET123');
    expect(serialized).not.toContain('abcTOKEN');
    expect(serialized).not.toContain('zzzBEARER');
    // The diagnosis itself still lands on the OCI helper pattern.
    expect(result.matches[0]?.pattern.id).toBe('oci-credential-helper-failed');
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
});
