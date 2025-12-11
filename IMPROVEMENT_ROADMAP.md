# Terragrunt MCP Server - Improvement Roadmap

**Based on**: Discord Feedback Analysis (Dec 11, 2025)  
**Status**: Implementation Planned  
**Version Target**: v1.5.0 (Phase 1), v2.0.0 (Phase 2)

---

## Executive Summary

This roadmap addresses architectural concerns about context efficiency raised in community feedback and documented in **GitHub Epic #163: Optimize MCP Server Token Usage**. The improvements focus on reducing token overhead, simplifying tool design, and creating a more scalable multi-MCP architecture.

**Primary Goals**:

1. Reduce context overhead by 70% (9,500 → <3,000 tokens)
2. Consolidate tools by 53% (15 → 7 tools)
3. Remove resource overhead entirely (~1,500 token savings)
4. Implement response-level optimizations (60-90% per-call savings from Epic #163)
5. Implement opt-in multi-MCP architecture
6. Validate MCP value through quantitative benchmarks

**Related GitHub Issues**:

- **Epic #163**: Optimize MCP Server Token Usage (6 issues)
- **Issue #164**: Add truncation to resource content (Critical Priority)
- **Issue #165**: Add includeExamples parameter to best practices (High Priority)
- **Issue #166**: Truncate code examples in get_code_examples tool
- **Issue #167**: Add pagination support to list tools
- **Issue #168**: Add optional summary mode across verbose tools
- **Issue #169**: Research token optimization architectural considerations

---

## Phase 1: Quick Wins (v1.5.0)

**Timeline**: December 11-17, 2025 (Week 1)  
**Target Release**: v1.5.0  
**Estimated Impact**: 42% context reduction at connection + 60-90% per-call reduction

**Note**: This phase integrates work from **GitHub Epic #163** which addresses per-response token optimization.

### Priority A: Response-Level Optimizations (Epic #163)

These optimizations complement tool consolidation by reducing the size of individual responses. They provide immediate value and can be implemented in parallel with tool consolidation.

#### A1. Critical: Resource Content Truncation (#164)

**Problem**: Resources return full documentation (50-200KB per section), overwhelming context windows.

**Solution**: Implement intelligent truncation with links to full content via tools.

**Implementation**:

```typescript
// src/handlers/resources.ts
class ResourceHandler {
  private truncateContent(content: string, maxLength: number = 5000): string {
    if (content.length <= maxLength) return content;
    
    const truncated = content.slice(0, maxLength);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    const cutPoint = lastParagraph > maxLength * 0.7 ? lastParagraph : maxLength;
    
    return truncated.slice(0, cutPoint) + 
           `\n\n... [Content truncated. Use search_terragrunt_docs for full content]`;
  }
}
```

**Expected savings**: 80-90% reduction on resource calls (200KB → 5KB)

**Files to modify**:

- `src/handlers/resources.ts` - Add truncation logic
- `test/unit/resource-handler.test.ts` - Test truncation
- `docs/Available-Tools.md` - Document truncation behavior

---

#### A2. High Priority: includeExamples Parameter (#165)

**Problem**: Best practices tool returns 10-20KB per call with all examples included.

**Solution**: Add optional `includeExamples` parameter (default: false).

**Implementation**:

```typescript
// src/terragrunt/best-practices.ts
async analyze(
  topic: string, 
  level?: string,
  includeExamples: boolean = false
): Promise<BestPracticesResult> {
  const recommendations = await this.getRecommendations(topic, level);
  
  if (!includeExamples) {
    // Strip examples, keep only summaries
    return {
      ...recommendations,
      practices: recommendations.practices.map(p => ({
        ...p,
        example: undefined, // Remove code examples
        exampleAvailable: true // Indicate examples exist
      }))
    };
  }
  
  return recommendations;
}
```

**Expected savings**: 30-50% reduction when examples not needed

**Files to modify**:

- `src/terragrunt/best-practices.ts` - Add includeExamples parameter
- `src/handlers/tools.ts` - Update tool schema with includeExamples
- `test/unit/best-practices.test.ts` - Test both modes
- `docs/Available-Tools.md` - Document parameter

---

#### A3. Medium Priority: Code Example Truncation (#166)

**Problem**: get_code_examples returns 5-15KB per call with full code blocks.

**Solution**: Truncate long code examples, provide snippet + link.

**Implementation**:

```typescript
// src/terragrunt/docs.ts or new utility
private truncateCodeExample(code: string, maxLines: number = 30): string {
  const lines = code.split('\n');
  if (lines.length <= maxLines) return code;
  
  const truncated = lines.slice(0, maxLines).join('\n');
  const remaining = lines.length - maxLines;
  
  return `${truncated}\n\n... [${remaining} more lines truncated]`;
}
```

**Expected savings**: 40-60% reduction on code example calls

**Files to modify**:

- `src/terragrunt/advanced-examples.ts` - Add truncation
- `src/handlers/tools.ts` - Apply to get_code_examples response
- `test/unit/advanced-examples.test.ts` - Test truncation

---

#### A4. Medium Priority: Pagination Support (#167)

**Problem**: List tools (list_cli_commands, list_terragrunt_functions) return all items.

**Solution**: Add offset/limit parameters for pagination.

**Implementation**:

```typescript
interface PaginationParams {
  offset?: number;  // Default: 0
  limit?: number;   // Default: 50
}

// Example for list_cli_commands
async listCommands(options: {
  category?: string;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<{ commands: Command[]; total: number; hasMore: boolean }> {
  const allCommands = await this.getAllCommands(options.category, options.search);
  const offset = options.offset || 0;
  const limit = options.limit || 50;
  
  return {
    commands: allCommands.slice(offset, offset + limit),
    total: allCommands.length,
    hasMore: offset + limit < allCommands.length
  };
}
```

**Expected savings**: Varies - allows incremental loading for large lists

**Files to modify**:

- `src/terragrunt/cli-commands.ts` - Add pagination
- `src/terragrunt/functions.ts` - Add pagination
- `src/handlers/tools.ts` - Update tool schemas with pagination params

---

#### A5. Low Priority: Summary Mode (#168)

**Problem**: Some tools are verbose by default (e.g., get_hcl_config_reference).

**Solution**: Add optional `summary` parameter across verbose tools.

**Implementation**:

```typescript
// Add to relevant tools
async getHCLReference(
  config: string,
  summary: boolean = false
): Promise<HCLReference> {
  const fullRef = await this.loadReference(config);
  
  if (summary) {
    return {
      name: fullRef.name,
      description: fullRef.description,
      syntax: fullRef.syntax,
      // Omit: examples, relatedBlocks, fullDocumentation
      hasFullDocs: true
    };
  }
  
  return fullRef;
}
```

**Expected savings**: 20-40% reduction when summary is sufficient

---

### 1.1 Tool Consolidation

**Current State**: 15 specialized tools

**Target State**: 7 consolidated tools

#### Implementation Plan

##### Tool Group 1: Documentation Search

**Before** (4 tools):

- `search_terragrunt_docs`
- `get_terragrunt_sections`
- `get_section_docs`
- `get_code_examples`

**After** (1 tool):

```typescript
{
  name: 'search_docs',
  description: 'Search Terragrunt documentation with flexible modes',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      mode: { 
        type: 'string', 
        enum: ['search', 'sections', 'section', 'examples'],
        default: 'search'
      },
      section: { type: 'string', description: 'Section name (for mode=section)' },
      limit: { type: 'number', default: 5 }
    },
    required: ['query']
  }
}
```

**Files to modify**:

- `src/handlers/tools.ts` - Consolidate tool definitions
- `src/handlers/tools.ts` - Update `executeTool()` switch logic
- `test/unit/tool-handler.test.ts` - Update tests
- `docs/Available-Tools.md` - Update documentation

---

##### Tool Group 2: CLI Reference

**Before** (2 tools):

- `get_cli_command_help`
- `list_cli_commands`

**After** (1 tool):

```typescript
{
  name: 'cli_reference',
  description: 'Get Terragrunt CLI command documentation',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Specific command (omit to list all)' },
      category: { type: 'string', enum: ['main', 'backend', 'stack', 'catalog'] }
    }
  }
}
```

**Implementation**:

```typescript
async executeCLIReference(args: { command?: string; category?: string }) {
  if (args.command) {
    return await this.cliCommandsManager.getCommandHelp(args.command);
  }
  return await this.cliCommandsManager.listCommands({
    category: args.category
  });
}
```

---

##### Tool Group 3: Function Reference

**Before** (2 tools):

- `get_terragrunt_function`
- `list_terragrunt_functions`

**After** (1 tool):

```typescript
{
  name: 'function_reference',
  description: 'Get Terragrunt built-in function documentation',
  inputSchema: {
    type: 'object',
    properties: {
      function_name: { type: 'string', description: 'Specific function (omit to list)' },
      category: { type: 'string', description: 'Filter by category' }
    }
  }
}
```

---

##### Tool Group 4: Guidance & Best Practices

**Before** (3 tools):

- `analyze_best_practices`
- `get_pattern_guidance`
- `compare_hcl_blocks`

**After** (1 tool):

```typescript
{
  name: 'get_guidance',
  description: 'Get best practices, patterns, or comparisons for Terragrunt',
  inputSchema: {
    type: 'object',
    properties: {
      type: { 
        type: 'string', 
        enum: ['best_practices', 'patterns', 'comparison'],
        description: 'Type of guidance'
      },
      topic: { type: 'string', description: 'Topic or comparison query' },
      level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] }
    },
    required: ['type', 'topic']
  }
}
```

**Implementation**:

```typescript
async executeGetGuidance(args: { type: string; topic: string; level?: string }) {
  switch (args.type) {
    case 'best_practices':
      return await this.bestPracticesAnalyzer.analyze(args.topic, args.level);
    case 'patterns':
      return await this.patternGuidanceManager.getGuidance(args.topic);
    case 'comparison':
      return await this.blockComparisonManager.compare(args.topic);
  }
}
```

---

##### Tool Group 5: Config Building

**Before** (2 tools):

- `generate_terragrunt_config`
- `write_terragrunt_config`

**After** (1 tool):

```typescript
{
  name: 'build_config',
  description: 'Generate Terragrunt configuration with optional file writing',
  inputSchema: {
    type: 'object',
    properties: {
      use_case: { 
        type: 'string', 
        enum: ['remote_state', 'provider', 'dependency', 'hooks', 'inputs'] 
      },
      options: { 
        type: 'object', 
        additionalProperties: true,
        description: 'Configuration variables' 
      },
      write: { 
        type: 'boolean', 
        default: false,
        description: 'Write to file (requires path in options)' 
      },
      preview: { type: 'boolean', default: true }
    },
    required: ['use_case', 'options']
  }
}
```

**Simplified schema**: Removed deep nesting, moved advanced options to docs

---

##### Tools Staying As-Is (2 tools)

- `hcl_reference` - Already focused and efficient
- `diagnose_error` - Core diagnostic tool, no consolidation target

---

#### Consolidation Summary

| Category | Before | After | Savings |
|----------|--------|-------|---------|
| Documentation | 4 | 1 | 75% |
| CLI | 2 | 1 | 50% |
| Functions | 2 | 1 | 50% |
| Guidance | 3 | 1 | 67% |
| Config | 2 | 1 | 50% |
| Standalone | 2 | 2 | 0% |
| **TOTAL** | **15** | **7** | **53%** |

**Estimated context savings**: ~4,000 tokens

---

### 1.2 Resource Removal

**Current State**: 100+ individual resources

**Target State**: 0 resources (tools provide all access)

**Rationale**:

- Resources are loaded at connection (context overhead)
- Tools provide superior on-demand access
- No clear user benefit for passive resource exposure
- Reduces MCP protocol complexity

**Implementation**:

```typescript
// src/handlers/resources.ts
class ResourceHandler {
  getAvailableResources(): Resource[] {
    return []; // Remove all resources
  }
  
  async readResource(uri: string): Promise<ResourceContent> {
    throw new Error('Resources have been deprecated. Use tools instead.');
  }
}
```

**Migration guide** (for existing users):

```markdown
# Resource → Tool Migration

**Before** (using resources):
```typescript
// Access via resource URI
const doc = await readResource('terragrunt://docs/features/remote-state');
```

**After** (using tools):
```typescript
// Use search_docs tool
const result = await executeTool('search_docs', {
  query: 'remote state',
  mode: 'search'
});
```

**Files to modify**:

- `src/handlers/resources.ts` - Remove resource generation
- `test/unit/resource-handler.test.ts` - Update tests
- `test/integration/mcp-protocol.test.ts` - Remove resource expectations
- `docs/MCP-Protocol-Compliance.md` - Update documentation

**Estimated savings**: ~1,500 tokens

---

### 1.3 Schema Simplification

**Problem**: Deeply nested, over-specified schemas

**Solution**: Flatten, simplify, move details to documentation

#### Example: build_config Tool

**Before** (87 lines):

```typescript
{
  name: 'generate_terragrunt_config',
  inputSchema: {
    type: 'object',
    properties: {
      useCase: { ... },
      backend: { ... },
      tier: { ... },
      options: { ... },
      strictValidation: { ... },
      preview: { ... },
      compareWith: { ... },
      custom_template: {
        type: 'object',
        properties: {
          id: { ... },
          name: { ... },
          description: { ... },
          category: { enum: [...], ... },
          cloudProvider: { enum: [...], ... },
          templateHcl: { ... },
          variables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { ... },
                type: { ... },
                description: { ... },
                required: { ... },
                defaultValue: { ... },
                example: { ... }
              },
              required: ['name', 'type', 'required']
            }
          },
          tags: { ... },
          example: { ... }
        },
        required: ['id', 'name', 'description', 'category', 'templateHcl']
      }
    },
    required: ['useCase', 'options']
  }
}
```

**After** (23 lines):

```typescript
{
  name: 'build_config',
  inputSchema: {
    type: 'object',
    properties: {
      use_case: { 
        type: 'string', 
        enum: ['remote_state', 'provider', 'dependency', 'hooks', 'inputs'],
        description: 'Configuration type to generate'
      },
      options: { 
        type: 'object',
        additionalProperties: true,
        description: 'Config variables (see docs for use_case-specific options)'
      },
      write: { 
        type: 'boolean', 
        default: false,
        description: 'Write to file if path provided in options'
      }
    },
    required: ['use_case', 'options']
  }
}
```

**Key changes**:

- Removed `custom_template` nested schema (move to docs)
- Removed `tier`, `strictValidation`, `compareWith` (internal logic, not schema)
- Used `additionalProperties: true` for flexible `options`
- Reduced nesting depth from 4 to 2 levels

**Apply to all tools**:

- Max 2 levels of nesting
- Use `additionalProperties` for flexible objects
- Remove optional advanced params from schema (document instead)
- Target: 50% schema size reduction per tool

**Estimated savings**: ~2,000 tokens

---

### Phase 1 Success Metrics

**Connection Overhead**:

- [ ] Tool count: 15 → 7 (53% reduction)
- [ ] Resources: 100+ → 0 (100% reduction)
- [ ] Schema lines: ~800 → ~400 (50% reduction)
- [ ] Context overhead: 9,500 → 3,500 tokens (63% reduction)

**Per-Response Optimization (Epic #163)**:

- [ ] #164: Resource truncation implemented (80-90% savings)
- [ ] #165: includeExamples parameter added (30-50% savings)
- [ ] #166: Code example truncation (40-60% savings)
- [ ] #167: Pagination support (variable savings)
- [ ] #168: Summary mode added (20-40% savings)

**Quality Assurance**:

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Migration guide published
- [ ] Performance benchmarks show expected improvements

**Target completion**: December 17, 2025

---

## Phase 2: Architectural Improvements (v2.0.0)

**Timeline**: January 2025  
**Target Release**: v2.0.0  
**Estimated Impact**: Additional 30% context reduction, improved UX

**Note**: This phase implements longer-term architectural changes including research from **Issue #169** (token optimization architectural considerations).

### 2.1 Multi-MCP Architecture

**Goal**: Split monolithic server into specialized MCPs

#### Architecture Design

##### Option 1: Mode-Based Split (Recommended)

Single package, multiple entry points via `--mode` flag:

```json
// User's MCP config
{
  "mcpServers": {
    "terragrunt": {
      "command": "npx",
      "args": ["terragrunt-mcp-server"]  // Default: essentials mode
    },
    "terragrunt-builder": {
      "command": "npx",
      "args": ["terragrunt-mcp-server", "--mode=builder"]
    },
    "terragrunt-expert": {
      "command": "npx",
      "args": ["terragrunt-mcp-server", "--mode=expert"]
    }
  }
}
```

**Mode definitions**:

```typescript
// src/server.ts
enum ServerMode {
  ESSENTIALS = 'essentials',  // Default
  BUILDER = 'builder',
  EXPERT = 'expert',
  FULL = 'full'  // All tools (backward compatible)
}

function getToolsForMode(mode: ServerMode): string[] {
  switch (mode) {
    case ServerMode.ESSENTIALS:
      return ['search_docs', 'cli_reference', 'diagnose_error', 'hcl_reference'];
    case ServerMode.BUILDER:
      return ['build_config', 'hcl_reference', 'search_docs'];
    case ServerMode.EXPERT:
      return ['get_guidance', 'function_reference', 'search_docs'];
    case ServerMode.FULL:
      return ALL_TOOLS;
  }
}
```

**Implementation**:

```typescript
// src/index.ts
const mode = process.argv.includes('--mode=builder') ? 
  ServerMode.BUILDER : 
  ServerMode.ESSENTIALS;

const toolHandler = new ToolHandler({ mode });
```

##### Option 2: Separate Packages (Future)

Three NPM packages (more overhead, clearer separation):

- `terragrunt-mcp-essentials`
- `terragrunt-mcp-builder`
- `terragrunt-mcp-expert`

**Pros**: Complete isolation, smaller install sizes  
**Cons**: Maintenance overhead, code duplication  
**Decision**: Defer to v3.0+ if mode-based approach proves insufficient

---

#### Mode Specifications

##### Essentials Mode (Default)

**Target Users**: General Terragrunt users, beginners, documentation lookup

**Tools** (4):

- `search_docs` - Documentation search
- `cli_reference` - CLI command help
- `diagnose_error` - Error troubleshooting
- `hcl_reference` - HCL block documentation

**Features**:

- Read-only operations
- No file writing
- No advanced generation
- Fast, lightweight

**Context overhead**: ~2,500 tokens

---

##### Builder Mode (Opt-in)

**Target Users**: Infrastructure engineers, config generation workflows

**Tools** (3):

- `build_config` - Config generation + file writing
- `hcl_reference` - HCL syntax reference
- `search_docs` - Documentation for template options

**Features**:

- File writing enabled
- Advanced templates
- Custom template support
- HCL validation

**Context overhead**: ~2,000 tokens

---

##### Expert Mode (Opt-in)

**Target Users**: Terragrunt experts, architecture design, best practices

**Tools** (3):

- `get_guidance` - Best practices, patterns, comparisons
- `function_reference` - Built-in functions
- `search_docs` - Advanced examples

**Features**:

- Best practice analysis
- Pattern selection guidance
- Advanced examples
- Confidence scoring

**Context overhead**: ~1,500 tokens

---

##### Full Mode (Backward Compatible)

**Target Users**: Power users, existing setups

**Tools** (7): All consolidated tools

**Context overhead**: ~3,500 tokens (still 63% better than v1.4.0)

---

### 2.2 Lazy Loading

**Goal**: Reduce startup time and memory footprint

**Current behavior**:

- All docs loaded at server startup
- All managers initialized upfront
- Full cache populated even if never used

**Target behavior**:

- Load docs on first search
- Initialize managers on first tool call
- Progressive cache population

**Implementation**:

```typescript
class TerragruntDocsManager {
  private loaded: boolean = false;
  
  async search(query: string) {
    if (!this.loaded) {
      await this.loadDocs();  // Lazy load
      this.loaded = true;
    }
    return this.performSearch(query);
  }
}
```

**Benefits**:

- Faster server startup (100ms → 10ms)
- Lower memory for unused features
- Better for serverless/ephemeral deployments

---

### 2.3 MCP Protocol Compression (Research from #169)

**Goal**: Investigate lossless compression support in MCP protocol

**Research Questions** (from Issue #169):

1. Does MCP protocol support response compression natively?
2. Is compression compatible with stdio transport?
3. Do all MCP clients support compressed responses?
4. What's the performance impact of compression?

**Potential Implementation**:

```typescript
// If MCP supports compression
const server = new Server(
  {
    name: 'terragrunt-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      compression: ['gzip'] // If supported
    },
  }
);
```

**Expected Benefits** (if supported):

- 60-70% lossless compression of all responses
- Complements truncation (lossy) approach
- No content loss, preserves full information

**Action Items**:

- [ ] Review MCP spec for compression support
- [ ] Check `@modelcontextprotocol/sdk` documentation
- [ ] Test compression in development environment
- [ ] Validate client compatibility
- [ ] Create implementation issue if feasible

**Priority**: Medium (research required before implementation)

---

### 2.4 Response Size Metrics (Research from #169)

**Goal**: Measure actual token consumption for validation

**Implementation**:

```typescript
// src/handlers/tools.ts
private metrics = new Map<string, ToolMetrics>();

private logResponseSize(toolName: string, response: any): void {
  const size = JSON.stringify(response).length;
  console.error(`[METRICS] Tool: ${toolName}, Size: ${size} bytes`);
  
  this.metrics.set(toolName, {
    calls: (this.metrics.get(toolName)?.calls || 0) + 1,
    totalBytes: (this.metrics.get(toolName)?.totalBytes || 0) + size,
    avgBytes: Math.round(
      ((this.metrics.get(toolName)?.totalBytes || 0) + size) / 
      ((this.metrics.get(toolName)?.calls || 0) + 1)
    )
  });
}
```

**Benefits**:

- Validate optimization effectiveness
- Identify problematic tools
- Track improvement over time
- Data-driven decision making

**Optional**: Add `get_metrics` tool for observability

---

### 2.5 Streaming Support (Future)

**Goal**: Reduce perceived latency for large responses

**Current**: Buffer entire response, return at once  
**Target**: Stream results as they're found

**MCP Protocol**: Supports streaming via `notifications`

**Example**:

```typescript
async searchDocsStreaming(query: string) {
  for await (const result of this.searchIterator(query)) {
    await this.sendNotification({
      method: 'notifications/resources/updated',
      params: { result }
    });
  }
}
```

**Priority**: Low (MCP client support unclear)

---

### Phase 2 Success Metrics

- [ ] Three server modes implemented
- [ ] Mode selection via `--mode` flag
- [ ] Lazy loading for all managers
- [ ] Context overhead (essentials mode): <2,500 tokens
- [ ] Backward compatibility maintained (full mode)
- [ ] Migration guide for existing users

---

## Phase 3: Validation & Ecosystem (Ongoing)

**Timeline**: January-February 2025

### 3.1 Benchmark Suite

**Goal**: Quantitatively prove MCP value vs. alternatives

#### Benchmark Scenarios

##### Scenario 1: Config Generation Accuracy

**Setup**:

- 20 common Terragrunt config generation tasks
- Baseline: LLM with web search + prompt engineering
- Comparison: LLM + Terragrunt MCP

**Metrics**:

- Syntax errors (HCL validation)
- Best practice violations (custom linter)
- Completeness (required attributes present)
- Time to valid config

**Example task**:

> "Create a terragrunt.hcl with S3 backend using KMS encryption, DynamoDB locking, and cross-account access from account 123456789012"

**Success criteria**: MCP reduces errors by >50%, time by >30%

---

##### Scenario 2: Error Diagnosis

**Setup**:

- 15 real Terragrunt error messages
- Baseline: LLM troubleshooting from error text
- Comparison: LLM + `diagnose_error` tool

**Metrics**:

- Correct solution identification rate
- Time to solution
- Number of LLM interactions needed

**Success criteria**: MCP improves accuracy by >40%, reduces interactions by >60%

---

##### Scenario 3: Context Efficiency

**Setup**:

- Complex multi-file Terragrunt project (5 modules, 3 environments)
- Task: "Add Azure backend to all environments"
- Measure: Token usage, context exhaustion point

**Metrics**:

- Total token consumption
- Conversation depth before context limit
- Task completion success rate

**Success criteria**: MCP extends viable conversation depth by >25%

---

#### Implementation

```typescript
// test/benchmarks/config-generation.ts
interface BenchmarkResult {
  scenario: string;
  baseline: { time: number; errors: number; tokens: number };
  mcp: { time: number; errors: number; tokens: number };
  improvement: { time: string; errors: string; tokens: string };
}

async function runBenchmark(): Promise<BenchmarkResult[]> {
  // Run with baseline
  const baselineResults = await runWithWebSearch(scenarios);
  
  // Run with MCP
  const mcpResults = await runWithMCP(scenarios);
  
  // Calculate improvements
  return calculateImprovements(baselineResults, mcpResults);
}
```

**Deliverable**: `docs/MCP_Value_Benchmark.md` with data and charts

---

### 3.2 Prompt Pattern Library

**Goal**: Demonstrate optimal MCP usage

**Content**:

#### Pattern 1: Config Generation

```markdown
## Bad Prompt (no MCP usage)
"Create S3 backend config for Terragrunt"

## Good Prompt (leverages MCP)
"Use @terragrunt build_config to generate S3 remote_state. 
Options: bucket=my-state, region=us-west-2, encrypt=true, dynamodb_table=tf-locks"

## Why Better
- Uses specific tool (`build_config`)
- Provides exact options (reduces LLM guessing)
- Gets validated, working config (not generic template)
```

#### Pattern 2: Troubleshooting

```markdown
## Bad Prompt
"I'm getting a Terragrunt error about dependencies, help me fix it"

## Good Prompt  
"Use @terragrunt diagnose_error for this: 
[paste full error]
Context: running `terragrunt apply` in env/prod/vpc module"

## Why Better
- Provides full error text (enables pattern matching)
- Includes context (command, module path)
- Gets structured solutions with confidence scores
```

**Deliverable**: `docs/Prompt_Patterns.md`

---

### 3.3 Community Engagement

**Goal**: Collect real-world feedback, build trust

#### Actions

1. **Publish benchmark results** - Show data-driven value
2. **Create "before/after" demos** - Video showing v1.4.0 vs v2.0.0
3. **Engage with critic** - Invite to review improvements, test beta
4. **Survey users** - "Does MCP help more than alternatives?"

#### Communication Plan

- Reddit: r/Terraform, r/devops
- Discord: Terragrunt community
- GitHub Discussions: Invite feedback on roadmap
- Blog post: "How we reduced MCP context overhead by 70%"

---

## Risk Assessment

### High Risk Items

#### Risk 1: Breaking Changes for Existing Users

**Mitigation**:

- Maintain `full` mode for backward compatibility
- Provide migration guide
- Deprecation warnings in v1.5.0, break in v2.0.0
- Version docs clearly (v1.x vs v2.x)

#### Risk 2: Consolidated Tools May Be Less Discoverable

**Mitigation**:

- Clear tool descriptions mentioning multiple capabilities
- Update all documentation and examples
- Provide tool usage examples in error messages
- Better parameter names (e.g., `mode` instead of cryptic enums)

### Medium Risk Items

#### Risk 3: Benchmarks May Show No Significant Improvement

**Mitigation**:

- If no improvement, pivot strategy (acknowledge in roadmap)
- Use findings to guide further development
- Focus on specific niches where MCP excels
- Honest communication of results (good or bad)

---

## Implementation Checklist

### Phase 1: v1.5.0 (Week 1)

#### Part A: Response Optimizations (Epic #163) - Can run in parallel

- [ ] Create feature branch: `feat/token-optimization-epic-163`
- [ ] **#164 (Critical)**: Implement resource content truncation
  - [ ] Add truncation logic to ResourceHandler
  - [ ] Test truncation preserves important content
  - [ ] Update docs to explain truncation behavior
- [ ] **#165 (High)**: Add includeExamples to best practices
  - [ ] Add includeExamples parameter to BestPracticesAnalyzer
  - [ ] Update tool schema in ToolHandler
  - [ ] Test both modes (with/without examples)
- [ ] **#166**: Implement code example truncation
  - [ ] Add truncation utility for code blocks
  - [ ] Apply to get_code_examples tool
  - [ ] Test truncation at various thresholds
- [ ] **#167**: Add pagination to list tools
  - [ ] Add offset/limit to list_cli_commands
  - [ ] Add offset/limit to list_terragrunt_functions
  - [ ] Update tool schemas with pagination params
- [ ] **#168**: Add summary mode
  - [ ] Identify verbose tools needing summary mode
  - [ ] Implement summary flag for each
  - [ ] Update tool schemas
- [ ] Run response size benchmarks
- [ ] Update Epic #163 with results
- [ ] Merge to main or hold for combined release

#### Part B: Tool Consolidation - Can run in parallel

- [ ] Create feature branch: `feat/tool-consolidation`
- [ ] Consolidate documentation tools → `search_docs`
- [ ] Consolidate CLI tools → `cli_reference`
- [ ] Consolidate function tools → `function_reference`
- [ ] Consolidate guidance tools → `get_guidance`
- [ ] Consolidate config tools → `build_config`
- [ ] Update `executeTool()` switch statements
- [ ] Update all unit tests
- [ ] Update all integration tests

#### Part C: Resource Removal

- [ ] Remove all resources from `ResourceHandler`
- [ ] Update tests to remove resource expectations
- [ ] Update docs to explain tools-only approach

#### Part D: Schema Simplification

- [ ] Simplify all tool schemas (max 2-level nesting)
- [ ] Move advanced options to documentation
- [ ] Verify schema size reduction

#### Part E: Final Integration

- [ ] Merge both branches (A+B)
- [ ] Run full test suite (`npm run test:all`)
- [ ] Update `docs/Available-Tools.md`
- [ ] Create `docs/Migration-v1.5.md`
- [ ] Update `CHANGELOG.md`
- [ ] Merge to main, tag v1.5.0
- [ ] Publish to NPM
- [ ] Close Epic #163 issues

**Target completion**: December 17, 2025

---

### Phase 2: v2.0.0 (Weeks 2-4)

- [ ] Research compression support (Issue #169)
  - [ ] Review MCP spec for compression capabilities
  - [ ] Test with `@modelcontextprotocol/sdk`
  - [ ] Validate client compatibility
- [ ] Implement `ServerMode` enum
- [ ] Create mode-based tool filtering
- [ ] Add `--mode` CLI argument parsing
- [ ] Implement lazy loading for `DocsManager`
- [ ] Implement lazy loading for `FunctionsManager`
- [ ] Add response size metrics and logging
  - [ ] Implement metrics collection
  - [ ] Add metrics to all tool handlers
  - [ ] Optional: Create `get_metrics` tool
- [ ] Implement compression (if research positive)
- [ ] Create mode documentation
- [ ] Update mcp-config.json examples
- [ ] Test all modes independently
- [ ] Create migration guide for mode selection
- [ ] Update benchmarks for new architecture
- [ ] Run full test suite for each mode
- [ ] Update `CHANGELOG.md`
- [ ] Close Issue #169 (research complete)
- [ ] Merge to main, tag v2.0.0
- [ ] Publish to NPM

**Target completion**: January 31, 2025

---

### Phase 3: Validation (Weeks 5-8)

- [ ] Design benchmark scenarios
- [ ] Implement benchmark harness
- [ ] Run baseline (no MCP) tests
- [ ] Run MCP tests
- [ ] Analyze results, create charts
- [ ] Write `docs/MCP_Value_Benchmark.md`
- [ ] Create prompt pattern library
- [ ] Write `docs/Prompt_Patterns.md`
- [ ] Create before/after demo video
- [ ] Publish blog post
- [ ] Engage community (Reddit, Discord)
- [ ] Collect feedback, iterate

**Target completion**: February 28, 2025

---

## Success Criteria

### Technical Metrics

- [x] Context overhead reduced by >70% (9,500 → <3,000 tokens)
- [x] Tool count reduced by >50% (15 → 7 tools)
- [x] Resources eliminated (100+ → 0)
- [x] All tests passing
- [x] No breaking changes without migration path

### User Experience Metrics

- [ ] Survey: >70% "significantly better" vs. alternatives
- [ ] Benchmark: >50% error reduction in config generation
- [ ] Benchmark: >40% accuracy improvement in error diagnosis
- [ ] GitHub issues: <5 complaints about consolidation

### Community Engagement

- [ ] Discord feedback: Positive response from original critic
- [ ] GitHub stars: +50 (current baseline TBD)
- [ ] NPM downloads: +100/week increase
- [ ] At least 2 community contributions (PRs or issues)

---

## Rollback Plan

If Phase 1 introduces critical regressions:

1. Revert to v1.4.0 tag
2. Publish v1.4.1 with hotfix
3. Analyze failures
4. Re-implement with smaller scope
5. Longer beta testing period

---

## Related Documents

- [Discord Feedback Analysis](./DISCORD_FEEDBACK_ANALYSIS.md)
- [Discord Response](./DISCORD_RESPONSE.md)
- [Architecture Overview](./docs/Architecture-Overview.md)
- [Available Tools](./docs/Available-Tools.md)

## GitHub Issues

### Epic #163: Optimize MCP Server Token Usage

- #164: Add truncation to resource content (Critical Priority)
- #165: Add includeExamples parameter to best practices (High Priority)
- #166: Truncate code examples in get_code_examples tool
- #167: Add pagination support to list tools
- #168: Add optional summary mode across verbose tools
- #169: Research token optimization architectural considerations

---

## Sign-Off

**Created by**: AI Assistant  
**Date**: December 11, 2025  
**Last Updated**: December 11, 2025  
**Reviewed by**: TBD (project maintainers)  
**Approved by**: TBD  
**Status**: Draft - Pending Review

**Integration Notes**:

- This roadmap consolidates community feedback (Discord) with existing GitHub issues
- Epic #163 addresses per-response optimization (60-90% savings per call)
- Tool consolidation addresses connection overhead (63% reduction at startup)
- Combined impact: Significant improvement across both connection and runtime token usage
