# Best Practices Guide

A comprehensive guide to Terragrunt best practices across all major topics. This guide consolidates patterns, recommendations, antipatterns, and real-world examples extracted from the official Terragrunt documentation.

## Overview

The `get_guidance` tool provides structured guidance across multiple topics when used with `type: 'best-practices'`:

- **module_organization** / **project_structure** - Module structure and organization patterns
- **state_management** - Remote state configuration and best practices
- **dependencies** - Managing dependencies between modules
- **ci_cd** - CI/CD integration patterns and workflows
- **security** - Security considerations and best practices
- **performance** - Performance optimization techniques
- **testing** - Testing strategies and patterns
- **environment_config** - Environment configuration patterns

Each topic provides recommendations filtered by experience level (beginner, intermediate, advanced) to ensure guidance matches your team's expertise.

## Using the Tool

### Basic Usage

```json
{
  "tool": "get_guidance",
  "arguments": {
    "query": "state_management"
  }
}
```

The tool automatically routes to best practices when you use a known topic like "state_management", "security", etc.

### With Experience Level Filter

```json
{
  "tool": "get_guidance",
  "arguments": {
    "query": "module_organization",
    "level": "beginner",
    "mode": "full"
  }
}
```

### With Explicit Type

```json
{
  "tool": "get_guidance",
  "arguments": {
    "query": "dependencies",
    "type": "best-practices",
    "mode": "summary"
  }
}
```

### Natural Language Prompts

The tool understands natural language queries:

```text
"What are the best practices for state management?"
"Show me beginner-level module organization practices"
"Analyze CI/CD best practices for Terragrunt"
"What are advanced dependency management patterns?"
"What should I avoid when configuring remote state?"
```

## Response Structure

The tool returns comprehensive structured data:

```json
{
  "query": "state_management",
  "recommendations": [
    {
      "practice": "Always use remote state for production",
      "priority": "critical",
      "experienceLevel": "beginner",
      "category": "state_management",
      "rationale": "Remote state ensures safety and team collaboration",
      "examples": ["remote_state { backend = \"s3\" ... }"],
      "antipatterns": ["Using local state for multi-user environments"],
      "tradeoffs": ["May increase latency vs local state"],
      "relatedDocs": ["https://terragrunt.gruntwork.io/docs/..."]
    }
  ],
  "summary": "Best practices overview...",
  "commonPitfalls": [
    "Storing sensitive data directly in state files",
    "Not configuring state locking"
  ],
  "experienceNotes": {
    "beginner": ["Start with S3 backend and basic encryption"],
    "intermediate": ["Implement state locking with DynamoDB"],
    "advanced": ["Optimize for enterprise scale"]
  },
  "realWorldExamples": [
    "S3 backend with encryption and versioning",
    "State locking configuration"
  ],
  "confidence": 85,
  "suggestedTopics": ["dependencies", "security"]
}
```

## Topics Guide

### 1. Module Organization

**Focus**: Structuring your Terragrunt modules for maintainability and scalability.

**Key Questions Answered**:
- How should I organize my module hierarchy?
- What's the recommended directory structure?
- How do I handle environment-specific configurations?
- When should I split modules?

**Experience Levels**:
- **Beginner**: Basic folder structure, single environment setup
- **Intermediate**: Multi-environment layouts, DRY principles
- **Advanced**: Enterprise-scale organization, monorepo patterns

**Example Prompt**:
```text
"Show me beginner-level module organization best practices"
```

**Common Patterns**:
- Environment-based hierarchy (`dev/`, `staging/`, `prod/`)
- Component-based organization (`networking/`, `compute/`, `storage/`)
- Shared configuration with `find_in_parent_folders()`
- Root-level `terragrunt.hcl` for common settings

**Antipatterns to Avoid**:
- Deep nesting (more than 4-5 levels)
- Mixing infrastructure and application code
- Duplicating configuration across environments
- Hardcoding values in child modules

### 2. State Management

**Focus**: Managing Terraform state files effectively and securely.

**Key Questions Answered**:
- Which backend should I use?
- How do I configure state locking?
- How should I handle state for multiple environments?
- What are the security considerations?

**Experience Levels**:
- **Beginner**: Setting up basic S3/Azure/GCS backends
- **Intermediate**: Configuring locking, encryption, versioning
- **Advanced**: State isolation strategies, disaster recovery

**Example Prompt**:
```text
"What are the best practices for state management?"
```

**Critical Recommendations**:
1. **Always use remote state** for production environments
2. **Enable state locking** to prevent concurrent modifications
3. **Enable encryption** for sensitive infrastructure data
4. **Enable versioning** on state storage for rollback capability
5. **Isolate state per environment** for safety

**Common Patterns**:
```hcl
# S3 backend with encryption and locking
remote_state {
  backend = "s3"
  config = {
    bucket         = "my-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

**Antipatterns to Avoid**:
- Using local state in multi-user environments
- Sharing state files across unrelated infrastructure
- Not configuring state locking
- Storing secrets directly in state (use secret management)

### 3. Dependencies

**Focus**: Managing dependencies between Terragrunt modules and Terraform outputs.

**Key Questions Answered**:
- How do I reference outputs from other modules?
- What's the best way to handle module dependencies?
- How should I structure dependencies for complex infrastructure?
- How do I handle optional dependencies?

**Experience Levels**:
- **Beginner**: Basic dependency blocks, simple output references
- **Intermediate**: Mock outputs, dependency graphs
- **Advanced**: Complex dependency chains, circular dependency avoidance

**Example Prompt**:
```text
"Analyze best practices for managing dependencies"
```

**Critical Recommendations**:
1. **Use dependency blocks** instead of data sources for cross-module references
2. **Enable mock outputs** for faster planning in development
3. **Minimize dependency chains** to reduce complexity
4. **Document dependencies** clearly in module READMEs
5. **Use run --all carefully** when working with dependencies

**Common Patterns**:
```hcl
# Basic dependency with mock outputs
dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id     = "vpc-mock-id"
    subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.subnet_ids
}
```

**Antipatterns to Avoid**:
- Circular dependencies between modules
- Over-relying on dependency chains (more than 3 levels deep)
- Not using mock outputs in development
- Hardcoding values that should come from dependencies

### 4. CI/CD Integration

**Focus**: Integrating Terragrunt with CI/CD pipelines effectively.

**Key Questions Answered**:
- How do I integrate Terragrunt with CI/CD?
- What's the best workflow for infrastructure changes?
- How do I handle secrets in CI/CD?
- How should I structure approval workflows?

**Experience Levels**:
- **Beginner**: Basic CI/CD pipeline setup
- **Intermediate**: Plan/apply workflows, approval gates
- **Advanced**: Multi-environment pipelines, policy enforcement

**Example Prompt**:
```text
"What are CI/CD best practices for Terragrunt?"
```

**Critical Recommendations**:
1. **Always run plan before apply** in automated workflows
2. **Require manual approval** for production changes
3. **Use separate service accounts** with minimal permissions
4. **Store state backend credentials** in CI/CD secrets
5. **Implement drift detection** with scheduled runs
6. **Use terragrunt-all commands** carefully in CI/CD

**Common Patterns**:
- Separate plan and apply jobs
- Manual approval gates for production
- Automatic plan on pull requests
- Apply on merge to main branch
- Environment-specific pipelines

**Pipeline Stages**:
```yaml
# Example GitHub Actions workflow structure
stages:
  - validate: Format check and validation
  - plan: Generate and review execution plan
  - approve: Manual approval gate (production only)
  - apply: Execute infrastructure changes
  - verify: Post-deployment validation
```

**Antipatterns to Avoid**:
- Automatic apply without review in production
- Using root credentials in CI/CD
- Not locking state during CI/CD runs
- Ignoring plan output in automated workflows
- Sharing credentials across environments

### 5. Security

**Focus**: Securing your Terragrunt configurations and infrastructure.

**Key Questions Answered**:
- How do I handle sensitive values?
- What are the security best practices for state management?
- How should I manage credentials?
- How do I prevent security misconfigurations?

**Experience Levels**:
- **Beginner**: Basic secret handling, encrypted state
- **Intermediate**: Secret management integration, IAM policies
- **Advanced**: Zero-trust architecture, compliance automation

**Example Prompt**:
```text
"Show me security best practices for Terragrunt"
```

**Critical Recommendations**:
1. **Never commit secrets** to version control
2. **Use secret management systems** (AWS Secrets Manager, HashiCorp Vault)
3. **Enable encryption** for state storage
4. **Implement least-privilege IAM** policies
5. **Use get_env()** or sops for sensitive values
6. **Audit state access** regularly
7. **Enable MFA** for production state access

**Common Patterns**:
```hcl
# Using environment variables for sensitive values
inputs = {
  database_password = get_env("DB_PASSWORD")
  api_key          = get_env("API_KEY", "default-for-dev")
}

# SOPS integration for encrypted secrets
locals {
  secrets = yamldecode(sops_decrypt_file("secrets.enc.yaml"))
}

inputs = {
  db_password = local.secrets.database.password
}
```

**Antipatterns to Avoid**:
- Hardcoding secrets in `terragrunt.hcl` files
- Committing state files to version control
- Using overly permissive IAM policies
- Sharing credentials across environments
- Not rotating access keys regularly
- Logging sensitive values in CI/CD output

### 6. Performance

**Focus**: Optimizing Terragrunt execution speed and resource usage.

**Key Questions Answered**:
- How can I speed up Terragrunt operations?
- What's the best way to handle large infrastructures?
- How do I optimize dependency resolution?
- When should I use parallelism?

**Experience Levels**:
- **Beginner**: Basic optimization, understanding slow operations
- **Intermediate**: Parallelism configuration, caching strategies
- **Advanced**: Large-scale optimization, custom workflows

**Example Prompt**:
```text
"What are the performance best practices for Terragrunt?"
```

**Critical Recommendations**:
1. **Use terragrunt-cache** effectively
2. **Enable parallelism** for independent modules
3. **Use mock outputs** to speed up planning
4. **Limit dependency depth** to reduce overhead
5. **Cache provider plugins** in CI/CD
6. **Use targeted operations** when possible
7. **Monitor resource usage** in CI/CD

**Performance Optimization Techniques**:
```hcl
# Configure OpenTofu/Terraform command parallelism
terraform {
  extra_arguments "parallelism" {
    commands = ["apply", "plan", "destroy"]
    arguments = ["-parallelism=10"]
  }
}

# Use mock outputs for faster planning
dependency "vpc" {
  config_path = "../vpc"
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  mock_outputs = {
    vpc_id = "mock-vpc-id"
  }
}
```

**Command Optimization**:
- `terragrunt run --all --parallelism N -- plan` - Parallel planning
- Use `--filter` expressions to target specific units
- Use negated `--filter` expressions to skip unnecessary directories

**Antipatterns to Avoid**:
- Running `run --all` when only a few units changed
- Deep dependency chains (more than 3 levels)
- Not using mock outputs in development
- Over-parallelization causing rate limiting
- Not caching provider plugins in CI/CD

### 7. Testing

**Focus**: Testing Terragrunt configurations and infrastructure changes.

**Key Questions Answered**:
- How do I test Terragrunt configurations?
- What's the best way to validate changes before applying?
- How should I structure test environments?
- What tools should I use for testing?

**Experience Levels**:
- **Beginner**: Basic validation and linting
- **Intermediate**: Test environments, automated validation
- **Advanced**: Integration testing, policy enforcement

**Example Prompt**:
```text
"Show me testing best practices for Terragrunt"
```

**Critical Recommendations**:
1. **Always validate** before planning
2. **Use test environments** for changes
3. **Implement automated testing** in CI/CD
4. **Use policy-as-code tools** (OPA, Sentinel)
5. **Test module changes** in isolation first
6. **Implement smoke tests** after deployment
7. **Use terragrunt hcl fmt** for consistent formatting

**Testing Layers**:
```text
1. Syntax and input validation (terragrunt hcl validate --inputs)
2. Format checking (terragrunt hcl fmt --check)
3. Static analysis (tflint, checkov)
4. Plan validation (review plan output)
5. Test environment deployment
6. Integration tests
7. Policy compliance checks
```

**Common Testing Patterns**:
```bash
# Pre-commit validation workflow
terragrunt hcl fmt --check
terragrunt hcl validate --inputs --strict
terragrunt run --all --non-interactive -- plan

# CI/CD testing pipeline
validate -> format -> plan -> policy-check -> apply-to-test -> integration-tests
```

**Antipatterns to Avoid**:
- Skipping validation in development
- Not testing in non-production environments
- Applying changes without reviewing plans
- Not using format checking
- Skipping policy validation
- Testing only happy paths

## Experience Level Guidelines

### Beginner

**Focus**: Getting started with Terragrunt, understanding core concepts.

**Recommended Topics**:
1. Start with `module_organization` to understand structure
2. Learn `state_management` for basic backend setup
3. Understand `dependencies` for module communication

**Learning Path**:
```text
1. Set up basic folder structure
2. Configure remote state backend
3. Create simple dependency relationships
4. Learn basic security practices
5. Set up simple CI/CD validation
```

### Intermediate

**Focus**: Production-ready configurations, team collaboration.

**Recommended Topics**:
1. Advanced `state_management` with locking and encryption
2. Complex `dependencies` with mock outputs
3. `ci_cd` integration with approval workflows
4. `security` best practices implementation

**Learning Path**:
```text
1. Implement multi-environment structures
2. Configure state locking and encryption
3. Set up CI/CD pipelines with approval gates
4. Implement secret management
5. Optimize performance for larger infrastructures
```

### Advanced

**Focus**: Enterprise-scale infrastructure, optimization, governance.

**Recommended Topics**:
1. Enterprise `module_organization` patterns
2. Advanced `performance` optimization
3. Comprehensive `testing` strategies
4. `security` compliance automation

**Learning Path**:
```text
1. Design monorepo strategies
2. Implement policy-as-code
3. Optimize for large-scale deployments
4. Set up comprehensive testing frameworks
5. Implement zero-trust security models
```

## Common Workflows

### Setting Up a New Project

1. **Module Organization** (beginner):
   ```text
   "Show me beginner-level module organization practices"
   ```
   
2. **State Management** (beginner):
   ```text
   "What are the best practices for setting up remote state?"
   ```

3. **Generate Configuration**:
   ```text
   "Generate a terragrunt config for S3 remote state in us-east-1"
   ```

### Improving Existing Infrastructure

1. **Analyze Current Topic**:
   ```text
   "Analyze security best practices for Terragrunt"
   ```

2. **Review Antipatterns**:
   Check `commonPitfalls` in response to identify issues

3. **Review Recommendations**:
   Check `recommendations` array for improvements

4. **Implement Changes**:
   Use `generate_terragrunt_config` to create updated configurations

### Learning Advanced Patterns

1. **Query Advanced Level**:
   ```text
   "Show me advanced dependency management patterns"
   ```

2. **Review Trade-offs**:
   Understand implications in `tradeoffs` field

3. **Check Real-World Examples**:
   Review `realWorldExamples` for practical implementations

## Integration with Other Tools

### Combined with Configuration Generator

```text
# Step 1: Learn best practices
"What are the best practices for state management?"

# Step 2: Generate configuration
"Generate an S3 backend configuration with encryption and locking"

# Step 3: Write to disk (if file writing enabled)
"Write the configuration to ./terragrunt.hcl"
```

### Combined with Documentation Search

```text
# Step 1: Get high-level best practices
"Analyze CI/CD best practices"

# Step 2: Deep dive into specific topics
"Search for documentation about terragrunt-all commands in CI/CD"

# Step 3: Find implementation examples
"Show me code examples for CI/CD hooks"
```

### Combined with Code Examples

```text
# Step 1: Understand patterns
"What are best practices for dependencies?"

# Step 2: See implementations
"Find code examples for dependency blocks with mock outputs"
```

## Response Confidence Scoring

The tool returns a `confidence` score (0-100) indicating the quality and completeness of extracted data:

- **90-100**: Comprehensive data with rich examples and detailed explanations
- **70-89**: Good coverage with most key points documented
- **50-69**: Moderate coverage, may lack detail in some areas
- **Below 50**: Limited data available, consider checking official documentation

**Note**: Lower confidence doesn't mean incorrect information, just that the documentation may have limited coverage of that specific topic.

## Suggested Topics

Each response includes `suggestedTopics` - related topics that complement the current analysis:

```json
{
  "topic": "state_management",
  "suggestedTopics": ["security", "dependencies", "ci_cd"]
}
```

Use these to explore related best practices that work together.

## Tips for Best Results

1. **Start with your experience level** - Filter recommendations to avoid overwhelming complexity
2. **Review antipatterns first** - Learn what NOT to do before implementing solutions
3. **Check trade-offs** - Every pattern has implications, understand them before choosing
4. **Use with other tools** - Combine with code examples and documentation search for complete understanding
5. **Follow suggested topics** - Build comprehensive understanding of related practices
6. **Verify confidence scores** - For critical implementations, cross-reference with official docs when confidence is low
7. **Apply iteratively** - Start with beginner practices and evolve to advanced patterns
8. **Test in non-production** - Always validate best practices in safe environments first

## Real-World Examples

### Example 1: Setting Up Production-Ready State Management

**Query**:
```text
"What are intermediate-level state management best practices?"
```

**Expected Practices**:
- S3/Azure/GCS backend with encryption
- DynamoDB/Azure Storage/GCS locking
- State file versioning
- Separate state per environment
- IAM policies for state access

**Implementation**:
```hcl
remote_state {
  backend = "s3"
  config = {
    bucket         = "company-terraform-state-${get_env("AWS_ACCOUNT_ID")}"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
    
    s3_bucket_tags = {
      Environment = "production"
      Purpose     = "terraform-state"
    }
    
    dynamodb_table_tags = {
      Environment = "production"
      Purpose     = "terraform-locks"
    }
  }
}
```

### Example 2: Optimizing CI/CD Pipeline

**Query**:
```text
"Analyze CI/CD best practices for Terragrunt"
```

**Expected Practices**:
- Separate plan and apply stages
- Manual approval for production
- Parallelism for independent modules
- Drift detection
- Policy enforcement

**Implementation**:
```yaml
# .github/workflows/terragrunt.yml
name: Terragrunt CI/CD

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Format Check
        run: terragrunt hcl fmt --check
      - name: Validate All
        run: terragrunt hcl validate --inputs --strict

  plan:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Plan All
        run: |
          terragrunt run --all \
            --non-interactive \
            --parallelism 10 \
            -- plan

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v3
      - name: Apply All
        run: |
          terragrunt run --all \
            --non-interactive \
            --parallelism 5 \
            -- apply
```

### Example 3: Secure Dependency Management

**Query**:
```text
"What are security considerations for dependencies?"
```

**Expected Practices**:
- Use dependency blocks instead of data sources
- Mock outputs for sensitive data in development
- Validate dependency outputs
- Document required outputs

**Implementation**:
```hcl
# In app/terragrunt.hcl
dependency "database" {
  config_path = "../database"
  
  # Mock sensitive outputs for development
  mock_outputs = {
    db_endpoint = "localhost:5432"
    db_name     = "dev_db"
    # Don't mock password - require real value
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
  
  # Skip outputs for faster operations when safe
  skip_outputs = get_env("TF_VAR_skip_dependency_outputs", "false") == "true"
}

inputs = {
  database_endpoint = dependency.database.outputs.db_endpoint
  database_name     = dependency.database.outputs.db_name
  # Get password from secret manager, not dependency
  database_password = get_env("DB_PASSWORD")
}
```

## Troubleshooting

### Low Confidence Scores

**Problem**: Response has confidence score below 70.

**Solutions**:
1. Check official Terragrunt documentation directly
2. Try related topics that might have more coverage
3. Use `search_terragrunt_docs` for additional context
4. Combine multiple topic analyses for comprehensive understanding

### Limited Recommendations

**Problem**: Response has few recommendations or sparse details.

**Solutions**:
1. Try without experience level filter to get all recommendations
2. Check suggested topics for related practices
3. Use `get_code_examples` to find practical implementations
4. Search documentation for specific patterns

### Conflicting Information

**Problem**: Recommendations seem to conflict with existing practices.

**Solutions**:
1. Review trade-offs to understand context
2. Check experience level - practices vary by complexity
3. Consider infrastructure scale - patterns differ
4. Verify against official documentation
5. Check lastUpdated dates in related docs

## Related Documentation

- [Available Tools](Available-Tools.md) - Complete tool reference
- [Configuration Generator](Configuration-Generator.md) - Generate configurations
- [Functions Reference](Functions-Reference.md) - Built-in Terragrunt functions
- [File Writing Guide](File-Writing-Guide.md) - Writing configurations to disk
- [FAQ](FAQ.md) - Common questions

## Contributing

Found a gap in best practices coverage? The tool extracts data from official Terragrunt documentation. To improve coverage:

1. Check if the practice is documented at [terragrunt.gruntwork.io](https://terragrunt.gruntwork.io)
2. If missing, consider contributing to Terragrunt documentation
3. If present but not extracted, open an issue with the specific documentation page

## Next Steps

1. **Start learning**: Query best practices for your current focus area
2. **Apply practices**: Use with `generate_terragrunt_config` to implement patterns
3. **Test in non-production**: Validate practices in safe environments
4. **Progress to next level**: Move from beginner → intermediate → advanced
5. **Share knowledge**: Document team-specific practices as they evolve

Remember: Best practices are guidelines, not absolute rules. Always consider your specific context, requirements, and constraints when applying recommendations.
