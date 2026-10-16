$ErrorActionPreference='Stop'
$launcher=Join-Path $PSScriptRoot 'Start-GsmwebRecovery.ps1'
& $launcher
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -File "'+$launcher+'" -Background')
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([timespan]::Zero)
Register-ScheduledTask -TaskName 'GSMWEB Ads Recovery' -Action $action -Trigger $trigger -Settings $settings -Description 'Runs the GSMWEB recovery worker for the paired Windows user.' -Force | Out-Null
Write-Output 'GSMWEB recovery is configured to start when this Windows user signs in. Keep the laptop awake and online; check its health in the app dashboard.'
