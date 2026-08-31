import { describe, it, expect } from 'vitest';
import { ErrorPatternMatcher } from '../../src/terragrunt/error-patterns.js';
import { TerragruntDocsManager } from '../../src/terragrunt/docs.js';
import { EXPERIMENTS } from '../../src/terragrunt/experiments.js';

const matcher = new ErrorPatternMatcher(new TerragruntDocsManager());

async function topMatch(errorText: string, fuzzy = true) {
  const result = await matcher.diagnoseError(errorText, {}, { enableFuzzyMatching: fuzzy });
  expect(result.matches.length, `no match for: ${errorText}`).toBeGreaterThan(0);
  return result.matches[0];
}

// Each anchor is verbatim upstream error text at revision
// 2a4802eb604cc7175d9937a9d5303d66656b86ed. Every case asserts the exact regex
// pattern wins at 0.95, which is above the fuzzy ceiling of 0.85.

describe('modern diagnosis: stack validation', () => {
  const cases: Array<[string, string]> = [
    ['stack config cannot be nil', 'stack-config-nil'],
    ["unit 'vpc' has empty source", 'stack-component-field-empty'],
    ["duplicate unit name found: 'vpc'", 'stack-duplicate-name'],
    ["duplicate stack path found: '.terragrunt-stack/vpc'", 'stack-duplicate-path'],
    ["duplicate path found across unit and stack: 'x'", 'stack-cross-kind-path-collision'],
    ['stack unit vpc output fetch failed: boom', 'stack-output-fetch-failed'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('stack');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: block expansion', () => {
  const cases: Array<[string, string]> = [
    ['the unit block declares more than one expansion block; a block may declare at most one', 'expansion-duplicate-block'],
    ['the expansion block sets both for_each and count; set exactly one', 'expansion-conflicting-meta-args'],
    ['the expansion block sets neither for_each nor count; set exactly one', 'expansion-missing-meta-arg'],
    ['count must be a whole number: cannot convert', 'expansion-invalid-count'],
    ['count is -1; it must not be negative', 'expansion-negative-count'],
    ['count expands to 5000 instances, which is above the limit of 1000', 'expansion-limit-exceeded'],
    ['for_each is null; it must resolve to a concrete value', 'expansion-non-concrete-value'],
    ['for_each must be a set or a map, but got tuple', 'expansion-unsupported-foreach'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('configuration');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: OCI', () => {
  const cases: Array<[string, string]> = [
    ['oci source is missing a registry domain', 'oci-missing-registry'],
    ['oci source is missing a repository name', 'oci-missing-repository'],
    ['invalid oci repository name "Foo": must be lowercase', 'oci-invalid-repository'],
    ['invalid digest "sha256:xx": encoding/hex: invalid byte', 'oci-invalid-digest'],
    ['invalid tag "bad!tag": tag is not valid', 'oci-invalid-tag'],
    ['oci credential helper returned malformed output', 'oci-helper-malformed'],
    ['oci credential helper "docker-credential-ecr" for registry.example.com: exit status 1', 'oci-credential-helper-failed'],
    ['oci_credentials basic auth requires both a username and a password', 'oci-incomplete-basic-cred'],
    ['oci_credentials block must configure at most one credential style', 'oci-multiple-credential-styles'],
    ['expected exactly one "application/vnd.terragrunt.module.v1+zip" layer, found 2', 'oci-layer-count'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('oci');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: engine', () => {
  const cases: Array<[string, string]> = [
    ['engine init failed', 'engine-init-failed'],
    ['engine shutdown failed', 'engine-shutdown-failed'],
    ['engine source is empty, cannot create engine', 'engine-source-empty'],
    ['failed to download engine assets: connection reset', 'engine-download-assets'],
    ['checksum list has no entry for terragrunt-iac-engine-tofu', 'engine-integrity'],
    ['engine plugin spawn: not os-backed', 'engine-plugin-spawn'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('engine');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: managed azurerm state', () => {
  const cases: Array<[string, string]> = [
    ['opening dependency state at azurerm://acct/container/key: request failed', 'azurerm-dependency-state-open'],
    ['verify that resource_group_name, storage_account_name, and subscription_id in the remote_state block refer to resources that exist, and that the identity may list storage account keys: 403', 'azurerm-coordinates-permission'],
    ['cross-account state migration from storage account "a" to "b" is not supported by the azurerm backend', 'azurerm-cross-migration'],
    ['building azurerm state client: auth failed', 'azurerm-state-client-setup'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('backend');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: experiment gates', () => {
  const gated = [
    "the 'browse' command requires the 'browse-tui' experiment to be enabled (set --experiment browse-tui or TG_EXPERIMENT=browse-tui)",
    "the terraform block in x sets the version attribute, which requires the 'version-attribute' experiment; enable it with --experiment version-attribute",
    "the generate block \"backend\" in x sets the mutable attribute, which requires the 'mutable-generate' experiment; enable it with --experiment mutable-generate",
    "the azurerm backend is experimental and requires the 'azure-backend' experiment to be enabled (e.g. --experiment azure-backend or experiments = [\"azure-backend\"])",
  ];
  it.each(gated)('flags experiment-not-enabled distinctly', async (text) => {
    const m = await topMatch(text, false);
    expect(m.pattern.id).toBe('experiment-required');
    expect(m.pattern.category).toBe('experiment');
  });

  it('does not flag malformed configuration as an experiment gate', async () => {
    const result = await matcher.diagnoseError('unsupported argument "foo"', {}, { enableFuzzyMatching: false });
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every((m) => m.pattern.id !== 'experiment-required')).toBe(true);
  });

  it('cites only experiment names present in the #252 inventory', () => {
    const known = new Set(EXPERIMENTS.map((e) => e.name));
    const cited = [
      'browse-tui', 'bounded-discovery', 'optional-hooks',
      'optional-dependency-outputs', 'mutable-generate', 'version-attribute',
      'block-iteration', 'deep-merge', 'azure-backend',
    ];
    for (const name of cited) {
      expect(known.has(name), name).toBe(true);
    }
  });
});

describe('modern diagnosis: exact modern patterns outrank fuzzy matches', () => {
  it('keeps the exact modern match ranked above every fuzzy match', async () => {
    const result = await matcher.diagnoseError('engine init failed', {}, { enableFuzzyMatching: true });
    expect(result.matches[0].pattern.id).toBe('engine-init-failed');
    expect(result.matches[0].confidence).toBe(0.95);
    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i].confidence).toBeLessThanOrEqual(result.matches[0].confidence);
    }
  });
});
