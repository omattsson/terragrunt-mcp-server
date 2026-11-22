/** Finding collection (deduplicated) and report rendering. */
import { makeFinding, summarize, SEVERITIES } from './oracles.mjs';

/** Structural copy for a reproducer: long strings, wide containers and deep nesting are abbreviated. */
export function abbreviate(value, depth = 0) {
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 40)}...<${value.length} chars>` : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 6) return '<nested deeper>';
  if (Array.isArray(value)) {
    const items = value.slice(0, 3).map((v) => abbreviate(v, depth + 1));
    return value.length > 20 ? [...items, `...<${value.length} items>`] : value.map((v) => abbreviate(v, depth + 1));
  }
  const keys = Object.keys(value);
  const shown = keys.length > 20 ? keys.slice(0, 5) : keys;
  const out = {};
  for (const k of shown) Object.defineProperty(out, k, { value: abbreviate(value[k], depth + 1), enumerable: true, writable: true, configurable: true });
  if (keys.length > 20) out['...'] = `<${keys.length} keys>`;
  return out;
}

/** Pretty JSON of an abbreviated value. */
export function compactJson(value, maxLength = 1500) {
  const text = JSON.stringify(abbreviate(value), null, 2);
  if (text === undefined) return 'undefined';
  return text.length > maxLength ? text.slice(0, maxLength) + `\n...<${text.length} chars>` : text;
}

export class Reporter {
  constructor() {
    this.findings = [];
    this.byKey = new Map();
    this.groups = [];
    this.metrics = {};
  }

  /** Add a finding; an identical one (same kind, tool and title) only raises its count. */
  add(input) {
    const finding = makeFinding(input);
    const key = `${finding.kind}|${finding.tool}|${finding.title}`;
    const existing = this.byKey.get(key);
    if (existing) {
      existing.count += 1;
      return existing;
    }
    finding.count = 1;
    this.byKey.set(key, finding);
    this.findings.push(finding);
    return finding;
  }

  summary() {
    return summarize(this.findings);
  }

  sorted() {
    return [...this.findings].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  }
}

export function renderMarkdown(meta, reporter) {
  const s = reporter.summary();
  const out = [];
  out.push('# MCP stress test report', '');
  out.push(`- Target: ${meta.target} (${meta.targetDescription})`);
  out.push(`- Mode: ${meta.mode}, seed: ${meta.seed}, quick: ${meta.quick}`);
  out.push(`- Node: ${meta.node}, started: ${meta.startedAt}, duration: ${meta.durationMs} ms`);
  out.push(`- Groups: ${meta.groups.join(', ')}`);
  out.push('', '## Summary', '', '| critical | high | medium | info |', '|---|---|---|---|', `| ${s.critical} | ${s.high} | ${s.medium} | ${s.info} |`, '');
  out.push('## Groups', '', '| group | status | ms | notes |', '|---|---|---|---|');
  for (const g of reporter.groups) out.push(`| ${g.name} | ${g.status} | ${g.durationMs} | ${(g.notes || []).join('; ').replace(/\|/g, '/')} |`);
  out.push('');
  const metricEntries = Object.entries(reporter.metrics);
  if (metricEntries.length > 0) {
    out.push('## Measurements', '', '```json', JSON.stringify(reporter.metrics, null, 2), '```', '');
  }
  out.push('## Findings', '');
  if (reporter.findings.length === 0) out.push('None.', '');
  reporter.sorted().forEach((f, i) => {
    out.push(`### ${i + 1}. [${f.severity}] ${f.title}`, '');
    out.push(`- Group: ${f.group}, tool: ${f.tool ?? 'n/a'}, kind: ${f.kind}, occurrences: ${f.count}`);
    out.push(`- Expected: ${f.expected}`);
    out.push(`- Actual: ${f.actual}`);
    out.push('- Reproducer:', '', '```json', compactJson(f.reproducer), '```', '');
  });
  return out.join('\n') + '\n';
}
