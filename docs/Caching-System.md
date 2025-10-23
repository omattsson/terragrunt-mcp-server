# Caching System

The Terragrunt MCP Server implements a sophisticated **two-tier caching system** with network fallbacks to ensure fast, reliable access to Terragrunt documentation.

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────┐
│                     Request Flow                         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  In-Memory Cache (L1)    │
        │  Map<string, Doc>        │
        │  Access: <1ms            │
        └──────┬───────────────────┘
               │ Miss
               ▼
        ┌──────────────────────────┐
        │  Disk Cache (L2)         │
        │  .cache/*.json           │
        │  Access: ~10ms           │
        └──────┬───────────────────┘
               │ Miss/Expired
               ▼
        ┌──────────────────────────┐
        │  Web Fetch (Source)      │
        │  terragrunt.gruntwork.io │
        │  Access: 5-10s           │
        │  (with retry logic)      │
        └──────┬───────────────────┘
               │ Failure
               ▼
        ┌──────────────────────────┐
        │  Stale Cache (Fallback)  │
        │  Use expired cache       │
        │  Access: ~10ms           │
        └──────┬───────────────────┘
               │ Not Available
               ▼
        ┌──────────────────────────┐
        │  Local Fixture           │
        │  fixtures/*.json         │
        │  Access: ~5ms            │
        │  (Always available)      │
        └──────────────────────────┘
```

## Tier 1: In-Memory Cache

### Implementation

```typescript
private inMemoryCache: Map<string, TerragruntDoc> = new Map();
```

### Characteristics

- **Storage**: JavaScript Map in server process memory
- **Capacity**: ~100-200 documentation pages (~1.1MB RAM)
- **Speed**: <1ms access time
- **Persistence**: Lost on server restart
- **Scope**: Per-process (not shared)

### Lifecycle

```text
Server Start → Empty cache
First Request → Fetch from L2/Web → Populate L1
Subsequent Requests → L1 hit → Instant response
Server Restart → L1 cleared → Repeat
```

### Advantages

- Ultra-fast access for repeated queries
- No I/O overhead
- Simple implementation
- No serialization cost

### Disadvantages

- Lost on restart
- RAM usage (minimal at ~1.1MB)
- Not shared across processes

## Tier 2: Disk Cache

### Implementation

**Location**: `.cache/terragrunt-docs/`

**Files**:
- `docs-cache.json` - Serialized documentation (~1.1MB)
- `metadata.json` - Cache metadata (timestamps, version)

### Characteristics

- **Storage**: JSON files on filesystem
- **Capacity**: All documentation (~1.1MB disk)
- **Speed**: ~10ms access time (read + parse)
- **Persistence**: Survives server restarts
- **Scope**: Per-installation

### Cache Structure

```json
{
  "version": "0.2.0",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "docs": [
    {
      "title": "Getting Started",
      "url": "https://terragrunt.gruntwork.io/docs/getting-started/",
      "section": "getting-started",
      "content": "Full documentation content...",
      "lastFetched": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Metadata Structure

```json
{
  "version": "0.2.0",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "docCount": 150,
  "totalSize": 1145620
}
```

### Lifecycle

```text
Server Start → Check disk cache
If Found → Load into L1 (~10ms) → Ready
If Not Found → Fetch from web → Save to L2 → Load into L1
Cache Expires (24h) → Fetch from web → Update L2 → Update L1
```

### Advantages

- Persists across restarts
- Fast server startup (warm cache)
- Reduces web requests
- Version-tracked

### Disadvantages

- Slower than L1 (10ms vs <1ms)
- Disk I/O required
- Serialization overhead

## Cache Expiry

### Time-Based Expiry

**Default**: 24 hours

```typescript
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### Expiry Check Logic

```typescript
shouldRefreshCache(): boolean {
  if (!this.cacheMetadata.lastUpdated) {
    return true; // No cache
  }
  
  const age = Date.now() - this.cacheMetadata.lastUpdated.getTime();
  return age > CACHE_EXPIRY_MS; // Expired?
}
```

### Refresh Behavior

```text
Check Time → If < 24h → Use cache
          → If >= 24h → Fetch from web
                      → Update both L1 and L2
                      → Return fresh data
```

### Manual Refresh

Force a refresh by deleting the cache:

```bash
# Delete cache directory
rm -rf .cache/terragrunt-docs/

# Next request will fetch fresh data
```

## Network Fallback Chain

### Fallback Levels

1. **Primary**: Web fetch with retry
2. **Secondary**: Disk cache (even if expired)
3. **Tertiary**: Local fixture

### Retry Logic

```typescript
const retryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay

**Total max time**: ~7 seconds

### Fallback Implementation

```typescript
async fetchLatestDocs(): Promise<TerragruntDoc[]> {
  try {
    // Try web fetch with retry
    return await this.retryWithBackoff(() => this.fetchFromWeb());
  } catch (error) {
    console.warn('Web fetch failed, trying disk cache...');
    
    try {
      // Try disk cache (even if expired)
      const cached = await this.loadFromDisk();
      if (cached.length > 0) {
        console.info('Using stale cache');
        return cached;
      }
    } catch (diskError) {
      console.warn('Disk cache unavailable');
    }
    
    // Last resort: local fixture
    console.info('Using local fixture');
    return await this.loadFixture();
  }
}
```

### Fallback Guarantees

- **Never fails**: Always returns data
- **Graceful degradation**: Uses stale data if needed
- **Predictable**: Clear fallback order
- **Logged**: Each fallback logged for debugging

## Local Fixture

### Purpose

Embedded fallback data for **offline operation** and **guaranteed availability**.

### Location

`fixtures/terragrunt-docs-fixture.json`

### Characteristics

- **Size**: ~800KB (subset of docs)
- **Version**: Snapshot at release time
- **Freshness**: May be outdated
- **Availability**: Always present

### When Used

1. Network completely unavailable
2. Disk cache corrupted or missing
3. Web fetch repeatedly fails
4. First-run with no internet

### Update Strategy

```bash
# Manually update fixture (maintainer task)
npm run update-fixture

# Or manually:
cp .cache/terragrunt-docs/docs-cache.json fixtures/terragrunt-docs-fixture.json
```

## Cache Performance

### Benchmarks

| Scenario | Time | Cache Hit |
|----------|------|-----------|
| In-memory hit | <1ms | L1 |
| Disk cache load | ~10ms | L2 |
| Web fetch (full) | 5-10s | Miss |
| Stale cache fallback | ~10ms | L2 (expired) |
| Fixture load | ~5ms | Fixture |

### Performance Optimization

**Best case** (warm cache):
```text
Request → L1 hit → <1ms response
```

**Good case** (cold start):
```text
Request → L1 miss → L2 hit → 10ms load → L1 populate → <1ms next
```

**Worst case** (cold start, no cache):
```text
Request → L1 miss → L2 miss → Web fetch → 5-10s → Save L2 → Populate L1 → <1ms next
```

### Cache Hit Rates

Typical production usage:
- **L1 hit rate**: 95%+ (repeated queries)
- **L2 hit rate**: 100% (server restarts)
- **Web fetch rate**: ~4% (once per 24 hours)

## Cache Invalidation

### Automatic Invalidation

- **Time-based**: Every 24 hours
- **Version change**: Server version update
- **Corruption detection**: CRC/checksum failure

### Manual Invalidation

```bash
# Clear all cache
rm -rf .cache/

# Clear only docs cache
rm -rf .cache/terragrunt-docs/

# Clear specific cache file
rm .cache/terragrunt-docs/docs-cache.json
```

### Programmatic Invalidation

```typescript
// Not exposed via API currently
// Future enhancement: MCP tool for cache management
```

## Configuration

### Cache Directory

**Default**: `.cache/terragrunt-docs/`

**Customization** (future):
```typescript
const manager = new TerragruntDocsManager({
  cacheDir: '/custom/path/.cache'
});
```

### Cache Expiry

**Default**: 24 hours

**Customization** (future):
```typescript
const manager = new TerragruntDocsManager({
  cacheExpiryHours: 48
});
```

### Disable Caching

**Not recommended**, but possible:

```typescript
// Delete cache on every start (development only)
import { rmSync } from 'fs';
rmSync('.cache', { recursive: true, force: true });
```

## Cache Monitoring

### Logs

Cache operations are logged:

```text
[INFO] Loading documentation from disk cache
[INFO] Cache is fresh (age: 12.5 hours)
[WARN] Cache expired (age: 25.3 hours), refreshing...
[INFO] Fetched 150 documentation pages
[INFO] Saved cache to disk
```

### Metrics

Available in logs:
- Cache age
- Document count
- Fetch time
- Cache size
- Hit/miss events

### Health Checks

```bash
# Check cache status
ls -lh .cache/terragrunt-docs/

# Check cache age
stat -f "Modified: %Sm" .cache/terragrunt-docs/docs-cache.json

# Validate cache JSON
jq '.docs | length' .cache/terragrunt-docs/docs-cache.json
```

## Advanced Topics

### Cache Warmup

Ensure cache is populated on deployment:

```bash
# Option 1: Include cache in deployment
tar -czf deploy.tar.gz dist/ .cache/ node_modules/

# Option 2: Warm cache on first deploy
node dist/index.js <<< '{"method":"initialize"}' > /dev/null
```

### Shared Cache

For multi-instance deployments:

```yaml
# Docker Compose example
volumes:
  - shared-cache:/app/.cache

volumes:
  shared-cache:
    driver: local
```

### Cache Preloading

Pre-populate cache before server starts:

```typescript
// Future enhancement
import { TerragruntDocsManager } from './terragrunt/docs.js';

const manager = new TerragruntDocsManager();
await manager.preloadCache();
```

## Troubleshooting

### Cache Not Persisting

**Problem**: Cache refetches on every restart

**Check**:
```bash
# Verify .cache directory exists
ls -la .cache/terragrunt-docs/

# Check file permissions
ls -l .cache/terragrunt-docs/docs-cache.json
```

**Solution**:
```bash
# Create cache directory
mkdir -p .cache/terragrunt-docs/

# Fix permissions
chmod -R 755 .cache/
```

### Cache Corruption

**Symptoms**:
- JSON parse errors
- Missing documentation
- Server crashes on startup

**Solution**:
```bash
# Delete corrupted cache
rm -rf .cache/terragrunt-docs/

# Server will fetch fresh data
```

### Slow Cache Load

**Problem**: 10ms feels slow

**Reality**: This is normal for disk I/O

**Optimization**:
- Use SSD (vs HDD)
- Reduce cache size (not recommended)
- Increase RAM for L1

### Stale Documentation

**Problem**: Documentation seems outdated

**Check cache age**:
```bash
stat .cache/terragrunt-docs/docs-cache.json
```

**Solution**:
```bash
# Force refresh
rm -rf .cache/terragrunt-docs/
```

## Best Practices

1. **Keep cache directory in .gitignore** ✅ (already included)
2. **Don't commit cache files** ✅ (already excluded)
3. **Monitor cache size** - Should stay ~1-2MB
4. **Periodically refresh** - Automatic after 24h
5. **Backup cache on deploy** - Speeds up cold starts
6. **Use SSD storage** - Faster disk cache loads
7. **Mount cache volume in Docker** - Persist across container restarts

## See Also

- [Architecture Overview](Architecture-Overview) - System architecture
- [Docker Deployment](Docker-Deployment) - Cache in containers
- [Configuration](Configuration) - Configuration options
- [Troubleshooting](Troubleshooting) - Common cache issues
