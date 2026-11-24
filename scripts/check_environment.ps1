. "$PSScriptRoot/common.ps1"
Initialize-Layout
$nodeExe = Get-BrowserNode
$npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
$environmentReport = [ordered]@{
    platform = 'Windows'
    node = (& $nodeExe --version)
    npm = (& $npmExe --version --loglevel=silent)
    configPresent = (Test-Path -LiteralPath $toml)
    cliPresent = (Test-Path -LiteralPath $cli)
    localConfigPresent = (Test-Path -LiteralPath $local)
}
Write-JsonFile (Join-Path $root 'reports/environment.json') $environmentReport
$environmentReport
