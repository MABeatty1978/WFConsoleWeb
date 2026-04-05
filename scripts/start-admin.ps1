param()

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")

Write-Host "WFConsoleWeb Admin Startup Script" -ForegroundColor Cyan
Write-Host "Repository root: $RepoRoot" -ForegroundColor Gray
Write-Host ""

# Check if running as Administrator
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $IsAdmin) {
    Write-Host "Not running as Administrator. Requesting elevation..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        ('"{0}"' -f $PSCommandPath)
    ) | Out-Null
    exit 0
}

Write-Host "Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Stop only processes that conflict with WFConsoleWeb ports
Write-Host "Checking for processes using WFConsoleWeb ports: 8000 TCP and 50222 UDP..."

$portOwners = New-Object System.Collections.Generic.HashSet[int]

$tcpOwner = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -First 1
if ($tcpOwner) {
    [void]$portOwners.Add([int]$tcpOwner)
}

$udpOwners = Get-NetUDPEndpoint -LocalPort 50222 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($owner in $udpOwners) {
    if ($owner) {
        [void]$portOwners.Add([int]$owner)
    }
}

if ($portOwners.Count -gt 0) {
    foreach ($ownerPid in $portOwners) {
        try {
            $proc = Get-Process -Id $ownerPid -ErrorAction Stop
            Stop-Process -Id $ownerPid -Force -ErrorAction Stop
            Write-Host ("Stopped PID {0} ({1})" -f $ownerPid, $proc.ProcessName) -ForegroundColor Green
        }
        catch {
            Write-Host ("Could not stop PID {0}: {1}" -f $ownerPid, $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "  No conflicting processes found." -ForegroundColor Gray
}

Write-Host ""

# Activate venv and start backend
Write-Host "Starting WFConsoleWeb backend as a background process..."
Write-Host ""

# Ensure relative paths resolve from the repository root regardless of launch location.
Set-Location -Path $RepoRoot

$manageScript = Join-Path $ScriptDir "manage-backend.ps1"
if (-not (Test-Path $manageScript)) {
    throw "manage-backend.ps1 not found at $manageScript"
}

$env:PYTHONUNBUFFERED = "1"

& powershell -NoProfile -ExecutionPolicy Bypass -File $manageScript start

Write-Host ""
Write-Host "WFConsoleWeb is running in the background." -ForegroundColor Green
Write-Host "Open: http://localhost:8000" -ForegroundColor Green
Write-Host "Use scripts/manage-backend.ps1 status|stop|restart to manage it." -ForegroundColor Gray
