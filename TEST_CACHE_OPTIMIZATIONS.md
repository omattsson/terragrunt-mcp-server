# Testing Cache Optimizations

## Quick Test

### 1. Test Cache Compression

```bash
# Clear existing cache
rm -rf .cache/terragrunt-docs/

# Enable compression (default)
export TERRAGRUNT_CACHE_COMPRESSION=true

# Build and test
npm run build
npm test -- test/unit/cache-optimizations.test.ts

# Check cache file size
ls -lh .cache/terragrunt-docs/
# You should see docs-cache.json.gz (200-300KB) instead of docs-cache.json (1.1MB)
```

### 2. Test Configurable TTL

```bash
# Set short TTL for testing
export TERRAGRUNT_CACHE_TTL_HOURS=1

# Run server
npm start
```

### 3. Test Cache Statistics

```typescript
import { TerragruntDocsManager } from './src/terragrunt/docs.js';

const manager = new TerragruntDocsManager();
await manager.fetchLatestDocs();

// Perform some searches
await manager.searchDocs('dependencies');
await manager.searchDocs('remote state');
await manager.searchDocs('dependencies'); // Cached!

// Check stats
const stats = manager.getCacheStats();
console.log('Cache Statistics:', stats);
// Should show hits > 0 for the repeated search
```

### 4. Test LRU Search Cache

```bash
# Run the optimization tests
npm test -- test/unit/cache-optimizations.test.ts

# Look for these passing tests:
# ✓ should cache search results
# ✓ should return consistent results from cache  
# ✓ should cache multiple different queries
```

### 5. Performance Comparison

```bash
# Run performance benchmarks
npm test -- test/performance/performance.test.ts

# Look for improved times in:
# - search_terragrunt_docs (should be <1 second)
# - Cached searches (should be <1ms)
```

## Expected Results

### Compression
- **Before**: `docs-cache.json` @ 1.1MB
- **After**: `docs-cache.json.gz` @ 200-300KB

### Search Performance
- **First search**: ~15ms
- **Cached search**: ~0.1ms (150x faster!)
- **20 concurrent**: ~150ms (was ~400ms)

### Memory Usage
- **Bounded**: <60MB
- **Stats tracked**: hits, misses, searches, time

## Troubleshooting

### Cache not compressing?
```bash
echo $TERRAGRUNT_CACHE_COMPRESSION  # Should be 'true' or unset
rm -rf .cache/terragrunt-docs/
npm run build && npm start
```

### Stats not showing hits?
```bash
# Make sure to perform same search twice:
await manager.searchDocs('test');  # Miss
await manager.searchDocs('test');  # Hit!
```

### Tests failing?
```bash
# Clean rebuild
rm -rf dist node_modules
npm install
npm run build
npm test
```
