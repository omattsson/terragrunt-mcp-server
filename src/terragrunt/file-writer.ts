/**
 * FileWriter - Secure file writing operations for Terragrunt configurations
 * 
 * This module provides safe file writing with:
 * - Path validation and security checks
 * - Directory whitelisting
 * - Automatic backups
 * - Path traversal prevention
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { createPatch } from 'diff';
import {
  FileWriteOptions,
  FileWriteResult,
  FileWriterConfig,
  FileWriteError,
  FileWriteErrorType,
  FilePreviewOptions,
  DiffResult,
  WritePreviewResult
} from '../types/file-writer.js';

/**
 * Default configuration for FileWriter
 */
const DEFAULT_CONFIG: FileWriterConfig = {
  enabled: true,
  allowedDirectories: [process.cwd()], // Default to current working directory
  autoBackup: true,
  backupExtension: '.backup',
  maxFileSize: 1048576 // 1MB
};

/**
 * FileWriter class - Handles secure file writing operations
 */
export class FileWriter {
  private config: FileWriterConfig;

  constructor(config?: Partial<FileWriterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Resolve allowed directories to absolute paths
    this.config.allowedDirectories = this.config.allowedDirectories.map(dir =>
      path.resolve(this.expandPathVariables(dir))
    );
  }

  /**
   * Write content to a file with security validation
   */
  async writeFile(options: FileWriteOptions): Promise<FileWriteResult> {
    try {
      // Check if file writing is enabled
      if (!this.config.enabled) {
        throw new FileWriteError(
          FileWriteErrorType.DISABLED,
          'File writing is disabled in configuration'
        );
      }

      // Set defaults
      const overwrite = options.overwrite ?? false;
      const createBackup = options.createBackup ?? this.config.autoBackup;
      const createParentDirs = options.createParentDirs ?? true;

      // Validate content size
      const contentSize = Buffer.byteLength(options.content, 'utf8');
      if (contentSize > this.config.maxFileSize) {
        throw new FileWriteError(
          FileWriteErrorType.MAX_SIZE_EXCEEDED,
          `File size (${contentSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
          options.filePath
        );
      }

      // Check for path traversal in the original path BEFORE resolution
      if (this.detectPathTraversal(options.filePath)) {
        throw new FileWriteError(
          FileWriteErrorType.PATH_TRAVERSAL,
          'Path validation failed: Path traversal detected',
          options.filePath
        );
      }

      // Resolve and validate the file path
      const absolutePath = path.resolve(options.filePath);
      this.validatePath(absolutePath);

      // Check if file exists
      const fileExists = existsSync(absolutePath);
      
      // Handle existing file
      if (fileExists && !overwrite) {
        throw new FileWriteError(
          FileWriteErrorType.FILE_EXISTS,
          `File exists and overwrite is disabled: ${absolutePath}`,
          absolutePath
        );
      }

      // Create parent directories if needed
      if (createParentDirs) {
        await this.ensureParentDirectory(absolutePath);
      }

      // Create backup if overwriting
      let backupPath: string | undefined;
      if (fileExists && createBackup) {
        backupPath = await this.createBackup(absolutePath);
      }

      // Write the file
      await fs.writeFile(absolutePath, options.content, 'utf8');

      // Set appropriate permissions (readable/writable by owner, Unix only)
      if (process.platform !== 'win32') {
        await fs.chmod(absolutePath, 0o644);
      }

      return {
        success: true,
        path: absolutePath,
        bytesWritten: contentSize,
        backupPath,
        created: !fileExists,
        backedUp: !!backupPath,
        message: fileExists
          ? `File updated successfully${backupPath ? ' (backup created)' : ''}`
          : 'File created successfully'
      };

    } catch (error) {
      if (error instanceof FileWriteError) {
        return {
          success: false,
          path: error.filePath || options.filePath,
          bytesWritten: 0,
          created: false,
          backedUp: false,
          message: error.message,
          error: error.message,
          errorType: error.type
        };
      }

      // Handle Node.js file system errors
      const nodeError = error as NodeJS.ErrnoException;
      let errorType = FileWriteErrorType.UNKNOWN;
      let errorMessage: string;

      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        errorType = FileWriteErrorType.PERMISSION_DENIED;
        errorMessage = `Permission denied: Cannot write to ${options.filePath}`;
      } else if (nodeError.code === 'ENOSPC') {
        errorType = FileWriteErrorType.DISK_FULL;
        errorMessage = 'Disk full: Cannot write file';
      } else if (nodeError.code === 'ENOENT') {
        errorType = FileWriteErrorType.INVALID_PATH;
        errorMessage = `Invalid file path: ${options.filePath}`;
      } else {
        errorMessage = nodeError.message || 'Unknown error occurred';
      }

      return {
        success: false,
        path: options.filePath,
        bytesWritten: 0,
        created: false,
        backedUp: false,
        message: errorMessage,
        error: errorMessage,
        errorType: errorType
      };
    }
  }

  /**
   * Compute a unified diff of an existing file against new content, without
   * writing anything. Reads are subject to the same path-traversal and
   * allowed-directory checks as writes, so arbitrary files cannot be read.
   *
   * A non-existent base file is treated as a new file (the diff is all
   * additions), not an error. A traversal or out-of-allowlist path is an error.
   *
   * @param basePath Path of the existing file to compare against
   * @param newContent The content that would be written
   * @returns The unified diff and metadata about the base file
   */
  async computeDiff(basePath: string, newContent: string): Promise<DiffResult> {
    if (this.detectPathTraversal(basePath)) {
      throw new FileWriteError(
        FileWriteErrorType.PATH_TRAVERSAL,
        'Path validation failed: Path traversal detected',
        basePath
      );
    }

    const absoluteBase = path.resolve(basePath);
    this.validatePath(absoluteBase);

    const baseExists = existsSync(absoluteBase);
    const baseContent = baseExists ? await fs.readFile(absoluteBase, 'utf8') : '';
    const label = path.basename(absoluteBase);
    const unchanged = baseExists && baseContent === newContent;

    const diff = createPatch(
      label,
      baseContent,
      newContent,
      baseExists ? 'existing' : 'new file',
      'generated'
    );

    return {
      diff,
      basePath: absoluteBase,
      baseExists,
      isNewFile: !baseExists,
      unchanged
    };
  }

  /**
   * Preview a write (dry-run): run the same validation as writeFile and report
   * what would happen, without writing. Optionally include a unified diff
   * against an existing file (compareWith, defaulting to the target path).
   *
   * @param options Write options plus an optional compareWith path
   * @returns What the write would do, and the diff when a base was compared
   */
  async previewWrite(options: FilePreviewOptions): Promise<WritePreviewResult> {
    try {
      if (!this.config.enabled) {
        throw new FileWriteError(
          FileWriteErrorType.DISABLED,
          'File writing is disabled in configuration'
        );
      }

      const createBackup = options.createBackup ?? this.config.autoBackup;

      const contentSize = Buffer.byteLength(options.content, 'utf8');
      if (contentSize > this.config.maxFileSize) {
        throw new FileWriteError(
          FileWriteErrorType.MAX_SIZE_EXCEEDED,
          `File size (${contentSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
          options.filePath
        );
      }

      if (this.detectPathTraversal(options.filePath)) {
        throw new FileWriteError(
          FileWriteErrorType.PATH_TRAVERSAL,
          'Path validation failed: Path traversal detected',
          options.filePath
        );
      }

      const absolutePath = path.resolve(options.filePath);
      this.validatePath(absolutePath);

      const targetExists = existsSync(absolutePath);
      const base = options.compareWith ?? options.filePath;
      const diffResult = await this.computeDiff(base, options.content);

      return {
        preview: true,
        success: true,
        targetPath: absolutePath,
        targetExists,
        wouldOverwrite: targetExists,
        wouldBackup: targetExists && createBackup,
        bytesToWrite: contentSize,
        diff: diffResult.diff,
        isNewFile: diffResult.isNewFile,
        unchanged: diffResult.unchanged,
        message: diffResult.unchanged
          ? 'No changes: the generated content matches the existing file'
          : targetExists
            ? `Would overwrite ${absolutePath}${targetExists && createBackup ? ' (backup would be created)' : ''}`
            : `Would create ${absolutePath}`
      };
    } catch (error) {
      const isFwError = error instanceof FileWriteError;
      const message = error instanceof Error ? error.message : 'Failed to preview write';
      return {
        preview: true,
        success: false,
        targetPath: path.resolve(options.filePath),
        targetExists: false,
        wouldOverwrite: false,
        wouldBackup: false,
        bytesToWrite: 0,
        message,
        error: message,
        errorType: isFwError ? (error as FileWriteError).type : FileWriteErrorType.UNKNOWN
      };
    }
  }

  /**
   * Validate that a path is safe to write to
   */
  private validatePath(absolutePath: string): void {
    // Check if path is within allowed directories
    if (!this.isPathAllowed(absolutePath)) {
      throw new FileWriteError(
        FileWriteErrorType.OUTSIDE_ALLOWED_DIRS,
        `Path is outside allowed directories: ${absolutePath}\nAllowed directories: ${this.config.allowedDirectories.join(', ')}`,
        absolutePath
      );
    }
  }

  /**
   * Check if a path is within allowed directories
   */
  private isPathAllowed(absolutePath: string): boolean {
    // Normalize the path for comparison
    const normalizedPath = path.normalize(absolutePath);

    return this.config.allowedDirectories.some(allowedDir => {
      const normalizedAllowed = path.normalize(allowedDir);
      
      // Check if the path starts with the allowed directory
      // Add path separator to prevent partial matches (e.g., /home/user vs /home/user2)
      return normalizedPath === normalizedAllowed ||
             normalizedPath.startsWith(normalizedAllowed + path.sep);
    });
  }

  /**
   * Detect path traversal attempts in the original (unresolved) path
   */
  private detectPathTraversal(originalPath: string): boolean {
    // Check for path traversal patterns in the original path
    const traversalPatterns = [
      /\.\.[/\\]/,  // ../ or ..\
      /[/\\]\.\./,  // /.. or \..
      /\.\.$/, // Ends with ..
    ];
    
    return traversalPatterns.some(pattern => pattern.test(originalPath));
  }

  /**
   * Create a backup of an existing file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(7);
    const backupPath = `${filePath}${this.config.backupExtension}.${timestamp}-${randomSuffix}`;
    
    await fs.copyFile(filePath, backupPath);
    
    return backupPath;
  }

  /**
   * Ensure the parent directory exists
   */
  private async ensureParentDirectory(filePath: string): Promise<void> {
    const parentDir = path.dirname(filePath);
    
    // Check if parent directory is also within allowed directories
    if (!this.isPathAllowed(parentDir)) {
      throw new FileWriteError(
        FileWriteErrorType.OUTSIDE_ALLOWED_DIRS,
        `Parent directory is outside allowed directories: ${parentDir}`,
        filePath
      );
    }

    await fs.mkdir(parentDir, { recursive: true });
  }

  /**
   * Expand path variables like ${HOME}, ${CWD}, ${WORKSPACE}
   */
  private expandPathVariables(pathStr: string): string {
    return pathStr
      .replace(/\$\{HOME\}/g, process.env.HOME || process.env.USERPROFILE || '')
      .replace(/\$\{CWD\}/g, process.cwd())
      .replace(/\$\{WORKSPACE\}/g, process.env.WORKSPACE || process.cwd());
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<FileWriterConfig> {
    return { ...this.config };
  }
}
