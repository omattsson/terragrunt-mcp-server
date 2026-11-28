import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TERRAGRUNT_DOC_MANIFEST } from '../../src/terragrunt/docs-manifest.js';

// Every HCL block, attribute, function and variable has its own page at the
// pinned revision (hcl/<kind>/<name>/), and the combined pages (hcl/<kind>/)
// are indexes. A curated link to an item's anchor on a combined page lands on
// the index instead of the item, so link the per-item page.
//
// Scanned: every .ts file under src/ (except the generated manifest), every
// .md file under docs/, and README.md.

const ROOT = new URL('../../', import.meta.url);
const HCL_URL = /\/reference\/hcl\/(blocks|attributes|functions|variables)\/([a-z0-9_./-]*)(#[a-z0-9_-]+)?/g;

const manifestPaths = new Set(TERRAGRUNT_DOC_MANIFEST.map((entry) => entry[1]));
const perItemNames = new Set(
  [...manifestPaths]
    .map((p) => p.match(/^\/reference\/hcl\/(?:blocks|attributes|functions|variables)\/([a-z0-9_]+)\/$/)?.[1])
    .filter((name): name is string => name !== undefined),
);

async function filesUnder(dir: string, extension: string): Promise<string[]> {
  const entries = await readdir(new URL(dir, ROOT), { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(extension))
    .map((e) => path.relative(fileURLToPath(ROOT), path.join(e.parentPath, e.name)).split(path.sep).join('/'));
}

async function scannedFiles(): Promise<Array<{ name: string; text: string }>> {
  const names = [
    ...(await filesUnder('src/', '.ts')).filter((n) => !n.endsWith('docs-manifest.ts')),
    ...(await filesUnder('docs/', '.md')),
    'README.md',
  ];
  return Promise.all(names.map(async (name) => ({ name, text: await readFile(new URL(name, ROOT), 'utf-8') })));
}

describe('curated HCL docs links', () => {
  it('finds per-item names of every kind in the manifest', () => {
    for (const name of ['dependency', 'iam_role', 'find_in_parent_folders', 'path']) {
      expect(perItemNames.has(name), name).toBe(true);
    }
  });

  it('scans src, docs and README', async () => {
    const names = (await scannedFiles()).map((f) => f.name);
    expect(names).toContain('src/terragrunt/hcl-blocks.ts');
    expect(names).toContain('src/handlers/tools.ts');
    expect(names).toContain('docs/Available-Tools.md');
    expect(names).toContain('README.md');
  });

  it('link a per-item page, not an anchor on the combined page', async () => {
    const offenders: string[] = [];
    for (const { name, text } of await scannedFiles()) {
      for (const m of text.matchAll(HCL_URL)) {
        const [, , rest, anchor] = m;
        if (rest === '' && anchor && perItemNames.has(anchor.slice(1))) offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('link only HCL reference pages that exist at the pin', async () => {
    const missing: string[] = [];
    let checked = 0;
    for (const { name, text } of await scannedFiles()) {
      for (const m of text.matchAll(HCL_URL)) {
        const [, kind, rest] = m;
        const pagePath = `/reference/hcl/${kind}/${rest}`;
        // Only check complete page paths; a template such as `${name}/` stops early.
        if (!pagePath.endsWith('/')) continue;
        checked++;
        if (!manifestPaths.has(pagePath)) missing.push(`${name}: ${pagePath}`);
      }
    }
    expect(missing).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });
});
