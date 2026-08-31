/**
 * Unit tests for HCLBlocksManager
 * 
 * Tests for the expanded HCL configuration reference feature (Issue #102)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'fs/promises';
import { HCLBlocksManager } from '../../src/terragrunt/hcl-blocks.js';
import type { HCLBlock, HCLBlockCategory, HCLBlockSearchResult } from '../../src/types/hcl-blocks.js';

describe('HCLBlocksManager', () => {
    let manager: HCLBlocksManager;

    beforeEach(() => {
        manager = new HCLBlocksManager();
    });

    describe('getBlock', () => {
        describe('exact name matching', () => {
            it('should get terraform block by exact name', () => {
                const block = manager.getBlock('terraform');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('terraform');
                expect(block?.category).toBe('core');
            });

            it('should get remote_state block', () => {
                const block = manager.getBlock('remote_state');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('remote_state');
                expect(block?.description).toContain('remote state');
            });

            it('should get locals block', () => {
                const block = manager.getBlock('locals');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('locals');
                expect(block?.category).toBe('core');
            });

            it('should get inputs block', () => {
                const block = manager.getBlock('inputs');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('inputs');
            });

            it('should get include block', () => {
                const block = manager.getBlock('include');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('include');
                expect(block?.category).toBe('modules');
            });

            it('should get dependency block', () => {
                const block = manager.getBlock('dependency');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('dependency');
            });

            it('should get generate block', () => {
                const block = manager.getBlock('generate');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('generate');
                expect(block?.category).toBe('generation');
            });

            it('should be case-insensitive', () => {
                const block1 = manager.getBlock('TERRAFORM');
                const block2 = manager.getBlock('Terraform');
                const block3 = manager.getBlock('terraform');
                
                expect(block1?.name).toBe('terraform');
                expect(block2?.name).toBe('terraform');
                expect(block3?.name).toBe('terraform');
            });

            it('should handle whitespace', () => {
                const block = manager.getBlock('  terraform  ');
                expect(block?.name).toBe('terraform');
            });

            it('should return null for unknown block', () => {
                const block = manager.getBlock('nonexistent_block');
                expect(block).toBeNull();
            });

            it('should handle empty string', () => {
                const block = manager.getBlock('');
                expect(block).toBeNull();
            });
        });

        describe('alias resolution', () => {
            it('should resolve state alias to remote_state', () => {
                const block = manager.getBlock('state');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('remote_state');
            });

            it('should resolve backend alias to remote_state', () => {
                const block = manager.getBlock('backend');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('remote_state');
            });

            it('should resolve deps alias to dependencies', () => {
                const block = manager.getBlock('deps');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('dependencies');
            });

            it('should resolve local alias to locals', () => {
                const block = manager.getBlock('local');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('locals');
            });

            it('should resolve input alias to inputs', () => {
                const block = manager.getBlock('input');
                expect(block).not.toBeNull();
                expect(block?.name).toBe('inputs');
            });
        });
    });

    describe('listBlocks', () => {
        it('should return all blocks when no category specified', () => {
            const blocks = manager.listBlocks();
            expect(blocks.length).toBeGreaterThan(10);
        });

        it('should filter by core category', () => {
            const blocks = manager.listBlocks('core');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('core');
            });
        });

        it('should filter by modules category', () => {
            const blocks = manager.listBlocks('modules');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('modules');
            });
        });

        it('should filter by generation category', () => {
            const blocks = manager.listBlocks('generation');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('generation');
            });
        });

        it('should filter by execution category', () => {
            const blocks = manager.listBlocks('execution');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('execution');
            });
        });

        it('should filter by iam category', () => {
            const blocks = manager.listBlocks('iam');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('iam');
            });
        });

        it('should filter by terraform category', () => {
            const blocks = manager.listBlocks('terraform');
            expect(blocks.length).toBeGreaterThan(0);
            blocks.forEach(block => {
                expect(block.category).toBe('terraform');
            });
        });

        it('should return empty array for invalid category', () => {
            const blocks = manager.listBlocks('invalid' as HCLBlockCategory);
            expect(blocks).toEqual([]);
        });
    });

    describe('listBlocks with category filtering', () => {
        it('should get core blocks including terraform, remote_state, locals, inputs', () => {
            const blocks = manager.listBlocks('core');
            const names = blocks.map(b => b.name);
            
            expect(names).toContain('terraform');
            expect(names).toContain('remote_state');
            expect(names).toContain('locals');
            expect(names).toContain('inputs');
        });

        it('should get modules blocks including include, dependency, dependencies', () => {
            const blocks = manager.listBlocks('modules');
            const names = blocks.map(b => b.name);
            
            expect(names).toContain('include');
            expect(names).toContain('dependency');
            expect(names).toContain('dependencies');
        });

        it('should get generation blocks including generate', () => {
            const blocks = manager.listBlocks('generation');
            const names = blocks.map(b => b.name);
            
            expect(names).toContain('generate');
        });
    });

    describe('searchBlocks', () => {
        it('should find exact matches with highest score', () => {
            const results = manager.searchBlocks('terraform');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].block.name).toBe('terraform');
            expect(results[0].score).toBe(1.0);
            expect(results[0].matchType).toBe('exact');
        });

        it('should find blocks via partial name matching', () => {
            const results = manager.searchBlocks('remote');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].block.name).toBe('remote_state');
            expect(results[0].matchType).toBe('name');
            const names = results.map(r => r.block.name);
            expect(names).toContain('remote_state');
        });

        it('should find matches in descriptions', () => {
            const results = manager.searchBlocks('backend');
            expect(results.length).toBeGreaterThan(0);
            // Verify remote_state is found since it mentions backend in description
            const names = results.map(r => r.block.name);
            expect(names).toContain('remote_state');
        });

        it('should find attribute matches', () => {
            const results = manager.searchBlocks('source');
            expect(results.length).toBeGreaterThan(0);
            // terraform block has source attribute
            const names = results.map(r => r.block.name);
            expect(names).toContain('terraform');
        });

        it('should sort results by score descending', () => {
            const results = manager.searchBlocks('config');
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });

        it('should return empty array for no matches', () => {
            const results = manager.searchBlocks('xyznonexistent123');
            expect(results).toEqual([]);
        });

        it('should be case-insensitive', () => {
            const results1 = manager.searchBlocks('TERRAFORM');
            const results2 = manager.searchBlocks('terraform');
            
            expect(results1[0]?.block.name).toBe('terraform');
            expect(results2[0]?.block.name).toBe('terraform');
        });
    });

    describe('getCategories', () => {
        it('should return all categories', () => {
            const categories = manager.getCategories();
            expect(categories.length).toBeGreaterThan(0);
        });

        it('should include core category', () => {
            const categories = manager.getCategories();
            const core = categories.find(c => c.category === 'core');
            expect(core).toBeDefined();
            expect(core?.name).toBeDefined();
            expect(core?.description).toBeDefined();
            expect(core?.blockCount).toBeGreaterThan(0);
        });

        it('should include modules category', () => {
            const categories = manager.getCategories();
            const modules = categories.find(c => c.category === 'modules');
            expect(modules).toBeDefined();
            expect(modules?.blockCount).toBeGreaterThan(0);
        });

        it('should have correct block counts per category', () => {
            const categories = manager.getCategories();
            let totalCount = 0;
            
            for (const cat of categories) {
                const blocks = manager.listBlocks(cat.category);
                expect(cat.blockCount).toBe(blocks.length);
                totalCount += cat.blockCount;
            }
            
            expect(totalCount).toBe(manager.getBlockCount());
        });
    });

    describe('formatBlockAsMarkdown', () => {
        it('should format terraform block as markdown', () => {
            const block = manager.getBlock('terraform')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            expect(md).toContain('# Terraform Block');
            expect(md).toContain('## Syntax');
            expect(md).toContain('## Attributes');
            expect(md).toContain('## Examples');
        });

        it('should include attribute table', () => {
            const block = manager.getBlock('terraform')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            expect(md).toContain('| Attribute | Type | Required | Description |');
            expect(md).toContain('`source`');
        });

        it('should include code examples', () => {
            const block = manager.getBlock('remote_state')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            expect(md).toContain('```hcl');
            expect(md).toContain('remote_state');
        });

        it('should include related blocks section', () => {
            const block = manager.getBlock('terraform')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            if (block.relatedBlocks && block.relatedBlocks.length > 0) {
                expect(md).toContain('## Related');
            }
        });

        it('should include documentation link', () => {
            const block = manager.getBlock('terraform')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            expect(md).toContain('## Documentation');
            expect(md).toContain('docs.terragrunt.com');
        });

        it('should format nested attributes with indentation', () => {
            const block = manager.getBlock('terraform')!;
            const md = manager.formatBlockAsMarkdown(block);
            
            // Check for nested attribute indicator
            expect(md).toContain('↳');
        });
    });

    describe('getBlockCount', () => {
        it('should match the current Terragrunt block and attribute inventory', () => {
            const expectedNames = [
                'terraform',
                'remote_state',
                'include',
                'locals',
                'dependency',
                'dependencies',
                'generate',
                'catalog',
                'engine',
                'feature',
                'exclude',
                'errors',
                'unit',
                'stack',
                'inputs',
                'download_dir',
                'prevent_destroy',
                'iam_role',
                'iam_assume_role_duration',
                'iam_assume_role_session_name',
                'iam_web_identity_token',
                'terraform_binary',
                'terraform_version_constraint',
                'terragrunt_version_constraint',
            ];
            const actualNames = manager.listBlocks().map(block => block.name);

            expect(actualNames).toHaveLength(expectedNames.length);
            expect(actualNames).toEqual(expect.arrayContaining(expectedNames));
        });

        it('should match listBlocks length', () => {
            const count = manager.getBlockCount();
            const blocks = manager.listBlocks();
            expect(count).toBe(blocks.length);
        });

        it.each([
            'skip',
            'retryable_errors',
            'retry_max_attempts',
            'retry_sleep_interval_sec',
        ])('should not expose removed top-level %s attribute', attribute => {
            expect(manager.getBlock(attribute)).toBeNull();
        });
    });

    describe('block structure validation', () => {
        it('should have required fields for all blocks', () => {
            const blocks = manager.listBlocks();
            
            for (const block of blocks) {
                expect(block.name).toBeDefined();
                expect(block.displayName).toBeDefined();
                expect(block.description).toBeDefined();
                expect(block.category).toBeDefined();
                expect(block.syntax).toBeDefined();
                expect(block.attributes).toBeDefined();
                expect(Array.isArray(block.attributes)).toBe(true);
                expect(block.examples).toBeDefined();
                expect(Array.isArray(block.examples)).toBe(true);
            }
        });

        it('should have at least one example for core blocks', () => {
            const coreBlocks = manager.listBlocks('core');
            
            for (const block of coreBlocks) {
                expect(block.examples.length).toBeGreaterThan(0);
            }
        });

        it('should have valid docsUrl for core blocks', () => {
            const coreBlocks = manager.listBlocks('core');
            
            for (const block of coreBlocks) {
                if (block.docsUrl) {
                    expect(block.docsUrl).toMatch(/^https:\/\/docs\.terragrunt\.com/);
                }
            }
        });

        it('should have valid attribute types', () => {
            const validTypes = ['string', 'number', 'boolean', 'list', 'map', 'object', 'block', 'any'];
            const blocks = manager.listBlocks();
            
            for (const block of blocks) {
                for (const attr of block.attributes) {
                    expect(validTypes).toContain(attr.type);
                }
            }
        });
    });

    describe('specific block content', () => {
        describe('terraform block', () => {
            it('should have source attribute', () => {
                const block = manager.getBlock('terraform')!;
                const sourceAttr = block.attributes.find(a => a.name === 'source');
                
                expect(sourceAttr).toBeDefined();
                expect(sourceAttr?.required).toBe(true);
                expect(sourceAttr?.type).toBe('string');
            });

            it('should have extra_arguments nested block', () => {
                const block = manager.getBlock('terraform')!;
                const extraArgs = block.attributes.find(a => a.name === 'extra_arguments');
                
                expect(extraArgs).toBeDefined();
                expect(extraArgs?.type).toBe('block');
                expect(extraArgs?.nestedAttributes).toBeDefined();
            });

            it.each(['version', 'exclude_from_copy', 'copy_terraform_lock_file', 'update_source_with_cas', 'mutable'])('should have current %s attribute', attributeName => {
                const block = manager.getBlock('terraform')!;

                expect(block.attributes.some(attribute => attribute.name === attributeName)).toBe(true);
            });

            it('should document registry versions, OCI sources, and stable CAS behavior', () => {
                const block = manager.getBlock('terraform')!;
                const source = block.attributes.find(attribute => attribute.name === 'source')!;
                const version = block.attributes.find(attribute => attribute.name === 'version')!;
                const updateSourceWithCas = block.attributes.find(attribute => attribute.name === 'update_source_with_cas')!;
                const mutable = block.attributes.find(attribute => attribute.name === 'mutable')!;

                expect(source.description).toContain('oci://');
                expect(version.type).toBe('string');
                expect(version.description).toContain('version-attribute');
                expect(version.description).toContain('tfr://');
                expect(updateSourceWithCas).toMatchObject({ type: 'boolean', defaultValue: false });
                expect(mutable).toMatchObject({ type: 'boolean', defaultValue: false });
                expect(mutable.description).not.toContain('experimental content-addressable store');
            });

            it('should have before_hook nested block', () => {
                const block = manager.getBlock('terraform')!;
                const hook = block.attributes.find(a => a.name === 'before_hook');
                
                expect(hook).toBeDefined();
                expect(hook?.type).toBe('block');
            });
        });

        describe('remote_state block', () => {
            it('should have backend attribute', () => {
                const block = manager.getBlock('remote_state')!;
                const backend = block.attributes.find(a => a.name === 'backend');
                
                expect(backend).toBeDefined();
                expect(backend?.required).toBe(true);
                expect(backend?.validValues).toBeDefined();
                expect(backend?.validValues).toContain('s3');
                expect(backend?.validValues).toContain('gcs');
                expect(backend?.validValues).toContain('azurerm');
            });

            it('should have config attribute', () => {
                const block = manager.getBlock('remote_state')!;
                const config = block.attributes.find(a => a.name === 'config');
                
                expect(config).toBeDefined();
                expect(config?.required).toBe(true);
                expect(config?.type).toBe('map');
            });

            it('should have generate nested attribute', () => {
                const block = manager.getBlock('remote_state')!;
                const generate = block.attributes.find(a => a.name === 'generate');
                
                expect(generate).toBeDefined();
                expect(generate?.nestedAttributes).toBeDefined();
            });

            it('should have encryption attribute', () => {
                const block = manager.getBlock('remote_state')!;

                expect(block.attributes.some(attribute => attribute.name === 'encryption')).toBe(true);
            });
        });

        describe('include block', () => {
            it('should have path attribute', () => {
                const block = manager.getBlock('include')!;
                const path = block.attributes.find(a => a.name === 'path');
                
                expect(path).toBeDefined();
                expect(path?.required).toBe(true);
            });

            it('should have merge_strategy attribute', () => {
                const block = manager.getBlock('include')!;
                const strategy = block.attributes.find(a => a.name === 'merge_strategy');
                
                expect(strategy).toBeDefined();
                expect(strategy?.validValues).toContain('no_merge');
                expect(strategy?.validValues).toContain('shallow');
                expect(strategy?.validValues).toContain('deep');
            });
        });

        describe('dependency block', () => {
            it('should have config_path attribute', () => {
                const block = manager.getBlock('dependency')!;
                const configPath = block.attributes.find(a => a.name === 'config_path');
                
                expect(configPath).toBeDefined();
                expect(configPath?.required).toBe(true);
            });

            it('should have mock_outputs attribute', () => {
                const block = manager.getBlock('dependency')!;
                const mockOutputs = block.attributes.find(a => a.name === 'mock_outputs');
                
                expect(mockOutputs).toBeDefined();
            });

            it('should document block iteration', () => {
                const block = manager.getBlock('dependency')!;
                const expansion = block.attributes.find(attribute => attribute.name === 'expansion')!;

                expect(expansion.nestedAttributes?.map(attribute => attribute.name)).toEqual(['for_each', 'count']);
                expect(expansion.description).toContain('block-iteration');
                expect(expansion.description).toContain('1,000,000');
                expect(expansion.nestedAttributes?.find(attribute => attribute.name === 'for_each')?.description).toContain('each.value');
                expect(expansion.nestedAttributes?.find(attribute => attribute.name === 'count')).toMatchObject({
                    type: 'number',
                    description: expect.stringContaining('count.index'),
                });
            });
        });

        describe('generate block', () => {
            it('should have path attribute', () => {
                const block = manager.getBlock('generate')!;
                const path = block.attributes.find(a => a.name === 'path');
                
                expect(path).toBeDefined();
                expect(path?.required).toBe(true);
            });

            it('should have if_exists attribute', () => {
                const block = manager.getBlock('generate')!;
                const ifExists = block.attributes.find(a => a.name === 'if_exists');
                
                expect(ifExists).toBeDefined();
                expect(ifExists?.validValues).toContain('overwrite');
                expect(ifExists?.validValues).toContain('skip');
            });

            it('should have contents attribute', () => {
                const block = manager.getBlock('generate')!;
                const contents = block.attributes.find(a => a.name === 'contents');
                
                expect(contents).toBeDefined();
                expect(contents?.required).toBe(true);
            });

            it.each(['if_disabled', 'disable', 'hcl_fmt', 'mutable'])('should have current %s attribute', attributeName => {
                const block = manager.getBlock('generate')!;

                expect(block.attributes.some(attribute => attribute.name === attributeName)).toBe(true);
            });

            it('should document mutable generation behavior', () => {
                const block = manager.getBlock('generate')!;
                const hclFmt = block.attributes.find(attribute => attribute.name === 'hcl_fmt')!;
                const mutable = block.attributes.find(attribute => attribute.name === 'mutable')!;

                expect(hclFmt.type).toBe('boolean');
                expect(hclFmt.defaultValue).toBe('true for .hcl, .tf, and .tofu files; false otherwise');
                expect(hclFmt.description).toContain('.tofu');
                expect(hclFmt.description).toContain('mutable-generate');
                expect(mutable.type).toBe('boolean');
                expect(mutable.defaultValue).toBe(false);
                expect(mutable.description).toContain('CAS hard link');
                expect(mutable.description).toContain('mutable-generate');
            });
        });

        describe('current Terragrunt blocks', () => {
            it.each([
                ['catalog', 'urls'],
                ['engine', 'source'],
                ['feature', 'default'],
                ['exclude', 'if'],
                ['errors', 'retry'],
                ['unit', 'source'],
                ['stack', 'source'],
                ['terragrunt_version_constraint', 'terragrunt_version_constraint'],
            ])('should expose %s with its primary attribute', (blockName, attributeName) => {
                const block = manager.getBlock(blockName);

                expect(block).not.toBeNull();
                expect(block?.attributes.some(attribute => attribute.name === attributeName)).toBe(true);
            });

            it('should document retryable_errors only inside errors.retry', () => {
                const errorsBlock = manager.getBlock('errors')!;
                const retryBlock = errorsBlock.attributes.find(attribute => attribute.name === 'retry');

                expect(retryBlock?.nestedAttributes?.some(attribute => attribute.name === 'retryable_errors')).toBe(true);
            });

            it('should relate prevent_destroy to exclude instead of removed skip', () => {
                const preventDestroy = manager.getBlock('prevent_destroy')!;

                expect(preventDestroy.relatedBlocks).toContain('exclude');
                expect(preventDestroy.relatedBlocks).not.toContain('skip');
            });

            it.each(['unit', 'stack'])('should document autoinclude inside %s', blockName => {
                const block = manager.getBlock(blockName)!;

                expect(block.attributes.some(attribute => attribute.name === 'autoinclude')).toBe(true);
            });

            it.each(['unit', 'stack'])('should document iteration and CAS fields inside %s', blockName => {
                const block = manager.getBlock(blockName)!;
                const attributeNames = block.attributes.map(attribute => attribute.name);
                const expansion = block.attributes.find(attribute => attribute.name === 'expansion')!;

                expect(attributeNames).toEqual(expect.arrayContaining(['enabled', 'update_source_with_cas', 'mutable', 'expansion']));
                expect(expansion.nestedAttributes?.map(attribute => attribute.name)).toEqual(['for_each', 'count']);
                expect(expansion.description).toContain('block-iteration');
                expect(block.attributes.find(attribute => attribute.name === 'source')?.description).toContain('oci://');
                expect(block.attributes.find(attribute => attribute.name === 'enabled')).toMatchObject({ type: 'boolean', defaultValue: true });
                expect(block.attributes.find(attribute => attribute.name === 'update_source_with_cas')).toMatchObject({ type: 'boolean', defaultValue: false });
                expect(block.attributes.find(attribute => attribute.name === 'mutable')).toMatchObject({ type: 'boolean', defaultValue: false });
            });
        });
    });

    describe('edge cases', () => {
        it('should handle special characters in search', () => {
            const results = manager.searchBlocks('remote_state');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle hyphenated names', () => {
            // Search for something with hyphens
            const results = manager.searchBlocks('if-exists');
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle repeated getBlock calls', () => {
            const block1 = manager.getBlock('terraform');
            const block2 = manager.getBlock('terraform');
            expect(block1).toEqual(block2);
        });

        it('should handle concurrent searches', async () => {
            const searches = [
                manager.searchBlocks('terraform'),
                manager.searchBlocks('remote_state'),
                manager.searchBlocks('include'),
            ];
            
            const results = await Promise.all(searches.map(r => Promise.resolve(r)));
            expect(results[0][0]?.block.name).toBe('terraform');
            expect(results[1][0]?.block.name).toBe('remote_state');
            expect(results[2][0]?.block.name).toBe('include');
        });
    });
});

describe('upstream HCL block parity', () => {
  // The /reference/hcl/blocks/ page documents each top-level block as an H2
  // heading; H3/H4 headings are prose or sub-sections. `autoinclude` has its
  // own H2 but is a nested block used inside unit/stack (modeled here as a
  // nested `autoinclude` attribute on the unit and stack blocks), not a
  // top-level block. Tied to revision
  // 2a4802eb604cc7175d9937a9d5303d66656b86ed; revisit on refresh.
  const NESTED_NOT_TOPLEVEL = new Set(['autoinclude']);

  it('covers every documented top-level block', async () => {
    const raw = await readFile(new URL('../../fixtures/terragrunt-docs-fixture.json', import.meta.url), 'utf-8');
    const docs: Array<{ url: string; content: string }> = JSON.parse(raw);
    const blocksDoc = docs.find((d) => d.url.endsWith('/reference/hcl/blocks/'));
    expect(blocksDoc).toBeDefined();

    // H2 headings only (exclude H3/H4); unescape markdown \_ in names.
    const documented = [...blocksDoc!.content.matchAll(/(?<!#)##(?!#)\s+(.+?)\s+\[Section titled/g)]
      .map((m) => m[1].trim().replace(/\\_/g, '_').toLowerCase())
      .filter((name) => !NESTED_NOT_TOPLEVEL.has(name));

    // Guard against a vacuous pass: if the docs fixture format changed and the
    // regex extracted nothing, `documented` would be empty and every block
    // would appear "present". The pinned revision has 14 top-level blocks.
    expect(documented.length, 'no top-level block headings extracted — docs fixture format may have changed').toBeGreaterThanOrEqual(10);

    const manager = new HCLBlocksManager();
    const inCode = new Set(manager.listBlocks().map((b) => b.name));
    const missing = [...new Set(documented)].filter((name) => !inCode.has(name)).sort();
    expect(missing, `Documented upstream blocks missing from HCL_BLOCKS: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('modern HCL surface baseline (issue #244 AC4)', () => {
  const manager = new HCLBlocksManager();

  it('models the expansion nested block on dependency and unit', () => {
    for (const blockName of ['dependency', 'unit']) {
      const block = manager.getBlock(blockName);
      expect(block, blockName).not.toBeNull();
      const expansion = block?.attributes.find((a) => a.name === 'expansion');
      expect(expansion, `${blockName}.expansion`).toBeDefined();
      expect(expansion?.description).toContain('block-iteration');
    }
  });

  it('keeps unit and stack as top-level blocks', () => {
    expect(manager.getBlock('unit')).not.toBeNull();
    expect(manager.getBlock('stack')).not.toBeNull();
  });

  it('models the autoinclude nested block on unit and stack', () => {
    for (const blockName of ['unit', 'stack']) {
      const block = manager.getBlock(blockName);
      expect(block, blockName).not.toBeNull();
      const autoinclude = block?.attributes.find((a) => a.name === 'autoinclude');
      expect(autoinclude, `${blockName}.autoinclude`).toBeDefined();
    }
  });

  it('does not expose removed top-level attributes as blocks', () => {
    for (const removed of ['skip', 'retryable_errors', 'retry_max_attempts', 'retry_sleep_interval_sec']) {
      expect(manager.getBlock(removed), removed).toBeNull();
    }
  });
});
