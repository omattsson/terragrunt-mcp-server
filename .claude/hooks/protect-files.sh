#!/bin/bash
# PreToolUse: block edits to files that need human review or are generated.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */schemas/backends/*.json)
    echo "Backend schema changes need human review. Report the drift instead of editing." >&2; exit 2 ;;
  */package-lock.json|*/fixtures/terragrunt-docs-fixture.json|*/fixtures/terragrunt-experiments.json|*/src/terragrunt/docs-manifest.ts|*/dist/*)
    echo "$f is generated or locked. Do not edit it by hand." >&2; exit 2 ;;
esac
exit 0
