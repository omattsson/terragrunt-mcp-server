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
import {
  FileWriteOptions,
  FileWriteResult,
  FileWriterConfig,
  FileWriteError,
  FileWriteErrorType
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

      // Set appropriate permissions (readable/writable by owner)
      await fs.chmod(absolutePath, 0o644);

      return {
        success: true,
        filePath: absolutePath,
        backupPath,
        created: !fileExists,
        message: fileExists
          ? `File updated successfully${backupPath ? ' (backup created)' : ''}`
          : 'File created successfully'
      };

    } catch (error) {
      if (error instanceof FileWriteError) {
        return {
          success: false,
          filePath: error.filePath || options.filePath,
          created: false,
          message: error.message,
          error: error.type
        };
      }

      // Handle Node.js file system errors
      const nodeError = error as NodeJS.ErrnoException;
      let errorType = FileWriteErrorType.UNKNOWN;
      let errorMessage = 'Unknown error occurred';

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
        filePath: options.filePath,
        created: false,
        message: errorMessage,
        error: errorType
      };
    }
  }

  /**
   * Validate that a path is safe to write to
   */
  private validatePath(absolutePath: string): void {
    // Check for path traversal
    if (this.detectPathTraversal(absolutePath)) {
      throw new FileWriteError(
        FileWriteErrorType.PATH_TRAVERSAL,
        'Path validation failed: Path traversal detected',
        absolutePath
      );
    }

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
   * Detect path traversal attempts
   */
  private detectPathTraversal(absolutePath: string): boolean {
    // Check for path traversal patterns
    const traversalPatterns = [
      /\.\.[/\\]/,  // ../ or ..\
      /[/\\]\.\./,  // /.. or \..
      /\.\.$/, // Ends with ..
    ];

    // Also check the normalized path - if it goes outside CWD, it's suspicious
    const normalizedPath = path.normalize(absolutePath);
    
    return traversalPatterns.some(pattern => pattern.test(absolutePath)) ||
           traversalPatterns.some(pattern => pattern.test(normalizedPath));
  }

  /**
   * Create a backup of an existing file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}${this.config.backupExtension}.${timestamp}`;
    
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
