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

export type MetricType = 'tool' | 'resource';
