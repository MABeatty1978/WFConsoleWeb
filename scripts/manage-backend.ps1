param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Command = "status"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$RuntimeDir = Join-Path $RepoRoot ".runtime"
$PidFile = Join-Path $RuntimeDir "backend.pid"
$LogFile = Join-Path $RuntimeDir "backend.log"
$ErrFile = Join-Path $RuntimeDir "backend.err.log"

if (-not (Test-Path $RuntimeDir)) {
    New-Item -Path $RuntimeDir -ItemType Directory | Out-Null
}

function Get-PythonExecutable {
    $venvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        return $venvPython
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        return $pythonCmd.Path
    }

    throw "Python executable not found. Create the project venv or add Python to PATH."
}

function Get-BackendProcessFromPidFile {
    if (-not (Test-Path $PidFile)) {
        return $null
    }

    try {
        $pidValue = Get-Content -Path $PidFile -ErrorAction Stop | Select-Object -First 1
        if (-not $pidValue) {
            return $null
        }

        $proc = Get-Process -Id ([int]$pidValue) -ErrorAction Stop
        return $proc
    }
    catch {
        return $null
    }
}

function Get-BackendProcessByCommandLine {
    $processes = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match "^python(\d+(\.\d+)?)?(w)?\.exe$"
    }
    foreach ($proc in $processes) {
        if (
            $proc.CommandLine -and (
                $proc.CommandLine -match "wfconsoleweb\.backend\.main" -or
                $proc.CommandLine -match "wfconsoleweb\.exe"
            )
        ) {
            return $proc
        }
    }
    return $null
}

function Write-PidFile([int]$id) {
    Set-Content -Path $PidFile -Value $id -Encoding ascii
}

function Remove-PidFile {
    if (Test-Path $PidFile) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Start-Backend {
    $existing = Get-BackendProcessFromPidFile
    if (-not $existing) {
        $byCmd = Get-BackendProcessByCommandLine
        if ($byCmd) {
            Write-PidFile -id $byCmd.ProcessId
            $existing = Get-Process -Id $byCmd.ProcessId -ErrorAction SilentlyContinue
        }
    }

    if ($existing) {
        Write-Host "Backend already running (PID $($existing.Id))."
        return
    }

    $pythonExe = Get-PythonExecutable
    Write-Host "Starting backend using $pythonExe"

    $startArgs = @{
        FilePath = $pythonExe
        ArgumentList = @("-m", "wfconsoleweb.backend.main")
        WorkingDirectory = $RepoRoot
        RedirectStandardOutput = $LogFile
        RedirectStandardError = $ErrFile
        PassThru = $true
    }
    $proc = Start-Process @startArgs

    Start-Sleep -Seconds 2

    if (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue) {
        Write-PidFile -id $proc.Id
        Write-Host "Backend started (PID $($proc.Id))."
        Write-Host "Log: $LogFile"
        Write-Host "Err: $ErrFile"
        return
    }

    throw "Backend failed to start. Check $ErrFile"
}

function Stop-Backend {
    $existing = Get-BackendProcessFromPidFile

    if (-not $existing) {
        $byCmd = Get-BackendProcessByCommandLine
        if ($byCmd) {
            $existing = Get-Process -Id $byCmd.ProcessId -ErrorAction SilentlyContinue
        }
    }

    if (-not $existing) {
        Write-Host "Backend is not running."
        Remove-PidFile
        return
    }

    Write-Host "Stopping backend (PID $($existing.Id))..."
    Stop-Process -Id $existing.Id -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 1
    if (Get-Process -Id $existing.Id -ErrorAction SilentlyContinue) {
        throw "Failed to stop backend PID $($existing.Id)."
    }

    Remove-PidFile
    Write-Host "Backend stopped."
}

function Show-Status {
    $existing = Get-BackendProcessFromPidFile

    if (-not $existing) {
        $byCmd = Get-BackendProcessByCommandLine
        if ($byCmd) {
            Write-PidFile -id $byCmd.ProcessId
            $existing = Get-Process -Id $byCmd.ProcessId -ErrorAction SilentlyContinue
        }
    }

    if ($existing) {
        Write-Host "Backend status: RUNNING"
        Write-Host "PID: $($existing.Id)"
        Write-Host "Log: $LogFile"
        Write-Host "Err: $ErrFile"
    }
    else {
        Write-Host "Backend status: STOPPED"
        Remove-PidFile
    }
}

switch ($Command) {
    "start" {
        Start-Backend
    }
    "stop" {
        Stop-Backend
    }
    "restart" {
        Stop-Backend
        Start-Backend
    }
    "status" {
        Show-Status
    }
    default {
        throw "Unknown command: $Command"
    }
}
