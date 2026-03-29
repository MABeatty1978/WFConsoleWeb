# GitHub Setup Notes

This file contains generic repository setup guidance for WFConsoleWeb. It intentionally avoids user-specific account names, tokens, remotes, or local machine paths.

## Create The Repository

1. Create a new GitHub repository named `WFConsoleWeb`.
2. Do not initialize it with a README if this checkout already contains history.
3. Copy the repository URL.

## Connect The Local Repository

If the repository does not already have a remote:

```bash
git remote add origin https://github.com/<owner>/WFConsoleWeb.git
git branch -M main
git push -u origin main
```

If a remote already exists, verify it:

```bash
git remote -v
```

## Authentication

Use one of these approaches:

- GitHub CLI authentication
- SSH keys
- HTTPS with a personal access token

For HTTPS pushes, GitHub requires a token rather than your account password.

## Recommended Repository Settings

- enable GitHub Actions
- protect the `main` branch if multiple contributors push directly
- configure repository secrets only if you use publish or deployment workflows

## Typical Commands

```bash
git status
git add <files>
git commit -m "Describe the change"
git push origin main
```

## CI Notes

The repository includes workflow files under `.github/workflows/`. Review them before enabling package publication or release automation so secrets, package names, and publishing targets match your environment.
