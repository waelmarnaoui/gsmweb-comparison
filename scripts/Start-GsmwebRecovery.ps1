param([switch]$Background)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$nodePath=(Get-Command node -ErrorAction Stop).Source
$tsx=Join-Path $projectRoot 'node_modules/tsx/dist/cli.mjs'
if(-not(Test-Path -LiteralPath $tsx)){throw 'Install the project dependencies before starting recovery.'}
$runtime=Join-Path $projectRoot 'work/ads-laptop-runtime'
$env:ADS_WORKER_DIRECTORY=$runtime
Set-Location -LiteralPath $projectRoot
if(-not(Test-Path -LiteralPath (Join-Path $runtime 'worker.dpapi'))){
 if($Background){throw 'Pair the laptop interactively before background recovery can start.'}
 & $nodePath $tsx (Join-Path $PSScriptRoot 'pair-ads-laptop.ts')
 if($LASTEXITCODE -ne 0){throw 'Laptop pairing failed.'}
}
$pidFile=Join-Path $runtime 'host.pid'
if(Test-Path -LiteralPath $pidFile){
 $workerProcessId=0
 if([int]::TryParse(([IO.File]::ReadAllText($pidFile)).Trim(),[ref]$workerProcessId)){
  $running=Get-Process -Id $workerProcessId -ErrorAction SilentlyContinue
  $pidWritten=(Get-Item -LiteralPath $pidFile).LastWriteTime
  if($running -and $running.Path -eq $nodePath -and $running.StartTime -le $pidWritten.AddSeconds(10) -and $running.StartTime -ge $pidWritten.AddMinutes(-1)){Write-Output 'GSMWEB recovery is already running. Check Account control for its health.';exit}
 }
}
$hostScript=Join-Path $PSScriptRoot 'ads-laptop-host.ts'
Start-Process -FilePath $nodePath -ArgumentList @(('"'+$tsx+'"'),('"'+$hostScript+'"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'recovery.log') -RedirectStandardError (Join-Path $runtime 'recovery-error.log') | Out-Null
Write-Output 'GSMWEB recovery started in the background. Verify the recovery heartbeat in Account control.'
