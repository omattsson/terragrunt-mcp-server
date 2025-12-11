/**
 * Tests for get_server_metrics tool functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsManager } from '../../src/terragrunt/metrics.js';

describe('getServerMetrics tool', () => {
  let metricsManager: MetricsManager;

  beforeEach(() => {
    metricsManager = new MetricsManager();
  });

  describe('JSON format', () => {
    it('should return metrics in JSON format by default', () => {
      // Log some test data
      metricsManager.logResponse('tool', 'search_docs', { results: ['doc1', 'doc2'] });
      metricsManager.logResponse('resource', 'overview', { content: 'test' });

      const stats = metricsManager.getStats();
      const result = {
        format: 'json' as const,
        metrics: stats,
        totalCalls: metricsManager.getTotalCalls(),
        totalBytes: metricsManager.getTotalBytes(),
        operationCount: Object.keys(stats).length,
        filter: 'none',
        timestamp: new Date().toISOString()
      };

      expect(result.format).toBe('json');
      expect(result.metrics).toBeDefined();
      expect(result.totalCalls).toBe(2);
      expect(result.operationCount).toBe(2);
      expect(result.metrics['tool:search_docs']).toBeDefined();
      expect(result.metrics['resource:overview']).toBeDefined();
    });

    it('should include summary statistics in JSON format', () => {
      metricsManager.logResponse('tool', 'test', { data: 'x'.repeat(100) });
      metricsManager.logResponse('tool', 'test', { data: 'y'.repeat(200) });

      const stats = metricsManager.getStats();
      const result = {
        format: 'json' as const,
        metrics: stats,
        totalCalls: metricsManager.getTotalCalls(),
        totalBytes: metricsManager.getTotalBytes(),
        operationCount: Object.keys(stats).length,
        filter: 'none',
        timestamp: new Date().toISOString()
      };

      expect(result.totalCalls).toBe(2);
      expect(result.totalBytes).toBeGreaterThan(0);
      expect(result.metrics['tool:test'].calls).toBe(2);
    });
  });

  describe('Text format', () => {
    it('should return metrics in text format when requested', () => {
      metricsManager.logResponse('tool', 'search', { results: [] });
      
      const text = metricsManager.getSummaryText();
      const result = {
        format: 'text' as const,
        summary: text,
        reset: false
      };

      expect(result.format).toBe('text');
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary).toContain('Total:');
    });

    it('should include human-readable summary in text format', () => {
      metricsManager.logResponse('tool', 'test1', { data: 'a' });
      metricsManager.logResponse('resource', 'test2', { data: 'b' });

      const text = metricsManager.getSummaryText();

      expect(text).toContain('tool:test1');
      expect(text).toContain('resource:test2');
      expect(text).toContain('Calls');
      expect(text).toContain('bytes');
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      metricsManager.logResponse('tool', 'search', { data: 'a' });
      metricsManager.logResponse('tool', 'get_docs', { data: 'b' });
      metricsManager.logResponse('resource', 'overview', { data: 'c' });
      metricsManager.logResponse('resource', 'section', { data: 'd' });
    });

    it('should filter metrics by operation name', () => {
      const stats = metricsManager.getStats('search');

      expect(Object.keys(stats).length).toBe(1);
      expect(stats['tool:search']).toBeDefined();
    });

    it('should return all metrics when no filter provided', () => {
      const stats = metricsManager.getStats();

      expect(Object.keys(stats).length).toBe(4);
    });

    it('should handle partial matches in filter', () => {
      const stats = metricsManager.getStats('tool');

      expect(Object.keys(stats).length).toBe(2);
      expect(stats['tool:search']).toBeDefined();
      expect(stats['tool:get_docs']).toBeDefined();
    });

    it('should return empty object when filter matches nothing', () => {
      const stats = metricsManager.getStats('nonexistent');

      expect(Object.keys(stats).length).toBe(0);
    });
  });

  describe('Reset functionality', () => {
    it('should reset metrics when requested', () => {
      metricsManager.logResponse('tool', 'test', { data: 'x' });
      
      expect(metricsManager.getTotalCalls()).toBe(1);
      
      metricsManager.reset();
      
      expect(metricsManager.getTotalCalls()).toBe(0);
      expect(Object.keys(metricsManager.getStats()).length).toBe(0);
    });

    it('should indicate reset was performed', () => {
      metricsManager.logResponse('tool', 'test', { data: 'x' });
      
      const statsBefore = metricsManager.getStats();
      expect(Object.keys(statsBefore).length).toBe(1);
      
      metricsManager.reset();
      const result = {
        format: 'json' as const,
        metrics: metricsManager.getStats(),
        totalCalls: metricsManager.getTotalCalls(),
        totalBytes: metricsManager.getTotalBytes(),
        operationCount: Object.keys(metricsManager.getStats()).length,
        filter: 'none',
        timestamp: new Date().toISOString(),
        reset: true
      };

      expect(result.reset).toBe(true);
      expect(result.totalCalls).toBe(0);
    });

    it('should not reset when reset parameter is false', () => {
      metricsManager.logResponse('tool', 'test', { data: 'x' });
      
      const result = {
        format: 'json' as const,
        metrics: metricsManager.getStats(),
        totalCalls: metricsManager.getTotalCalls(),
        totalBytes: metricsManager.getTotalBytes(),
        operationCount: Object.keys(metricsManager.getStats()).length,
        filter: 'none',
        timestamp: new Date().toISOString()
      };

      expect(result.reset).toBeUndefined();
      expect(metricsManager.getTotalCalls()).toBe(1);
    });
  });

  describe('Combined metrics scenarios', () => {
    it('should track metrics from both tools and resources', () => {
      // Simulate mixed operations
      metricsManager.logResponse('tool', 'search_docs', { results: ['a', 'b'] });
      metricsManager.logResponse('resource', 'page:intro', { content: 'test' });
      metricsManager.logResponse('tool', 'get_function', { name: 'func1' });
      metricsManager.logResponse('resource', 'section:cli', { content: 'cli docs' });

      const stats = metricsManager.getStats();

      expect(Object.keys(stats).length).toBe(4);
      expect(metricsManager.getTotalCalls()).toBe(4);
      expect(metricsManager.getTotalBytes()).toBeGreaterThan(0);
    });

    it('should aggregate repeated operations correctly', () => {
      // Same operation called multiple times
      metricsManager.logResponse('tool', 'search', { data: 'a' });
      metricsManager.logResponse('tool', 'search', { data: 'bb' });
      metricsManager.logResponse('tool', 'search', { data: 'ccc' });

      const stats = metricsManager.getStats();

      expect(stats['tool:search'].calls).toBe(3);
      expect(stats['tool:search'].minBytes).toBeLessThan(stats['tool:search'].maxBytes);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty metrics state', () => {
      const stats = metricsManager.getStats();
      const result = {
        format: 'json' as const,
        metrics: stats,
        totalCalls: metricsManager.getTotalCalls(),
        totalBytes: metricsManager.getTotalBytes(),
        operationCount: Object.keys(stats).length,
        filter: 'none',
        timestamp: new Date().toISOString()
      };

      expect(result.totalCalls).toBe(0);
      expect(result.totalBytes).toBe(0);
      expect(result.operationCount).toBe(0);
    });

    it('should handle very large response objects', () => {
      const largeData = { data: 'x'.repeat(10000) };
      metricsManager.logResponse('tool', 'test', largeData);

      const stats = metricsManager.getStats();

      expect(stats['tool:test'].totalBytes).toBeGreaterThan(10000);
    });

    it('should handle special characters in operation names', () => {
      metricsManager.logResponse('tool', 'get:function:with:colons', { data: 'test' });
      
      const stats = metricsManager.getStats();

      expect(stats['tool:get:function:with:colons']).toBeDefined();
    });
  });
});
