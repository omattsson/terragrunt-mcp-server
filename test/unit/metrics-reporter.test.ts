/**
 * Unit tests for MetricsReporter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsReporter } from '../../src/terragrunt/metrics-reporter.js';
import { MetricsManager } from '../../src/terragrunt/metrics.js';
import { MetricsPersistence } from '../../src/terragrunt/metrics-persistence.js';
import { MetricsSnapshot } from '../../src/types/metrics.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MetricsReporter', () => {
  let reporter: MetricsReporter;
  let manager: MetricsManager;
  let persistence: MetricsPersistence;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-reporter-metrics');
    persistence = new MetricsPersistence(testDir);
    manager = new MetricsManager(persistence);
    reporter = manager.getReporter();

    // Add some test data
    manager.logResponse('tool', 'search_docs', { results: [] }, 100);
    manager.logResponse('tool', 'search_docs', { results: [] }, 150);
    manager.logResponse('tool', 'get_function', { data: 'test' }, 50);
    manager.logError('tool', 'failing_tool', new Error('Test error'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateReport', () => {
    it('should generate a text format report by default', async () => {
      const report = await reporter.generateReport();

      expect(report.format).toBe('text');
      expect(report.content).toContain('Metrics Report');
      expect(report.content).toContain('SUMMARY');
      expect(report.summary.totalCalls).toBeGreaterThan(0);
    });

    it('should include summary statistics', async () => {
      const report = await reporter.generateReport();

      expect(report.summary.totalCalls).toBe(3);
      expect(report.summary.totalErrors).toBe(1);
      expect(report.summary.operationCount).toBe(3);
      expect(report.summary.avgLatency).toBeGreaterThan(0);
    });

    it('should generate JSON format report', async () => {
      const report = await reporter.generateReport({ format: 'json' });

      expect(report.format).toBe('json');
      const parsed = JSON.parse(report.content);
      expect(parsed.summary).toBeDefined();
      expect(parsed.topOperations).toBeDefined();
    });

    it('should generate markdown format report', async () => {
      const report = await reporter.generateReport({ format: 'markdown' });

      expect(report.format).toBe('markdown');
      expect(report.content).toContain('# Daily Metrics Report');
      expect(report.content).toContain('## Summary');
      expect(report.content).toContain('## Top Operations');
    });

    it('should respect topOperations limit', async () => {
      const report = await reporter.generateReport({ topOperations: 2 });

      expect(report.topOperations).toBeDefined();
      expect(report.topOperations!.length).toBeLessThanOrEqual(2);
    });

    it('should include date range when history is available', async () => {
      // Create a snapshot
      await manager.createSnapshot();

      const report = await reporter.generateReport({ period: 'daily' });

      expect(report.summary.dateRange).toBeDefined();
    });
  });

  describe('generateDailySummary', () => {
    it('should generate a daily summary', async () => {
      const report = await reporter.generateDailySummary();

      expect(report.title).toContain('Daily');
      expect(report.period).toBe('daily');
      expect(report.format).toBe('text');
    });

    it('should include top 5 operations', async () => {
      const report = await reporter.generateDailySummary();

      expect(report.topOperations).toBeDefined();
      expect(report.topOperations!.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateWeeklySummary', () => {
    it('should generate a weekly summary', async () => {
      const report = await reporter.generateWeeklySummary();

      expect(report.title).toContain('Weekly');
      expect(report.period).toBe('weekly');
    });

    it('should include trends if history available', async () => {
      // Create multiple snapshots
      const snapshot1: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-04',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1000,
            minLatencyMs: 100,
            maxLatencyMs: 100,
            avgLatencyMs: 100,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 0,
        avgLatencyMs: 100,
      };

      const snapshot2: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 20,
            totalBytes: 2000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1500,
            minLatencyMs: 75,
            maxLatencyMs: 75,
            avgLatencyMs: 75,
            errors: 1,
            errorRate: 0.05,
          },
        },
        totalCalls: 20,
        totalBytes: 2000,
        totalErrors: 1,
        avgLatencyMs: 75,
      };

      await persistence.saveSnapshot(snapshot1);
      await persistence.saveSnapshot(snapshot2);

      const report = await reporter.generateWeeklySummary();

      expect(report.trends).toBeDefined();
      if (report.trends && report.trends.length > 0) {
        expect(report.trends[0]).toHaveProperty('trend');
        expect(report.trends[0]).toHaveProperty('callsChange');
      }
    });
  });

  describe('generateMonthlySummary', () => {
    it('should generate a monthly summary', async () => {
      const report = await reporter.generateMonthlySummary();

      expect(report.title).toContain('Monthly');
      expect(report.period).toBe('monthly');
    });

    it('should include top 15 operations', async () => {
      const report = await reporter.generateMonthlySummary();

      expect(report.topOperations).toBeDefined();
      expect(report.topOperations!.length).toBeLessThanOrEqual(15);
    });
  });

  describe('compareSnapshots', () => {
    it('should calculate trends between two snapshots', async () => {
      const snapshot1: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-05',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1000,
            minLatencyMs: 100,
            maxLatencyMs: 100,
            avgLatencyMs: 100,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 0,
        avgLatencyMs: 100,
      };

      const snapshot2: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 15,
            totalBytes: 1500,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1200,
            minLatencyMs: 80,
            maxLatencyMs: 80,
            avgLatencyMs: 80,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 15,
        totalBytes: 1500,
        totalErrors: 0,
        avgLatencyMs: 80,
      };

      await persistence.saveSnapshot(snapshot1);
      await persistence.saveSnapshot(snapshot2);

      const trends = await reporter.compareSnapshots('2026-01-05', '2026-01-06');

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0].operation).toBe('tool:test');
      expect(trends[0].callsChange).toBe(50); // 50% increase
      expect(trends[0].latencyChange).toBe(-20); // 20% decrease (improvement)
    });

    it('should identify improving trends', async () => {
      const snapshot1: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-05',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 2000,
            minLatencyMs: 200,
            maxLatencyMs: 200,
            avgLatencyMs: 200,
            errors: 2,
            errorRate: 0.2,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 2,
        avgLatencyMs: 200,
      };

      const snapshot2: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1000,
            minLatencyMs: 100,
            maxLatencyMs: 100,
            avgLatencyMs: 100,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 0,
        avgLatencyMs: 100,
      };

      await persistence.saveSnapshot(snapshot1);
      await persistence.saveSnapshot(snapshot2);

      const trends = await reporter.compareSnapshots('2026-01-05', '2026-01-06');

      expect(trends[0].trend).toBe('improving');
      expect(trends[0].latencyChange).toBeLessThan(0);
    });

    it('should identify degrading trends', async () => {
      const snapshot1: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-05',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 1000,
            minLatencyMs: 100,
            maxLatencyMs: 100,
            avgLatencyMs: 100,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 0,
        avgLatencyMs: 100,
      };

      const snapshot2: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 10,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 2000,
            minLatencyMs: 200,
            maxLatencyMs: 200,
            avgLatencyMs: 200,
            errors: 3,
            errorRate: 0.3,
          },
        },
        totalCalls: 10,
        totalBytes: 1000,
        totalErrors: 3,
        avgLatencyMs: 200,
      };

      await persistence.saveSnapshot(snapshot1);
      await persistence.saveSnapshot(snapshot2);

      const trends = await reporter.compareSnapshots('2026-01-05', '2026-01-06');

      expect(trends[0].trend).toBe('degrading');
      expect(trends[0].latencyChange).toBeGreaterThan(0);
    });

    it('should return empty array when snapshots not found', async () => {
      const trends = await reporter.compareSnapshots('2025-01-01', '2025-01-02');
      expect(trends).toEqual([]);
    });
  });

  describe('getTopOperations', () => {
    it('should return operations sorted by calls', async () => {
      const topOps = await reporter.getTopOperations(5, 'calls');

      expect(topOps.length).toBeGreaterThan(0);
      expect(topOps[0].operation).toBe('tool:search_docs'); // 2 calls
      expect(topOps[0].calls).toBe(2);
    });

    it('should return operations sorted by latency', async () => {
      const topOps = await reporter.getTopOperations(5, 'latency');

      expect(topOps.length).toBeGreaterThan(0);
      // search_docs has higher avg latency (125ms) than get_function (50ms)
      expect(topOps[0].operation).toBe('tool:search_docs');
    });

    it('should return operations sorted by errors', async () => {
      const topOps = await reporter.getTopOperations(5, 'errors');

      expect(topOps.length).toBeGreaterThan(0);
      // failing_tool has errors
      expect(topOps[0].operation).toBe('tool:failing_tool');
      expect(topOps[0].errorRate).toBeGreaterThan(0);
    });

    it('should respect the limit', async () => {
      const topOps = await reporter.getTopOperations(1, 'calls');
      expect(topOps.length).toBe(1);
    });
  });

  describe('report formats', () => {
    it('should format text report with sections', async () => {
      const report = await reporter.generateReport({ format: 'text' });

      expect(report.content).toContain('='.repeat(70));
      expect(report.content).toContain('SUMMARY');
      expect(report.content).toContain('TOP OPERATIONS');
      expect(report.content).toContain('Total Calls:');
      expect(report.content).toContain('Average Latency:');
    });

    it('should format markdown report with tables', async () => {
      const report = await reporter.generateReport({ format: 'markdown' });

      expect(report.content).toContain('# Daily Metrics Report');
      expect(report.content).toContain('## Summary');
      expect(report.content).toContain('| Metric | Value |');
      expect(report.content).toContain('## Top Operations');
    });

    it('should format JSON report with structured data', async () => {
      const report = await reporter.generateReport({ format: 'json' });

      const parsed = JSON.parse(report.content);
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('topOperations');
      expect(parsed.summary).toHaveProperty('totalCalls');
      expect(parsed.summary).toHaveProperty('avgLatency');
    });
  });

  describe('report content', () => {
    it('should include operation counts in text format', async () => {
      const report = await reporter.generateReport({ format: 'text' });

      expect(report.content).toMatch(/tool:search_docs - 2 calls/);
      expect(report.content).toMatch(/tool:get_function - 1 calls/);
    });

    it('should include latency information', async () => {
      const report = await reporter.generateReport({ format: 'text' });

      expect(report.content).toContain('ms avg');
    });

    it('should include error rates', async () => {
      const report = await reporter.generateReport({ format: 'text' });

      expect(report.content).toContain('% errors');
    });
  });

  describe('integration with MetricsManager', () => {
    it('should generate report via MetricsManager', async () => {
      const report = await manager.generateReport({ format: 'text' });

      expect(report).toBeDefined();
      expect(report.summary.totalCalls).toBe(3);
    });

    it('should generate daily summary via MetricsManager', async () => {
      const report = await manager.generateDailySummary();

      expect(report.period).toBe('daily');
    });

    it('should generate weekly summary via MetricsManager', async () => {
      const report = await manager.generateWeeklySummary();

      expect(report.period).toBe('weekly');
    });

    it('should generate monthly summary via MetricsManager', async () => {
      const report = await manager.generateMonthlySummary();

      expect(report.period).toBe('monthly');
    });
  });
});
