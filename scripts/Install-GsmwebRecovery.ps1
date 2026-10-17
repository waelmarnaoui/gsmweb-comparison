$ErrorActionPreference='Stop'
$launcher=Join-Path $PSScriptRoot 'Start-GsmwebRecovery.ps1'
& $launcher
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -File "'+$launcher+'" -Background')
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$watchdog=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([timespan]::Zero)
Register-ScheduledTask -TaskName 'GSMWEB Ads Recovery' -Action $action -Trigger @($trigger,$watchdog) -Settings $settings -Description 'Runs the GSMWEB recovery worker for the paired Windows user.' -Force | Out-Null
Write-Output 'GSMWEB recovery is configured to start when this Windows user signs in. Keep the laptop awake and online; check its health in the app dashboard.'
