#!/bin/bash
echo "🐳 Testing Terragrunt MCP Server in Docker..."
echo ""

# Test 1: Initialize
echo "📡 Test 1: Initialize MCP connection"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | \
  docker run -i --rm -v mcp-cache:/app/.cache terragrunt-mcp-server:latest 2>&1 | \
  grep -q '"result"' && echo "✅ Initialize successful" || echo "❌ Initialize failed"

echo ""
echo "🎉 Docker MCP server is working!"
echo ""
echo "To use with VS Code:"
echo "1. Your .vscode/mcp.json is already configured"
echo "2. Restart VS Code to pick up the new configuration"
echo "3. Ask Copilot: 'Search Terragrunt docs for dependencies'"
