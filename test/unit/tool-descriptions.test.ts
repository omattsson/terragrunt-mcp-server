import { describe, it, expect } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { ServerMode } from '../../src/modes/config.js';

const tools = new ToolHandler(undefined, ServerMode.FULL).getAvailableTools();

function property(toolName: string, prop: string): { description?: string } {
  const tool = tools.find(t => t.name === toolName)!;
  return (tool.inputSchema.properties as Record<string, { description?: string }>)[prop];
}

const wordCount = (text: string | undefined) => (text ?? '').trim().split(/\s+/).filter(Boolean).length;

describe('tool parameter descriptions', () => {
  const entries = tools.flatMap(tool =>
    Object.entries(tool.inputSchema.properties as Record<string, { description?: string }>)
      .map(([prop, schema]) => [`${tool.name}.${prop}`, schema.description] as const)
  );

  it.each(entries)('%s has a description of at least 4 words', (_label, description) => {
    expect(wordCount(description)).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['diagnose_terragrunt_error', 'error_message'],
    ['diagnose_terragrunt_error', 'command'],
    ['diagnose_terragrunt_error', 'filePath'],
    ['diagnose_terragrunt_error', 'maxMatches'],
    ['diagnose_terragrunt_error', 'minConfidence'],
    ['search_docs', 'query'],
    ['function_reference', 'function_name'],
    ['cli_reference', 'command'],
    ['get_hcl_config_reference', 'config'],
  ])('%s.%s gives an example', (toolName, prop) => {
    expect(property(toolName, prop).description).toMatch(/e\.g\.|for example|\(.+\)/i);
  });

  it('explains build_config path and useCase', () => {
    expect(property('build_config', 'path').description).toMatch(/\.hcl/);
    expect(property('build_config', 'useCase').description).toMatch(/remote_state/);
  });

  it('describes search_docs limit and detailLevel by the modes they apply to', () => {
    // limit caps both docs-scraped and curated examples
    expect(property('search_docs', 'limit').description).toMatch(/examples/i);
    expect(property('search_docs', 'limit').description).not.toMatch(/advanced=true/);
    // detailLevel is ignored in search mode
    expect(property('search_docs', 'detailLevel').description).toMatch(/section/i);
    expect(property('search_docs', 'detailLevel').description).toMatch(/examples/i);
  });

  it('describes includeDestructiveCommands by the safety level it filters', () => {
    expect(property('diagnose_terragrunt_error', 'includeDestructiveCommands').description)
      .toMatch(/destructive/i);
  });
});
