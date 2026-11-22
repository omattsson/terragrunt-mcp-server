---
name: add-tool
description: Checklist for adding a new MCP tool, or moving a tool between server modes, without drift between code, mode config, tests and docs.
disable-model-invocation: true
---

Adding or moving a tool: $ARGUMENTS

Work through every step. Report any step you skip and why.

1. **Schema and handler** in `src/handlers/tools.ts`: add the tool schema and a case in the `switch (name)` of `executeToolInternal()`. Never throw: return `{ error: '...' }` or `success: false` so `isErrorResult` sees it. No stdout; use `console.error`.
2. **Manager**: if the tool needs a domain manager, add it in `src/terragrunt/` (case-insensitive keys via `normalizeKey`) and wire it in `ToolHandler.initializeManagers()`.
3. **Modes**: update `MODE_CONFIGS` in `src/modes/config.ts` (tool list and dependency list for each mode that exposes it).
4. **Tests**: add unit tests; update `test/unit/modes/config.test.ts` and `test/integration/multi-mode.test.ts` (per-mode tool counts). Mock `TerragruntDocsManager` (see `test/unit/tool-handler.test.ts`).
5. **Imports** use the `.js` extension.
6. **Docs**: update `README.md`, `docs/Available-Tools.md` and `docs/Copilot-Instructions-Template.md` if tool selection changes. If the tool count changes, find every mention: `grep -rnE '\b[0-9]+ tools' README.md docs .github`.
7. **Verify**: `npm run build && npm run lint && npm run test:all`.
