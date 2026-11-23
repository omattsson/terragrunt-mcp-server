/**
 * fuzz: schema-driven, seeded arguments for every tool in tools/list.
 * Oracles (see ManagedSession): no crash, no hang, no stack trace or install
 * path in the reply, consistent isError shape, stdout stays JSON-RPC.
 */
import { ManagedSession } from '../lib/client.mjs';
import { generateArgs } from '../lib/payloads.mjs';

export const name = 'fuzz';
export function supports() {
  return null;
}

export async function run(ctx) {
  const { opts, report } = ctx;
  const session = await new ManagedSession(ctx, { group: name }).start();
  let total = 0;
  const perTool = {};
  try {
    const { tools } = await session.session.listTools(10000);
    for (const tool of tools) {
      const cases = generateArgs(tool, { seed: opts.seed, quick: opts.quick });
      let errors = 0;
      for (const c of cases) {
        const r = await session.call(tool.name, c.args, { label: c.label, caseId: c.id });
        total += 1;
        if (r.error || r.result?.isError) errors += 1;
      }
      perTool[tool.name] = { cases: cases.length, errorReplies: errors };
    }
  } finally {
    await session.close();
  }
  report.metrics.fuzz = { seed: opts.seed, quick: opts.quick, totalCalls: total, perTool, serverRestarts: session.restarts };
  return { notes: [`${total} calls`] };
}
