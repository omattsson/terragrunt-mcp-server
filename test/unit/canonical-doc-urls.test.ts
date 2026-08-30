import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const STATIC_DOC_FILES = [
  '.github/ISSUE_TEMPLATE/config.yml',
  'README.md',
  'docs/Advanced-Backend-Templates.md',
  'docs/Architecture-Overview.md',
  'docs/Available-Tools.md',
  'docs/Best-Practices-Guide.md',
  'docs/Caching-System.md',
  'docs/Configuration-Generator.md',
  'docs/Development-Guide.md',
  'docs/FAQ.md',
  'docs/Functions-Reference.md',
  'docs/HCL-Validation.md',
  'docs/Lazy-Loading.md',
  'docs/MCP-Protocol-Compliance.md',
  'docs/README.md',
  'fixtures/README.md',
  'src/terragrunt/advanced-examples.ts',
  'src/terragrunt/best-practices.ts',
  'src/terragrunt/cli-commands.ts',
  'src/terragrunt/comparisons.ts',
  'src/terragrunt/docs.ts',
  'src/terragrunt/error-patterns.ts',
  'src/terragrunt/hcl-blocks.ts',
  'scripts/update-fixture.ts',
];

const TERRAGRUNT_URL_PATTERN = /https:\/\/(?:docs\.terragrunt\.com|terragrunt\.gruntwork\.io)(?:\/[^'"`\s)]*)?/g;
const LEGACY_PATHS = [
  '/docs/',
  '/reference/config-blocks-and-attributes/',
  '/reference/built-in-functions/',
  '/reference/cli-options/',
];

describe('static Terragrunt documentation URLs', () => {
  it.each(STATIC_DOC_FILES)('%s uses canonical documentation URLs', async file => {
    const source = await readFile(resolve(process.cwd(), file), 'utf8');
    const urls = source.match(TERRAGRUNT_URL_PATTERN) ?? [];

    expect(source).not.toContain('terragrunt.gruntwork.io');
    expect(source).not.toContain('docs.terragrunt.com/docs/');
    expect(source).not.toContain('docs.terragrunt.com%2Fdocs%2F');
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/docs\.terragrunt\.com(?:\/|$)/);
      for (const legacyPath of LEGACY_PATHS) {
        expect(url).not.toContain(legacyPath);
      }
    }
  });
});
