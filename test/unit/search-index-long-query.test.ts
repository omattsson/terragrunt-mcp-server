import { describe, it, expect } from 'vitest';
import { extractDottedIdentifiers, tokenize } from '../../src/terragrunt/search-index.js';

describe('extractDottedIdentifiers', () => {
  // The previous implementation, kept here as the reference for equivalence.
  const reference = (lower: string): string[] =>
    lower.match(/[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+/g) ?? [];

  it('finds terragrunt file names and dotted paths', () => {
    expect(extractDottedIdentifiers('edit terragrunt.stack.hcl and root.hcl, not plain')).toEqual([
      'terragrunt.stack.hcl',
      'root.hcl',
    ]);
  });

  it('skips leading digits and underscores like the previous regex', () => {
    expect(extractDottedIdentifiers('9foo.bar _baz.qux 1_2x.y')).toEqual(['foo.bar', 'baz.qux', 'x.y']);
  });

  it('returns the same matches as the previous regex on random short inputs', () => {
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const alphabet = ['a', 'b', 'z', '0', '9', '_', '.', ' ', '-', '/'];
    for (let i = 0; i < 20_000; i++) {
      const length = next() % 24;
      let text = '';
      for (let j = 0; j < length; j++) {
        text += alphabet[next() % alphabet.length];
      }
      expect(extractDottedIdentifiers(text), JSON.stringify(text)).toEqual(reference(text));
    }
  });
});

// A search query is attacker-controlled input and tokenize() runs synchronously on
// the event loop, so its cost must stay linear in the query length: one long query
// must not be able to block every other client.
describe('tokenize cost on long queries', () => {
  const LIMIT_MS = 2000;

  const cases: Array<[string, string]> = [
    ['one long run of letters', 'a'.repeat(200_000)],
    ['digit/letter alternation', '1a'.repeat(100_000)],
    ['underscore/letter alternation', '_a'.repeat(100_000)],
    ['dotted segments that never form an identifier', 'a.1'.repeat(70_000)],
    ['one long run with a single trailing dot', `${'a'.repeat(200_000)}.`],
  ];

  for (const [name, text] of cases) {
    it(`stays fast for ${name}`, () => {
      const started = performance.now();
      tokenize(text);
      expect(performance.now() - started).toBeLessThan(LIMIT_MS);
    }, 30_000);
  }
});
