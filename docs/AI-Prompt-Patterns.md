# AI Assistant Prompt Patterns Guide

> **Audience**: AI assistants (Claude, GPT, Gemini, etc.) and their users  
> **Purpose**: Optimize tool usage for maximum effectiveness and minimal token waste  
> **Version**: Compatible with v0.5.0+ multi-mode architecture

## Table of Contents

1. [Introduction](#introduction)
2. [Single-Tool Patterns](#single-tool-patterns)
3. [Multi-Tool Workflows](#multi-tool-workflows)
4. [Multi-Mode Orchestration](#multi-mode-orchestration)
5. [Best Practices](#best-practices)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
7. [Quick Reference](#quick-reference)

---

## Introduction

The Terragrunt MCP Server provides 8 consolidated tools with mode-based parameters. This guide demonstrates **optimal prompt patterns** that maximize AI assistant effectiveness while minimizing token overhead.

### Why Prompt Patterns Matter

- **Token Efficiency**: FULL mode uses 2,441 tokens; CORE mode uses 965 tokens (60% reduction)
- **Response Speed**: Fewer tools = faster AI processing
- **Clarity**: Well-structured prompts lead to better tool selection
- **Cache Optimization**: Consistent patterns improve MCP caching

### Key Principles

1. **Be specific with mode parameters** - Specify `mode`, `detailLevel`, etc.
2. **Use summary mode first** - 60-90% smaller responses for overview
3. **Chain tools efficiently** - Combine discovery → detail → action
4. **Select optimal server mode** - Match tool subset to workflow

---

## Single-Tool Patterns

### Pattern 1: search_docs - Discovery to Detail

The `search_docs` tool supports 4 modes. Use progressive refinement:

#### ❌ Inefficient Pattern
```text
User: "Tell me about Terragrunt dependencies"
AI: [Calls search_docs with default parameters]
```
**Problem**: Generic search returns many results at full detail level. Wastes tokens on potentially irrelevant content.

#### ✅ Efficient Pattern
```text
User: "Tell me about Terragrunt dependencies"
AI: [Step 1] search_docs(mode="search", query="dependencies", detailLevel="summary", pageSize=5)
    [Review results]
AI: [Step 2] search_docs(mode="section", section="features", detailLevel="full")
    [Get complete documentation for relevant section]
```
**Benefits**: 
- Summary mode reduces initial response by 60-90%
- Section mode retrieves focused content
- Two-step approach saves ~70% tokens vs full search

**Token Savings**: ~1,500 tokens (estimate)

---

### Pattern 2: search_docs - Example Discovery

When looking for code examples, use `examples` mode with progressive detail.

#### ❌ Inefficient Pattern
```text
User: "Show me hook examples"
AI: search_docs(mode="search", query="hook examples")
```
**Problem**: Search mode returns documentation pages, not code examples. User has to ask again.

#### ✅ Efficient Pattern
```text
User: "Show me hook examples"  
AI: [Step 1] search_docs(mode="examples", listCategories=true)
    [See available categories]
AI: [Step 2] search_docs(mode="examples", advanced=true, category="hooks", limit=3)
```
**Benefits**:
- Direct access to curated code examples
- Category filtering reduces noise
- Limit parameter controls response size

**Token Savings**: ~800 tokens by avoiding documentation search

---

### Pattern 3: function_reference - Lookup vs Browse

The tool auto-detects get/list mode based on presence of `function_name`.

#### ❌ Inefficient Pattern
```text
User: "What path functions are available?"
AI: function_reference(function_name="path_relative_to_include")
AI: function_reference(function_name="path_relative_from_include")
AI: function_reference(function_name="find_in_parent_folders")
[Multiple separate calls]
```
**Problem**: Making N calls when 1 list call would suffice. Each call adds overhead.

#### ✅ Efficient Pattern
```text
User: "What path functions are available?"
AI: function_reference(category="path")
```
**Benefits**:
- Single call returns all path functions
- Pagination support for large result sets
- Category filter focuses results

**Token Savings**: ~200 tokens per avoided duplicate call

---

### Pattern 4: function_reference - Summary then Full

When user needs details, use two-step approach.

#### ❌ Inefficient Pattern
```text
User: "How do I use environment variables in Terragrunt?"
AI: function_reference() [Lists all functions with full details]
```
**Problem**: Returns full details for 50+ functions when user needs 1-2.

#### ✅ Efficient Pattern
```text
User: "How do I use environment variables in Terragrunt?"
AI: [Step 1] function_reference(search="environment")
    [Identifies get_env function]
AI: [Step 2] function_reference(function_name="get_env", mode="full", include_examples=true)
```
**Benefits**:
- Search identifies relevant function(s)
- Full mode provides complete documentation only when needed
- Examples included for practical guidance

**Token Savings**: ~2,000 tokens by avoiding full listing

---

### Pattern 5: cli_reference - Category-Based Discovery

CLI commands are organized by category. Use this for efficient browsing.

#### ❌ Inefficient Pattern
```text
User: "What commands work with state files?"
AI: cli_reference() [Lists all 50+ commands]
```
**Problem**: Returns unrelated commands. User has to parse large response.

#### ✅ Efficient Pattern
```text
User: "What commands work with state files?"
AI: [Step 1] cli_reference(listCategories=true)
    [See categories: main, backend, configuration, etc.]
AI: [Step 2] cli_reference(category="backend")
    [Get state-related commands]
```
**Benefits**:
- Category discovery guides efficient filtering
- Focused results reduce token usage
- Better matches user intent

**Token Savings**: ~1,200 tokens by filtering to relevant category

---

### Pattern 6: get_hcl_config_reference - Block Discovery

HCL blocks have specific names. Use list mode for discovery, then get details.

#### ❌ Inefficient Pattern
```text
User: "How do I configure dependencies?"
AI: get_hcl_config_reference(config="dependencies")
    [Error: Block doesn't exist - it's "dependency"]
AI: get_hcl_config_reference(config="dependency")
```
**Problem**: Guessing block names leads to errors and wasted calls.

#### ✅ Efficient Pattern
```text
User: "How do I configure dependencies?"
AI: [Step 1] get_hcl_config_reference(listBlocks=true, category="modules")
    [See: dependency, dependencies_block, etc.]
AI: [Step 2] get_hcl_config_reference(config="dependency")
```
**Benefits**:
- List mode reveals exact block names
- Category filter focuses results
- Avoids naming errors

**Token Savings**: ~150 tokens by avoiding failed lookups

---

### Pattern 7: get_guidance - Type Selection

Guidance tool has different types for different needs.

#### ❌ Inefficient Pattern
```text
User: "Should I use dependency or dependencies?"
AI: search_docs(query="dependency vs dependencies")
    [Gets documentation but not direct comparison]
```
**Problem**: Documentation search doesn't provide comparison. User needs explicit guidance.

#### ✅ Efficient Pattern
```text
User: "Should I use dependency or dependencies?"
AI: get_guidance(type="comparison", topic="dependency vs dependencies")
    [or]
AI: get_hcl_config_reference(config="dependency", listBlocks=true)
    [Then] get_guidance(type="comparison", block1="dependency", block2="dependencies")
```
**Benefits**:
- Direct comparison with use cases
- Structured decision guidance
- Avoids interpreting docs manually

**Token Savings**: ~500 tokens by getting focused guidance vs full docs

---

### Pattern 8: build_config - Template Discovery First

Config generation requires knowing available templates.

#### ❌ Inefficient Pattern
```text
User: "Generate an S3 backend config"
AI: build_config(useCase="remote_state", backend="s3", options={...})
    [Might fail due to missing required options]
```
**Problem**: Guessing required options leads to validation errors.

#### ✅ Efficient Pattern
```text
User: "Generate an S3 backend config"
AI: [Step 1] build_config(listTemplates=true, useCase="remote_state")
    [See available backend templates and their variables]
AI: [Step 2] build_config(useCase="remote_state", backend="s3", 
            options={bucket:"my-bucket", region:"us-east-1", ...})
```
**Benefits**:
- Template listing shows required/optional variables
- Tier information guides complexity choice
- Reduces validation errors

**Token Savings**: ~300 tokens by avoiding failed attempts

---

### Pattern 9: diagnose_terragrunt_error - Context Enrichment

Error diagnosis improves with context.

#### ❌ Inefficient Pattern
```text
User: "I'm getting 'Error: module not found'"
AI: diagnose_terragrunt_error(error_message="Error: module not found")
```
**Problem**: Generic error without context returns generic solutions.

#### ✅ Efficient Pattern
```text
User: "I'm getting 'Error: module not found' when running terragrunt apply"
AI: diagnose_terragrunt_error(
      error_message="Error: module not found",
      command="terragrunt apply",
      filePath="prod/us-east-1/app/terragrunt.hcl",
      backend="s3",
      enrichWithDocs=true,
      minConfidence=0.5
    )
```
**Benefits**:
- Context improves pattern matching accuracy
- enrichWithDocs provides solution references
- Higher confidence solutions first

**Token Savings**: Saves time/tokens on follow-up searches (~400 tokens)

---

### Pattern 10: get_server_metrics - Targeted Monitoring

Metrics tool provides observability. Use for debugging or optimization.

#### ❌ Inefficient Pattern
```text
[Calling metrics on every operation]
```
**Problem**: Metrics useful for debugging, but adds overhead to normal operations.

#### ✅ Efficient Pattern
```text
[Call metrics when:]
- Troubleshooting performance issues
- Validating mode selection benefits  
- Monitoring resource usage in production
- Collecting usage statistics

AI: get_server_metrics()
    [Returns: memory usage, cache hit rates, tool call counts, etc.]
```
**Benefits**:
- Strategic use avoids overhead
- Valuable for optimization decisions
- Helps validate multi-mode effectiveness

---

## Multi-Tool Workflows

### Workflow 1: Learning About a Feature

**Goal**: Understand a Terragrunt feature completely

**Sequence**:
```
1. search_docs(mode="search", query="<feature>", detailLevel="summary")
   → Get overview and identify relevant section

2. search_docs(mode="section", section="<identified_section>")
   → Get complete documentation

3. search_docs(mode="examples", advanced=true, category="<feature>")
   → Get code examples

4. get_guidance(type="best-practices", topic="<feature>")
   → Learn recommended patterns

5. function_reference(search="<feature>")
   → Discover related built-in functions (if applicable)
```

**Example**:
```text
User: "I need to learn about Terragrunt hooks"

AI: 
Step 1: search_docs(mode="search", query="hooks", detailLevel="summary", pageSize=3)
Result: Found hooks in "features" section

Step 2: search_docs(mode="section", section="features")  
Result: Retrieved complete hooks documentation

Step 3: search_docs(mode="examples", advanced=true, category="hooks", limit=5)
Result: Got before_hook, after_hook examples

Step 4: get_guidance(type="best-practices", topic="hooks")
Result: Learned best practices for hook usage

Summary provided to user with key concepts, examples, and recommendations.
```

**Token Efficiency**: ~60% savings vs retrieving all content at full detail initially

---

### Workflow 2: Configuration Generation

**Goal**: Create a valid Terragrunt configuration file

**Sequence**:
```
1. get_hcl_config_reference(listBlocks=true)
   → Understand available HCL blocks

2. get_hcl_config_reference(config="<block_name>")
   → Get specific block syntax

3. build_config(listTemplates=true, useCase="<use_case>")
   → See available templates

4. build_config(useCase="<use_case>", ..., options={...})
   → Generate configuration

5. [Optional] get_guidance(type="best-practices", topic="<use_case>")
   → Validate against best practices
```

**Example**:
```text
User: "Create a terragrunt.hcl with S3 backend"

AI:
Step 1: build_config(listTemplates=true, useCase="remote_state")
Result: S3 template requires: bucket, region, key

Step 2: build_config(
          useCase="remote_state",
          backend="s3",
          tier="essential",
          options={
            bucket: "my-terraform-state",
            region: "us-east-1",
            key: "terraform.tfstate"
          }
        )
Result: Generated configuration

Step 3: get_guidance(type="best-practices", topic="remote_state")
Result: Recommendations for state management

AI provides: Generated config + best practice notes
```

**Token Efficiency**: Direct generation vs searching docs manually saves ~1,200 tokens

---

### Workflow 3: Error Troubleshooting

**Goal**: Diagnose and fix a Terragrunt error

**Sequence**:
```
1. diagnose_terragrunt_error(error_message="<error>", command="...", filePath="...", backend="...")
   → Get initial diagnosis and solutions

2. search_docs(mode="search", query="<error_topic>")
   → Find related documentation

3. get_guidance(type="best-practices", topic="<error_type>")
   → Get best practices guidance for avoiding this error

4. [If config issue] get_hcl_config_reference(config="<block>")
   → Verify correct syntax

5. [If solution found] build_config(...) or provide manual fix
```

**Example**:
```text
User: "Error: Could not load plugin"

AI:
Step 1: diagnose_terragrunt_error(
          error_message="Could not load plugin",
          command="terragrunt init",
          enrichWithDocs=true
        )
Result: Likely provider version issue, need to check terraform block

Step 2: get_hcl_config_reference(config="terraform")
Result: Got terraform block syntax

Step 3: get_guidance(type="best-practices", topic="provider_configuration")
Result: Common provider error solutions

AI provides: Diagnosis + corrected terraform block + explanation
```

**Token Efficiency**: Structured diagnosis vs trial-and-error saves ~2,000 tokens

---

### Workflow 4: Code Review / Best Practices Check

**Goal**: Validate existing configuration against best practices

**Sequence**:
```
1. [User provides config]

2. get_hcl_config_reference(config="<each_block>")
   → Verify syntax for each block

3. get_guidance(type="best-practices", topic="<each_feature>")
   → Check against recommendations

4. get_guidance(type="comparison", topic="<alternative_approaches>")
   → Suggest improvements

5. [If issues] build_config(...) to show corrected version
```

**Example**:
```text
User: "Review my terragrunt.hcl" [provides config with dependency block]

AI:
Step 1: get_hcl_config_reference(config="dependency")
Result: Verified dependency block syntax

Step 2: get_guidance(type="best-practices", topic="dependencies")
Result: Found recommendation to use outputs instead of direct config

Step 3: get_guidance(type="comparison", topic="dependency patterns")
Result: Showed alternative approaches

AI provides: Validation results + improvement suggestions + examples
```

**Token Efficiency**: Targeted validation vs full doc search saves ~800 tokens

---

### Workflow 5: Function Discovery and Usage

**Goal**: Find and use the right built-in function

**Sequence**:
```
1. function_reference(category="<category>") or function_reference(search="<keyword>")
   → Discover available functions

2. function_reference(function_name="<name>", mode="full", include_examples=true)
   → Get detailed usage

3. search_docs(mode="examples", query="<function_name>")
   → Find real-world examples

4. get_guidance(type="best-practices", topic="<function_category>")
   → Learn usage best practices
```

**Example**:
```text
User: "How do I reference parent folder configs?"

AI:
Step 1: function_reference(category="path")
Result: Found find_in_parent_folders, path_relative_to_include

Step 2: function_reference(function_name="find_in_parent_folders", mode="full")
Result: Complete function documentation

Step 3: search_docs(mode="examples", query="find_in_parent_folders", limit=3)
Result: Real-world usage examples

AI provides: Function explanation + multiple usage examples
```

**Token Efficiency**: Category filtering vs listing all functions saves ~1,500 tokens

---

## Multi-Mode Orchestration

### Understanding Mode Selection

The multi-mode architecture provides 5 operational modes:

| Mode | Tools | Token Overhead | Best For |
|------|-------|----------------|----------|
| **CORE** | search_docs, function_reference, cli_reference, get_hcl_config_reference | 965 | Documentation lookup, learning |
| **CONFIG** | build_config, get_hcl_config_reference | 640 | Configuration generation |
| **GUIDANCE** | get_guidance, diagnose_terragrunt_error | 683 | Troubleshooting, best practices |
| **OBSERVABILITY** | get_server_metrics | 155 | Monitoring, metrics |
| **FULL** | All 8 tools | 2,441 | Mixed workflows, backward compatibility |

---

### Strategy 1: Single Optimized Mode

**When**: Workflow is well-defined and uses 1-2 tool categories

**Setup**: Configure one server instance with optimal mode

**Example - Documentation-Heavy User**:
```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

**Benefits**:
- 60% token reduction vs FULL mode (965 vs 2,441 tokens)
- Faster AI processing
- Simpler mental model

**Limitations**: 
- Can't generate configs (missing build_config)
- Can't diagnose errors (missing diagnose_terragrunt_error)

**Best For**: Users who primarily read documentation and look up references

---

### Strategy 2: Multiple Specialized Instances

**When**: Workflow spans multiple categories but tasks are sequential

**Setup**: Run multiple mode-specific instances simultaneously

**Example - Full Workflow Coverage**:
```json
{
  "mcp.servers": {
    "terragrunt-docs": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    "terragrunt-config": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-config"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    "terragrunt-troubleshoot": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-guidance"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

**Benefits**:
- Each instance optimized for its role
- Total token overhead: 965 + 640 + 683 = 2,288 tokens (6% reduction vs FULL mode's 2,441)
- AI can select appropriate server per task
- Primary benefit is server specialization and reduced memory per instance, not token reduction

**AI Selection Logic**:
```text
Task: "Search for dependency documentation"
→ Select: terragrunt-docs (CORE mode)
→ Use: search_docs tool

Task: "Generate backend config"  
→ Select: terragrunt-config (CONFIG mode)
→ Use: build_config tool

Task: "Diagnose error message"
→ Select: terragrunt-troubleshoot (GUIDANCE mode)
→ Use: diagnose_terragrunt_error tool
```

**Best For**: Power users with diverse workflows

---

### Strategy 3: Fallback Pattern

**When**: Uncertain which mode needed, or during migration

**Setup**: Primary optimized mode + FULL mode as fallback

**Example**:
```json
{
  "mcp.servers": {
    "terragrunt-fast": {
      "command": "node",
      "args": ["bin/terragrunt-mcp-core"],
      "cwd": "/path/to/terragrunt-mcp-server"
    },
    "terragrunt-complete": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

**AI Usage Pattern**:
```text
Default: Use terragrunt-fast (CORE mode) for common tasks
Fallback: Use terragrunt-complete (FULL mode) when needed tool missing
```

**Benefits**:
- Optimized for common case (94% of queries use docs)
- Complete coverage for edge cases
- Easy migration path

**Best For**: Users transitioning to multi-mode architecture

---

### Cross-Mode Workflows

Some workflows naturally span multiple modes. Here's how to orchestrate:

#### Example 1: Learn → Generate Workflow

```text
User: "I need to set up remote state with S3"

Step 1 [CORE mode - terragrunt-docs]:
  search_docs(mode="search", query="remote state S3", detailLevel="summary")
  → Learn about remote state

Step 2 [CONFIG mode - terragrunt-config]:
  build_config(listTemplates=true, useCase="remote_state")
  → See S3 template variables

Step 3 [CONFIG mode - terragrunt-config]:
  build_config(useCase="remote_state", backend="s3", options={...})
  → Generate configuration

Step 4 [GUIDANCE mode - terragrunt-troubleshoot]:
  get_guidance(type="best-practices", topic="remote_state")
  → Validate approach
```

**Token Efficiency**: Using 3 specialized servers (965 + 640 + 683 = 2,288 tokens) vs FULL mode (2,441 tokens) = **6% reduction**. Primary benefit is reduced memory footprint and server specialization rather than token reduction.

---

#### Example 2: Error → Fix Workflow

```text
User: "Getting error: 'No double-slash in source'"

Step 1 [GUIDANCE mode - terragrunt-troubleshoot]:
  diagnose_terragrunt_error(error_message="No double-slash in source")
  → Identify terraform source URL issue

Step 2 [CORE mode - terragrunt-docs]:
  get_hcl_config_reference(config="terraform")
  → Get correct syntax for terraform block

Step 3 [CORE mode - terragrunt-docs]:
  search_docs(mode="examples", query="terraform source")
  → Get example source URLs

Step 4 [CONFIG mode - terragrunt-config]:
  build_config(useCase="terraform_block", options={source:"git::..."})
  → Generate corrected block
```

**Token Efficiency**: Sequential mode usage as needed vs loading all tools upfront

---

### Mode Selection Decision Tree

```
┌─────────────────────────────────────────┐
│  What does the user primarily need?     │
└──────────────┬──────────────────────────┘
               │
   ┌───────────┼────────────┬──────────────┬─────────────┐
   │           │            │              │             │
   v           v            v              v             v
[Read]    [Create]      [Fix]        [Monitor]    [Everything]
   │           │            │              │             │
   v           v            v              v             v
CORE       CONFIG      GUIDANCE    OBSERVABILITY      FULL
   │           │            │              │             │
   v           v            v              v             v
 965        640 tok      683 tok        155 tok      2,441 tok
tokens                                                        
   │           │            │              │             │
   │           │            │              │             │
Tools:      Tools:       Tools:         Tools:        Tools:
- search    - build      - diagnose     - metrics     - All 8
- function  - hcl_ref    - guidance                   
- cli                                                 
- hcl_ref                                             
```

**Quick Decision Guide**:

- **"How do I...?"** → CORE mode
- **"Generate config for..."** → CONFIG mode  
- **"Fix this error..."** → GUIDANCE mode
- **"Show metrics..."** → OBSERVABILITY mode
- **"Do several different things"** → FULL mode or multiple instances

---

## Best Practices

### 1. Progressive Disclosure

Start with summaries, drill down to details only when needed.

**Pattern**:
```
summary mode → identify relevant item → full mode for that item
```

**Example**:
```javascript
// Step 1: Summary view
search_docs(mode="list")  // See all sections
→ 7 sections returned (small response)

// Step 2: Identify target
User interested in "features"

// Step 3: Detailed view
search_docs(mode="section", section="features", detailLevel="full")
→ Complete documentation for chosen section only
```

**Savings**: 60-90% token reduction on initial discovery

---

### 2. Leverage Filters and Limits

All tools support filtering. Use it to reduce response size.

**Examples**:
```javascript
// Function lookup
function_reference(category="aws")  // Not all functions
function_reference(search="env")    // Not all functions

// CLI commands  
cli_reference(category="backend")   // Not all commands

// Examples
search_docs(mode="examples", limit=3)  // Not all examples

// Error diagnosis
diagnose_terragrunt_error(..., options={maxMatches: 3})
```

---

### 3. Batch Discovery Operations

When learning, batch list/browse operations before detail calls.

**Pattern**:
```
1. List all categories/sections
2. Review names
3. Request specific items
```

**Example**:
```javascript
// Batch approach
get_hcl_config_reference(listBlocks=true)
→ See all 15 blocks

// Then request only needed ones
get_hcl_config_reference(config="dependency")
get_hcl_config_reference(config="generate")

// NOT: Request each block individually without knowing names
```

---

### 4. Include Context in Error Diagnosis

More context = better diagnosis = fewer follow-up queries.

**Always provide when available**:
```javascript
diagnose_terragrunt_error(
  error_message="<full error text>",
  command="terragrunt apply",      // What command was run
  filePath="prod/app/terragrunt.hcl",  // Where
  backend="s3",                    // Backend type
  module="app",                    // Module name
  version="v0.45.0",               // Terragrunt version
  enrichWithDocs=true,             // Get solution links
  minConfidence=0.5                // Confidence threshold
)
```

---

### 5. Cache-Friendly Patterns

Consistent query patterns improve caching effectiveness.

**Good**:
```javascript
// Consistent parameter order and values
search_docs(mode="search", query="dependencies", detailLevel="summary")
search_docs(mode="search", query="hooks", detailLevel="summary")
```

**Less Optimal**:
```javascript
// Varying parameters reduces cache hits
search_docs(query="dependencies")  // Different default mode
search_docs(mode="search", query="hooks", detailLevel="full", page=1)
```

**Recommendation**: Establish consistent parameter patterns within a session.

---

### 6. Mode Selection Per Task Type

Don't use FULL mode when specialized mode suffices.

**Task-Mode Mapping**:

| Task Type | Optimal Mode | Token Overhead |
|-----------|--------------|----------------|
| Reading documentation | CORE | 155 |
| Looking up functions | CORE | 155 |
| Looking up CLI commands | CORE | 155 |
| Generating configs | CONFIG | 435 |
| Getting HCL syntax | CORE or CONFIG | 155 or 435 |
| Troubleshooting errors | GUIDANCE | 589 |
| Getting best practices | GUIDANCE | 589 |
| Viewing metrics | OBSERVABILITY | 244 |
| Mixed tasks | FULL or multiple instances | 2,441 or sum |

---

### 7. Validate Before Generate

When generating configs, validate inputs first.

**Pattern**:
```javascript
// Step 1: See what's required
build_config(listTemplates=true, useCase="remote_state")

// Step 2: Validate against best practices
get_guidance(type="best-practices", topic="remote_state")

// Step 3: Generate with validated inputs
build_config(useCase="remote_state", backend="s3", options={...})
```

**Benefit**: Avoids generation errors and rework.

---

### 8. Use Comparison Guidance for Decisions

When choosing between approaches, use comparison guidance.

**Pattern**:
```javascript
get_guidance(type="comparison", topic="dependency vs dependencies")
// or
get_guidance(type="comparison", block1="dependency", block2="dependencies")
```

**Benefit**: Structured comparison with use cases and trade-offs.

---

### 9. Combine Search with Examples

For practical learning, combine documentation with code examples.

**Pattern**:
```javascript
// Step 1: Understand concept
search_docs(mode="search", query="hooks", detailLevel="summary")

// Step 2: See it in action
search_docs(mode="examples", advanced=true, category="hooks")

// Step 3: Get implementation guidance
get_guidance(type="best-practices", topic="hooks")
```

---

### 10. Monitor and Optimize

Use metrics to validate optimization strategies.

**Pattern**:
```javascript
// Before optimization
get_server_metrics()
→ Note: cache hit rate, tool call distribution, memory usage

// After optimization (different mode, better patterns)
get_server_metrics()
→ Compare: improved cache hits, reduced memory

// Use data to refine approach
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Full Detail by Default

```javascript
// DON'T
search_docs(mode="search", query="dependencies", detailLevel="full")
```

**Problem**: Returns massive responses when summary would suffice for initial understanding.

**Fix**: Always start with `detailLevel="summary"`, then get full details if needed.

---

### ❌ Anti-Pattern 2: Repeated Identical Calls

```javascript
// DON'T
function_reference(function_name="get_env")
// ... later in same session ...
function_reference(function_name="get_env")  // Same call again
```

**Problem**: Wastes tokens on duplicate requests. Cache the response in conversation context.

**Fix**: Reference previous response or explicitly reload only if updates expected.

---

### ❌ Anti-Pattern 3: Guessing Block/Function Names

```javascript
// DON'T
get_hcl_config_reference(config="dependencies")  // Guess
→ Error: Block not found

get_hcl_config_reference(config="dependency")  // Try again
```

**Problem**: Failed calls waste tokens and time.

**Fix**: Use list mode first:
```javascript
get_hcl_config_reference(listBlocks=true)
→ See exact block names
```

---

### ❌ Anti-Pattern 4: Using FULL Mode for Single-Category Tasks

```javascript
// DON'T
[Running FULL mode server with 2,441 token overhead]
User: "Search for dependency docs"
→ search_docs(...)
```

**Problem**: Loading 8 tools when only need 1.

**Fix**: Use CORE mode (965 tokens, 60% reduction) for documentation tasks.

---

### ❌ Anti-Pattern 5: No Context in Error Diagnosis

```javascript
// DON'T
diagnose_terragrunt_error(error_message="Error occurred")
```

**Problem**: Generic error with no context returns generic solutions.

**Fix**: Include all available context:
```javascript
diagnose_terragrunt_error(
  error_message="<full error>",
  command="terragrunt apply",
  filePath="path/to/terragrunt.hcl",
  backend="s3"
)
```

---

### ❌ Anti-Pattern 6: Not Using Pagination

```javascript
// DON'T
search_docs(query="terraform", pageSize=100)  // Huge response
```

**Problem**: Large responses waste tokens when user only needs first few results.

**Fix**: Use default pagination (10 items), get more only if needed.

---

### ❌ Anti-Pattern 7: Searching When Should List

```javascript
// DON'T
search_docs(query="what sections exist")  // Search for metadata
```

**Problem**: Search meant for content, not for listing structure.

**Fix**: Use list mode for structural queries:
```javascript
search_docs(mode="list")  // Returns section names
```

---

### ❌ Anti-Pattern 8: Ignoring Tool Modes

```javascript
// DON'T
search_docs(query="show me hook examples")  // Wrong mode
```

**Problem**: Search mode returns docs, not examples.

**Fix**: Use correct mode for task:
```javascript
search_docs(mode="examples", query="hooks")
```

---

### ❌ Anti-Pattern 9: Not Leveraging Categories

```javascript
// DON'T
function_reference()  // List all 50+ functions
→ Find the one path function in the list
```

**Problem**: Returns everything when need specific subset.

**Fix**: Use category filter:
```javascript
function_reference(category="path")  // Only path functions
```

---

### ❌ Anti-Pattern 10: Over-Requesting Examples

```javascript
// DON'T
search_docs(mode="examples", advanced=true)  // All examples
```

**Problem**: Returns all curated examples (20+) when need 2-3.

**Fix**: Use limit parameter:
```javascript
search_docs(mode="examples", advanced=true, limit=3)
```

---

## Quick Reference

### Tool Selection Cheat Sheet

| User Intent | Optimal Tool | Key Parameters |
|-------------|-------------|----------------|
| Search documentation | `search_docs` | `mode="search"`, `detailLevel="summary"` |
| List doc sections | `search_docs` | `mode="list"` |
| Get section content | `search_docs` | `mode="section"`, `section="name"` |
| Find code examples | `search_docs` | `mode="examples"`, `advanced=true` |
| Look up function | `function_reference` | `function_name="name"` |
| Browse functions | `function_reference` | `category="..."` or `search="..."` |
| Get CLI command help | `cli_reference` | `command="name"` |
| List CLI commands | `cli_reference` | `category="..."` or omit |
| Get HCL syntax | `get_hcl_config_reference` | `config="block_name"` |
| List HCL blocks | `get_hcl_config_reference` | `listBlocks=true` |
| Get best practices | `get_guidance` | `type="best-practices"`, `topic="..."` |
| Compare approaches | `get_guidance` | `type="comparison"`, `topic="A vs B"` |
| Get pattern guidance | `get_guidance` | `type="pattern"`, `scenario="..."` |
| Generate config | `build_config` | `useCase="..."`, `options={...}` |
| List templates | `build_config` | `listTemplates=true` |
| Diagnose error | `diagnose_terragrunt_error` | `error_message`, `command`, `filePath`, etc. |
| View metrics | `get_server_metrics` | (no parameters) |

---

### Mode Selection Flowchart

```
User Request
    │
    ├─ Documentation lookup? ──→ CORE mode (965 tokens)
    │   └─ Tools: search_docs, function_reference, cli_reference, get_hcl_config_reference
    │
    ├─ Generate configuration? ──→ CONFIG mode (435 tokens)
    │   └─ Tools: build_config, get_hcl_config_reference
    │
    ├─ Fix error / get advice? ──→ GUIDANCE mode (589 tokens)
    │   └─ Tools: get_guidance, diagnose_terragrunt_error
    │
    ├─ View metrics? ──→ OBSERVABILITY mode (244 tokens)
    │   └─ Tools: get_server_metrics
    │
    └─ Multiple of above? ──→ FULL mode (2,441 tokens) OR multiple instances
        └─ Tools: All 8 tools
```

---

### Common Workflow Patterns

#### Pattern: Quick Lookup
```
1. search_docs(mode="search", query="X", detailLevel="summary")
2. [Done - user has answer]
```

#### Pattern: Deep Dive
```
1. search_docs(mode="search", query="X", detailLevel="summary")
2. search_docs(mode="section", section="Y")
3. search_docs(mode="examples", query="X")
4. get_guidance(type="best-practices", topic="X")
```

#### Pattern: Generate Config
```
1. build_config(listTemplates=true, useCase="X")
2. build_config(useCase="X", options={...})
```

#### Pattern: Troubleshoot Error
```
1. diagnose_terragrunt_error(error_message="...", command="...", filePath="...")
2. search_docs(mode="search", query="<error_topic>")
3. get_guidance(type="best-practices", topic="<error_type>")
```

#### Pattern: Function Discovery
```
1. function_reference(category="X")  OR  function_reference(search="keyword")
2. function_reference(function_name="Y", mode="full", include_examples=true)
```

---

### Token Efficiency Summary

| Strategy | Token Overhead | Savings vs FULL |
|----------|----------------|-----------------|
| FULL mode (default) | 2,441 | 0% (baseline) |
| CORE mode only | 965 | **60%** |
| CONFIG mode only | 640 | **74%** |
| GUIDANCE mode only | 683 | **72%** |
| OBSERVABILITY mode only | 155 | **94%** |
| Multi-instance (all 4) | 2,288 | **6%** |
| Use `detailLevel="summary"` | Additional 60-90% response reduction |
| Use pagination/limits | Additional 50-80% response reduction |

**Combined optimizations** (e.g., OBSERVABILITY mode + summary mode + limits) can achieve **95-98% total token reduction** vs naive FULL mode with full details.

---

## Conclusion

Effective AI assistant usage with the Terragrunt MCP Server requires:

1. **Understanding tool modes** - Each tool has parameters that control behavior
2. **Progressive refinement** - Start broad (summary/list), narrow to specific (full/detail)
3. **Strategic mode selection** - Match server mode to workflow (CORE/CONFIG/GUIDANCE/etc.)
4. **Context inclusion** - More context = better results = fewer iterations
5. **Token awareness** - Minimize overhead through smart parameter choices

By following these patterns, AI assistants can provide more accurate, efficient, and helpful responses while consuming 60-94% fewer tokens than naive approaches through mode selection alone, with up to 98% reduction when combined with other optimizations.

---

## Additional Resources

- [Available Tools Reference](Available-Tools.md) - Complete tool documentation
- [Migration Guide](MIGRATION_GUIDE.md) - Multi-mode architecture setup
- [Best Practices Guide](Best-Practices-Guide.md) - Terragrunt usage patterns
- [Troubleshooting Guide](Troubleshooting-Guide.md) - Common issues and solutions

---

*Last Updated: 2025-12-17*  
*Compatible with: v0.5.0+ multi-mode architecture*
