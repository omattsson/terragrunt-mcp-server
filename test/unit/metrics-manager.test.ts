/**
 * Tests for MetricsManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsManager } from '../../src/terragrunt/metrics.js';

describe('MetricsManager', () => {
  let manager: MetricsManager;

  beforeEach(() => {
    manager = new MetricsManager();
  });

  describe('logResponse', () => {
    it('should track response sizes', () => {
      const response = { data: 'hello' };
      manager.logResponse('tool', 'test_tool', response);
      
      const stats = manager.getStats();
      expect(stats['tool:test_tool']).toBeDefined();
      expect(stats['tool:test_tool'].calls).toBe(1);
      expect(stats['tool:test_tool'].totalBytes).toBeGreaterThan(0);
    });

    it('should track multiple calls to same tool', () => {
      manager.logResponse('tool', 'test', { data: 'a' });
      manager.logResponse('tool', 'test', { data: 'longer string' });
      
      const stats = manager.getStats();
      expect(stats['tool:test'].calls).toBe(2);
      expect(stats['tool:test'].totalBytes).toBeGreaterThan(0);
    });

    it('should track resources separately from tools', () => {
      manager.logResponse('tool', 'test', { data: 'tool' });
      manager.logResponse('resource', 'test', { data: 'resource' });
      
      const stats = manager.getStats();
      expect(stats['tool:test']).toBeDefined();
      expect(stats['resource:test']).toBeDefined();
      expect(stats['tool:test'].calls).toBe(1);
      expect(stats['resource:test'].calls).toBe(1);
    });

    it('should calculate min and max bytes correctly', () => {
      manager.logResponse('tool', 'test', { data: 'a' });
      manager.logResponse('tool', 'test', { data: 'much longer string here' });
      manager.logResponse('tool', 'test', { data: 'xyz' });
      
      const stats = manager.getStats();
      expect(stats['tool:test'].minBytes).toBeLessThan(stats['tool:test'].maxBytes);
      expect(stats['tool:test'].avgBytes).toBeGreaterThan(0);
    });

    it('should update lastCallTime', () => {
      const before = new Date();
      manager.logResponse('tool', 'test', { data: 'test' });
      const after = new Date();
      
      const stats = manager.getStats();
      expect(stats['tool:test'].lastCallTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats['tool:test'].lastCallTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getStats', () => {
    it('should calculate averages correctly', () => {
      const smallResponse = { data: 'a' };
      const largeResponse = { data: 'a'.repeat(1000) };
      
      manager.logResponse('tool', 'test', smallResponse);
      manager.logResponse('tool', 'test', largeResponse);
      
      const stats = manager.getStats();
      const expectedAvg = Math.round(
        (JSON.stringify(smallResponse).length + JSON.stringify(largeResponse).length) / 2
      );
      expect(stats['tool:test'].avgBytes).toBe(expectedAvg);
    });

    it('should return empty object when no metrics collected', () => {
      const stats = manager.getStats();
      expect(Object.keys(stats).length).toBe(0);
    });

    it('should filter by name when provided', () => {
      manager.logResponse('tool', 'search_docs', { data: 'test' });
      manager.logResponse('tool', 'get_function', { data: 'test' });
      manager.logResponse('resource', 'section', { data: 'test' });
      
      const toolStats = manager.getStats('tool');
      const searchStats = manager.getStats('search');
      
      expect(Object.keys(toolStats).length).toBe(2);
      expect(Object.keys(searchStats).length).toBe(1);
      expect(searchStats['tool:search_docs']).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      manager.logResponse('tool', 'test', { data: 'hello' });
      manager.logResponse('resource', 'docs', { data: 'world' });
      
      expect(Object.keys(manager.getStats()).length).toBe(2);
      
      manager.reset();
      
      const stats = manager.getStats();
      expect(Object.keys(stats).length).toBe(0);
    });
  });

  describe('getSummaryText', () => {
    it('should return formatted summary', () => {
      manager.logResponse('tool', 'test', { data: 'hello' });
      
      const summary = manager.getSummaryText();
      expect(summary).toContain('Performance & Response Metrics:');
      expect(summary).toContain('tool:test:');
      expect(summary).toContain('Calls: 1');
      expect(summary).toContain('Avg');
      expect(summary).toContain('B'); // bytes
    });

    it('should show message when no metrics', () => {
      const summary = manager.getSummaryText();
      expect(summary).toContain('No metrics collected yet');
    });

    it('should sort by total bytes descending', () => {
      manager.logResponse('tool', 'small', { data: 'a' });
      manager.logResponse('tool', 'large', { data: 'a'.repeat(1000) });
      
      const summary = manager.getSummaryText();
      const smallIndex = summary.indexOf('tool:small');
      const largeIndex = summary.indexOf('tool:large');
      
      expect(largeIndex).toBeLessThan(smallIndex);
    });
  });

  describe('getTotalCalls', () => {
    it('should return total calls across all operations', () => {
      manager.logResponse('tool', 'test1', { data: 'a' });
      manager.logResponse('tool', 'test1', { data: 'b' });
      manager.logResponse('tool', 'test2', { data: 'c' });
      manager.logResponse('resource', 'test3', { data: 'd' });
      
      expect(manager.getTotalCalls()).toBe(4);
    });

    it('should return 0 when no metrics', () => {
      expect(manager.getTotalCalls()).toBe(0);
    });
  });

  describe('getTotalBytes', () => {
    it('should return total bytes across all operations', () => {
      manager.logResponse('tool', 'test1', { data: 'a' });
      manager.logResponse('tool', 'test2', { data: 'b' });
      
      const stats = manager.getStats();
      const expectedTotal = stats['tool:test1'].totalBytes + stats['tool:test2'].totalBytes;
      
      expect(manager.getTotalBytes()).toBe(expectedTotal);
    });

    it('should return 0 when no metrics', () => {
      expect(manager.getTotalBytes()).toBe(0);
    });
  });

  describe('response size calculation', () => {
    it('should accurately measure JSON size', () => {
      const response = { key: 'value', nested: { data: [1, 2, 3] } };
      const expectedSize = JSON.stringify(response).length;
      
      manager.logResponse('tool', 'test', response);
      
      const stats = manager.getStats();
      expect(stats['tool:test'].totalBytes).toBe(expectedSize);
      expect(stats['tool:test'].avgBytes).toBe(expectedSize);
    });

    it('should handle large responses', () => {
      const largeResponse = { data: 'x'.repeat(100000) };
      
      manager.logResponse('tool', 'large', largeResponse);
      
      const stats = manager.getStats();
      expect(stats['tool:large'].totalBytes).toBeGreaterThan(100000);
    });
  });

  describe('latency tracking', () => {
    it('should track latency when provided', () => {
      manager.logResponse('tool', 'test', { data: 'hello' }, 150);
      
      const stats = manager.getStats();
      expect(stats['tool:test'].totalLatencyMs).toBe(150);
      expect(stats['tool:test'].minLatencyMs).toBe(150);
      expect(stats['tool:test'].maxLatencyMs).toBe(150);
      expect(stats['tool:test'].avgLatencyMs).toBe(150);
    });

    it('should handle latency of 0', () => {
      manager.logResponse('tool', 'test', { data: 'hello' }, 0);
      
      const stats = manager.getStats();
      expect(stats['tool:test'].totalLatencyMs).toBe(0);
      expect(stats['tool:test'].avgLatencyMs).toBe(0);
    });

    it('should track min and max latency across multiple calls', () => {
      manager.logResponse('tool', 'test', { data: 'a' }, 50);
      manager.logResponse('tool', 'test', { data: 'b' }, 200);
      manager.logResponse('tool', 'test', { data: 'c' }, 100);
      
      const stats = manager.getStats();
      expect(stats['tool:test'].minLatencyMs).toBe(50);
      expect(stats['tool:test'].maxLatencyMs).toBe(200);
      expect(stats['tool:test'].avgLatencyMs).toBe(Math.round((50 + 200 + 100) / 3));
    });

    it('should calculate average latency correctly', () => {
      manager.logResponse('tool', 'test', { data: 'a' }, 100);
      manager.logResponse('tool', 'test', { data: 'b' }, 200);
      manager.logResponse('tool', 'test', { data: 'c' }, 300);
      
      const stats = manager.getStats();
      expect(stats['tool:test'].avgLatencyMs).toBe(200);
    });

    it('should work without latency parameter (backward compatibility)', () => {
      manager.logResponse('tool', 'test', { data: 'hello' });
      
      const stats = manager.getStats();
      expect(stats['tool:test'].totalLatencyMs).toBe(0);
      expect(stats['tool:test'].avgLatencyMs).toBe(0);
    });
  });

  describe('error tracking', () => {
    it('should track errors', () => {
      const error = new Error('Test error');
      manager.logError('tool', 'failing_tool', error);
      
      const stats = manager.getStats();
      expect(stats['tool:failing_tool'].errors).toBe(1);
      expect(stats['tool:failing_tool'].lastError).toBeDefined();
      expect(stats['tool:failing_tool'].lastError?.message).toBe('Test error');
    });

    it('should increment error count on multiple errors', () => {
      manager.logError('tool', 'test', new Error('Error 1'));
      manager.logError('tool', 'test', new Error('Error 2'));
      manager.logError('tool', 'test', new Error('Error 3'));
      
      const stats = manager.getStats();
      expect(stats['tool:test'].errors).toBe(3);
      expect(stats['tool:test'].lastError?.message).toBe('Error 3');
    });

    it('should calculate error rate correctly', () => {
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logError('tool', 'test', new Error('Failed'));
      
      const stats = manager.getStats();
      expect(stats['tool:test'].calls).toBe(2);
      expect(stats['tool:test'].errors).toBe(1);
      expect(stats['tool:test'].errorRate).toBeCloseTo(1 / 3, 2);
    });

    it('should handle errors before any successful calls', () => {
      manager.logError('tool', 'test', new Error('Failed on first try'));
      
      const stats = manager.getStats();
      expect(stats['tool:test'].errors).toBe(1);
      expect(stats['tool:test'].calls).toBe(0);
      expect(stats['tool:test'].errorRate).toBe(1);
    });

    it('should preserve error timestamp', () => {
      const before = new Date();
      manager.logError('tool', 'test', new Error('Test error'));
      const after = new Date();
      
      const stats = manager.getStats();
      expect(stats['tool:test'].lastError?.timestamp).toBeDefined();
      expect(stats['tool:test'].lastError!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats['tool:test'].lastError!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getTotalErrors', () => {
    it('should return total errors across all operations', () => {
      manager.logError('tool', 'test1', new Error('Error 1'));
      manager.logError('tool', 'test1', new Error('Error 2'));
      manager.logError('tool', 'test2', new Error('Error 3'));
      manager.logError('resource', 'test3', new Error('Error 4'));
      
      expect(manager.getTotalErrors()).toBe(4);
    });

    it('should return 0 when no errors', () => {
      manager.logResponse('tool', 'test', { data: 'success' });
      expect(manager.getTotalErrors()).toBe(0);
    });

    it('should not count successful responses as errors', () => {
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logError('tool', 'test', new Error('Failed'));
      
      expect(manager.getTotalErrors()).toBe(1);
    });
  });

  describe('getAverageLatency', () => {
    it('should calculate average latency across all operations', () => {
      manager.logResponse('tool', 'test1', { data: 'a' }, 100);
      manager.logResponse('tool', 'test1', { data: 'b' }, 200);
      manager.logResponse('tool', 'test2', { data: 'c' }, 300);
      
      expect(manager.getAverageLatency()).toBe(200);
    });

    it('should return 0 when no calls', () => {
      expect(manager.getAverageLatency()).toBe(0);
    });

    it('should handle mixed operations with and without latency', () => {
      manager.logResponse('tool', 'test1', { data: 'a' }, 100);
      manager.logResponse('tool', 'test2', { data: 'b' }); // No latency
      manager.logResponse('tool', 'test3', { data: 'c' }, 200);
      
      expect(manager.getAverageLatency()).toBe(100); // (100 + 0 + 200) / 3
    });
  });

  describe('getSummaryText with enhanced metrics', () => {
    it('should include latency information', () => {
      manager.logResponse('tool', 'test', { data: 'hello' }, 150);
      
      const summary = manager.getSummaryText();
      expect(summary).toContain('Performance & Response Metrics:');
      expect(summary).toContain('Latency:');
      expect(summary).toContain('150ms');
    });

    it('should include error information', () => {
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logError('tool', 'test', new Error('Test error'));
      
      const summary = manager.getSummaryText();
      expect(summary).toContain('Errors: 1');
      expect(summary).toContain('Last Error: Test error');
    });

    it('should show error rate as percentage', () => {
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logResponse('tool', 'test', { data: 'success' });
      manager.logError('tool', 'test', new Error('Failed'));
      
      const summary = manager.getSummaryText();
      expect(summary).toContain('33.3%'); // 1 error out of 3 total operations
    });

    it('should not show last error section if no errors', () => {
      manager.logResponse('tool', 'test', { data: 'success' }, 100);
      
      const summary = manager.getSummaryText();
      expect(summary).toContain('Errors: 0');
      expect(summary).not.toContain('Last Error:');
    });
  });

  describe('mixed scenarios', () => {
    it('should handle successful and failed calls together', () => {
      manager.logResponse('tool', 'test', { data: 'success1' }, 100);
      manager.logError('tool', 'test', new Error('Failed'));
      manager.logResponse('tool', 'test', { data: 'success2' }, 200);
      manager.logError('tool', 'test', new Error('Failed again'));
      
      const stats = manager.getStats();
      expect(stats['tool:test'].calls).toBe(2);
      expect(stats['tool:test'].errors).toBe(2);
      expect(stats['tool:test'].errorRate).toBe(0.5);
      expect(stats['tool:test'].avgLatencyMs).toBe(150);
    });

    it('should maintain accurate metrics across different tools', () => {
      manager.logResponse('tool', 'fast', { data: 'a' }, 50);
      manager.logResponse('tool', 'slow', { data: 'b' }, 500);
      manager.logError('tool', 'buggy', new Error('Failed'));
      
      expect(manager.getTotalCalls()).toBe(2);
      expect(manager.getTotalErrors()).toBe(1);
      expect(manager.getAverageLatency()).toBe(275); // (50 + 500 + 0) / 2 calls
    });
  });
});
