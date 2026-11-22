import * as fs from 'fs';
import { fileURLToPath } from 'url';

const FALLBACK_VERSION = '0.0.0';

/**
 * Server version, read from package.json so it cannot drift from the release.
 *
 * With no argument it reads the package.json one directory above this module,
 * which is the package root for both src/ and dist/ (and /app in the Docker
 * image). Never throws: on any problem it logs once to stderr and returns 0.0.0.
 */
export function getServerVersion(
  packageJsonPath: string = fileURLToPath(new URL('../package.json', import.meta.url))
): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (typeof parsed?.version === 'string' && parsed.version.length > 0) {
      return parsed.version;
    }
    console.error(`[Version] No version field in ${packageJsonPath}, using ${FALLBACK_VERSION}`);
  } catch (error) {
    console.error(`[Version] Could not read ${packageJsonPath}, using ${FALLBACK_VERSION}:`, error);
  }
  return FALLBACK_VERSION;
}
