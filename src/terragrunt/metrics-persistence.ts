/**
 * Handles persistence of metrics to disk for historical tracking
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  IMetricsPersistence,
  MetricsPersistenceConfig,
  MetricsSnapshot,
  MetricsHistory,
  MetricsSummary,
} from '../types/metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MetricsPersistence implements IMetricsPersistence {
  private metricsDir: string;
  private snapshotsDir: string;
  private summaryFile: string;
  private configFile: string;
  private config: MetricsPersistenceConfig;

  constructor(baseDir?: string) {
    // Default to .mcp-metrics in project root
    this.metricsDir = baseDir || path.join(__dirname, '../../.mcp-metrics');
    this.snapshotsDir = path.join(this.metricsDir, 'snapshots');
    this.summaryFile = path.join(this.metricsDir, 'summary.json');
    this.configFile = path.join(this.metricsDir, 'config.json');

    // Default configuration
    this.config = {
      enabled: true,
      directory: this.metricsDir,
      retentionDays: 30,
      autoSnapshot: true,
    };
  }

  /**
   * Ensure metrics directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.metricsDir, { recursive: true });
    await fs.mkdir(this.snapshotsDir, { recursive: true });
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get snapshot file path for a given date
   */
  private getSnapshotPath(date: string): string {
    return path.join(this.snapshotsDir, `${date}.json`);
  }

  /**
   * Save a metrics snapshot
   */
  async saveSnapshot(snapshot: MetricsSnapshot): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.ensureDirectories();
      const filePath = this.getSnapshotPath(snapshot.date);

      // Convert Date objects to ISO strings for JSON serialization
      const serializable = this.prepareForSerialization(snapshot);

      await fs.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
      console.error(`[MetricsPersistence] Saved snapshot: ${filePath}`);
    } catch (error) {
      console.error('[MetricsPersistence] Failed to save snapshot:', error);
      throw error;
    }
  }

  /**
   * Load a metrics snapshot for a specific date
   */
  async loadSnapshot(date: string): Promise<MetricsSnapshot | null> {
    try {
      const filePath = this.getSnapshotPath(date);
      const content = await fs.readFile(filePath, 'utf-8');
      const snapshot = JSON.parse(content);

      // Restore Date objects
      return this.restoreDatesInSnapshot(snapshot);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error('[MetricsPersistence] Failed to load snapshot:', error);
      throw error;
    }
  }

  /**
   * Get historical metrics for the last N days
   */
  async getHistory(days: number = 30): Promise<MetricsHistory> {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(this.snapshotsDir);

      // Filter JSON files and sort by date
      const snapshotFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, days);

      const snapshots: MetricsSnapshot[] = [];
      for (const file of snapshotFiles) {
        const date = file.replace('.json', '');
        const snapshot = await this.loadSnapshot(date);
        if (snapshot) {
          snapshots.push(snapshot);
        }
      }

      return {
        snapshots,
        firstSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].date : '',
        lastSnapshot: snapshots.length > 0 ? snapshots[0].date : '',
        totalSnapshots: snapshots.length,
      };
    } catch (error) {
      console.error('[MetricsPersistence] Failed to get history:', error);
      return {
        snapshots: [],
        firstSnapshot: '',
        lastSnapshot: '',
        totalSnapshots: 0,
      };
    }
  }

  /**
   * Clean up old snapshots beyond retention period
   */
  async cleanup(retentionDays: number): Promise<number> {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(this.snapshotsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffStr = this.formatDate(cutoffDate);

      let deletedCount = 0;
      for (const file of files) {
        if (file.endsWith('.json')) {
          const date = file.replace('.json', '');
          if (date < cutoffStr) {
            await fs.unlink(path.join(this.snapshotsDir, file));
            deletedCount++;
            console.error(`[MetricsPersistence] Deleted old snapshot: ${file}`);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('[MetricsPersistence] Failed to cleanup:', error);
      return 0;
    }
  }

  /**
   * Save aggregated summary
   */
  async saveSummary(summary: MetricsSummary): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.ensureDirectories();
      const serializable = this.prepareForSerialization(summary);
      await fs.writeFile(this.summaryFile, JSON.stringify(serializable, null, 2), 'utf-8');
      console.error('[MetricsPersistence] Saved summary');
    } catch (error) {
      console.error('[MetricsPersistence] Failed to save summary:', error);
      throw error;
    }
  }

  /**
   * Load aggregated summary
   */
  async loadSummary(): Promise<MetricsSummary | null> {
    try {
      const content = await fs.readFile(this.summaryFile, 'utf-8');
      const summary = JSON.parse(content);
      return this.restoreDatesInSummary(summary);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error('[MetricsPersistence] Failed to load summary:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<MetricsPersistenceConfig> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8');
      const config = JSON.parse(content);
      this.config = { ...this.config, ...config };
      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config doesn't exist, use defaults and save
        await this.updateConfig({});
        return this.config;
      }
      console.error('[MetricsPersistence] Failed to load config:', error);
      return this.config;
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MetricsPersistenceConfig>): Promise<void> {
    try {
      await this.ensureDirectories();
      this.config = { ...this.config, ...config };
      await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2), 'utf-8');
      console.error('[MetricsPersistence] Updated config');
    } catch (error) {
      console.error('[MetricsPersistence] Failed to update config:', error);
      throw error;
    }
  }

  /**
   * Prepare data for JSON serialization by converting Date objects to strings
   */
  private prepareForSerialization(data: any): any {
    if (data instanceof Date) {
      return data.toISOString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.prepareForSerialization(item));
    }

    if (data && typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.prepareForSerialization(value);
      }
      return result;
    }

    return data;
  }

  /**
   * Restore Date objects in a snapshot
   */
  private restoreDatesInSnapshot(snapshot: any): MetricsSnapshot {
    // Restore dates in metrics
    if (snapshot.metrics) {
      for (const key of Object.keys(snapshot.metrics)) {
        const metric = snapshot.metrics[key];
        if (metric.lastCallTime) {
          metric.lastCallTime = new Date(metric.lastCallTime);
        }
        if (metric.lastError?.timestamp) {
          metric.lastError.timestamp = new Date(metric.lastError.timestamp);
        }
      }
    }

    // Restore cache metrics dates
    if (snapshot.cacheMetrics?.lastRefresh) {
      snapshot.cacheMetrics.lastRefresh = new Date(snapshot.cacheMetrics.lastRefresh);
    }

    return snapshot;
  }

  /**
   * Restore Date objects in a summary
   */
  private restoreDatesInSummary(summary: any): MetricsSummary {
    for (const key of Object.keys(summary)) {
      const metric = summary[key];
      if (metric.lastCallTime) {
        metric.lastCallTime = new Date(metric.lastCallTime);
      }
      if (metric.lastError?.timestamp) {
        metric.lastError.timestamp = new Date(metric.lastError.timestamp);
      }
    }
    return summary;
  }
}
