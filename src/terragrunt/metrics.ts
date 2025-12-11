/**
 * MetricsManager - Tracks response sizes and call frequencies
 * 
 * Provides lightweight metrics collection for token optimization efforts.
 * Logs to stderr and maintains in-memory statistics.
 */

import { MetricsSummary, MetricType } from '../types/metrics.js';

interface InternalMetricData {
  calls: number;
  totalBytes: number;
  minBytes: number;
  maxBytes: number;
  lastCallTime: Date;
}

export class MetricsManager {
  private metrics = new Map<string, InternalMetricData>();

  /**
   * Log a response and update metrics
   * @param type - 'tool' or 'resource'
   * @param name - Name of the tool or resource
   * @param response - The response object to measure
   */
  logResponse(type: MetricType, name: string, response: any): void {
    const size = JSON.stringify(response).length;
    const key = `${type}:${name}`;

    // Log to stderr (doesn't interfere with MCP protocol on stdout)
    console.error(`[METRICS] ${key} size=${size} bytes time=${new Date().toISOString()}`);

    // Update in-memory stats
    const existing = this.metrics.get(key);
    if (existing) {
      this.metrics.set(key, {
        calls: existing.calls + 1,
        totalBytes: existing.totalBytes + size,
        minBytes: Math.min(existing.minBytes, size),
        maxBytes: Math.max(existing.maxBytes, size),
        lastCallTime: new Date(),
      });
    } else {
      this.metrics.set(key, {
        calls: 1,
        totalBytes: size,
        minBytes: size,
        maxBytes: size,
        lastCallTime: new Date(),
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
        summary[key] = {
          ...data,
          avgBytes: Math.round(data.totalBytes / data.calls),
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
    const lines: string[] = ['Response Size Metrics:', ''];

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
      lines.push(`  Calls: ${data.calls}`);
      lines.push(`  Avg: ${data.avgBytes} bytes`);
      lines.push(`  Min: ${data.minBytes} bytes`);
      lines.push(`  Max: ${data.maxBytes} bytes`);
      lines.push(`  Total: ${data.totalBytes} bytes`);
      lines.push(`  Last: ${data.lastCallTime.toISOString()}`);
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
}
