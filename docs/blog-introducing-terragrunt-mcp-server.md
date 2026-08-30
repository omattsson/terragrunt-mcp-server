# STOP TAB-SWITCHING: I Built an MCP Server That Brings Terragrunt Documentation to Your AI Assistant

Picture this: You're deep in infrastructure code, configuring a new Terragrunt module.

You need to remember the exact syntax for `find_in_parent_folders()`.

So you open a browser tab → search the docs → scroll through examples → copy-paste back to VS Code.

Repeat fifty times a day. Sound familiar?

Or worse: you ask your AI assistant about Terragrunt, and it confidently generates configuration using syntax that was deprecated two years ago.

Training data cutoff strikes again.

---

## What if your AI assistant had direct access to live Terragrunt documentation?

That's exactly what I built with the Terragrunt MCP Server:
[github.com/omattsson/terragrunt-mcp-server](https://github.com/omattsson/terragrunt-mcp-server)

It's a Model Context Protocol server that gives GitHub Copilot (and other MCP-compatible assistants) real-time access to Terragrunt's official documentation, function references, CLI help, and intelligent error diagnosis.

All without leaving your editor.

---

## Terragrunt in 60 Seconds

If you're familiar with Terraform but haven't used Terragrunt:

Terragrunt is a thin wrapper around Terraform that helps you keep your infrastructure code DRY (Don't Repeat Yourself).

The problem with vanilla Terraform at scale:
- You copy-paste backend configurations across dozens of modules
- Environment-specific values (dev, staging, prod) require duplicated code
- Dependencies between modules need manual orchestration
- Remote state configuration repeats everywhere

Terragrunt solves this with a `terragrunt.hcl` file that:
- Inherits shared configuration from parent directories
- Declares dependencies on other modules
- Passes outputs between them automatically

Run `terragrunt run --all -- apply` and it handles the dependency graph for you.

But Terragrunt has its own syntax, 50+ built-in functions, and configuration patterns to learn.

That's where the MCP server comes in.

---

## How It Works

The Terragrunt MCP Server sits between your AI assistant and Terragrunt's documentation.

```
You (VS Code)
     ↓
GitHub Copilot
     ↓ MCP Protocol
Terragrunt MCP Server
     ↓
[8 Specialized Tools]
     ↓
Multi-Tier Cache:
In-Memory → Disk → Live Docs → Offline Fallback
     ↓
Structured Response back to Copilot
     ↓
Answer to You
```

**Key Features:**

- Multi-tier caching: In-Memory → Disk → Live Docs → Offline Fallback
- Sub-millisecond response times for cached content
- 24-hour refresh cycle keeps docs fresh
- Always has data to return (even offline)

---

## Eight Tools for Every Terragrunt Task

Instead of one generic "search docs" function, the MCP server provides specialized tools:

- **search_docs** — Search official documentation
  - "How does Terragrunt handle remote state?"
- **function_reference** — Details on 50+ built-in functions
  - "What does path_relative_to_include return?"
- **cli_reference** — CLI command syntax and options
  - "What flags does terragrunt run --all accept?"
- **get_hcl_config_reference** — HCL block syntax
  - "Show me the generate block syntax"
- **get_guidance** — Best practices and patterns
  - "What's the recommended folder structure?"
- **build_config** — Generate validated configurations
  - "Create an Azure Blob backend config"
- **diagnose_terragrunt_error** — Diagnose errors with solutions
  - "Why am I getting a dependency cycle error?"
- **get_server_metrics** — Server health and statistics
  - "Show cache hit rates"

---

## Error Diagnosis That Actually Helps

The `diagnose_terragrunt_error` tool includes 66 error patterns across 7 categories with confidence scoring and fuzzy matching.

Paste an error message like:
> "Error acquiring the state lock. Lock Info: ID: abc-123..."

And get back:
- **Root cause:** Another Terraform/Terragrunt process holds the lock
- **Solutions:** Wait for the other process, or force-unlock with `terraform force-unlock abc-123`
- **Related documentation:** Links to state locking docs

---

## Configuration Generation

The `build_config` tool generates validated Terragrunt configurations for common scenarios:

- Remote state backends (Azure Blob Storage, AWS S3, GCP Cloud Storage)
- Dependency blocks (module-to-module dependencies with mock outputs)
- Provider generation (dynamic provider blocks based on environment)
- Hooks (before/after hooks for custom scripts)

Each template comes in three tiers (Essential, Advanced, Complete) so you get exactly the complexity you need.

---

## Why Not Just Ask ChatGPT?

Fair question. Here's what the MCP server provides that generic AI assistants can't:

| | Generic AI | MCP Server |
|---|---|---|
| **Documentation freshness** | Training data cutoff | 24-hour refresh from official docs |
| **Error pattern matching** | Generic troubleshooting | 66 specialized patterns with confidence scores |
| **Configuration validation** | May hallucinate syntax | Templates validated against schemas |
| **Offline support** | Requires internet | Multi-tier fallback (always works) |
| **Function signatures** | May be outdated | Live reference for 50+ functions |

The MCP server has been tested with over 600 automated tests (unit, integration, and performance) to ensure reliability.

---

## Get Started in 5 Minutes

### 1. Pull the Docker Image

```bash
docker pull olofdevopsninja/terragrunt-mcp-server:latest
```

### 2. Configure VS Code

Add the MCP server to your VS Code settings.json (see GitHub README for full config).

The cache volume persists documentation between container restarts for faster queries.

### 3. Add Copilot Instructions (Recommended)

To help Copilot automatically select Terragrunt tools for relevant questions, create a `.github/copilot-instructions.md` file in your project.

See the [Copilot Instructions Template](Copilot-Instructions-Template.md) in the repo for a ready-to-use configuration.

### 4. Restart VS Code

Reload the window, and the Terragrunt tools appear in GitHub Copilot's tool list.

### 5. Try Your First Query

Open Copilot Chat and ask:
> "What's the difference between dependency and dependencies blocks in Terragrunt?"

You'll get a structured comparison pulled from the official documentation—not a guess based on training data.

---

## Real-World Scenarios

### Scenario 1: The State Lock Emergency

You're a DevOps engineer. It's 2 AM. A deployment is stuck with a state lock error.

**Prompt:** "Diagnose this error: Error locking state: Error acquiring the state lock: ConditionalCheckFailedException"

**Result:** The MCP server identifies this as a DynamoDB lock contention issue, explains that another process may have crashed without releasing the lock, and provides the exact `terraform force-unlock` command—plus warnings about when it's safe to use.

### Scenario 2: Learning Terragrunt Patterns

You're a Terraform user adopting Terragrunt for the first time.

**Prompt:** "Explain find_in_parent_folders with examples"

**Result:** The function reference tool returns the signature, description, and real-world examples showing how it enables configuration inheritance—pulled from the official docs, not a two-year-old blog post.

### Scenario 3: Standardizing Team Configurations

You're a platform team lead creating golden templates.

**Prompt:** "Generate a complete Azure Blob backend configuration for production"

**Result:** The `build_config` tool generates a validated `remote_state` block with the azurerm backend, including resource group, storage account, and container configuration—following current best practices from Gruntwork's documentation.

---

## Start Building

The Terragrunt MCP Server is open source and ready to use:

- **GitHub:** [github.com/omattsson/terragrunt-mcp-server](https://github.com/omattsson/terragrunt-mcp-server)
- **Docker Hub:** [hub.docker.com/r/olofdevopsninja/terragrunt-mcp-server](https://hub.docker.com/r/olofdevopsninja/terragrunt-mcp-server)

**First prompt to try:**
> "Show me best practices for organizing a multi-environment Terragrunt repository"

Stop tab-switching. Let your AI assistant access the docs directly.

---

Have questions or feedback? Open an issue on GitHub or star the repo if you find it useful.

#Terragrunt #Terraform #DevOps #InfrastructureAsCode #IaC #CloudEngineering #MCP #ModelContextProtocol #GitHubCopilot #AI #DeveloperTools #CloudAutomation #OpenSource
