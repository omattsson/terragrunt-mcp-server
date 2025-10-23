# Terragrunt Documentation Fixtures

This directory contains static fixture files used as fallback when fetching documentation fails.

## Files

### `terragrunt-docs-fixture.json`

A snapshot of Terragrunt documentation that serves as a fallback when:
- Network fetch fails after retries
- Documentation website is unavailable
- Running in CI environments with network restrictions

This ensures tests remain deterministic and don't fail due to network issues.

## Fallback Strategy

The documentation fetching follows this priority:

1. **In-memory cache** - Fastest, used if already loaded
2. **Disk cache** - `.cache/terragrunt-docs/` (24-hour expiry)
3. **Network fetch with retry** - Fetches from terragrunt.gruntwork.io with exponential backoff:
   - Max retries: 3
   - Initial delay: 1 second
   - Max delay: 10 seconds
   - Backoff multiplier: 2x
4. **Stale disk cache** - If network fails, use expired cache
5. **Fixture fallback** - Last resort, uses this static fixture

## Updating the Fixture

To update the fixture with fresh documentation:

```bash
# Ensure you have fresh docs in cache
npm run test:server

# Copy the cache to fixture
cp .cache/terragrunt-docs/docs-cache.json fixtures/terragrunt-docs-fixture.json

# Commit the updated fixture
git add fixtures/terragrunt-docs-fixture.json
git commit -m "chore: Update Terragrunt documentation fixture"
```

## Fixture Contents

The fixture contains approximately 84 documentation pages covering:
- Getting Started guides
- Configuration reference
- Features documentation
- CLI commands
- HCL blocks and attributes
- Troubleshooting guides

Last updated: October 2025
