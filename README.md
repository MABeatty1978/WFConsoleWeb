# WFConsoleWeb

WFConsoleWeb is a FastAPI + React web interface for WeatherFlow Tempest stations. It provides a local dashboard, historical analytics, forecast panels, theme support, and an install flow that provisions a single admin account during setup.

This project was modeled from Pete Davis's WeatherFlow PiConsole project:
https://github.com/peted-davis/WeatherFlow_PiConsole

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.9%2B-brightgreen)
![Status](https://img.shields.io/badge/status-alpha-orange)

## What It Does

- Live dashboard with WebSocket-backed updates
- Historical analytics for temperature, wind, pressure, humidity, lightning, and rainfall
- Public forecast endpoints used by the dashboard
- Multi-source forecast panel with Tempest, Sager, and Zambretti modes
- Theme support and configurable display settings
- Local SQLite storage with configurable data directory
- Windows and Linux installer scripts
- Single-admin authentication model with install-time bootstrap

## Current Project Layout

```text
WFConsoleWeb/
├── wfconsoleweb/               # Python package
│   ├── backend/                # FastAPI app and routes
│   ├── config/                 # settings, database, models
│   ├── core/                   # data processing and API clients
│   ├── frontend/               # React app source and compiled build
│   └── service/                # background services
├── scripts/                    # admin/bootstrap/update helpers
├── tests/                      # pytest suite
├── install-linux.sh            # Linux installer
├── install-windows.bat         # Windows installer
├── DEPLOYMENT.md               # deployment guide
├── GITHUB_SETUP.md             # repository setup notes
└── README.md
```

## Requirements

- Python 3.9+
- Node.js 18+ only if you need to build or develop the frontend
- A WeatherFlow Tempest station and API token for live data features

## Quick Start

### Windows installer

Run the installer from the repository root:

```powershell
.\install-windows.bat
```

The installer:

- creates a virtual environment under `%LocalAppData%\WFConsoleWeb`
- installs the package and runtime dependencies
- prompts for an admin username and password
- creates exactly one admin account
- writes a `run.bat` launcher that sets the install database and data paths

You can provide credentials non-interactively before running the installer:

```powershell
$env:WF_ADMIN_USERNAME = "admin"
$env:WF_ADMIN_PASSWORD = "ChangeMe123!"
install-windows.bat
```

### Linux installer

```bash
chmod +x install-linux.sh
./install-linux.sh
```

The Linux installer creates the app under `~/.local/opt/wfconsoleweb`, provisions one admin account, generates `run.sh`, and writes a `wfconsoleweb.service` file you can install with `systemd`.

## Manual Local Setup

If you do not want to use the platform installers:

```bash
python -m venv venv
source venv/bin/activate
pip install -e .
```

PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
```

Create the initial admin account before logging in:

```bash
python scripts/setup-admin.py --username admin --password "ChangeMe123!" --reset-existing --non-interactive
```

Important behavior:

- the project supports exactly one admin account
- `scripts/setup-admin.py` replaces an existing admin only when `--reset-existing` is used
- installer and runtime database location come from `DATABASE_URL`
- persistent files default to the repository `data` directory in a local dev setup

## Starting The Backend

### Preferred local command

```bash
wfconsoleweb
```

### Development server with reload

```bash
python -m uvicorn wfconsoleweb.backend.main:app --reload
```

The backend listens on `http://localhost:8000` by default.

### Windows helper script

For a detached backend process with pid/log management:

```powershell
.\scripts\manage-backend.ps1 start
.\scripts\manage-backend.ps1 status
.\scripts\manage-backend.ps1 stop
```

This flow starts the backend as a background process, so closing the shell that ran the command does not stop the server.

For a one-liner detached launch:

```powershell
Start-Process -WindowStyle Hidden -FilePath "powershell.exe" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File","C:/path/to/WFConsoleWeb/scripts/manage-backend.ps1","start")
```

For Administrator-elevated startup and automatic cleanup of conflicting 8000/TCP and 50222/UDP owners:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-admin.ps1"
```

Equivalent batch wrapper:

```powershell
.\scripts\manage-backend.bat start
```

## Frontend Build And Development

The backend prefers serving the compiled React build from `wfconsoleweb/frontend/build`.

That means:

- if you change frontend source and want the backend-served UI to reflect it, run a new frontend build
- if no build is present, the backend falls back to serving `frontend/public` assets for minimal development behavior

Build the frontend:

```bash
cd wfconsoleweb/frontend
npm install
npm run build
```

Run the React dev server separately:

```bash
cd wfconsoleweb/frontend
npm install
npm start
```

With the React dev server, keep the backend running on port `8000`; the frontend is configured to proxy API requests there.

## Authentication And First Login

- admin login is handled by `/api/auth/login`
- install/setup should provision the admin before first use
- the app logs a warning at startup if no admin account exists
- forecast endpoints used by the public dashboard do not require auth

If you need to reset the admin locally:

```bash
python scripts/setup-admin.py --username admin --password "NewPassword123!" --reset-existing --non-interactive
```

## Development Setup

Install runtime plus dev tools:

```bash
pip install -e ".[dev]"
```

Alternative:

```bash
pip install -e .
pip install -r requirements-dev.txt
```

Run tests:

```bash
pytest tests -v --cov=wfconsoleweb
```

Useful checks:

```bash
black wfconsoleweb tests
isort wfconsoleweb tests
flake8 wfconsoleweb tests
```

The test suite includes an installer/admin regression that verifies:

- admin bootstrap creates one admin user
- passwords are hashed
- login works after bootstrap
- special characters in passwords are handled correctly

## Configuration Notes

Common environment variables:

- `HOST` and `PORT` for the FastAPI bind address
- `CORS_ORIGINS` for explicit comma-separated browser origins if you need to override the defaults
- `CORS_ORIGIN_REGEX` for the browser-origin regex allowlist used for LAN/private-network access
- `DATABASE_URL` for the database location
- `DATA_DIR` for exported files and other persistent app data
- `JWT_SECRET_KEY` for auth token signing
- `MASTER_PASSWORD` for encryption-related configuration
- `UDP_PORT` for local Tempest UDP broadcasts

Defaults for local development:

- database: `./wfconsoleweb.db`
- data directory: `./data`
- host: `0.0.0.0`
- port: `8000`

LAN access notes:

- the built frontend now uses the browser's current origin for `/api` and `/ws/observations`, so opening `http://<server-ip>:8000` from another machine uses that server automatically instead of `localhost`
- default CORS allows localhost plus private-network IP browser origins; if you access the app through a custom hostname, set `CORS_ORIGINS` or `CORS_ORIGIN_REGEX` accordingly
- if Windows Firewall is enabled, allow inbound TCP on the chosen app port (default `8000`)

## Forecast Methods

WFConsoleWeb supports three forecast overlays in the Forecast panel:

- Tempest Better Forecast (WeatherFlow API)
- Sager pressure-trend forecast
- Zambretti barometric dial forecast

Zambretti implementation note:

- The Zambretti calculation approach in this project is based on and adapted from the SAS Communities reference repository: https://github.com/sascommunities/iot-zambretti-weather-forcasting
- The app applies that method to locally collected station observations and renders the result as forecast text with supporting pressure/trend metrics in the Forecast panel.

## Scripts, Tools, And Utilities

The repository includes these helper scripts and utilities:

- `scripts/setup-admin.py`
	- Purpose: create or replace the single admin account.
	- Common use:
		- `python scripts/setup-admin.py --username admin --password "ChangeMe123!" --reset-existing --non-interactive`

- `scripts/manage-backend.ps1`
	- Purpose: start/stop/restart/status for backend on Windows with PID/log files.
	- Common use:
		- `.\scripts\manage-backend.ps1 start`
		- `.\scripts\manage-backend.ps1 status`
		- `.\scripts\manage-backend.ps1 stop`

- `scripts/start-admin.ps1`
	- Purpose: elevate to Administrator, clean conflicting server ports, and start backend in the background.
	- Common use:
		- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-admin.ps1"`

- `scripts/manage-backend.bat`
	- Purpose: batch wrapper around `manage-backend.ps1`.
	- Common use:
		- `.\scripts\manage-backend.bat restart`

- `scripts/update-windows.ps1`
	- Purpose: download and install a wheel asset, back up DB, restart backend.
	- Common use:
		- `.\scripts\update-windows.ps1 -AssetUrl "<wheel-url>" -ExpectedVersion "0.2.0"`

- `scripts/update-linux.sh`
	- Purpose: download and install a wheel asset, back up DB, restart backend/service.
	- Common use:
		- `./scripts/update-linux.sh --asset-url "<wheel-url>" --expected-version "0.2.0"`

- `build.py`
	- Purpose: local packaging helper that builds frontend and Python distribution artifacts.
	- Common use:
		- `python build.py`

## Installation Notes

- Installers now use non-editable package installation (`pip install .`) for a more stable end-user setup.
- Windows installer creates `%LocalAppData%\WFConsoleWeb\run.bat` and desktop shortcut.
- Linux installer creates `~/.local/opt/wfconsoleweb/run.sh` and a `wfconsoleweb.service` file template.
- If installing manually from a checkout and you are actively developing code, use editable install (`pip install -e .`) instead.

## Docker

Docker support is included, but review [DEPLOYMENT.md](DEPLOYMENT.md) before relying on it in production. The repository currently uses a multi-stage build and a Compose file oriented around a local SQLite volume and host networking for UDP access.

With host networking, Docker Compose port mappings are not used; access is via the host network stack.

Typical commands:

```bash
docker compose up --build
docker compose down
```

## Troubleshooting

### Port 8000 already in use

Start on another port:

```bash
python -m uvicorn wfconsoleweb.backend.main:app --port 8001
```

Or stop the managed background process and restart cleanly:

```powershell
.\scripts\manage-backend.ps1 stop
.\scripts\manage-backend.ps1 start
```

### Frontend changes are not visible

Rebuild the frontend bundle:

```bash
cd wfconsoleweb/frontend
npm run build
```

### Login fails on a fresh local checkout

Create or reset the admin account:

```bash
python scripts/setup-admin.py --username admin --password "ChangeMe123!" --reset-existing --non-interactive
```

### Database location is not what you expect

Check `DATABASE_URL`. Installers set this explicitly so the installed app uses its install directory rather than the repository root.

## Additional Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) for Windows, Linux, service, and Docker deployment details
- [GITHUB_SETUP.md](GITHUB_SETUP.md) for repository/bootstrap notes
- [REFACTORING.md](REFACTORING.md) for branding/refactoring background

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

