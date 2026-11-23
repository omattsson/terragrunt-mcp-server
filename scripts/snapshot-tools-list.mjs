// Dump getAvailableTools() for every server mode to a JSON file.
// Run with: npx tsx scripts/snapshot-tools-list.mjs [outFile]
import { writeFileSync } from 'node:fs';
import { ToolHandler } from '../src/handlers/tools.ts';
import { ServerMode } from '../src/modes/config.ts';

const out = process.argv[2] ?? 'test/fixtures/tools-list.snapshot.json';
const snapshot = {};
for (const mode of Object.values(ServerMode)) {
    snapshot[mode] = new ToolHandler(undefined, mode).getAvailableTools();
}
writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
console.error(`Wrote ${out}`);
