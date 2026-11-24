. "$PSScriptRoot/common.ps1"
$source = Join-Path $root 'skills/independent_browser/SKILL.md'
$directory = Join-Path $codexDir 'skills/independent_browser'
$destination = Join-Path $directory 'SKILL.md'
if (Test-Path -LiteralPath $directory) {
    if ((Test-Path -LiteralPath $destination -PathType Leaf) -and
        ((Get-FileHash -LiteralPath $destination).Hash -eq (Get-FileHash -LiteralPath $source).Hash)) {
        Write-Output 'The skill is already installed.'
        return
    }
    throw 'A different skill directory already exists. Review it before installing.'
}
[void][IO.Directory]::CreateDirectory($directory)
[IO.File]::Copy($source, $destination, $false)
Write-Output 'Installed the independent_browser user skill.'
