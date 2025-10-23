# Running Terragrunt MCP Server in VS Code with Remote WSL

## Overview

To run the Terragrunt MCP server in VS Code with remote WSL, you need to configure the MCP server to be accessible from the Windows host while running in the WSL environment.

## Prerequisites

1. **WSL2** installed and configured
2. **VS Code** with the **Remote - WSL** extension
3. **Node.js** installed in WSL
4. **MCP extension** for VS Code

## Setup Steps

### 1. Build the MCP Server in WSL

First, ensure your Terragrunt MCP server is built in the WSL environment:

```bash
# In WSL terminal
cd /home/olof/git/github/terragrunt-mcp-server
npm install
npm run build
```

### 2. Create WSL-Compatible MCP Configuration

The MCP server needs to be configured differently for WSL. Create a WSL-specific configuration:

**Option A: Direct WSL Path (Recommended)**

In your VS Code `settings.json` (accessible via Ctrl+Shift+P → "Preferences: Open Settings (JSON)"):

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "wsl",
      "args": [
        "node",
        "/home/olof/git/github/terragrunt-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_PATH": "/home/olof/git/github/terragrunt-mcp-server/node_modules"
      }
    }
  }
}
```

**Option B: Using WSL Script Wrapper**

Create a wrapper script to handle the WSL execution:

1. Create `wsl-mcp-wrapper.bat` in Windows:

```batch
@echo off
wsl cd /home/olof/git/github/terragrunt-mcp-server && node dist/index.js
```

2. Then configure in VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "C:\\path\\to\\wsl-mcp-wrapper.bat"
    }
  }
}
```

### 3. Test the Configuration

1. **Open VS Code with Remote WSL:**
   - Open VS Code
   - Press `Ctrl+Shift+P`
   - Type "WSL: Connect to WSL"
   - Select your WSL distribution

2. **Verify MCP Server:**
   - Check VS Code status bar for MCP connection
   - Open a terminal in VS Code and test the server:

   ```bash
   cd /home/olof/git/github/terragrunt-mcp-server
   npm run test:server
   ```

### 4. Alternative: Run MCP Server as Service

For better reliability, you can run the MCP server as a background service:

**Create systemd service file:**

```bash
# In WSL
sudo nano /etc/systemd/user/terragrunt-mcp.service
```

**Service configuration:**

```ini
[Unit]
Description=Terragrunt MCP Server
After=network.target

[Service]
Type=simple
User=olof
WorkingDirectory=/home/olof/git/github/terragrunt-mcp-server
ExecStart=/usr/bin/node /home/olof/git/github/terragrunt-mcp-server/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

**Enable and start the service:**

```bash
systemctl --user daemon-reload
systemctl --user enable terragrunt-mcp.service
systemctl --user start terragrunt-mcp.service
```

### 5. Network-Based Approach (Advanced)

If stdio doesn't work well across WSL boundary, you can modify the server to use TCP:

**Create a TCP-enabled version:**

```typescript
// src/server-tcp.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';

const app = express();
const port = 3001;

// ... (your existing server setup)

app.use('/mcp', async (req, res) => {
  const transport = new SSEServerTransport('/mcp', res);
  await server.connect(transport);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`MCP Server listening on http://127.0.0.1:${port}`);
});
```

**Then configure in VS Code:**

```json
{
  "mcp.servers": {
    "terragrunt": {
      "url": "http://127.0.0.1:3001/mcp"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied:**

   ```bash
   chmod +x /home/olof/git/github/terragrunt-mcp-server/dist/index.js
   ```

2. **Node.js Not Found:**

   ```bash
   # Verify Node.js path in WSL
   which node
   # Use full path in configuration
   ```

3. **Module Resolution Issues:**

   ```bash
   # Ensure all dependencies are installed
   cd /home/olof/git/github/terragrunt-mcp-server
   npm install
   npm run build
   ```

4. **WSL Path Issues:**
   - Use forward slashes in WSL paths
   - Ensure the path exists: `ls -la /home/olof/git/github/terragrunt-mcp-server/dist/index.js`

### Debug Commands

```bash
# Test MCP server directly in WSL
cd /home/olof/git/github/terragrunt-mcp-server
node dist/index.js

# Test with stdio
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js

# Check logs
journalctl --user -u terragrunt-mcp.service -f
```

## Testing the Setup

Once configured, test the MCP integration:

1. **Open VS Code in WSL mode**
2. **Create a new file with Terragrunt content**
3. **Ask Copilot Terragrunt-related questions:**
   - "Search Terragrunt docs for dependency configuration"
   - "How do I set up remote state in Terragrunt?"
   - "Show me Terragrunt generate block examples"

The MCP server should provide relevant documentation and suggestions through Copilot.

## Performance Considerations

- **Caching:** The server caches documentation for 24 hours
- **Network:** WSL2 has good network performance for MCP communication
- **Memory:** Monitor memory usage if running as a service
- **Startup:** First documentation fetch may take 10-30 seconds

## Security Notes

- The MCP server fetches documentation from terragrunt.gruntwork.io
- No sensitive data is transmitted
- Server runs with user permissions only
- Consider firewall rules if using TCP approach
