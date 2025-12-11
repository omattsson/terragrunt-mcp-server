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
}

export interface MetricsSummary {
  [key: string]: MetricData;
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
}

export interface IMetricsManager {
  logResponse(type: MetricType, operation: string, responseSize: number): void;
  getStats(filter?: string): MetricsSummary;
  getTotalCalls(): number;
  getTotalBytes(): number;
  getSummaryText(): string;
  reset(): void;
}

export type MetricType = 'tool' | 'resource';
