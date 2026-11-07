# Terragrunt MCP Server

@.github/copilot-instructions.md

The imported file is shared with GitHub Copilot code review. Put rules for both tools there; put only Claude Code specifics here.

## Claude Code

- Run `npm run build` before the integration tests, and `npm run lint` and `npm run test:unit` before a commit.
- Never print to stdout from `src/` (also not while debugging): it breaks the MCP stream. Use `console.error`.
- Backend schema changes (`schemas/backends/*.json`) need human review: report the drift, do not update the schema on your own.
