---
name: code-review
description: 'Review code changes, pull requests, branches, commits, and diffs in the Terragrunt MCP Server. Use when asked for a code review, PR review, regression analysis, risk assessment, review comments, or merge-readiness check.'
argument-hint: 'Optionally specify a PR, branch, commit, file, or review focus'
---

# Terragrunt MCP Server Code Review

Review changes for concrete defects, behavioral regressions, security risks, contract drift, and missing tests. Findings are the primary output; implementation summaries are secondary.

## Procedure

1. Establish the review target and comparison base. For a pull request, read its description, changed files, review threads, and status checks.
2. Check the worktree before running commands. Never include unrelated local changes in the review target.
3. Read the smallest owning code path for each changed behavior, plus its nearest tests and call sites.
4. Verify suspected defects with a focused test, type check, executable reproduction, or authoritative upstream source when practical.
5. Report only actionable findings caused or exposed by the reviewed change. Separate pre-existing problems from regressions.
6. If no findings remain, say so explicitly and identify residual test gaps or unverified risks.

## Repository Review Checklist

- Preserve ES module `.js` extensions in TypeScript imports.
- Keep MCP tool names, schemas, mode configuration, handler routing, and manager dependencies consistent.
- Ensure unexpected failures become valid MCP error responses at request boundaries; allow intentional initialization failures for invalid configuration.
- Check all five server modes when tools or dependencies change: `FULL`, `CORE`, `CONFIG`, `GUIDANCE`, and `OBSERVABILITY`.
- Verify template behavior at the actual `TemplatesManager` construction site; loader priority alone does not prove a loader is active.
- Treat static Terragrunt CLI, HCL, function, schema, error, and guidance data as drift-prone. Compare claims with current authoritative Terragrunt sources.
- Review file-writing changes for path validation, allowed-directory enforcement, overwrite behavior, backups, and parent-directory handling.
- Require focused tests for narrow changes and broader validation for shared tool schemas, mode wiring, or user-facing workflows.
- Build before tests that execute `dist/`; TypeScript-native unit tests do not require a prior build.
- Do not approve automatic backend schema updates without human review of additions, removals, and deprecations.

## Validation Commands

Choose the narrowest relevant command first:

```bash
npm run test:unit -- test/unit/<target>.test.ts
npm run build
npm run lint
npm run test:unit
npm run test:all
npm run verify-modes
npm run check-schema-drift
```

Integration tests that execute compiled output require `npm run build` first.

## Finding Format

Order findings by severity. Each finding must include:

- A concise defect statement.
- The user or system impact.
- A workspace-relative file and line reference.
- The concrete condition that triggers the problem.
- A minimal remediation direction when it is not obvious.

Do not lead with praise, a change summary, or a walkthrough. Avoid speculative findings that cannot be tied to changed behavior or a verifiable contract.

## Addressing Review Comments

When asked to fix review feedback:

1. Group unresolved threads by file and determine whether each comment is valid.
2. Make the smallest correct change for one related group.
3. Run the focused validation that can falsify the fix.
4. Commit and push only when requested or when continuing an explicitly requested PR-update workflow.
5. Resolve a review thread only after its fix is pushed or a deliberate response explains why no change is needed.