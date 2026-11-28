import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolHandler, MAX_SEARCH_QUERY_LENGTH } from '../../src/handlers/tools.js';
import { ServerMode } from '../../src/modes/config.js';

/**
 * Runtime validation of tool arguments (zod, inside ToolHandler.callTool).
 * Lenient-compatible: only clearly invalid input is rejected. Anything the
 * handler already tolerates still reaches it.
 */
describe('tool argument validation', () => {
  let handler: ToolHandler;
  let spies: Record<string, ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    handler = new ToolHandler(undefined, ServerMode.FULL);
    const h = handler as any;
    spies = {
      listCliCommands: vi.spyOn(h, 'listCliCommands').mockResolvedValue({ ok: true }),
      listTerragruntFunctions: vi.spyOn(h, 'listTerragruntFunctions').mockResolvedValue({ ok: true }),
      searchTerragruntDocs: vi.spyOn(h, 'searchTerragruntDocs').mockResolvedValue({ ok: true }),
      diagnoseTerragruntError: vi.spyOn(h, 'diagnoseTerragruntError').mockResolvedValue({ ok: true }),
      getServerMetrics: vi.spyOn(h, 'getServerMetrics').mockReturnValue({ ok: true }),
      getGuidance: vi.spyOn(h, 'getGuidance').mockResolvedValue({ ok: true }),
    };
  });

  it('rejects a wrong type with an isError result naming the field', async () => {
    const { result, isError } = await handler.callTool('diagnose_terragrunt_error', { error_message: 42 });
    expect(isError).toBe(true);
    expect(typeof result.error).toBe('string');
    expect(result.error).toContain('error_message');
    expect(spies.diagnoseTerragruntError).not.toHaveBeenCalled();
  });

  it('rejects a bad enum value', async () => {
    const { result, isError } = await handler.callTool('cli_reference', { category: 'nope' });
    expect(isError).toBe(true);
    expect(result.error).toContain('category');
    expect(spies.listCliCommands).not.toHaveBeenCalled();
  });

  it('rejects a missing required field', async () => {
    const { result, isError } = await handler.callTool('diagnose_terragrunt_error', {});
    expect(isError).toBe(true);
    expect(result.error).toContain('error_message');
    expect(spies.diagnoseTerragruntError).not.toHaveBeenCalled();
  });

  it('accepts a numeric string pageSize and hands the handler a number', async () => {
    const { isError } = await handler.callTool('cli_reference', { pageSize: '5', page: '2' });
    expect(isError).toBe(false);
    expect(spies.listCliCommands).toHaveBeenCalledWith(undefined, undefined, 2, 5);
  });

  it.each([
    [0, 20],
    [-5, 20],
    [1000, 1000],
  ])('pageSize %s still reaches the handler (normalised to %s)', async (input, expected) => {
    const { isError } = await handler.callTool('cli_reference', { pageSize: input });
    expect(isError).toBe(false);
    expect(spies.listCliCommands).toHaveBeenCalledWith(undefined, undefined, 1, expected);
  });

  it('passes non-numeric pageSize strings to the handler fallback', async () => {
    const { isError } = await handler.callTool('cli_reference', { pageSize: 'abc' });
    expect(isError).toBe(false);
    expect(spies.listCliCommands).toHaveBeenCalledWith(undefined, undefined, 1, 20);
  });

  it('accepts null for optional fields', async () => {
    const { isError } = await handler.callTool('function_reference', { category: null, search: null });
    expect(isError).toBe(false);
    expect(spies.listTerragruntFunctions).toHaveBeenCalled();
  });

  it('rejects a search query over the length cap with a "too long" message', async () => {
    const query = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    const { result, isError } = await handler.callTool('search_docs', { mode: 'search', query });
    expect(isError).toBe(true);
    expect(result.error).toContain('too long');
    expect(result.error).toContain(`${query.length} characters`);
    expect(result.error).toContain(`maximum ${MAX_SEARCH_QUERY_LENGTH}`);
    expect(spies.searchTerragruntDocs).not.toHaveBeenCalled();
  });

  it('accepts a query exactly at the cap', async () => {
    const { isError } = await handler.callTool('search_docs', {
      mode: 'search',
      query: 'a'.repeat(MAX_SEARCH_QUERY_LENGTH),
    });
    expect(isError).toBe(false);
    expect(spies.searchTerragruntDocs).toHaveBeenCalled();
  });

  it('lets unknown extra keys through to the handler', async () => {
    await handler.callTool('get_guidance', { listAll: true, somethingElse: 1 });
    expect(spies.getGuidance).toHaveBeenCalled();
  });

  it('keeps build_config options valid as an object', async () => {
    const spy = vi.spyOn(handler as any, 'generateTerragruntConfig').mockResolvedValue({ success: true });
    const { isError } = await handler.callTool('build_config', {
      useCase: 'remote_state',
      options: { bucket: 'b', key: 'k', region: 'eu-west-1' },
    });
    expect(isError).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it('keeps legacy nested diagnose context and options valid in A1', async () => {
    const { isError } = await handler.callTool('diagnose_terragrunt_error', {
      error_message: 'boom',
      context: { command: 'plan' },
      options: { maxMatches: 2 },
    });
    expect(isError).toBe(false);
    expect(spies.diagnoseTerragruntError).toHaveBeenCalled();
  });

  describe('string booleans keep today\'s handler behaviour', () => {
    it('does not reject "true" or "false" strings and forwards them unchanged', async () => {
      for (const value of ['true', 'false']) {
        spies.getServerMetrics.mockClear();
        const { isError } = await handler.callTool('get_server_metrics', { reset: value });
        expect(isError).toBe(false);
        // The handler sees the raw string; "false" is truthy there, as before.
        expect(spies.getServerMetrics).toHaveBeenCalledWith(undefined, 'json', value);
      }
    });

    it('still rejects a non-boolean, non-string value such as a number', async () => {
      const { isError } = await handler.callTool('get_server_metrics', { reset: 1 });
      expect(isError).toBe(true);
    });
  });

  it('counts validation failures as tool errors in metrics', async () => {
    const logError = vi.fn();
    const metrics: any = { logError, logResponse: vi.fn() };
    const h = new ToolHandler(metrics, ServerMode.FULL);
    await h.callTool('diagnose_terragrunt_error', { error_message: 42 });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('does not validate unknown tools (Unknown tool path unchanged)', async () => {
    const { result, isError } = await handler.callTool('nope', { a: 1 });
    expect(isError).toBe(true);
    expect(result.error).toBe('Unknown tool: nope');
  });
});
