# Performance Testing Documentation

## Overview

This document describes the comprehensive performance test suite for the Terragrunt MCP Server. The performance tests benchmark critical operations to ensure the server maintains acceptable response times and resource usage.

## Test Statistics

- **Total Performance Tests**: 24
- **Test Categories**: 7
- **Test Duration**: ~280ms (with warm cache)
- **Status**: ✅ All passing

## Test Categories

### 1. Large Result Set Handling (3 tests)

Tests the server's ability to efficiently handle large datasets:

- **Load all docs**: Verifies loading 84 documentation pages
  - Expected: <100ms
  - Actual: ~0.01ms (with warm cache)
  
- **List all resources**: Tests resource listing without timeout
  - Expected: <5 seconds
  - Actual: ~10ms
  - Resources: 58 total
  
- **Section content**: Retrieves docs from specific sections
  - Expected: <500ms
  - Actual: ~0.05ms
  - Example: "getting-started" section (4 docs)

**Key Metrics**:
- Dataset size: 84 documentation pages
- Resource count: 58 resources
- Section retrieval: <0.1ms

### 2. Search Performance (4 tests)

Benchmarks search functionality with varying query complexity:

- **Short query** (`"dependencies"`):
  - Results: 32 matches
  - Time: ~3ms
  
- **Medium query** (`"manage dependencies"`):
  - Results: 3 matches
  - Time: ~3ms
  
- **Long query** (36 characters):
  - Results: varies by query
  - Time: ~6ms
  
- **Result limits** (5, 10, 20, 50):
  - Time: 2-4ms regardless of limit
  - Demonstrates efficient slicing

**Key Metrics**:
- Average search time: 2-6ms
- Search scales well with query length
- Limit parameter has minimal performance impact

### 3. Memory Usage During Cache Load (2 tests)

Monitors memory consumption and cache efficiency:

- **Heap growth tracking**:
  - Initial heap: ~34MB
  - After load: ~41MB
  - Growth: ~7MB for 84 docs
  - Expected: <50MB growth
  
- **Cache speedup validation**:
  - First access (cold): varies
  - Second access (warm): <0.01ms
  - Speedup: 7-10x improvement
  - Expected: At least 2x speedup

**Key Metrics**:
- Memory footprint: 7MB for full dataset
- Cache speedup: 7-10x faster on warm cache
- Efficient in-memory caching

### 4. Response Time Benchmarks for Each Tool (7 tests)

Individual tool performance benchmarks:

| Tool | Expected | Actual | Notes |
|------|----------|--------|-------|
| `search_terragrunt_docs` | <1s | ~13ms | Most complex tool |
| `get_terragrunt_sections` | <500ms | ~7ms | Section enumeration |
| `get_section_docs` | <1s | ~0.1ms | Section filtering |
| `get_cli_command_help` | <1s | ~0.2ms | Command lookup |
| `get_hcl_config_reference` | <1s | ~0.6ms | Config search |
| `get_code_examples` | <1.5s | ~5ms | Code extraction |
| **Sequential execution** | <200ms | ~9ms | All tools in order |

**Key Metrics**:
- All tools execute in <15ms
- Sequential execution: 9ms for 6 tools
- Average per-tool time: ~4ms

### 5. Concurrent Request Handling (4 tests)

Tests concurrent operation performance:

- **5 concurrent searches**:
  - Time: ~16ms
  - Per-search average: ~3ms
  
- **10 concurrent tool executions**:
  - Time: ~15ms
  - Per-tool average: ~1.5ms
  
- **20 concurrent doc fetches**:
  - Time: ~0.05ms
  - Per-fetch average: <0.01ms
  
- **15 mixed operations** (searches + tools + fetches):
  - Time: ~13ms
  - Per-operation average: ~0.9ms

**Key Metrics**:
- Excellent concurrent performance
- Minimal overhead from parallelization
- No resource contention observed

### 6. Cache Performance (2 tests)

Validates caching mechanisms:

- **Disk cache speedup**:
  - Fresh instance load: ~7ms
  - Cache file: `.cache/terragrunt-docs/docs-cache.json`
  - Size: ~1.1MB JSON file
  
- **Repeated lookups**:
  - 100 section lookups: ~3ms
  - Average per-lookup: ~0.03ms
  - Demonstrates in-memory cache efficiency

**Key Metrics**:
- Disk cache load: ~7ms
- In-memory cache: ~0.03ms per lookup
- 233x speedup (disk → memory)

### 7. Stress Tests (2 tests)

Tests system under heavy load:

- **Large result limits**:
  - Request limit: 1000
  - Actual results: 82 (all available)
  - Time: ~2ms
  - Demonstrates graceful handling
  
- **Rapid-fire sequential searches**:
  - 50 consecutive searches
  - Total time: ~122ms
  - Average: ~2.4ms per search
  - Demonstrates consistent performance

**Key Metrics**:
- No performance degradation under load
- Consistent sub-3ms search times
- Efficient handling of maximum result sets

## Performance Summary

### Overall Metrics

- **Total test execution time**: ~280ms
- **Memory usage**: 33.7MB heap (62.9MB total)
- **RSS**: 99.8MB
- **Average tool response**: <5ms
- **Average search time**: 2-4ms
- **Cache effectiveness**: 7-10x speedup

### Performance Targets

All performance targets are met or exceeded:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Doc loading | <100ms | ~10ms | ✅ 10x better |
| Resource listing | <5s | ~10ms | ✅ 500x better |
| Search queries | <100ms | ~3ms | ✅ 33x better |
| Tool execution | <1s | <15ms | ✅ 66x better |
| Concurrent ops | <5s | <20ms | ✅ 250x better |
| Memory growth | <50MB | ~7MB | ✅ 7x better |

### Scalability Observations

1. **Linear scaling**: Search performance scales linearly with query length
2. **Constant time lookups**: Section/doc fetches are O(1) with in-memory cache
3. **Efficient parallelization**: Concurrent operations show minimal overhead
4. **Memory efficiency**: 7MB for 84 docs (~83KB per doc in memory)
5. **Cache effectiveness**: 10x speedup for warm cache vs cold

## Test Implementation

### Technology Stack

- **Framework**: Vitest v4.0.3
- **Runtime**: Node.js with ES Modules
- **Precision**: `performance.now()` (microsecond accuracy)
- **Timeout**: 120 seconds for initial cache load
- **Test timeout**: 60 seconds per test

### File Structure

```
test/performance/
└── performance.test.ts   (502 lines, 24 tests)
```

### Key Features

1. **BeforeAll setup**: Loads fixture data once for all tests
2. **Memory profiling**: Tracks heap usage with `process.memoryUsage()`
3. **Timing precision**: Uses `performance.now()` for sub-millisecond accuracy
4. **Detailed logging**: Console output shows actual timings for verification
5. **Realistic scenarios**: Tests use actual documentation queries

## Running Performance Tests

### Run All Performance Tests
```bash
npm test -- test/performance/performance.test.ts
```

### Run Specific Category
```bash
# Example: Run only search performance tests
npm test -- test/performance/performance.test.ts -t "Search Performance"
```

### Watch Mode
```bash
npm test -- test/performance/performance.test.ts --watch
```

## Interpreting Results

### Console Output

Each test outputs detailed timing information:

```
✓ Search "dependencies" found 32 results (returned 10) in 3.52ms
✓ Listed 58 resources in 11.69ms
✓ 10 concurrent tool executions in 15.14ms
  Average: 1.51ms per tool
```

### Performance Regression Detection

If tests fail, check:

1. **Timing failures**: Compare actual vs expected times
2. **Memory failures**: Check heap growth exceeds 50MB
3. **Result failures**: Verify correct number of results returned
4. **Concurrent failures**: Look for resource contention

### Baseline Metrics

Use these as baseline for regression detection:

- Single search: ~3ms
- Tool execution: ~5ms
- Concurrent 10 ops: ~15ms
- Memory per doc: ~83KB
- Cache load: ~10ms

## Future Enhancements

Potential additions to the performance test suite:

1. **Percentile metrics**: Add p50, p95, p99 measurements
2. **Long-running tests**: Test cache behavior over extended periods
3. **Network simulation**: Test performance with simulated network delays
4. **Memory profiling**: Add detailed heap snapshot analysis
5. **Load testing**: Test with thousands of concurrent requests
6. **Cache eviction**: Test behavior when cache grows very large

## Related Documentation

- [Development Guide](Development-Guide.md)
- [Caching System](Caching-System.md)
- [Available Tools](Available-Tools.md)
- [Architecture Overview](Architecture-Overview.md)

## Last Updated

Generated: January 2025
Test Suite Version: 1.0.0
Documentation Version: 0.2.0
