#!/bin/bash
# Wrapper script to run the MCP server
cd "$(dirname "$0")"
exec node dist/index.js "$@"