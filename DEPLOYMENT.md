# WFConsoleWeb Deployment Guide

This guide covers the deployment paths that match the current repository state: local installs, Windows and Linux installer output, background process helpers, and Docker.

## Prerequisites

- Python 3.9+
- Node.js 18+ only when building the frontend yourself
- A WeatherFlow Tempest API token for live station data

## Windows

### Installer-based deployment

From the repository root:

```powershell
install-windows.bat
```

The installer deploys to `%LocalAppData%\WFConsoleWeb` and creates:

- `venv\`
- `wfconsoleweb.db`
- `data\`
- `run.bat`
- `install.log`

It also provisions the single admin account by calling `scripts/setup-admin.py`.

Optional non-interactive install:

```powershell
$env:WF_ADMIN_USERNAME = "admin"
$env:WF_ADMIN_PASSWORD = "ChangeMe123!"
install-windows.bat
```

Start the installed app:

```powershell
& "$env:LocalAppData\WFConsoleWeb\run.bat"
```

### Running from a checkout

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
python scripts/setup-admin.py --username admin --password "ChangeMe123!" --reset-existing --non-interactive
wfconsoleweb
```

### Windows background helper

From the repository root:

```powershell
.\scripts\manage-backend.ps1 start
.\scripts\manage-backend.ps1 status
.\scripts\manage-backend.ps1 stop
```

Runtime files are written under `.runtime\`.

### Windows service

The project does not install a Windows service automatically. If you want one, point NSSM at the generated `run.bat` from the install directory.

```powershell
nssm install WFConsoleWeb "$env:LocalAppData\WFConsoleWeb\run.bat"
nssm start WFConsoleWeb
```

## Linux

### Installer-based deployment

```bash
chmod +x install-linux.sh
./install-linux.sh
```

The installer deploys to `~/.local/opt/wfconsoleweb` and creates:

- `venv/`
- `wfconsoleweb.db`
- `data/`
- `run.sh`
- `wfconsoleweb.service`
- `install.log`

It also provisions the admin account during install.

Optional non-interactive install:

```bash
export WF_ADMIN_USERNAME=admin
export WF_ADMIN_PASSWORD='ChangeMe123!'
./install-linux.sh
```

Start directly:

```bash
~/.local/opt/wfconsoleweb/run.sh
```

### systemd service

The installer writes a service file but does not copy it into `/etc/systemd/system` for you.

```bash
sudo cp ~/.local/opt/wfconsoleweb/wfconsoleweb.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wfconsoleweb
sudo systemctl start wfconsoleweb
sudo systemctl status wfconsoleweb
```

## Frontend In Deployed Environments

The backend serves the compiled React build from `wfconsoleweb/frontend/build` when that bundle exists.

If you modify frontend source in a checkout-based deployment, rebuild before restarting the backend:

```bash
cd wfconsoleweb/frontend
npm install
npm run build
```

Without a compiled build, the backend falls back to `frontend/public` assets, which is useful for minimal development only and not a substitute for a real frontend build.

## Admin Bootstrap

WFConsoleWeb expects exactly one admin account.

To replace the existing admin:

```bash
python scripts/setup-admin.py --username admin --password "NewPassword123!" --reset-existing --non-interactive
```

The active database location is controlled by `DATABASE_URL`. On installed systems, the installers set this so the app uses the install directory database rather than the repository root.

## Docker

### Current status

Docker assets are present, but they should be treated as an advanced path and validated in your environment before production use.

Current repository behavior to be aware of:

- the backend code serves `wfconsoleweb/frontend/build`
- the Dockerfile builds the frontend in a separate stage and places it at `wfconsoleweb/frontend/build`
- the image health check targets `GET /health`
- the Compose file uses host networking for UDP access and a named volume for SQLite persistence
- host networking means Compose port mappings are not used

Typical commands:

```bash
docker compose up --build
docker compose logs -f wfconsoleweb
docker compose down
```

If you need local Tempest UDP broadcasts inside a containerized deployment, keep the host-networking requirement in mind.

When using Compose, set `JWT_SECRET_KEY` via environment or `.env` for production-like deployments.

## Health Checks And Diagnostics

Useful endpoints:

- `GET /health`
- `GET /api/system/health`
- `GET /api/system/info`
- `GET /api/docs`

## Common Deployment Issues

### Login page appears but admin login fails

The admin user was not provisioned against the database the app is actually using. Re-run `scripts/setup-admin.py` with the correct `DATABASE_URL` in the environment.

### Frontend looks stale after a code change

Rebuild the frontend bundle and restart the backend.

### App is writing data to the wrong directory

Check `DATABASE_URL` and `DATA_DIR` in the startup environment or generated launcher script.

