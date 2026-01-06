/**
 * MetricsManager - Tracks response sizes, call frequencies, latency, and errors
 * 
 * Provides comprehensive metrics collection for performance monitoring and optimization.
 * Logs to stderr and maintains in-memory statistics.
 */

import { MetricsSummary, MetricType, IMetricsManager } from '../types/metrics.js';

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
