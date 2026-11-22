/**
 * Seeded, schema-driven argument generator for the fuzz group. Pure: the same
 * tool and seed always give the same cases, so a finding can be reproduced from
 * its seed and case id.
 */

/** mulberry32: small deterministic PRNG returning floats in [0, 1). */
export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MB = 1024 * 1024;

/** Hostile string values; the 1 MB entry is built lazily-by-call, not stored per case. */
function hostileStrings() {
  return [
    ['empty', ''],
    ['one-mb', 'A'.repeat(MB)],
    ['long-10k', 'a'.repeat(10_000)],
    ['nul-byte', 'a\u0000b'],
    ['unicode-emoji', '\u{1F600}\u{1F4A5} café 中文'],
    ['unicode-rtl', '‮evil‬'],
    ['lone-surrogate', 'x\ud800y'],
    ['traversal', '../../../../etc/passwd'],
    ['traversal-encoded', '..%2f..%2f..%2fetc%2fpasswd'],
    ['absolute-path', '/etc/passwd'],
    ['template-injection', '{{7*7}} ${7*7} $(id) `id`'],
    ['newlines', 'line1\r\nline2\n\n\n'],
    ['regex-bomb', '(a+)+$' + 'a'.repeat(64) + '!'],
    ['proto-string', '__proto__'],
  ];
}

function wrongTypeValues(declared) {
  const all = [
    ['null', null, 'null'],
    ['true', true, 'boolean'],
    ['zero', 0, 'number'],
    ['float', 1.5, 'number'],
    ['empty-array', [], 'array'],
    ['array-of-numbers', [1, 2, 3], 'array'],
    ['empty-object', {}, 'object'],
    ['nested-object', { a: { b: 1 } }, 'object'],
    ['string-x', 'x', 'string'],
  ];
  const kind = declared === 'integer' ? 'number' : declared;
  return all.filter(([, , type]) => type !== kind);
}

function intValues() {
  return [
    ['max-safe', Number.MAX_SAFE_INTEGER],
    ['min-safe', Number.MIN_SAFE_INTEGER],
    ['negative', -1],
    ['zero', 0],
    ['huge-float', 1e308],
    ['fraction', 0.5],
    ['two-pow-64', 2 ** 64],
  ];
}

function deepObject(depth) {
  let value = { leaf: true };
  for (let i = 0; i < depth; i++) value = { n: value };
  return value;
}

function deepArray(depth) {
  let value = [];
  for (let i = 0; i < depth; i++) value = [value];
  return value;
}

function sampleFor(prop) {
  if (!prop || typeof prop !== 'object') return 'x';
  if (prop.default !== undefined) return prop.default;
  if (Array.isArray(prop.enum) && prop.enum.length > 0) return prop.enum[0];
  switch (prop.type) {
    case 'integer':
    case 'number':
      return typeof prop.minimum === 'number' ? prop.minimum : 1;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return 'test';
  }
}

/** A plausible valid call: every required property with a sample value. */
export function baselineArgs(schema) {
  const args = {};
  const props = schema?.properties ?? {};
  for (const name of schema?.required ?? []) {
    args[name] = sampleFor(props[name]);
  }
  return args;
}

function jsonObject(text) {
  // JSON.parse creates own "__proto__" properties, an object literal would not
  return JSON.parse(text);
}

/**
 * Generate the fuzz cases for one tool.
 *
 * @param {{name: string, inputSchema?: object}} tool a tool from tools/list
 * @param {{seed?: number, quick?: boolean}} [opts]
 * @returns {{id: string, label: string, args: object}[]}
 */
export function generateArgs(tool, opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = createRng(seed);
  const schema = tool?.inputSchema ?? {};
  const props = schema.properties ?? {};
  const required = schema.required ?? [];
  const base = baselineArgs(schema);
  const cases = [];
  const add = (label, args) => cases.push({ id: `${tool?.name ?? 'tool'}#${cases.length}`, label, args });

  add('baseline', { ...base });
  add('empty-args', {});
  for (const name of required) {
    const copy = { ...base };
    delete copy[name];
    add(`missing-required:${name}`, copy);
  }

  for (const [name, prop] of Object.entries(props)) {
    const type = Array.isArray(prop?.type) ? prop.type[0] : prop?.type;
    const withValue = (label, value) => add(`${name}:${label}`, { ...base, [name]: value });

    for (const [label, value] of wrongTypeValues(type)) withValue(`wrong-type-${label}`, value);

    if (type === 'string' || type === undefined) {
      for (const [label, value] of hostileStrings()) withValue(label, value);
      withValue(`random-bytes-${Math.floor(rng() * 1000)}`, randomString(rng, 64));
    }
    if (type === 'integer' || type === 'number') {
      for (const [label, value] of intValues()) withValue(`int-${label}`, value);
    }
    if (Array.isArray(prop?.enum)) {
      withValue('enum-violation', '__not_in_enum__');
      withValue('enum-case-changed', String(prop.enum[0]).toUpperCase() + '_');
    }
    if (type === 'boolean') {
      withValue('string-true', 'true');
      withValue('one', 1);
    }
    if (type === 'array') {
      withValue('array-of-nulls', [null, null]);
      withValue('array-large', new Array(10_000).fill('x'));
      withValue('deep-array', deepArray(2000));
    }
    if (type === 'object') {
      withValue('deep-object', deepObject(2000));
      withValue('proto-in-object', jsonObject('{"__proto__":{"polluted":true}}'));
      withValue('large-object', Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`k${i}`, i])));
    }
  }

  add('extra-prop', { ...base, __stress_extra__: 1 });
  add('extra-prop-null', { ...base, __stress_extra__: null });
  add('proto-key', { ...base, ...jsonObject('{"__proto__":{"polluted":true}}') });
  add('constructor-key', { ...base, ...jsonObject('{"constructor":{"prototype":{"polluted":true}}}') });
  add('deep-extra-prop', { ...base, __stress_deep__: deepObject(2000) });
  add('many-extra-props', { ...base, ...Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`x${i}`, i])) });

  if (!opts.quick) return cases;

  // Quick: keep the structural cases and a seeded sample of the rest
  const keep = cases.filter((c) => c.label === 'baseline' || c.label === 'empty-args' || c.label.startsWith('missing-required') || c.label.includes('proto') || c.label.includes('one-mb') || c.label.includes('nul-byte'));
  const rest = cases.filter((c) => !keep.includes(c));
  const shuffled = rest
    .map((c) => ({ c, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  const picked = new Set([...keep, ...shuffled.slice(0, Math.max(12, Math.floor(rest.length / 4)))]);
  return cases.filter((c) => picked.has(c));
}

function randomString(rng, length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(32 + Math.floor(rng() * 0xd000));
  }
  // Drop any surrogates the range may have produced; lone ones have their own case
  return out.replace(/[\ud800-\udfff]/g, '?');
}
