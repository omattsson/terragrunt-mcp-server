# Available Tools

The Terragrunt MCP Server provides **6 specialized tools** for accessing and searching Terragrunt documentation. Each tool is designed for specific use cases to help you find the information you need quickly.

## Tool Overview

| Tool | Purpose | Best For |
|------|---------|----------|
| `search_terragrunt_docs` | General search | Broad topic exploration |
| `get_terragrunt_sections` | List sections | Understanding doc structure |
| `get_section_docs` | Section retrieval | Deep diving into topics |
| `get_cli_command_help` | CLI command help | Command syntax and options |
| `get_hcl_config_reference` | HCL config reference | Writing terragrunt.hcl files |
| `get_code_examples` | Find code snippets | Learning by example |

---

## 1. search_terragrunt_docs

**Purpose**: Search across all Terragrunt documentation for specific topics, commands, or concepts.

### Parameters

- **`query`** (string, required): Search query text
- **`limit`** (number, optional): Maximum results (default: 5, max: 20)

### Use Cases

- General questions about Terragrunt
- Broad topic exploration
- Discovering documentation you didn't know existed
- Finding all mentions of a specific concept

### Example Prompts

```text
"Search for Terragrunt documentation about dependencies"
"Find information about remote state"
"What does Terragrunt say about generate blocks?"
"Search for documentation on mocking"
```

### Example Response

```json
{
  "query": "dependencies",
  "results": [
    {
      "title": "Dependencies",
      "url": "https://terragrunt.gruntwork.io/docs/...",
      "section": "features",
      "snippet": "...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "total": 12,
  "hasMore": true
}
```

---

## 2. get_terragrunt_sections

**Purpose**: Get a complete list of all available documentation sections with document counts.

### Parameters

None required.

### Use Cases

- Understanding the documentation structure
- Browsing by category
- Finding the right section for deep exploration
- Getting an overview of available topics

### Example Prompts

```text
"What documentation sections are available?"
"List all Terragrunt documentation categories"
"Show me the structure of Terragrunt docs"
```

### Example Response

```json
{
  "sections": [
    {
      "name": "getting-started",
      "documentCount": 4
    },
    {
      "name": "reference",
      "documentCount": 36
    },
    {
      "name": "features",
      "documentCount": 18
    }
  ]
}
```

---

## 3. get_section_docs

**Purpose**: Get all documentation pages from a specific section for comprehensive reading.

### Parameters

- **`section`** (string, required): Section name (e.g., "getting-started", "reference", "features")

### Use Cases

- Deep diving into a specific topic area
- Reading documentation sequentially
- Understanding a complete feature set
- Comprehensive learning

### Example Prompts

```text
"Show me all getting-started documentation"
"Get all reference documentation"
"What's in the features section?"
"Retrieve all CLI reference docs"
```

### Example Response

```json
{
  "section": "getting-started",
  "docs": [
    {
      "title": "Quick Start",
      "url": "https://terragrunt.gruntwork.io/docs/getting-started/quick-start/",
      "content": "...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalDocs": 4
}
```

---

## 4. get_cli_command_help

**Purpose**: Get detailed help documentation for specific Terragrunt CLI commands.

### Parameters

- **`command`** (string, required): Command name (e.g., "plan", "apply", "run-all", "hclfmt")

### Use Cases

- Learning command syntax
- Understanding command options and flags
- CLI troubleshooting
- Discovering command capabilities

### Example Prompts

```text
"How do I use the terragrunt plan command?"
"What options are available for terragrunt run-all?"
"Show me help for the hclfmt command"
"Explain the terragrunt render command"
```

### Example Response

```json
{
  "command": "render",
  "title": "render",
  "url": "https://terragrunt.gruntwork.io/docs/reference/cli/commands/render/",
  "content": "Generate a simplified version of the Terragrunt configuration with all includes and dependencies resolved...",
  "lastUpdated": "2025-10-23"
}
```

---

## 5. get_hcl_config_reference

**Purpose**: Get documentation for HCL configuration blocks, attributes, and functions used in `terragrunt.hcl`.

### Parameters

- **`config`** (string, required): Config element name (e.g., "terraform", "remote_state", "dependency", "inputs")

### Use Cases

- Writing terragrunt.hcl files
- Understanding configuration options
- Learning HCL syntax for Terragrunt
- Debugging configuration issues

### Example Prompts

```text
"How do I configure the terraform block in terragrunt.hcl?"
"What options are available for remote_state?"
"Show me how to use the dependency block"
"What attributes can I use in the inputs block?"
```

### Example Response

```json
{
  "config": "dependency",
  "results": [
    {
      "title": "Blocks",
      "url": "https://terragrunt.gruntwork.io/docs/reference/hcl/blocks/",
      "content": "The dependency block is used to...",
      "lastUpdated": "2025-10-23"
    }
  ],
  "totalResults": 2
}
```

---

## 6. get_code_examples

**Purpose**: Find code examples and snippets related to specific Terragrunt topics or patterns.

### Parameters

- **`topic`** (string, required): Topic or pattern (e.g., "remote state", "dependencies", "before hooks")
- **`limit`** (number, optional): Max documents to return (default: 5, max: 10)

### Use Cases

- Learning by example
- Finding implementation patterns
- Quick reference for syntax
- Copying working code snippets

### Example Prompts

```text
"Show me examples of using dependencies in Terragrunt"
"Find code snippets for remote state configuration"
"What are some examples of before_hook usage?"
"Show me how to use generate blocks with examples"
```

### Example Response

```json
{
  "topic": "dependency",
  "examples": [
    {
      "documentTitle": "Quick Start",
      "documentUrl": "https://terragrunt.gruntwork.io/docs/getting-started/quick-start/",
      "section": "getting-started",
      "codeSnippets": [
        "dependency \"vpc\" { config_path = \"../vpc\" }",
        "inputs = { subnet_id = dependency.vpc.outputs.subnet_id }"
      ],
      "snippetCount": 5
    }
  ],
  "totalDocuments": 3,
  "hasMore": false
}
```

---

## Tool Selection Guide

### Choose the right tool for your needs:

**"I don't know where to start..."**
→ Use `get_terragrunt_sections` to browse categories

**"I'm looking for information about X..."**
→ Use `search_terragrunt_docs` with your topic

**"I want to learn everything about X feature..."**
→ Use `get_section_docs` after finding the right section

**"How do I use command X?"**
→ Use `get_cli_command_help` with the command name

**"How do I configure X in terragrunt.hcl?"**
→ Use `get_hcl_config_reference` with the config element

**"Show me an example of X..."**
→ Use `get_code_examples` with the topic

---

## Tips for Best Results

1. **Be specific but not too narrow**: "dependencies" works better than "dependency block configuration syntax"
2. **Try multiple tools**: If one doesn't give you what you need, try another approach
3. **Use natural language**: The tools understand questions like "How do I..."
4. **Start broad, then narrow**: Use search first, then dive deeper with specific tools
5. **Check multiple sources**: Code examples + CLI help + config reference = complete understanding

---

## Next Steps

- [Quick Start Tutorial](Quick-Start-Tutorial) - Practice using these tools
- [Examples and Use Cases](Examples-and-Use-Cases) - Real-world scenarios
- [FAQ](FAQ) - Common questions about using the tools
