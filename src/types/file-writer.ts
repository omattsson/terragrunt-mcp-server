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
  path: string;
  
  /** Number of bytes written */
  bytesWritten: number;
  
  /** Absolute path to the backup file (if created) */
  backupPath?: string;
  
  /** True if a new file was created, false if an existing file was updated */
  created: boolean;
  
  /** True if a backup was created */
  backedUp: boolean;
  
  /** Human-readable message about the operation */
  message?: string;
  
  /** Error message if the operation failed */
  error?: string;
  
  /** Error type if the operation failed */
  errorType?: string;
}

/**
 * Options for previewing a write (dry-run) with an optional diff.
 */
export interface FilePreviewOptions extends FileWriteOptions {
  /** Path of an existing file to diff the content against (defaults to filePath) */
  compareWith?: string;
}

/**
 * Result of a diff computation against an existing file.
 */
export interface DiffResult {
  /** Unified diff of the base file against the new content */
  diff: string;
  /** Absolute path of the base file that was compared against */
  basePath: string;
  /** Whether the base file exists on disk */
  baseExists: boolean;
  /** True when the base file does not exist (diff is all additions) */
  isNewFile: boolean;
  /** True when the new content is identical to the base file */
  unchanged: boolean;
}

/**
 * Result of a preview (dry-run) write operation. No file is written.
 */
export interface WritePreviewResult {
  /** Always true — marks this as a preview result */
  preview: true;
  /** Whether the preview validation succeeded */
  success: boolean;
  /** Absolute path the content would be written to */
  targetPath: string;
  /** Whether the target file already exists */
  targetExists: boolean;
  /** Whether writing would overwrite an existing file */
  wouldOverwrite: boolean;
  /** Whether writing would create a backup first */
  wouldBackup: boolean;
  /** Number of bytes the content would write */
  bytesToWrite: number;
  /** Unified diff against the base file, when a base was compared */
  diff?: string;
  /** True when the target/base does not exist (a new file) */
  isNewFile?: boolean;
  /** True when the content matches the base file (no changes) */
  unchanged?: boolean;
  /** Human-readable message */
  message?: string;
  /** Error message if preview validation failed */
  error?: string;
  /** Error type if preview validation failed */
  errorType?: string;
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
