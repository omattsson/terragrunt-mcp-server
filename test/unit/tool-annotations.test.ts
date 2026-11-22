import { describe, it, expect } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { MODE_CONFIGS, ServerMode } from '../../src/modes/config.js';

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const EXPECTED: Record<string, Record<string, boolean>> = {
  search_docs: READ_ONLY,
  function_reference: READ_ONLY,
  cli_reference: READ_ONLY,
  get_hcl_config_reference: READ_ONLY,
  get_guidance: READ_ONLY,
  diagnose_terragrunt_error: READ_ONLY,
  // reset: true clears the collected metrics, so this tool is not read-only
  get_server_metrics: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  build_config: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

describe('tool annotations', () => {
  const tools = new ToolHandler(undefined, ServerMode.FULL).getAvailableTools();

  it('covers exactly the tools FULL mode lists', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...MODE_CONFIGS[ServerMode.FULL].tools].sort());
    expect(tools.map(t => t.name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.keys(EXPECTED))('%s declares all four hints with the expected values', (name) => {
    const tool = tools.find(t => t.name === name)!;
    expect(tool.annotations).toEqual(EXPECTED[name]);
  });
});
