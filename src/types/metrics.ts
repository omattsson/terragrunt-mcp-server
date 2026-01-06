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

/**
 * Configuration for metrics persistence
 */
export interface MetricsPersistenceConfig {
  enabled: boolean;
  directory: string;
  retentionDays: number;
  autoSnapshot: boolean;
}

/**
 * Snapshot of metrics at a point in time
 */
export interface MetricsSnapshot {
  timestamp: string;
  date: string; // YYYY-MM-DD format
  metrics: MetricsSummary;
  totalCalls: number;
  totalBytes: number;
  totalErrors: number;
  avgLatencyMs: number;
  cacheMetrics?: CacheMetrics;
}

/**
 * Historical metrics summary
 */
export interface MetricsHistory {
  snapshots: MetricsSnapshot[];
  firstSnapshot: string;
  lastSnapshot: string;
  totalSnapshots: number;
}

/**
 * Interface for metrics persistence operations
 */
export interface IMetricsPersistence {
  saveSnapshot(snapshot: MetricsSnapshot): Promise<void>;
  loadSnapshot(date: string): Promise<MetricsSnapshot | null>;
  getHistory(days?: number): Promise<MetricsHistory>;
  cleanup(retentionDays: number): Promise<number>;
  saveSummary(summary: MetricsSummary): Promise<void>;
  loadSummary(): Promise<MetricsSummary | null>;
  getConfig(): Promise<MetricsPersistenceConfig>;
  updateConfig(config: Partial<MetricsPersistenceConfig>): Promise<void>;
}

/**
 * Report output format
 */
export type ReportFormat = 'text' | 'json' | 'markdown';

/**
 * Report time period
 */
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

/**
 * Report configuration
 */
export interface ReportConfig {
  format: ReportFormat;
  period: ReportPeriod;
  includeHistory: boolean;
  includeTrends: boolean;
  topOperations: number; // Number of top operations to include
}

/**
 * Trend analysis data
 */
export interface TrendData {
  operation: string;
  callsChange: number; // Percentage change
  latencyChange: number; // Percentage change
  errorRateChange: number; // Percentage change
  trend: 'improving' | 'degrading' | 'stable';
}

/**
 * Generated report
 */
export interface MetricsReport {
  title: string;
  generatedAt: string;
  period: ReportPeriod;
  format: ReportFormat;
  content: string;
  summary: {
    totalCalls: number;
    totalErrors: number;
    avgLatency: number;
    totalBytes: number;
    operationCount: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  trends?: TrendData[];
  topOperations?: Array<{
    operation: string;
    calls: number;
    avgLatency: number;
    errorRate: number;
  }>;
}

/**
 * Interface for metrics reporting operations
 */
export interface IMetricsReporter {
  generateReport(config: Partial<ReportConfig>): Promise<MetricsReport>;
  generateDailySummary(): Promise<MetricsReport>;
  generateWeeklySummary(): Promise<MetricsReport>;
  generateMonthlySummary(): Promise<MetricsReport>;
  compareSnapshots(date1: string, date2: string): Promise<TrendData[]>;
  getTopOperations(limit: number, sortBy: 'calls' | 'latency' | 'errors'): Promise<Array<{
    operation: string;
    calls: number;
    avgLatency: number;
    errorRate: number;
  }>>;
}
