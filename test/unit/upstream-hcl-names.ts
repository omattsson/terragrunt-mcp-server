/**
 * Shared extraction of the documented HCL block, attribute and function names
 * from the pinned docs fixture (fixtures/terragrunt-docs-fixture.json).
 *
 * Upstream is migrating the HCL reference to one page per item (#7237), so a
 * name can live in two shapes at the same time:
 *   - a line-start `## <name>` heading on the reference page
 *     (/reference/hcl/<kind>/), for items not yet migrated;
 *   - its own page /reference/hcl/<kind>/<name>/, for migrated items.
 * The documented set is the union of both, so the parity tests keep working
 * while items move from the first shape to the second.
 *
 * This file is not a test (no `.test.ts` suffix); the parity tests import it.
 */

export type HclKind = 'blocks' | 'attributes' | 'functions';

export interface UpstreamDocPage {
  url: string;
  content: string;
}

export interface DocumentedHclNamesOptions {
  /** Names to drop from both shapes (compared case-insensitively). */
  exclude?: Iterable<string>;
}

const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/** Identifier H2 headings at line start, outside fenced code, `\_` unescaped. */
function h2Identifiers(content: string): string[] {
  const names: string[] = [];
  let fence: string | null = null;
  for (const line of content.split(/\r?\n/)) {
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^## (.+)$/.exec(line);
    if (!heading) continue;
    const name = heading[1].trim().replaceAll('\\_', '_').toLowerCase();
    // Keeps only identifiers: drops index and prose headings such as
    // "Unit blocks" or "OpenTofu/Terraform built-in functions".
    if (IDENTIFIER.test(name)) names.push(name);
  }
  return names;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Documented names of one HCL kind: the H2 identifiers of the reference page
 * united with the names of the per-item pages.
 */
export function documentedHclNames(
  docs: readonly UpstreamDocPage[],
  kind: HclKind,
  options: DocumentedHclNamesOptions = {}
): Set<string> {
  const referencePath = `/reference/hcl/${kind}/`;
  const itemPattern = new RegExp(`^${referencePath}([a-z][a-z0-9_]*)/$`);
  const names = new Set<string>();

  for (const doc of docs) {
    const path = pathOf(doc.url);
    if (path.endsWith(referencePath)) {
      for (const name of h2Identifiers(doc.content)) names.add(name);
      continue;
    }
    const item = itemPattern.exec(path);
    if (item) names.add(item[1]);
  }

  for (const name of options.exclude ?? []) names.delete(name.toLowerCase());
  return names;
}
