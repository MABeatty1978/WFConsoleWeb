@echo off
REM ===========================================================================
REM WFConsoleWeb Windows Installation Script
REM ===========================================================================
REM This script installs WFConsoleWeb on Windows systems

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%LocalAppData%\WFConsoleWeb"
set "INSTALL_DATA_DIR=%INSTALL_DIR%\data"
set "INSTALL_DB_URL=sqlite:///%INSTALL_DIR:\=/%/wfpiconsole.db"
set "LOG_FILE=%INSTALL_DIR%\install.log"

echo.
echo ===========================================================================
echo  WFConsoleWeb - Windows Installer
echo ===========================================================================
echo.

REM Create install directory
if not exist "%INSTALL_DIR%" (
    echo [*] Creating installation directory: %INSTALL_DIR%
    mkdir "%INSTALL_DIR%" 2>nul
)

if not exist "%INSTALL_DATA_DIR%" (
    mkdir "%INSTALL_DATA_DIR%" 2>nul
)

REM Check Python version
echo [*] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.9+ from https://www.python.org
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%i"
echo [OK] Found Python !PYTHON_VERSION!

REM Create virtual environment
echo.
echo [*] Creating Python virtual environment...
if exist "%INSTALL_DIR%\venv" (
    echo [*] Virtual environment already exists, skipping creation
) else (
    python -m venv "%INSTALL_DIR%\venv"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        exit /b 1
    )
    echo [OK] Virtual environment created
)

REM Activate virtual environment
echo [*] Activating virtual environment...
call "%INSTALL_DIR%\venv\Scripts\activate.bat"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    exit /b 1
)

REM Upgrade pip
echo.
echo [*] Upgrading pip and build tools...
python -m pip install --upgrade pip setuptools wheel 2>&1 >> "%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to upgrade pip
    echo See %LOG_FILE% for details
    exit /b 1
)
echo [OK] Build tools upgraded

REM Install dependencies
echo.
echo [*] Installing WFConsoleWeb...
cd /d "%SCRIPT_DIR%"
pip install -e . 2>&1 >> "%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install WFConsoleWeb
    echo See %LOG_FILE% for details
    exit /b 1
)
echo [OK] WFConsoleWeb installed successfully

REM Build React frontend
echo.
echo [*] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    echo Then re-run this installer.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version 2^>^&1') do set "NODE_VERSION=%%i"
echo [OK] Found Node.js !NODE_VERSION!

echo.
echo [*] Installing frontend dependencies...
cd /d "%SCRIPT_DIR%wfpiconsole\frontend"
call npm install 2>&1 >> "%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    echo See %LOG_FILE% for details
    exit /b 1
)
echo [OK] Frontend dependencies installed

echo.
echo [*] Building React frontend...
call npm run build 2>&1 >> "%LOG_FILE%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend
    echo See %LOG_FILE% for details
    exit /b 1
)
echo [OK] Frontend built successfully
cd /d "%SCRIPT_DIR%"

REM Configure single admin account
echo.
echo [*] Configuring admin account...
setlocal DisableDelayedExpansion
set "ADMIN_USERNAME=%WF_ADMIN_USERNAME%"
set "ADMIN_PASSWORD=%WF_ADMIN_PASSWORD%"

if "%ADMIN_USERNAME%"=="" (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "$u=Read-Host 'Admin username [admin]'; if([string]::IsNullOrWhiteSpace($u)){$u='admin'}; Write-Output $u"') do set "ADMIN_USERNAME=%%i"
)

if "%ADMIN_PASSWORD%"=="" (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "$p=Read-Host 'Admin password' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"') do set "ADMIN_PASSWORD=%%i"
)

if "%ADMIN_PASSWORD%"=="" (
    echo [ERROR] Admin password cannot be empty
    exit /b 1
)

set "DATABASE_URL=%INSTALL_DB_URL%"
set "DATA_DIR=%INSTALL_DATA_DIR%"
python "%SCRIPT_DIR%scripts\setup-admin.py" --username "%ADMIN_USERNAME%" --password "%ADMIN_PASSWORD%" --reset-existing --non-interactive 2>&1 >> "%LOG_FILE%"
set "SETUP_EXIT=%errorlevel%"
set "ADMIN_USERNAME_RESULT=%ADMIN_USERNAME%"
endlocal & set "SETUP_EXIT=%SETUP_EXIT%" & set "ADMIN_USERNAME=%ADMIN_USERNAME_RESULT%"

if %SETUP_EXIT% neq 0 (
    echo [ERROR] Failed to configure admin account
    echo See %LOG_FILE% for details
    exit /b 1
)
set "ADMIN_PASSWORD="
echo [OK] Admin account configured: %ADMIN_USERNAME%

REM Create startup script
echo.
echo [*] Creating startup script...
set "STARTUP_SCRIPT=%INSTALL_DIR%\run.bat"
(
    echo @echo off
    echo REM WFConsoleWeb Startup Script
    echo title WFConsoleWeb Web Interface
    echo cd /d "%INSTALL_DIR%"
    echo set "DATABASE_URL=%INSTALL_DB_URL%"
    echo set "DATA_DIR=%INSTALL_DATA_DIR%"
    echo call "%INSTALL_DIR%\venv\Scripts\activate.bat"
    echo wfpiconsole-web
    echo pause
) > "!STARTUP_SCRIPT!"
echo [OK] Startup script created at !STARTUP_SCRIPT!

REM Create shortcut to startup script (requires PowerShell)
echo.
echo [*] Creating desktop shortcut...
powershell -NoProfile -Command "$DesktopPath = [Environment]::GetFolderPath('Desktop'); $ShortcutPath = Join-Path $DesktopPath 'WFConsoleWeb.lnk'; $Shell = New-Object -ComObject WScript.Shell; $Shortcut = $Shell.CreateShortcut($ShortcutPath); $Shortcut.TargetPath = '%STARTUP_SCRIPT%'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.Save(); Write-Host '[OK] Desktop shortcut created'" 2>nul

REM Create Windows Service (requires admin, optional)
echo.
echo [*] Optional: Install as Windows Service
echo.
echo To install as a Windows Service (requires administrator):
echo   1. Open Command Prompt as Administrator
echo   2. Run: nssm install WFConsoleWeb "%STARTUP_SCRIPT%"
echo.
echo Note: NSSM (Non-Sucking Service Manager) can be downloaded from:
echo   https://nssm.cc/download
echo.

REM Final instructions
echo.
echo ===========================================================================
echo  Installation Complete!
echo ===========================================================================
echo.
echo Start WFConsoleWeb:
echo   1. Double-click the "WFConsoleWeb" shortcut on your Desktop
echo   2. Or run: %STARTUP_SCRIPT%
echo.
echo Access the web interface:
echo   Open your browser and navigate to: http://localhost:8000
echo.
echo Configuration:
echo   - On first run, you'll be prompted to configure your API key
echo   - Settings are stored in: %INSTALL_DIR%
echo.
echo Logs and Database:
echo   - Database: %INSTALL_DIR%\wfpiconsole.db
echo   - Logs: %LOG_FILE%
echo.
echo Documentation: See README.md in the installation directory
echo.
echo ===========================================================================
echo.
pause
