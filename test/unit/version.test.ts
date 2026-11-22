import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getServerVersion } from '../../src/version.js';

const repoVersion = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8')
).version;

describe('getServerVersion', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-version-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns the version from the repository package.json', () => {
    expect(getServerVersion()).toBe(repoVersion);
  });

  it('returns 0.0.0 and logs once when package.json cannot be read', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(getServerVersion('/nonexistent/package.json')).toBe('0.0.0');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 0.0.0 when the version field is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = path.join(tmp, 'package.json');
    fs.writeFileSync(file, '{}');
    expect(getServerVersion(file)).toBe('0.0.0');
  });

  it('returns the version field of the given file', () => {
    const file = path.join(tmp, 'package.json');
    fs.writeFileSync(file, '{"version":"9.9.9"}');
    expect(getServerVersion(file)).toBe('9.9.9');
  });
});
