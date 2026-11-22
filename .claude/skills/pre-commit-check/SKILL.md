---
name: pre-commit-check
description: Run build, lint and unit tests, review the diff, then draft a Conventional Commit message. Use before any commit.
---

1. Run `npm run build`, `npm run lint` and `npm run test:unit`. Stop and report on any failure with the real output.
2. Review the diff (`git diff` and staged changes) with the `mcp-safety-reviewer` agent. Fix or report its findings.
3. Draft a Conventional Commit message (see `CONTRIBUTING.md`) ending with the attribution line from the session context.
4. Show the message and the file list. Do not commit or push until the user says so.
