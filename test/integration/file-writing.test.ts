import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * File Writing Integration Tests
 * 
 * These tests validate end-to-end functionality of the file writing capability:
 * - write_terragrunt_config tool execution
 * - Generate + write combined workflow
 * - Security features (path traversal, directory whitelisting)
 * - Backup system
 * - Error handling
 * - MCP protocol compliance
 * 
 * Tests use real file system operations in temporary directories.
 */
describe('File Writing Integration Tests', () => {
  let toolHandler: ToolHandler;
  let testDir: string;
  let allowedDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    console.log('Initializing ToolHandler for file writing integration tests...');
    
    // Save original environment
    originalEnv = { ...process.env };
    
    // Create temporary test directory
    testDir = path.join(tmpdir(), `terragrunt-mcp-integration-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    allowedDir = path.join(testDir, 'allowed');
    await fs.mkdir(allowedDir, { recursive: true });
    
    // Configure environment for file writing
    process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED = 'true';
    process.env.TERRAGRUNT_MCP_ALLOWED_DIRS = allowedDir;
    process.env.TERRAGRUNT_MCP_AUTO_BACKUP = 'true';
    process.env.TERRAGRUNT_MCP_MAX_FILE_SIZE = String(1024 * 1024); // 1MB
    
    // Initialize ToolHandler AFTER setting env vars
    toolHandler = new ToolHandler();
    
    console.log('Test environment initialized');
    console.log('Test directory:', testDir);
    console.log('Allowed directory:', allowedDir);
  }, 60000);

  beforeEach(async () => {
    // Clean up any files/directories from previous tests
    const files = await fs.readdir(allowedDir);
    for (const file of files) {
      const filePath = path.join(allowedDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    }
  });

  afterEach(async () => {
    // Restore environment after each test
    process.env = { ...originalEnv };
  });

  describe('Basic File Writing', () => {
    it('should write a new terragrunt.hcl file', async () => {
      const targetPath = path.join(allowedDir, 'terragrunt.hcl');
      const content = `terraform {
  source = "git::https://github.com/example/modules.git//vpc"
}

inputs = {
  region = "us-east-1"
  vpc_cidr = "10.0.0.0/16"
}`;

      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: content,
        overwrite: false,
        createBackup: false
      });

      // Validate result
      expect(result.success).toBe(true);
      expect(result.path).toBe(targetPath);
      expect(result.created).toBe(true);
      expect(result.backedUp).toBe(false);
      expect(result.bytesWritten).toBe(content.length);
      expect(result.error).toBeUndefined();

      // Verify file exists and has correct content
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should write file with subdirectories created automatically', async () => {
      const targetPath = path.join(allowedDir, 'env', 'prod', 'terragrunt.hcl');
      const content = 'terraform { source = "..." }';

      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: content
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);

      // Verify parent directories were created
      const fileExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should handle multiple files in sequence', async () => {
      const files = [
        { name: 'dev.hcl', content: 'inputs = { env = "dev" }' },
        { name: 'staging.hcl', content: 'inputs = { env = "staging" }' },
        { name: 'prod.hcl', content: 'inputs = { env = "prod" }' }
      ];

      for (const file of files) {
        const targetPath = path.join(allowedDir, file.name);
        const result = await toolHandler.executeTool('build_config', {
          path: targetPath,
          content: file.content
        });

        expect(result.success).toBe(true);
        expect(result.created).toBe(true);
      }

      // Verify all files exist
      const dirContents = await fs.readdir(allowedDir);
      expect(dirContents).toHaveLength(3);
      expect(dirContents.sort()).toEqual(['dev.hcl', 'prod.hcl', 'staging.hcl']);
    });
  });

  describe('Overwrite Protection', () => {
    it('should prevent overwriting when overwrite=false', async () => {
      const targetPath = path.join(allowedDir, 'existing.hcl');
      const originalContent = 'original content';
      const newContent = 'new content';

      // Write initial file
      await fs.writeFile(targetPath, originalContent);

      // Attempt to overwrite
      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: newContent,
        overwrite: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('exists');
      expect(result.errorType).toBe('FILE_EXISTS_NO_OVERWRITE');

      // Verify original content unchanged
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(originalContent);
    });

    it('should allow overwriting when overwrite=true', async () => {
      const targetPath = path.join(allowedDir, 'overwrite.hcl');
      const originalContent = 'original content';
      const newContent = 'new content';

      // Write initial file
      await fs.writeFile(targetPath, originalContent);

      // Overwrite
      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: newContent,
        overwrite: true
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false); // Not newly created, overwritten

      // Verify new content
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(newContent);
    });
  });

  describe('Backup System', () => {
    it('should create backup before overwriting', async () => {
      const targetPath = path.join(allowedDir, 'backup-test.hcl');
      const originalContent = 'original content';
      const newContent = 'new content';

      // Write initial file
      await fs.writeFile(targetPath, originalContent);

      // Overwrite with backup
      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: newContent,
        overwrite: true,
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(result.backedUp).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.backupPath).toContain('.backup.');

      // Verify backup file exists with original content
      const backupContent = await fs.readFile(result.backupPath!, 'utf-8');
      expect(backupContent).toBe(originalContent);

      // Verify target has new content
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(newContent);
    });

    it('should create multiple backups with timestamps', async () => {
      const targetPath = path.join(allowedDir, 'multi-backup.hcl');
      
      // Write and overwrite multiple times
      await fs.writeFile(targetPath, 'content v1');
      
      const result1 = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: 'content v2',
        overwrite: true,
        createBackup: true
      });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const result2 = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: 'content v3',
        overwrite: true,
        createBackup: true
      });

      expect(result1.backedUp).toBe(true);
      expect(result2.backedUp).toBe(true);
      expect(result1.backupPath).not.toBe(result2.backupPath);

      // Verify both backups exist
      const backup1Content = await fs.readFile(result1.backupPath!, 'utf-8');
      const backup2Content = await fs.readFile(result2.backupPath!, 'utf-8');
      
      expect(backup1Content).toBe('content v1');
      expect(backup2Content).toBe('content v2');
    });
  });

  describe('Security Features', () => {
    it('should reject path traversal attempts with ../', async () => {
      const maliciousPath = path.join(allowedDir, '..', '..', 'etc', 'passwd');
      
      const result = await toolHandler.executeTool('build_config', {
        path: maliciousPath,
        content: 'malicious content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(['PATH_TRAVERSAL_DETECTED', 'OUTSIDE_ALLOWED_DIRECTORIES']).toContain(result.errorType);
    });

    it('should reject paths outside allowed directories', async () => {
      const outsidePath = path.join(tmpdir(), 'outside', 'terragrunt.hcl');
      
      const result = await toolHandler.executeTool('build_config', {
        path: outsidePath,
        content: 'content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('OUTSIDE_ALLOWED_DIRECTORIES');
      expect(result.error).toContain('outside allowed directories');
    });

    it('should reject files exceeding size limit', async () => {
      const targetPath = path.join(allowedDir, 'large.hcl');
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB (exceeds 1MB limit)
      
      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: largeContent
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('MAX_SIZE_EXCEEDED');
      expect(result.error).toContain('exceeds maximum');
    });

    it('should normalize paths correctly', async () => {
      const unnormalizedPath = path.join(allowedDir, '.', 'subdir', '..', 'file.hcl');
      const expectedPath = path.join(allowedDir, 'file.hcl');
      const content = 'test content';
      
      const result = await toolHandler.executeTool('build_config', {
        path: unnormalizedPath,
        content: content
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(expectedPath);

      // Verify file written to normalized path
      const fileContent = await fs.readFile(expectedPath, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });

  describe('Generate + Write Workflow', () => {
    it('should generate config and write to file', async () => {
      // Step 1: Generate configuration
      const generateResult = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'my-terraform-state',
          region: 'us-east-1',
          key: 'terraform.tfstate',
          encrypt: true,
          dynamodb_table: 'terraform-locks'
        }
      });

      expect(generateResult.config).toBeDefined();
      expect(generateResult.config).toContain('remote_state');
      expect(generateResult.config).toContain('s3');

      // Step 2: Write generated config to file
      const targetPath = path.join(allowedDir, 'generated-terragrunt.hcl');
      const writeResult = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: generateResult.config
      });

      expect(writeResult.success).toBe(true);
      expect(writeResult.created).toBe(true);

      // Step 3: Verify file content matches generated config
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(generateResult.config);
    });

    it('should handle generate + update + write workflow', async () => {
      const targetPath = path.join(allowedDir, 'workflow-test.hcl');

      // Step 1: Generate initial config
      const initialConfig = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'initial-bucket',
          region: 'us-east-1',
          key: 'initial.tfstate',
          dynamodb_table: 'terraform-locks'
        }
      });

      // Step 2: Write initial config
      const write1 = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: initialConfig.config
      });
      expect(write1.success).toBe(true);

      // Step 3: Generate updated config
      const updatedConfig = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'updated-bucket',
          region: 'us-west-2',
          key: 'updated.tfstate',
          dynamodb_table: 'terraform-locks-updated'
        }
      });

      // Step 4: Update file with backup
      const write2 = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: updatedConfig.config,
        overwrite: true,
        createBackup: true
      });

      expect(write2.success).toBe(true);
      expect(write2.backedUp).toBe(true);

      // Verify backup has initial content
      const backupContent = await fs.readFile(write2.backupPath!, 'utf-8');
      expect(backupContent).toBe(initialConfig.config);

      // Verify file has updated content
      const currentContent = await fs.readFile(targetPath, 'utf-8');
      expect(currentContent).toBe(updatedConfig.config);
    });

    it('should generate and write config in single unified call (Mode 3)', async () => {
      // Test the unified generate+write mode (Mode 3)
      // This is the key feature providing 67% token reduction
      const targetPath = path.join(allowedDir, 'unified-mode3.hcl');

      const result = await toolHandler.executeTool('build_config', {
        useCase: 'remote_state',
        backend: 's3',
        options: {
          bucket: 'unified-terraform-state',
          region: 'us-west-2',
          key: 'unified.tfstate',
          encrypt: true,
          dynamodb_table: 'unified-locks'
        },
        write: true,
        path: targetPath
      });

      // Verify combined response structure (generation + write results)
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config).toContain('remote_state');
      expect(result.config).toContain('s3');
      
      // Verify write result is nested
      expect(result.writeResult).toBeDefined();
      expect(result.writeResult.written).toBe(true);
      expect(result.writeResult.path).toBe(targetPath);
      expect(result.writeResult.created).toBe(true);
      expect(result.writeResult.bytesWritten).toBeGreaterThan(0);

      // Verify file was actually created with correct content
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      expect(fileContent).toBe(result.config);
      expect(fileContent).toContain('unified-terraform-state');
      expect(fileContent).toContain('us-west-2');
      expect(fileContent).toContain('unified.tfstate');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const result = await toolHandler.executeTool('build_config', {
        // Missing 'path' parameter
        content: 'some content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid path types', async () => {
      const result = await toolHandler.executeTool('build_config', {
        path: 123, // Invalid type
        content: 'content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle write permission errors gracefully', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      
      // Update allowed dirs to include readonly
      process.env.TERRAGRUNT_MCP_ALLOWED_DIRS = `${allowedDir},${readOnlyDir}`;
      
      // Create new handler with updated env
      const handler = new ToolHandler();
      
      // Make directory read-only
      await fs.chmod(readOnlyDir, 0o444);

      const targetPath = path.join(readOnlyDir, 'test.hcl');
      const result = await handler.executeTool('build_config', {
        path: targetPath,
        content: 'content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('PERMISSION_DENIED');

      // Cleanup: restore permissions
      await fs.chmod(readOnlyDir, 0o755);
      await fs.rmdir(readOnlyDir);
    });
  });

  describe('Configuration Validation', () => {
    it('should respect TERRAGRUNT_MCP_FILE_WRITE_ENABLED=false', async () => {
      // Disable file writing
      process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED = 'false';
      const handler = new ToolHandler();

      const result = await handler.executeTool('build_config', {
        path: path.join(allowedDir, 'test.hcl'),
        content: 'content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('disabled');
    });

    it('should handle empty TERRAGRUNT_MCP_ALLOWED_DIRS', async () => {
      process.env.TERRAGRUNT_MCP_FILE_WRITE_ENABLED = 'true';
      process.env.TERRAGRUNT_MCP_ALLOWED_DIRS = '';
      const handler = new ToolHandler();

      const result = await handler.executeTool('build_config', {
        path: path.join(allowedDir, 'test.hcl'),
        content: 'content'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorType).toBe('OUTSIDE_ALLOWED_DIRECTORIES');
    });

    it('should handle multiple allowed directories', async () => {
      const dir1 = path.join(testDir, 'dir1');
      const dir2 = path.join(testDir, 'dir2');
      await fs.mkdir(dir1, { recursive: true });
      await fs.mkdir(dir2, { recursive: true });

      process.env.TERRAGRUNT_MCP_ALLOWED_DIRS = `${dir1},${dir2}`;
      const handler = new ToolHandler();

      // Write to first directory
      const result1 = await handler.executeTool('build_config', {
        path: path.join(dir1, 'test1.hcl'),
        content: 'content 1'
      });

      // Write to second directory
      const result2 = await handler.executeTool('build_config', {
        path: path.join(dir2, 'test2.hcl'),
        content: 'content 2'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Cleanup
      await fs.rm(dir1, { recursive: true, force: true });
      await fs.rm(dir2, { recursive: true, force: true });
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should return valid result schema on success', async () => {
      const targetPath = path.join(allowedDir, 'mcp-test.hcl');
      const content = 'terraform { }';

      const result = await toolHandler.executeTool('build_config', {
        path: targetPath,
        content: content
      });

      // Verify result has expected structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('bytesWritten');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('backedUp');
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.path).toBe('string');
      expect(typeof result.bytesWritten).toBe('number');
      expect(typeof result.created).toBe('boolean');
      expect(typeof result.backedUp).toBe('boolean');
    });

    it('should return valid error schema on failure', async () => {
      const result = await toolHandler.executeTool('build_config', {
        path: '/invalid/path/outside/allowed',
        content: 'content'
      });

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('errorType');
      
      expect(typeof result.error).toBe('string');
      expect(typeof result.errorType).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });

    it('should handle tool execution without throwing', async () => {
      // Even with invalid input, should not throw, just return error
      await expect(
        toolHandler.executeTool('build_config', {
          path: null,
          content: undefined
        })
      ).resolves.toBeDefined();
    });
  });
});
