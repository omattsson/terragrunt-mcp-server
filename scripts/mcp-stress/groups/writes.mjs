/**
 * writes: build_config file writing with FILE_WRITE_ENABLED=true and
 * ALLOWED_DIRS=<sandbox>. Every case runs against the sandbox only. Canary
 * files and the rest of the run directory are hashed before and after each
 * case: any change outside the sandbox is a critical escape.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ManagedSession } from '../lib/client.mjs';
import { snapshotDiff } from '../lib/oracles.mjs';
import { CANARY_MARKER, resetSandbox, restoreOutside, snapshotOutside } from '../lib/sandbox.mjs';

export const name = 'writes';
export function supports() {
  return null;
}

const HCL = 'locals {\n  stress = 1\n}\n';
const MB = 1024 * 1024;

/**
 * @typedef {object} WriteCase
 * @property {string} id
 * @property {(box: object) => void} [setup] host-side preparation inside the sandbox
 * @property {(p: (rel: string) => string, box: object) => object} args arguments for build_config; `p` gives a sandbox path
 * @property {{refuse?: string[], allow?: boolean, noEscape?: boolean}} expect
 */

function cases() {
  // Relative targets resolve the same on the host and inside a container mount
  const link = (target, at) => (box) => fs.symlinkSync(path.join('..', 'canary', target), path.join(box.sandbox, at));
  /** @type {WriteCase[]} */
  const list = [
    { id: 'control-plain-write', args: (p) => ({ content: HCL, path: p('ok.hcl') }), expect: { allow: true } },
    { id: 'control-unicode-name', args: (p) => ({ content: HCL, path: p('café 中.hcl') }), expect: { allow: true } },
    { id: 'traversal-dotdot', args: (p) => ({ content: HCL, path: p('../escape.hcl') }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'traversal-nested', args: (p) => ({ content: HCL, path: p('sub/../../escape.hcl') }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'traversal-dot-slash', args: (p) => ({ content: HCL, path: p('./../escape.hcl') }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'traversal-double-slash', args: (p) => ({ content: HCL, path: p('..//escape.hcl') }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'traversal-backslash', args: (p) => ({ content: HCL, path: p('..\\escape.hcl') }), expect: { noEscape: true } },
    { id: 'traversal-relative', args: () => ({ content: HCL, path: '../escape.hcl' }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'traversal-encoded-dots', args: (p) => ({ content: HCL, path: p('%2e%2e/escape.hcl') }), expect: { noEscape: true } },
    { id: 'traversal-encoded-slash', args: (p) => ({ content: HCL, path: p('..%2fescape.hcl') }), expect: { noEscape: true } },
    { id: 'traversal-encoded-both', args: (p) => ({ content: HCL, path: p('%2e%2e%2fescape.hcl') }), expect: { noEscape: true } },
    { id: 'traversal-unicode-dots', args: (p) => ({ content: HCL, path: p('‥/escape.hcl') }), expect: { noEscape: true } },
    { id: 'traversal-fullwidth-dots', args: (p) => ({ content: HCL, path: p('．．/escape.hcl') }), expect: { noEscape: true } },
    { id: 'relative-path-resolves-outside', args: () => ({ content: HCL, path: 'relative.hcl' }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    { id: 'tilde-path', args: () => ({ content: HCL, path: '~/escape.hcl' }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    { id: 'absolute-outside', args: (p, b) => ({ content: HCL, path: path.join(b.canary, 'abs-escape.hcl') }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    { id: 'sibling-prefix-dir', args: (p, b) => ({ content: HCL, path: path.join(b.base, 'sandbox-evil', 'x.hcl') }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    { id: 'nul-byte-in-path', args: (p) => ({ content: HCL, path: p('a\u0000.hcl') }), expect: { refuse: ['INVALID_PATH', 'UNKNOWN_ERROR', 'DISALLOWED_FILE_TYPE', 'VALIDATION_ERROR'] } },
    { id: 'nul-byte-then-traversal', args: (p) => ({ content: HCL, path: p('ok\u0000/../x.hcl') }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED', 'INVALID_PATH', 'UNKNOWN_ERROR', 'VALIDATION_ERROR'] } },
    { id: 'name-too-long', args: (p) => ({ content: HCL, path: p('a'.repeat(5000) + '.hcl') }), expect: { refuse: ['INVALID_PATH', 'UNKNOWN_ERROR'] } },
    { id: 'deep-path-400', args: (p) => ({ content: HCL, path: p('d/'.repeat(400) + 'x.hcl') }), expect: { noEscape: true } },
    { id: 'ext-sh', args: (p) => ({ content: HCL, path: p('x.sh') }), expect: { refuse: ['DISALLOWED_FILE_TYPE'] } },
    { id: 'ext-hcl-then-sh', args: (p) => ({ content: HCL, path: p('x.hcl.sh') }), expect: { refuse: ['DISALLOWED_FILE_TYPE'] } },
    { id: 'ext-none', args: (p) => ({ content: HCL, path: p('noext') }), expect: { refuse: ['DISALLOWED_FILE_TYPE'] } },
    { id: 'dotfile', args: (p) => ({ content: HCL, path: p('.hidden.hcl') }), expect: { refuse: ['DISALLOWED_FILE_TYPE'] } },
    { id: 'dot-directory', args: (p) => ({ content: HCL, path: p('.git/hooks/pre-commit.hcl') }), expect: { refuse: ['DISALLOWED_FILE_TYPE'] } },
    { id: 'ext-uppercase-ok', args: (p) => ({ content: HCL, path: p('UPPER.HCL') }), expect: { allow: true } },
    { id: 'symlink-file-to-canary', setup: link('secret.hcl', 'link.hcl'), args: (p) => ({ content: HCL, path: p('link.hcl'), overwrite: true }), expect: { refuse: ['SYMLINK_NOT_ALLOWED'] } },
    { id: 'symlink-dangling-to-canary', setup: link('not-yet.hcl', 'dangle.hcl'), args: (p) => ({ content: HCL, path: p('dangle.hcl'), overwrite: true }), expect: { refuse: ['SYMLINK_NOT_ALLOWED'] } },
    { id: 'symlink-dir-to-canary', setup: (box) => fs.symlinkSync(path.join('..', 'canary'), path.join(box.sandbox, 'linkdir')), args: (p) => ({ content: HCL, path: p('linkdir/new.hcl') }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    { id: 'symlink-dir-to-canary-nested-create', setup: (box) => fs.symlinkSync(path.join('..', 'canary'), path.join(box.sandbox, 'linkdir')), args: (p) => ({ content: HCL, path: p('linkdir/newdir/new.hcl'), createParentDirs: true }), expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] } },
    {
      id: 'hardlink-to-canary',
      setup: (box) => fs.linkSync(path.join(box.canary, 'secret.hcl'), path.join(box.sandbox, 'hard.hcl')),
      args: (p) => ({ content: HCL, path: p('hard.hcl'), overwrite: true }),
      expect: { refuse: ['HARDLINK_NOT_ALLOWED'] },
    },
    { id: 'oversize-1mb-plus-1', args: (p) => ({ content: 'a'.repeat(MB + 1), path: p('big.hcl') }), expect: { refuse: ['MAX_SIZE_EXCEEDED'] } },
    { id: 'oversize-5mb', args: (p) => ({ content: 'a'.repeat(5 * MB), path: p('big5.hcl') }), expect: { refuse: ['MAX_SIZE_EXCEEDED'] } },
    { id: 'multibyte-oversize', args: (p) => ({ content: '€'.repeat(MB / 2), path: p('euro.hcl') }), expect: { refuse: ['MAX_SIZE_EXCEEDED'] } },
    {
      id: 'overwrite-false-existing',
      setup: (box) => fs.writeFileSync(path.join(box.sandbox, 'exists.hcl'), 'original\n'),
      args: (p) => ({ content: HCL, path: p('exists.hcl'), overwrite: false }),
      expect: { refuse: ['FILE_EXISTS_NO_OVERWRITE'] },
      verify: (box) => (fs.readFileSync(path.join(box.sandbox, 'exists.hcl'), 'utf8') === 'original\n' ? null : 'existing file was modified although overwrite is false'),
    },
    {
      id: 'overwrite-true-with-backup',
      setup: (box) => fs.writeFileSync(path.join(box.sandbox, 'exists.hcl'), 'original\n'),
      args: (p) => ({ content: HCL, path: p('exists.hcl'), overwrite: true, createBackup: true }),
      expect: { allow: true },
    },
    { id: 'create-parent-dirs-outside', args: (p) => ({ content: HCL, path: p('../newdir/x.hcl'), createParentDirs: true }), expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] } },
    { id: 'create-parent-dirs-false-missing', args: (p) => ({ content: HCL, path: p('missing/x.hcl'), createParentDirs: false }), expect: { refuse: ['INVALID_PATH'] } },
    {
      id: 'compareWith-canary-absolute',
      args: (p, b) => ({ content: HCL, path: p('p.hcl'), preview: true, compareWith: path.join(b.canary, 'secret.hcl') }),
      expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES'] },
      leak: true,
    },
    {
      id: 'compareWith-traversal',
      args: (p) => ({ content: HCL, path: p('p.hcl'), preview: true, compareWith: p('../../canary/secret.hcl') }),
      expect: { refuse: ['PATH_TRAVERSAL_DETECTED'] },
      leak: true,
    },
    {
      id: 'compareWith-symlink-to-canary',
      setup: link('secret.hcl', 'cmp.hcl'),
      args: (p) => ({ content: HCL, path: p('p.hcl'), preview: true, compareWith: p('cmp.hcl') }),
      expect: { refuse: ['OUTSIDE_ALLOWED_DIRECTORIES', 'SYMLINK_NOT_ALLOWED'] },
      leak: true,
    },
    {
      id: 'compareWith-hardlink-to-canary',
      setup: (box) => fs.linkSync(path.join(box.canary, 'secret.hcl'), path.join(box.sandbox, 'cmp2.hcl')),
      args: (p) => ({ content: HCL, path: p('p.hcl'), preview: true, compareWith: p('cmp2.hcl') }),
      expect: { refuse: ['HARDLINK_NOT_ALLOWED'] },
      leak: true,
    },
    { id: 'preview-writes-nothing', args: (p) => ({ content: HCL, path: p('preview-only.hcl'), preview: true }), expect: { allow: true }, verify: (box) => (fs.existsSync(path.join(box.sandbox, 'preview-only.hcl')) ? 'preview created a file' : null) },
  ];
  return list;
}

function bodyOf(result) {
  try {
    return JSON.parse(result?.content?.[0]?.text ?? '');
  } catch {
    return undefined;
  }
}

function verdict(result) {
  const body = bodyOf(result);
  const preview = body?.preview === true;
  const success = preview ? body.previewResult?.success === true : body?.success === true && result?.isError !== true;
  const errorType = body?.errorType ?? body?.previewResult?.errorType ?? body?.writeResult?.errorType;
  return { body, success, errorType };
}

export async function run(ctx) {
  const { report, box, opts } = ctx;
  const writeSpec = { writes: true, mode: opts.mode };
  const toTarget = ctx.spec(writeSpec).hostToTarget;
  const session = await new ManagedSession(ctx, { group: name, specOptions: writeSpec }).start();
  const notes = [];
  let ran = 0;

  const escapeFindings = (id, before, after, repro) => {
    const diff = snapshotDiff(before, after);
    const touched = [...diff.changed, ...diff.created, ...diff.removed].map((f) => path.relative(box.base, f));
    if (touched.length > 0) {
      report.add({
        severity: 'critical',
        group: name,
        kind: 'write-escape',
        tool: 'build_config',
        title: `Write escaped the sandbox: ${id}`,
        expected: 'nothing outside ALLOWED_DIRS is created, changed or removed',
        actual: `changed: [${diff.changed.map((f) => path.relative(box.base, f))}] created: [${diff.created.map((f) => path.relative(box.base, f))}] removed: [${diff.removed.map((f) => path.relative(box.base, f))}] (relative to the run directory)`,
        reproducer: repro,
      });
    }
    return touched.length > 0;
  };

  try {
    for (const c of cases()) {
      resetSandbox(box);
      restoreOutside(box);
      c.setup?.(box);
      const before = snapshotOutside(box);
      const pj = (rel) => toTarget(box.sandbox) + '/' + rel;
      const args = c.args(pj, { ...box, canary: toTarget(box.canary), base: toTarget(box.base), sandbox: toTarget(box.sandbox) });
      const repro = { target: ctx.targetName, tool: 'build_config', caseId: c.id, arguments: args, sandbox: 'a fresh mkdtemp directory', seed: opts.seed };
      const r = await session.call('build_config', args, { label: c.id, caseId: c.id, checkShape: false });
      ran += 1;
      const after = snapshotOutside(box);
      const escaped = escapeFindings(c.id, before, after, repro);

      const text = r.result?.content?.[0]?.text ?? '';
      if (c.leak && text.includes(CANARY_MARKER)) {
        report.add({
          severity: 'critical',
          group: name,
          kind: 'read-escape',
          tool: 'build_config',
          title: `File outside the sandbox was read: ${c.id}`,
          expected: 'compareWith is confined to ALLOWED_DIRS',
          actual: 'the reply contains the canary file content',
          reproducer: repro,
        });
      }
      if (r.timedOut || r.error) continue; // reported as hang/crash by the session
      const v = verdict(r.result);
      const e = c.expect;
      if (e.refuse) {
        if (v.success) {
          if (!escaped) {
            report.add({
              severity: 'high',
              group: name,
              kind: 'guard-bypass',
              tool: 'build_config',
              title: `Write guard did not refuse: ${c.id}`,
              expected: `refused with ${e.refuse.join(' or ')}`,
              actual: 'the write succeeded',
              reproducer: repro,
            });
          }
        } else if (!e.refuse.includes(v.errorType)) {
          report.add({
            severity: 'medium',
            group: name,
            kind: 'error-code',
            tool: 'build_config',
            title: `Unexpected error code for ${c.id}: ${v.errorType}`,
            expected: e.refuse.join(' or '),
            actual: `errorType=${v.errorType}; error=${String(v.body?.error ?? v.body?.previewResult?.error ?? text).slice(0, 200)}`,
            reproducer: repro,
          });
        }
      } else if (e.allow && !v.success) {
        report.add({
          severity: 'medium',
          group: name,
          kind: 'unexpected-refusal',
          tool: 'build_config',
          title: `A legitimate write inside the sandbox was refused: ${c.id}`,
          expected: 'success',
          actual: `errorType=${v.errorType}; error=${String(v.body?.error ?? text).slice(0, 200)}`,
          reproducer: repro,
        });
      }
      const problem = c.verify?.(box);
      if (problem) {
        report.add({ severity: 'high', group: name, kind: 'guard-bypass', tool: 'build_config', title: `${c.id}: ${problem}`, expected: 'refused request leaves files untouched', actual: problem, reproducer: repro });
      }
    }

    // Concurrent writes to one file: the result must be exactly one of the writers' contents
    resetSandbox(box);
    restoreOutside(box);
    const target = toTarget(box.sandbox) + '/concurrent.hcl';
    const writers = 40;
    const bodies = Array.from({ length: writers }, (_, i) => `# writer ${i}\n` + `x${i} = "${String(i).repeat(2000)}"\n`.repeat(20));
    const before = snapshotOutside(box);
    const results = await Promise.all(bodies.map((content) => session.session.call('build_config', { content, path: target, overwrite: true, createBackup: false }, 20000)));
    ran += writers;
    await session.checkpoint('build_config', { caseId: 'concurrent-writes', writers });
    escapeFindings('concurrent-writes', before, snapshotOutside(box), { target: ctx.targetName, tool: 'build_config', caseId: 'concurrent-writes', writers });
    const final = fs.existsSync(path.join(box.sandbox, 'concurrent.hcl')) ? fs.readFileSync(path.join(box.sandbox, 'concurrent.hcl'), 'utf8') : null;
    const okCount = results.filter((r) => r.result && verdict(r.result).success).length;
    if (okCount > 0 && !bodies.includes(final)) {
      report.add({
        severity: 'medium',
        group: name,
        kind: 'write-interleaving',
        tool: 'build_config',
        title: 'Concurrent writes to one file produced content that matches no single writer',
        expected: 'the file holds exactly one writer\'s content',
        actual: final === null ? 'file missing' : `file of ${final.length} chars matches none of the ${writers} writers`,
        reproducer: { target: ctx.targetName, tool: 'build_config', writers, path: 'concurrent.hcl', seed: opts.seed },
      });
    }
    notes.push(`${ran} write calls`);
  } finally {
    await session.close();
  }

  // Configuration gates: writing disabled, and enabled without an allowlist
  const gates = [
    { id: 'writes-disabled', specOptions: { writes: false, mode: opts.mode }, expect: ['FILE_WRITING_DISABLED'] },
    { id: 'no-allowed-dirs', specOptions: { writes: true, mode: opts.mode, extraEnv: { TERRAGRUNT_MCP_ALLOWED_DIRS: '' } }, expect: ['NO_ALLOWED_DIRECTORIES'] },
  ];
  for (const gate of gates) {
    resetSandbox(box);
    restoreOutside(box);
    const s = await new ManagedSession(ctx, { group: name, specOptions: gate.specOptions }).start();
    try {
      const before = snapshotOutside(box);
      const args = { content: HCL, path: toTarget(box.sandbox) + '/gate.hcl' };
      const repro = { target: ctx.targetName, tool: 'build_config', caseId: gate.id, arguments: args, env: gate.specOptions.extraEnv ?? {} };
      const r = await s.call('build_config', args, { label: gate.id, caseId: gate.id, checkShape: false });
      escapeFindings(gate.id, before, snapshotOutside(box), repro);
      const v = verdict(r.result);
      const created = fs.existsSync(path.join(box.sandbox, 'gate.hcl'));
      if (v.success || created) {
        report.add({ severity: 'high', group: name, kind: 'guard-bypass', tool: 'build_config', title: `Configuration gate not enforced: ${gate.id}`, expected: gate.expect.join(' or '), actual: created ? 'the file was written' : 'the call succeeded', reproducer: repro });
      } else if (r.result && !gate.expect.includes(v.errorType)) {
        report.add({ severity: 'medium', group: name, kind: 'error-code', tool: 'build_config', title: `Unexpected error code for ${gate.id}: ${v.errorType}`, expected: gate.expect.join(' or '), actual: `errorType=${v.errorType}`, reproducer: repro });
      }
    } finally {
      await s.close();
    }
  }
  return { notes };
}
