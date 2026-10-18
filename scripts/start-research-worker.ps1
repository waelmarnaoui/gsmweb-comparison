$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:USERPROFILE '.gsmweb-ollama'
$null = New-Item -ItemType Directory -Path $directory -Force
$credential = Join-Path $directory 'research-worker.dpapi'
if (-not (Test-Path -LiteralPath $credential)) {
    $secret = Read-Host 'Research pairing token from the app (not the gateway token)' -AsSecureString
    $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $credential
}
$saved = Get-Content -LiteralPath $credential -Raw | ConvertTo-SecureString
$env:GSMWEB_RESEARCH_TOKEN = [Net.NetworkCredential]::new('', $saved).Password
try {
    $node = Get-Command node -ErrorAction SilentlyContinue
    $runtime = if ($node) { $node.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
    & $runtime (Join-Path $PSScriptRoot 'research-worker.mjs')
} finally {
    Remove-Item Env:GSMWEB_RESEARCH_TOKEN -ErrorAction SilentlyContinue
}
