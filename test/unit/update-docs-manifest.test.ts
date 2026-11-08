import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  isReleased,
  isPublished,
  hasRenderableBody,
  docsPages,
  hclPages,
  commandPages,
  statusPages,
  orderedEntryPages,
  deriveManifestPages,
  renderManifest,
  readUpstreamRevision,
  type SourceFile,
  type ManifestPage,
} from '../../scripts/update-docs-manifest.js';

const file = (id: string, frontmatter: string, body = 'Body text.\n'): SourceFile => ({
  id,
  content: `---\n${frontmatter}\n---\n\n${body}`,
});

describe('parseFrontmatter', () => {
  it('parses plain, quoted and nested values and returns the body', () => {
    const { data, body } = parseFrontmatter(
      `---\ntitle: "Quoted: title"\nslug: a/b\nhero:\n  title: Hero\n  tagline: 'It''s here'\n---\n\n# Body\n`,
    );
    expect(data).toEqual({ title: 'Quoted: title', slug: 'a/b', hero: { title: 'Hero', tagline: "It's here" } });
    expect(body).toBe('\n# Body\n');
  });

  it('treats " #" in a plain scalar as a YAML comment, like the upstream docs build', () => {
    const { data } = parseFrontmatter('---\ndescription: Migration guide to adopt changes from RFC #3445\n---\nbody');
    expect(data.description).toBe('Migration guide to adopt changes from RFC');
  });

  it('keeps "#" inside quoted scalars and without a leading space', () => {
    const { data } = parseFrontmatter('---\na: "RFC #3445"\nb: issue#12\n---\n');
    expect(data).toEqual({ a: 'RFC #3445', b: 'issue#12' });
  });

  it('parses folded and literal block scalars', () => {
    const { data } = parseFrontmatter('---\ndescription: >-\n  first line\n  second line\nusage: |\n  a\n  b\n---\n');
    expect(data.description).toBe('first line second line');
    expect(data.usage).toBe('a\nb\n');
  });

  it('handles CRLF line endings', () => {
    const { data, body } = parseFrontmatter('---\r\ntitle: T\r\n---\r\nBody\r\n');
    expect(data).toEqual({ title: 'T' });
    expect(body).toBe('Body\r\n');
  });

  it('returns empty data when there is no frontmatter or it is empty', () => {
    expect(parseFrontmatter('# Just markdown\n')).toEqual({ data: {}, body: '# Just markdown\n' });
    expect(parseFrontmatter('---\n---\nBody').data).toEqual({});
  });

  it('throws on invalid YAML so a broken page never yields a wrong entry', () => {
    expect(() => parseFrontmatter('---\ntitle: [unclosed\n---\n')).toThrow();
  });
});

describe('release gating', () => {
  it('compares versions numerically', () => {
    expect(isReleased('v1.2.1', 'v1.2.1')).toBe(true);
    expect(isReleased('v1.2.0', 'v1.2.1')).toBe(true);
    expect(isReleased('v1.2.2', 'v1.2.1')).toBe(false);
    expect(isReleased('v1.0.10', 'v1.0.7')).toBe(false);
    expect(isReleased('v0.99.9', 'v1.0.0')).toBe(true);
  });

  it('publishes content without a since value and rejects malformed versions', () => {
    expect(isPublished(undefined, 'v1.2.1')).toBe(true);
    expect(isPublished('v1.2.2', 'v1.2.1')).toBe(false);
    expect(() => isPublished('1.2.2', 'v1.2.1')).toThrow(/vX\.Y\.Z/);
    expect(() => isPublished(42, 'v1.2.1')).toThrow();
  });
});

describe('hasRenderableBody', () => {
  it('is false for empty bodies and placeholders that hold only comments', () => {
    expect(hasRenderableBody(undefined)).toBe(false);
    expect(hasRenderableBody('')).toBe(false);
    expect(hasRenderableBody('\n<!-- stub -->\n')).toBe(false);
    expect(hasRenderableBody('{/* mdx comment */}\n<!-- a -->\n')).toBe(false);
  });

  it('is true when any content remains', () => {
    expect(hasRenderableBody('Text')).toBe(true);
    expect(hasRenderableBody('<!-- c -->\n## Heading')).toBe(true);
    expect(hasRenderableBody("import X from 'x';\n")).toBe(true);
  });
});

describe('docsPages', () => {
  it('sorts by slug, builds the URL from the slug and prefers hero title and tagline', () => {
    const pages = docsPages(
      [
        file('02/b.mdx', 'title: B page\ndescription: B desc\nslug: process/b'),
        file('01/a.mdx', 'title: A page\ndescription: A desc\nslug: guides/a'),
        file('00/home.mdx', 'title: Home\ndescription: ignored\nslug: community/home\nhero:\n  title: Hero title\n  tagline: Hero tagline'),
      ],
      'v1.2.1',
    );
    expect(pages).toEqual<ManifestPage[]>([
      { title: 'Hero title', path: '/community/home/', description: 'Hero tagline' },
      { title: 'A page', path: '/guides/a/', description: 'A desc' },
      { title: 'B page', path: '/process/b/', description: 'B desc' },
    ]);
  });

  it('drops drafts, placeholders, unpublished pages and keeps an empty description as ""', () => {
    const pages = docsPages(
      [
        file('a.mdx', 'title: Keep\nslug: x/keep'),
        file('b.mdx', 'title: Draft\nslug: x/draft\ndraft: true'),
        file('c.md', 'title: Stub\nslug: x/stub', '<!-- only a comment -->\n'),
        file('d.mdx', 'title: Future\nslug: x/future\nsince: v1.2.2'),
        file('e.mdx', 'title: Released\nslug: x/released\nsince: v1.2.0'),
      ],
      'v1.2.1',
    );
    expect(pages.map(p => [p.title, p.description])).toEqual([
      ['Keep', ''],
      ['Released', ''],
    ]);
  });

  it('fails loudly when a page has no slug or no title', () => {
    expect(() => docsPages([file('dir/noslug.mdx', 'title: T')], 'v1.2.1')).toThrow(/dir\/noslug\.mdx.*slug/);
    expect(() => docsPages([file('dir/notitle.mdx', 'slug: a/b')], 'v1.2.1')).toThrow(/dir\/notitle\.mdx.*title/);
  });
});

describe('descriptions as the llms parser sees them', () => {
  it('drops the trailing newline of a literal block scalar (found against the live render command)', () => {
    const pages = commandPages(
      [file('render.mdx', 'name: render\npath: render\ndescription: |\n  Render the config.')],
      'v1.2.1',
    );
    expect(pages[0].description).toBe('Render the config.');
  });

  it('keeps only the first line of a multi-line description', () => {
    const pages = hclPages(
      'blocks',
      [file('x.mdx', 'name: x\ndescription: |\n  First line.\n  Second line.')],
      'v1.2.1',
    );
    expect(pages[0].description).toBe('First line.');
  });

  it('trims hero taglines the same way', () => {
    const pages = docsPages(
      [file('h.mdx', 'title: H\nslug: a/h\nhero:\n  tagline: |\n    Tagline.\n')],
      'v1.2.1',
    );
    expect(pages[0].description).toBe('Tagline.');
  });
});

describe('hclPages', () => {
  it('sorts by name, builds /reference/hcl/<kind>/<name>/ and honors since', () => {
    const pages = hclPages(
      'functions',
      [
        file('get_env.mdx', 'name: get_env\ndescription: Read an env var.'),
        file('a_new.mdx', 'name: a_new\ndescription: Not released.\nsince: v1.2.2'),
        file('find_in_parent_folders.mdx', 'name: find_in_parent_folders\ndescription: Walk up.'),
      ],
      'v1.2.1',
    );
    expect(pages).toEqual<ManifestPage[]>([
      { title: 'find_in_parent_folders', path: '/reference/hcl/functions/find_in_parent_folders/', description: 'Walk up.' },
      { title: 'get_env', path: '/reference/hcl/functions/get_env/', description: 'Read an env var.' },
    ]);
  });
});

describe('commandPages', () => {
  it('sorts by path and uses the path in the URL, the name as the title', () => {
    const pages = commandPages(
      [
        file('run.mdx', 'name: run\ndescription: Run things.\npath: run'),
        file('stack/run.mdx', 'name: run\ndescription: Run a stack.\npath: stack/run'),
        file('backend/bootstrap.mdx', 'name: bootstrap\ndescription: Bootstrap.\npath: backend/bootstrap'),
        file('exec.mdx', 'name: exec\ndescription: Exec.\npath: exec\nsince: v9.0.0'),
      ],
      'v1.2.1',
    );
    expect(pages.map(p => [p.title, p.path])).toEqual([
      ['bootstrap', '/reference/cli/commands/backend/bootstrap/'],
      ['run', '/reference/cli/commands/run/'],
      ['run', '/reference/cli/commands/stack/run/'],
    ]);
  });
});

describe('statusPages', () => {
  it('lists the generated experiment and strict control pages in upstream order', () => {
    const pages = statusPages();
    expect(pages.map(p => p.path)).toEqual([
      '/reference/experiments/active/',
      '/reference/experiments/completed/',
      '/reference/strict-controls/active/',
      '/reference/strict-controls/completed/',
    ]);
    expect(pages.map(p => p.title)).toEqual([
      'Active Experiments',
      'Completed Experiments',
      'Active Strict Controls',
      'Completed Strict Controls',
    ]);
    for (const p of pages) expect(p.description.length).toBeGreaterThan(0);
  });
});

describe('orderedEntryPages (FAQ and patterns)', () => {
  const faq = [
    file('zeta.mdx', 'question: Zeta question\ndescription: Z'),
    file('alpha.md', 'question: Alpha question\ndescription: A'),
    file('first.mdx', 'question: Ordered first\ndescription: F\norder: 1'),
    file('nested/deep.mdx', 'question: Mid question\ndescription: M\norder: 5'),
  ];

  it('sorts by order ascending, then by title; entries without order come last', () => {
    const pages = orderedEntryPages('faq', faq, '/process/faq/');
    expect(pages.map(p => p.title)).toEqual(['Ordered first', 'Mid question', 'Alpha question', 'Zeta question']);
  });

  it('uses the file path without extension as the URL id', () => {
    const pages = orderedEntryPages('faq', faq, '/process/faq/');
    expect(pages.map(p => p.path)).toEqual([
      '/process/faq/first/',
      '/process/faq/nested/deep/',
      '/process/faq/alpha/',
      '/process/faq/zeta/',
    ]);
  });

  it('reads the title from the "title" key for patterns', () => {
    const pages = orderedEntryPages(
      'patterns',
      [file('b.mdx', 'title: B\ndescription: bd\nauthor: x'), file('a.mdx', 'title: A\ndescription: ad\nauthor: x')],
      '/guides/patterns/',
    );
    expect(pages).toEqual<ManifestPage[]>([
      { title: 'A', path: '/guides/patterns/a/', description: 'ad' },
      { title: 'B', path: '/guides/patterns/b/', description: 'bd' },
    ]);
  });
});

describe('deriveManifestPages', () => {
  const sources = {
    docs: [file('a.mdx', 'title: Doc\nslug: guides/doc\ndescription: D')],
    hclBlocks: [file('catalog.mdx', 'name: catalog\ndescription: Block.')],
    hclAttributes: [file('prevent_destroy.mdx', 'name: prevent_destroy\ndescription: Attr.')],
    hclFunctions: [file('get_env.mdx', 'name: get_env\ndescription: Fn.')],
    commands: [file('catalog.mdx', 'name: catalog\ndescription: Cmd.\npath: catalog')],
    faq: [file('q.mdx', 'question: Q?\ndescription: Answer.')],
    patterns: [file('p.mdx', 'title: P\ndescription: Pattern.\nauthor: me')],
  };

  it('concatenates sources in the upstream llms order', () => {
    const pages = deriveManifestPages(sources, 'v1.2.1');
    expect(pages.map(p => p.path)).toEqual([
      '/guides/doc/',
      '/reference/hcl/blocks/catalog/',
      '/reference/hcl/attributes/prevent_destroy/',
      '/reference/hcl/functions/get_env/',
      '/reference/cli/commands/catalog/',
      '/reference/experiments/active/',
      '/reference/experiments/completed/',
      '/reference/strict-controls/active/',
      '/reference/strict-controls/completed/',
      '/process/faq/q/',
      '/guides/patterns/p/',
    ]);
  });

  it('throws when two pages share a URL, or share a title and description', () => {
    const dupUrl = { ...sources, docs: [...sources.docs, file('b.mdx', 'title: Other\nslug: guides/doc')] };
    expect(() => deriveManifestPages(dupUrl, 'v1.2.1')).toThrow(/duplicate URL.*\/guides\/doc\//);
    const dupKey = { ...sources, docs: [...sources.docs, file('b.mdx', 'title: Doc\nslug: guides/doc2\ndescription: D')] };
    expect(() => deriveManifestPages(dupKey, 'v1.2.1')).toThrow(/same title and description/);
  });
});

describe('renderManifest', () => {
  const pages: ManifestPage[] = [
    { title: 'Caching', path: '/features/caching/', description: 'Caching description' },
    { title: 'Overview', path: '/getting-started/overview/', description: 'Get an overview' },
    { title: 'Overview', path: '/reference/cli/', description: 'Learn the CLI' },
    { title: "What's next", path: '/guides/whats-next/', description: 'Next' },
    { title: 'Say "hi"', path: '/x/hi/', description: '' },
    { title: "It's \"both\"", path: '/x/both/', description: '' },
    { title: 'run', path: '/reference/cli/commands/run/', description: "Run it's" },
    { title: 'run', path: '/reference/cli/commands/stack/run/', description: 'Run a stack.' },
  ];
  const out = renderManifest(pages, { revision: 'a'.repeat(40), release: 'v1.2.1' });

  it('keeps the existing file shape and exports', () => {
    expect(out).toContain(`export const UPSTREAM_REVISION = '${'a'.repeat(40)}';`);
    expect(out).toContain('export const TERRAGRUNT_DOC_MANIFEST = [');
    expect(out.trimEnd().endsWith('] as const;')).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('writes a description only when the title occurs more than once', () => {
    expect(out).toContain("  ['Caching', '/features/caching/'],\n");
    expect(out).toContain("  ['Overview', '/getting-started/overview/', 'Get an overview'],\n");
    expect(out).toContain("  ['Overview', '/reference/cli/', 'Learn the CLI'],\n");
    expect(out).toContain("  ['run', '/reference/cli/commands/stack/run/', 'Run a stack.'],\n");
  });

  it('quotes strings the way the existing manifest does', () => {
    expect(out).toContain(`  ["What's next", '/guides/whats-next/'],\n`);
    expect(out).toContain(`  ['Say "hi"', '/x/hi/'],\n`);
    expect(out).toContain(`  ['It\\'s "both"', '/x/both/'],\n`);
    expect(out).toContain(`  ['run', '/reference/cli/commands/run/', "Run it's"],\n`);
  });

  it('names the release in the header and is deterministic', () => {
    expect(out).toContain('v1.2.1');
    expect(renderManifest(pages, { revision: 'a'.repeat(40), release: 'v1.2.1' })).toBe(out);
  });

  it('produces a module that evaluates to the same pages', async () => {
    const js = out
      .replace(/export const UPSTREAM_REVISION/, 'const UPSTREAM_REVISION')
      .replace(/export const TERRAGRUNT_DOC_MANIFEST/, 'const TERRAGRUNT_DOC_MANIFEST')
      .replace(/ as const;/, ';');
    const manifest = new Function(`${js}\nreturn TERRAGRUNT_DOC_MANIFEST;`)() as Array<[string, string, string?]>;
    expect(manifest.map(e => [e[0], e[1]])).toEqual(pages.map(p => [p.title, p.path]));
  });
});

describe('readUpstreamRevision', () => {
  it('reads the revision from an existing manifest source', () => {
    const src = `/** doc */\nexport const UPSTREAM_REVISION = '${'b'.repeat(40)}';\n\nexport const X = [];\n`;
    expect(readUpstreamRevision(src)).toBe('b'.repeat(40));
  });

  it('throws when the manifest has no revision', () => {
    expect(() => readUpstreamRevision('export const X = 1;')).toThrow(/UPSTREAM_REVISION/);
  });
});
