import { describe, it, expect, vi } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { ServerMode } from '../../src/modes/config.js';

function createMetricsStub() {
  return {
    logResponse: vi.fn(),
    logError: vi.fn(),
  };
}

function createHandler(mode: ServerMode) {
  const metrics = createMetricsStub();
  const handler = new ToolHandler(metrics as any, mode);
  const internal = vi.spyOn(handler as any, 'executeToolInternal');
  return { handler, metrics, internal };
}

describe('ToolHandler mode guard', () => {
  it('returns MODE_RESTRICTION for a tool hidden in the current mode, without running the handler', async () => {
    const { handler, internal } = createHandler(ServerMode.CORE);

    const { result, isError } = await handler.callTool('build_config', {
      useCase: 'cicd',
      backend: 'github-actions',
    });

    expect(isError).toBe(true);
    expect(result.errorType).toBe('MODE_RESTRICTION');
    expect(result.error).toContain('build_config is not available in core mode');
    expect(result.availableIn).toEqual(expect.arrayContaining(['config', 'full']));
    expect(result.availableIn).not.toContain('core');
    expect(internal).not.toHaveBeenCalled();
  });

  it('does not throw for a hidden tool called without arguments', async () => {
    const { handler } = createHandler(ServerMode.OBSERVABILITY);

    const { result, isError } = await handler.callTool('search_docs', undefined);

    expect(isError).toBe(true);
    expect(result.errorType).toBe('MODE_RESTRICTION');
  });

  it('records a restricted call as one error', async () => {
    const { handler, metrics } = createHandler(ServerMode.CORE);

    await handler.callTool('get_server_metrics', {});

    // get_server_metrics never records metrics for itself (avoids recursion)
    expect(metrics.logError).not.toHaveBeenCalled();

    await handler.callTool('build_config', {});
    expect(metrics.logError).toHaveBeenCalledTimes(1);
    expect(metrics.logError.mock.calls[0][0]).toBe('tool');
    expect(metrics.logError.mock.calls[0][1]).toBe('build_config');
    expect(metrics.logResponse).not.toHaveBeenCalled();
  });

  it('does not restrict tools that FULL mode enables', async () => {
    const { handler, internal } = createHandler(ServerMode.FULL);
    internal.mockResolvedValue({ success: true });

    const { result, isError } = await handler.callTool('build_config', { useCase: 'cicd' });

    expect(isError).toBe(false);
    expect(result).toEqual({ success: true });
    expect(internal).toHaveBeenCalledTimes(1);
  });

  it('keeps the Unknown tool error and records no metrics for a name no mode has', async () => {
    const { handler, metrics } = createHandler(ServerMode.CORE);

    const { result, isError } = await handler.callTool('no_such_tool', {});

    expect(isError).toBe(true);
    expect(result.error).toContain('Unknown tool');
    expect(result.errorType).toBeUndefined();
    expect(metrics.logError).not.toHaveBeenCalled();
    expect(metrics.logResponse).not.toHaveBeenCalled();
  });
});
