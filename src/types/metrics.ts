/**
 * Types for response size metrics and logging
 */

export interface MetricData {
  calls: number;
  totalBytes: number;
  minBytes: number;
  maxBytes: number;
  avgBytes: number;
  lastCallTime: Date;
  // Performance metrics
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  // Error tracking
  errors: number;
  errorRate: number;
  lastError?: {
    timestamp: Date;
    message: string;
  };
}

export interface MetricsSummary {
  [key: string]: MetricData;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  lastRefresh?: Date;
  cacheAge?: number; // minutes since last refresh
}

export interface MetricsResponse {
  format: 'json' | 'text';
  summary?: string;
  metrics?: MetricsSummary;
  totalCalls?: number;
  totalBytes?: number;
  operationCount?: number;
  filter?: string;
  timestamp?: string;
  reset?: boolean;
  // New fields for enhanced metrics
  cacheMetrics?: CacheMetrics;
  totalErrors?: number;
  avgLatencyMs?: number;
}

export interface IMetricsManager {
  logResponse(type: MetricType, operation: string, response: any, latencyMs?: number): void;
  logError(type: MetricType, operation: string, error: Error): void;
  getStats(filter?: string): MetricsSummary;
  getTotalCalls(): number;
  getTotalBytes(): number;
  getTotalErrors(): number;
  getAverageLatency(): number;
  getSummaryText(): string;
  reset(): void;
}

export type MetricType = 'tool' | 'resource';
