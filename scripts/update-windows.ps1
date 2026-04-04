param(
    [Parameter(Mandatory = $true)]
    [string]$AssetUrl,
    [Parameter(Mandatory = $false)]
    [string]$ExpectedVersion = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$UpdateDir = Join-Path $RuntimeDir "updates"
$BackupDir = Join-Path $RuntimeDir "backups"
$LogFile = Join-Path $RuntimeDir "update.log"

if (-not (Test-Path $RuntimeDir)) { New-Item -Path $RuntimeDir -ItemType Directory | Out-Null }
if (-not (Test-Path $UpdateDir)) { New-Item -Path $UpdateDir -ItemType Directory | Out-Null }
if (-not (Test-Path $BackupDir)) { New-Item -Path $BackupDir -ItemType Directory | Out-Null }

function Write-Log([string]$message) {
    $line = "$(Get-Date -Format o) [update] $message"
    Add-Content -Path $LogFile -Value $line -Encoding ascii
}

function Get-PythonExecutable {
    $venvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
    if (Test-Path $venvPython) { return $venvPython }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) { return $pythonCmd.Path }

    throw "Python executable not found."
}

function Resolve-DatabasePath {
    $dbUrl = $env:DATABASE_URL
    if ([string]::IsNullOrWhiteSpace($dbUrl)) {
        return Join-Path $RepoRoot "wfconsoleweb.db"
    }

    if ($dbUrl.StartsWith("sqlite:///")) {
        $sqlitePath = $dbUrl.Substring(10)
        if ([System.IO.Path]::IsPathRooted($sqlitePath)) {
            return $sqlitePath
        }
        return Join-Path $RepoRoot $sqlitePath
    }

    return $null
}

try {
    Write-Log "Starting update. AssetUrl=$AssetUrl ExpectedVersion=$ExpectedVersion"

    $dbPath = Resolve-DatabasePath
    if ($dbPath -and (Test-Path $dbPath)) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupPath = Join-Path $BackupDir "wfconsoleweb-$timestamp.db"
        Copy-Item -Path $dbPath -Destination $backupPath -Force
        Write-Log "Database backup created: $backupPath"
    } else {
        Write-Log "Database backup skipped (non-sqlite or file not found)."
    }

    $fileName = [System.IO.Path]::GetFileName(([uri]$AssetUrl).AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($fileName)) {
        throw "Could not determine wheel filename from AssetUrl"
    }
    $assetPath = Join-Path $UpdateDir $fileName

    Write-Log "Downloading release asset to $assetPath"
    Invoke-WebRequest -Uri $AssetUrl -OutFile $assetPath

    Write-Log "Stopping backend"
    & (Join-Path $ScriptDir "manage-backend.bat") stop | Out-Null

    $pythonExe = Get-PythonExecutable
    Write-Log "Installing wheel via pip using $pythonExe"
    & $pythonExe -m pip install --upgrade $assetPath | Out-Null

    Write-Log "Restarting backend"
    & (Join-Path $ScriptDir "manage-backend.bat") start | Out-Null

    Write-Log "Update completed successfully"
}
catch {
    Write-Log "Update failed: $($_.Exception.Message)"
    try {
        & (Join-Path $ScriptDir "manage-backend.bat") start | Out-Null
    }
    catch {
        Write-Log "Failed to restart backend after update error"
    }
    exit 1
}
