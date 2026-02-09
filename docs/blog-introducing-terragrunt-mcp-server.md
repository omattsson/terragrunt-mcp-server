🚀 STOP TAB-SWITCHING: I Built an MCP Server That Brings Terragrunt Documentation to Your AI Assistant

Picture this: You're deep in infrastructure code, configuring a new Terragrunt module.

You need to remember the exact syntax for find_in_parent_folders().

So you open a browser tab → search the docs → scroll through examples → copy-paste back to VS Code.

Repeat fifty times a day. Sound familiar?

Or worse: you ask your AI assistant about Terragrunt, and it confidently generates configuration using syntax that was deprecated two years ago.

Training data cutoff strikes again.

━━━━━━━━━━━━━━━━━━━━

𝗪𝗵𝗮𝘁 𝗶𝗳 𝘆𝗼𝘂𝗿 𝗔𝗜 𝗮𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁 𝗵𝗮𝗱 𝗱𝗶𝗿𝗲𝗰𝘁 𝗮𝗰𝗰𝗲𝘀𝘀 𝘁𝗼 𝗹𝗶𝘃𝗲 𝗧𝗲𝗿𝗿𝗮𝗴𝗿𝘂𝗻𝘁 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗮𝘁𝗶𝗼𝗻?

That's exactly what I built with the Terragrunt MCP Server:
🔗 github.com/omattsson/terragrunt-mcp-server

It's a Model Context Protocol server that gives GitHub Copilot (and other MCP-compatible assistants) real-time access to Terragrunt's official documentation, function references, CLI help, and intelligent error diagnosis.

All without leaving your editor.

━━━━━━━━━━━━━━━━━━━━

𝗧𝗲𝗿𝗿𝗮𝗴𝗿𝘂𝗻𝘁 𝗶𝗻 𝟲𝟬 𝗦𝗲𝗰𝗼𝗻𝗱𝘀

If you're familiar with Terraform but haven't used Terragrunt:

Terragrunt is a thin wrapper around Terraform that helps you keep your infrastructure code DRY (Don't Repeat Yourself).

The problem with vanilla Terraform at scale:
• You copy-paste backend configurations across dozens of modules
• Environment-specific values (dev, staging, prod) require duplicated code
• Dependencies between modules need manual orchestration
• Remote state configuration repeats everywhere

Terragrunt solves this with a terragrunt.hcl file that:
✓ Inherits shared configuration from parent directories
✓ Declares dependencies on other modules
✓ Passes outputs between them automatically

Run "terragrunt run-all apply" and it handles the dependency graph for you.

But Terragrunt has its own syntax, 50+ built-in functions, and configuration patterns to learn.

That's where the MCP server comes in.

━━━━━━━━━━━━━━━━━━━━

𝗛𝗼𝘄 𝗜𝘁 𝗪𝗼𝗿𝗸𝘀

The Terragrunt MCP Server sits between your AI assistant and Terragrunt's documentation.

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

𝗞𝗲𝘆 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:

• Multi-tier caching: In-memory → Disk → Live Docs → Offline Fallback
• Sub-millisecond response times for cached content
• 24-hour refresh cycle keeps docs fresh
• Always has data to return (even offline)

━━━━━━━━━━━━━━━━━━━━

𝗘𝗶𝗴𝗵𝘁 𝗧𝗼𝗼𝗹𝘀 𝗳𝗼𝗿 𝗘𝘃𝗲𝗿𝘆 𝗧𝗲𝗿𝗿𝗮𝗴𝗿𝘂𝗻𝘁 𝗧𝗮𝘀𝗸

Instead of one generic "search docs" function, the MCP server provides specialized tools:

🔍 𝘀𝗲𝗮𝗿𝗰𝗵_𝗱𝗼𝗰𝘀 — Search official documentation
→ "How does Terragrunt handle remote state?"

📚 𝗳𝘂𝗻𝗰𝘁𝗶𝗼𝗻_𝗿𝗲𝗳𝗲𝗿𝗲𝗻𝗰𝗲 — Details on 50+ built-in functions
→ "What does path_relative_to_include return?"

⌨️ 𝗰𝗹𝗶_𝗿𝗲𝗳𝗲𝗿𝗲𝗻𝗰𝗲 — CLI command syntax and options
→ "What flags does terragrunt run-all accept?"

📝 𝗴𝗲𝘁_𝗵𝗰𝗹_𝗰𝗼𝗻𝗳𝗶𝗴_𝗿𝗲𝗳𝗲𝗿𝗲𝗻𝗰𝗲 — HCL block syntax
→ "Show me the generate block syntax"

💡 𝗴𝗲𝘁_𝗴𝘂𝗶𝗱𝗮𝗻𝗰𝗲 — Best practices and patterns
→ "What's the recommended folder structure?"

🔧 𝗯𝘂𝗶𝗹𝗱_𝗰𝗼𝗻𝗳𝗶𝗴 — Generate validated configurations
→ "Create an Azure Blob backend config"

🩺 𝗱𝗶𝗮𝗴𝗻𝗼𝘀𝗲_𝘁𝗲𝗿𝗿𝗮𝗴𝗿𝘂𝗻𝘁_𝗲𝗿𝗿𝗼𝗿 — Diagnose errors with solutions
→ "Why am I getting a dependency cycle error?"

📊 𝗴𝗲𝘁_𝘀𝗲𝗿𝘃𝗲𝗿_𝗺𝗲𝘁𝗿𝗶𝗰𝘀 — Server health and statistics
→ "Show cache hit rates"

━━━━━━━━━━━━━━━━━━━━

𝗘𝗿𝗿𝗼𝗿 𝗗𝗶𝗮𝗴𝗻𝗼𝘀𝗶𝘀 𝗧𝗵𝗮𝘁 𝗔𝗰𝘁𝘂𝗮𝗹𝗹𝘆 𝗛𝗲𝗹𝗽𝘀

The diagnose_terragrunt_error tool includes 66 error patterns across 7 categories with confidence scoring and fuzzy matching.

Paste an error message like:
"Error acquiring the state lock. Lock Info: ID: abc-123..."

And get back:
✓ Root cause: Another Terraform/Terragrunt process holds the lock
✓ Solutions: Wait for the other process, or force-unlock with terraform force-unlock abc-123
✓ Related documentation: Links to state locking docs

━━━━━━━━━━━━━━━━━━━━

𝗖𝗼𝗻𝗳𝗶𝗴𝘂𝗿𝗮𝘁𝗶𝗼𝗻 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗶𝗼𝗻

The build_config tool generates validated Terragrunt configurations for common scenarios:

✓ Remote state backends (Azure Blob Storage, AWS S3, GCP Cloud Storage)
✓ Dependency blocks (module-to-module dependencies with mock outputs)
✓ Provider generation (dynamic provider blocks based on environment)
✓ Hooks (before/after hooks for custom scripts)

Each template comes in three tiers (Essential, Advanced, Complete) so you get exactly the complexity you need.

━━━━━━━━━━━━━━━━━━━━

𝗪𝗵𝘆 𝗡𝗼𝘁 𝗝𝘂𝘀𝘁 𝗔𝘀𝗸 𝗖𝗵𝗮𝘁𝗚𝗣𝗧?

Fair question. Here's what the MCP server provides that generic AI assistants can't:

𝗗𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗮𝘁𝗶𝗼𝗻 𝗳𝗿𝗲𝘀𝗵𝗻𝗲𝘀𝘀:
• Generic AI: Training data cutoff
• MCP Server: 24-hour refresh from official docs

𝗘𝗿𝗿𝗼𝗿 𝗽𝗮𝘁𝘁𝗲𝗿𝗻 𝗺𝗮𝘁𝗰𝗵𝗶𝗻𝗴:
• Generic AI: Generic troubleshooting
• MCP Server: 66 specialized patterns with confidence scores

𝗖𝗼𝗻𝗳𝗶𝗴𝘂𝗿𝗮𝘁𝗶𝗼𝗻 𝘃𝗮𝗹𝗶𝗱𝗮𝘁𝗶𝗼𝗻:
• Generic AI: May hallucinate syntax
• MCP Server: Templates validated against schemas

𝗢𝗳𝗳𝗹𝗶𝗻𝗲 𝘀𝘂𝗽𝗽𝗼𝗿𝘁:
• Generic AI: Requires internet
• MCP Server: Multi-tier fallback (always works)

𝗙𝘂𝗻𝗰𝘁𝗶𝗼𝗻 𝘀𝗶𝗴𝗻𝗮𝘁𝘂𝗿𝗲𝘀:
• Generic AI: May be outdated
• MCP Server: Live reference for 50+ functions

The MCP server has been tested with over 600 automated tests (unit, integration, and performance) to ensure reliability.

━━━━━━━━━━━━━━━━━━━━

𝗚𝗲𝘁 𝗦𝘁𝗮𝗿𝘁𝗲𝗱 𝗶𝗻 𝟱 𝗠𝗶𝗻𝘂𝘁𝗲𝘀

𝟭. 𝗣𝘂𝗹𝗹 𝘁𝗵𝗲 𝗗𝗼𝗰𝗸𝗲𝗿 𝗜𝗺𝗮𝗴𝗲

docker pull olofdevopsninja/terragrunt-mcp-server:latest

𝟮. 𝗖𝗼𝗻𝗳𝗶𝗴𝘂𝗿𝗲 𝗩𝗦 𝗖𝗼𝗱𝗲

Add the MCP server to your VS Code settings.json (see GitHub README for full config).

The cache volume persists documentation between container restarts for faster queries.

𝟯. 𝗔𝗱𝗱 𝗖𝗼𝗽𝗶𝗹𝗼𝘁 𝗜𝗻𝘀𝘁𝗿𝘂𝗰𝘁𝗶𝗼𝗻𝘀 (𝗥𝗲𝗰𝗼𝗺𝗺𝗲𝗻𝗱𝗲𝗱)

To help Copilot automatically select Terragrunt tools for relevant questions, create a .github/copilot-instructions.md file in your project.

See the Copilot Instructions Template in the repo for a ready-to-use configuration.

𝟰. 𝗥𝗲𝘀𝘁𝗮𝗿𝘁 𝗩𝗦 𝗖𝗼𝗱𝗲

Reload the window, and the Terragrunt tools appear in GitHub Copilot's tool list.

𝟱. 𝗧𝗿𝘆 𝗬𝗼𝘂𝗿 𝗙𝗶𝗿𝘀𝘁 𝗤𝘂𝗲𝗿𝘆

Open Copilot Chat and ask:
"What's the difference between dependency and dependencies blocks in Terragrunt?"

You'll get a structured comparison pulled from the official documentation—not a guess based on training data.

━━━━━━━━━━━━━━━━━━━━

𝗥𝗲𝗮𝗹-𝗪𝗼𝗿𝗹𝗱 𝗦𝗰𝗲𝗻𝗮𝗿𝗶𝗼𝘀

𝗦𝗰𝗲𝗻𝗮𝗿𝗶𝗼 𝟭: 𝗧𝗵𝗲 𝗦𝘁𝗮𝘁𝗲 𝗟𝗼𝗰𝗸 𝗘𝗺𝗲𝗿𝗴𝗲𝗻𝗰𝘆

You're a DevOps engineer. It's 2 AM. A deployment is stuck with a state lock error.

Prompt: "Diagnose this error: Error locking state: Error acquiring the state lock: ConditionalCheckFailedException"

Result: The MCP server identifies this as a DynamoDB lock contention issue, explains that another process may have crashed without releasing the lock, and provides the exact terraform force-unlock command—plus warnings about when it's safe to use.

𝗦𝗰𝗲𝗻𝗮𝗿𝗶𝗼 𝟮: 𝗟𝗲𝗮𝗿𝗻𝗶𝗻𝗴 𝗧𝗲𝗿𝗿𝗮𝗴𝗿𝘂𝗻𝘁 𝗣𝗮𝘁𝘁𝗲𝗿𝗻𝘀

You're a Terraform user adopting Terragrunt for the first time.

Prompt: "Explain find_in_parent_folders with examples"

Result: The function reference tool returns the signature, description, and real-world examples showing how it enables configuration inheritance—pulled from the official docs, not a two-year-old blog post.

𝗦𝗰𝗲𝗻𝗮𝗿𝗶𝗼 𝟯: 𝗦𝘁𝗮𝗻𝗱𝗮𝗿𝗱𝗶𝘇𝗶𝗻𝗴 𝗧𝗲𝗮𝗺 𝗖𝗼𝗻𝗳𝗶𝗴𝘂𝗿𝗮𝘁𝗶𝗼𝗻𝘀

You're a platform team lead creating golden templates.

Prompt: "Generate a complete Azure Blob backend configuration for production"

Result: The build_config tool generates a validated remote_state block with the azurerm backend, including resource group, storage account, and container configuration—following current best practices from Gruntwork's documentation.

━━━━━━━━━━━━━━━━━━━━

𝗦𝘁𝗮𝗿𝘁 𝗕𝘂𝗶𝗹𝗱𝗶𝗻𝗴

The Terragrunt MCP Server is open source and ready to use:

→ GitHub: github.com/omattsson/terragrunt-mcp-server
→ Docker Hub: hub.docker.com/r/olofdevopsninja/terragrunt-mcp-server

𝗙𝗶𝗿𝘀𝘁 𝗽𝗿𝗼𝗺𝗽𝘁 𝘁𝗼 𝘁𝗿𝘆:
"Show me best practices for organizing a multi-environment Terragrunt repository"

Stop tab-switching. Let your AI assistant access the docs directly.

━━━━━━━━━━━━━━━━━━━━

Have questions or feedback? Open an issue on GitHub or ⭐ the repo if you find it useful.

#Terragrunt #Terraform #DevOps #InfrastructureAsCode #IaC #CloudEngineering #MCP #ModelContextProtocol #GitHubCopilot #AI #DeveloperTools #CloudAutomation #OpenSource
