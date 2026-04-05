param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("status", "enable", "disable")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$script:TaskName = "WFConsoleWeb-Autostart"
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:RepoRoot = Resolve-Path (Join-Path $script:ScriptDir "..")
$script:ManageScript = Join-Path $script:ScriptDir "manage-backend.ps1"

function Write-JsonResult {
    param(
        [bool]$Enabled,
        [string]$Message,
        [bool]$Supported = $true,
        [string]$Error = ""
    )

    $payload = [ordered]@{
        enabled = $Enabled
        supported = $Supported
        platform = "windows"
        task_name = $script:TaskName
        message = $Message
    }

    if ($Error) {
        $payload.error = $Error
    }

    $payload | ConvertTo-Json -Compress
}

function Get-IsEnabled {
    try {
        $task = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction Stop
        return $task.State -ne "Disabled"
    }
    catch {
        return $false
    }
}

function Ensure-Task {
    if (-not (Test-Path $script:ManageScript)) {
        throw "manage-backend.ps1 not found at $($script:ManageScript)"
    }

    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$($script:ManageScript)`" start"
    $taskTrigger = New-ScheduledTaskTrigger -AtStartup
    $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $script:TaskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -RunLevel Highest -Description "Start WFConsoleWeb backend at system startup" -Force | Out-Null
}

try {
    switch ($Action) {
        "status" {
            $enabled = Get-IsEnabled
            Write-Output (Write-JsonResult -Enabled $enabled -Message "Autostart status retrieved.")
        }
        "enable" {
            Ensure-Task
            Enable-ScheduledTask -TaskName $script:TaskName | Out-Null
            Write-Output (Write-JsonResult -Enabled $true -Message "Autostart enabled.")
        }
        "disable" {
            try {
                Disable-ScheduledTask -TaskName $script:TaskName | Out-Null
                Write-Output (Write-JsonResult -Enabled $false -Message "Autostart disabled.")
            }
            catch {
                # If task does not exist, treat as disabled.
                Write-Output (Write-JsonResult -Enabled $false -Message "Autostart already disabled.")
            }
        }
    }
}
catch {
    Write-Output (Write-JsonResult -Enabled $false -Supported $true -Message "Autostart operation failed." -Error $_.Exception.Message)
    exit 1
}
