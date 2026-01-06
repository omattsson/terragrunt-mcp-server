/**
 * Unit tests for MetricsExporter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsExporter } from '../../src/terragrunt/metrics-exporter.js';
import { MetricsManager } from '../../src/terragrunt/metrics.js';
import { MetricsPersistence } from '../../src/terragrunt/metrics-persistence.js';
import { MetricsSnapshot, MetricsPrivacyConfig } from '../../src/types/metrics.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MetricsExporter', () => {
  let exporter: MetricsExporter;
  let manager: MetricsManager;
  let persistence: MetricsPersistence;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-exporter-metrics');
    persistence = new MetricsPersistence(testDir);
    manager = new MetricsManager(persistence);
    exporter = manager.getExporter();

    // Add some test data
    manager.logResponse('tool', 'search_docs', { results: [] }, 100);
    manager.logResponse('tool', 'get_function', { data: 'test' }, 50);
    manager.logError('tool', 'failing_tool', new Error('Test error'));

    // Create a snapshot
    await manager.createSnapshot();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('exportToJSON', () => {
    it('should export metrics to JSON format', async () => {
      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      const data = JSON.parse(json);
      expect(data).toHaveProperty('exportedAt');
      expect(data).toHaveProperty('currentMetrics');
      expect(data.currentMetrics).toHaveProperty('tool:search_docs');
      expect(data.currentMetrics).toHaveProperty('tool:get_function');
    });

    it('should include snapshots when requested', async () => {
      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: false,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
      });

      const data = JSON.parse(json);
      expect(data).toHaveProperty('snapshots');
      expect(Array.isArray(data.snapshots)).toBe(true);
      expect(data.snapshots.length).toBeGreaterThan(0);
    });

    it('should apply privacy filters when requested', async () => {
      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: true,
      });

      const data = JSON.parse(json);
      expect(data.privacyMode).toBe(true);
      // With default privacy config, data should be unchanged
      expect(data.currentMetrics).toBeDefined();
    });
  });

  describe('exportToCSV', () => {
    it('should export metrics to CSV format', async () => {
      const csv = await exporter.exportToCSV({
        format: 'csv',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      expect(csv).toContain('Date,Operation,Calls');
      expect(csv).toContain('tool:search_docs');
      expect(csv).toContain('tool:get_function');
    });

    it('should include CSV header', async () => {
      const csv = await exporter.exportToCSV({
        format: 'csv',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      const lines = csv.split('\n');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Operation');
      expect(lines[0]).toContain('Calls');
      expect(lines[0]).toContain('Avg Latency');
    });

    it('should escape CSV special characters', async () => {
      manager.logResponse('tool', 'operation,with,commas', { data: 'test' }, 50);

      const csv = await exporter.exportToCSV({
        format: 'csv',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      expect(csv).toContain('"tool:operation,with,commas"');
    });

    it('should include snapshots in CSV when requested', async () => {
      const csv = await exporter.exportToCSV({
        format: 'csv',
        includeRawMetrics: false,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
      });

      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('exportToZip', () => {
    it('should export metrics to ZIP archive', async () => {
      const buffer = await exporter.exportToZip({
        format: 'zip',
        includeRawMetrics: true,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      const content = JSON.parse(buffer.toString());
      expect(content).toHaveProperty('metrics.json');
      expect(content).toHaveProperty('metrics.csv');
      expect(content).toHaveProperty('README.txt');
    });

    it('should include README in ZIP', async () => {
      const buffer = await exporter.exportToZip({
        format: 'zip',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      const content = JSON.parse(buffer.toString());
      expect(content['README.txt']).toContain('Terragrunt MCP Server');
      expect(content['README.txt']).toContain('Metrics Export');
    });
  });

  describe('exportMetrics', () => {
    it('should create export bundle with metadata', async () => {
      const bundle = await exporter.exportMetrics({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
      });

      expect(bundle).toHaveProperty('exportedAt');
      expect(bundle).toHaveProperty('format');
      expect(bundle).toHaveProperty('content');
      expect(bundle).toHaveProperty('metadata');
      expect(bundle.format).toBe('json');
    });

    it('should include metadata in bundle', async () => {
      const bundle = await exporter.exportMetrics({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
      });

      expect(bundle.metadata).toHaveProperty('snapshotCount');
      expect(bundle.metadata).toHaveProperty('dateRange');
      expect(bundle.metadata).toHaveProperty('totalCalls');
      expect(bundle.metadata).toHaveProperty('totalErrors');
    });

    it('should handle different export formats', async () => {
      const jsonBundle = await exporter.exportMetrics({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      const csvBundle = await exporter.exportMetrics({
        format: 'csv',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      expect(jsonBundle.format).toBe('json');
      expect(csvBundle.format).toBe('csv');
      expect(typeof jsonBundle.content).toBe('string');
      expect(typeof csvBundle.content).toBe('string');
    });
  });

  describe('privacy filters', () => {
    it('should anonymize operation names when enabled', async () => {
      exporter.updatePrivacyConfig({
        enabled: true,
        anonymizeOperations: true,
      });

      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: true,
      });

      const data = JSON.parse(json);
      const operations = Object.keys(data.currentMetrics);
      
      // All operations should start with 'op_' (hashed)
      expect(operations.some(op => op.startsWith('op_'))).toBe(true);
      expect(operations.some(op => op === 'tool:search_docs')).toBe(false);
    });

    it('should redact error messages when enabled', async () => {
      exporter.updatePrivacyConfig({
        enabled: true,
        redactErrorMessages: true,
      });

      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: true,
      });

      const data = JSON.parse(json);
      const metrics = Object.values(data.currentMetrics) as any[];
      
      const errorMetric = metrics.find(m => m.lastError);
      if (errorMetric) {
        expect(errorMetric.lastError.message).toBe('[REDACTED]');
      }
    });

    it('should remove timestamps when disabled', async () => {
      exporter.updatePrivacyConfig({
        enabled: true,
        includeTimestamps: false,
      });

      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: true,
      });

      const data = JSON.parse(json);
      expect(data.exportedAt).toBeUndefined();
    });

    it('should apply multiple privacy filters together', async () => {
      exporter.updatePrivacyConfig({
        enabled: true,
        anonymizeOperations: true,
        redactErrorMessages: true,
        includeTimestamps: false,
      });

      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: true,
      });

      const data = JSON.parse(json);
      
      // Check all filters applied
      expect(data.exportedAt).toBeUndefined(); // No timestamps
      const operations = Object.keys(data.currentMetrics);
      expect(operations.some(op => op.startsWith('op_'))).toBe(true); // Anonymized
    });

    it('should not apply filters when privacy mode is disabled', async () => {
      exporter.updatePrivacyConfig({
        enabled: true,
        anonymizeOperations: true,
      });

      const json = await exporter.exportToJSON({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false, // Privacy mode OFF
      });

      const data = JSON.parse(json);
      
      // Operations should NOT be anonymized
      expect(data.currentMetrics).toHaveProperty('tool:search_docs');
    });
  });

  describe('privacy configuration', () => {
    it('should update privacy config', () => {
      const newConfig: Partial<MetricsPrivacyConfig> = {
        enabled: true,
        anonymizeOperations: true,
        dataRetentionDays: 30,
      };

      exporter.updatePrivacyConfig(newConfig);
      const config = exporter.getPrivacyConfig();

      expect(config.enabled).toBe(true);
      expect(config.anonymizeOperations).toBe(true);
      expect(config.dataRetentionDays).toBe(30);
    });

    it('should return current privacy config', () => {
      const config = exporter.getPrivacyConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('anonymizeOperations');
      expect(config).toHaveProperty('redactErrorMessages');
      expect(config).toHaveProperty('includeTimestamps');
      expect(config).toHaveProperty('dataRetentionDays');
    });

    it('should have default privacy config', () => {
      const config = exporter.getPrivacyConfig();

      expect(config.enabled).toBe(false);
      expect(config.anonymizeOperations).toBe(false);
      expect(config.redactErrorMessages).toBe(false);
      expect(config.includeTimestamps).toBe(true);
      expect(config.dataRetentionDays).toBe(365);
    });
  });

  describe('integration with MetricsManager', () => {
    it('should export via MetricsManager', async () => {
      const bundle = await manager.exportMetrics({
        format: 'json',
        includeRawMetrics: true,
        includeSnapshots: false,
        includeReports: false,
        privacyMode: false,
      });

      expect(bundle).toBeDefined();
      expect(bundle.format).toBe('json');
    });

    it('should update privacy config via MetricsManager', () => {
      manager.updatePrivacyConfig({
        enabled: true,
        anonymizeOperations: true,
      });

      const config = manager.getPrivacyConfig();
      expect(config.enabled).toBe(true);
      expect(config.anonymizeOperations).toBe(true);
    });

    it('should export to JSON via MetricsManager shortcut', async () => {
      const json = await manager.exportToJSON(false);

      expect(typeof json).toBe('string');
      const data = JSON.parse(json);
      expect(data).toHaveProperty('currentMetrics');
    });

    it('should export to CSV via MetricsManager shortcut', async () => {
      const csv = await manager.exportToCSV(false);

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Date,Operation,Calls');
    });

    it('should apply privacy mode in shortcuts', async () => {
      manager.updatePrivacyConfig({
        enabled: true,
        anonymizeOperations: true,
      });

      const json = await manager.exportToJSON(true);
      const data = JSON.parse(json);

      const operations = Object.keys(data.currentMetrics);
      expect(operations.some(op => op.startsWith('op_'))).toBe(true);
    });
  });

  describe('date range filtering', () => {
    it('should filter snapshots by date range', async () => {
      // Create multiple snapshots
      const snapshot1: MetricsSnapshot = {
        timestamp: new Date('2026-01-01').toISOString(),
        date: '2026-01-01',
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

      const bundle = await exporter.exportMetrics({
        format: 'json',
        includeRawMetrics: false,
        includeSnapshots: true,
        includeReports: false,
        privacyMode: false,
        dateRange: {
          start: '2026-01-01',
          end: '2026-01-02',
        },
      });

      expect(bundle.metadata.dateRange.start).toBe('2026-01-01');
      expect(bundle.metadata.dateRange.end).toBe('2026-01-02');
    });
  });
});
