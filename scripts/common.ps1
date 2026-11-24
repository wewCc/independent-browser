$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$toml = Join-Path $codexDir 'config.toml'
$cli = Join-Path $root 'node_modules/@playwright/mcp/cli.js'
$local = Join-Path $root 'config/playwright.local.json'
function Get-BrowserNode {
    $candidates=@(Get-Command node.exe -All -ErrorAction Stop)
    foreach($major in 24,22){
        foreach($candidate in $candidates){
            if($candidate.FileVersionInfo.ProductVersion -match ("^"+$major+"\.")){return $candidate.Source}
        }
    }
    throw 'Install a supported Node 24 or Node 22 LTS, or review the runtime selection for this release.'
}
function Write-JsonFile($path,$value) {
    [IO.File]::WriteAllText($path, ($value | ConvertTo-Json -Depth 12), $utf8)
}
function Initialize-Layout {
    foreach ($dir in 'backups','logs','reports','runtime/profiles','runtime/downloads','runtime/screenshots') {
        [void][IO.Directory]::CreateDirectory((Join-Path $root $dir))
    }
}
function Initialize-BrowserConfig {
    Initialize-Layout
    $cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'config/playwright.config.json') | ConvertFrom-Json
    $cfg.browser | Add-Member NoteProperty userDataDir (Join-Path $root 'runtime/profiles/default')
    $cfg.browser.launchOptions | Add-Member NoteProperty downloadsPath (Join-Path $root 'runtime/downloads')
    $cfg | Add-Member NoteProperty outputDir (Join-Path $root 'runtime/screenshots')
    Write-JsonFile $local $cfg
}
function Get-Block([string]$nodePath = (Get-BrowserNode)) {
    $template = [IO.File]::ReadAllText((Join-Path $root 'config/codex.mcp.example.toml'))
    $template = $template.Substring($template.IndexOf('[mcp_servers.')).TrimEnd()
    $values = @{'@ROOT@'=$root; '@NODE@'=$nodePath; '@CLI@'=$cli; '@CONFIG@'=$local}
    foreach ($key in $values.Keys) { $template = $template.Replace($key, $values[$key].Replace('\','/').Replace('"','\"')) }
    return "# BEGIN independent_browser (CodexBrowserTool)`n$template`n# END independent_browser (CodexBrowserTool)"
}
function Set-Registration([bool]$remove) {
    Initialize-Layout
    $exists = [IO.File]::Exists($toml)
    $content = if ($exists) { [IO.File]::ReadAllText($toml) } else { '' }
    $block = Get-Block
    $previous=$block
    $match=[regex]::Match($content,'(?m)^# BEGIN independent_browser \(CodexBrowserTool\)\r?\n\[mcp_servers\.independent_browser\]\r?\ncommand = "([^"\r\n]+)"')
    if ($match.Success) { $previous=Get-Block $match.Groups[1].Value }
    if ($content.Contains($previous)) {
        if (!$remove -and $previous -ceq $block) { return }
        $new = if($remove){$content.Replace("`n$previous`n",'')}else{$content.Replace("`n$previous`n", "`n$block`n")}
        if ($new -eq $content) { throw 'Managed block boundaries changed. Review config and backup.' }
    } else {
        if ($content -match '(?m)^\s*\[\s*mcp_servers\.(?:"independent_browser"|independent_browser)[.\]]|(?m)^# (BEGIN|END) independent_browser') { throw 'Existing or edited MCP entry. Review before changing.' }
        if ($remove) { return }
        $new = $content + "`n$block`n"
    }
    [void][IO.Directory]::CreateDirectory($codexDir)
    $tag = [guid]::NewGuid().ToString('N')
    $tmp = Join-Path $codexDir "config.$tag.tmp"
    $backup = Join-Path $root "backups/config-$tag.toml"
    if ($exists) { [IO.File]::Copy($toml,$backup); if ([IO.File]::ReadAllText($backup) -cne $content) {throw 'Config changed. Retry.'} }
    try {
        [IO.File]::WriteAllText($tmp,$new,$utf8)
        if ($exists) {
            if ([IO.File]::ReadAllText($toml) -cne $content) { throw 'Config changed. Retry.' }
            $old = Join-Path $codexDir "config.$tag.old"
            [IO.File]::Replace($tmp,$toml,$old)
            if ([IO.File]::ReadAllText($old) -cne $content) {throw "Concurrent edit preserved in $old. Review before continuing."}
            [IO.File]::Delete($old)
        } else { [IO.File]::Move($tmp,$toml) }
        Add-Content -LiteralPath (Join-Path $root 'logs/maintenance.jsonl') -Value (@{utc=[datetime]::UtcNow.ToString('o');action=if($remove){'unregister'}else{'register'};backup=if($exists){$backup}else{$null}}|ConvertTo-Json -Compress)
    } finally { if ([IO.File]::Exists($tmp)) { [IO.File]::Delete($tmp) } }
}

