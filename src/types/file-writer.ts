/**
 * Type definitions for file writing operations
 */

/**
 * Options for writing a file
 */
export interface FileWriteOptions {
  /** The content to write to the file */
  content: string;
  
  /** Path where the file should be written (relative or absolute) */
  filePath: string;
  
  /** Allow overwriting existing files (default: false) */
  overwrite?: boolean;
  
  /** Create a backup before overwriting (default: true) */
  createBackup?: boolean;
  
  /** Create parent directories if they don't exist (default: true) */
  createParentDirs?: boolean;
}

/**
 * Result of a file write operation
 */
export interface FileWriteResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Absolute path to the written file */
  filePath: string;
  
  /** Absolute path to the backup file (if created) */
  backupPath?: string;
  
  /** True if a new file was created, false if an existing file was updated */
  created: boolean;
  
  /** Human-readable message about the operation */
  message: string;
  
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Configuration for the FileWriter
 */
export interface FileWriterConfig {
  /** Whether file writing is enabled (default: true) */
  enabled: boolean;
  
  /** List of allowed directories where files can be written */
  allowedDirectories: string[];
  
  /** Automatically create backups before overwriting (default: true) */
  autoBackup: boolean;
  
  /** File extension for backup files (default: '.backup') */
  backupExtension: string;
  
  /** Maximum file size in bytes (default: 1MB) */
  maxFileSize: number;
}

/**
 * Error types for file writing operations
 */
export enum FileWriteErrorType {
  DISABLED = 'FILE_WRITING_DISABLED',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL_DETECTED',
  OUTSIDE_ALLOWED_DIRS = 'OUTSIDE_ALLOWED_DIRECTORIES',
  FILE_EXISTS = 'FILE_EXISTS_NO_OVERWRITE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_PATH = 'INVALID_PATH',
  MAX_SIZE_EXCEEDED = 'MAX_SIZE_EXCEEDED',
  DISK_FULL = 'DISK_FULL',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * Custom error class for file writing operations
 */
export class FileWriteError extends Error {
  constructor(
    public readonly type: FileWriteErrorType,
    message: string,
    public readonly filePath?: string
  ) {
    super(message);
    this.name = 'FileWriteError';
  }
}
