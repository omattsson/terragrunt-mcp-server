/**
 * Unit tests for Terragrunt CLI validator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';
import { isTerragruntAvailable, validateWithTerragrunt, resetAvailabilityCache } from '../../src/terragrunt/cli-validator.js';

// Mock child_process
vi.mock('child_process');

describe('CLI Validator', () => {
  beforeEach(() => {
    // Reset cache before each test
    resetAvailabilityCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTerragruntAvailable', () => {
    it('should return true when terragrunt is available', async () => {
      const mockProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = isTerragruntAvailable();
      
      // Simulate successful version check
      setTimeout(() => mockProc.emit('exit', 0), 10);

      const result = await promise;
      expect(result).toBe(true);
      expect(childProcess.spawn).toHaveBeenCalledWith('terragrunt', ['--version']);
    });

    it('should return false when terragrunt is not found', async () => {
      const mockProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = isTerragruntAvailable();
      
      // Simulate ENOENT error
      setTimeout(() => mockProc.emit('error', new Error('ENOENT')), 10);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should cache the availability result', async () => {
      const mockProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise1 = isTerragruntAvailable();
      setTimeout(() => mockProc.emit('exit', 0), 10);
      await promise1;

      // Second call should use cache
      const result2 = await isTerragruntAvailable();
      expect(result2).toBe(true);
      expect(childProcess.spawn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle timeout gracefully', async () => {
      const mockProc = new EventEmitter() as any;
      mockProc.kill = vi.fn();
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      // Don't emit exit event to trigger timeout
      const result = await isTerragruntAvailable();
      
      expect(result).toBe(false);
      expect(mockProc.kill).toHaveBeenCalled();
    });
  });

  describe('validateWithTerragrunt', () => {
    it('should return not available when terragrunt not installed', async () => {
      const mockProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      // First call for availability check
      const availPromise = isTerragruntAvailable();
      setTimeout(() => mockProc.emit('error', new Error('ENOENT')), 10);
      await availPromise;

      const result = await validateWithTerragrunt('some config');
      
      expect(result.available).toBe(false);
      expect(result.syntaxValid).toBe(false);
      expect(result.errors).toContain('Terragrunt CLI not available in PATH');
    });

    it('should return formatted config when validation succeeds', async () => {
      // Mock availability check
      resetAvailabilityCache();
      const availProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValueOnce(availProc);
      const availPromise = isTerragruntAvailable();
      setTimeout(() => availProc.emit('exit', 0), 10);
      await availPromise;

      // Mock validation
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.stdin = {
        write: vi.fn(),
        end: vi.fn()
      };
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const config = 'remote_state { backend = "s3" }';
      const formattedConfig = 'remote_state {\n  backend = "s3"\n}';
      
      const promise = validateWithTerragrunt(config);
      
      // Simulate successful formatting
      setTimeout(() => {
        mockProc.stdout.emit('data', Buffer.from(formattedConfig));
        mockProc.emit('exit', 0);
      }, 10);

      const result = await promise;
      
      expect(result.available).toBe(true);
      expect(result.syntaxValid).toBe(true);
      expect(result.formatted).toBe(true);
      expect(result.formattedConfig).toBe(formattedConfig);
      expect(result.errors).toHaveLength(0);
      expect(mockProc.stdin.write).toHaveBeenCalledWith(config);
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should return errors when validation fails', async () => {
      // Mock availability check
      resetAvailabilityCache();
      const availProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValueOnce(availProc);
      const availPromise = isTerragruntAvailable();
      setTimeout(() => availProc.emit('exit', 0), 10);
      await availPromise;

      // Mock validation
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.stdin = {
        write: vi.fn(),
        end: vi.fn()
      };
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const config = 'invalid { syntax';
      const errorMsg = 'Error: Invalid HCL syntax at line 1';
      
      const promise = validateWithTerragrunt(config);
      
      // Simulate validation error
      setTimeout(() => {
        mockProc.stderr.emit('data', Buffer.from(errorMsg));
        mockProc.emit('exit', 1);
      }, 10);

      const result = await promise;
      
      expect(result.available).toBe(true);
      expect(result.syntaxValid).toBe(false);
      expect(result.formatted).toBe(false);
      expect(result.formattedConfig).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid HCL syntax');
    });

    it('should handle process timeout', async () => {
      // Mock availability check
      resetAvailabilityCache();
      const availProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValueOnce(availProc);
      const availPromise = isTerragruntAvailable();
      setTimeout(() => availProc.emit('exit', 0), 10);
      await availPromise;

      // Mock validation that hangs
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.stdin = {
        write: vi.fn(),
        end: vi.fn()
      };
      mockProc.kill = vi.fn();
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const config = 'some config';
      
      // Don't emit exit event to trigger timeout
      const result = await validateWithTerragrunt(config);
      
      expect(result.available).toBe(true);
      expect(result.syntaxValid).toBe(false);
      expect(result.errors).toContain('Terragrunt validation timed out after 5 seconds');
      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should handle stdin write errors', async () => {
      // Mock availability check
      resetAvailabilityCache();
      const availProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValueOnce(availProc);
      const availPromise = isTerragruntAvailable();
      setTimeout(() => availProc.emit('exit', 0), 10);
      await availPromise;

      // Mock validation with stdin error
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.stdin = {
        write: vi.fn(() => { throw new Error('Broken pipe'); }),
        end: vi.fn()
      };
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const result = await validateWithTerragrunt('config');
      
      expect(result.available).toBe(true);
      expect(result.syntaxValid).toBe(false);
      expect(result.errors[0]).toContain('Failed to write to Terragrunt stdin');
    });

    it('should handle process spawn errors', async () => {
      // Mock availability check
      resetAvailabilityCache();
      const availProc = new EventEmitter() as any;
      vi.spyOn(childProcess, 'spawn').mockReturnValueOnce(availProc);
      const availPromise = isTerragruntAvailable();
      setTimeout(() => availProc.emit('exit', 0), 10);
      await availPromise;

      // Mock validation with process error
      const mockProc = new EventEmitter() as any;
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.stdin = {
        write: vi.fn(),
        end: vi.fn()
      };
      vi.spyOn(childProcess, 'spawn').mockReturnValue(mockProc);

      const promise = validateWithTerragrunt('config');
      
      setTimeout(() => {
        mockProc.emit('error', new Error('Spawn failed'));
      }, 10);

      const result = await promise;
      
      expect(result.available).toBe(true);
      expect(result.syntaxValid).toBe(false);
      expect(result.errors[0]).toContain('Terragrunt process error');
    });
  });
});
