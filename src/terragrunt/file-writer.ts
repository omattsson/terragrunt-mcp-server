/**
 * FileWriter - Secure file writing operations for Terragrunt configurations
 *
 * This module provides safe file writing with:
 * - Path validation and security checks
 * - Directory whitelisting (explicit; no default)
 * - File type allowlist (.hcl by default) and no dot-file/dot-directory targets
 * - Symlink escape prevention
 * - Automatic backups
 * - Path traversal prevention
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { constants as fsConstants, Stats } from 'fs';
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
  allowedDirectories: [], // No default: writes require an explicit allowlist
  allowedExtensions: ['.hcl'],
  autoBackup: true,
  backupExtension: '.backup',
  maxFileSize: 1048576 // 1MB
};

/** Mode for newly created files; the process umask still applies */
const NEW_FILE_MODE = 0o644;

/** Refuse to follow a symlink at the final path component (unavailable on Windows) */
const NO_FOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/**
 * Open flags for writing: read-write (the backup is read from the same handle),
 * create if missing, no symlink at the final component. The file is not
 * truncated on open, so it can be verified and backed up through the handle first.
 */
const WRITE_FLAGS = fsConstants.O_RDWR | fsConstants.O_CREAT | NO_FOLLOW;

/** Open flags for a new backup file: never replace or follow an existing entry */
const BACKUP_FLAGS = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | NO_FOLLOW;

/**
 * FileWriter class - Handles secure file writing operations
 */
export class FileWriter {
  private config: FileWriterConfig;

  constructor(config?: Partial<FileWriterConfig>) {
    // Ignore undefined values so they cannot override defaults
    const provided = Object.fromEntries(
      Object.entries(config ?? {}).filter(([, value]) => value !== undefined)
    ) as Partial<FileWriterConfig>;
    this.config = { ...DEFAULT_CONFIG, ...provided };

    // Resolve allowed directories to absolute paths, refusing filesystem roots
    this.config.allowedDirectories = this.config.allowedDirectories
      .map(dir => path.resolve(this.expandPathVariables(dir)))
      .filter(dir => {
        if (path.parse(dir).root === dir) {
          console.warn(`[FileWriter] Ignoring allowed directory ${dir}: a filesystem root cannot be an allowed directory`);
          return false;
        }
        return true;
      });

    const extensions = this.config.allowedExtensions
      .map(ext => ext.trim().toLowerCase())
      .filter(ext => ext.length > 0 && ext !== '.')
      .map(ext => (ext.startsWith('.') ? ext : `.${ext}`));
    // An empty list (e.g. a misparsed setting) falls back to the default
    this.config.allowedExtensions = extensions.length > 0 ? extensions : [...DEFAULT_CONFIG.allowedExtensions];
  }

  /**
   * Write content to a file with security validation
   */
  async writeFile(options: FileWriteOptions): Promise<FileWriteResult> {
    try {
      // Set defaults
      const overwrite = options.overwrite ?? false;
      const createBackup = options.createBackup ?? this.config.autoBackup;
      const createParentDirs = options.createParentDirs ?? true;

      this.assertAccessEnabled('File writing is disabled in configuration');

      // Validate content size
      const contentSize = Buffer.byteLength(options.content, 'utf8');
      if (contentSize > this.config.maxFileSize) {
        throw new FileWriteError(
          FileWriteErrorType.MAX_SIZE_EXCEEDED,
          `File size (${contentSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
          options.filePath
        );
      }

      // Resolve and validate the target path
      const absolutePath = await this.resolveWriteTarget(options.filePath);

      // Check if file exists (the target is never a symlink at this point)
      const fileExists = (await this.lstatOrNull(absolutePath)) !== null;

      // Handle existing file
      if (fileExists && !overwrite) {
        throw new FileWriteError(
          FileWriteErrorType.FILE_EXISTS,
          `File exists and overwrite is disabled: ${absolutePath}`,
          absolutePath
        );
      }

      // Create parent directories if needed, then re-check the real parent path
      // so a directory replaced by a symlink since validation is caught. A swap
      // between this check and open() remains possible; Node has no openat().
      if (createParentDirs) {
        await this.ensureParentDirectory(absolutePath);
        await this.validateRealPath(absolutePath);
      }

      // Open the file without truncating it. O_NOFOLLOW refuses a symlink at the
      // final component; O_EXCL makes creation atomic when the file did not
      // exist, so a file created since the check is never overwritten.
      // A new file gets NEW_FILE_MODE (minus umask); an existing file keeps its mode.
      let handle: fs.FileHandle;
      try {
        handle = await fs.open(absolutePath, WRITE_FLAGS | (fileExists ? 0 : fsConstants.O_EXCL), NEW_FILE_MODE);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new FileWriteError(
            FileWriteErrorType.FILE_EXISTS,
            `File was created by another process during the write; retry the request: ${absolutePath}`,
            absolutePath
          );
        }
        throw error;
      }

      // Verify and back up through the open handle before truncating, so a
      // hard link or symlink swapped in after validation can neither be
      // overwritten nor copied into a backup.
      let backupPath: string | undefined;
      try {
        const stat = await handle.stat();
        if (stat.nlink > 1) {
          throw this.hardLinkError(absolutePath);
        }
        if (fileExists && createBackup) {
          // The backup is read into memory, so it gets the same cap as diff reads
          if (stat.size > this.config.maxFileSize) {
            throw new FileWriteError(
              FileWriteErrorType.MAX_SIZE_EXCEEDED,
              `Existing file size (${stat.size} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes); cannot back it up`,
              absolutePath
            );
          }
          backupPath = await this.createBackup(absolutePath, handle, stat.size, stat.mode);
        }
        await handle.truncate(0);
        await this.writeAt(handle, Buffer.from(options.content, 'utf8'));
      } finally {
        await handle.close();
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
      } else if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
        // ENOTDIR: a component of the path is a regular file
        errorType = FileWriteErrorType.INVALID_PATH;
        errorMessage = `Invalid file path: ${options.filePath}`;
      } else if (nodeError.code === 'ELOOP') {
        // O_NOFOLLOW reports a final-component symlink as ELOOP; ELOOP also
        // covers a symlink loop elsewhere in the path.
        errorType = FileWriteErrorType.SYMLINK_NOT_ALLOWED;
        errorMessage = `Refusing to write: the path is a symlink or contains a symlink loop: ${options.filePath}`;
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
   * writing anything. Reads are subject to the same path-traversal,
   * allowed-directory and file-type checks as writes, so arbitrary files
   * (e.g. a .env in an allowed directory) cannot be read.
   *
   * A non-existent base file is treated as a new file (the diff is all
   * additions), not an error. A traversal or out-of-allowlist path is an error.
   *
   * @param basePath Path of the existing file to compare against
   * @param newContent The content that would be written
   * @returns The unified diff and metadata about the base file
   */
  async computeDiff(basePath: string, newContent: string): Promise<DiffResult> {
    // Diff reads go through the same capability gate as writes.
    this.assertAccessEnabled('File access is disabled in configuration');

    // Cap the new content too, so a large generated/provided input cannot blow
    // the heap during patch computation.
    const newSize = Buffer.byteLength(newContent, 'utf8');
    if (newSize > this.config.maxFileSize) {
      throw new FileWriteError(
        FileWriteErrorType.MAX_SIZE_EXCEEDED,
        `Content size (${newSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
        basePath
      );
    }

    const absoluteBase = this.resolveAndValidateLexically(basePath);

    const baseExists = (await this.lstatOrNull(absoluteBase)) !== null;
    let baseContent = '';
    if (baseExists) {
      // Resolve symlinks and re-validate the real path so a symlink inside an
      // allowed directory cannot leak a file outside the allowlist, or a file
      // type outside the allowlist. Both sides are canonicalized so a symlinked
      // allowed root (e.g. /var -> /private/var on macOS) does not reject
      // legitimate files.
      let realBase: string;
      try {
        realBase = await fs.realpath(absoluteBase);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new FileWriteError(
            FileWriteErrorType.SYMLINK_NOT_ALLOWED,
            `Comparison path is a dangling symlink: ${absoluteBase}`,
            absoluteBase
          );
        }
        throw error;
      }
      const realRoot = await this.findRealAllowedRoot(realBase);
      if (!realRoot) {
        throw new FileWriteError(
          FileWriteErrorType.OUTSIDE_ALLOWED_DIRS,
          `Path resolves outside allowed directories via a symlink: ${absoluteBase}`,
          absoluteBase
        );
      }
      this.validateTargetName(realBase, realRoot);

      // Read through a handle opened without following a final-component
      // symlink, and check links and size on that handle, so a file swapped in
      // after the realpath check is not read.
      let base: fs.FileHandle;
      try {
        base = await fs.open(realBase, fsConstants.O_RDONLY | NO_FOLLOW);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ELOOP' || code === 'EMLINK') {
          throw new FileWriteError(
            FileWriteErrorType.SYMLINK_NOT_ALLOWED,
            `Comparison file changed to a symlink while reading: ${absoluteBase}`,
            absoluteBase
          );
        }
        throw error;
      }
      try {
        const baseStat = await base.stat();
        if (baseStat.nlink > 1) {
          throw this.hardLinkError(absoluteBase);
        }
        // Cap the base file size before reading it into memory.
        if (baseStat.size > this.config.maxFileSize) {
          throw new FileWriteError(
            FileWriteErrorType.MAX_SIZE_EXCEEDED,
            `Comparison file size (${baseStat.size} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
            absoluteBase
          );
        }
        baseContent = await base.readFile('utf8');
      } finally {
        await base.close();
      }
    }
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
      this.assertAccessEnabled('File writing is disabled in configuration');

      const createBackup = options.createBackup ?? this.config.autoBackup;

      const contentSize = Buffer.byteLength(options.content, 'utf8');
      if (contentSize > this.config.maxFileSize) {
        throw new FileWriteError(
          FileWriteErrorType.MAX_SIZE_EXCEEDED,
          `File size (${contentSize} bytes) exceeds maximum allowed (${this.config.maxFileSize} bytes)`,
          options.filePath
        );
      }

      const absolutePath = await this.resolveWriteTarget(options.filePath);

      const overwrite = options.overwrite ?? false;
      const createParentDirs = options.createParentDirs ?? true;

      const targetExists = (await this.lstatOrNull(absolutePath)) !== null;
      const base = options.compareWith ?? options.filePath;
      const diffResult = await this.computeDiff(base, options.content);

      // Mirror writeFile's pre-write guards so preview reflects whether an actual
      // write would proceed. The diff is still returned when a write is blocked.
      const parentDir = path.dirname(absolutePath);
      const parentExists = (await this.lstatOrNull(parentDir)) !== null;
      // Follow the parent (a dangling symlink resolves to null) to see what a write would hit
      const resolvedParent = parentExists ? await fs.stat(parentDir).catch(() => null) : null;
      let blockedError: FileWriteError | undefined;
      if (targetExists && !overwrite) {
        blockedError = new FileWriteError(
          FileWriteErrorType.FILE_EXISTS,
          `Write would be blocked: file exists and overwrite is disabled: ${absolutePath}`,
          absolutePath
        );
      } else if (parentExists && !resolvedParent?.isDirectory()) {
        // A write would fail with ENOTDIR (or ENOENT for a dangling symlink)
        // regardless of createParentDirs.
        blockedError = new FileWriteError(
          FileWriteErrorType.INVALID_PATH,
          `Write would be blocked: parent path exists but is not a directory: ${parentDir}`,
          absolutePath
        );
      } else if (!parentExists && !createParentDirs) {
        blockedError = new FileWriteError(
          FileWriteErrorType.INVALID_PATH,
          `Write would be blocked: parent directory does not exist and createParentDirs is disabled: ${parentDir}`,
          absolutePath
        );
      }

      return {
        preview: true,
        success: !blockedError,
        targetPath: absolutePath,
        targetExists,
        wouldOverwrite: targetExists,
        wouldBackup: targetExists && createBackup,
        bytesToWrite: contentSize,
        diff: diffResult.diff,
        isNewFile: diffResult.isNewFile,
        unchanged: diffResult.unchanged,
        error: blockedError?.message,
        errorType: blockedError?.type,
        message: blockedError
          ? blockedError.message
          : diffResult.unchanged
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
   * Refuse access when writing is disabled or no allowed directory is configured.
   */
  private assertAccessEnabled(disabledMessage: string): void {
    if (!this.config.enabled) {
      throw new FileWriteError(FileWriteErrorType.DISABLED, disabledMessage);
    }
    if (this.config.allowedDirectories.length === 0) {
      throw new FileWriteError(
        FileWriteErrorType.NO_ALLOWED_DIRECTORIES,
        'File access requires an explicit allowlist: set TERRAGRUNT_MCP_ALLOWED_DIRS to a ' +
        'comma-separated list of directories (for example your infrastructure repository).'
      );
    }
  }

  /**
   * Validate a path without touching the filesystem: no traversal, inside an
   * allowed directory, and an allowed file name.
   *
   * @returns The absolute path
   */
  private resolveAndValidateLexically(filePath: string): string {
    // Check for path traversal in the original path BEFORE resolution
    if (this.detectPathTraversal(filePath)) {
      throw new FileWriteError(
        FileWriteErrorType.PATH_TRAVERSAL,
        'Path validation failed: Path traversal detected',
        filePath
      );
    }

    const absolutePath = path.resolve(filePath);
    const allowedRoot = this.findAllowedRoot(absolutePath);
    if (!allowedRoot) {
      throw new FileWriteError(
        FileWriteErrorType.OUTSIDE_ALLOWED_DIRS,
        `Path is outside allowed directories: ${absolutePath}\nAllowed directories: ${this.config.allowedDirectories.join(', ')}`,
        absolutePath
      );
    }
    this.validateTargetName(absolutePath, allowedRoot);
    return absolutePath;
  }

  /**
   * Validate a write target, including links: the target itself must not be a
   * symlink or a hard link, and its real path must stay inside an allowed
   * directory and pass the file-name policy, so a symlinked directory cannot
   * redirect the write elsewhere (including into a dot-directory).
   *
   * @returns The absolute path
   */
  private async resolveWriteTarget(filePath: string): Promise<string> {
    const absolutePath = this.resolveAndValidateLexically(filePath);

    const targetStat = await this.lstatOrNull(absolutePath);
    if (targetStat?.isSymbolicLink()) {
      throw new FileWriteError(
        FileWriteErrorType.SYMLINK_NOT_ALLOWED,
        `Refusing to write through a symlink: ${absolutePath}`,
        absolutePath
      );
    }
    if (targetStat && targetStat.nlink > 1) {
      throw this.hardLinkError(absolutePath);
    }

    await this.validateRealPath(absolutePath);
    return absolutePath;
  }

  /**
   * Resolve the target through its deepest existing ancestor and check the
   * resulting real path against the allowed directories and file-name policy.
   */
  private async validateRealPath(absolutePath: string): Promise<void> {
    const allowedRoot = this.findAllowedRoot(absolutePath)!;
    const ancestor = await this.deepestExistingAncestor(path.dirname(absolutePath));
    if (!ancestor || !this.isWithin(ancestor.path, allowedRoot)) {
      // The allowed directory does not exist yet: every component from it down
      // will be created by this write, so none of them can be a symlink.
      return;
    }

    const realTarget = path.join(ancestor.realPath, path.relative(ancestor.path, absolutePath));
    const realRoot = await this.findRealAllowedRoot(realTarget);
    if (!realRoot) {
      throw new FileWriteError(
        FileWriteErrorType.OUTSIDE_ALLOWED_DIRS,
        `Path resolves outside allowed directories via a symlink: ${absolutePath}`,
        absolutePath
      );
    }
    this.validateTargetName(realTarget, realRoot);
  }

  private hardLinkError(absolutePath: string): FileWriteError {
    return new FileWriteError(
      FileWriteErrorType.HARDLINK_NOT_ALLOWED,
      `Refusing to access a file with multiple hard links: ${absolutePath}`,
      absolutePath
    );
  }

  /**
   * Enforce the file-name policy relative to the allowed root that contains the
   * path: an allowed extension, and no path segment starting with "." (which
   * rules out .git/hooks, .github/workflows, .envrc and other dot-files).
   */
  private validateTargetName(absolutePath: string, allowedRoot: string): void {
    const segments = path.relative(allowedRoot, absolutePath).split(path.sep);
    if (segments.some(segment => segment.startsWith('.'))) {
      throw new FileWriteError(
        FileWriteErrorType.DISALLOWED_FILE_TYPE,
        `Dot-files and dot-directories cannot be written or read: ${absolutePath}`,
        absolutePath
      );
    }

    // Match by suffix so multi-part extensions such as .hcl.json work
    const fileName = path.basename(absolutePath).toLowerCase();
    const allowed = this.config.allowedExtensions.some(
      extension => fileName.endsWith(extension) && fileName.length > extension.length
    );
    if (!allowed) {
      throw new FileWriteError(
        FileWriteErrorType.DISALLOWED_FILE_TYPE,
        `File type of ${path.basename(absolutePath)} is not allowed: ${absolutePath}\nAllowed extensions: ${this.config.allowedExtensions.join(', ')}`,
        absolutePath
      );
    }
  }

  /**
   * Find the most specific allowed directory that lexically contains a path.
   * The most specific root matters for the dot-segment rule, e.g. an explicitly
   * allowed /repo/.config alongside /repo.
   */
  private findAllowedRoot(absolutePath: string): string | undefined {
    return this.mostSpecific(
      this.config.allowedDirectories.filter(allowedDir => this.isWithin(absolutePath, allowedDir))
    );
  }

  /**
   * Whether a path equals or is inside a directory. The separator suffix
   * prevents partial matches (e.g., /home/user vs /home/user2).
   */
  private isWithin(candidate: string, directory: string): boolean {
    const normalizedCandidate = path.normalize(candidate);
    const normalizedDirectory = path.normalize(directory);
    return normalizedCandidate === normalizedDirectory ||
           normalizedCandidate.startsWith(normalizedDirectory + path.sep);
  }

  private mostSpecific(directories: string[]): string | undefined {
    return directories.reduce<string | undefined>(
      (best, directory) => (!best || directory.length > best.length ? directory : best),
      undefined
    );
  }

  /**
   * Containment check against the real (symlink-resolved) allowed roots. Both
   * the target and each allowed directory are canonicalized so a symlinked root
   * does not reject legitimate paths, while a symlink escaping the allowlist is
   * still caught.
   *
   * @returns The most specific real allowed root containing the path, if any
   */
  private async findRealAllowedRoot(realPath: string): Promise<string | undefined> {
    const containing: string[] = [];

    for (const allowedDir of this.config.allowedDirectories) {
      let root = path.normalize(allowedDir);
      try {
        root = path.normalize(await fs.realpath(allowedDir));
      } catch {
        // Allowed directory may not exist yet; fall back to the lexical path.
      }
      if (this.isWithin(realPath, root)) {
        containing.push(root);
      }
    }
    return this.mostSpecific(containing);
  }

  /**
   * Find the deepest ancestor of dirPath (inclusive) that exists, with its real
   * path. Components below it do not exist yet, so they cannot be symlinks.
   */
  private async deepestExistingAncestor(dirPath: string): Promise<{ path: string; realPath: string } | undefined> {
    let current = dirPath;
    for (;;) {
      try {
        return { path: current, realPath: await fs.realpath(current) };
      } catch (error) {
        // ENOTDIR: a component is a regular file, so this path cannot exist either
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT' && code !== 'ENOTDIR') {
          throw error;
        }
        // realpath fails with ENOENT while lstat succeeds only for a dangling symlink
        if (code === 'ENOENT' && (await this.lstatOrNull(current)) !== null) {
          throw new FileWriteError(
            FileWriteErrorType.SYMLINK_NOT_ALLOWED,
            `Path goes through a dangling symlink: ${current}`,
            current
          );
        }
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return undefined;
      }
      current = parent;
    }
  }

  /**
   * lstat a path, or null when it does not exist. ENOTDIR (a parent is a
   * regular file) also means the path cannot exist.
   */
  private async lstatOrNull(filePath: string): Promise<Stats | null> {
    try {
      return await fs.lstat(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return null;
      }
      throw error;
    }
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
   * Create a backup of an existing file from its open, verified handle. The
   * backup keeps the original file's permissions and is created exclusively.
   */
  private async createBackup(filePath: string, source: fs.FileHandle, size: number, mode: number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(7);
    const backupPath = `${filePath}${this.config.backupExtension}.${timestamp}-${randomSuffix}`;

    const content = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await source.read(content, offset, size - offset, offset);
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    const backup = await fs.open(backupPath, BACKUP_FLAGS, mode & 0o777);
    try {
      await this.writeAt(backup, content.subarray(0, offset));
    } finally {
      await backup.close();
    }

    return backupPath;
  }

  /**
   * Write a buffer from position 0 using positional writes, independent of the
   * handle's current file position.
   */
  private async writeAt(handle: fs.FileHandle, data: Buffer): Promise<void> {
    let offset = 0;
    while (offset < data.length) {
      const { bytesWritten } = await handle.write(data, offset, data.length - offset, offset);
      offset += bytesWritten;
    }
  }

  /**
   * Ensure the parent directory exists
   */
  private async ensureParentDirectory(filePath: string): Promise<void> {
    const parentDir = path.dirname(filePath);

    // Check if parent directory is also within allowed directories
    if (!this.findAllowedRoot(parentDir)) {
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
