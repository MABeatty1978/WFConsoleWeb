# WFConsoleWeb Setup Notes

This file summarizes the setup fixes that are now reflected in the current codebase and documentation.

## Current Known-Good Setup

For a local development checkout:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python scripts/setup-admin.py --username admin --password "ChangeMe123!" --reset-existing --non-interactive
python -m uvicorn wfpiconsole.backend.main:app --reload
```

Then open `http://localhost:8000`.

## Important Setup Behavior

- runtime dependencies come from `requirements.txt`
- development tools come from `requirements-dev.txt` and the `dev` extra in `pyproject.toml`
- installers provision the admin account during setup
- the project expects exactly one admin user
- frontend source changes require `npm run build` if you want the backend-served UI updated
- installed environments set `DATABASE_URL` and `DATA_DIR` explicitly so data stays in the install directory

## Manual Verification Checklist

- `pip install -e .` completes successfully
- `python scripts/setup-admin.py ... --reset-existing --non-interactive` succeeds
- `wfpiconsole-web` starts without import errors
- login works with the configured admin account
- `cd wfpiconsole/frontend && npm run build` completes successfully when frontend changes are made

## Canonical Docs

Use these files as the maintained sources of truth:

- [README.md](README.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)

Treat older troubleshooting snippets or one-off setup notes as historical unless they match those two files.
