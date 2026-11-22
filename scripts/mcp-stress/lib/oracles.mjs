/**
 * Pure detectors. Each takes observations and returns a description of the
 * defect (or null / an empty list when there is none). No I/O.
 */

export const SEVERITIES = ['critical', 'high', 'medium', 'info'];

/**
 * @param {{severity: string, group: string, kind: string, title: string, tool?: string, expected?: string, actual?: string, reproducer?: object}} f
 */
export function makeFinding(f) {
  if (!SEVERITIES.includes(f.severity)) {
    throw new Error(`Unknown severity: ${f.severity}`);
  }
  return {
    severity: f.severity,
    group: f.group,
    kind: f.kind,
    tool: f.tool ?? null,
    title: f.title,
    expected: f.expected ?? '',
    actual: f.actual ?? '',
    reproducer: f.reproducer ?? {},
  };
}

export function summarize(findings) {
  const counts = { critical: 0, high: 0, medium: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

export function exitCodeFor(findings) {
  return findings.some((f) => f.severity === 'critical' || f.severity === 'high') ? 1 : 0;
}

function isJsonRpcMessage(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && value.jsonrpc === '2.0';
}

/** Lines on stdout that are not JSON-RPC messages (blank lines are ignored). */
export function checkStdoutLines(lines) {
  const bad = [];
  lines.forEach((line, index) => {
    if (line.trim() === '') return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      bad.push({ index, line });
      return;
    }
    const ok = Array.isArray(parsed) ? parsed.length > 0 && parsed.every(isJsonRpcMessage) : isJsonRpcMessage(parsed);
    if (!ok) bad.push({ index, line });
  });
  return bad;
}

const LEAK_PATTERNS = [
  /\n\s+at\s+(?:async\s+)?[^\n]*:\d+:\d+\)?/,
  /(?:^|[\s"'(])\/[\w./-]*node_modules\/[\w./-]*/,
  /(?:file:\/\/)?\/[\w./-]*\/dist\/[\w./-]+\.js(?::\d+)?/,
  /(?:^|[\s"'(])\/[\w./-]*\/src\/[\w./-]+\.ts/,
  /\bat\s+file:\/\/\S+/,
];

/** Stack frames and server install paths in text that goes to a client. */
export function findStackLeak(text) {
  const hits = [];
  for (const pattern of LEAK_PATTERNS) {
    const m = pattern.exec(String(text));
    if (m) hits.push(m[0].trim().slice(0, 200));
  }
  return hits;
}

export function checkCrash({ alive, exitCode = null, signal = null }) {
  if (alive) return null;
  if (signal) return `server process died with signal ${signal}`;
  return `server process exited with exit code ${exitCode}`;
}

export function checkHang({ timedOut, elapsedMs, limitMs }) {
  if (timedOut) return `no answer within ${limitMs} ms`;
  if (elapsedMs > limitMs) return `answered after ${elapsedMs} ms (limit ${limitMs} ms)`;
  return null;
}

/** Problems with the isError contract of one tools/call result. */
export function checkErrorShape(result) {
  const problems = [];
  const text = result?.content?.[0]?.type === 'text' ? result.content[0].text : undefined;
  if (typeof text !== 'string') {
    problems.push('result has no text content');
    return problems;
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  const isObject = body !== null && typeof body === 'object';
  const bodyError = isObject ? (body.error ?? (body.success === false ? true : undefined)) : undefined;
  if (result.isError === true) {
    const message = isObject ? (typeof body.error === 'string' ? body.error : body.error?.message) : undefined;
    const hasMessage = (typeof message === 'string' && message.length > 0) || (!isObject && text.length > 0) || (isObject && (body.preview === true || body.success === false));
    if (!hasMessage) problems.push('isError is true but the body carries no error message');
  } else if (bodyError !== undefined && bodyError !== '' && body.preview !== true) {
    problems.push('body reports an error but isError is not set');
  }
  return problems;
}

/** Compare two {path: sha256} maps. */
export function snapshotDiff(before, after) {
  const changed = [];
  const created = [];
  const removed = [];
  for (const [file, hash] of Object.entries(after)) {
    if (!(file in before)) created.push(file);
    else if (before[file] !== hash) changed.push(file);
  }
  for (const file of Object.keys(before)) {
    if (!(file in after)) removed.push(file);
  }
  return { changed: changed.sort(), created: created.sort(), removed: removed.sort() };
}
