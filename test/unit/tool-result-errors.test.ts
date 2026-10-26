/**
 * Tool result error classification
 *
 * isErrorResult decides which tool results the server reports to MCP clients
 * with isError: true, and ToolHandler uses the same rule to count failures in
 * metrics.
 */

import { describe, it, expect } from 'vitest';
import { ToolHandler, isErrorResult } from '../../src/handlers/tools.js';
import { NullMetricsManager } from '../../src/terragrunt/metrics.js';
import { ServerMode } from '../../src/modes/config.js';

class RecordingMetricsManager extends NullMetricsManager {
  errors: Array<{ operation: string; message: string }> = [];
  responses: string[] = [];

  override logError(_type: 'tool' | 'resource', operation: string, error: Error): void {
    this.errors.push({ operation, message: error.message });
  }

  override logResponse(_type: 'tool' | 'resource', operation: string): void {
    this.responses.push(operation);
  }
}

describe('isErrorResult', () => {
  it.each([
    ['a non-empty error', { error: 'No Terragrunt function found for: x', suggestion: 'list functions' }],
    ['success: false', { success: false, error: 'Missing required variables: key' }],
    ['success: false without an error message', { success: false, writeResult: { success: false } }],
    ['a mode restriction', { error: 'FileWriter is not available in core mode.', errorType: 'MODE_RESTRICTION' }],
    ['a preview that could not compute a diff', { preview: true, success: false, previewResult: { error: 'Path is outside allowed directories' } }],
    ['an error object', { error: { code: 'E_FAIL', message: 'boom' } }],
  ])('flags %s', (_label, result) => {
    expect(isErrorResult(result)).toBe(true);
  });

  it.each([
    ['a successful result', { success: true, config: 'remote_state {}' }],
    ['a result without success or error', { query: 'dependency', results: [] }],
    ['an empty error string', { error: '' }],
    ['an empty error object', { success: true, error: {} }],
    ['an error array', { error: [] }],
    ['a blocked preview that still produced a diff', { preview: true, success: false, previewResult: { diff: '--- a\n+++ b\n', error: 'Write would be blocked: file exists' } }],
    ['a successful preview', { preview: true, success: true, previewResult: { diff: '' } }],
    ['a string', 'metrics text output'],
    ['null', null],
    ['undefined', undefined],
  ])('does not flag %s', (_label, result) => {
    expect(isErrorResult(result)).toBe(false);
  });
});

describe('ToolHandler error metrics', () => {
  it('counts returned failures as errors', async () => {
    const metrics = new RecordingMetricsManager();
    const handler = new ToolHandler(metrics, ServerMode.FULL);

    const result = await handler.executeTool('build_config', { useCase: 'nope' });

    expect(isErrorResult(result)).toBe(true);
    expect(metrics.errors).toEqual([
      { operation: 'build_config', message: expect.stringContaining('No template found') },
    ]);
    // A failure is logged once, as an error, so MetricsManager's error rate stays correct
    expect(metrics.responses).toEqual([]);
  });

  it('counts mode restrictions as errors', async () => {
    const metrics = new RecordingMetricsManager();
    const handler = new ToolHandler(metrics, ServerMode.OBSERVABILITY);

    await handler.executeTool('build_config', { useCase: 'cicd' });

    expect(metrics.errors).toHaveLength(1);
    expect(metrics.errors[0].message).toMatch(/not available in observability mode/);
  });

  it('does not count successful calls as errors', async () => {
    const metrics = new RecordingMetricsManager();
    const handler = new ToolHandler(metrics, ServerMode.FULL);

    await handler.executeTool('build_config', { useCase: 'cicd', backend: 'github-actions' });

    expect(metrics.errors).toEqual([]);
    expect(metrics.responses).toEqual(['build_config']);
  });
});

describe('ToolHandler.callTool', () => {
  it.each([
    [{ useCase: 'nope' }, true],
    [{ useCase: 'cicd', backend: 'github-actions' }, false],
  ])('classifies build_config %j as isError=%s, consistent with metrics', async (args, expected) => {
    const metrics = new RecordingMetricsManager();
    const handler = new ToolHandler(metrics, ServerMode.FULL);

    const { result, isError } = await handler.callTool('build_config', args);

    expect(isError).toBe(expected);
    expect(isError).toBe(isErrorResult(result));
    expect(metrics.errors.length > 0).toBe(expected);
  });

  it('keeps the tool result when recording metrics fails', async () => {
    class ThrowingMetricsManager extends NullMetricsManager {
      override logResponse(): void {
        throw new Error('metrics backend unavailable');
      }
    }
    const handler = new ToolHandler(new ThrowingMetricsManager(), ServerMode.FULL);

    const { result, isError } = await handler.callTool('build_config', { useCase: 'cicd', backend: 'github-actions' });

    expect(isError).toBe(false);
    expect(result.success).toBe(true);
  });

  it('reports unknown tools as errors without recording metrics for them', async () => {
    const metrics = new RecordingMetricsManager();
    const handler = new ToolHandler(metrics, ServerMode.FULL);

    const { result, isError } = await handler.callTool('no_such_tool', {});

    expect(isError).toBe(true);
    expect(result.error).toMatch(/Unknown tool/);
    expect(metrics.errors).toEqual([]);
    expect(metrics.responses).toEqual([]);
  });
});
