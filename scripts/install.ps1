. "$PSScriptRoot/common.ps1"
Initialize-Layout
Push-Location $root
try {
    $pinned=(Get-Content -Raw package.json|ConvertFrom-Json).dependencies.'@playwright/mcp'
    $locked=(& node -p "JSON.stringify(Object.fromEntries(Object.entries(require('./package-lock.json').packages).filter(([key]) => key)))" | ConvertFrom-Json)
    $ready=$true
    foreach ($name in 'playwright','playwright-core','@playwright/mcp') {
        $key="node_modules/$name"
        if (!(Test-Path "$key/package.json") -or (Get-Content -Raw "$key/package.json" |ConvertFrom-Json).version -ne $locked.$key.version) { $ready=$false }
    }
    if (!$ready) {
        & npm.cmd ci --ignore-scripts --no-audit --no-fund --cache=runtime/npm-cache --registry=https://registry.npmjs.org
        if ($LASTEXITCODE) {throw 'npm ci failed'}
    }
    $got=& (Get-BrowserNode) $cli --version
    if ($LASTEXITCODE -or $got -ne "Version $pinned") {throw 'Installed CLI version mismatch'}
    Initialize-BrowserConfig
    Write-Output "Ready: $got"
} finally { Pop-Location }

