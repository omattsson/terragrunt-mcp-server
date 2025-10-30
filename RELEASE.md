# Release Process

This document describes how to create a new release of the Terragrunt MCP Server.

## Creating a Release

Releases are created through GitHub Actions in a two-step process to comply with branch protection rules.

### Prerequisites

- All changes must be committed and pushed to the main branch
- All CI checks must pass (tests, linting, Docker build)
- You have write access to the repository

### Two-Step Release Process

#### Step 1: Create Version Bump PR

1. **Navigate to GitHub Actions**
   - Go to the repository on GitHub
   - Click on the "Actions" tab
   - Select "Create Release" workflow from the left sidebar

2. **Run the Workflow - Create PR**
   - Click "Run workflow" button (top right)
   - Fill in the parameters:
     - **Version**: Enter the version number (e.g., `0.3.1`, `0.4.0`, `1.0.0-beta.1`)
     - **Pre-release**: Check if this is a pre-release (alpha, beta, RC)
     - **Action**: Select `create-pr`
   - Click "Run workflow" to start

3. **Workflow Actions (Step 1)**
   The workflow will automatically:
   - ✅ Checkout code
   - ✅ Install dependencies
   - ✅ Run tests (build, lint, test:server)
   - ✅ Create a release branch (e.g., `release/v0.3.1`)
   - ✅ Update `package.json` and `package-lock.json` with new version
   - ✅ Commit and push the release branch
   - ✅ Create a pull request to `main`

4. **Review and Merge PR**
   - Review the automatically created PR
   - Ensure version numbers are correct
   - Merge the PR to main

#### Step 2: Publish the Release

5. **Run the Workflow Again - Publish Release**
   - Go back to Actions → "Create Release" workflow
   - Click "Run workflow" button again
   - Fill in the parameters:
     - **Version**: Enter the **same version** as step 1 (e.g., `0.3.1`)
     - **Pre-release**: Same as step 1
     - **Action**: Select `publish-release`
   - Click "Run workflow"

6. **Workflow Actions (Step 2)**
   The workflow will automatically:
   - ✅ Verify the version in package.json matches your input
   - ✅ Build Docker image with version tag
   - ✅ Generate changelog from git commits (or use existing CHANGELOG-X.X.X.md)
   - ✅ Create git tag (e.g., `v0.3.1`)
   - ✅ Push tag to GitHub
   - ✅ Create GitHub release with notes

7. **Verify the Release**
   - Check the "Releases" page on GitHub
   - Verify the tag was created
   - Review the generated changelog
   - Test the Docker image build

## Optional: Custom Changelog

If you want to provide custom release notes instead of auto-generated ones:

1. Before running Step 2, create a file named `CHANGELOG-X.X.X.md` (e.g., `CHANGELOG-0.3.1.md`)
2. Commit and push it to main
3. The workflow will automatically use this file for release notes

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
