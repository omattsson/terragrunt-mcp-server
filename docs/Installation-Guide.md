# Installation Guide

This guide walks you through installing the Terragrunt MCP Server for use with VS Code and GitHub Copilot.

## Prerequisites

Before installing, ensure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm or yarn** - Comes with Node.js
- **VS Code** with GitHub Copilot - [VS Code](https://code.visualstudio.com/), [Copilot](https://github.com/features/copilot)
- **Git** - For cloning the repository

## Installation Methods

### Method 1: Direct Installation (Recommended)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/omattsson/terragrunt-mcp-server.git
   cd terragrunt-mcp-server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

   This compiles TypeScript to JavaScript in the `dist/` directory.

### Method 2: Docker Installation

See the [Docker Deployment](Docker-Deployment) guide for running in Docker.

## VS Code Configuration

After installation, configure VS Code to use the MCP server:

1. **Open VS Code Settings (JSON)**

   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: "Preferences: Open User Settings (JSON)"
   - Press Enter

2. **Add MCP Server Configuration**

   Add the following to your `settings.json`:

   ```json
   {
     "mcp.servers": {
       "terragrunt": {
         "command": "node",
         "args": ["/absolute/path/to/terragrunt-mcp-server/dist/index.js"]
       }
     }
   }
   ```

   **Important**: Replace `/absolute/path/to/terragrunt-mcp-server` with the actual absolute path where you cloned the repository.

3. **Restart VS Code**

   Close and reopen VS Code to activate the MCP server.

## Development Mode (Optional)

For development with hot-reload, use:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/terragrunt-mcp-server"
    }
  }
}
```

This runs the server with `ts-node`, recompiling on changes.

## Verification

To verify the installation is working:

1. **Open a new chat in GitHub Copilot**

2. **Ask a Terragrunt question:**

   ```
   Search Terragrunt docs for getting started
   ```

3. **Expected behavior:**

   - Copilot should use the MCP server to fetch documentation
   - You'll see relevant Terragrunt documentation in the response

## Troubleshooting Installation

### MCP Server Not Found

**Symptom**: VS Code doesn't recognize the MCP server

**Solutions**:

- Verify the absolute path in `settings.json` is correct
- Ensure `dist/index.js` exists (run `npm run build`)
- Check VS Code output panel for errors
- Restart VS Code completely

### Permission Denied

**Symptom**: Error about file permissions

**Solutions**:

```bash
chmod +x dist/index.js
```

### Node Version Issues

**Symptom**: Syntax errors or module not found

**Solutions**:

- Verify Node.js version: `node --version` (should be 18+)
- Update Node.js if needed
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Port Already in Use

**Symptom**: MCP server fails to start

**Solutions**:

- MCP uses stdio, not ports, so this shouldn't happen
- If you see port errors, check for other MCP servers running

## Advanced Configuration

### Server Mode Selection

The server supports different modes to optimize token usage:

| Mode | Tools | Token Cost | Use Case |
|------|-------|------------|----------|
| `full` | All 8 tools | ~2,400 tokens | General assistance |
| `core` | 4 docs tools | ~965 tokens | Documentation lookup |
| `config` | 2 config tools | ~640 tokens | Config generation |
| `guidance` | 2 guidance tools | ~680 tokens | Best practices |

Configure via environment variable in `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/dist/index.js"],
      "env": {
        "TERRAGRUNT_MCP_MODE": "core"
      }
    }
  }
}
```

### Multi-Server Configuration (Mode Aliases)

Register multiple server entries for different workflows. This gives Copilot more descriptive server names:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/dist/index.js"],
      "env": { "TERRAGRUNT_MCP_MODE": "full" }
    },
    "terragrunt-docs": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/dist/index.js"],
      "env": { "TERRAGRUNT_MCP_MODE": "core" }
    },
    "terragrunt-config": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/dist/index.js"],
      "env": { "TERRAGRUNT_MCP_MODE": "config" }
    }
  }
}
```

### MCP Server Sampling Settings

For consistent Copilot behavior, configure model allowlists:

```json
{
  "chat.mcp.serverSampling": {
    "terragrunt": {
      "enabled": true,
      "allowedModels": ["gpt-4", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TERRAGRUNT_MCP_MODE` | Server mode (full, core, config, guidance, observability) | `full` |
| `TERRAGRUNT_MCP_FILE_WRITE_ENABLED` | Enable file writing | `true` |
| `TERRAGRUNT_MCP_AUTO_BACKUP` | Auto-backup before overwrite | `true` |
| `TERRAGRUNT_MCP_ALLOWED_DIRS` | Comma-separated allowed write paths | Current directory |
| `TERRAGRUNT_MCP_MAX_FILE_SIZE` | Max file size in bytes | `1048576` (1MB) |

## Copilot Tool Selection

For optimal tool discovery, add the User Tool Selection Guide from `.github/copilot-instructions.md` to your workspace's Copilot instructions. This helps Copilot automatically choose Terragrunt MCP tools for relevant questions.

## Next Steps

- [Quick Start Tutorial](Quick-Start-Tutorial) - Learn how to use the server
- [Available Tools](Available-Tools) - Explore the 8 documentation tools
- [Configuration](Configuration) - Advanced configuration options

## Getting Help

- Check [Troubleshooting](Troubleshooting) for common issues
- Visit [FAQ](FAQ) for frequently asked questions
- Ask in [GitHub Discussions](https://github.com/omattsson/terragrunt-mcp-server/discussions)
