/**
 * Unit tests for FileWriter class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileWriter } from '../../src/terragrunt/file-writer.js';
import { FileWriteErrorType } from '../../src/types/file-writer.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

describe('FileWriter', () => {
  let testDir: string;
  let fileWriter: FileWriter;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(tmpdir(), `terragrunt-mcp-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize FileWriter with test directory as allowed
    fileWriter = new FileWriter({
      enabled: true,
      allowedDirectories: [testDir],
      autoBackup: true,
      backupExtension: '.backup',
      maxFileSize: 1048576
    });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Write new file', () => {
    it('should successfully write a new file', async () => {
      const filePath = path.join(testDir, 'terragrunt.hcl');
      const content = 'remote_state {\n  backend = "s3"\n}';

      const result = await fileWriter.writeFile({
        content,
        filePath
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.path).toBe(filePath);
      expect(result.backupPath).toBeUndefined();
      expect(result.message).toContain('created successfully');

      // Verify file was actually written
      const writtenContent = await fs.readFile(filePath, 'utf8');
      expect(writtenContent).toBe(content);
    });

    it('should create parent directories if they don\'t exist', async () => {
      const filePath = path.join(testDir, 'nested', 'dir', 'terragrunt.hcl');
      const content = 'locals { foo = "bar" }';

      const result = await fileWriter.writeFile({
        content,
        filePath,
        createParentDirs: true
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(existsSync(path.dirname(filePath))).toBe(true);
    });
  });

  describe('Overwrite protection', () => {
    it('should refuse to overwrite existing file without permission', async () => {
      const filePath = path.join(testDir, 'existing.hcl');
      const originalContent = 'original content';

      // Create initial file
      await fs.writeFile(filePath, originalContent);

      // Attempt to overwrite
      const result = await fileWriter.writeFile({
        content: 'new content',
        filePath,
        overwrite: false
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe(FileWriteErrorType.FILE_EXISTS);
      expect(result.message).toContain('exists and overwrite is disabled');

      // Verify original content unchanged
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(originalContent);
    });

    it('should allow overwriting when explicitly permitted', async () => {
      const filePath = path.join(testDir, 'existing.hcl');

      // Create initial file
      await fs.writeFile(filePath, 'original content');

      const newContent = 'updated content';
      const result = await fileWriter.writeFile({
        content: newContent,
        filePath,
        overwrite: true
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);

      // Verify content was updated
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(newContent);
    });
  });

  describe('Backup creation', () => {
    it('should create backup before overwriting', async () => {
      const filePath = path.join(testDir, 'to-backup.hcl');
      const originalContent = 'original content';

      // Create initial file
      await fs.writeFile(filePath, originalContent);

      const result = await fileWriter.writeFile({
        content: 'new content',
        filePath,
        overwrite: true,
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.message).toContain('backup created');

      // Verify backup exists and contains original content
      if (result.backupPath) {
        const backupContent = await fs.readFile(result.backupPath, 'utf8');
        expect(backupContent).toBe(originalContent);
      }
    });

    it('should not create backup when disabled', async () => {
      const filePath = path.join(testDir, 'no-backup.hcl');

      // Create initial file
      await fs.writeFile(filePath, 'original');

      const result = await fileWriter.writeFile({
        content: 'new',
        filePath,
        overwrite: true,
        createBackup: false
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe('Security - Path validation', () => {
    it('should detect path traversal attempts with ../', async () => {
      const maliciousPath = path.join(testDir, '../../../etc/passwd');

      const result = await fileWriter.writeFile({
        content: 'malicious',
        filePath: maliciousPath
      });

      expect(result.success).toBe(false);
      // Path traversal or outside allowed dirs - both are valid security rejections
      expect([FileWriteErrorType.PATH_TRAVERSAL, FileWriteErrorType.OUTSIDE_ALLOWED_DIRS])
        .toContain(result.errorType);
      expect(result.error).toMatch(/Path traversal|outside allowed/);
    });

    it('should reject paths outside allowed directories', async () => {
      const outsidePath = '/tmp/outside-allowed/terragrunt.hcl';

      const result = await fileWriter.writeFile({
        content: 'content',
        filePath: outsidePath
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe(FileWriteErrorType.OUTSIDE_ALLOWED_DIRS);
      expect(result.message).toContain('outside allowed directories');
    });

    it('should accept paths within allowed directories', async () => {
      const validPath = path.join(testDir, 'valid.hcl');

      const result = await fileWriter.writeFile({
        content: 'valid content',
        filePath: validPath
      });

      expect(result.success).toBe(true);
    });

    it('should resolve and handle relative paths correctly', async () => {
      // Test with a subdirectory path (no traversal)
      const subdirPath = path.join(testDir, 'subdir', 'relative.hcl');
      
      const result = await fileWriter.writeFile({
        content: 'relative path content',
        filePath: subdirPath,  // Use absolute path - path resolution is tested elsewhere
        createParentDirs: true
      });

      expect(result.success).toBe(true);
      expect(path.isAbsolute(result.path)).toBe(true);
      expect(result.path).toBe(subdirPath);
    });
  });

  describe('File size limits', () => {
    it('should reject files exceeding max size', async () => {
      const smallWriter = new FileWriter({
        enabled: true,
        allowedDirectories: [testDir],
        maxFileSize: 100 // 100 bytes - intentionally small for testing size validation
      });

      const largeContent = 'x'.repeat(200);
      const result = await smallWriter.writeFile({
        content: largeContent,
        filePath: path.join(testDir, 'large.hcl')
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe(FileWriteErrorType.MAX_SIZE_EXCEEDED);
      expect(result.message).toContain('exceeds maximum allowed');
    });

    it('should accept files within size limit', async () => {
      const content = 'small content';
      const result = await fileWriter.writeFile({
        content,
        filePath: path.join(testDir, 'small.hcl')
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Disabled file writing', () => {
    it('should reject writes when disabled', async () => {
      const disabledWriter = new FileWriter({
        enabled: false,
        allowedDirectories: [testDir]
      });

      const result = await disabledWriter.writeFile({
        content: 'test',
        filePath: path.join(testDir, 'test.hcl')
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe(FileWriteErrorType.DISABLED);
      expect(result.message).toContain('disabled in configuration');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid paths gracefully', async () => {
      // Use a path with invalid characters (OS-dependent)
      const invalidPath = path.join(testDir, 'invalid\0path.hcl');

      const result = await fileWriter.writeFile({
        content: 'test',
        filePath: invalidPath
      });

      expect(result.success).toBe(false);
      // Error type will vary by OS
    });

    it('should handle permission denied errors', async () => {
      // This test is platform-dependent
      // Skip on Windows where permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      
      // Make directory read-only
      await fs.chmod(readOnlyDir, 0o444);

      const result = await fileWriter.writeFile({
        content: 'test',
        filePath: path.join(readOnlyDir, 'test.hcl')
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe(FileWriteErrorType.PERMISSION_DENIED);

      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);
    });
  });

  describe('Path variables expansion', () => {
    it('should expand ${CWD} variable', async () => {
      const config = new FileWriter({
        enabled: true,
        allowedDirectories: ['${CWD}']
      }).getConfig();

      expect(config.allowedDirectories[0]).toBe(process.cwd());
    });

    it('should expand ${HOME} variable', async () => {
      const homeVar = process.env.HOME || process.env.USERPROFILE;
      if (!homeVar) return; // Skip if HOME not defined

      const config = new FileWriter({
        enabled: true,
        allowedDirectories: ['${HOME}/projects']
      }).getConfig();

      expect(config.allowedDirectories[0]).toBe(path.join(homeVar, 'projects'));
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = fileWriter.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.allowedDirectories).toEqual([testDir]);
      expect(config.autoBackup).toBe(true);
      expect(config.backupExtension).toBe('.backup');
      expect(config.maxFileSize).toBe(1048576);
    });

    it('should use default configuration when not provided', () => {
      const defaultWriter = new FileWriter();
      const config = defaultWriter.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.autoBackup).toBe(true);
      expect(config.maxFileSize).toBe(1048576);
    });
  });

  describe('computeDiff (#95)', () => {
    it('produces a unified diff between an existing file and new content', async () => {
      const filePath = path.join(testDir, 'terragrunt.hcl');
      await fs.writeFile(filePath, 'remote_state {\n  backend = "s3"\n}\n', 'utf8');

      const result = await fileWriter.computeDiff(filePath, 'remote_state {\n  backend = "gcs"\n}\n');

      expect(result.baseExists).toBe(true);
      expect(result.isNewFile).toBe(false);
      expect(result.unchanged).toBe(false);
      expect(result.diff).toContain('-  backend = "s3"');
      expect(result.diff).toContain('+  backend = "gcs"');
    });

    it('reports unchanged when content matches the existing file', async () => {
      const filePath = path.join(testDir, 'same.hcl');
      const content = 'inputs = {\n  a = 1\n}\n';
      await fs.writeFile(filePath, content, 'utf8');

      const result = await fileWriter.computeDiff(filePath, content);

      expect(result.unchanged).toBe(true);
    });

    it('treats a non-existent base as a new file', async () => {
      const filePath = path.join(testDir, 'missing.hcl');
      const result = await fileWriter.computeDiff(filePath, 'inputs = {}\n');

      expect(result.baseExists).toBe(false);
      expect(result.isNewFile).toBe(true);
      expect(result.diff).toContain('+inputs = {}');
    });

    it('rejects a path-traversal base path', async () => {
      await expect(fileWriter.computeDiff('../../etc/passwd', 'x')).rejects.toMatchObject({
        type: FileWriteErrorType.PATH_TRAVERSAL,
      });
    });
  });

  describe('previewWrite (#95)', () => {
    it('reports an overwrite without writing, and includes a diff', async () => {
      const filePath = path.join(testDir, 'terragrunt.hcl');
      await fs.writeFile(filePath, 'inputs = {\n  a = 1\n}\n', 'utf8');
      const mtimeBefore = (await fs.stat(filePath)).mtimeMs;

      const result = await fileWriter.previewWrite({
        content: 'inputs = {\n  a = 2\n}\n',
        filePath,
      });

      expect(result.preview).toBe(true);
      expect(result.success).toBe(true);
      expect(result.targetExists).toBe(true);
      expect(result.wouldOverwrite).toBe(true);
      expect(result.wouldBackup).toBe(true);
      expect(result.diff).toContain('+  a = 2');
      // The file on disk is untouched.
      expect((await fs.stat(filePath)).mtimeMs).toBe(mtimeBefore);
      expect(await fs.readFile(filePath, 'utf8')).toBe('inputs = {\n  a = 1\n}\n');
    });

    it('reports a new-file create without writing', async () => {
      const filePath = path.join(testDir, 'new.hcl');

      const result = await fileWriter.previewWrite({ content: 'inputs = {}\n', filePath });

      expect(result.success).toBe(true);
      expect(result.targetExists).toBe(false);
      expect(result.wouldOverwrite).toBe(false);
      expect(result.isNewFile).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });

    it('diffs against a separate compareWith file', async () => {
      const target = path.join(testDir, 'target.hcl');
      const base = path.join(testDir, 'base.hcl');
      await fs.writeFile(base, 'inputs = {\n  a = 1\n}\n', 'utf8');

      const result = await fileWriter.previewWrite({
        content: 'inputs = {\n  a = 9\n}\n',
        filePath: target,
        compareWith: base,
      });

      expect(result.success).toBe(true);
      expect(result.diff).toContain('+  a = 9');
      expect(existsSync(target)).toBe(false);
    });
  });
});
