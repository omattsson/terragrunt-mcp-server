# Migration Guide: Multi-Mode Architecture

## Overview

Version 0.5.0+ introduces a multi-mode architecture that reduces token overhead by 60-94% while maintaining full backward compatibility. This guide helps you migrate to the optimal mode for your workflow.

> **For AI Assistants**: See [AI Prompt Patterns Guide](AI-Prompt-Patterns.md) for optimal tool usage strategies with multi-mode architecture.

## What Changed

### Before (v0.5.0 and earlier)
- Single server instance with all 8 tools
- 2,441 token overhead
- All 12 managers loaded
- 0.20 MB memory footprint

### After (v0.5.1+)
- 5 operational modes (FULL, CORE, CONFIG, GUIDANCE, OBSERVABILITY)
- 155-2,441 token overhead (mode-dependent)
- 0-12 managers loaded (lazy loading)
- 0.04-0.20 MB memory footprint

## Migration Strategies

### Strategy 1: No Changes Required (Backward Compatible)

**Who:** Users who want all tools available

**Action:** None - existing configuration continues to work

**Result:** Server runs in FULL mode by default (same behavior as v0.5.0)

```json
// VS Code settings.json - NO CHANGES NEEDED
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

### Strategy 2: Add Specialized Instances (Recommended)

**Who:** Users wanting to optimize token usage for specific workflows

**Action:** Add mode-specific server instances alongside existing FULL instance

**Result:** Multiple servers available in VS Code, each optimized for specific tasks

```json
{
  "mcp.servers": {
    // Keep existing full instance for compatibility
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    // Add specialized instances
    "terragrunt-docs": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    "terragrunt-config": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-config"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

### Strategy 3: Replace with Optimal Mode

**Who:** Users with well-defined workflows

**Action:** Switch existing instance to the mode that fits your primary use case

**Result:** Optimized token usage for your specific workflow

```json
// Documentation-heavy workflows → CORE mode
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}

// Configuration generation → CONFIG mode
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-config"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

## Mode Selection Decision Tree

```
┌─────────────────────────────────────┐
│  What's your primary use case?     │
└─────────────────┬───────────────────┘
                  │
     ┌────────────┼────────────┬──────────────┬──────────────┐
     │            │            │              │              │
     v            v            v              v              v
 [Lookup]   [Generate]   [Debug/Fix]   [Monitor]   [Multiple/Unsure]
     │            │            │              │              │
     v            v            v              v              v
  CORE        CONFIG      GUIDANCE    OBSERVABILITY      FULL
  mode         mode         mode          mode           mode
     │            │            │              │              │
     v            v            v              v              v
  3 tools     2 tools      2 tools       1 tool         8 tools
  965 tok     640 tok      683 tok       155 tok       2441 tok
```

### Decision Criteria

**Choose CORE if you:**
- Frequently look up CLI commands
- Need function reference
- Search documentation often
- Learn by reading docs
- Rarely generate configs

**Choose CONFIG if you:**
- Generate Terragrunt configurations
- Work with templates
- Need HCL reference
- Automate config creation
- Rarely troubleshoot errors

**Choose GUIDANCE if you:**
- Debug Terragrunt errors
- Need best practices advice
- Compare different approaches
- Troubleshoot deployments
- Rarely generate configs

**Choose OBSERVABILITY if you:**
- Only monitor server metrics
- Track usage statistics
- Need minimal footprint
- Don't use other features

**Choose FULL if you:**
- Use multiple tool categories
- Workflow not well-defined
- Need maximum flexibility
- Backward compatibility important

## Migration Checklist

### Pre-Migration

- [ ] Review your current Terragrunt workflow
- [ ] Identify which tools you use most frequently
- [ ] Decide on migration strategy (1, 2, or 3)
- [ ] Backup your VS Code `settings.json`
- [ ] Note your current server configuration

### Migration Steps

#### For Strategy 1 (No Changes)
- [ ] Update to v0.5.1+
- [ ] Verify existing configuration still works
- [ ] Test with a simple prompt (e.g., "search terragrunt docs")

#### For Strategy 2 (Add Specialized Instances)
- [ ] Update to v0.5.1+
- [ ] Keep existing "terragrunt" server configuration
- [ ] Add new mode-specific server instances
- [ ] Restart VS Code
- [ ] Test each mode with appropriate prompts

#### For Strategy 3 (Replace with Optimal Mode)
- [ ] Update to v0.5.1+
- [ ] Identify your optimal mode (see decision tree)
- [ ] Update server command/args for chosen mode
- [ ] Restart VS Code
- [ ] Test functionality with typical prompts
- [ ] If missing tools, switch to FULL or add additional instance

### Post-Migration

- [ ] Verify server starts without errors (check Output panel)
- [ ] Test with sample prompts for your mode
- [ ] Monitor token usage (if applicable)
- [ ] Document your chosen mode for team reference
- [ ] Share configuration with team members

## Docker Migration

### Before (Single Instance)
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest"
      ]
    }
  }
}
```

### After (Multi-Mode)
```json
{
  "mcp.servers": {
    // Option 1: Keep FULL mode
    "terragrunt": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest"
      ]
    },
    // Option 2: Add specialized mode
    "terragrunt-docs": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "core"
      ]
    }
  }
}
```

## npm Package Migration

If using npm package (future):

```bash
# Install/update globally
npm install -g terragrunt-mcp-server

# Use mode-specific CLI commands
terragrunt-mcp-core          # CORE mode
terragrunt-mcp-config        # CONFIG mode
terragrunt-mcp-guidance      # GUIDANCE mode
terragrunt-mcp-observability # OBSERVABILITY mode
terragrunt-mcp-server        # FULL mode (default)
```

## Troubleshooting Migration Issues

### Issue: Server won't start after updating

**Solution:**
1. Check VS Code Output panel for errors
2. Verify file paths are correct
3. Ensure Node.js and dependencies are up to date
4. Try FULL mode first to rule out mode-specific issues

```bash
# Rebuild from source
npm install
npm run build
```

### Issue: Tools missing after migration

**Symptom:** Prompts that worked before now fail

**Solution:** 
1. Check which mode you're using
2. Verify the tool you need is in that mode (see Mode Overview table)
3. Either switch to FULL mode OR add another mode-specific instance

```json
// Add back FULL mode if needed
{
  "mcp.servers": {
    "terragrunt-full": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

### Issue: Mode flag not working

**Symptom:** Server always starts in FULL mode regardless of flag

**Solution:**
1. Verify syntax: `--mode core` (not `--mode=core`)
2. Check mode is valid: `core`, `config`, `guidance`, `observability`, `full`
3. Try CLI wrapper instead: `bin/terragrunt-mcp-core`

### Issue: Performance worse after migration

**Symptom:** Server feels slower or less responsive

**Solution:**
1. Check you're using a specialized mode (not FULL)
2. Clear cache: `rm -rf .cache/terragrunt-docs`
3. Verify cache volume persists (Docker)
4. Monitor memory with: `npm run measure-memory`

## Rollback Procedure

If migration causes issues, rollback to v0.5.0 behavior:

### Option 1: Revert to v0.5.0
```bash
git checkout v0.5.0
npm install
npm run build
```

### Option 2: Use FULL mode in v0.5.1+
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["dist/index.js"],  // No --mode flag = FULL
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

Both options restore exact v0.5.0 functionality.

## Team Migration

For teams with shared configurations:

1. **Announce migration**: Share this guide with team
2. **Pilot with volunteers**: Test new modes with early adopters
3. **Document team standards**: Decide which modes to standardize
4. **Update shared configs**: Commit updated settings to repo
5. **Gradual rollout**: Migrate team members incrementally
6. **Support period**: Provide help during transition

### Example Team Configuration

```json
// Shared .vscode/settings.json for team repository
{
  "mcp.servers": {
    // Default for most users - documentation and quick lookups
    "terragrunt-docs": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "core"
      ]
    },
    // For DevOps engineers generating configs
    "terragrunt-config": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "config"
      ]
    },
    // For troubleshooting (available but not default)
    "terragrunt-debug": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "olofdevopsninja/terragrunt-mcp-server:latest",
        "--mode", "guidance"
      ]
    }
  }
}
```

## Performance Verification

After migration, verify performance improvements:

```bash
# Measure token overhead for your mode
npm run measure-tokens

# Verify tool loading
npm run verify-modes

# Benchmark memory usage
npm run measure-memory
```

Expected results by mode:
- CORE: 965 tokens, 5 managers, 0.19 MB
- CONFIG: 640 tokens, 6 managers, 0.08 MB
- GUIDANCE: 683 tokens, 4 managers, 0.13 MB
- OBSERVABILITY: 155 tokens, 0 managers, 0.04 MB
- FULL: 2,441 tokens, 12 managers, 0.20 MB

## FAQ

**Q: Will my existing configuration break?**
A: No. Without mode flags, server runs in FULL mode (identical to v0.5.0).

**Q: Can I run multiple modes simultaneously?**
A: Yes. Configure multiple server instances with different names and modes.

**Q: Do I need to choose just one mode?**
A: No. You can use multiple modes for different tasks or stick with FULL.

**Q: What happens if I use the wrong mode?**
A: Tools not available in that mode will return errors. Switch modes or add another instance.

**Q: Is there overhead to running multiple modes?**
A: Minimal. Each instance has its own memory footprint (see Mode Overview table).

**Q: Can I switch modes dynamically?**
A: No. Mode is set at server startup. Configure multiple instances to switch between modes.

**Q: Do CLI wrappers work with Docker?**
A: No. Use `--mode` flag with Docker. CLI wrappers are for local builds only.

## Support

- **Issues**: [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues)
- **Documentation**: See [MODE_PERFORMANCE_VERIFIED.md](MODE_PERFORMANCE_VERIFIED.md)
- **Examples**: Check [Available-Tools.md](docs/Available-Tools.md)

## Summary

✅ **Backward compatible** - no breaking changes
✅ **Optional optimization** - migrate when ready
✅ **Multiple strategies** - choose what fits your needs
✅ **Easy rollback** - can revert to FULL mode anytime
✅ **Verified performance** - 60-94% token reduction measured
