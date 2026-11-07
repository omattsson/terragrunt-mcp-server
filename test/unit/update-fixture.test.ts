import { describe, it, expect } from 'vitest';
import {
  checkDocsAgainstManifest,
  refusalMessage,
  DOCS_BASE_URL,
} from '../../scripts/update-fixture.js';

type Entry = readonly [title: string, path: string, description?: string];

const manifest: readonly Entry[] = [
  ['Contributing', '/community/contributing/'],
  ['catalog', '/reference/hcl/blocks/catalog/', 'HCL block.'],
  ['catalog', '/reference/cli/commands/catalog/', 'CLI command.'],
  ['Functions', '/reference/hcl/functions/'],
];

const doc = (title: string, path: string) => ({ title, url: `${DOCS_BASE_URL}${path}` });

const matching = () => [
  doc('Contributing', '/community/contributing/'),
  doc('catalog', '/reference/hcl/blocks/catalog/'),
  doc('catalog', '/reference/cli/commands/catalog/'),
  doc('Functions', '/reference/hcl/functions/'),
];

describe('checkDocsAgainstManifest', () => {
  it('accepts pages that match the manifest in titles, order and URLs', () => {
    expect(checkDocsAgainstManifest(matching(), manifest)).toEqual({ ok: true, problems: [] });
  });

  it('reports a page count difference', () => {
    const result = checkDocsAgainstManifest(matching().slice(0, 3), manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/3 pages.*4/);
  });

  it('names a page that the manifest does not know', () => {
    const live = [...matching(), doc('Brand New Page', '/features/brand-new-page/')];
    const result = checkDocsAgainstManifest(live, manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('"Brand New Page"');
  });

  it('names a manifest page that the live list lacks', () => {
    const live = matching().filter(d => d.title !== 'Contributing');
    const result = checkDocsAgainstManifest(live, manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/missing.*"Contributing"/i);
  });

  it('reports a different order when the titles are the same', () => {
    const live = matching();
    [live[0], live[3]] = [live[3], live[0]];
    const result = checkDocsAgainstManifest(live, manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/order.*position 1.*"Functions".*"Contributing"/is);
  });

  it('reports a page that got a fallback URL even when titles and order match', () => {
    const live = matching();
    live[2] = doc('catalog', '/reference/cli/commands/catalog-2/');
    const result = checkDocsAgainstManifest(live, manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/fallback URL/i);
    expect(result.problems.join('\n')).toContain('/reference/cli/commands/catalog-2/');
  });

  it('reports two pages that swapped their manifest URLs', () => {
    const live = matching();
    live[1] = doc('catalog', '/reference/cli/commands/catalog/');
    live[2] = doc('catalog', '/reference/hcl/blocks/catalog/');
    const result = checkDocsAgainstManifest(live, manifest);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/position 2/);
  });

  it('accepts an empty manifest only for an empty page list', () => {
    expect(checkDocsAgainstManifest([], []).ok).toBe(true);
    expect(checkDocsAgainstManifest(matching(), []).ok).toBe(false);
  });
});

describe('refusalMessage', () => {
  it('lists the problems and says how to proceed', () => {
    const msg = refusalMessage(['3 pages, the manifest has 4']);
    expect(msg).toContain('3 pages, the manifest has 4');
    expect(msg).toContain('npm run update-docs-manifest');
    expect(msg).toMatch(/newer checkout|re-pin/i);
    expect(msg).toMatch(/wait/i);
    expect(msg).toMatch(/not (been )?(written|changed|touched)|left (it )?untouched/i);
  });

  it('truncates a long problem list', () => {
    const problems = Array.from({ length: 60 }, (_, i) => `problem ${i}`);
    const msg = refusalMessage(problems);
    expect(msg).toContain('problem 0');
    expect(msg).not.toContain('problem 59');
    expect(msg).toMatch(/and \d+ more/);
  });
});
