/**
 * DocSearchIndex - ranking quality and behaviour
 *
 * The golden queries run against the bundled offline docs fixture, so ranking
 * regressions fail CI without network access. Each query lists the pages that
 * count as a correct answer; one of them must rank in the top 3.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DocSearchIndex, buildSnippet, normalizeTerm, tokenize, SearchableDoc } from '../../src/terragrunt/search-index.js';

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'terragrunt-docs-fixture.json'
);
const BASE = 'https://docs.terragrunt.com';

/** [query, acceptable top-3 paths] */
const GOLDEN_QUERIES: Array<[string, string[]]> = [
  ['remote state s3', ['/features/units/state-backend/s3/']],
  ['dependency mock_outputs', ['/reference/hcl/blocks/']],
  ['how to use run --all', ['/reference/cli/commands/run/']],
  ['find_in_parent_folders', ['/reference/hcl/functions/']],
  ['dependency', ['/reference/hcl/blocks/']],
  ['install terragrunt', ['/getting-started/install/']],
  ['provider cache server', ['/features/caching/provider-cache-server/']],
  ['before_hook after_hook', ['/features/units/hooks/']],
  ['feature flags', ['/features/units/runtime-control/']],
  ['azure storage backend', ['/features/units/state-backend/azurerm/']],
  ['gcs backend', ['/features/units/state-backend/gcs/']],
  ['stack generate', ['/reference/cli/commands/stack/generate/']],
  ['terragrunt.stack.hcl', ['/features/stacks/explicit/']],
  ['include expose', ['/features/units/includes/']],
  ['run_cmd', ['/reference/hcl/functions/']],
  ['strict controls', ['/reference/strict-controls/']],
  ['experiments', ['/reference/experiments/']],
  ['drift detection', ['/terragrunt-scale/drift-detection/']],
  ['opentelemetry tracing', ['/troubleshooting/open-telemetry/']],
  ['debugging', ['/troubleshooting/debugging/']],
  ['filter by git changes', ['/features/filter/git/']],
  ['oci registry', ['/features/units/oci/']],
  ['content addressable store', ['/features/caching/cas/']],
  ['lock file', ['/features/units/lock-files/']],
  ['aws authentication', ['/features/units/authentication/aws/']],
  ['migrate from root terragrunt.hcl', ['/migrate/migrating-from-root-terragrunt-hcl/']],
  ['auto init', ['/features/units/auto-init/']],
  ['extra_arguments', ['/features/units/extra-arguments/']],
  ['backend bootstrap', ['/reference/cli/commands/backend/bootstrap/']],
  ['generate block', ['/reference/hcl/blocks/']],
  // Held out while tuning the ranking
  ['get_terragrunt_dir', ['/reference/hcl/functions/']],
  ['remote_state block', ['/reference/hcl/blocks/']],
  ['gcp authentication', ['/features/units/authentication/gcp/']],
  ['terragrunt cache directory', ['/features/units/terragrunt-cache/']],
  ['import existing resources', ['/features/units/importing/']],
  ['catalog scaffold', ['/features/catalog/scaffold/', '/reference/cli/commands/scaffold/']],
  ['hcl fmt', ['/reference/cli/commands/hcl/fmt/']],
  ['global flags', ['/reference/cli/global-flags/']],
  ['log formatting', ['/reference/logging/formatting/']],
  ['performance tuning', ['/troubleshooting/performance/']],
  ['supported terraform versions', ['/reference/supported-versions/']],
  ['engine plugin', ['/features/units/engine/']],
];

describe('DocSearchIndex', () => {
  let docs: SearchableDoc[];
  let index: DocSearchIndex;

  beforeAll(() => {
    docs = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    index = new DocSearchIndex(docs);
  });

  describe('golden queries against the docs fixture', () => {
    it.each(GOLDEN_QUERIES)('"%s" ranks an expected page in the top 3', (query, expected) => {
      const top3 = index.search(query).slice(0, 3).map(hit => hit.url.replace(BASE, ''));

      expect(top3.some(url => expected.includes(url)), `top 3: ${top3.join(', ')}`).toBe(true);
    });

    it('ranks the expected page first for most queries', () => {
      const firstPlace = GOLDEN_QUERIES.filter(([query, expected]) =>
        expected.includes(index.search(query)[0]?.url.replace(BASE, ''))
      );

      // 36 of 42 at the time of writing; leave headroom for fixture refreshes
      expect(firstPlace.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('search behaviour', () => {
    it('returns hits sorted by descending score', () => {
      const scores = index.search('remote state backend').map(hit => hit.score);

      expect(scores.length).toBeGreaterThan(1);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('returns nothing for an empty query or one with no matching terms', () => {
      expect(index.search('')).toEqual([]);
      expect(index.search('   ')).toEqual([]);
      expect(index.search('zzqxjv')).toEqual([]);
    });

    it('returns nothing for a query made only of stopwords', () => {
      expect(index.search('the')).toEqual([]);
      expect(index.search('how to')).toEqual([]);
      // "uses" stems to the stopword "use", so it is dropped as well
      expect(index.search('use uses')).toEqual([]);
    });

    it('expands a term that does not occur to indexed terms it prefixes', () => {
      const small = new DocSearchIndex([
        { url: 'https://x/boot', title: 'Bootstrap', section: 's', content: 'bootstrap the backend' },
        { url: 'https://x/other', title: 'Other', section: 's', content: 'unrelated text' },
      ]);

      expect(small.search('boot').map(hit => hit.url)).toEqual(['https://x/boot']);
      // Too short to expand
      expect(small.search('bo')).toEqual([]);
    });

    it('does not expand a term that occurs in the docs', () => {
      const small = new DocSearchIndex([
        { url: 'https://x/exact', title: 'Deploy', section: 's', content: 'deploy steps' },
        { url: 'https://x/prefix', title: 'Deployment', section: 's', content: 'deployment steps' },
      ]);

      expect(small.search('deploy')[0].url).toBe('https://x/exact');
      expect(small.search('deploy').map(hit => hit.url)).not.toContain('https://x/prefix');
    });

    it('prefers documents matching more of the query', () => {
      const small = new DocSearchIndex([
        { url: 'https://x/one', title: 'Alpha', section: 's', content: 'remote state configuration' },
        { url: 'https://x/both', title: 'Beta', section: 's', content: 'remote state stored in s3' },
      ]);

      expect(small.search('remote state s3')[0].url).toBe('https://x/both');
    });

    it('ranks a title match above a body-only match', () => {
      const small = new DocSearchIndex([
        { url: 'https://x/body', title: 'Other', section: 's', content: 'hooks hooks hooks are mentioned here' },
        { url: 'https://x/title', title: 'Hooks', section: 's', content: 'run commands before and after' },
      ]);

      expect(small.search('hooks')[0].url).toBe('https://x/title');
    });

    it('builds an index for the whole fixture quickly', () => {
      const start = performance.now();
      new DocSearchIndex(docs);
      const buildMs = performance.now() - start;

      const searchStart = performance.now();
      for (const [query] of GOLDEN_QUERIES) {
        index.search(query);
      }
      const perSearchMs = (performance.now() - searchStart) / GOLDEN_QUERIES.length;

      expect(buildMs).toBeLessThan(2000);
      expect(perSearchMs).toBeLessThan(50);
    });
  });

  describe('tokenize', () => {
    it('keeps underscore identifiers whole and adds their parts', () => {
      expect(tokenize('find_in_parent_folders')).toEqual(['find_in_parent_folders', 'find', 'parent', 'folder']);
    });

    it('keeps dotted file names whole and adds their words', () => {
      expect(tokenize('terragrunt.stack.hcl')).toEqual(['terragrunt.stack.hcl', 'terragrunt', 'stack', 'hcl']);
    });

    it('drops stopwords and punctuation such as CLI dashes', () => {
      expect(tokenize('How to use run --all')).toEqual(['run', 'all']);
    });

    it('applies light plural stemming but leaves identifiers exact', () => {
      expect(normalizeTerm('dependencies')).toBe('dependency');
      expect(normalizeTerm('outputs')).toBe('output');
      expect(normalizeTerm('access')).toBe('access');
      expect(normalizeTerm('status')).toBe('status');
      expect(normalizeTerm('mock_outputs')).toBe('mock_outputs');
    });

    it.each([
      ['branches', 'branch'],
      ['matches', 'match'],
      ['addresses', 'address'],
      ['boxes', 'box'],
      ['responses', 'response'],
      ['cases', 'case'],
      ['aliases', 'alias'],
      ['alias', 'alias'],
    ])('stems %s to %s, the same term as its singular', (word, expected) => {
      expect(normalizeTerm(word)).toBe(expected);
    });

    it('finds a singular document word from a plural query', () => {
      const small = new DocSearchIndex([
        { url: 'https://x/branch', title: 'Doc', section: 's', content: 'push to a branch' },
      ]);

      expect(small.search('branches').map(hit => hit.url)).toEqual(['https://x/branch']);
    });
  });

  describe('buildSnippet', () => {
    const content = `${'intro text '.repeat(60)}The mock_outputs attribute lets you plan before dependencies exist. ${'trailing text '.repeat(60)}`;

    it('centres the snippet on a query term', () => {
      const snippet = buildSnippet(content, 'dependency mock_outputs');

      expect(snippet).toContain('mock_outputs');
      expect(snippet.startsWith('...')).toBe(true);
      expect(snippet.endsWith('...')).toBe(true);
      expect(snippet.length).toBeLessThanOrEqual(306);
    });

    it('falls back to the start of the content when no query word occurs', () => {
      const snippet = buildSnippet(content, 'nonexistentword');

      expect(snippet.startsWith('intro text')).toBe(true);
      expect(snippet.length).toBeLessThanOrEqual(303);
    });

    it('matches whole words, not words inside other words', () => {
      const text = `Terragrunt ${'is a tool for many things. '.repeat(20)}Use run to execute commands. ${'more text '.repeat(40)}`;

      const snippet = buildSnippet(text, 'run');

      expect(snippet).toContain('Use run to execute');
      expect(snippet.startsWith('Terragrunt')).toBe(false);
    });

    it('falls back to word starts and identifier parts, never the inside of a word', () => {
      const text = `Terragrunt ${'filler words here '.repeat(40)}set mock_outputs on the dependency block. ${'filler words here '.repeat(40)}`;

      const snippet = buildSnippet(text, 'mock');

      expect(snippet).toContain('mock_outputs');
      expect(snippet.startsWith('Terragrunt')).toBe(false);
    });

    it('finds plural forms of a stemmed query word', () => {
      const text = `${'filler words here '.repeat(40)}All dependencies are resolved first. ${'filler words here '.repeat(40)}`;

      expect(buildSnippet(text, 'dependency')).toContain('dependencies are resolved');
    });

    it('returns short content unchanged', () => {
      expect(buildSnippet('short content', 'content')).toBe('short content');
    });
  });
});
