# Documentation Loading Architecture

## Overview

The Terragrunt MCP Server fetches all documentation in a **single HTTP request** via the Terragrunt `llms.txt` endpoint and stores it in a metadata-indexed architecture optimized for fast search and retrieval.

### Data Flow

```
llms.txt (single HTTP request)
  → Parse Markdown into doc entries (split on H1 boundaries)
  → Populate metadataCache (title/url/section per doc)
  → Populate contentCache (full Markdown content per doc)
  → Build indexedMetadata (pre-computed lowercase fields for search)
  → Persist to disk cache (compressed JSON)
```

### Fallback Chain

```
Disk cache → Network refresh (llms.txt) → Stale in-memory cache → Fixture (offline)
```

## Architecture

### Metadata-Indexed Model

All documents are fetched upfront in one request. Two in-memory caches store the data separately for efficient search and retrieval:

- **`metadataCache: Map<string, DocMetadata>`** — lightweight metadata (title, URL, section, date)
- **`contentCache: Map<string, string>`** — full Markdown content keyed by URL
- **`indexedMetadata: IndexedMetadata[]`** — pre-computed lowercase fields for search

Search operates in two tiers: first against `indexedMetadata` (fast string matching on lowercase title/section/URL), then falls back to full-text content matching for documents not already matched. Results are ranked with metadata matches above content matches. Full `TerragruntDoc` objects are assembled from both caches for matched documents.

```typescript
interface DocMetadata {
  title: string;
  url: string;
  section: string;
  lastUpdated?: string;
}
```

### Why Two Caches?

Separating metadata from content enables:

1. **Fast search**: Matching against small metadata objects avoids scanning full content
2. **Efficient serialization**: Metadata index is rebuilt from the lightweight cache on startup
3. **Clear data flow**: `assembleDocs()` and `assembleDoc(url)` combine the two caches on demand

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TERRAGRUNT_CACHE_TTL_HOURS` | `24` | Cache expiry time in hours |
| `TERRAGRUNT_CACHE_COMPRESSION` | `true` | Enable gzip compression for disk cache |
| `TERRAGRUNT_LLMS_SOURCE` | `llms-small.txt` | Override llms.txt URL (absolute URL or relative path) |

### llms.txt Source

```bash
# Use abridged docs (default)
# https://docs.terragrunt.com/llms-small.txt

# Use full docs
export TERRAGRUNT_LLMS_SOURCE=llms-full.txt

# Use a local file or mirror
export TERRAGRUNT_LLMS_SOURCE=https://my-mirror.example.com/llms.txt
```

## Metrics and Monitoring

### Loading Metrics

Available via `getCacheStats()`:

```typescript
interface LoadingMetrics {
  startupTimeMs: number;       // Total startup time including disk cache load
  fetchAndIndexTime?: number;  // Time to fetch from llms.txt and build indexes
  initialMemoryMB: number;     // Initial memory usage at construction
  metadataCount: number;       // Number of documents in metadata cache
}
```

### Usage Example

```typescript
const stats = docsManager.getCacheStats();

console.log(`Docs: ${stats.cacheSize}`);
console.log(`Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
console.log(`Cache age: ${stats.lastRefresh ? Math.round((Date.now() - stats.lastRefresh.getTime()) / 60000) : 'N/A'} min`);
if (stats.loading) {
  console.log(`Fetch time: ${stats.loading.fetchAndIndexTime?.toFixed(2)}ms`);
}
```

## Migration from Lazy Loading

The previous lazy loading model (`TERRAGRUNT_LAZY_LOADING`, `TERRAGRUNT_WARMUP_STRATEGY` env vars) has been removed. With the llms.txt single-fetch model, all content is available immediately after the initial fetch — there is no longer a distinction between "metadata-only" and "full content" modes.

**Removed env vars** (safe to remove from your configuration):
- `TERRAGRUNT_LAZY_LOADING`
- `TERRAGRUNT_WARMUP_STRATEGY`

**Removed internal methods:**
- `loadDocContent()` — replaced by synchronous `assembleDoc(url)` cache lookup
- `warmupCache()` / `getCommonSections()` — no-op with single-fetch model
- `buildSearchIndex()` — replaced by `buildMetadataIndex()`

## Related Documentation

- [Caching System](Caching-System.md) — Overall cache architecture
- [Cache Optimizations](Cache-Optimizations.md) — Performance tuning
- [Performance Testing](Performance-Testing.md) — Benchmarking methods
- [Architecture Overview](Architecture-Overview.md) — System design
