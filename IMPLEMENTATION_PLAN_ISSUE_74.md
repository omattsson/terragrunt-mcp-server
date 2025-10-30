# Implementation Plan: File Writing Capability (#74)

## 🎯 Decision: Option 2 - Separate Tool

After analysis, implementing a **separate tool** is the best approach for the following reasons:

### Why Not Option 1 (Extend existing tool)?
- ❌ Violates Single Responsibility Principle
- ❌ Mixes generation logic with file I/O concerns
- ❌ Harder to test and secure
- ❌ Complex optional parameters

### Why Not Option 3 (MCP Resource)?
- ❌ Resources are for READ operations, not WRITE side effects
- ❌ MCP doesn't provide standard file writing operations
- ❌ Not the right pattern for this use case

### ✅ Why Option 2 (Separate Tool)?
- ✅ Clear separation of concerns (SRP)
- ✅ Can write ANY content, not just generated configs
- ✅ Easier to test file I/O in isolation
- ✅ Security logic is contained and focused
- ✅ Can be enabled/disabled independently
- ✅ Follows Unix philosophy: do one thing well

## 📐 Architecture Design

### File Structure
```
src/
  terragrunt/
    file-writer.ts          # NEW: Core file writing logic
    config.ts               # UPDATED: Add file writing config
  handlers/
    tools.ts                # UPDATED: Add new tool
  types/
    file-writer.ts          # NEW: Type definitions

test/
  unit/
    file-writer.test.ts     # NEW: Unit tests
  integration/
    file-writing.test.ts    # NEW: Integration tests
```

### Core Components

#### 1. FileWriter Class (`src/terragrunt/file-writer.ts`)

```typescript
interface FileWriteOptions {
  content: string;
  filePath: string;
  overwrite?: boolean;
  createBackup?: boolean;
  createParentDirs?: boolean;
}

interface FileWriteResult {
  success: boolean;
  filePath: string;        // Absolute path
  backupPath?: string;     // If backup created
  created: boolean;        // true if new file, false if updated
  message: string;
}

interface FileWriterConfig {
  enabled: boolean;
  allowedDirectories: string[];
  autoBackup: boolean;
  backupExtension: string;
  maxFileSize: number;
}

class FileWriter {
  constructor(config: FileWriterConfig);
  
  async writeFile(options: FileWriteOptions): Promise<FileWriteResult>;
  
  // Security methods
  private validatePath(filePath: string): void;
  private isPathAllowed(filePath: string): boolean;
  private detectPathTraversal(filePath: string): boolean;
  
  // File operations
  private async createBackup(filePath: string): Promise<string>;
  private async ensureParentDirectory(filePath: string): Promise<void>;
  private async checkWritePermissions(filePath: string): Promise<boolean>;
}
```

#### 2. MCP Tool Definition (`src/handlers/tools.ts`)

```typescript
{
  name: 'write_terragrunt_config',
  description: 'Write a Terragrunt configuration to a file with security validation',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The HCL configuration content to write'
      },
      filePath: {
        type: 'string',
        description: 'Path where the file should be written (relative or absolute)'
      },
      overwrite: {
        type: 'boolean',
        description: 'Allow overwriting existing files (default: false)',
        default: false
      },
      createBackup: {
        type: 'boolean',
        description: 'Create backup before overwriting (default: true)',
        default: true
      },
      createParentDirs: {
        type: 'boolean',
        description: 'Create parent directories if they don\'t exist (default: true)',
        default: true
      }
    },
    required: ['content', 'filePath']
  }
}
```

#### 3. Configuration (`mcp-config.json` or env vars)

```json
{
  "fileWriting": {
    "enabled": true,
    "allowedDirectories": [
      "${WORKSPACE}",
      "${HOME}/projects"
    ],
    "autoBackup": true,
    "backupExtension": ".backup",
    "maxFileSize": 1048576
  }
}
```

## 🔒 Security Implementation

### Path Validation Chain
1. ✅ Normalize path with `path.resolve()`
2. ✅ Check for path traversal patterns (`../`, `..\\`)
3. ✅ Verify path is within allowed directories
4. ✅ Check write permissions
5. ✅ Validate file doesn't exceed max size

### Security Tests Required
- [ ] Path traversal attack prevention
- [ ] Write outside allowed directories
- [ ] Overwrite protection
- [ ] Permission denied handling
- [ ] Invalid path handling
- [ ] Symlink attack prevention

## 📝 Implementation Steps

### Phase 1: Core Implementation (Day 1)
1. **Create FileWriter class**
   - [ ] Basic file writing logic
   - [ ] Path validation
   - [ ] Error handling
   
2. **Add security features**
   - [ ] Path normalization
   - [ ] Allowed directory validation
   - [ ] Path traversal detection
   
3. **Implement backup system**
   - [ ] Create backups before overwrite
   - [ ] Custom backup extension
   - [ ] Backup cleanup (optional)

### Phase 2: MCP Integration (Day 1)
4. **Update ToolHandler**
   - [ ] Add write_terragrunt_config tool schema
   - [ ] Wire to FileWriter
   - [ ] Error handling and responses
   
5. **Add configuration system**
   - [ ] Load config from file/env
   - [ ] Default configuration
   - [ ] Validate configuration

### Phase 3: Testing (Day 2)
6. **Unit tests**
   - [ ] Path validation tests
   - [ ] Security tests
   - [ ] Backup tests
   - [ ] Error handling tests
   
7. **Integration tests**
   - [ ] End-to-end file writing
   - [ ] Generate + write workflow
   - [ ] Permission scenarios
   
8. **MCP protocol tests**
   - [ ] Tool schema validation
   - [ ] Response format validation

### Phase 4: Documentation (Day 2)
9. **Update documentation**
   - [ ] Tool usage guide
   - [ ] Security configuration
   - [ ] Examples
   - [ ] Best practices

## 🧪 Test Cases

### Unit Tests (~15 tests)
- ✅ Write new file successfully
- ✅ Overwrite with permission
- ✅ Refuse overwrite without permission
- ✅ Create backup before overwrite
- ✅ Create parent directories
- ✅ Detect path traversal attempts
- ✅ Block writes outside allowed dirs
- ✅ Handle permission denied
- ✅ Handle disk full
- ✅ Validate file paths
- ✅ Handle invalid paths
- ✅ Check max file size
- ✅ Normalize paths correctly
- ✅ Handle symlinks safely
- ✅ UTF-8 encoding

### Integration Tests (~5 tests)
- ✅ Generate config and write to file
- ✅ Write multiple configs
- ✅ Disabled file writing returns error
- ✅ Allowed directory configuration
- ✅ Backup and restore

## 📊 API Examples

### Example 1: Write new file
```typescript
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "content": "remote_state { backend = \"s3\" }",
    "filePath": "./terragrunt.hcl"
  }
}

// Response
{
  "success": true,
  "filePath": "/absolute/path/to/terragrunt.hcl",
  "created": true,
  "message": "File created successfully"
}
```

### Example 2: Update with backup
```typescript
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "content": "remote_state { backend = \"gcs\" }",
    "filePath": "./terragrunt.hcl",
    "overwrite": true,
    "createBackup": true
  }
}

// Response
{
  "success": true,
  "filePath": "/absolute/path/to/terragrunt.hcl",
  "backupPath": "/absolute/path/to/terragrunt.hcl.backup",
  "created": false,
  "message": "File updated successfully (backup created)"
}
```

### Example 3: Security rejection
```typescript
{
  "tool": "write_terragrunt_config",
  "arguments": {
    "content": "malicious content",
    "filePath": "../../etc/passwd"
  }
}

// Response
{
  "success": false,
  "error": "Path validation failed: Path traversal detected",
  "message": "Security: Writing outside allowed directories is not permitted"
}
```

## ⚠️ Error Scenarios

| Scenario | Error Message | HTTP Status Equivalent |
|----------|--------------|----------------------|
| Path traversal | "Path validation failed: Path traversal detected" | 400 Bad Request |
| Outside allowed dirs | "Path is outside allowed directories" | 403 Forbidden |
| Permission denied | "Permission denied: Cannot write to {path}" | 403 Forbidden |
| File exists, no overwrite | "File exists and overwrite=false" | 409 Conflict |
| Invalid path | "Invalid file path: {reason}" | 400 Bad Request |
| Disk full | "Disk full: Cannot write file" | 507 Insufficient Storage |
| File writing disabled | "File writing is disabled in configuration" | 403 Forbidden |

## 🔧 Configuration Reference

### Environment Variables
```bash
TERRAGRUNT_MCP_FILE_WRITE_ENABLED=true
TERRAGRUNT_MCP_ALLOWED_DIRS=/home/user/projects,/workspace
TERRAGRUNT_MCP_AUTO_BACKUP=true
TERRAGRUNT_MCP_MAX_FILE_SIZE=1048576
```

### Config File (mcp-config.json)
```json
{
  "fileWriting": {
    "enabled": true,
    "allowedDirectories": [
      "/home/user/projects",
      "/workspace",
      "${CWD}"
    ],
    "autoBackup": true,
    "backupExtension": ".backup",
    "maxFileSize": 1048576
  }
}
```

### Special Path Variables
- `${WORKSPACE}` - VS Code workspace root
- `${HOME}` - User home directory
- `${CWD}` - Current working directory

## 📅 Timeline

- **Day 1 AM**: FileWriter class + security
- **Day 1 PM**: MCP tool integration + config
- **Day 2 AM**: Unit tests + integration tests
- **Day 2 PM**: Documentation + polish

**Total Effort**: 1.5-2 days

## 🎯 Success Criteria

- [ ] FileWriter class with comprehensive security
- [ ] write_terragrunt_config tool in ToolHandler
- [ ] Configuration system for allowed directories
- [ ] 15+ unit tests, all passing
- [ ] 5+ integration tests, all passing
- [ ] Security tests prove path traversal prevention
- [ ] Documentation complete with examples
- [ ] Backward compatible (optional feature)
- [ ] Can be disabled via configuration
- [ ] Works with both relative and absolute paths
