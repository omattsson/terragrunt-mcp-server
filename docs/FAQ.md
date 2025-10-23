# Frequently Asked Questions (FAQ)

Common questions and answers about the Terragrunt MCP Server.

## General Questions

### What is the Terragrunt MCP Server?

The Terragrunt MCP Server is a **Model Context Protocol (MCP) server** that provides AI assistants like GitHub Copilot with access to comprehensive Terragrunt documentation. It enables natural language queries about Terragrunt features, commands, and configuration directly within VS Code.

### What is MCP?

**Model Context Protocol (MCP)** is a standardized protocol for connecting AI assistants to external data sources and tools. It allows LLMs to access real-time information, documentation, and services without requiring manual copy-pasting or web searches.

### Why do I need this?

Instead of switching between VS Code and browser documentation, you can:
- Ask Copilot questions about Terragrunt directly in chat
- Get accurate, up-to-date documentation instantly
- Find CLI command help without leaving your editor
- Search for HCL configuration examples
- Get code snippets and best practices

## Installation & Setup

### What are the prerequisites?

- **Node.js**: Version 18 or higher
- **VS Code**: Latest version recommended
- **GitHub Copilot**: Active subscription
- **npm**: Usually comes with Node.js

### How do I install it?

See the [Installation Guide](Installation-Guide) for detailed steps. Quick version:

```bash
npm install -g terragrunt-mcp-server
```

Then configure VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "terragrunt-mcp-server"
    }
  }
}
```

### Can I use it without installing globally?

Yes! You can use npx:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "npx",
      "args": ["terragrunt-mcp-server"]
    }
  }
}
```

Or clone and build locally:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["path/to/terragrunt-mcp-server/dist/index.js"]
    }
  }
}
```

### Does it work with Docker?

Yes! See [Docker Deployment](Docker-Deployment) for full instructions:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "omattsson/terragrunt-mcp-server:latest"]
    }
  }
}
```

### How do I verify it's working?

1. Restart VS Code after configuration
2. Open GitHub Copilot Chat
3. Ask: "What Terragrunt tools are available?"
4. If configured correctly, Copilot will list 6 documentation tools

### Why isn't it working in VS Code?

**Common issues**:

1. **MCP not enabled**: Check VS Code settings for MCP configuration
2. **Path issues**: Use absolute paths in configuration
3. **Node.js version**: Must be 18+, check with `node --version`
4. **Missing build**: If running from source, ensure `npm run build` was run
5. **Restart required**: Always restart VS Code after config changes

See [Troubleshooting](Troubleshooting) for more solutions.

## Usage Questions

### What can I ask it?

Examples of questions you can ask GitHub Copilot:

- "How do I configure remote state in Terragrunt?"
- "What are Terragrunt's global flags?"
- "Show me Terragrunt dependency examples"
- "How do I use terragrunt run-all?"
- "What HCL blocks are available in terragrunt.hcl?"
- "Find examples of before_hook configuration"

### What tools are available?

Six specialized tools:

1. `search_terragrunt_docs` - General documentation search
2. `get_terragrunt_sections` - List documentation sections
3. `get_section_docs` - Get all docs from a section
4. `get_cli_command_help` - Find CLI command help
5. `get_hcl_config_reference` - Find HCL configuration docs
6. `get_code_examples` - Extract code snippets

See [Available Tools](Available-Tools) for detailed information.

### Do I call these tools directly?

No! You interact with GitHub Copilot in natural language, and Copilot automatically decides which tools to use based on your question.

**You don't see the tools** - Copilot uses them behind the scenes.

### How is this different from asking Copilot without MCP?

| Without MCP | With MCP Server |
|-------------|-----------------|
| Copilot uses training data (may be outdated) | Real-time access to latest docs |
| General knowledge only | Specific, accurate Terragrunt docs |
| May hallucinate details | Grounded in actual documentation |
| No code examples | Access to official code snippets |
| Limited to model's knowledge cutoff | Always current documentation |

### Can I use this in my projects?

Yes! The server provides documentation access regardless of whether your project uses Terragrunt. However, it's most useful when you're:

- Writing Terragrunt configurations
- Debugging Terragrunt issues
- Learning Terragrunt features
- Migrating to Terragrunt

## Technical Questions

### Where does the documentation come from?

The server fetches documentation from the official Terragrunt website:
`https://terragrunt.gruntwork.io/docs/`

It uses web scraping (Cheerio library) to parse and extract content.

### Is the documentation cached?

Yes! Two-tier caching system:

1. **In-memory cache** - Ultra-fast (<1ms), lost on restart
2. **Disk cache** - Fast (~10ms), persists across restarts

Cache expires after **24 hours**, then automatically refreshes.

See [Caching System](Caching-System) for details.

### What happens if I'm offline?

The server has multiple fallback mechanisms:

1. Try web fetch (with 3 retries)
2. Use disk cache (even if expired)
3. Use stale in-memory cache
4. Load embedded fixture (last resort)

**You'll always get documentation**, though it may be slightly outdated if offline.

### How much disk space does it use?

- **Disk cache**: ~1.1MB (`.cache/terragrunt-docs/`)
- **Server code**: ~15MB (including dependencies)
- **Total**: ~16-17MB

### How much memory does it use?

- **Base server**: ~30-50MB
- **In-memory cache**: ~1.1MB
- **Total**: ~31-51MB (very lightweight!)

### Does it make network requests on every query?

No! Network requests only happen:

- First run (cold start)
- Cache expired (after 24 hours)
- Cache corrupted or deleted

Most queries use the in-memory cache (<1ms response).

### Can I customize the cache duration?

Not currently through configuration, but you can modify the code:

```typescript
// src/terragrunt/docs.ts
const CACHE_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours instead of 24
```

Future versions may support environment variable configuration.

### Is my data sent anywhere?

No! The server:
- Runs entirely locally on your machine
- Only connects to `terragrunt.gruntwork.io` for docs
- Doesn't send telemetry
- Doesn't collect user data
- Doesn't require authentication

## Troubleshooting

### The server crashes on startup

**Check**:
```bash
# Verify Node.js version
node --version  # Must be 18+

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Check for errors
node dist/index.js
```

### Documentation seems outdated

**Solution**: Clear the cache to force refresh:

```bash
# Find cache location
ls -la .cache/terragrunt-docs/

# Delete cache
rm -rf .cache/terragrunt-docs/

# Next query will fetch fresh data
```

### "Cannot find module" errors

**Problem**: Missing `.js` extension in imports (development)

**Solution**: Ensure all imports use `.js`:

```typescript
import { ResourceHandler } from './handlers/resources.js';
```

### Cache not persisting across restarts

**Problem**: Cache directory not writable or missing

**Check**:
```bash
# Verify cache directory exists
mkdir -p .cache/terragrunt-docs/

# Fix permissions
chmod -R 755 .cache/
```

### Network timeout errors

**Increase timeout** (if on slow connection):

```typescript
// src/terragrunt/docs.ts
const retryConfig = {
  maxRetries: 5,        // More retries
  initialDelayMs: 2000, // Longer delays
  maxDelayMs: 20000
};
```

### Docker container exits immediately

**Problem**: Missing `-i` flag for stdin

**Solution**:
```bash
docker run -i omattsson/terragrunt-mcp-server:latest
```

The `-i` (interactive) flag is **required** for MCP stdio communication.

## Compatibility

### Which VS Code versions are supported?

Any recent VS Code version with GitHub Copilot support. Tested with:
- VS Code 1.85+
- GitHub Copilot extension latest

### Does it work with VS Code forks?

Should work with:
- ✅ VS Codium (if MCP support available)
- ✅ Cursor (if MCP support available)
- ⚠️ Other editors: Depends on MCP support

### What operating systems are supported?

- ✅ **macOS** - Fully supported and tested
- ✅ **Linux** - Fully supported
- ✅ **Windows** - Supported (use WSL recommended)
- ✅ **Docker** - Cross-platform via containers

### Does it work with other AI assistants?

The server implements the standard **Model Context Protocol**, so it should work with any MCP-compatible AI assistant:

- ✅ GitHub Copilot (primary target)
- ✅ Claude Desktop (with MCP support)
- ✅ Other MCP-compatible clients

Check your AI assistant's documentation for MCP setup instructions.

### Can I use it programmatically?

Yes! The core `TerragruntDocsManager` can be imported:

```typescript
import { TerragruntDocsManager } from 'terragrunt-mcp-server';

const manager = new TerragruntDocsManager();
const docs = await manager.searchDocs('remote state');
console.log(docs);
```

However, it's primarily designed as an MCP server.

## Development & Contributing

### How can I contribute?

See [Development Guide](Development-Guide) and [CONTRIBUTING.md](../CONTRIBUTING.md):

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Where do I report bugs?

[GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues)

Please include:
- Node.js version
- Operating system
- Error messages
- Steps to reproduce

### Can I add support for other documentation sources?

Yes! The architecture is extensible:

1. Create a new docs manager (similar to `TerragruntDocsManager`)
2. Implement the same interface
3. Add new tools in `ToolHandler`
4. Update MCP server to support both

Or create a separate MCP server for that documentation source.

### How do releases work?

See [Release Process](Release-Process):

1. Development in `develop` branch
2. Feature branches merged via PRs
3. Version bump and tag
4. Publish to npm
5. Build and push Docker image

## Performance

### How fast is it?

Typical response times:

- **First query** (cold start): 5-10 seconds (web fetch)
- **Second query** (warm cache): <10ms (disk cache)
- **Subsequent queries**: <1ms (in-memory cache)

### Can I pre-warm the cache?

Not currently exposed, but you can:

```bash
# Ensure cache is populated
node dist/index.js <<< '{"method":"initialize"}'
```

Or manually download and place cache files in `.cache/terragrunt-docs/`.

### What if multiple users share the same installation?

The cache is per-installation, so multiple users on the same system will share:
- ✅ Disk cache (faster cold starts for all)
- ❌ In-memory cache (per-process, not shared)

For multi-user setups, consider:
- Shared cache volume (Docker)
- Network file system for `.cache/`

## Security & Privacy

### Is it safe to use?

Yes! The server:
- Runs locally on your machine
- Only connects to official Terragrunt site
- Doesn't execute arbitrary code
- Doesn't require credentials
- Open source (audit the code!)

### What data is stored?

Only cached documentation:
- `.cache/terragrunt-docs/docs-cache.json` - Documentation content
- `.cache/terragrunt-docs/metadata.json` - Cache metadata

No personal data or queries are stored.

### Does it need internet access?

- **First run**: Yes, to fetch documentation
- **After cache populated**: No, works offline with cached data
- **After 24 hours**: Yes, to refresh expired cache

You can work offline indefinitely with potentially outdated docs.

### Can I use it in air-gapped environments?

Yes, with preparation:

1. Run on internet-connected machine
2. Copy `.cache/terragrunt-docs/` directory
3. Transfer to air-gapped machine
4. Server will use cached data

Alternatively, use the embedded fixture (always available, may be outdated).

## Advanced Topics

### Can I customize which documentation sections are fetched?

Currently fetches all sections. To customize, modify:

```typescript
// src/terragrunt/docs.ts
async getDocumentationPages(): Promise<DocLink[]> {
  // Add filtering logic here
}
```

### How do I integrate with CI/CD?

For automated testing with Terragrunt docs:

```yaml
# GitHub Actions example
- name: Setup Terragrunt MCP Server
  run: |
    npm install -g terragrunt-mcp-server
    terragrunt-mcp-server <<< '{"method":"initialize"}'
```

### Can I run multiple instances?

Yes! Each instance:
- Has its own in-memory cache
- Can share disk cache (same `.cache/` directory)
- Operates independently

### How do I monitor the server?

Enable logging:

```bash
# Run with output
DEBUG=true node dist/index.js
```

Check cache status:

```bash
# Cache age
stat .cache/terragrunt-docs/docs-cache.json

# Cache size
du -sh .cache/terragrunt-docs/
```

## Future Plans

### What features are planned?

See [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues) for roadmap.

Potential features:
- Configuration via environment variables
- Additional documentation sources
- Enhanced search with fuzzy matching
- Syntax highlighting in code examples
- Integration with Terraform docs

### Will it support other IaC tools?

Possibly! The architecture could support:
- Terraform documentation
- OpenTofu documentation  
- Pulumi documentation
- CloudFormation documentation

But these might be better as separate MCP servers.

### Can I request features?

Yes! Open a [GitHub Issue](https://github.com/omattsson/terragrunt-mcp-server/issues) with:
- Feature description
- Use case
- Expected behavior
- Willing to contribute?

## Getting Help

### Where can I get support?

- **Documentation**: This wiki
- **Issues**: [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/omattsson/terragrunt-mcp-server/discussions)

### How do I submit good bug reports?

Include:

1. **Environment**:
   - Node.js version (`node --version`)
   - OS and version
   - Installation method (npm, Docker, source)

2. **Steps to reproduce**:
   - Exact commands run
   - Configuration used
   - Expected vs actual behavior

3. **Error output**:
   - Full error messages
   - Stack traces
   - Relevant logs

4. **Context**:
   - First occurrence or regression?
   - Workarounds tried
   - Impact severity

### How do I find existing answers?

1. Search this wiki
2. Check [Troubleshooting](Troubleshooting) page
3. Search [closed issues](https://github.com/omattsson/terragrunt-mcp-server/issues?q=is%3Aissue+is%3Aclosed)
4. Read [Architecture Overview](Architecture-Overview)

## See Also

- [Installation Guide](Installation-Guide) - Getting started
- [Available Tools](Available-Tools) - Tool reference
- [Troubleshooting](Troubleshooting) - Common issues
- [Development Guide](Development-Guide) - Contributing
- [Architecture Overview](Architecture-Overview) - How it works

---

**Still have questions?** [Open a discussion](https://github.com/omattsson/terragrunt-mcp-server/discussions)!
