/**
 * MetricsManager - Tracks response sizes, call frequencies, latency, and errors
 * 
 * Provides comprehensive metrics collection for performance monitoring and optimization.
 * Logs to stderr and maintains in-memory statistics.
 */

import { MetricsSummary, MetricType, IMetricsManager, MetricsSnapshot, CacheMetrics, MetricsReport, ReportConfig, ExportConfig, MetricsExportBundle, MetricsPrivacyConfig } from '../types/metrics.js';
import { MetricsPersistence } from './metrics-persistence.js';
import { MetricsReporter } from './metrics-reporter.js';
import { MetricsExporter } from './metrics-exporter.js';

// Re-export for convenience
export type { IMetricsManager };

interface InternalMetricData {
  calls: number;
  totalBytes: number;
  minBytes: number;
  maxBytes: number;
  lastCallTime: Date;
  // Performance metrics
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  // Error tracking
  errors: number;
  lastError?: {
    timestamp: Date;
    message: string;
  };
}

export class MetricsManager implements IMetricsManager {
  private metrics = new Map<string, InternalMetricData>();
  private persistence: MetricsPersistence;
  private reporter: MetricsReporter;
  private exporter: MetricsExporter;
  private lastSnapshotDate?: string;
  private cacheMetrics?: CacheMetrics;

  constructor(persistence?: MetricsPersistence) {
    this.persistence = persistence || new MetricsPersistence();
    this.reporter = new MetricsReporter(this, this.persistence);
    this.exporter = new MetricsExporter(this, this.persistence);
  }

  /**
   * Log a response and update metrics
   * @param type - 'tool' or 'resource'
   * @param name - Name of the tool or resource
   * @param response - The response object to measure
   * @param latencyMs - Optional execution time in milliseconds
   */
  logResponse(type: MetricType, name: string, response: any, latencyMs?: number): void {
    const size = JSON.stringify(response).length;
    const key = `${type}:${name}`;
    const latency = latencyMs ?? 0;

    // Log to stderr (doesn't interfere with MCP protocol on stdout)
    const logParts = [`[METRICS] ${key} size=${size} bytes`];
    if (latencyMs !== undefined) {
      logParts.push(`latency=${latency}ms`);
    }
    logParts.push(`time=${new Date().toISOString()}`);
    console.error(logParts.join(' '));

    // Update in-memory stats
    const existing = this.metrics.get(key);
    if (existing) {
      this.metrics.set(key, {
        calls: existing.calls + 1,
        totalBytes: existing.totalBytes + size,
        minBytes: Math.min(existing.minBytes, size),
        maxBytes: Math.max(existing.maxBytes, size),
        lastCallTime: new Date(),
        totalLatencyMs: existing.totalLatencyMs + latency,
        minLatencyMs: Math.min(existing.minLatencyMs, latency),
        maxLatencyMs: Math.max(existing.maxLatencyMs, latency),
        errors: existing.errors,
        lastError: existing.lastError,
      });
    } else {
      this.metrics.set(key, {
        calls: 1,
        totalBytes: size,
        minBytes: size,
        maxBytes: size,
        lastCallTime: new Date(),
        totalLatencyMs: latency,
        minLatencyMs: latency,
        maxLatencyMs: latency,
        errors: 0,
      });
    }
  }

  /**
   * Log an error for a specific operation
   * @param type - 'tool' or 'resource'
   * @param name - Name of the tool or resource
   * @param error - The error that occurred
   */
  logError(type: MetricType, name: string, error: Error): void {
    const key = `${type}:${name}`;
    
    console.error(`[METRICS] ${key} ERROR: ${error.message} time=${new Date().toISOString()}`);

    const existing = this.metrics.get(key);
    if (existing) {
      this.metrics.set(key, {
        ...existing,
        errors: existing.errors + 1,
        lastError: {
          timestamp: new Date(),
          message: error.message,
        },
      });
    } else {
      // Create initial entry with error
      this.metrics.set(key, {
        calls: 0,
        totalBytes: 0,
        minBytes: 0,
        maxBytes: 0,
        lastCallTime: new Date(),
        totalLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        errors: 1,
        lastError: {
          timestamp: new Date(),
          message: error.message,
        },
      });
    }
  }

  /**
   * Get metrics summary for all or specific operations
   * @param nameFilter - Optional filter to match specific tools/resources
   * @returns Summary of metrics with calculated averages
   */
  getStats(nameFilter?: string): MetricsSummary {
    const summary: MetricsSummary = {};

    for (const [key, data] of this.metrics.entries()) {
      if (!nameFilter || key.includes(nameFilter)) {
        const avgBytes = data.calls > 0 ? Math.round(data.totalBytes / data.calls) : 0;
        const avgLatencyMs = data.calls > 0 ? Math.round(data.totalLatencyMs / data.calls) : 0;
        const errorRate = (data.calls + data.errors) > 0 
          ? data.errors / (data.calls + data.errors) 
          : 0;

        summary[key] = {
          ...data,
          avgBytes,
          avgLatencyMs,
          errorRate,
        };
      }
    }

    return summary;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Get formatted summary for display
   * @returns Human-readable metrics summary
   */
  getSummaryText(): string {
    const stats = this.getStats();
    const lines: string[] = ['Performance & Response Metrics:', ''];

    if (Object.keys(stats).length === 0) {
      lines.push('No metrics collected yet.');
      return lines.join('\n');
    }

    // Sort by total bytes descending
    const sorted = Object.entries(stats).sort(
      (a, b) => b[1].totalBytes - a[1].totalBytes
    );

    for (const [key, data] of sorted) {
      lines.push(`${key}:`);
      lines.push(`  Calls: ${data.calls} | Errors: ${data.errors} (${(data.errorRate * 100).toFixed(1)}%)`);
      lines.push(`  Response Size: Avg ${data.avgBytes}B | Min ${data.minBytes}B | Max ${data.maxBytes}B`);
      lines.push(`  Latency: Avg ${data.avgLatencyMs}ms | Min ${data.minLatencyMs}ms | Max ${data.maxLatencyMs}ms`);
      if (data.lastError) {
        lines.push(`  Last Error: ${data.lastError.message} at ${data.lastError.timestamp.toISOString()}`);
      }
      lines.push(`  Last Call: ${data.lastCallTime.toISOString()}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get total calls across all operations
   */
  getTotalCalls(): number {
    let total = 0;
    for (const data of this.metrics.values()) {
      total += data.calls;
    }
    return total;
  }

  /**
   * Get total bytes transferred across all operations
   */
  getTotalBytes(): number {
    let total = 0;
    for (const data of this.metrics.values()) {
      total += data.totalBytes;
    }
    return total;
  }

  /**
   * Get total errors across all operations
   */
  getTotalErrors(): number {
    let total = 0;
    for (const data of this.metrics.values()) {
      total += data.errors;
    }
    return total;
  }

  /**
   * Get average latency across all operations
   */
  getAverageLatency(): number {
    const totalCalls = this.getTotalCalls();
    if (totalCalls === 0) return 0;

    let totalLatency = 0;
    for (const data of this.metrics.values()) {
      totalLatency += data.totalLatencyMs;
    }
    return Math.round(totalLatency / totalCalls);
  }

  /**
   * Set cache metrics for inclusion in snapshots
   */
  setCacheMetrics(cacheMetrics: CacheMetrics): void {
    this.cacheMetrics = cacheMetrics;
  }

  /**
   * Create a snapshot of current metrics
   */
  async createSnapshot(): Promise<MetricsSnapshot> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const snapshot: MetricsSnapshot = {
      timestamp: now.toISOString(),
      date: dateStr,
      metrics: this.getStats(),
      totalCalls: this.getTotalCalls(),
      totalBytes: this.getTotalBytes(),
      totalErrors: this.getTotalErrors(),
      avgLatencyMs: this.getAverageLatency(),
      cacheMetrics: this.cacheMetrics,
    };

    // Save to disk if auto-snapshot is enabled
    const config = await this.persistence.getConfig();
    if (config.autoSnapshot && dateStr !== this.lastSnapshotDate) {
      await this.persistence.saveSnapshot(snapshot);
      this.lastSnapshotDate = dateStr;
    }

    return snapshot;
  }

  /**
   * Save current metrics summary to disk
   */
  async saveSummary(): Promise<void> {
    const summary = this.getStats();
    await this.persistence.saveSummary(summary);
  }

  /**
   * Load metrics summary from disk
   */
  async loadSummary(): Promise<MetricsSummary | null> {
    return await this.persistence.loadSummary();
  }

  /**
   * Get historical metrics
   */
  async getHistory(days?: number): Promise<any> {
    return await this.persistence.getHistory(days);
  }

  /**
   * Clean up old snapshots
   */
  async cleanupOldSnapshots(): Promise<number> {
    const config = await this.persistence.getConfig();
    return await this.persistence.cleanup(config.retentionDays);
  }

  /**
   * Get persistence layer for direct access
   */
  getPersistence(): MetricsPersistence {
    return this.persistence;
  }

  /**
   * Get reporter for direct access
   */
  getReporter(): MetricsReporter {
    return this.reporter;
  }

  /**
   * Generate a comprehensive metrics report
   */
  async generateReport(config?: Partial<ReportConfig>): Promise<MetricsReport> {
    return await this.reporter.generateReport(config);
  }

  /**
   * Generate daily summary report
   */
  async generateDailySummary(): Promise<MetricsReport> {
    return await this.reporter.generateDailySummary();
  }

  /**
   * Generate weekly summary report
   */
  async generateWeeklySummary(): Promise<MetricsReport> {
    return await this.reporter.generateWeeklySummary();
  }

  /**
   * Generate monthly summary report
   */
  async generateMonthlySummary(): Promise<MetricsReport> {
    return await this.reporter.generateMonthlySummary();
  }

  /**
   * Get exporter for direct access
   */
  getExporter(): MetricsExporter {
    return this.exporter;
  }

  /**
   * Export metrics with configuration
   */
  async exportMetrics(config: ExportConfig): Promise<MetricsExportBundle> {
    return await this.exporter.exportMetrics(config);
  }

  /**
   * Update privacy configuration for exports
   */
  updatePrivacyConfig(config: Partial<MetricsPrivacyConfig>): void {
    this.exporter.updatePrivacyConfig(config);
  }

  /**
   * Get current privacy configuration
   */
  getPrivacyConfig(): MetricsPrivacyConfig {
    return this.exporter.getPrivacyConfig();
  }

  /**
   * Quick export to JSON with privacy mode
   */
  async exportToJSON(privacyMode: boolean = false): Promise<string> {
    return await this.exporter.exportToJSON({
      format: 'json',
      includeSnapshots: true,
      includeReports: false,
      includeRawMetrics: true,
      privacyMode,
    });
  }

  /**
   * Quick export to CSV with privacy mode
   */
  async exportToCSV(privacyMode: boolean = false): Promise<string> {
    return await this.exporter.exportToCSV({
      format: 'csv',
      includeSnapshots: true,
      includeReports: false,
      includeRawMetrics: true,
      privacyMode,
    });
  }
}

/**
 * Null object implementation of IMetricsManager for cases where metrics are disabled
 */
export class NullMetricsManager implements IMetricsManager {
  logResponse(_type: MetricType, _operation: string, _response: any, _latencyMs?: number): void {
    // No-op
  }

  logError(_type: MetricType, _operation: string, _error: Error): void {
    // No-op
  }

  getStats(_filter?: string): MetricsSummary {
    return {};
  }

  getTotalCalls(): number {
    return 0;
  }

  getTotalBytes(): number {
    return 0;
  }

  getTotalErrors(): number {
    return 0;
  }

  getAverageLatency(): number {
    return 0;
  }

  getSummaryText(): string {
    return 'Metrics tracking disabled';
  }

  reset(): void {
    // No-op
  }
}
