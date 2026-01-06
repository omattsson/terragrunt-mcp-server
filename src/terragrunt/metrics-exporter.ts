/**
 * MetricsExporter - Export metrics data in various formats with privacy controls
 */

import {
  ExportConfig,
  ExportFormat,
  MetricsExportBundle,
  MetricsSnapshot,
  MetricsSummary,
  MetricsPrivacyConfig,
  IMetricsExporter,
} from '../types/metrics.js';
import { MetricsManager } from './metrics.js';
import { MetricsPersistence } from './metrics-persistence.js';
import { createHash } from 'crypto';
import { Buffer } from 'buffer';

/**
 * MetricsExporter class for exporting metrics data
 */
export class MetricsExporter implements IMetricsExporter {
  private manager: MetricsManager;
  private persistence: MetricsPersistence;
  private privacyConfig: MetricsPrivacyConfig;

  constructor(
    manager: MetricsManager,
    persistence: MetricsPersistence,
    privacyConfig?: MetricsPrivacyConfig
  ) {
    this.manager = manager;
    this.persistence = persistence;
    this.privacyConfig = privacyConfig || {
      enabled: false,
      anonymizeOperations: false,
      redactErrorMessages: false,
      includeTimestamps: true,
      dataRetentionDays: 365,
    };
  }

  /**
   * Update privacy configuration
   */
  updatePrivacyConfig(config: Partial<MetricsPrivacyConfig>): void {
    this.privacyConfig = { ...this.privacyConfig, ...config };
  }

  /**
   * Get current privacy configuration
   */
  getPrivacyConfig(): MetricsPrivacyConfig {
    return { ...this.privacyConfig };
  }

  /**
   * Export metrics based on configuration
   */
  async exportMetrics(config: ExportConfig): Promise<MetricsExportBundle> {
    switch (config.format) {
      case 'json':
        return this.createBundle(config, await this.exportToJSON(config));
      case 'csv':
        return this.createBundle(config, await this.exportToCSV(config));
      case 'zip':
        return this.createBundleFromBuffer(config, await this.exportToZip(config));
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  /**
   * Export metrics to JSON format
   */
  async exportToJSON(config: ExportConfig): Promise<string> {
    const data = await this.gatherExportData(config);
    const processedData = config.privacyMode ? this.applyPrivacyFilters(data) : data;

    return JSON.stringify(processedData, null, 2);
  }

  /**
   * Export metrics to CSV format
   */
  async exportToCSV(config: ExportConfig): Promise<string> {
    const data = await this.gatherExportData(config);
    const processedData = config.privacyMode ? this.applyPrivacyFilters(data) : data;

    const lines: string[] = [];

    // Add header
    lines.push('Date,Operation,Calls,Total Bytes,Avg Bytes,Total Latency (ms),Avg Latency (ms),Errors,Error Rate');

    // Add current metrics if includeRawMetrics is true
    if (config.includeRawMetrics && processedData.currentMetrics) {
      const currentDate = new Date().toISOString().split('T')[0];
      for (const [operation, metricsData] of Object.entries(processedData.currentMetrics)) {
        const metrics = metricsData as any;
        lines.push(
          [
            currentDate,
            this.escapeCSV(operation),
            metrics.calls,
            metrics.totalBytes,
            metrics.avgBytes.toFixed(2),
            metrics.totalLatencyMs,
            metrics.avgLatencyMs.toFixed(2),
            metrics.errors,
            (metrics.errorRate * 100).toFixed(2),
          ].join(',')
        );
      }
    }

    // Add snapshots if includeSnapshots is true
    if (config.includeSnapshots && processedData.snapshots) {
      for (const snapshot of processedData.snapshots) {
        for (const [operation, metricsData] of Object.entries(snapshot.metrics)) {
          const metrics = metricsData as any;
          lines.push(
            [
              snapshot.date,
              this.escapeCSV(operation),
              metrics.calls,
              metrics.totalBytes,
              metrics.avgBytes.toFixed(2),
              metrics.totalLatencyMs,
              metrics.avgLatencyMs.toFixed(2),
              metrics.errors,
              (metrics.errorRate * 100).toFixed(2),
            ].join(',')
          );
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics to ZIP archive (containing JSON and CSV)
   */
  async exportToZip(config: ExportConfig): Promise<Buffer> {
    // For simplicity, we'll return a JSON bundle as Buffer
    // In a real implementation, you'd use a ZIP library like 'adm-zip' or 'archiver'
    const jsonData = await this.exportToJSON(config);
    const csvData = await this.exportToCSV(config);

    // Create a simple archive representation
    const archive = {
      'metrics.json': jsonData,
      'metrics.csv': csvData,
      'README.txt': this.generateReadme(config),
    };

    return Buffer.from(JSON.stringify(archive, null, 2));
  }

  /**
   * Apply privacy filters to metrics data
   */
  applyPrivacyFilters(data: any): any {
    if (!this.privacyConfig.enabled) {
      return data;
    }

    const filtered = JSON.parse(JSON.stringify(data)); // Deep clone

    // Anonymize operation names
    if (this.privacyConfig.anonymizeOperations) {
      this.anonymizeOperations(filtered);
    }

    // Redact error messages
    if (this.privacyConfig.redactErrorMessages) {
      this.redactErrors(filtered);
    }

    // Remove timestamps
    if (!this.privacyConfig.includeTimestamps) {
      this.removeTimestamps(filtered);
    }

    return filtered;
  }

  /**
   * Gather export data based on configuration
   */
  private async gatherExportData(config: ExportConfig): Promise<any> {
    const data: any = {
      exportedAt: new Date().toISOString(),
      privacyMode: config.privacyMode,
    };

    // Include current metrics
    if (config.includeRawMetrics) {
      data.currentMetrics = this.manager.getStats();
      data.summary = {
        totalCalls: this.manager.getTotalCalls(),
        totalBytes: this.manager.getTotalBytes(),
        totalErrors: this.manager.getTotalErrors(),
        avgLatency: this.manager.getAverageLatency(),
      };
    }

    // Include snapshots
    if (config.includeSnapshots) {
      const history = await this.persistence.getHistory(
        config.dateRange ? this.calculateDaysBetween(config.dateRange.start, config.dateRange.end) : undefined
      );
      data.snapshots = history.snapshots;
    }

    // Include reports (if available via reporter)
    if (config.includeReports) {
      try {
        const reporter = this.manager.getReporter();
        data.reports = {
          daily: await reporter.generateDailySummary(),
          weekly: await reporter.generateWeeklySummary(),
          monthly: await reporter.generateMonthlySummary(),
        };
      } catch (error) {
        // Reporter might not be available
        data.reports = null;
      }
    }

    return data;
  }

  /**
   * Create export bundle from string content
   */
  private async createBundle(config: ExportConfig, content: string): Promise<MetricsExportBundle> {
    const metadata = await this.calculateMetadata(config);

    return {
      exportedAt: new Date().toISOString(),
      format: config.format,
      privacyMode: config.privacyMode,
      content,
      metadata,
    };
  }

  /**
   * Create export bundle from buffer content
   */
  private async createBundleFromBuffer(config: ExportConfig, content: Buffer): Promise<MetricsExportBundle> {
    const metadata = await this.calculateMetadata(config);

    return {
      exportedAt: new Date().toISOString(),
      format: config.format,
      privacyMode: config.privacyMode,
      content,
      metadata,
    };
  }

  /**
   * Calculate metadata for export bundle
   */
  private async calculateMetadata(config: ExportConfig): Promise<MetricsExportBundle['metadata']> {
    const history = await this.persistence.getHistory();
    const snapshots = history.snapshots;

    let dateRange = {
      start: snapshots[0]?.date || new Date().toISOString().split('T')[0],
      end: snapshots[snapshots.length - 1]?.date || new Date().toISOString().split('T')[0],
    };

    if (config.dateRange) {
      dateRange = config.dateRange;
    }

    const totalCalls = snapshots.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalErrors = snapshots.reduce((sum, s) => sum + s.totalErrors, 0);

    return {
      snapshotCount: snapshots.length,
      dateRange,
      totalCalls,
      totalErrors,
    };
  }

  /**
   * Anonymize operation names using hashing
   */
  private anonymizeOperations(data: any): void {
    if (data.currentMetrics) {
      const anonymized: any = {};
      for (const [operation, metrics] of Object.entries(data.currentMetrics)) {
        const hash = this.hashOperation(operation);
        anonymized[hash] = metrics;
      }
      data.currentMetrics = anonymized;
    }

    if (data.snapshots) {
      for (const snapshot of data.snapshots) {
        const anonymized: any = {};
        for (const [operation, metrics] of Object.entries(snapshot.metrics)) {
          const hash = this.hashOperation(operation);
          anonymized[hash] = metrics;
        }
        snapshot.metrics = anonymized;
      }
    }
  }

  /**
   * Redact error messages
   */
  private redactErrors(data: any): void {
    const redact = (metrics: any) => {
      if (metrics.lastError) {
        metrics.lastError = {
          timestamp: metrics.lastError.timestamp,
          message: '[REDACTED]',
        };
      }
    };

    if (data.currentMetrics) {
      Object.values(data.currentMetrics).forEach(redact);
    }

    if (data.snapshots) {
      for (const snapshot of data.snapshots) {
        Object.values(snapshot.metrics).forEach(redact);
      }
    }
  }

  /**
   * Remove timestamps
   */
  private removeTimestamps(data: any): void {
    delete data.exportedAt;

    const removeTimestamp = (metrics: any) => {
      delete metrics.lastCallTime;
      if (metrics.lastError) {
        delete metrics.lastError.timestamp;
      }
    };

    if (data.currentMetrics) {
      Object.values(data.currentMetrics).forEach(removeTimestamp);
    }

    if (data.snapshots) {
      for (const snapshot of data.snapshots) {
        delete snapshot.timestamp;
        Object.values(snapshot.metrics).forEach(removeTimestamp);
      }
    }
  }

  /**
   * Hash an operation name
   */
  private hashOperation(operation: string): string {
    return 'op_' + createHash('sha256').update(operation).digest('hex').substring(0, 16);
  }

  /**
   * Escape CSV values
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysBetween(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate README for export bundle
   */
  private generateReadme(config: ExportConfig): string {
    const lines = [
      'Terragrunt MCP Server - Metrics Export',
      '======================================',
      '',
      `Export Date: ${new Date().toISOString()}`,
      `Format: ${config.format}`,
      `Privacy Mode: ${config.privacyMode ? 'Enabled' : 'Disabled'}`,
      '',
      'Contents:',
      '--------',
    ];

    if (config.includeRawMetrics) {
      lines.push('- metrics.json: Raw metrics data in JSON format');
    }
    if (config.includeSnapshots) {
      lines.push('- Snapshots: Historical metrics snapshots');
    }
    if (config.includeReports) {
      lines.push('- Reports: Generated performance reports');
    }

    lines.push('');
    lines.push('- metrics.csv: Metrics data in CSV format for spreadsheet analysis');
    lines.push('');

    if (config.privacyMode) {
      lines.push('Privacy Filters Applied:');
      lines.push('-----------------------');
      if (this.privacyConfig.anonymizeOperations) {
        lines.push('- Operation names have been anonymized using SHA-256 hashing');
      }
      if (this.privacyConfig.redactErrorMessages) {
        lines.push('- Error messages have been redacted');
      }
      if (!this.privacyConfig.includeTimestamps) {
        lines.push('- Timestamps have been removed');
      }
      lines.push('');
    }

    lines.push('For more information, visit: https://github.com/omattsson/terragrunt-mcp-server');

    return lines.join('\n');
  }
}
