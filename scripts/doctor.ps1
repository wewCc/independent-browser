. "$PSScriptRoot/common.ps1"
& "$PSScriptRoot/check_environment.ps1"
if (!(Test-Path $local) -or !(Test-Path $cli)) {throw 'Install missing local dependencies/config first.'}
if (!(Test-Path $toml) -or !([IO.File]::ReadAllText($toml).Contains((Get-Block)))) {throw 'Registration differs from this project.'}
& (Get-BrowserNode) (Join-Path $root 'tests/connection/check.mjs') 1
if ($LASTEXITCODE) {throw 'STDIO handshake or tools/list failed.'}

