import { describe, it, expect } from 'vitest';
import { documentedHclNames, type UpstreamDocPage } from './upstream-hcl-names.js';

const BASE = 'https://docs.example.test';

function page(url: string, content: string): UpstreamDocPage {
  return { url: `${BASE}${url}`, content };
}

const BLOCKS_PAGE = [
  '# Blocks',
  '',
  '## terraform',
  'Prose.',
  '### Nested heading',
  '## remote\\_state',
  '```hcl',
  '## not_a_heading_in_fence',
  '```',
  '~~~',
  '## also_in_tilde_fence',
  '~~~',
  '## Unit blocks',
  '- [catalog](/reference/hcl/blocks/catalog/)',
  '    ## indented_not_a_heading',
  '##no_space',
].join('\n');

describe('documentedHclNames', () => {
  it('reads line-start H2 identifiers and unescapes markdown underscores', () => {
    const names = documentedHclNames([page('/reference/hcl/blocks/', BLOCKS_PAGE)], 'blocks');
    expect([...names].sort()).toEqual(['remote_state', 'terraform']);
  });

  it('ignores H3 headings, fenced code, prose headings and indented lines', () => {
    const names = documentedHclNames([page('/reference/hcl/blocks/', BLOCKS_PAGE)], 'blocks');
    for (const unwanted of ['nested heading', 'not_a_heading_in_fence', 'also_in_tilde_fence', 'unit blocks', 'indented_not_a_heading', 'no_space']) {
      expect(names.has(unwanted)).toBe(false);
    }
  });

  it('adds per-item pages and ignores items of another kind or deeper paths', () => {
    const docs = [
      page('/reference/hcl/blocks/', BLOCKS_PAGE),
      page('/reference/hcl/blocks/catalog/', '# catalog\n\n## Usage'),
      page('/reference/hcl/attributes/prevent_destroy/', '# prevent_destroy'),
      page('/reference/hcl/blocks/catalog/extra/', '# extra'),
      page('/reference/cli/commands/catalog/', '# catalog'),
    ];
    expect([...documentedHclNames(docs, 'blocks')].sort()).toEqual(['catalog', 'remote_state', 'terraform']);
    expect([...documentedHclNames(docs, 'attributes')]).toEqual(['prevent_destroy']);
  });

  it('finds per-item pages even when the reference page is absent', () => {
    const docs = [page('/reference/hcl/functions/get_env/', '# get_env')];
    expect([...documentedHclNames(docs, 'functions')]).toEqual(['get_env']);
  });

  it('applies the exclusion list to both shapes', () => {
    const docs = [
      page('/reference/hcl/blocks/', BLOCKS_PAGE),
      page('/reference/hcl/blocks/catalog/', '# catalog'),
    ];
    const names = documentedHclNames(docs, 'blocks', { exclude: ['terraform', 'catalog'] });
    expect([...names]).toEqual(['remote_state']);
  });

  it('returns an empty set for an unrelated page set', () => {
    expect(documentedHclNames([page('/reference/cli/', '## run')], 'blocks').size).toBe(0);
  });
});
