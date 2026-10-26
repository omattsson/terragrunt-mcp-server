/**
 * DocSearchIndex - Relevance-ranked full-text search over Terragrunt docs
 *
 * BM25 ranking of the body text, plus additive bonuses for query terms found in
 * a document's title, URL slug, headings and section (in that order of weight).
 * The bonuses sit outside BM25's term-frequency saturation, so a title or URL
 * match still stands out on long pages that mention the term many times.
 * - Query terms are tokenized the same way as documents: lowercased,
 *   punctuation-aware, identifiers such as find_in_parent_folders kept whole
 *   (and also split into their parts), light plural stemming, stopwords dropped
 * - A query term that does not occur in the docs is expanded to indexed terms
 *   it is a prefix of ("boot" -> "bootstrap"), at reduced weight
 * - Documents matching more of the query terms rank higher (coverage factor),
 *   with bonuses for an exact title or heading match and the full query phrase
 */

export interface SearchableDoc {
  url: string;
  title: string;
  section: string;
  content: string;
}

export interface SearchHit {
  url: string;
  /** Relevance score (higher is better), rounded to 3 decimals */
  score: number;
}

type Field = 'title' | 'url' | 'headings' | 'section' | 'body';
type BonusField = Exclude<Field, 'body'>;

/**
 * Bonus when a query term appears in a field, in units of the term's idf for
 * that field: a word common in body text (e.g. "run") is still a strong signal
 * in the few titles that contain it.
 */
const FIELD_BONUSES: Record<BonusField, number> = {
  title: 3,
  url: 2,
  headings: 1,
  section: 0.5,
};
const BONUS_FIELDS = Object.keys(FIELD_BONUSES) as BonusField[];

/** BM25 term-frequency saturation and length normalization */
const K1 = 1.2;
const B = 0.75;

/** Multipliers for phrase, title and heading matches */
const EXACT_TITLE_BOOST = 2;
/** A heading that is exactly the query, e.g. the "dependency" entry of the blocks reference */
const EXACT_HEADING_BOOST = 1.75;
const TITLE_PHRASE_BOOST = 1.5;
const BODY_PHRASE_BOOST = 1.25;

/** Prefix expansion of query terms that do not occur in the docs */
const PREFIX_MIN_LENGTH = 3;
const PREFIX_MAX_EXPANSIONS = 10;
const PREFIX_WEIGHT = 0.5;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for',
  'from', 'how', 'i', 'in', 'into', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
  'should', 'that', 'the', 'this', 'to', 'use', 'using', 'what', 'when', 'where',
  'which', 'why', 'with', 'you', 'your',
]);

/** Matches the characters that make up a word, as a negated class for boundaries */
const WORD_CHARS = 'a-z0-9_';

/**
 * Normalize a single word: identifiers containing "_" are kept exact; other
 * words get light plural stemming (dependencies -> dependency, outputs -> output,
 * branches -> branch, aliases -> alias). Singular and plural map to the same term.
 */
export function normalizeTerm(word: string): string {
  if (word.includes('_') || word.length <= 3) {
    return word;
  }
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  // -es plurals of words ending in s, x, ch, sh (classes, boxes, branches) and -ias (aliases)
  if (/(sses|xes|ches|shes|iases)$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !/(ss|us|is|ias)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

/** Normalize a word, or return undefined when it (or its stem) is a stopword */
function toTerm(word: string): string | undefined {
  if (STOPWORDS.has(word)) {
    return undefined;
  }
  const term = normalizeTerm(word);
  return STOPWORDS.has(term) ? undefined : term;
}

/**
 * Tokenize text into normalized terms. Identifiers with underscores yield the
 * whole identifier plus each part, so "mock outputs" also matches mock_outputs.
 * Dotted file names (terragrunt.stack.hcl, root.hcl) are also kept whole, in
 * addition to their words. Stopwords are dropped, before and after stemming.
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9_]+/g) ?? [];
  const terms: string[] = lower.match(/[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+/g) ?? [];
  for (const raw of words) {
    const word = raw.replace(/^_+|_+$/g, '');
    if (!word) {
      continue;
    }
    const term = toTerm(word);
    if (term) {
      terms.push(term);
    }
    if (word.includes('_')) {
      for (const part of word.split('_')) {
        const partTerm = part ? toTerm(part) : undefined;
        if (partTerm) {
          terms.push(partTerm);
        }
      }
    }
  }
  return terms;
}

/** Collapse a string to space-separated lowercase words, for phrase matching */
function toPhrase(text: string): string {
  return (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).join(' ');
}

/**
 * Section headings of a doc. llms.txt content marks each heading with a
 * "[Section titled “...”](#anchor)" link (headings are often inline because
 * newlines are collapsed); fall back to line-start Markdown headings outside
 * code fences, where "#" lines are shell comments rather than headings.
 */
function extractHeadings(content: string): string[] {
  const marked = [...content.matchAll(/\[Section titled [“"](.+?)[”"]\]\(/g)].map(match => match[1]);
  if (marked.length > 0) {
    return marked;
  }
  const withoutCode = content.replace(/```[\s\S]*?```/g, '');
  return (withoutCode.match(/^#{1,6}\s+.+$/gm) ?? [])
    .map(line => line.replace(/^#{1,6}\s+/, ''));
}

/** URL path words, e.g. /features/units/state-backend/s3/ -> features units state backend s3 */
function urlText(url: string): string {
  try {
    return new URL(url).pathname.replace(/[/-]+/g, ' ');
  } catch {
    return url.replace(/[/:.-]+/g, ' ');
  }
}

interface IndexedDoc {
  url: string;
  titlePhrase: string;
  headingPhrases: Set<string>;
  /** The original content (a reference, not a copy), for phrase checks */
  content: string;
  /** Term frequencies per field */
  fields: Record<Field, Map<string, number>>;
  bodyLength: number;
}

/** An indexed term a query term matches, with its per-field idf precomputed */
interface TermExpansion {
  weight: number;
  bodyIdf: number;
  fieldIdf: Record<BonusField, number>;
  term: string;
}

function countTerms(terms: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

export class DocSearchIndex {
  private readonly docs: IndexedDoc[];
  /** Number of documents containing each term, overall and per field */
  private readonly documentFrequency = new Map<string, number>();
  private readonly fieldFrequency: Record<Field, Map<string, number>> = {
    title: new Map(),
    url: new Map(),
    headings: new Map(),
    section: new Map(),
    body: new Map(),
  };
  private readonly averageBodyLength: number;
  /** All indexed terms, sorted, for prefix expansion */
  private readonly vocabulary: string[];

  constructor(docs: SearchableDoc[]) {
    this.docs = docs.map(doc => {
      const bodyTerms = tokenize(doc.content);
      const headings = extractHeadings(doc.content);
      const fields: Record<Field, Map<string, number>> = {
        title: countTerms(tokenize(doc.title)),
        url: countTerms(tokenize(urlText(doc.url))),
        headings: countTerms(tokenize(headings.join('\n'))),
        section: countTerms(tokenize(doc.section)),
        body: countTerms(bodyTerms),
      };
      return {
        url: doc.url,
        titlePhrase: toPhrase(doc.title),
        headingPhrases: new Set(headings.map(toPhrase)),
        content: doc.content,
        fields,
        bodyLength: bodyTerms.length,
      };
    });

    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const [field, terms] of Object.entries(doc.fields) as Array<[Field, Map<string, number>]>) {
        const frequency = this.fieldFrequency[field];
        for (const term of terms.keys()) {
          seen.add(term);
          frequency.set(term, (frequency.get(term) ?? 0) + 1);
        }
      }
      for (const term of seen) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      }
    }

    const totalBodyLength = this.docs.reduce((sum, doc) => sum + doc.bodyLength, 0);
    this.averageBodyLength = this.docs.length > 0 ? totalBodyLength / this.docs.length : 0;
    this.vocabulary = [...this.documentFrequency.keys()].sort();
  }

  /** Indexed terms starting with a prefix, via binary search in the sorted vocabulary */
  private termsWithPrefix(prefix: string): string[] {
    let low = 0;
    let high = this.vocabulary.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.vocabulary[mid] < prefix) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    const terms: string[] = [];
    for (let i = low; i < this.vocabulary.length && this.vocabulary[i].startsWith(prefix); i++) {
      terms.push(this.vocabulary[i]);
    }
    return terms;
  }

  get size(): number {
    return this.docs.length;
  }

  /**
   * Inverse document frequency (BM25 variant, always positive), across all
   * fields or within one field.
   */
  idf(term: string, field?: Field): number {
    const df = (field ? this.fieldFrequency[field] : this.documentFrequency).get(term) ?? 0;
    const n = this.docs.length;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /**
   * The indexed terms a query term matches: itself when it occurs in the docs,
   * otherwise up to PREFIX_MAX_EXPANSIONS of the most common indexed terms it
   * is a prefix of, at reduced weight.
   */
  private expandTerm(term: string): TermExpansion[] {
    const expand = (indexedTerm: string, weight: number): TermExpansion => ({
      term: indexedTerm,
      weight,
      bodyIdf: this.idf(indexedTerm, 'body'),
      fieldIdf: {
        title: this.idf(indexedTerm, 'title'),
        url: this.idf(indexedTerm, 'url'),
        headings: this.idf(indexedTerm, 'headings'),
        section: this.idf(indexedTerm, 'section'),
      },
    });

    if (this.documentFrequency.has(term)) {
      return [expand(term, 1)];
    }
    if (term.length < PREFIX_MIN_LENGTH) {
      return [];
    }
    return this.termsWithPrefix(term)
      .sort((a, b) => (this.documentFrequency.get(b) ?? 0) - (this.documentFrequency.get(a) ?? 0))
      .slice(0, PREFIX_MAX_EXPANSIONS)
      .map(indexedTerm => expand(indexedTerm, PREFIX_WEIGHT));
  }

  /**
   * Rank documents for a query. Only documents matching at least one query
   * term are returned, best first. A query with no searchable terms (empty, or
   * only stopwords and punctuation) returns no hits.
   */
  search(query: string): SearchHit[] {
    const queryTerms = [...new Set(tokenize(query))];
    if (queryTerms.length === 0) {
      return [];
    }
    const expansions = queryTerms.map(term => this.expandTerm(term));

    const queryPhrase = toPhrase(query);
    const isMultiWord = queryPhrase.includes(' ');
    // Matches the query's words in order, separated by any non-word characters,
    // directly against the original content (no lowercased copy per document)
    const phrasePattern = isMultiWord
      ? new RegExp(
        `(?<![${WORD_CHARS}])${queryPhrase.split(' ').map(escapeRegExp).join(`[^${WORD_CHARS}]+`)}(?![${WORD_CHARS}])`,
        'i'
      )
      : undefined;
    const hits: SearchHit[] = [];

    for (const doc of this.docs) {
      let score = 0;
      let matched = 0;
      const lengthNorm = this.averageBodyLength > 0
        ? 1 - B + B * (doc.bodyLength / this.averageBodyLength)
        : 1;

      for (const termExpansions of expansions) {
        // A query term scores by its best-matching expansion
        let best = 0;
        for (const expansion of termExpansions) {
          let termScore = 0;
          const bodyFrequency = doc.fields.body.get(expansion.term) ?? 0;
          if (bodyFrequency > 0) {
            termScore += expansion.bodyIdf *
              (bodyFrequency * (K1 + 1)) / (bodyFrequency + K1 * lengthNorm);
          }
          for (const field of BONUS_FIELDS) {
            if (doc.fields[field].has(expansion.term)) {
              termScore += FIELD_BONUSES[field] * expansion.fieldIdf[field];
            }
          }
          best = Math.max(best, termScore * expansion.weight);
        }
        if (best > 0) {
          matched++;
          score += best;
        }
      }

      if (matched === 0) {
        continue;
      }

      // Prefer documents that match more of the query
      score *= matched / queryTerms.length;

      if (doc.headingPhrases.has(queryPhrase)) {
        score *= EXACT_HEADING_BOOST;
      }
      if (doc.titlePhrase === queryPhrase) {
        score *= EXACT_TITLE_BOOST;
      } else if (isMultiWord && matched === queryTerms.length) {
        // Phrase checks only for documents that contain every query term
        if (doc.titlePhrase.includes(queryPhrase)) {
          score *= TITLE_PHRASE_BOOST;
        } else if (phrasePattern?.test(doc.content)) {
          score *= BODY_PHRASE_BOOST;
        }
      }

      hits.push({ url: doc.url, score: Math.round(score * 1000) / 1000 });
    }

    return hits.sort((a, b) => b.score - a.score);
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Position of the first occurrence of a query word in the content (case-
 * insensitive), also accepting the plural forms the tokenizer stems away
 * (dependency -> dependencies, output -> outputs). A whole-word match is
 * required unless prefixOnly is set, which also accepts the word at the start
 * of a longer word or identifier part ("mock" in mock_outputs, "boot" in
 * bootstrap) but never inside a word ("run" in Terragrunt). -1 when absent.
 */
function findWord(content: string, word: string, prefixOnly: boolean): number {
  const stem = normalizeTerm(word);
  const variants = new Set([word, stem, `${stem}s`, `${stem}es`]);
  if (stem.endsWith('y')) {
    variants.add(`${stem.slice(0, -1)}ies`);
  }
  const alternatives = [...variants].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const pattern = prefixOnly
    ? `(?<![a-z0-9])(?:${alternatives})`
    : `(?<![${WORD_CHARS}])(?:${alternatives})(?![${WORD_CHARS}])`;
  const match = new RegExp(pattern, 'i').exec(content);
  return match ? match.index : -1;
}

/**
 * Build a snippet of at most maxLength characters (plus "..." markers) centred
 * on the first occurrence of the most specific query word in the content,
 * preferring whole words over word starts. Falls back to the start of the
 * content when no query word occurs.
 */
export function buildSnippet(content: string, query: string, index?: DocSearchIndex, maxLength = 300): string {
  if (content.length <= maxLength) {
    return content;
  }

  const words = [...new Set((query.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(w => toTerm(w)))];
  // Most specific words first: highest idf, then longest
  words.sort((a, b) =>
    (index ? index.idf(normalizeTerm(b)) - index.idf(normalizeTerm(a)) : 0) || b.length - a.length
  );

  // Whole words first, then word starts and identifier parts
  let position = -1;
  for (const prefixOnly of [false, true]) {
    for (const word of words) {
      position = findWord(content, word, prefixOnly);
      if (position !== -1) {
        break;
      }
    }
    if (position !== -1) {
      break;
    }
  }

  if (position === -1) {
    return content.substring(0, maxLength) + '...';
  }

  let start = Math.max(0, position - Math.floor(maxLength / 3));
  let end = Math.min(content.length, start + maxLength);
  start = Math.max(0, end - maxLength);

  // Avoid cutting words at the window edges
  if (start > 0) {
    const nextSpace = content.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < position) {
      start = nextSpace + 1;
    }
  }
  if (end < content.length) {
    const lastSpace = content.lastIndexOf(' ', end);
    if (lastSpace > position) {
      end = lastSpace;
    }
  }

  return `${start > 0 ? '...' : ''}${content.substring(start, end)}${end < content.length ? '...' : ''}`;
}
