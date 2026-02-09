/**
 * Unit tests for MetricsPersistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsPersistence } from '../../src/terragrunt/metrics-persistence.js';
import { MetricsSnapshot, MetricsSummary } from '../../src/types/metrics.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MetricsPersistence', () => {
  let persistence: MetricsPersistence;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, '.test-metrics');
    persistence = new MetricsPersistence(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('saveSnapshot', () => {
    it('should save a snapshot to disk', async () => {
      const snapshot: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 5,
            totalBytes: 1000,
            minBytes: 100,
            maxBytes: 300,
            avgBytes: 200,
            lastCallTime: new Date(),
            totalLatencyMs: 500,
            minLatencyMs: 50,
            maxLatencyMs: 150,
            avgLatencyMs: 100,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 5,
        totalBytes: 1000,
        totalErrors: 0,
        avgLatencyMs: 100,
      };

      await persistence.saveSnapshot(snapshot);

      // Verify file exists
      const snapshotPath = path.join(testDir, 'snapshots', '2026-01-06.json');
      const exists = await fs
        .access(snapshotPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should serialize Date objects correctly', async () => {
      const now = new Date('2026-01-06T12:00:00Z');
      const snapshot: MetricsSnapshot = {
        timestamp: now.toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 1,
            totalBytes: 100,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: now,
            totalLatencyMs: 50,
            minLatencyMs: 50,
            maxLatencyMs: 50,
            avgLatencyMs: 50,
            errors: 1,
            errorRate: 0.5,
            lastError: {
              timestamp: now,
              message: 'Test error',
            },
          },
        },
        totalCalls: 1,
        totalBytes: 100,
        totalErrors: 1,
        avgLatencyMs: 50,
      };

      await persistence.saveSnapshot(snapshot);

      // Read file and verify ISO string format
      const snapshotPath = path.join(testDir, 'snapshots', '2026-01-06.json');
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.metrics['tool:test'].lastCallTime).toBe(now.toISOString());
      expect(parsed.metrics['tool:test'].lastError.timestamp).toBe(now.toISOString());
    });
  });

  describe('loadSnapshot', () => {
    it('should load a saved snapshot', async () => {
      const original: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:search': {
            calls: 10,
            totalBytes: 5000,
            minBytes: 400,
            maxBytes: 600,
            avgBytes: 500,
            lastCallTime: new Date(),
            totalLatencyMs: 1000,
            minLatencyMs: 80,
            maxLatencyMs: 120,
            avgLatencyMs: 100,
            errors: 2,
            errorRate: 0.2,
          },
        },
        totalCalls: 10,
        totalBytes: 5000,
        totalErrors: 2,
        avgLatencyMs: 100,
      };

      await persistence.saveSnapshot(original);
      const loaded = await persistence.loadSnapshot('2026-01-06');

      expect(loaded).toBeDefined();
      expect(loaded?.date).toBe('2026-01-06');
      expect(loaded?.metrics['tool:search'].calls).toBe(10);
      expect(loaded?.totalCalls).toBe(10);
      expect(loaded?.totalErrors).toBe(2);
    });

    it('should restore Date objects correctly', async () => {
      const now = new Date('2026-01-06T12:00:00Z');
      const snapshot: MetricsSnapshot = {
        timestamp: now.toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:test': {
            calls: 1,
            totalBytes: 100,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: now,
            totalLatencyMs: 50,
            minLatencyMs: 50,
            maxLatencyMs: 50,
            avgLatencyMs: 50,
            errors: 0,
            errorRate: 0,
          },
        },
        totalCalls: 1,
        totalBytes: 100,
        totalErrors: 0,
        avgLatencyMs: 50,
      };

      await persistence.saveSnapshot(snapshot);
      const loaded = await persistence.loadSnapshot('2026-01-06');

      expect(loaded).toBeDefined();
      expect(loaded?.metrics['tool:test'].lastCallTime).toBeInstanceOf(Date);
      expect(loaded?.metrics['tool:test'].lastCallTime.toISOString()).toBe(now.toISOString());
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await persistence.loadSnapshot('2025-12-31');
      expect(loaded).toBeNull();
    });

    it('should restore lastError timestamp', async () => {
      const errorTime = new Date('2026-01-06T12:00:00Z');
      const snapshot: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {
          'tool:failing': {
            calls: 1,
            totalBytes: 100,
            minBytes: 100,
            maxBytes: 100,
            avgBytes: 100,
            lastCallTime: new Date(),
            totalLatencyMs: 50,
            minLatencyMs: 50,
            maxLatencyMs: 50,
            avgLatencyMs: 50,
            errors: 1,
            errorRate: 1,
            lastError: {
              timestamp: errorTime,
              message: 'Test error',
            },
          },
        },
        totalCalls: 1,
        totalBytes: 100,
        totalErrors: 1,
        avgLatencyMs: 50,
      };

      await persistence.saveSnapshot(snapshot);
      const loaded = await persistence.loadSnapshot('2026-01-06');

      expect(loaded?.metrics['tool:failing'].lastError?.timestamp).toBeInstanceOf(Date);
      expect(loaded?.metrics['tool:failing'].lastError?.timestamp.toISOString()).toBe(
        errorTime.toISOString()
      );
    });
  });

  describe('getHistory', () => {
    it('should return empty history when no snapshots exist', async () => {
      const history = await persistence.getHistory();

      expect(history.snapshots).toHaveLength(0);
      expect(history.totalSnapshots).toBe(0);
      expect(history.firstSnapshot).toBe('');
      expect(history.lastSnapshot).toBe('');
    });

    it('should return all snapshots sorted by date descending', async () => {
      // Create multiple snapshots
      const dates = ['2026-01-04', '2026-01-05', '2026-01-06'];
      for (const date of dates) {
        const snapshot: MetricsSnapshot = {
          timestamp: new Date().toISOString(),
          date,
          metrics: {},
          totalCalls: 0,
          totalBytes: 0,
          totalErrors: 0,
          avgLatencyMs: 0,
        };
        await persistence.saveSnapshot(snapshot);
      }

      const history = await persistence.getHistory();

      expect(history.totalSnapshots).toBe(3);
      expect(history.snapshots).toHaveLength(3);
      expect(history.firstSnapshot).toBe('2026-01-04');
      expect(history.lastSnapshot).toBe('2026-01-06');
      expect(history.snapshots[0].date).toBe('2026-01-06'); // Most recent first
      expect(history.snapshots[2].date).toBe('2026-01-04'); // Oldest last
    });

    it('should limit snapshots to requested days', async () => {
      // Create 5 snapshots
      for (let i = 1; i <= 5; i++) {
        const snapshot: MetricsSnapshot = {
          timestamp: new Date().toISOString(),
          date: `2026-01-0${i}`,
          metrics: {},
          totalCalls: 0,
          totalBytes: 0,
          totalErrors: 0,
          avgLatencyMs: 0,
        };
        await persistence.saveSnapshot(snapshot);
      }

      const history = await persistence.getHistory(3);

      expect(history.totalSnapshots).toBe(3);
      expect(history.snapshots[0].date).toBe('2026-01-05'); // Most recent 3
    });
  });

  describe('cleanup', () => {
    it('should delete snapshots older than retention period', async () => {
      // Use relative dates to avoid test flakiness from hardcoded dates
      const now = new Date();
      const oldDateObj = new Date(now);
      oldDateObj.setDate(now.getDate() - 60); // 60 days ago — well beyond 30-day retention
      const recentDateObj = new Date(now);
      recentDateObj.setDate(now.getDate() - 5); // 5 days ago — within 30-day retention
      const oldDate = oldDateObj.toISOString().split('T')[0];
      const recentDate = recentDateObj.toISOString().split('T')[0];

      await persistence.saveSnapshot({
        timestamp: new Date().toISOString(),
        date: oldDate,
        metrics: {},
        totalCalls: 0,
        totalBytes: 0,
        totalErrors: 0,
        avgLatencyMs: 0,
      });

      await persistence.saveSnapshot({
        timestamp: new Date().toISOString(),
        date: recentDate,
        metrics: {},
        totalCalls: 0,
        totalBytes: 0,
        totalErrors: 0,
        avgLatencyMs: 0,
      });

      const deletedCount = await persistence.cleanup(30);

      expect(deletedCount).toBe(1);
      const oldSnapshot = await persistence.loadSnapshot(oldDate);
      const recentSnapshot = await persistence.loadSnapshot(recentDate);
      expect(oldSnapshot).toBeNull();
      expect(recentSnapshot).not.toBeNull();
    });

    it('should return 0 when no old snapshots to delete', async () => {
      const deletedCount = await persistence.cleanup(30);
      expect(deletedCount).toBe(0);
    });
  });

  describe('saveSummary and loadSummary', () => {
    it('should save and load summary', async () => {
      const summary: MetricsSummary = {
        'tool:test1': {
          calls: 5,
          totalBytes: 1000,
          minBytes: 100,
          maxBytes: 300,
          avgBytes: 200,
          lastCallTime: new Date(),
          totalLatencyMs: 500,
          minLatencyMs: 50,
          maxLatencyMs: 150,
          avgLatencyMs: 100,
          errors: 0,
          errorRate: 0,
        },
        'tool:test2': {
          calls: 3,
          totalBytes: 600,
          minBytes: 150,
          maxBytes: 250,
          avgBytes: 200,
          lastCallTime: new Date(),
          totalLatencyMs: 300,
          minLatencyMs: 80,
          maxLatencyMs: 120,
          avgLatencyMs: 100,
          errors: 1,
          errorRate: 0.33,
        },
      };

      await persistence.saveSummary(summary);
      const loaded = await persistence.loadSummary();

      expect(loaded).toBeDefined();
      expect(Object.keys(loaded!)).toHaveLength(2);
      expect(loaded!['tool:test1'].calls).toBe(5);
      expect(loaded!['tool:test2'].calls).toBe(3);
      expect(loaded!['tool:test2'].errors).toBe(1);
    });

    it('should restore Date objects in summary', async () => {
      const now = new Date();
      const summary: MetricsSummary = {
        'tool:test': {
          calls: 1,
          totalBytes: 100,
          minBytes: 100,
          maxBytes: 100,
          avgBytes: 100,
          lastCallTime: now,
          totalLatencyMs: 50,
          minLatencyMs: 50,
          maxLatencyMs: 50,
          avgLatencyMs: 50,
          errors: 0,
          errorRate: 0,
        },
      };

      await persistence.saveSummary(summary);
      const loaded = await persistence.loadSummary();

      expect(loaded!['tool:test'].lastCallTime).toBeInstanceOf(Date);
    });

    it('should return null when summary does not exist', async () => {
      const loaded = await persistence.loadSummary();
      expect(loaded).toBeNull();
    });
  });

  describe('config management', () => {
    it('should create default config on first access', async () => {
      const config = await persistence.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.retentionDays).toBe(30);
      expect(config.autoSnapshot).toBe(true);
      expect(config.directory).toBeDefined();
    });

    it('should persist config updates', async () => {
      await persistence.updateConfig({
        enabled: false,
        retentionDays: 60,
      });

      const config = await persistence.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.retentionDays).toBe(60);
      expect(config.autoSnapshot).toBe(true); // Unchanged
    });

    it('should load existing config from disk', async () => {
      await persistence.updateConfig({
        retentionDays: 45,
        autoSnapshot: false,
      });

      // Create new instance to force loading from disk
      const newPersistence = new MetricsPersistence(testDir);
      const config = await newPersistence.getConfig();

      expect(config.retentionDays).toBe(45);
      expect(config.autoSnapshot).toBe(false);
    });
  });

  describe('directory creation', () => {
    it('should create directories automatically', async () => {
      const snapshot: MetricsSnapshot = {
        timestamp: new Date().toISOString(),
        date: '2026-01-06',
        metrics: {},
        totalCalls: 0,
        totalBytes: 0,
        totalErrors: 0,
        avgLatencyMs: 0,
      };

      await persistence.saveSnapshot(snapshot);

      const metricsDir = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      const snapshotsDir = await fs
        .access(path.join(testDir, 'snapshots'))
        .then(() => true)
        .catch(() => false);

      expect(metricsDir).toBe(true);
      expect(snapshotsDir).toBe(true);
    });
  });
});
