# Schema Drift Detection

Automated detection of differences between Terraform backend documentation and our schema files.

## Overview

The Schema Drift Detection system helps maintain schema files by:
- Scraping Terraform backend documentation
- Comparing documented attributes with our schema files
- Generating drift reports
- Creating GitHub issues when drift is detected (via CI)

## Usage

### Local Testing

Run drift detection for all backends:
```bash
npm run check-schema-drift
```

Check a specific backend:
```bash
npm run check-schema-drift -- --backend=s3
npm run check-schema-drift -- --backend=azurerm
npm run check-schema-drift -- --backend=gcs
```

Get human-readable markdown output:
```bash
npm run check-schema-drift -- --format=markdown
npm run check-schema-drift -- --backend=s3 --format=markdown > drift-report.md
```

### Output Formats

**JSON Output** (default):
```json
{
  "hasDrift": true,
  "timestamp": "2024-12-10T17:00:00Z",
  "backends": {
    "s3": [
      {
        "backend": "s3",
        "schemaFile": "aws-s3-complete.json",
        "missing": [
          {
            "name": "new_attribute",
            "description": "Description from docs"
          }
        ],
        "extra": ["old_attribute"],
        "deprecated": []
      }
    ]
  }
}
```

**Markdown Output** (`--format=markdown`):
```markdown
# Schema Drift Report

**Generated:** 2024-12-10T17:00:00Z
**Status:** ⚠️ Drift Detected

## S3 - aws-s3-complete.json

### ⚠️ Missing Attributes (in docs, not in schema)
- `new_attribute`: Description from docs

### ℹ️ Extra Attributes (in schema, not in docs)
- `old_attribute`
```

## GitHub Action

The drift check runs automatically:
- **Schedule**: Weekly on Sunday at midnight UTC
- **Manual**: Via workflow_dispatch in GitHub Actions UI

### Workflow Behavior

1. Runs `npm run check-schema-drift`
2. If drift detected:
   - Creates/updates GitHub issue with label `schema-drift`
   - Uploads drift report as artifact
   - Sends notification
3. If no drift:
   - Logs success
   - No issue created

### Manual Trigger

1. Go to Actions tab in GitHub
2. Select "Schema Drift Check" workflow
3. Click "Run workflow"
4. Select branch and run

## Understanding Drift Reports

### Missing Attributes
Attributes found in Terraform documentation but not in our schema files. These may be:
- **New attributes**: Recently added to Terraform
- **Undocumented attributes**: Not in our schema yet
- **Version-specific**: Only available in newer Terraform versions

**Action**: Review Terraform docs and add to schema if appropriate.

### Extra Attributes
Attributes in our schema but not found in documentation. These may be:
- **Deprecated**: Removed from documentation
- **Documented elsewhere**: In provider docs instead
- **Terraform version-specific**: Older versions only
- **Scraping issues**: Documentation structure changed

**Action**: Verify in Terraform source code before removing.

### Deprecated Attributes
Attributes explicitly marked as deprecated in documentation.

**Action**: Consider deprecating in schema, keep with deprecation note.

## Maintaining Schemas

When drift is detected:

1. **Review the drift report** - Understand what changed
2. **Check Terraform documentation** - Verify the changes
3. **Update schema files** in `schemas/backends/`:
   - Add new attributes with proper types
   - Mark deprecated attributes
   - Update descriptions
4. **Test template generation**:
   ```bash
   # Test that templates still generate correctly
   npm run build
   npm test
   ```
5. **Update documentation** if backend options changed significantly
6. **Close the drift issue** once resolved

## Limitations

### Documentation Scraping
- HashiCorp docs use dynamic rendering
- HTML structure may change
- Some attributes may be hard to detect
- Examples may be confused with actual attributes

### Manual Review Required
- **Never auto-update schemas** - Human review is essential
- Attribute types must be inferred manually
- Required vs optional must be verified
- Validation rules must be added manually

### False Positives
The scraper may report drift for:
- Documentation examples mistaken for attributes
- Nested attributes in complex structures
- Attributes documented in different sections
- Provider-specific vs backend attributes

## Troubleshooting

### No Attributes Found
If the scraper finds 0 or very few attributes:
1. Check if Terraform docs URL changed
2. Verify HTML structure hasn't changed significantly
3. Run with increased logging
4. Try alternative scraping strategies

### Too Many False Positives
1. Review the "extra" attributes - many may be legitimate
2. Check if documentation structure changed
3. Consider updating scraper selectors
4. Cross-reference with Terraform source code

### CI Failures
If the GitHub Action fails:
1. Check action logs for errors
2. Verify network connectivity
3. Check if HashiCorp site is accessible
4. Review rate limiting issues

## Configuration

### Backend Configuration
Edit `scripts/check-schema-drift.ts` to add or modify backends:

```typescript
const BACKENDS: BackendConfig[] = [
  {
    id: 's3',
    name: 'AWS S3',
    docsUrl: 'https://developer.hashicorp.com/terraform/language/settings/backends/s3',
    schemaFiles: ['s3.json', 'aws-s3-complete.json']
  },
  // Add more backends here
];
```

### Workflow Schedule
Edit `.github/workflows/schema-check.yml` to change schedule:

```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Sunday midnight
    # Change to '0 0 1 * *' for monthly
```

## Related Documentation

- [Backend Schema Format](Backend-Schema-Format.md) - Schema file structure
- [Complete Backend Templates](Complete-Backend-Templates.md) - Using Complete tier
- [Configuration Generator](Configuration-Generator.md) - Template generation

## Development

### Improving the Scraper

To improve attribute detection:

1. **Add new selectors** for different HTML structures
2. **Improve filtering** to reduce false positives
3. **Handle nested attributes** better
4. **Add tests** for scraping logic

### Testing Changes

```bash
# Test locally before committing
npm run check-schema-drift -- --backend=s3 --format=markdown

# Compare with previous output
npm run check-schema-drift > new-report.json
diff old-report.json new-report.json
```

## Notes

This automation is **optional** because:
- Terraform backend changes are infrequent (1-2 times per year)
- Manual schema updates are acceptable
- Scraping HTML is fragile and requires maintenance
- Human review is always required for schema changes

Consider this a helpful alert system rather than a complete automation solution.
