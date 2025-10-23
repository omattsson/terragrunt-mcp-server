# Terragrunt MCP Server Setup Guide

## Quick Start

Your Terragrunt MCP server has been successfully implemented! Here's how to get it running with VS Code and Copilot.

## What's Implemented

✅ **Complete Documentation Integration**

- Fetches live Terragrunt documentation (84 pages found!)
- Smart caching system (24-hour refresh)
- Full-text search across all documentation
- Organized by sections (getting-started, reference, features, etc.)

✅ **MCP Tools**

- `search_terragrunt_docs` - Search documentation
- `get_terragrunt_sections` - List all sections  
- `get_section_docs` - Get docs by section

✅ **MCP Resources**

- Documentation overview
- Section-based collections
- Individual pages as resources

## Setup Instructions

### 1. Build the Server

```bash
cd /home/olof/git/github/terragrunt-mcp-server
npm run build
```

### 2. Test the Server (Optional)

```bash
npm run test:server
```

### 3. Configure VS Code

Add this to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["/home/olof/git/github/terragrunt-mcp-server/dist/index.js"]
    }
  }
}
```

### 4. Start Using with Copilot

Once configured, you can ask Copilot questions like:

- "Search Terragrunt docs for dependency configuration"
- "How do I set up remote state in Terragrunt?"
- "Show me Terragrunt best practices"
- "What are Terragrunt generate blocks?"

## File Structure Created

```
/home/olof/git/github/terragrunt-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── handlers/
│   │   ├── resources.ts         # Documentation resources
│   │   └── tools.ts            # Search and utility tools
│   └── terragrunt/
│       ├── docs.ts             # Documentation fetcher (⭐ core feature)
│       └── commands.ts         # Terragrunt command utilities
├── dist/                       # Compiled JavaScript
├── package.json               # Updated dependencies
├── mcp-config.json           # MCP configuration
└── test/server-test.js       # Test script
```

## Key Features

### Documentation Manager (`src/terragrunt/docs.ts`)

- Automatically discovers documentation from terragrunt.gruntwork.io
- Extracts clean content from web pages
- Caches documentation locally for performance
- Provides search and filtering capabilities

### Resource Handler (`src/handlers/resources.ts`)

- Exposes documentation as MCP resources
- Organizes content by sections
- Provides overview and individual page access

### Tool Handler (`src/handlers/tools.ts`)

- Search across all documentation
- List available sections
- Get section-specific documentation

## Development

- `npm run dev` - Run in development mode
- `npm run build` - Build TypeScript
- `npm run test:server` - Test the server functionality

## Next Steps

1. **Configure VS Code** with the settings above
2. **Restart VS Code** to load the MCP server
3. **Test with Copilot** using Terragrunt-related questions
4. **Customize** the server for your specific needs

The server will automatically fetch and cache the latest Terragrunt documentation when first used!
