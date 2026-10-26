# File Writing Guide

The Terragrunt MCP Server includes secure file writing capabilities through the `write_terragrunt_config` tool. This guide covers security configuration, usage patterns, and best practices.

## Table of Contents

- [Security Model](#security-model)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Security Model

File writing is **disabled by default** and requires explicit configuration. The security model is based on:

### Defense in Depth

1. **Opt-in by default**: There is no default allowed directory. Until `TERRAGRUNT_MCP_ALLOWED_DIRS` is set, writes and diff reads are refused with `NO_ALLOWED_DIRECTORIES`. A filesystem root (`/`, `C:\`) is never accepted as an allowed directory.
2. **Directory whitelisting**: Only write to explicitly allowed directories
3. **File type allowlist**: Only `.hcl` files by default (`terragrunt.hcl`, `root.hcl`, `terragrunt.stack.hcl`, …). Extra extensions can be enabled with `TERRAGRUNT_MCP_ALLOWED_EXTENSIONS`.
4. **No dot-files or dot-directories**: Any path segment starting with `.` below the allowed directory is refused, so `.git/hooks`, `.github/workflows`, `.envrc` and similar files cannot be written or read.
5. **Link escape prevention**: A target that is a symlink or has more than one hard link is refused, and the file is opened with `O_NOFOLLOW` and its link count re-checked before it is truncated. The target's real path (resolved through its nearest existing parent directory) must stay inside an allowed directory and pass the file-type and dot-file rules, so a symlinked directory cannot redirect a write elsewhere, including into `.github` or `.git`. The real path is checked again after parent directories are created. A process that can modify the allowed directory at the same moment could still swap a directory for a symlink between that check and the write; Node.js has no `openat()` to close that gap.
6. **Path traversal prevention**: Automatic detection and blocking of `../` patterns
7. **Overwrite protection**: Requires explicit permission to overwrite files; an overwritten file keeps its permissions
8. **Automatic backups**: Creates timestamped backups before overwriting
9. **File size limits**: Configurable maximum file size

The same path, file type and symlink rules apply to the files read for `compareWith` diffs, so a diff cannot be used to read secrets such as a `.env` file.

### Security Layers

```text
┌─────────────────────────────────────┐
│  1. Enabled + Allowlist Check       │  ← TERRAGRUNT_MCP_FILE_WRITE_ENABLED,
│                                     │    TERRAGRUNT_MCP_ALLOWED_DIRS (required)
├─────────────────────────────────────┤
│  2. File Size Validation            │  ← TERRAGRUNT_MCP_MAX_FILE_SIZE
├─────────────────────────────────────┤
│  3. Path Traversal Detection        │  ← ../ pattern matching
├─────────────────────────────────────┤
│  4. Path Normalization              │  ← path.resolve()
├─────────────────────────────────────┤
│  5. Directory Whitelist Validation  │  ← TERRAGRUNT_MCP_ALLOWED_DIRS
├─────────────────────────────────────┤
│  6. File Name Policy                │  ← TERRAGRUNT_MCP_ALLOWED_EXTENSIONS,
│                                     │    no dot-files / dot-directories
├─────────────────────────────────────┤
│  7. Symlink Checks                  │  ← target not a symlink; real parent
│                                     │    path inside allowed directories
├─────────────────────────────────────┤
│  8. Overwrite Check                 │  ← overwrite parameter
├─────────────────────────────────────┤
│  9. Backup Creation                 │  ← TERRAGRUNT_MCP_AUTO_BACKUP
├─────────────────────────────────────┤
│ 10. Write Operation                 │  ← open(O_NOFOLLOW), mode preserved
└─────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Enable File Writing

```bash
# Configure allowed directories (comma-separated). Required: without it,
# file writing is refused.
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user/terraform,/home/user/projects"

# Optional: allow file types beyond .hcl
export TERRAGRUNT_MCP_ALLOWED_EXTENSIONS=".hcl,.tfvars"
```

### Step 2: Generate Configuration

Use the AI assistant to generate a configuration:

```text
"Generate an AWS S3 remote state configuration for my project"
```

### Step 3: Write to Disk

```text
"Write this configuration to /home/user/terraform/terragrunt.hcl"
```

### Step 4: Verify

The tool will respond with success details:

```json
{
  "success": true,
  "path": "/home/user/terraform/terragrunt.hcl",
  "bytesWritten": 245,
  "created": true,
  "backedUp": false
}
```

---

## Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TERRAGRUNT_MCP_FILE_WRITE_ENABLED` | boolean | `true` | Set to `false` to turn file writing and diff reads off entirely |
| `TERRAGRUNT_MCP_ALLOWED_DIRS` | string | none | Comma-separated allowed directories. **Required** for writes; filesystem roots are ignored |
| `TERRAGRUNT_MCP_ALLOWED_EXTENSIONS` | string | `.hcl` | Comma-separated file extensions that may be written or diffed |
| `TERRAGRUNT_MCP_AUTO_BACKUP` | boolean | `true` | Automatic backup creation |
| `TERRAGRUNT_MCP_MAX_FILE_SIZE` | number | `1048576` | Maximum file size (bytes) |

### Configuration Examples

#### Development Environment

```bash
# ~/.bashrc or ~/.zshrc
export TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true
export TERRAGRUNT_MCP_ALLOWED_DIRS="$HOME/terraform,$HOME/projects"
export TERRAGRUNT_MCP_AUTO_BACKUP=true
export TERRAGRUNT_MCP_MAX_FILE_SIZE=2097152  # 2MB
```

#### CI/CD Environment

```yaml
# GitHub Actions
env:
  TERRAGRUNT_MCP_FILE_WRITE_ENABLED: 'true'
  TERRAGRUNT_MCP_ALLOWED_DIRS: '/github/workspace/terraform'
  TERRAGRUNT_MCP_AUTO_BACKUP: 'false'  # No backups in CI
  TERRAGRUNT_MCP_MAX_FILE_SIZE: '524288'  # 512KB
```

#### Docker Environment

```dockerfile
ENV TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true
ENV TERRAGRUNT_MCP_ALLOWED_DIRS=/app/terraform,/app/configs
ENV TERRAGRUNT_MCP_AUTO_BACKUP=true
```

### VS Code MCP Settings

```json
{
  "mcpServers": {
    "terragrunt": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/build/index.js"],
      "env": {
        "TERRAGRUNT_MCP_FILE_WRITE_ENABLED": "true",
        "TERRAGRUNT_MCP_ALLOWED_DIRS": "/home/user/terraform,/home/user/projects",
        "TERRAGRUNT_MCP_AUTO_BACKUP": "true"
      }
    }
  }
}
```

---

## Usage Examples

### Example 1: Create New File

```json
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "path": "/home/user/terraform/terragrunt.hcl",
    "content": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket = \"my-state\"\n    region = \"us-east-1\"\n  }\n}"
  }
}
```

**Response:**

```json
{
  "success": true,
  "path": "/home/user/terraform/terragrunt.hcl",
  "bytesWritten": 123,
  "created": true,
  "backedUp": false,
  "message": "File created successfully"
}
```

### Example 2: Update Existing File with Backup

```json
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "path": "/home/user/terraform/terragrunt.hcl",
    "content": "remote_state {\n  backend = \"s3\"\n  config = {\n    bucket = \"my-state-updated\"\n    region = \"us-west-2\"\n  }\n}",
    "overwrite": true,
    "createBackup": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "path": "/home/user/terraform/terragrunt.hcl",
  "bytesWritten": 135,
  "created": false,
  "backedUp": true,
  "backupPath": "/home/user/terraform/terragrunt.hcl.backup.2025-10-30T12-34-56-789Z",
  "message": "File updated successfully (backup created)"
}
```

### Example 3: Create File with Parent Directories

```json
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "path": "/home/user/terraform/env/prod/terragrunt.hcl",
    "content": "inputs = {\n  environment = \"prod\"\n}",
    "createParentDirs": true
  }
}
```

This automatically creates `/home/user/terraform/env/prod/` if it doesn't exist.

### Example 4: Generate + Write Workflow

#### Step 1: Generate

```text
"Generate a remote state configuration for AWS S3 with DynamoDB locking"
```

#### Step 2: Write

```text
"Write this to /home/user/terraform/terragrunt.hcl"
```

The AI assistant will:

1. Call `generate_terragrunt_config` to create the configuration
2. Call `write_terragrunt_config` to save it to disk
3. Report the result with file path and size

### Example 5: Multi-Environment Setup

```bash
# Create environment-specific configs
write_terragrunt_config \
  --path=/home/user/terraform/dev/terragrunt.hcl \
  --content='inputs = { environment = "dev" }'

write_terragrunt_config \
  --path=/home/user/terraform/staging/terragrunt.hcl \
  --content='inputs = { environment = "staging" }'

write_terragrunt_config \
  --path=/home/user/terraform/prod/terragrunt.hcl \
  --content='inputs = { environment = "prod" }'
```

---

## Error Handling

### Common Errors

#### FILE_WRITING_DISABLED

**Error:**

```json
{
  "success": false,
  "error": "File writing is disabled",
  "errorType": "FILE_WRITING_DISABLED"
}
```

**Solution:**

```bash
export TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true
```

#### OUTSIDE_ALLOWED_DIRECTORIES

**Error:**

```json
{
  "success": false,
  "path": "/etc/passwd",
  "error": "Path is outside allowed directories: /etc/passwd",
  "errorType": "OUTSIDE_ALLOWED_DIRECTORIES"
}
```

**Solution:**

```bash
# Add the directory to allowed list
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user/terraform,/home/user/projects"
```

#### PATH_TRAVERSAL_DETECTED

**Error:**

```json
{
  "success": false,
  "error": "Path traversal detected: ../../etc/passwd",
  "errorType": "PATH_TRAVERSAL_DETECTED"
}
```

**Solution:**

Use absolute paths or paths without `../`:

```bash
# Good
/home/user/terraform/terragrunt.hcl
./terraform/terragrunt.hcl

# Bad
../../etc/passwd
../../../tmp/hack.hcl
```

#### FILE_EXISTS_NO_OVERWRITE

**Error:**

```json
{
  "success": false,
  "path": "/home/user/terraform/terragrunt.hcl",
  "error": "File exists and overwrite is disabled",
  "errorType": "FILE_EXISTS_NO_OVERWRITE"
}
```

**Solution:**

Set `overwrite: true`:

```json
{
  "overwrite": true,
  "createBackup": true
}
```

#### MAX_SIZE_EXCEEDED

**Error:**

```json
{
  "success": false,
  "error": "File size exceeds maximum allowed (1048576 bytes)",
  "errorType": "MAX_SIZE_EXCEEDED"
}
```

**Solution:**

```bash
# Increase max file size (in bytes)
export TERRAGRUNT_MCP_MAX_FILE_SIZE=2097152  # 2MB
```

#### PERMISSION_DENIED

**Error:**

```json
{
  "success": false,
  "error": "Permission denied: Cannot write to /home/user/terraform/terragrunt.hcl",
  "errorType": "PERMISSION_DENIED"
}
```

**Solution:**

```bash
# Fix file/directory permissions
chmod 755 /home/user/terraform
chmod 644 /home/user/terraform/terragrunt.hcl  # if exists
```

---

## Best Practices

### 1. Use Absolute Paths

**Good:**

```bash
/home/user/terraform/terragrunt.hcl
/Users/john/projects/app/terraform/terragrunt.hcl
```

**Avoid:**

```bash
../terraform/terragrunt.hcl  # May trigger path traversal detection
../../configs/terragrunt.hcl  # Relative paths can be ambiguous
```

### 2. Enable Backups for Production

```bash
# Always create backups when updating critical files
export TERRAGRUNT_MCP_AUTO_BACKUP=true
```

Or specify per-operation:

```json
{
  "overwrite": true,
  "createBackup": true
}
```

### 3. Minimal Directory Whitelist

Only allow directories you actually need:

```bash
# Good: Specific project directories
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user/terraform,/home/user/infra"

# Bad: Too permissive
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user,/tmp,/var"
```

Dot-files and non-`.hcl` files stay protected even inside a broad directory, but a narrow allowlist still limits which `.hcl` files can be overwritten.

### 4. Test with Non-Critical Directories First

```bash
# Test in a safe location
export TERRAGRUNT_MCP_ALLOWED_DIRS="/home/user/test-terraform"

# Try some operations
write_terragrunt_config --path=/home/user/test-terraform/test.hcl --content="# test"
```

### 5. Review Generated Content Before Writing

When using AI-generated configurations:

1. Generate the configuration
2. Review the output
3. Make any necessary adjustments
4. Write to disk

### 6. Use Version Control

Always commit before overwriting:

```bash
cd /home/user/terraform
git add terragrunt.hcl
git commit -m "Backup before regenerating config"

# Now safe to overwrite
write_terragrunt_config --path=terragrunt.hcl --overwrite=true
```

### 7. Set Appropriate File Size Limits

```bash
# For normal configs (1MB is usually plenty)
export TERRAGRUNT_MCP_MAX_FILE_SIZE=1048576

# For larger generated files
export TERRAGRUNT_MCP_MAX_FILE_SIZE=5242880  # 5MB
```

### 8. Use Environment-Specific Configurations

```bash
# Development
if [ "$ENV" = "development" ]; then
  export TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true
  export TERRAGRUNT_MCP_ALLOWED_DIRS="$HOME/terraform"
  export TERRAGRUNT_MCP_AUTO_BACKUP=true
fi

# Production (more restrictive)
if [ "$ENV" = "production" ]; then
  export TERRAGRUNT_MCP_FILE_WRITE_ENABLED=false  # Disable in prod
fi
```

---

## Troubleshooting

### File Writing Not Working

**Check if enabled:**

```bash
echo $TERRAGRUNT_MCP_FILE_WRITE_ENABLED
# Should output: true
```

**Check allowed directories:**

```bash
echo $TERRAGRUNT_MCP_ALLOWED_DIRS
# Should include your target directory
```

### Path Validation Failures

**Test path normalization:**

```bash
# What the tool sees after normalization
realpath /home/user/terraform/../../../etc/passwd
# Output: /etc/passwd (not in allowed directories)
```

**Use canonical paths:**

```bash
# Get canonical path
realpath /home/user/terraform
# Use this in TERRAGRUNT_MCP_ALLOWED_DIRS
```

### Backup Files Accumulating

Backups are timestamped and won't overwrite each other:

```bash
terragrunt.hcl.backup.2025-10-30T10-00-00-000Z
terragrunt.hcl.backup.2025-10-30T11-00-00-000Z
terragrunt.hcl.backup.2025-10-30T12-00-00-000Z
```

**Clean up old backups:**

```bash
# Keep only last 5 backups
ls -t terragrunt.hcl.backup.* | tail -n +6 | xargs rm
```

### Permission Issues

**Check directory permissions:**

```bash
ls -ld /home/user/terraform
# Should show: drwxr-xr-x (at least 755)
```

**Check file permissions:**

```bash
ls -l /home/user/terraform/terragrunt.hcl
# Should show: -rw-r--r-- (at least 644)
```

**Fix permissions:**

```bash
chmod 755 /home/user/terraform
chmod 644 /home/user/terraform/*.hcl
```

### VS Code MCP Configuration

**Verify MCP server is running:**

1. Open VS Code Output panel
2. Select "Model Context Protocol" from dropdown
3. Check for "Terragrunt MCP Server" initialization

**Reload MCP server:**

1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Run "Developer: Reload Window"

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
export DEBUG=terragrunt-mcp:*

# Now file operations will log detailed information
```

---

## Related Documentation

- [Available Tools](Available-Tools.md) - Complete tool reference
- [Configuration Generator](Configuration-Generator.md) - Generate configurations
- [Security Best Practices](../README.md#security) - General security guidelines
- [FAQ](FAQ.md) - Frequently asked questions

---

## Support

For issues or questions:

- [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues)
- [Discussions](https://github.com/omattsson/terragrunt-mcp-server/discussions)
