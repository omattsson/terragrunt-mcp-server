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
      expect(summary).toContain('Response Size Metrics:');
      expect(summary).toContain('tool:test:');
      expect(summary).toContain('Calls: 1');
      expect(summary).toContain('Avg:');
      expect(summary).toContain('bytes');
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
});
