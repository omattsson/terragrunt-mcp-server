#!/bin/bash
# PostToolUse: flag stdout writes in src/ (they corrupt the MCP JSON-RPC stream).
# Runs after the edit, so it reports to Claude rather than preventing the write.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */src/*.ts) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0
hits=$(grep -nE 'process\.stdout\.write|console\.(log|info|debug)\(' "$f" | grep -vE '^[0-9]+:[[:space:]]*(\*|//|/\*)')
if [ -n "$hits" ]; then
  echo "stdout write in $f breaks the MCP stream. Use console.error instead:" >&2
  echo "$hits" >&2
  exit 2
fi
exit 0
