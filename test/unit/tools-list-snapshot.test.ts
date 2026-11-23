import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ToolHandler } from '../../src/handlers/tools.js';
import { ServerMode } from '../../src/modes/config.js';

// Differential gate: tools/list output per mode must equal the snapshot taken
// before the zod migration. Regenerate with scripts/snapshot-tools-list.mjs only
// for an intended, reviewed change.
const snapshot = JSON.parse(
  readFileSync(new URL('../fixtures/tools-list.snapshot.json', import.meta.url), 'utf8')
) as Record<string, unknown>;

describe('tools/list snapshot', () => {
  it('covers every server mode', () => {
    expect(Object.keys(snapshot).sort()).toEqual(Object.values(ServerMode).sort());
  });

  for (const mode of Object.values(ServerMode)) {
    it(`matches the snapshot in ${mode} mode`, () => {
      const current = JSON.parse(
        JSON.stringify(new ToolHandler(undefined, mode).getAvailableTools())
      );
      expect(current).toEqual(snapshot[mode]);
    });
  }
});
