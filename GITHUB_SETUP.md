# GitHub Setup Instructions for WFConsoleWeb

Your local git repository is ready to push to GitHub! Follow these steps to complete the setup.

## Step 1: Create Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in
2. Click the **+** icon in the top-right corner
3. Select **New repository**
4. Configure the repository:
   - **Repository name**: `WFConsoleWeb`
   - **Description**: "A modern web interface for Tempest weather station by WeatherFlow"
   - **Visibility**: `Public` (as configured)
   - **Initialize repository**: Leave unchecked (we already have commits)
5. Click **Create repository**

## Step 2: Push Code to GitHub

Your local repository is already configured with the remote. Just push:

```bash
cd "c:\Users\mabea\Development\WFConsoleWeb"
git push -u origin main
```

When prompted, enter:
- **Username**: `mabeatty1978`
- **Password**: Your GitHub personal access token (see below)

## Step 3: Create a GitHub Personal Access Token (PAT)

If you don't have a personal access token:

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Set scopes:
   - ✓ repo (Full control of private repositories)
   - ✓ workflow (Update GitHub Action and workflow permissions)
4. Click **Generate token**
5. **Copy the token** (you won't see it again!)
6. Use this token as your password when pushing

## Repository Configuration

**Current Setup:**
- Remote: `https://github.com/mabeatty1978/WFConsoleWeb.git`
- Branch: `main`
- Files staged: 90 files, 14763 insertions
- Initial commit: "Initial commit: WFConsoleWeb project with deployment and build infrastructure"

## Verify Setup

After pushing, verify with:

```bash
git remote -v
git log --oneline
```

## Next: Set Up GitHub Actions

Once the repository is on GitHub:

1. The `.github/workflows/` files are already included:
   - `tests.yml` — Automated testing
   - `build.yml` — Build and publish
   - `quality.yml` — Code quality metrics

2. Go to your repository on GitHub
3. Click **Actions** tab to see workflows running
4. Configure repository secrets (in Settings → Secrets and variables → Actions):
   - `DOCKER_USERNAME` (if using Docker Hub)
   - `DOCKER_PASSWORD` (if using Docker Hub)
   - `PYPI_API_TOKEN` (if publishing to PyPI)
   - `SONAR_TOKEN` (if using SonarCloud)

## Available GitHub Actions

Once these secrets are configured, your CI/CD pipeline will:

✅ **tests.yml**: Run tests on Python 3.9, 3.10, 3.11 (Ubuntu, Windows, macOS)
✅ **build.yml**: Build frontend, create distributions, publish to PyPI on tags
✅ **quality.yml**: Run code quality checks, SonarCloud analysis

## Quick Reference

```bash
# View current status
git status

# View commit log
git log --oneline -n 5

# View remote configuration
git remote -v

# Make changes and commit
git add <file>
git commit -m "Description of changes"
git push origin main

# Create a release/tag
git tag -a v0.1.0 -m "Version 0.1.0"
git push origin v0.1.0
```

---

## Troubleshooting

**"Repository not found"**
- The repository doesn't exist on GitHub yet. Create it first (Step 1).

**"Authentication failed"**
- Ensure you're using a valid personal access token (not your GitHub password)
- Verify your username is correct: `mabeatty1978`

**"Permission denied"**
- Check that your PAT has the `repo` scope enabled
- Verify the repository is under your account

---

## Support

For more information, visit:
- GitHub Docs: https://docs.github.com
- Git Help: https://git-scm.com/doc
- Personal Access Tokens: https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
