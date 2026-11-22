#!/usr/bin/env node
// Prints a Markdown test summary from the Vitest JSON reports in test-results/.
// A missing or unreadable report is shown as "not run"; the script always exits 0.
import { readFileSync } from 'node:fs';

const reports = [
  ['Unit tests', 'test-results/unit.json'],
  ['Integration tests', 'test-results/integration.json'],
];

const lines = ['### Test Breakdown', ''];
for (const [label, file] of reports) {
  try {
    const r = JSON.parse(readFileSync(file, 'utf8'));
    lines.push(`- **${label}:** ${r.numTotalTests} total, ${r.numPassedTests} passed, ${r.numFailedTests} failed, ${r.numPendingTests ?? 0} skipped`);
  } catch {
    lines.push(`- **${label}:** not run (no ${file})`);
  }
}
lines.push('- **Legacy Integration:** test/server-test.js (`npm run test:server`)');
console.log(lines.join('\n'));
