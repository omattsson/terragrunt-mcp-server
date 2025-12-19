# Lazy Loading Documentation

## Overview

The Terragrunt MCP Server implements a **lazy loading system** for documentation content to optimize memory usage and startup performance. Instead of loading all documentation content immediately at startup, the system:

1. **Loads metadata first** (lightweight: title, URL, section, date)
2. **Loads content on-demand** when documents are accessed
3. **Caches loaded content** to avoid redundant network requests
4. **Implements warmup strategies** to preload commonly used documents

This approach reduces initial memory footprint by ~60-80% while maintaining fast search and retrieval performance.

## Architecture

### Metadata-First Loading

The system loads **DocMetadata** objects at startup:

```typescript
interface DocMetadata {
  title: string;
  url: string;
  section: string;
  lastUpdated?: string;
}
```

Full document content (`TerragruntDoc` with `content` field) is loaded lazily when needed.

### Content Caching

Three cache structures manage lazy loading:

- **`contentCache: Map<string, string>`** - Stores loaded document content
- **`loadingPromises: Map<string, Promise<string>>`** - Deduplicates concurrent load requests
- **`loadedDocs: Set<string>`** - Tracks which documents have been loaded

### Promise Deduplication

When multiple operations request the same document simultaneously:

1. First request creates a loading promise
2. Subsequent requests wait for the same promise
3. After loading, all requesters receive the cached content

This prevents duplicate network requests and race conditions.

## Configuration

### Environment Variables

#### `TERRAGRUNT_LAZY_LOADING`

**Controls lazy loading mode:**

```bash
# Enable lazy loading (default)
export TERRAGRUNT_LAZY_LOADING=true

# Disable lazy loading (load all docs immediately)
export TERRAGRUNT_LAZY_LOADING=false
```

**When to disable:**
- Testing environments where full content is always needed
- CI/CD pipelines with sufficient memory
- Workflows requiring immediate access to all documentation

#### `TERRAGRUNT_WARMUP_STRATEGY`

**Controls which documents are preloaded at startup:**

```bash
# Options: none, minimal, common, full
export TERRAGRUNT_WARMUP_STRATEGY=minimal
```

See [Warmup Strategies](#warmup-strategies) for details.

### MCP Configuration

Configure lazy loading in your MCP settings (`mcp-config.json` or VS Code settings):

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": ["run", "-i", "--rm"],
      "env": {
        "TERRAGRUNT_LAZY_LOADING": "true",
        "TERRAGRUNT_WARMUP_STRATEGY": "minimal"
      }
    }
  }
}
```

## Warmup Strategies

### Strategy Overview

| Strategy | Docs Loaded | Startup Time | Memory | Use Case |
|----------|-------------|--------------|---------|----------|
| **none** | 0 | ~0ms | Minimal | CI/CD, batch processing |
| **minimal** | 3-5 | ~90ms | Low | Quick lookups, testing |
| **common** | 8-12 | ~200ms | Moderate | General development |
| **full** | All (~85) | ~1.5s | High | Offline mode, intensive workflows |

### Strategy Details

#### `none` - No Preloading

**Characteristics:**
- Zero documents loaded at startup
- Minimal memory footprint
- Fastest startup time
- All content loaded on first access

**Best for:**
- Automated CI/CD pipelines
- Resource-constrained environments
- Batch processing where specific docs are known
- Testing scenarios requiring clean state

**Example:**
```bash
export TERRAGRUNT_WARMUP_STRATEGY=none
```

#### `minimal` - Essential Documents (Default)

**Characteristics:**
- Preloads 3-5 most commonly accessed documents
- ~90ms warmup time
- Low memory overhead
- Fast startup with commonly needed content ready

**Documents preloaded:**
- Getting Started Guide
- Core Features Overview
- Common Configuration Reference

**Best for:**
- Interactive development (default choice)
- Quick documentation lookups
- Exploratory workflows
- VS Code/Copilot integration

**Example:**
```bash
export TERRAGRUNT_WARMUP_STRATEGY=minimal  # Default
```

#### `common` - Frequently Used Documents

**Characteristics:**
- Preloads 8-12 commonly accessed sections
- ~200ms warmup time
- Moderate memory usage
- Most frequent queries served from cache

**Documents preloaded:**
- All minimal strategy docs
- CLI reference pages
- Built-in functions reference
- Configuration block documentation

**Best for:**
- Regular Terragrunt development
- Teams working with standard patterns
- Workflows with frequent documentation access
- Moderate memory availability

**Example:**
```bash
export TERRAGRUNT_WARMUP_STRATEGY=common
```

#### `full` - All Documents

**Characteristics:**
- Preloads all ~85 documentation pages
- ~1.5s warmup time
- Maximum memory usage
- All searches served from cache (fastest after warmup)

**Best for:**
- Offline development environments
- High-memory servers
- Intensive documentation workflows
- Minimal latency requirements after startup

**Example:**
```bash
export TERRAGRUNT_WARMUP_STRATEGY=full
```

## Usage Examples

### Basic Search with Lazy Loading

```typescript
// Search uses metadata first (fast)
const results = await docsManager.searchDocs("remote state");

// Content is loaded on-demand when accessed
for (const doc of results) {
  console.log(doc.title);      // From metadata (immediate)
  console.log(doc.content);    // Loaded lazily if not cached
}
```

### Checking Lazy Loading Status

```typescript
const stats = docsManager.getCacheStats();

console.log(stats.lazyLoading);
// {
//   enabled: true,
//   startupTimeMs: 123.45,
//   metadataOnlyLoadTime: 67.89,
//   warmupTime: 92.34,
//   initialMemoryMB: 45.67,
//   metadataCount: 85,
//   docsLoadedLazily: 3,
//   averageDocLoadTimeMs: 15.2,
//   warmupStrategy: "minimal"
// }
```

### Warmup Timing

```typescript
// Warmup happens automatically at startup
// Log output shows timing:
// "Warmed up 3 docs in 92.34ms with strategy 'minimal'"

// Manual warmup (advanced use case)
await docsManager.warmupCache();
```

## Performance Characteristics

### Memory Usage

**With lazy loading enabled (minimal strategy):**
- **Metadata**: ~50KB (85 docs × ~600 bytes)
- **Content cache**: ~400KB (3-5 preloaded docs)
- **Total startup**: ~450KB (~80% reduction vs full loading)

**Without lazy loading:**
- **Full content**: ~2.5MB (all 85 docs loaded)

### Startup Performance

| Mode | Initial Load | Warmup | Total | Memory |
|------|-------------|---------|-------|---------|
| **Lazy (none)** | ~10ms | 0ms | ~10ms | 50KB |
| **Lazy (minimal)** | ~10ms | ~90ms | ~100ms | 450KB |
| **Lazy (common)** | ~10ms | ~200ms | ~210ms | 1MB |
| **Lazy (full)** | ~10ms | ~1.5s | ~1.51s | 2.5MB |
| **No lazy loading** | ~1.8s | N/A | ~1.8s | 2.5MB |

### Search Performance

**First search (cold cache):**
- Metadata search: ~5-10ms
- Content loading: ~50-100ms per doc (network latency)
- Total: ~55-110ms

**Subsequent searches (warm cache):**
- Metadata search: ~5-10ms
- Content loading: ~0ms (cached)
- Total: ~5-10ms

## Disk Cache Integration

### Cache Storage

Lazy loading integrates with the existing disk cache system:

- **Metadata saved**: `{url, title, section}` for all docs
- **Content saved**: Full `{url, title, section, content}` for loaded docs only
- **Partial cache**: When lazy loading enabled, cache may contain metadata-only entries
- **Full cache**: When all docs loaded, cache contains complete content

### Cache Persistence

```typescript
// Save cache with lazy loading metadata
await docsManager.saveCacheToDisk();
// Saves: metadata for all docs + content for loaded docs

// Load cache in lazy mode
await docsManager.loadCacheFromDisk();
// Loads: metadata for all docs, content loaded on-demand
```

### Cache Expiry

- **Metadata expiry**: 24 hours (same as full cache)
- **Content expiry**: 24 hours (same as full cache)
- **Partial updates**: Individual docs can be refreshed without reloading all content

## Metrics and Monitoring

### Lazy Loading Metrics

Available in `getCacheStats()`:

```typescript
interface LazyLoadingMetrics {
  enabled: boolean;              // Lazy loading mode status
  startupTimeMs: number;         // Total startup time in milliseconds
  metadataOnlyLoadTime?: number; // Time to load metadata in milliseconds
  warmupTime?: number;           // Time spent warming up cache in milliseconds
  initialMemoryMB: number;       // Initial memory usage estimate
  metadataCount: number;         // Number of documents with metadata loaded
  docsLoadedLazily: number;      // Number of documents loaded on-demand
  averageDocLoadTimeMs: number;  // Average time to load a document
  warmupStrategy: string;        // Current warmup strategy (none/minimal/common/full)
}
```

### Monitoring Example

```typescript
const stats = docsManager.getCacheStats();

console.log(`Lazy Loading: ${stats.lazyLoading.enabled ? 'ON' : 'OFF'}`);
console.log(`Strategy: ${stats.lazyLoading.warmupStrategy}`);
console.log(`Metadata: ${stats.lazyLoading.metadataCount} docs`);
console.log(`Loaded: ${stats.lazyLoading.docsLoadedLazily} docs`);
console.log(`Avg Load Time: ${stats.lazyLoading.averageDocLoadTimeMs.toFixed(2)}ms`);
console.log(`Memory: ${stats.lazyLoading.initialMemoryMB.toFixed(2)} MB`);
```

## Troubleshooting

### Issue: Slow First Search

**Symptoms:** First search takes 100-500ms, subsequent searches are fast

**Cause:** Documents are loaded on-demand on first access

**Solutions:**
1. **Use warmup strategy**: Switch to `minimal` or `common` for preloading
2. **Preload specific docs**: Manually load frequently used documents
3. **Accept tradeoff**: Slower first access, faster startup

**Example:**
```bash
# Preload common documents
export TERRAGRUNT_WARMUP_STRATEGY=common
```

### Issue: High Memory Usage

**Symptoms:** Memory usage grows over time as more documents are accessed

**Cause:** Content cache stores all loaded documents without eviction

**Solutions:**
1. **Use none strategy**: Minimal preloading reduces baseline memory
2. **Restart periodically**: In long-running processes, restart to clear cache
3. **Disable lazy loading**: If memory is available and full content is always needed

**Current state:** Content cache has no size limit or LRU eviction (planned future enhancement)

### Issue: Warmup Taking Too Long

**Symptoms:** Server startup delayed by 1-2 seconds due to warmup

**Cause:** Using `full` warmup strategy loads all 85 documents

**Solutions:**
1. **Switch strategy**: Use `minimal` or `common` for faster startup
2. **Disable warmup**: Use `none` for fastest startup (content loads on-demand)
3. **Accept tradeoff**: Slower startup, faster subsequent operations

**Example:**
```bash
# Fastest startup
export TERRAGRUNT_WARMUP_STRATEGY=none

# Balanced startup and performance
export TERRAGRUNT_WARMUP_STRATEGY=minimal
```

### Issue: Duplicate Load Requests

**Symptoms:** Same document appears to be loading multiple times

**Cause:** Promise deduplication prevents this, but concurrent requests may log multiple times

**Expected behavior:** 
- Multiple concurrent requests for same doc → single network request
- Loading promise is shared across all requesters
- All get content from cache after first load completes

**Verification:**
```typescript
// Inspect lazy loading stats
const stats = docsManager.getCacheStats();
console.log(`Docs loaded lazily: ${stats.lazyLoading.docsLoadedLazily}`);
console.log(`Metadata count: ${stats.lazyLoading.metadataCount}`);
```

## Best Practices

### 1. Choose Appropriate Warmup Strategy

**Development environments:**
- Use `minimal` (default) for quick lookups
- Use `common` for regular development work

**CI/CD environments:**
- Use `none` for minimal startup time
- Use `full` if all docs are needed and memory available

**Production servers:**
- Use `minimal` or `common` for balanced performance
- Monitor memory usage with `getCacheStats()`

### 2. Monitor Cache Performance

```typescript
// Regular monitoring
setInterval(() => {
  const stats = docsManager.getCacheStats();
  console.log(`Loaded: ${stats.lazyLoading.docsLoadedLazily}/${stats.lazyLoading.metadataCount}`);
  console.log(`Memory: ${stats.lazyLoading.initialMemoryMB.toFixed(2)} MB`);
  console.log(`Loaded docs ratio: ${stats.loadedDocsRatio.toFixed(2)}`);
}, 60000); // Every minute
```

### 3. Optimize Search Patterns

```typescript
// ✅ GOOD: Search metadata first, load content only for results
const results = await docsManager.searchDocs("remote state", 10);
// Only top 10 results have content loaded

// ❌ AVOID: Searching and loading all docs
const allDocs = await docsManager.getAllDocs();
const filtered = allDocs.filter(doc => doc.content.includes("remote state"));
// Loads all 85 docs unnecessarily
```

### 4. Leverage Disk Cache

```typescript
// Save cache after loading important documents
await docsManager.warmupCache(); // Load common docs
await docsManager.saveCacheToDisk(); // Save for next startup

// Next startup will load from disk cache (fast)
await docsManager.loadCacheFromDisk();
```

### 5. Test Both Modes

```typescript
// Test with lazy loading enabled
process.env.TERRAGRUNT_LAZY_LOADING = 'true';
const lazyManager = new TerragruntDocsManager();
await lazyManager.fetchLatestDocs();

// Test with lazy loading disabled
process.env.TERRAGRUNT_LAZY_LOADING = 'false';
const fullManager = new TerragruntDocsManager();
await fullManager.fetchLatestDocs();

// Compare performance and memory usage
```

## Future Enhancements

### Planned Features (Issue #183 Follow-ups)

1. **LRU Cache Eviction**
   - Limit content cache size
   - Evict least recently used documents
   - Configurable max cache size

2. **Intelligent Preloading**
   - Track usage patterns
   - Predict next document accesses
   - Preload based on user behavior

3. **Selective Warmup**
   - Warmup specific sections or categories
   - Custom warmup document lists
   - Per-user warmup preferences

4. **Streaming Content**
   - Load large documents progressively
   - Start searching before full content loaded
   - Reduce perceived latency

5. **Cache Metrics Dashboard**
   - Real-time cache performance visualization
   - Hit/miss ratios
   - Memory usage trends

## Related Documentation

- [Caching System](Caching-System.md) - Overall cache architecture
- [Cache Optimizations](Cache-Optimizations.md) - Performance tuning
- [Performance Testing](Performance-Testing.md) - Benchmarking methods
- [Architecture Overview](Architecture-Overview.md) - System design

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the lazy loading system.

### Testing Lazy Loading

Run the comprehensive lazy loading test suite:

```bash
# Run all lazy loading tests
npm test -- test/unit/lazy-loading.test.ts

# Run specific test suite
npm test -- test/unit/lazy-loading.test.ts -t "warmupCache"

# Run with coverage
npm test -- test/unit/lazy-loading.test.ts --coverage
```

### Adding Warmup Strategies

To add a new warmup strategy:

1. Add strategy to `WarmupStrategy` type in `src/types/lazy-loading.ts`
2. Implement logic in `warmupCache()` method in `src/terragrunt/docs.ts`
3. Add tests in `test/unit/lazy-loading.test.ts`
4. Update documentation in this file

Example:
```typescript
case 'custom':
  // Load custom set of documents
  const customDocs = ['getting-started', 'cli-reference'];
  for (const section of customDocs) {
    await this.loadDocumentsBySection(section);
  }
  break;
```

## License

MIT License - see [LICENSE](../LICENSE) for details.
