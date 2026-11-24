. "$PSScriptRoot/common.ps1"
if (!(Test-Path $cli) -or !(Test-Path $local)) { throw 'Run install.ps1 first.' }
Set-Registration $false
Write-Output 'independent_browser registered. Reload MCP in desktop settings or restart the app.'

