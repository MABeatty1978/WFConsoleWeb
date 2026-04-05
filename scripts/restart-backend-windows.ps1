$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManageScript = Join-Path $ScriptDir "manage-backend.ps1"

if (-not (Test-Path $ManageScript)) {
    throw "manage-backend.ps1 not found at $ManageScript"
}

# Delay allows API response to return before process stop/start.
$delayedCommand = "Start-Sleep -Seconds 2; & \"$ManageScript\" restart"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $delayedCommand -WindowStyle Hidden
