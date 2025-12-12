/**
 * Integration tests for get_server_metrics tool through MCP protocol
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { MetricsManager } from '../../src/terragrunt/metrics.js';

describe('get_server_metrics MCP tool integration', () => {
  let toolHandler: ToolHandler;
  let metricsManager: MetricsManager;

  beforeEach(() => {
    // Fresh instances for each test
    metricsManager = new MetricsManager();
    toolHandler = new ToolHandler(metricsManager);
  });

  describe('Tool registration', () => {
    it('should be registered in available tools', async () => {
      const tools = await toolHandler.getAvailableTools();
      
      const metricsToolIndex = tools.findIndex(t => t.name === 'get_server_metrics');
      expect(metricsToolIndex).toBeGreaterThanOrEqual(0);
      
      const metricsTool = tools[metricsToolIndex];
      expect(metricsTool.name).toBe('get_server_metrics');
      expect(metricsTool.description).toContain('metrics');
      expect(metricsTool.inputSchema).toBeDefined();
      expect(metricsTool.inputSchema.properties).toBeDefined();
    });

    it('should have proper input schema definition', async () => {
      const tools = await toolHandler.getAvailableTools();
      const metricsTool = tools.find(t => t.name === 'get_server_metrics');
      
      expect(metricsTool?.inputSchema.properties.filter).toBeDefined();
      expect(metricsTool?.inputSchema.properties.format).toBeDefined();
      expect(metricsTool?.inputSchema.properties.reset).toBeDefined();
      expect(metricsTool?.inputSchema.properties.format.enum).toContain('json');
      expect(metricsTool?.inputSchema.properties.format.enum).toContain('text');
    });
  });

  describe('Tool execution through MCP protocol', () => {
    it('should execute and return JSON format by default', async () => {
      // Execute a tool first to generate metrics
      await toolHandler.executeTool('cli_reference', {});
      
      const result = await toolHandler.executeTool('get_server_metrics', {});
      
      expect(result).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.metrics).toBeDefined();
      expect(result.totalCalls).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should execute and return text format when requested', async () => {
      await toolHandler.executeTool('cli_reference', {});
      
      const result = await toolHandler.executeTool('get_server_metrics', { format: 'text' });
      
      expect(result).toBeDefined();
      expect(result.format).toBe('text');
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
    });

    it('should apply filter parameter correctly', async () => {
      await toolHandler.executeTool('cli_reference', {});
      
      const result = await toolHandler.executeTool('get_server_metrics', { 
        filter: 'cli_reference' 
      });
      
      expect(result.format).toBe('json');
      expect(result.filter).toBe('cli_reference');
      expect(result.metrics['tool:cli_reference']).toBeDefined();
    });

    it('should reset metrics when requested', async () => {
      await toolHandler.executeTool('cli_reference', {});
      
      const resetResult = await toolHandler.executeTool('get_server_metrics', { 
        reset: true 
      });
      expect(resetResult.reset).toBe(true);
      
      const afterReset = await toolHandler.executeTool('get_server_metrics', {});
      // Should only have the get_server_metrics call after reset
      expect(afterReset.totalCalls).toBeLessThanOrEqual(1);
    });

    it('should track metrics from multiple tool calls', async () => {
      await toolHandler.executeTool('cli_reference', {});
      await toolHandler.executeTool('list_terragrunt_functions', {});
      
      const result = await toolHandler.executeTool('get_server_metrics', {});
      
      expect(result.totalCalls).toBeGreaterThanOrEqual(2);
      expect(result.operationCount).toBeGreaterThan(0);
    });
  });

  describe('Combined tool and resource metrics', () => {
    it('should track metrics across multiple operations', async () => {
      await toolHandler.executeTool('cli_reference', {});
      await toolHandler.executeTool('list_terragrunt_functions', {});
      
      const result = await toolHandler.executeTool('get_server_metrics', {});
      
      expect(result.format).toBe('json');
      expect(result.totalCalls).toBeGreaterThan(0);
      expect(result.totalBytes).toBeGreaterThan(0);
      expect(result.operationCount).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle empty metrics state gracefully', async () => {
      const result = await toolHandler.executeTool('get_server_metrics', {});
      
      expect(result).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.totalCalls).toBeGreaterThanOrEqual(0);
      expect(result.totalBytes).toBeGreaterThanOrEqual(0);
    });
  });
});
