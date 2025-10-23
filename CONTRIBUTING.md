# Contributing to Terragrunt MCP Server

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/terragrunt-mcp-server.git
   cd terragrunt-mcp-server
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Before Making Changes

1. Make sure you're on the latest version:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

1. **Write clean, well-documented code** following the existing style
2. **Add tests** for new features
3. **Update documentation** as needed (README.md, code comments)
4. **Run tests locally** before committing:
   ```bash
   npm run build          # Build TypeScript
   npm run lint           # Check code style
   npm run test:server    # Run tests
   ```

### Code Style

- We use **ESLint** for code linting
- Follow **TypeScript** best practices
- Use **meaningful variable and function names**
- Add **comments** for complex logic
- Keep functions **small and focused**

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```
feat: Add CLI command help tool

- Implement get_cli_command_help method
- Add search logic for CLI commands
- Update documentation
```

## Pull Request Process

1. **Push your changes** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Fill out the PR template completely
   - Link any related issues
   - Describe your changes in detail

3. **Wait for CI checks** to complete:
   - ✅ Tests must pass
   - ✅ Build must succeed
   - ✅ Linting must pass
   - ✅ Docker build must succeed

4. **Address review feedback** if requested

5. **Squash commits** if requested before merging

## Continuous Integration

Our CI pipeline runs automatically on every PR and includes:

### Test Job
- Runs tests on Node.js 20.x, 22.x, and 24.x
- Checks TypeScript compilation
- Runs linter
- Executes test suite

### Docker Job
- Builds Docker image
- Verifies image can start

### Code Quality Job
- Checks for outdated dependencies
- Runs security audit
- Validates package.json format

All checks must pass before a PR can be merged.

## Running Tests Locally

```bash
# Run all checks (recommended before pushing)
npm run build && npm run lint && npm run test:server

# Individual commands
npm run build          # Compile TypeScript
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run test:server    # Run integration tests
npm run test           # Run Jest tests (if configured)

# Docker testing
npm run docker:build   # Build Docker image
npm run docker:run     # Test Docker container
```

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── server.ts             # Server implementation
├── handlers/             # MCP protocol handlers
│   ├── tools.ts          # Tool definitions and execution
│   ├── resources.ts      # Resource management
│   └── prompts.ts        # Prompt handling
├── terragrunt/           # Terragrunt-specific logic
│   ├── docs.ts           # Documentation fetching/caching
│   ├── commands.ts       # CLI command wrappers
│   ├── config.ts         # Configuration handling
│   └── utils.ts          # Utility functions
└── types/                # TypeScript type definitions
    ├── mcp.ts            # MCP protocol types
    └── terragrunt.ts     # Terragrunt types
```

## Adding New Tools

To add a new MCP tool:

1. **Define the tool** in `src/handlers/tools.ts`:
   - Add to `getAvailableTools()` array with proper schema
   - Add case to `executeTool()` switch statement
   - Implement private method for execution logic

2. **Add helper methods** in `src/terragrunt/docs.ts` if needed:
   - Add extraction/search methods
   - Use existing cache infrastructure

3. **Update documentation**:
   - Add to README.md "Available Tools" section
   - Add example prompts
   - Update `.github/copilot-instructions.md`

4. **Test thoroughly**:
   - Local testing with `node test/server-test.js`
   - Docker testing with rebuild
   - Manual testing with VS Code + Copilot

## Need Help?

- Open an **issue** for bugs or feature requests
- Check existing **issues** and **PRs** for similar work
- Ask questions in **pull request comments**

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
