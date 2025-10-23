# Release Process

This document describes how to create a new release of the Terragrunt MCP Server.

## Creating a Release

Releases are created manually through GitHub Actions to ensure quality control and intentional versioning.

### Prerequisites

- All changes must be committed and pushed to the main branch
- All CI checks must pass (tests, linting, Docker build)
- Changelog should be reviewed

### Steps to Create a Release

1. **Navigate to GitHub Actions**
   - Go to the repository on GitHub
   - Click on the "Actions" tab
   - Select "Create Release" workflow from the left sidebar

2. **Run the Workflow**
   - Click "Run workflow" button (top right)
   - Fill in the parameters:
     - **Version**: Enter the version number (e.g., `0.2.0`, `1.0.0`, `1.1.0-beta.1`)
     - **Pre-release**: Check if this is a pre-release (alpha, beta, RC)
   - Click "Run workflow" to start

3. **Workflow Actions**
   The workflow will automatically:
   - ✅ Checkout code
   - ✅ Install dependencies
   - ✅ Run tests (build, lint, test:server)
   - ✅ Update `package.json` with new version
   - ✅ Build Docker image with version tag
   - ✅ Generate changelog from git commits
   - ✅ Create git tag (e.g., `v0.2.0`)
   - ✅ Create GitHub release with notes
   - ✅ Attach installation instructions

4. **Verify the Release**
   - Check the "Releases" page on GitHub
   - Verify the tag was created
   - Review the generated changelog
   - Test the Docker image build

## Version Naming Convention

Follow [Semantic Versioning](https://semver.org/):

- **Major version** (X.0.0): Breaking changes
  - Example: `1.0.0` → `2.0.0`
  
- **Minor version** (0.X.0): New features, backward compatible
  - Example: `0.2.0` → `0.3.0`
  
- **Patch version** (0.0.X): Bug fixes, backward compatible
  - Example: `0.2.0` → `0.2.1`

- **Pre-release**: Alpha, beta, or release candidate
  - Example: `0.3.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`

## Current Version

The current version is defined in `package.json`:

```json
{
  "version": "0.2.0"
}
```

## Release Notes

The workflow automatically generates release notes from git commit messages. To ensure good release notes:

- Use [Conventional Commits](https://www.conventionalcommits.org/) format
- Write clear, descriptive commit messages
- Group related changes in single commits when possible

### Commit Message Format

```
<type>: <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance (dependencies, build, etc.)
- `ci`: CI/CD changes

## Rollback

If a release needs to be rolled back:

1. Delete the GitHub release
2. Delete the git tag:
   ```bash
   git tag -d v0.2.0
   git push origin :refs/tags/v0.2.0
   ```
3. Revert the version bump commit
4. Create a new patch release with fixes

## Post-Release

After creating a release:

1. Update documentation if needed
2. Announce the release (if applicable)
3. Monitor for issues
4. Plan next version features

## Troubleshooting

### Workflow fails on tests
- Fix the issues locally
- Push fixes
- Re-run the workflow

### Version already exists
- Choose a different version number
- Or delete the existing tag/release first

### Docker build fails
- Check Dockerfile
- Verify all dependencies are in package.json
- Test locally: `npm run docker:build`

## Example Release Flow

```bash
# Current state: v0.1.0 released

# 1. Make changes
git checkout -b feature/new-tool
# ... make changes ...
git commit -m "feat: Add new MCP tool for X"
git push origin feature/new-tool

# 2. Create PR and merge to main
# ... PR review and merge ...

# 3. Create release through GitHub Actions UI
# - Version: 0.2.0
# - Pre-release: No

# 4. Workflow runs automatically
# Result: v0.2.0 is released!
```

## Access Control

Only repository maintainers with write access can trigger the release workflow. This ensures:
- Quality control
- Intentional versioning
- Proper testing before release
