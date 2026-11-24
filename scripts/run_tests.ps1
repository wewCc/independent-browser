param([ValidateSet('connection','basic','foreground','covered','minimized','minimized-core')][string]$Mode='connection')
. "$PSScriptRoot/common.ps1"
Initialize-Layout
if ($Mode -eq 'connection') { & (Get-BrowserNode) (Join-Path $root 'tests/connection/check.mjs') 20 }
else { & (Get-BrowserNode) (Join-Path $root 'tests/browser/lab.mjs') $Mode }
if ($LASTEXITCODE) {throw "Test failed: $Mode. See reports."}

