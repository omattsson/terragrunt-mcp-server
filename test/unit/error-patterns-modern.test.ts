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

// Each anchor is verbatim upstream error text, re-checked at the revision in
// UPSTREAM_REVISION (9f78f47697cff20bb159421ff2e54cd5e16caa04). Every case asserts the exact regex
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
    ['cannot set both "tag" and "digest" arguments', 'oci-tag-digest-conflict'],
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

describe('modern diagnosis: CAS', () => {
  const cases: Array<[string, string]> = [
    ['unit "vpc" in terragrunt.hcl sets update_source_with_cas = true, which requires the --no-cas flag to be unset', 'cas-update-source-requires-cas'],
    ['update_source_with_cas does not support absolute sources', 'cas-source-absolute'],
    ['update_source_with_cas source escapes repository root', 'cas-source-escapes-repo'],
    ['update_source_with_cas requires a literal source string', 'cas-source-not-literal'],
    ['update_source_with_cas must be true, false, or an expression of literals and locals that call no functions', 'cas-update-source-not-constant'],
    ['CAS reference hash must be lowercase hex (40 characters for sha1, 64 for sha256)', 'cas-ref-invalid'],
    ['CAS reference missing expected hash algorithm prefix', 'cas-ref-invalid'],
    ['CAS reference has empty hash', 'cas-ref-invalid'],
    ['failed to complete git clone', 'cas-git-clone-failed'],
    ['tree not found in CAS store', 'cas-tree-not-found'],
    ['object abc123 not present in central git store after fetching v1 from https://example.invalid/r.git', 'cas-git-store-object-missing'],
    // internal/cas/errors.go and pkg/config/errors.go at the pinned revision
    // CASRewriteRequiredError wraps only non-final CAS errors (casFailureIsFinal in pkg/config/stack.go), such as ErrGitClone.
    ['unit "app" sets update_source_with_cas, which only the CAS can rewrite, and fetching it through the CAS failed: failed to complete git clone', 'cas-rewrite-fetch-failed'],
    ['update_source_with_cas rewrite could not be completed: failed to rewrite stack file /s/terragrunt.stack.hcl: boom', 'cas-rewrite-incomplete'],
    ['update_source_with_cas sources nest too deep; look for a source that points back at its own stack (16 levels): /s', 'cas-rewrite-too-deep'],
    // As upstream emits it: a nested processDirectory call wraps it in ErrRewriteIncomplete.
    ['failed to fetch stack "app" via CAS: update_source_with_cas rewrite could not be completed: failed to process stack "net" source: update_source_with_cas sources nest too deep; look for a source that points back at its own stack (64 levels): /tmp/x', 'cas-rewrite-too-deep'],
    ['failed to fetch git::https://example.invalid/r.git through CAS: boom', 'cas-stack-package-fetch-failed'],
    ['git::https://example.invalid/r.git has no key an online run could record for --cas-offline; pin the source, for example with a literal checksum=sha256:<hex>, or drop the flag', 'cas-offline-unrecordable'],
  ];
  it('puts the CAS wrapper ahead of the pattern of a non-CAS error it wraps', async () => {
    // Every regex match scores 0.95 and ties keep list order, so the wrapper
    // must come before module-git-auth-failed (module source group).
    const text = 'unit "app" sets update_source_with_cas, which only the CAS can rewrite, and fetching it through the CAS failed: fatal: could not read from remote repository';
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids[0]).toBe('cas-rewrite-fetch-failed');
    expect(ids).toContain('module-git-auth-failed');
  });

  it.each([
    ['failed to fetch s3::https://s3.amazonaws.com/acme/stack.zip through CAS: AccessDenied: Access Denied', 'cas-stack-package-fetch-failed'],
    ['update_source_with_cas rewrite could not be completed: failed to rewrite stack file /s/terragrunt.stack.hcl: permission denied', 'cas-rewrite-incomplete'],
  ])('ranks the CAS wrapper first when it wraps an access error: %s', async (text, id) => {
    // "permission denied" alone also matches backend-access-denied, which
    // would give S3/IAM advice for a CAS fetch.
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids[0]).toBe(id);
    expect(ids).toContain('backend-access-denied');
  });

  it('ranks the CAS wrapper ahead of the git clone error it wraps', async () => {
    const text = 'failed to fetch git::https://example.invalid/stacks.git?ref=v1 through CAS: failed to complete git clone: exit status 128';
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids[0]).toBe('cas-stack-package-fetch-failed');
    expect(ids).toContain('cas-git-clone-failed');
  });

  it.each([
    'failed to complete git clone: git@github.com: Permission denied (publickey).',
    'failed to fetch git::ssh://git@github.com/acme/r.git through CAS: failed to complete git clone: git@github.com: Permission denied (publickey).',
    'failed to complete git clone: Host key verification failed.',
    'failed to complete git clone: git@git.example.internal: Permission denied (password,publickey).',
    'failed to complete git clone: git@git.example.internal: Permission denied (keyboard-interactive).',
  ])('diagnoses an SSH git failure as git auth, not backend access: %s', async (text) => {
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids).toContain('module-git-auth-failed');
    expect(ids).not.toContain('backend-access-denied');
    if (!text.includes('through CAS')) expect(ids[0]).toBe('module-git-auth-failed');
  });

  it('keeps a filesystem permission error with the backend pattern', async () => {
    const result = await matcher.diagnoseError('Error acquiring the state lock: permission denied (os error 13)', {}, { enableFuzzyMatching: false });
    expect(result.matches.map((m) => m.pattern.id)).toContain('backend-access-denied');
  });

  it('describes the git clone error without assuming CAS', async () => {
    const m = await topMatch('failed to complete git clone: exit status 128', false);
    expect(m.pattern.id).toBe('cas-git-clone-failed');
    expect(m.pattern.name).toBe('Git clone failed');
    expect(m.pattern.description).toMatch(/standard git getter/);
  });

  it('does not put the git clone error ahead of the cause when the standard getter fails', async () => {
    // internal/getter/git.go clones with the same internal/git runner as CAS,
    // so the message is not CAS-only; the auth failure in it is the cause.
    const text = [
      "error downloading 'git::ssh://git@github.com/acme/private.git?ref=v1.0.0': git_clone: Cloning into '/tmp/x'...",
      'git@github.com: Permission denied (publickey).',
      'fatal: Could not read from remote repository.',
      ': failed to complete git clone',
      'exit status 128',
    ].join('\n');
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids).toContain('module-git-auth-failed');
    expect(ids[0]).not.toBe('cas-git-clone-failed');
  });

  it.each([
    ['update_source_with_cas rewrite could not be completed: failed to resolve source for unit "app": update_source_with_cas source escapes repository root: "../../x"', 'cas-source-escapes-repo', 'cas-rewrite-incomplete'],
    ['update_source_with_cas rewrite could not be completed: failed to resolve terraform source "/abs/mod": update_source_with_cas does not support absolute sources: "/abs/mod"', 'cas-source-absolute', 'cas-rewrite-incomplete'],
    ['failed to fetch cas::sha1:abc through CAS: tree not found in CAS store', 'cas-tree-not-found', 'cas-stack-package-fetch-failed'],
    ['failed to fetch git::https://example.invalid/r.git through CAS: git::https://example.invalid/r.git has no key an online run could record for --cas-offline; pin the source, for example with a literal checksum=sha256:<hex>, or drop the flag', 'cas-offline-unrecordable', 'cas-stack-package-fetch-failed'],
    ['update_source_with_cas rewrite could not be completed: git::https://example.invalid/r.git has no key an online run could record for --cas-offline; pin the source, for example with a literal checksum=sha256:<hex>, or drop the flag', 'cas-offline-unrecordable', 'cas-rewrite-incomplete'],
  ])('ranks the specific CAS error ahead of the CAS wrapper around it: %s', async (text, inner, wrapper) => {
    // These wrappers only say "read the wrapped error", so the inner CAS
    // diagnosis is the useful one (upstream internal/cas/stacks.go,
    // pkg/config/stack.go StackPackageFetchError).
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids[0]).toBe(inner);
    expect(ids).toContain(wrapper);
  });

  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('cas');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: dependency cycles and outputs', () => {
  // pkg/config/errors.go: DependencyCycleError, ReadTerragruntConfigCycleError,
  // TerragruntOutputTargetNoOutputs
  const cases: Array<[string, string]> = [
    ['Found a dependency cycle between modules: /infra/vpc -> /infra/app -> /infra/vpc', 'dep-circular'],
    ['read_terragrunt_config cycle detected: a.hcl -> b.hcl -> a.hcl', 'dep-read-config-cycle'],
    ['/infra/vpc/terragrunt.hcl is a dependency of /infra/app/terragrunt.hcl but detected no outputs. Either the target module has not been applied yet, or the module has no outputs.', 'dep-outputs-unavailable'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id) => {
    const m = await topMatch(text, false);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe('dependency');
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: component contracts', () => {
  // pkg/config/errors.go: ValuesBlockInIncludeError, DeclaredOutputMissingError,
  // DependencyNullConfigPathError
  const cases: Array<[string, string, string]> = [
    ['/repo/root.hcl declares a values block, but it is included by another config or generated as an autoinclude. Move the block to the terragrunt.hcl or terragrunt.stack.hcl of the component.', 'values-block-in-include', 'configuration'],
    ['/repo/vpc/terragrunt.hcl declares output "vpc_id" in its outputs block, but its state has no output "vpc_id". Apply /repo/vpc/terragrunt.hcl after adding the output to its module, remove the declaration, or set merge_with_state = "shallow" in its mock_strategy block, with the command in allowed_commands, to fill it from mock_value.', 'dep-declared-output-missing', 'dependency'],
    ['/repo/app/terragrunt.hcl: dependency vpc sets config_path to null; set it to a path, or set enabled to false', 'dep-config-path-null', 'dependency'],
    // Address() prints an expanded instance as name[key], unquoted, so the key can hold spaces.
    ['/repo/app/terragrunt.hcl: dependency vpc[us east] sets config_path to null; set it to a path, or set enabled to false', 'dep-config-path-null', 'dependency'],
  ];
  it.each(cases)('matches %s -> %s at 0.95', async (text, id, category) => {
    const m = await topMatch(text, false);
    expect(m.pattern.id).toBe(id);
    expect(m.pattern.category).toBe(category);
    expect(m.confidence).toBe(0.95);
  });
});

describe('modern diagnosis: experiment gates', () => {
  const gated = [
    "the 'browse' command requires the 'browse-tui' experiment to be enabled (set --experiment browse-tui or TG_EXPERIMENT=browse-tui)",
    "the 'login' command requires the 'tg-login' experiment to be enabled (set --experiment tg-login or TG_EXPERIMENT=tg-login)",
    "the 'mcp' command requires the 'mcp-command' experiment to be enabled (set --experiment mcp-command or TG_EXPERIMENT=mcp-command)",
    "base64gzip_compat in x requires the 'base64gzip-compat' experiment; enable it with --experiment base64gzip-compat",
    "--cas-offline requires the 'offline-cas' experiment to be enabled (e.g., --experiment=offline-cas)",
    "terraform.no_dot_terragrunt_cache in /repo/app/terragrunt.hcl requires the 'no-dot-terragrunt-cache' experiment; enable it with --experiment no-dot-terragrunt-cache",
    "the '--outputs' flag requires the 'outputs-block' experiment to be enabled (set --experiment outputs-block or TG_EXPERIMENT=outputs-block)",
    // The "needs the <name> experiment. Enable it with --experiment" wording.
    '/repo/app/terragrunt.hcl declares a values block, which needs the values-block experiment. Enable it with --experiment values-block or TG_EXPERIMENT=values-block, or remove the block.',
    '/repo/vpc/terragrunt.hcl declares an outputs block, which needs the outputs-block experiment. Enable it with --experiment outputs-block or TG_EXPERIMENT=outputs-block, or remove the block.',
    'Unknown variable; There is no variable named "path". The `path` variable needs the path-variable experiment. Enable it with --experiment path-variable or TG_EXPERIMENT=path-variable.',
  ];
  it.each(gated)('flags experiment-not-enabled distinctly', async (text) => {
    const m = await topMatch(text, false);
    expect(m.pattern.id).toBe('experiment-required');
    expect(m.pattern.category).toBe('experiment');
  });

  it('diagnoses a Terraform path attribute ahead of the path-variable hint', async () => {
    // hintUnknownPath adds the hint to any unknown `path` root, so path.module
    // gets it too, but the experiment does not define path.module.
    for (const attr of ['module', 'root', 'cwd']) {
      const text = `/repo/app/terragrunt.hcl:3,12-16: Unknown variable; There is no variable named "path". The \`path\` variable needs the path-variable experiment. Enable it with --experiment path-variable or TG_EXPERIMENT=path-variable.\n  3:   source = "\${path.${attr}}/modules/vpc"`;
      const m = await topMatch(text, false);
      expect(m.pattern.id).toBe('path-terraform-attribute');
      expect(m.confidence).toBe(0.95);
    }
  });

  it('checks a long log with many path.module lines in linear time', async () => {
    // diagnoseError trims long input to 5000 characters, so test the regex
    // itself. An unbounded [\s\S]* between the two parts rescans the rest of
    // the log from every path.module: about 11 s for these 20000 lines.
    await matcher.loadPatterns();
    const { patterns } = matcher as unknown as { patterns: Array<{ id: string; regex: RegExp }> };
    const { regex } = patterns.find((p) => p.id === 'path-terraform-attribute')!;
    const log = '  for_each = fileset("${path.module}/assets", "**")\n'.repeat(20000);
    const started = performance.now();
    expect(regex.test(log)).toBe(false);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it('does not pair the hint for path.unit with an unrelated OpenTofu path.module', async () => {
    const text = [
      '/repo/app/terragrunt.hcl:3,20-29: Unknown variable; There is no variable named "path". The `path` variable needs the path-variable experiment. Enable it with --experiment path-variable or TG_EXPERIMENT=path-variable.',
      '  3:   inputs = { dir = path.unit }',
      'Error: Error in function call',
      '  on main.tf line 2:',
      '   2:   f = file("${path.module}/a")',
    ].join('\n');
    const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
    const ids = result.matches.map((m) => m.pattern.id);
    expect(ids[0]).toBe('experiment-required');
    expect(ids).not.toContain('path-terraform-attribute');
  });

  // Upstream (hclparse/parser.go, internal/view/human_render.go) prints the
  // source line before the detail that carries the hint.
  const pathHint = 'There is no variable named "path". The `path` variable needs the path-variable experiment. Enable it with --experiment path-variable or TG_EXPERIMENT=path-variable.';

  it.each([
    ['HCL diagnostic writer', ['Error: Unknown variable', '', '  on terragrunt.hcl line 5, in generate "provider":', '   5:   contents = file("${path.module}/provider.tf")', '', pathHint]],
    ['human renderer', ['Error: Unknown variable', ' --> terragrunt.hcl:5:20', '5 |   contents = file("${path.module}/provider.tf")', `  = ${pathHint}`]],
  ])('diagnoses a Terraform path attribute in the %s layout, even with a .tf file on the line', async (_layout, lines) => {
    const m = await topMatch((lines as string[]).join('\n'), false);
    expect(m.pattern.id).toBe('path-terraform-attribute');
  });

  it.each([
    ['an OpenTofu error printed before the hint', ['Error: Error in function call', '  on main.tf line 2:', '   2:   f = file("${path.module}/a")', `/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }']],
    ['only an Error: line between them', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', 'Error: Invalid function argument', '   2:   f = file("${path.module}/a")']],
    ['a second Terragrunt diagnostic after the hint', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', '/repo/b/terragrunt.hcl:7,3-9: Unsupported attribute; x = path.module']],
    ['a Terragrunt location in human-render form after the hint', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', ' --> b/terragrunt.hcl:7:3', '7 |   x = path.module']],
    ['only an OpenTofu .tf.json location between them', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', '  on main.tf.json line 2:', '   2:   "src": "${path.module}"']],
    ['only an Error: line before the hint', ['   2:   f = file("${path.module}/a")', 'Error: Unknown variable', `  ${pathHint}`]],
    ['only an OpenTofu location before the hint', ['   2:   f = file("${path.module}/a")', '  on main.tf line 9:', `  ${pathHint}`]],
    ['more than 400 characters apart', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, ...Array(10).fill('  # ' + 'x'.repeat(60)), '   2:   f = file("${path.module}/a")']],
    ['only an OpenTofu .tofu location between them', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', '│ Warning: Deprecated attribute', '│   on main.tofu line 2:', '│    2:   src = path.module']],
    ['only an OpenTofu location between them', [`/repo/app/terragrunt.hcl:3,20-29: Unknown variable; ${pathHint}`, '  3:   inputs = { dir = path.unit }', '  on main.tf line 2:', '   2:   f = file("${path.module}/a")']],
  ])('does not pair the hint with a path.module from another diagnostic: %s', async (_case, lines) => {
    const result = await matcher.diagnoseError((lines as string[]).join('\n'), {}, { enableFuzzyMatching: false });
    expect(result.matches.map((m) => m.pattern.id)).not.toContain('path-terraform-attribute');
  });

  it('checks a long log with many hint lines in linear time', async () => {
    await matcher.loadPatterns();
    const { patterns } = matcher as unknown as { patterns: Array<{ id: string; regex: RegExp }> };
    const { regex } = patterns.find((p) => p.id === 'path-terraform-attribute')!;
    const log = `${pathHint}\n`.repeat(10000);
    const started = performance.now();
    expect(regex.test(log)).toBe(false);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it('matches the path-variable hint whatever its case', async () => {
    const text = 'The PATH variable needs the Path-Variable experiment.\n  3:   source = "${path.module}/x"';
    const m = await topMatch(text, false);
    expect(m.pattern.id).toBe('path-terraform-attribute');
  });

  it('does not diagnose path.module in OpenTofu output without the Terragrunt hint', async () => {
    // path.module is valid in .tf code; OpenTofu prints it in source snippets.
    const texts = [
      'Error: Invalid for_each argument\n  on main.tf line 8, in resource "aws_s3_object" "this":\n   8:   for_each = fileset("${path.module}/assets", "**")\nThe "for_each" set includes values derived from resource attributes that cannot be determined until apply',
      'Error: Error in function call\n  on main.tf line 3:\n   3:   source = file("${path.module}/src/handler.py")\n    │ path.module is "."\nCall to function "file" failed: no file exists at "./src/handler.py".',
    ];
    for (const text of texts) {
      const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
      expect(result.matches.every((m) => m.pattern.id !== 'path-terraform-attribute')).toBe(true);
    }
  });

  it('does not treat path.unit or a path_relative function as a Terraform path attribute', async () => {
    for (const text of ['source = "${path.unit}/x"', 'path_relative_to_include() returned x', 'path.modules is not set']) {
      const result = await matcher.diagnoseError(text, {}, { enableFuzzyMatching: false });
      expect(result.matches.every((m) => m.pattern.id !== 'path-terraform-attribute')).toBe(true);
    }
  });

  it('names both gate wordings in the first solution step', async () => {
    const m = await topMatch(gated[0], false);
    expect(m.solutions[0].explanation).toMatch(/requires the/);
    expect(m.solutions[0].explanation).toMatch(/needs the/);
  });

  it('does not treat a plain "needs the ... experiment" sentence as a gate', async () => {
    const result = await matcher.diagnoseError(
      'this setup needs the latest experiment results before it runs',
      {},
      { enableFuzzyMatching: false },
    );
    expect(result.matches.every((m) => m.pattern.id !== 'experiment-required')).toBe(true);
  });

  it('does not flag malformed configuration as an experiment gate', async () => {
    const result = await matcher.diagnoseError('unsupported argument "foo"', {}, { enableFuzzyMatching: false });
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every((m) => m.pattern.id !== 'experiment-required')).toBe(true);
  });

  it('cites only experiment names present in the #252 inventory', () => {
    const known = new Set(EXPERIMENTS.map((e) => e.name));
    const cited = [
      'browse-tui', 'tg-login', 'mcp-command', 'deep-merge', 'base64gzip-compat', 'offline-cas',
      'outputs-block', 'values-block', 'path-variable',
    ];
    for (const name of cited) {
      expect(known.has(name), name).toBe(true);
    }
  });
});

describe('modern diagnosis: enrichment labels new categories correctly', () => {
  it('labels related engine errors as engine, not configuration', async () => {
    const result = await matcher.diagnoseError(
      'engine init failed',
      {},
      { enableFuzzyMatching: false, enrichWithDocs: true },
    );
    expect('relatedErrorDetails' in result).toBe(true);
    const related = (result as { relatedErrorDetails: Array<{ category: string }> }).relatedErrorDetails;
    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.category).toBe('engine');
    }
  });

  it('labels related CAS errors as cas', async () => {
    const result = await matcher.diagnoseError(
      'tree not found in CAS store',
      {},
      { enableFuzzyMatching: false, enrichWithDocs: true },
    );
    const related = (result as { relatedErrorDetails: Array<{ category: string }> }).relatedErrorDetails;
    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.category).toBe('cas');
    }
  });

  it('does not mislabel an OCI credential related error as authentication', async () => {
    const result = await matcher.diagnoseError(
      'oci credential helper "docker-credential-ecr" for registry.example.com: exit status 1',
      {},
      { enableFuzzyMatching: false, enrichWithDocs: true },
    );
    const related = (result as { relatedErrorDetails: Array<{ category: string }> }).relatedErrorDetails;
    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.category).toBe('oci');
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
