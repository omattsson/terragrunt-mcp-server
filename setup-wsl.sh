#!/bin/bash

# Terragrunt MCP Server WSL Setup Script

echo "🔧 Setting up Terragrunt MCP Server for WSL..."

# Check if we're in WSL
if ! grep -qi microsoft /proc/version; then
    echo "❌ This script should be run inside WSL"
    exit 1
fi

echo "✅ Detected WSL environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Get the current directory
CURRENT_DIR=$(pwd)
echo "📁 Working directory: $CURRENT_DIR"

# Build the project
echo "🏗️  Building the MCP server..."
npm install
npm run build

# Test the build
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed - dist/index.js not found"
    exit 1
fi

# Make the script executable
chmod +x dist/index.js

# Test the server
echo "🧪 Testing the server..."
npm run test:server

if [ $? -eq 0 ]; then
    echo "✅ Server test passed!"
else
    echo "⚠️  Server test had issues, but continuing..."
fi

# Generate VS Code settings
echo ""
echo "📋 Add this to your VS Code settings.json:"
echo ""
echo "{"
echo "  \"mcp.servers\": {"
echo "    \"terragrunt\": {"
echo "      \"command\": \"wsl\","
echo "      \"args\": ["
echo "        \"node\","
echo "        \"$CURRENT_DIR/dist/index.js\""
echo "      ],"
echo "      \"env\": {"
echo "        \"NODE_PATH\": \"$CURRENT_DIR/node_modules\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""

# Create a test script
cat > test-mcp.sh << 'EOF'
#!/bin/bash
echo "Testing MCP server directly..."
cd "$(dirname "$0")"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js
EOF

chmod +x test-mcp.sh

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open VS Code with 'code .' or through Remote-WSL"
echo "2. Add the configuration above to your VS Code settings.json"
echo "3. Restart VS Code"
echo "4. Test with: ./test-mcp.sh"
echo ""
echo "📖 For detailed instructions, see WSL-SETUP.md"