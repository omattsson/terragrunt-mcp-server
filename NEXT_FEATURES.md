# Next Feature Recommendations for Terragrunt MCP Server

**Analysis Date:** October 24, 2025
**Current Version:** 0.2.0
**Current Tool Count:** 6 tools
**Test Coverage:** 268 tests across 6 categories

## Current Implementation Status

### ✅ Completed Features (v0.2.0)
1. **search_terragrunt_docs** - Full-text search across all documentation
2. **get_terragrunt_sections** - List available documentation sections
3. **get_section_docs** - Retrieve documentation by section
4. **get_cli_command_help** - CLI command documentation lookup
5. **get_hcl_config_reference** - HCL configuration reference
6. **get_code_examples** - Code snippet extraction with context

### ✅ Infrastructure Completed
- ✅ Multi-tier caching (in-memory + disk + fixture fallback)
- ✅ Network resilience with retry logic and exponential backoff
- ✅ Docker support with docker-compose
- ✅ Comprehensive test suite (268 tests)
- ✅ MCP protocol compliance validation
- ✅ Performance benchmarking
- ✅ CI/CD workflows (automatic PR testing + manual execution)
- ✅ Extensive documentation

### 🎯 Recommended Next 4 Features

---

## Feature 0: Built-in Functions Reference (HIGHEST PRIORITY - Quick Win!)

### Overview
Provide comprehensive documentation for Terragrunt's built-in functions that can be used in `terragrunt.hcl` configurations, including syntax, parameters, examples, and common use cases.

### Value Proposition
- **Users struggle with**: "What functions are available? How do I use `path_relative_to_include()`?"
- **This solves**: Instant access to function signatures, examples, and use cases
- **Impact**: Faster configuration writing, fewer syntax errors, better use of Terragrunt features
- **Uniqueness**: Centralized reference for all built-in functions with contextual examples
- **Quick Win**: Leverages existing documentation infrastructure with minimal new code

### Tool Specification

```typescript
Tool Name: get_terragrunt_function

Parameters: {
  function_name: string, // Required: e.g., "path_relative_to_include", "get_env", "find_in_parent_folders"
  include_examples?: boolean // Optional: Include code examples (default: true)
}

Returns: {
  name: string,
  signature: string, // e.g., "path_relative_to_include() -> string"
  description: string,
  parameters: Array<{
    name: string,
    type: string,
    required: boolean,
    description: string,
    default?: string
  }>,
  returnType: string,
  examples: Array<{
    code: string,
    description: string,
    useCase: string
  }>,
  relatedFunctions: Array<string>,
  relatedDocs: Array<{
    title: string,
    url: string
  }>,
  commonPatterns?: Array<{
    pattern: string,
    explanation: string
  }>
}
```

### Alternative Tool: List All Functions

```typescript
Tool Name: list_terragrunt_functions

Parameters: {
  category?: string, // Optional: "path", "environment", "terraform", "dependency", "all"
  search?: string // Optional: Search in function names/descriptions
}

Returns: {
  functions: Array<{
    name: string,
    category: string,
    shortDescription: string,
    signature: string
  }>,
  categories: Array<string>,
  totalCount: number
}
```

### Implementation Strategy

1. **Function Reference Database** (`src/terragrunt/functions.ts`)
   ```typescript
   export interface TerragruntFunction {
     name: string;
     signature: string;
     description: string;
     parameters: FunctionParameter[];
     returnType: string;
     category: string;
     examples: FunctionExample[];
     relatedFunctions: string[];
   }

   export class TerragruntFunctionsManager {
     private docsManager: TerragruntDocsManager;
     private functionsCache: Map<string, TerragruntFunction>;
     
     constructor(docsManager: TerragruntDocsManager) {
       this.docsManager = docsManager;
       this.functionsCache = new Map();
     }
     
     async loadFunctions(): Promise<void>
     async getFunction(name: string): Promise<TerragruntFunction | null>
     async listFunctions(category?: string): Promise<TerragruntFunction[]>
     async searchFunctions(query: string): Promise<TerragruntFunction[]>
     private async extractFunctionFromDocs(name: string): Promise<TerragruntFunction | null>
   }
   ```

2. **Documentation Extraction**
   - Parse "Built-in Functions" section from Terragrunt docs
   - Extract function signatures and descriptions
   - Pull code examples using existing `get_code_examples` tool
   - Categorize functions (path helpers, environment, Terraform data, etc.)

3. **Function Categories** (from Terragrunt docs)
   - **Path Helpers**: `path_relative_to_include()`, `path_relative_from_include()`, `get_terragrunt_dir()`, `get_parent_terragrunt_dir()`, `get_original_terragrunt_dir()`
   - **Environment**: `get_env()`, `get_aws_account_id()`, `get_aws_caller_identity_arn()`, `get_aws_caller_identity_user_id()`
   - **Terraform Helpers**: `get_terraform_commands_that_need_vars()`, `get_terraform_commands_that_need_locking()`, `get_terraform_commands_that_need_input()`
   - **File/Config**: `find_in_parent_folders()`, `read_terragrunt_config()`, `get_platform()`
   - **Dependencies**: Functions for working with dependency outputs

4. **Tool Integration** (`src/handlers/tools.ts`)
   ```typescript
   // Add to getAvailableTools()
   {
     name: 'get_terragrunt_function',
     description: 'Get detailed documentation for a specific Terragrunt built-in function',
     inputSchema: {
       type: 'object',
       properties: {
         function_name: {
           type: 'string',
           description: 'Name of the function (e.g., "path_relative_to_include")'
         },
         include_examples: {
           type: 'boolean',
           description: 'Include code examples',
           default: true
         }
       },
       required: ['function_name']
     }
   },
   {
     name: 'list_terragrunt_functions',
     description: 'List all available Terragrunt built-in functions',
     inputSchema: {
       type: 'object',
       properties: {
         category: {
           type: 'string',
           enum: ['path', 'environment', 'terraform', 'dependency', 'file', 'all'],
           description: 'Filter by function category'
         },
         search: {
           type: 'string',
           description: 'Search term to filter functions'
         }
       }
     }
   }
   ```

### Example Usage 1: Get Specific Function

**User Prompt:**
"How do I use path_relative_to_include?"

**Tool Call:** `get_terragrunt_function({ function_name: "path_relative_to_include" })`

**Tool Response:**
```json
{
  "name": "path_relative_to_include",
  "signature": "path_relative_to_include() -> string",
  "description": "Returns the relative path between the current terragrunt.hcl file and the path specified in its include block",
  "parameters": [],
  "returnType": "string",
  "examples": [
    {
      "code": "remote_state {\n  backend = \"s3\"\n  config = {\n    key = \"${path_relative_to_include()}/terraform.tfstate\"\n  }\n}",
      "description": "Use relative path for unique state file keys per module",
      "useCase": "DRY remote state configuration"
    },
    {
      "code": "terraform {\n  source = \"git::git@github.com:org/modules.git//modules/${path_relative_to_include()}\"\n}",
      "description": "Reference module based on directory structure",
      "useCase": "Convention-based module sourcing"
    }
  ],
  "relatedFunctions": [
    "path_relative_from_include",
    "get_terragrunt_dir",
    "find_in_parent_folders"
  ],
  "relatedDocs": [
    {
      "title": "Built-in Functions",
      "url": "https://terragrunt.gruntwork.io/docs/reference/built-in-functions/"
    }
  ],
  "commonPatterns": [
    {
      "pattern": "Used in include blocks to create unique per-environment paths",
      "explanation": "Combined with find_in_parent_folders() for hierarchical configs"
    }
  ]
}
```

### Example Usage 2: List Functions by Category

**User Prompt:**
"What environment-related functions does Terragrunt have?"

**Tool Call:** `list_terragrunt_functions({ category: "environment" })`

**Tool Response:**
```json
{
  "functions": [
    {
      "name": "get_env",
      "category": "environment",
      "shortDescription": "Get environment variable value with optional default",
      "signature": "get_env(name: string, default?: string) -> string"
    },
    {
      "name": "get_aws_account_id",
      "category": "environment",
      "shortDescription": "Get current AWS account ID",
      "signature": "get_aws_account_id() -> string"
    },
    {
      "name": "get_aws_caller_identity_arn",
      "category": "environment",
      "shortDescription": "Get ARN of AWS caller identity",
      "signature": "get_aws_caller_identity_arn() -> string"
    }
  ],
  "categories": ["path", "environment", "terraform", "dependency", "file"],
  "totalCount": 3
}
```

### Testing Strategy
- Unit tests for `TerragruntFunctionsManager` (15 tests)
  - Function loading and caching
  - Category filtering
  - Search functionality
  - Parameter extraction
- Integration tests (10 tests)
  - Verify all major functions are discovered
  - Test example extraction
  - Validate related functions linking
- MCP protocol compliance (5 tests)
  - Tool response format validation
  - Error handling for unknown functions
- Performance (target: <150ms for function lookup)

### Estimated Effort
- **Development Time:** 2-3 days (QUICK WIN!)
- **Complexity:** Low-Medium
- **New Files:** 1 (`src/terragrunt/functions.ts`)
- **Modified Files:** 1 (`src/handlers/tools.ts`)
- **Tests to Add:** ~30 tests (15 unit + 10 integration + 5 compliance)
- **Dependencies:** None (leverages existing `TerragruntDocsManager`)

### Why This Is a Quick Win
✅ Reuses existing documentation scraping infrastructure  
✅ No new external dependencies  
✅ High user value (functions are constantly referenced)  
✅ Simple implementation (mostly data extraction)  
✅ Complements existing `get_hcl_config_reference` tool  
✅ Low maintenance (Terragrunt functions rarely change)  

### Known Terragrunt Functions to Support
Based on official documentation:

**Path Helpers:**
- `path_relative_to_include()`
- `path_relative_from_include()`
- `get_terragrunt_dir()`
- `get_parent_terragrunt_dir()`
- `get_original_terragrunt_dir()`

**Environment:**
- `get_env(name, default?)`
- `get_aws_account_id()`
- `get_aws_caller_identity_arn()`
- `get_aws_caller_identity_user_id()`

**Terraform:**
- `get_terraform_commands_that_need_vars()`
- `get_terraform_commands_that_need_locking()`
- `get_terraform_commands_that_need_input()`

**File/Config:**
- `find_in_parent_folders(name?, fallback?)`
- `read_terragrunt_config(path)`
- `get_platform()`

**Others:**
- Functions for dependency outputs
- Custom function extensions (if documented)

### Priority: ⭐⭐⭐ (HIGHEST - Implement FIRST!)

**Recommendation:** Implement this feature BEFORE the Configuration Generator, as it:
1. Provides immediate value to users
2. Establishes function reference infrastructure
3. Can be used BY the config generator for validation
4. Takes only 2-3 days vs 3-4 days for config generator
5. Has simpler scope and fewer edge cases

---

## Feature 1: Interactive Configuration Generator (HIGHEST VALUE)

### Overview
Generate valid `terragrunt.hcl` configurations based on user requirements, combining documentation knowledge with practical templates.

### Value Proposition
- **Users struggle with**: Writing correct terragrunt.hcl syntax from scratch
- **This solves**: "How do I configure X?" → Provides ready-to-use code
- **Impact**: Reduces syntax errors, accelerates onboarding, immediate productivity boost
- **Uniqueness**: Synthesizes CLI help, HCL reference, and code examples into actionable output

### Tool Specification

```typescript
Tool Name: generate_terragrunt_config

Parameters: {
  use_case: string, // Required: e.g., "remote_state", "dependencies", "generate_blocks", "hooks"
  backend?: string, // Optional: e.g., "s3", "gcs", "azurerm", "local"
  options?: {
    bucket?: string,
    region?: string,
    key_pattern?: string,
    enable_locking?: boolean,
    [key: string]: any
  }
}

Returns: {
  config: string, // Complete terragrunt.hcl content ready to use
  explanation: string, // What each section does and why
  relatedDocs: Array<{
    title: string,
    url: string,
    relevance: string
  }>,
  nextSteps: Array<string>, // What to do after using this config
  additionalOptions?: Array<{
    name: string,
    description: string,
    example: string
  }>
}
```

### Implementation Strategy

1. **Template Library** (`src/terragrunt/templates.ts`)
   ```typescript
   export class ConfigTemplateLibrary {
     private templates: Map<string, ConfigTemplate>;
     
     getTemplate(useCase: string, backend?: string): ConfigTemplate
     listAvailableUseCases(): string[]
     validateTemplate(template: string): ValidationResult
   }
   ```

2. **Template Sources**
   - Extract from existing code examples (leverage `get_code_examples` tool)
   - Predefined templates for common patterns
   - Documentation-derived configurations
   - Best practices from `TerragruntDocsManager`

3. **Configuration Builder** (`src/terragrunt/config-generator.ts`)
   ```typescript
   export class TerragruntConfigGenerator {
     private docsManager: TerragruntDocsManager;
     private templateLibrary: ConfigTemplateLibrary;
     
     async generateConfig(params: GenerateConfigParams): Promise<GeneratedConfig>
     private async fetchRelevantDocs(useCase: string): Promise<TerragruntDoc[]>
     private async buildFromTemplate(template: ConfigTemplate, options: any): Promise<string>
     private async explainConfiguration(config: string): Promise<string>
   }
   ```

4. **Tool Integration** (`src/handlers/tools.ts`)
   - Add to `getAvailableTools()` method with JSON Schema definition
   - Implement in `executeTool()` switch statement
   - Error handling for invalid use cases with suggestions
   - Leverage existing search for similar use cases

### Example Usage

**User Prompt:**
"Generate a terragrunt config for S3 remote state in us-east-1"

**Tool Response:**
```json
{
  "config": "remote_state {\n  backend = \"s3\"\n  generate = {\n    path      = \"backend.tf\"\n    if_exists = \"overwrite_terragrunt\"\n  }\n  config = {\n    bucket         = \"my-terraform-state\"\n    key            = \"${path_relative_to_include()}/terraform.tfstate\"\n    region         = \"us-east-1\"\n    encrypt        = true\n    dynamodb_table = \"terraform-locks\"\n  }\n}",
  "explanation": "This configuration:\n- Uses S3 for remote state storage\n- Automatically generates backend.tf\n- Enables encryption at rest\n- Uses DynamoDB for state locking\n- Uses path_relative_to_include() for unique keys per module",
  "relatedDocs": [
    {
      "title": "Keep your remote state configuration DRY",
      "url": "https://terragrunt.gruntwork.io/docs/features/keep-your-remote-state-configuration-dry/",
      "relevance": "Explains remote_state block and path_relative_to_include()"
    }
  ],
  "nextSteps": [
    "1. Create S3 bucket: aws s3 mb s3://my-terraform-state --region us-east-1",
    "2. Create DynamoDB table: aws dynamodb create-table ...",
    "3. Add this block to your root terragrunt.hcl",
    "4. Run 'terragrunt init' to initialize"
  ],
  "additionalOptions": [
    {
      "name": "skip_bucket_versioning",
      "description": "Disable bucket versioning",
      "example": "skip_bucket_versioning = true"
    }
  ]
}
```

### Testing Strategy
- Unit tests for `ConfigTemplateLibrary` (template validation, retrieval)
- Unit tests for `TerragruntConfigGenerator` (config generation, explanation)
- Integration tests for each use case (5+ templates)
- Edge case testing for invalid parameters
- MCP protocol compliance for new tool
- Performance benchmarking (target: <200ms response time)

### Estimated Effort
- **Development Time:** 3-4 days
- **Complexity:** Medium
- **New Files:** 2 (`templates.ts`, `config-generator.ts`)
- **Modified Files:** 2 (`tools.ts`, potentially `docs.ts`)
- **Tests to Add:** ~25 tests (15 unit + 10 integration)
- **Dependencies:** None (leverages existing infrastructure)

### Priority: ⭐⭐⭐ (HIGHEST)

---

## Feature 2: Best Practices Analyzer (HIGH VALUE)

### Overview
Provide context-aware recommendations for Terragrunt architecture and configuration decisions based on extracted patterns from documentation.

### Value Proposition
- **Users struggle with**: "What's the recommended way to structure my Terragrunt setup?"
- **This solves**: Decision paralysis and prevents anti-patterns
- **Impact**: Better architecture, fewer refactors, improved maintainability
- **Uniqueness**: Synthesizes scattered best practices into actionable guidance

### Tool Specification

```typescript
Tool Name: get_best_practices

Parameters: {
  topic: string, // Required: e.g., "module_organization", "state_management", "dependencies", "ci_cd"
  experience_level?: string // Optional: "beginner" | "intermediate" | "advanced"
}

Returns: {
  recommendations: Array<{
    practice: string,
    rationale: string,
    example: string,
    antipatterns: Array<string>,
    tradeoffs: string,
    relatedDocs: Array<{title: string, url: string}>
  }>,
  summary: string,
  commonPitfalls: Array<string>,
  experienceNotes?: string,
  realWorldExamples: Array<{
    scenario: string,
    approach: string,
    source: string
  }>
}
```

### Implementation Strategy

1. **Pattern Extraction** (`src/terragrunt/best-practices.ts`)
   ```typescript
   export class BestPracticesAnalyzer {
     private docsManager: TerragruntDocsManager;
     private patterns: Map<string, BestPractice>;
     
     constructor(docsManager: TerragruntDocsManager) {
       this.docsManager = docsManager;
       this.patterns = new Map();
     }
     
     async extractBestPractices(): Promise<void>
     async analyzeTopic(topic: string, level?: string): Promise<BestPracticeResult>
     private async searchForPatterns(topic: string): Promise<TerragruntDoc[]>
     private async identifyAntipatterns(docs: TerragruntDoc[]): Promise<string[]>
   }
   ```

2. **Knowledge Base Construction**
   - Parse documentation for "should", "recommended", "best practice" keywords
   - Extract examples that demonstrate patterns
   - Identify "avoid", "don't", "deprecated" warnings
   - Categorize by topic (leverages `getAvailableSections()`)

3. **Recommendation Engine**
   - Rank practices by frequency in documentation
   - Cross-reference with code examples from `get_code_examples`
   - Filter by experience level
   - Provide tradeoffs and alternatives

4. **Tool Integration** (`src/handlers/tools.ts`)
   - Add to tool definitions with proper JSON Schema
   - Leverage existing `searchDocumentation` for pattern matching
   - Format recommendations for readability
   - Handle errors with fallback to general advice

### Example Usage

**User Prompt:**
"What are best practices for organizing Terragrunt modules across environments?"

**Tool Response:**
```json
{
  "recommendations": [
    {
      "practice": "Use hierarchical directory structure with environments at root level",
      "rationale": "Provides clear environment isolation while enabling code reuse through relative paths and find_in_parent_folders()",
      "example": "prod/\n  us-east-1/\n    vpc/\n      terragrunt.hcl\n    app/\n      terragrunt.hcl\nstaging/\n  us-east-1/\n    vpc/\n      terragrunt.hcl",
      "antipatterns": [
        "Duplicating entire module trees per environment",
        "Using Terraform workspaces instead of separate directories",
        "Mixing infrastructure code with application code"
      ],
      "tradeoffs": "More directories to manage, but much clearer separation and safer operations",
      "relatedDocs": [
        {
          "title": "Use cases",
          "url": "https://terragrunt.gruntwork.io/docs/getting-started/use-cases/"
        }
      ]
    }
  ],
  "summary": "Best practices emphasize environment separation, DRY configuration, and explicit dependency management",
  "commonPitfalls": [
    "Overusing find_in_parent_folders() leading to tight coupling",
    "Not using dependency blocks, relying on manual ordering",
    "Hardcoding values that should be environment-specific"
  ],
  "experienceNotes": "At intermediate level, focus on dependency management and testing strategies before production rollout"
}
```

### Testing Strategy
- Unit tests for pattern extraction accuracy
- Unit tests for recommendation ranking algorithm
- Verify antipattern detection logic
- Test experience level filtering
- Integration with existing documentation cache
- Edge case: unknown topics, missing experience level
- Performance: <300ms response time target

### Estimated Effort
- **Development Time:** 4-5 days
- **Complexity:** Medium-High
- **New Files:** 1 (`best-practices.ts`)
- **Modified Files:** 2 (`tools.ts`, potentially `docs.ts`)
- **Tests to Add:** ~30 tests (20 unit + 10 integration)
- **Dependencies:** None

### Priority: ⭐⭐⭐ (HIGH)

---

## Feature 3: Troubleshooting Assistant with Error Pattern Matching (MEDIUM-HIGH VALUE)

### Overview
Diagnose Terragrunt errors by matching against known patterns in documentation, providing contextual solutions and debugging steps.

### Value Proposition
- **Users struggle with**: Cryptic error messages and debugging
- **This solves**: "What does this error mean and how do I fix it?"
- **Impact**: Faster problem resolution, reduced support requests, self-service debugging
- **Uniqueness**: Proactive assistance when users are blocked

### Tool Specification

```typescript
Tool Name: diagnose_error

Parameters: {
  error_message: string, // Required: The error text
  command?: string, // Optional: e.g., "apply", "plan", "init"
  context?: {
    terragrunt_version?: string,
    terraform_version?: string,
    os?: string
  }
}

Returns: {
  matches: Array<{
    errorPattern: string,
    likelyCause: string,
    solutions: Array<{
      step: string,
      command?: string,
      explanation: string
    }>,
    documentationRef: {
      title: string,
      url: string,
      excerpt: string
    },
    confidence: number // 0-1
  }>,
  generalAdvice: Array<string>,
  debuggingSteps: Array<string>,
  relatedErrors?: Array<{
    pattern: string,
    description: string
  }>
}
```

### Implementation Strategy

1. **Error Pattern Database** (`src/terragrunt/error-patterns.ts`)
   ```typescript
   export class ErrorPatternMatcher {
     private docsManager: TerragruntDocsManager;
     private patterns: ErrorPattern[];
     
     constructor(docsManager: TerragruntDocsManager) {
       this.docsManager = docsManager;
       this.patterns = [];
     }
     
     async loadPatterns(): Promise<void>
     matchError(errorMessage: string): MatchResult[]
     private extractErrorContext(message: string): ErrorContext
     private fuzzyMatch(pattern: string, message: string): number
   }
   ```

2. **Pattern Sources**
   - Extract from troubleshooting documentation
   - Common error messages from CLI reference
   - Build regex patterns for matching
   - Categorize by error type (config, state, dependency, etc.)

3. **Solution Retrieval**
   - Search troubleshooting section using existing `searchDocumentation`
   - Extract step-by-step solutions from docs
   - Link to relevant documentation pages
   - Provide command examples with context

4. **Tool Integration** (`src/handlers/tools.ts`)
   - Add error diagnosis tool to tool definitions
   - Rank solutions by confidence score
   - Provide fallback generic debugging advice
   - Format for readability with proper error handling

### Example Usage

**User Prompt:**
"I'm getting: Error: Failed to load backend: backend configuration changed"

**Tool Response:**
```json
{
  "matches": [
    {
      "errorPattern": "backend configuration changed",
      "likelyCause": "Backend configuration in state file doesn't match current terragrunt.hcl",
      "solutions": [
        {
          "step": "Reinitialize with new configuration",
          "command": "terragrunt init -reconfigure",
          "explanation": "Forces Terraform to reconfigure backend without migrating existing state"
        },
        {
          "step": "Migrate existing state to new backend",
          "command": "terragrunt init -migrate-state",
          "explanation": "Safely migrates state to new backend configuration"
        }
      ],
      "documentationRef": {
        "title": "Backend Configuration",
        "url": "https://terragrunt.gruntwork.io/docs/reference/config-blocks-and-attributes/",
        "excerpt": "The backend configuration..."
      },
      "confidence": 0.95
    }
  ],
  "generalAdvice": [
    "Always backup state files before backend changes",
    "Test backend changes in non-production first",
    "Review terragrunt.hcl for recent modifications"
  ],
  "debuggingSteps": [
    "1. Compare current backend config with previous version",
    "2. Check if S3 bucket/key has changed",
    "3. Verify backend credentials are correct",
    "4. Run 'terragrunt init -reconfigure'"
  ]
}
```

### Testing Strategy
- Unit tests for pattern matching accuracy
- Unit tests for fuzzy matching algorithm
- Validate solution relevance and quality
- Test confidence scoring calculation
- Edge cases: unknown errors, multiple matches, no matches
- Performance testing for pattern matching (<400ms target)
- Integration with documentation search

### Estimated Effort
- **Development Time:** 5-6 days
- **Complexity:** Medium-High
- **New Files:** 2 (`error-patterns.ts`, potentially `error-matcher.ts`)
- **Modified Files:** 2 (`tools.ts`, `docs.ts`)
- **Tests to Add:** ~35 tests (25 unit + 10 integration)
- **Dependencies:** None

### Priority: ⭐⭐ (MEDIUM-HIGH)

---

## Why These 3 Features?

### Complementary Value
1. **Configuration Generator**: "How do I write this?" → Generates code
2. **Best Practices**: "What's the right way?" → Provides guidance  
3. **Troubleshooting**: "Why is this broken?" → Solves problems

### Natural Progression
- All leverage existing `TerragruntDocsManager` infrastructure
- Build on current 6-tool foundation
- Each feature uses existing search and caching
- Progressive value: read → generate → guide → debug

### User Journey Coverage
- **Onboarding**: Config generator accelerates getting started
- **Architecture**: Best practices guide design decisions
- **Operations**: Troubleshooting unblocks production issues

### Fits MCP Server Philosophy
- Documentation-first approach (no workspace access needed)
- Pure documentation synthesis
- Leverages existing two-tier caching system
- Follows handler-based architecture pattern
- Maintains MCP protocol compliance

---

## Features NOT Recommended (And Why)

### ❌ Dependency Graph Visualization
**Why Defer:**
- Requires parsing actual terragrunt.hcl files (workspace access)
- MCP is text-based protocol (no visualization support)
- Better suited as VS Code extension
- Infrastructure changes needed for file system access

**When to Reconsider:** If MCP adds workspace file access capabilities

### ❌ Version-Specific Documentation
**Why Defer:**
- Most users on latest version (minimal demand)
- Current docs already comprehensive
- Caching complexity multiplies (multiple cache stores)
- Maintenance overhead significant

**When to Reconsider:** If users request historical version support

### ❌ Configuration Validation
**Why Defer:**
- Overlaps with Terragrunt's built-in `validate-inputs`
- Requires HCL parsing (not documentation-focused)
- Operational tool, not discovery-oriented
- Outside MCP server's documentation focus

**When to Reconsider:** If adding workspace integration for other features

### ❌ Real-Time Configuration Monitoring
**Why Defer:**
- Requires continuous file watching
- Not aligned with MCP's request-response model
- Better suited for IDE extension
- Significant architecture changes (breaks stdio transport pattern)

---

## Implementation Roadmap

### Phase 1: Configuration Generator (November-December 2025)
**Goals:**
- Template library with 5+ common use cases
- Integration with existing code examples
- Comprehensive testing (25+ tests)

**Deliverables:**
- `src/terragrunt/templates.ts`
- `src/terragrunt/config-generator.ts`
- Updated `src/handlers/tools.ts`
- Test files in `test/unit/` and `test/integration/`
- Documentation updates (README, tool guide)

### Phase 2: Best Practices Analyzer (January-February 2026)
**Goals:**
- Pattern extraction from documentation
- Knowledge base for 5+ topics
- Experience level filtering

**Deliverables:**
- `src/terragrunt/best-practices.ts`
- Updated tool handlers
- 30+ tests
- Best practices documentation

### Phase 3: Troubleshooting Assistant (March-April 2026)
**Goals:**
- Error pattern database
- Pattern matching engine
- Solution retrieval system

**Deliverables:**
- `src/terragrunt/error-patterns.ts`
- Updated tool handlers
- 35+ tests
- Troubleshooting guide documentation

### Total Timeline: ~6 months for all 3 features

---

## Success Metrics

### Configuration Generator
- **Usage Goal:** 50+ generations per month
- **Success Rate:** 90%+ configs used without modification
- **Time Saved:** ~15 minutes per configuration
- **User Satisfaction:** 4.5+ / 5.0

### Best Practices Analyzer  
- **Usage Goal:** 30+ queries per month
- **Recommendation Quality:** 80%+ find recommendations actionable
- **Architecture Impact:** Reduced refactoring needs
- **User Satisfaction:** 4.0+ / 5.0

### Troubleshooting Assistant
- **Usage Goal:** 40+ diagnoses per month
- **Resolution Rate:** 70%+ errors resolved with tool help
- **Time Saved:** ~30 minutes per debugging session
- **User Satisfaction:** 4.5+ / 5.0

---

## Technical Considerations

### Leverages Existing Infrastructure
✅ `TerragruntDocsManager` two-tier caching system  
✅ `searchDocumentation` functionality  
✅ Existing test framework (Vitest with 268 tests)  
✅ Docker deployment (Dockerfile, docker-compose.yml)  
✅ Performance benchmarking infrastructure  
✅ MCP protocol compliance testing  
✅ CI/CD workflows (GitHub Actions)  
✅ Handler-based architecture pattern  

### New Dependencies
- **None required** - All features use existing infrastructure
- Pure TypeScript/Node.js implementation
- No external APIs or services
- All data from cached documentation

### Performance Impact
- **Memory:** +5-10MB for templates and patterns (minimal)
- **Response Time:** <200-400ms for all new tools (within current benchmarks)
- **Cache Size:** No significant increase (patterns stored in memory)
- **Build Time:** +5-10% expected (additional TypeScript compilation)

### Testing Requirements
- **Total New Tests:** ~90 tests across 3 features
- **Test Coverage Goal:** Maintain >85% coverage (currently high)
- **Performance Tests:** Add benchmarks for new tools to `test/performance/`
- **Integration Tests:** Validate tool interactions in `test/integration/`
- **MCP Compliance:** Validate new tools follow protocol in `test/integration/mcp-protocol.test.ts`

---

## Alternative Approaches

### If Resources Are Limited
**Option 1: Start with Configuration Generator Only**
- Highest immediate value
- Medium effort (3-4 days)
- Natural fit with existing tools
- Defer others to v0.3.0

**Option 2: Implement in Smaller Iterations**
- Week 1-2: Config generator for remote_state only
- Week 3-4: Add dependencies and hooks templates
- Week 5-6: Best practices for module organization
- Continue iteratively based on feedback

### If User Feedback Differs
**Be Flexible:**
- Monitor actual tool usage in production (via GitHub telemetry if added)
- Gather feedback via GitHub Discussions
- Prioritize based on real pain points
- Consider user-contributed templates/patterns (community-driven)

---

## Release Strategy

### Version 0.3.0 (Configuration Generator)
**Tentative:** Q1 2026
- Core configuration generation
- 5+ use case templates (remote_state, dependencies, generate, hooks, inputs)
- Full documentation and examples
- 25+ tests

### Version 0.4.0 (Best Practices)
**Tentative:** Q2 2026
- Best practices analyzer
- Pattern extraction from docs
- Recommendation engine
- 30+ tests

### Version 0.5.0 (Troubleshooting)
**Tentative:** Q2 2026
- Error diagnostics
- Pattern matching engine
- Solution retrieval
- 35+ tests

### Version 1.0.0 (Stable Release)
**Tentative:** Q3 2026
- All 9 tools complete
- Production-ready and battle-tested
- Full documentation
- Performance optimized
- 350+ total tests

---

## Conclusion

These three features represent a natural evolution from **read** (current v0.2.0) to **generate** → **guide** → **debug**:

1. **Configuration Generator** (⭐⭐⭐) - Immediate productivity boost
2. **Best Practices Analyzer** (⭐⭐⭐) - Better decision making  
3. **Troubleshooting Assistant** (⭐⭐) - Faster problem resolution

**Recommended Starting Point:** Configuration Generator

- Provides immediate user value
- Leverages existing `get_code_examples` and `get_hcl_config_reference` tools
- Sets foundation for template-based features
- Aligns with MCP server's documentation-first philosophy
- Follows established handler-based architecture

**Next Steps:**
1. Create feature branch: `feature/config-generator`
2. Implement `ConfigTemplateLibrary` class
3. Implement `TerragruntConfigGenerator` class
4. Update `ToolHandler` with new tool
5. Add comprehensive tests (unit + integration + performance)
6. Update documentation
7. Create PR following CONTRIBUTING.md
8. Run full test suite and CI/CD validation
