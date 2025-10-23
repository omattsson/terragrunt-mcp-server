# Development Guide

This guide covers everything you need to know to contribute to the Terragrunt MCP Server project.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+
- Git
- TypeScript knowledge
- Familiarity with MCP protocol (helpful)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/omattsson/terragrunt-mcp-server.git
cd terragrunt-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Development Workflow

```bash
# Start development mode with auto-reload
npm run dev

# Run specific tests
npm run test:server
npm run test:mcp

# Lint code
npm run lint

# Build for production
npm run build
```

## Project Structure

```text
terragrunt-mcp-server/
├── src/                    # Source code
│   ├── index.ts           # Main entry point
│   ├── server.ts          # Server setup
│   ├── handlers/          # MCP protocol handlers
│   │   ├── resources.ts   # Resource handler
│   │   ├── tools.ts       # Tool handler
│   │   └── prompts.ts     # Prompt handler
│   ├── terragrunt/        # Domain logic
│   │   ├── docs.ts        # Documentation manager
│   │   ├── commands.ts    # Command execution
│   │   ├── config.ts      # Configuration
│   │   └── utils.ts       # Utilities
│   └── types/             # TypeScript types
│       ├── mcp.ts         # MCP types
│       └── terragrunt.ts  # Domain types
├── test/                  # Test files
│   ├── server-test.js     # Integration tests
│   └── test-retry-fallback.mjs  # Retry logic tests
├── fixtures/              # Test data
│   └── terragrunt-docs-fixture.json
├── schemas/               # JSON schemas
│   └── mcp-protocol.json
├── .cache/                # Runtime cache (gitignored)
│   └── terragrunt-docs/
├── dist/                  # Compiled output (gitignored)
└── wiki/                  # Documentation
```

## Code Style

### TypeScript Conventions

- Use `async`/`await` for asynchronous code
- Prefer `const` over `let`
- Use explicit types for function parameters
- Export types alongside implementations

**Example**:

```typescript
export async function fetchDocs(url: string): Promise<TerragruntDoc[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}
```

### ESM Modules

The project uses **ES Modules**:

```typescript
// ✅ Correct - include .js extension
import { ResourceHandler } from './handlers/resources.js';

// ❌ Wrong - missing extension
import { ResourceHandler } from './handlers/resources';
```

**Important**: Even though source files are `.ts`, imports must use `.js` extensions.

### Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await riskyOperation();
  return { data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { fallback: [] }; // Never throw to MCP layer
}
```

### Logging

Use structured logging:

```typescript
console.info('[INFO] Cache loaded successfully');
console.warn('[WARN] Cache expired, refreshing...');
console.error('[ERROR] Web fetch failed:', error);
```

## Testing

### Running Tests

```bash
# All tests
npm test

# Server integration tests
npm run test:server

# MCP protocol tests
npm run test:mcp
./test-mcp.sh

# Retry/fallback tests
node test/test-retry-fallback.mjs
```

### Writing Tests

#### Integration Tests

Add to `test/server-test.js`:

```javascript
async function testNewFeature() {
  console.log('\n🧪 Testing new feature...');
  
  try {
    const result = await manager.myNewMethod();
    
    if (result.length > 0) {
      console.log('✅ New feature works');
      return true;
    } else {
      console.error('❌ New feature returned no data');
      return false;
    }
  } catch (error) {
    console.error('❌ New feature failed:', error);
    return false;
  }
}

// Add to test suite
const tests = [
  // ...existing tests,
  testNewFeature
];
```

#### MCP Protocol Tests

Add to `test-mcp.sh`:

```bash
# Test new tool
echo '📝 Testing new tool...'
cat << EOF | node dist/index.js
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "my_new_tool",
    "arguments": {"param": "value"}
  }
}
EOF
```

### Test Coverage

Current test coverage:
- ✅ Documentation fetching and caching
- ✅ Search functionality
- ✅ All 6 tools
- ✅ Resource handlers
- ✅ Retry and fallback logic
- ✅ MCP protocol compliance

## Adding New Features

### Adding a New Tool

1. **Define tool in `ToolHandler`**:

```typescript
// src/handlers/tools.ts
getAvailableTools(): ToolDefinition[] {
  return [
    // ...existing tools,
    {
      name: 'my_new_tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string', description: 'A parameter' }
        },
        required: ['param']
      }
    }
  ];
}
```

2. **Implement execution logic**:

```typescript
// src/handlers/tools.ts
async executeTool(name: string, args: unknown): Promise<ToolResponse> {
  switch (name) {
    // ...existing cases,
    case 'my_new_tool': {
      const { param } = args as { param: string };
      const result = await this.docsManager.myNewMethod(param);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  }
}
```

3. **Add domain logic**:

```typescript
// src/terragrunt/docs.ts
async myNewMethod(param: string): Promise<SomeType> {
  const docs = await this.fetchLatestDocs();
  // Implementation here
  return results;
}
```

4. **Write tests**:

```javascript
// test/server-test.js
async function testMyNewTool() {
  console.log('\n🧪 Testing my_new_tool...');
  const result = await manager.myNewMethod('test-param');
  // Assertions
}
```

5. **Update documentation**:
   - Add to `wiki/Available-Tools.md`
   - Update `README.md` if needed

### Adding a New Resource

1. **Define URI pattern**:

```typescript
// src/handlers/resources.ts
async listResources(): Promise<Resource[]> {
  return [
    // ...existing resources,
    {
      uri: 'terragrunt://docs/mynewview',
      name: 'My New View',
      description: 'A new way to view documentation',
      mimeType: 'text/markdown'
    }
  ];
}
```

2. **Implement handler**:

```typescript
// src/handlers/resources.ts
async getResource(uri: string): Promise<ResourceContent> {
  if (uri === 'terragrunt://docs/mynewview') {
    const content = await this.buildMyNewView();
    return {
      contents: [{
        uri,
        mimeType: 'text/markdown',
        text: content
      }]
    };
  }
  // ...
}
```

### Extending Documentation Manager

Add new methods to `TerragruntDocsManager`:

```typescript
// src/terragrunt/docs.ts
export class TerragruntDocsManager {
  // Existing methods...
  
  async getDocsByTag(tag: string): Promise<TerragruntDoc[]> {
    const docs = await this.fetchLatestDocs();
    return docs.filter(doc => 
      doc.content.includes(`#${tag}`)
    );
  }
}
```

## Working with the Cache

### Development Mode

For development, you may want to disable caching:

```typescript
// src/terragrunt/docs.ts
// Temporary change for testing
private shouldRefreshCache(): boolean {
  return true; // Always fetch fresh
}
```

**Remember to revert before committing!**

### Testing Cache Logic

```bash
# Clear cache
rm -rf .cache/

# Run server - will fetch fresh
npm run dev

# Check cache was created
ls -la .cache/terragrunt-docs/

# Run again - should use cache
npm run dev
```

### Fixture Updates

Update the embedded fixture when documentation structure changes:

```bash
# Ensure cache is fresh
rm -rf .cache/
npm run dev  # Will fetch and cache

# Copy to fixture
cp .cache/terragrunt-docs/docs-cache.json fixtures/terragrunt-docs-fixture.json

# Test fixture fallback
# (Simulate network failure in code)
```

## Debugging

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

Add debug logging:

```typescript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('[DEBUG] Cache status:', {
    size: this.inMemoryCache.size,
    lastUpdated: this.cacheMetadata.lastUpdated
  });
}
```

Run with debugging:

```bash
DEBUG=true npm run dev
```

### MCP Protocol Debugging

Test protocol directly:

```bash
# Send test request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/index.js

# Prettify output
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist/index.js | jq
```

## Git Workflow

### Branching Strategy

- `main` - Stable releases
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches
- `wiki` - Documentation updates

### Making Changes

```bash
# Create feature branch
git checkout -b feature/my-awesome-feature

# Make changes
# ...

# Commit with conventional commits
git add .
git commit -m "feat: add awesome new feature"

# Push and create PR
git push origin feature/my-awesome-feature
```

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples**:
```text
feat(tools): add get_code_examples tool
fix(cache): resolve race condition in cache loading
docs(wiki): add development guide
test(docs): add tests for section extraction
```

## Pull Request Process

1. **Create PR** against `develop` branch
2. **Fill out PR template**:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots if applicable

3. **Ensure checks pass**:
   - ✅ Tests pass
   - ✅ Lint passes
   - ✅ Build succeeds

4. **Request review** from maintainers

5. **Address feedback**

6. **Merge** when approved

## Release Process

See [Release Process](Release-Process) for detailed release workflow.

### Version Bumping

```bash
# Patch release (0.2.0 → 0.2.1)
npm version patch

# Minor release (0.2.0 → 0.3.0)
npm version minor

# Major release (0.2.0 → 1.0.0)
npm version major
```

### Publishing

```bash
# Build for production
npm run build

# Publish to npm (maintainers only)
npm publish

# Tag and push
git push --follow-tags
```

## Common Tasks

### Update Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update @modelcontextprotocol/sdk

# Update all packages (careful!)
npm update

# Install and save
npm install @modelcontextprotocol/sdk@latest --save
```

### Regenerate Lock File

```bash
# Delete and regenerate
rm package-lock.json
npm install
```

### Fix Linting Issues

```bash
# Auto-fix what can be fixed
npx eslint --fix src/**/*.ts

# Check remaining issues
npm run lint
```

## Best Practices

### Code Quality

- ✅ Write self-documenting code
- ✅ Add comments for complex logic
- ✅ Keep functions small and focused
- ✅ Use TypeScript types extensively
- ✅ Handle errors gracefully

### Performance

- ✅ Cache expensive operations
- ✅ Avoid unnecessary web requests
- ✅ Use in-memory caching for hot paths
- ✅ Profile before optimizing

### Security

- ✅ Validate all inputs
- ✅ Never execute shell commands with user input
- ✅ Use HTTPS for all external requests
- ✅ Keep dependencies updated

### Testing

- ✅ Test happy paths
- ✅ Test error cases
- ✅ Test edge cases
- ✅ Test with real data
- ✅ Test cache behavior

## Troubleshooting Development Issues

### Build Failures

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Check TypeScript version
npx tsc --version  # Should be 5.0+
```

### Import Errors

**Problem**: `Cannot find module './handlers/resources'`

**Solution**: Check import has `.js` extension:
```typescript
import { ResourceHandler } from './handlers/resources.js';
```

### Test Failures

**Problem**: Tests fail unexpectedly

**Solution**:
```bash
# Clear cache
rm -rf .cache/

# Rebuild
npm run build

# Run tests
npm test
```

### ESLint Errors

**Problem**: New ESLint rules failing

**Solution**:
```bash
# Update ESLint config
npm install eslint@latest --save-dev

# Fix auto-fixable issues
npx eslint --fix src/
```

## Resources

### Documentation

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)

### Tools

- [VS Code](https://code.visualstudio.com/)
- [GitHub Copilot](https://github.com/features/copilot)
- [jq](https://stedolan.github.io/jq/) - JSON processor

### Related Projects

- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Terragrunt](https://github.com/gruntwork-io/terragrunt)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/omattsson/terragrunt-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/omattsson/terragrunt-mcp-server/discussions)
- **Email**: Check README for contact info

## See Also

- [Architecture Overview](Architecture-Overview) - System design
- [Testing](Testing) - Testing guide
- [Release Process](Release-Process) - How releases work
- [Contributing](../CONTRIBUTING.md) - Contribution guidelines
