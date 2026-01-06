# Metrics Collection Guide

## Overview

The Terragrunt MCP Server includes a comprehensive metrics collection system that tracks performance, usage, and errors. This system provides insights into server operations through real-time monitoring, historical analysis, and customizable reporting.

## Features

### Core Metrics (Phase 1)

The metrics system tracks the following for each operation:

- **Call Statistics**: Number of calls, frequency patterns
- **Response Sizes**: Total, minimum, maximum, and average bytes
- **Latency Tracking**: Execution time in milliseconds (min, max, avg)
- **Error Monitoring**: Error count, error rate percentage, last error details
- **Cache Performance**: Hit/miss ratios, cache age, refresh timing

### Persistence (Phase 2)

Metrics are automatically persisted to disk for long-term analysis:

- **Automatic Snapshots**: Daily snapshots saved to `.mcp-metrics/snapshots/`
- **Configuration**: Stored in `.mcp-metrics/config.json`
- **Data Retention**: Configurable retention period (default: 90 days)
- **Cleanup**: Automatic cleanup of old snapshots

### Reporting (Phase 3)

Generate comprehensive performance reports in multiple formats:

- **Formats**: Text, JSON, Markdown
- **Periods**: Daily, Weekly, Monthly, All-time
- **Trend Analysis**: Compare snapshots to identify improving/degrading performance
- **Top Operations**: Rank operations by calls, latency, or errors

### Privacy & Export (Phase 4)

Control data privacy and export metrics for external analysis:

- **Privacy Controls**:
  - Anonymize operation names (SHA-256 hashing)
  - Redact error messages
  - Remove timestamps
  - Configurable data retention

- **Export Formats**: JSON, CSV, ZIP
- **Export Options**: Choose what to include (snapshots, reports, raw metrics)
- **Date Range Filtering**: Export specific time periods

## Usage

### Basic Metrics Access

The metrics system automatically tracks all tool and resource operations. Access metrics via the `get_server_metrics` tool:

```typescript
// Get all metrics
const metrics = await toolHandler.executeTool('get_server_metrics', {});

// Get metrics in text format
const textMetrics = await toolHandler.executeTool('get_server_metrics', {
  format: 'text'
});

// Filter by operation name
const filtered = await toolHandler.executeTool('get_server_metrics', {
  filter: 'search_docs'
});
```

### Programmatic Access

```typescript
import { MetricsManager } from './src/terragrunt/metrics.js';
import { MetricsPersistence } from './src/terragrunt/metrics-persistence.js';

// Create metrics manager
const persistence = new MetricsPersistence('./.mcp-metrics');
const manager = new MetricsManager(persistence);

// Log a response
manager.logResponse('tool', 'search_docs', { results: [] }, 150); // 150ms latency

// Log an error
manager.logError('tool', 'failing_operation', new Error('Something went wrong'));

// Get statistics
const stats = manager.getStats();
console.log(`Total calls: ${manager.getTotalCalls()}`);
console.log(`Total errors: ${manager.getTotalErrors()}`);
console.log(`Average latency: ${manager.getAverageLatency()}ms`);

// Get formatted summary
const summary = manager.getSummaryText();
console.log(summary);
```

### Creating Snapshots

```typescript
// Create a snapshot manually
await manager.createSnapshot();

// Load a specific snapshot
const snapshot = await persistence.loadSnapshot('2026-01-06');

// Get historical data
const history = await persistence.getHistory(30); // Last 30 days
console.log(`${history.totalSnapshots} snapshots from ${history.firstSnapshot} to ${history.lastSnapshot}`);
```

### Generating Reports

```typescript
// Get reporter
const reporter = manager.getReporter();

// Generate daily summary (text format)
const dailyReport = await reporter.generateDailySummary();
console.log(dailyReport.content);

// Generate custom report
const report = await reporter.generateReport({
  format: 'markdown',
  period: 'weekly',
  includeHistory: true,
  includeTrends: true,
  topOperations: 10
});

console.log(report.content);

// Compare two snapshots
const trends = await reporter.compareSnapshots('2026-01-01', '2026-01-06');
trends.forEach(trend => {
  console.log(`${trend.operation}: ${trend.trend}`);
  console.log(`  Calls: ${trend.callsChange}%`);
  console.log(`  Latency: ${trend.latencyChange}%`);
});

// Get top operations
const topOps = await reporter.getTopOperations(5, 'latency');
topOps.forEach(op => {
  console.log(`${op.operation}: ${op.avgLatency}ms avg, ${op.calls} calls`);
});
```

### Privacy Controls

```typescript
// Get exporter
const exporter = manager.getExporter();

// Configure privacy settings
manager.updatePrivacyConfig({
  enabled: true,
  anonymizeOperations: true,  // Hash operation names
  redactErrorMessages: true,  // Remove error details
  includeTimestamps: false,   // Remove precise timestamps
  dataRetentionDays: 30       // Auto-delete data older than 30 days
});

// Get current privacy config
const privacyConfig = manager.getPrivacyConfig();
console.log(privacyConfig);
```

### Exporting Metrics

```typescript
// Quick JSON export with privacy
const jsonData = await manager.exportToJSON(true); // true = privacy mode
await fs.writeFile('metrics-export.json', jsonData);

// Quick CSV export
const csvData = await manager.exportToCSV(false); // false = no privacy
await fs.writeFile('metrics-export.csv', csvData);

// Full export with configuration
const bundle = await manager.exportMetrics({
  format: 'zip',
  includeSnapshots: true,
  includeReports: true,
  includeRawMetrics: true,
  privacyMode: true,
  dateRange: {
    start: '2026-01-01',
    end: '2026-01-06'
  }
});

// bundle.content contains the ZIP archive (as Buffer)
await fs.writeFile('metrics-bundle.zip', bundle.content);

// Check metadata
console.log(`Exported ${bundle.metadata.snapshotCount} snapshots`);
console.log(`Date range: ${bundle.metadata.dateRange.start} to ${bundle.metadata.dateRange.end}`);
console.log(`Total calls: ${bundle.metadata.totalCalls}`);
console.log(`Total errors: ${bundle.metadata.totalErrors}`);
```

## Report Formats

### Text Format

```
======================================================================
                          Daily Metrics Report                          
======================================================================
Generated: 2026-01-06T16:00:00.000Z
Period: daily (1 day)

SUMMARY
-------
Total Calls:        1,234
Total Errors:       5
Average Latency:    125.50 ms
Total Data:         1.23 MB
Operations:         15

TOP OPERATIONS (by calls)
-------------------------
1. tool:search_docs - 450 calls, 120.5ms avg, 0.2% errors
2. tool:get_function - 320 calls, 85.3ms avg, 0.0% errors
3. resource:docs:overview - 180 calls, 45.2ms avg, 0.0% errors
...
```

### JSON Format

```json
{
  "title": "Daily Metrics Report",
  "generatedAt": "2026-01-06T16:00:00.000Z",
  "period": "daily",
  "format": "json",
  "summary": {
    "totalCalls": 1234,
    "totalErrors": 5,
    "avgLatency": 125.5,
    "totalBytes": 1289748,
    "operationCount": 15
  },
  "topOperations": [
    {
      "operation": "tool:search_docs",
      "calls": 450,
      "avgLatency": 120.5,
      "errorRate": 0.002
    }
  ],
  "trends": [
    {
      "operation": "tool:search_docs",
      "callsChange": 15.5,
      "latencyChange": -10.2,
      "errorRateChange": 0,
      "trend": "improving"
    }
  ]
}
```

### Markdown Format

```markdown
# Daily Metrics Report

**Generated:** 2026-01-06T16:00:00.000Z  
**Period:** daily (1 day)

## Summary

| Metric | Value |
|--------|-------|
| Total Calls | 1,234 |
| Total Errors | 5 |
| Average Latency | 125.50 ms |
| Total Data | 1.23 MB |
| Operations | 15 |

## Top Operations

| Operation | Calls | Avg Latency | Error Rate |
|-----------|-------|-------------|------------|
| tool:search_docs | 450 | 120.5ms | 0.2% |
| tool:get_function | 320 | 85.3ms | 0.0% |
...
```

## Configuration

### Persistence Configuration

Located in `.mcp-metrics/config.json`:

```json
{
  "enabled": true,
  "directory": ".mcp-metrics",
  "retentionDays": 90,
  "autoSnapshot": true
}
```

**Options:**
- `enabled`: Enable/disable metrics persistence
- `directory`: Where to store metrics data
- `retentionDays`: How long to keep snapshots (default: 90)
- `autoSnapshot`: Automatically create daily snapshots

### Privacy Configuration

```typescript
{
  enabled: false,           // Master switch for privacy features
  anonymizeOperations: false, // Hash operation names
  redactErrorMessages: false, // Remove error details
  includeTimestamps: true,    // Include exact timestamps
  dataRetentionDays: 365      // Data retention period
}
```

## Directory Structure

```
.mcp-metrics/
├── config.json              # Persistence configuration
├── summary.json             # Current metrics summary
└── snapshots/
    ├── 2026-01-01.json     # Daily snapshot
    ├── 2026-01-02.json
    └── 2026-01-06.json
```

## Best Practices

### Performance Monitoring

1. **Regular Snapshots**: Create daily snapshots for trend analysis
2. **Monitor Trends**: Use weekly/monthly reports to identify patterns
3. **Set Alerts**: Track error rates and latency degradation
4. **Clean Data**: Configure appropriate retention periods

### Privacy Considerations

1. **Enable Privacy Mode**: When sharing metrics externally
2. **Anonymize Operations**: If operation names contain sensitive info
3. **Redact Errors**: Remove potentially sensitive error messages
4. **Limit Retention**: Set reasonable data retention periods

### Export Strategies

1. **Regular Exports**: Create periodic backups of metrics data
2. **Format Selection**:
   - JSON for programmatic analysis
   - CSV for spreadsheet analysis
   - ZIP for comprehensive archives
3. **Date Ranges**: Export specific periods for targeted analysis
4. **Metadata**: Always check export metadata for completeness

## Troubleshooting

### No Metrics Appearing

- Ensure metrics are being logged (check `logResponse` and `logError` calls)
- Verify MetricsManager is initialized with persistence
- Check that operations are completing (not hanging)

### Snapshots Not Saving

- Verify directory permissions for `.mcp-metrics/`
- Check `autoSnapshot` is enabled in config
- Ensure `createSnapshot()` is being called

### Export Fails

- Check available disk space
- Verify privacy config is valid
- Ensure date ranges are valid
- Check that snapshots exist for the requested period

### Performance Impact

The metrics system is designed for minimal overhead:
- Async operations don't block main execution
- Disk writes are batched
- In-memory cache for fast access
- Configurable retention to limit disk usage

Typical overhead: <1ms per operation logged

## API Reference

See the comprehensive interfaces in [`src/types/metrics.ts`](../src/types/metrics.ts):

- `IMetricsManager` - Core metrics management
- `IMetricsPersistence` - Persistence operations
- `IMetricsReporter` - Report generation
- `IMetricsExporter` - Data export

## Examples

See the test files for extensive usage examples:

- [`test/unit/metrics-manager.test.ts`](../test/unit/metrics-manager.test.ts) - Core metrics
- [`test/unit/metrics-persistence.test.ts`](../test/unit/metrics-persistence.test.ts) - Persistence
- [`test/unit/metrics-reporter.test.ts`](../test/unit/metrics-reporter.test.ts) - Reporting
- [`test/unit/metrics-exporter.test.ts`](../test/unit/metrics-exporter.test.ts) - Export & privacy
