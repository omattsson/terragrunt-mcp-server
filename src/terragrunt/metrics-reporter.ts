/**
 * Generates comprehensive metrics reports in various formats
 */

import {
  IMetricsReporter,
  MetricsReport,
  ReportConfig,
  ReportPeriod,
  TrendData,
} from '../types/metrics.js';
import { MetricsPersistence } from './metrics-persistence.js';
import { MetricsManager } from './metrics.js';

export class MetricsReporter implements IMetricsReporter {
  private persistence: MetricsPersistence;
  private metricsManager: MetricsManager;

  constructor(metricsManager: MetricsManager, persistence?: MetricsPersistence) {
    this.metricsManager = metricsManager;
    this.persistence = persistence || metricsManager.getPersistence();
  }

  /**
   * Generate a comprehensive report with specified configuration
   */
  async generateReport(config: Partial<ReportConfig> = {}): Promise<MetricsReport> {
    const defaultConfig: ReportConfig = {
      format: 'text',
      period: 'daily',
      includeHistory: true,
      includeTrends: true,
      topOperations: 10,
    };

    const finalConfig = { ...defaultConfig, ...config };
    const now = new Date();

    // Get snapshots based on period
    const days = this.getPeriodDays(finalConfig.period);
    const history = await this.persistence.getHistory(days);
    const currentStats = this.metricsManager.getStats();

    // Calculate summary
    const summary = {
      totalCalls: this.metricsManager.getTotalCalls(),
      totalErrors: this.metricsManager.getTotalErrors(),
      avgLatency: this.metricsManager.getAverageLatency(),
      totalBytes: this.metricsManager.getTotalBytes(),
      operationCount: Object.keys(currentStats).length,
      dateRange: history.snapshots.length > 0
        ? {
            start: history.firstSnapshot,
            end: history.lastSnapshot,
          }
        : undefined,
    };

    // Get top operations
    const topOperations = await this.getTopOperations(finalConfig.topOperations, 'calls');

    // Calculate trends if requested
    let trends: TrendData[] | undefined;
    if (finalConfig.includeTrends && history.snapshots.length >= 2) {
      trends = await this.compareSnapshots(
        history.snapshots[history.snapshots.length - 1].date,
        history.snapshots[0].date
      );
    }

    // Generate content based on format
    let content: string;
    switch (finalConfig.format) {
      case 'json':
        content = this.generateJsonReport(summary, topOperations, trends, history);
        break;
      case 'markdown':
        content = this.generateMarkdownReport(
          finalConfig.period,
          summary,
          topOperations,
          trends,
          history
        );
        break;
      case 'text':
      default:
        content = this.generateTextReport(
          finalConfig.period,
          summary,
          topOperations,
          trends,
          history
        );
        break;
    }

    return {
      title: `${this.capitalizeFirst(finalConfig.period)} Metrics Report`,
      generatedAt: now.toISOString(),
      period: finalConfig.period,
      format: finalConfig.format,
      content,
      summary,
      trends,
      topOperations,
    };
  }

  /**
   * Generate a daily summary report
   */
  async generateDailySummary(): Promise<MetricsReport> {
    return this.generateReport({
      format: 'text',
      period: 'daily',
      includeHistory: true,
      includeTrends: false,
      topOperations: 5,
    });
  }

  /**
   * Generate a weekly summary report
   */
  async generateWeeklySummary(): Promise<MetricsReport> {
    return this.generateReport({
      format: 'text',
      period: 'weekly',
      includeHistory: true,
      includeTrends: true,
      topOperations: 10,
    });
  }

  /**
   * Generate a monthly summary report
   */
  async generateMonthlySummary(): Promise<MetricsReport> {
    return this.generateReport({
      format: 'text',
      period: 'monthly',
      includeHistory: true,
      includeTrends: true,
      topOperations: 15,
    });
  }

  /**
   * Compare two snapshots and calculate trends
   */
  async compareSnapshots(date1: string, date2: string): Promise<TrendData[]> {
    const snapshot1 = await this.persistence.loadSnapshot(date1);
    const snapshot2 = await this.persistence.loadSnapshot(date2);

    if (!snapshot1 || !snapshot2) {
      return [];
    }

    const trends: TrendData[] = [];
    const allOperations = new Set([
      ...Object.keys(snapshot1.metrics),
      ...Object.keys(snapshot2.metrics),
    ]);

    for (const operation of allOperations) {
      const metric1 = snapshot1.metrics[operation];
      const metric2 = snapshot2.metrics[operation];

      if (!metric1 || !metric2) continue;

      const callsChange = this.calculatePercentageChange(metric1.calls, metric2.calls);
      const latencyChange = this.calculatePercentageChange(
        metric1.avgLatencyMs,
        metric2.avgLatencyMs
      );
      const errorRateChange = this.calculatePercentageChange(
        metric1.errorRate,
        metric2.errorRate
      );

      // Determine overall trend
      let trend: 'improving' | 'degrading' | 'stable';
      if (latencyChange < -10 && errorRateChange <= 0) {
        trend = 'improving';
      } else if (latencyChange > 10 || errorRateChange > 10) {
        trend = 'degrading';
      } else {
        trend = 'stable';
      }

      trends.push({
        operation,
        callsChange,
        latencyChange,
        errorRateChange,
        trend,
      });
    }

    // Sort by most significant change
    return trends.sort((a, b) => {
      const aScore = Math.abs(a.latencyChange) + Math.abs(a.errorRateChange) * 2;
      const bScore = Math.abs(b.latencyChange) + Math.abs(b.errorRateChange) * 2;
      return bScore - aScore;
    });
  }

  /**
   * Get top operations sorted by specified metric
   */
  async getTopOperations(
    limit: number,
    sortBy: 'calls' | 'latency' | 'errors' = 'calls'
  ): Promise<
    Array<{
      operation: string;
      calls: number;
      avgLatency: number;
      errorRate: number;
    }>
  > {
    const stats = this.metricsManager.getStats();
    const operations = Object.entries(stats).map(([operation, data]) => ({
      operation,
      calls: data.calls,
      avgLatency: data.avgLatencyMs,
      errorRate: data.errorRate,
    }));

    // Sort based on criteria
    operations.sort((a, b) => {
      switch (sortBy) {
        case 'latency':
          return b.avgLatency - a.avgLatency;
        case 'errors':
          return b.errorRate - a.errorRate;
        case 'calls':
        default:
          return b.calls - a.calls;
      }
    });

    return operations.slice(0, limit);
  }

  /**
   * Generate text format report
   */
  private generateTextReport(
    period: ReportPeriod,
    summary: any,
    topOperations: any[],
    trends?: TrendData[],
    _history?: any
  ): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push(`${this.capitalizeFirst(period)} Metrics Report`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('='.repeat(70));
    lines.push('');

    // Summary section
    lines.push('SUMMARY');
    lines.push('-'.repeat(70));
    lines.push(`Total Operations: ${summary.operationCount}`);
    lines.push(`Total Calls: ${summary.totalCalls.toLocaleString()}`);
    lines.push(`Total Errors: ${summary.totalErrors.toLocaleString()}`);
    lines.push(`Average Latency: ${summary.avgLatency}ms`);
    lines.push(`Total Bytes Transferred: ${this.formatBytes(summary.totalBytes)}`);
    if (summary.dateRange) {
      lines.push(`Date Range: ${summary.dateRange.start} to ${summary.dateRange.end}`);
    }
    lines.push('');

    // Top operations
    if (topOperations.length > 0) {
      lines.push('TOP OPERATIONS');
      lines.push('-'.repeat(70));
      for (let i = 0; i < topOperations.length; i++) {
        const op = topOperations[i];
        lines.push(
          `${i + 1}. ${op.operation} - ${op.calls} calls, ${op.avgLatency}ms avg, ` +
            `${(op.errorRate * 100).toFixed(1)}% errors`
        );
      }
      lines.push('');
    }

    // Trends section
    if (trends && trends.length > 0) {
      lines.push('TRENDS & CHANGES');
      lines.push('-'.repeat(70));
      for (const trend of trends.slice(0, 10)) {
        const arrow =
          trend.trend === 'improving' ? '↑' : trend.trend === 'degrading' ? '↓' : '→';
        lines.push(`${arrow} ${trend.operation}`);
        lines.push(`   Calls: ${this.formatChange(trend.callsChange)}`);
        lines.push(`   Latency: ${this.formatChange(trend.latencyChange)}`);
        lines.push(`   Error Rate: ${this.formatChange(trend.errorRateChange)}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(70));
    return lines.join('\n');
  }

  /**
   * Generate markdown format report
   */
  private generateMarkdownReport(
    period: ReportPeriod,
    summary: any,
    topOperations: any[],
    trends?: TrendData[],
    _history?: any
  ): string {
    const lines: string[] = [];

    lines.push(`# ${this.capitalizeFirst(period)} Metrics Report`);
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    // Summary section
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Operations | ${summary.operationCount} |`);
    lines.push(`| Total Calls | ${summary.totalCalls.toLocaleString()} |`);
    lines.push(`| Total Errors | ${summary.totalErrors.toLocaleString()} |`);
    lines.push(`| Average Latency | ${summary.avgLatency}ms |`);
    lines.push(`| Total Bytes | ${this.formatBytes(summary.totalBytes)} |`);
    if (summary.dateRange) {
      lines.push(
        `| Date Range | ${summary.dateRange.start} to ${summary.dateRange.end} |`
      );
    }
    lines.push('');

    // Top operations
    if (topOperations.length > 0) {
      lines.push('## Top Operations');
      lines.push('');
      lines.push('| Rank | Operation | Calls | Avg Latency | Error Rate |');
      lines.push('|------|-----------|-------|-------------|------------|');
      for (let i = 0; i < topOperations.length; i++) {
        const op = topOperations[i];
        lines.push(
          `| ${i + 1} | ${op.operation} | ${op.calls} | ${op.avgLatency}ms | ` +
            `${(op.errorRate * 100).toFixed(1)}% |`
        );
      }
      lines.push('');
    }

    // Trends section
    if (trends && trends.length > 0) {
      lines.push('## Trends & Changes');
      lines.push('');
      lines.push('| Operation | Trend | Calls Change | Latency Change | Error Rate Change |');
      lines.push('|-----------|-------|--------------|----------------|-------------------|');
      for (const trend of trends.slice(0, 10)) {
        const emoji =
          trend.trend === 'improving' ? '✅' : trend.trend === 'degrading' ? '❌' : '➡️';
        lines.push(
          `| ${trend.operation} | ${emoji} | ${this.formatChange(trend.callsChange)} | ` +
            `${this.formatChange(trend.latencyChange)} | ${this.formatChange(trend.errorRateChange)} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON format report
   */
  private generateJsonReport(
    summary: any,
    topOperations: any[],
    trends?: TrendData[],
    history?: any
  ): string {
    const report = {
      summary,
      topOperations,
      trends: trends || [],
      history: history
        ? {
            totalSnapshots: history.totalSnapshots,
            firstSnapshot: history.firstSnapshot,
            lastSnapshot: history.lastSnapshot,
            snapshots: history.snapshots.slice(0, 30), // Limit to last 30 for JSON size
          }
        : undefined,
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Calculate percentage change between two values
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return Math.round(((newValue - oldValue) / oldValue) * 100);
  }

  /**
   * Format percentage change with + or - sign
   */
  private formatChange(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}%`;
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Get number of days for a period
   */
  private getPeriodDays(period: ReportPeriod): number {
    switch (period) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'monthly':
        return 30;
      case 'all':
        return 365;
      default:
        return 1;
    }
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
