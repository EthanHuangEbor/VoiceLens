# voicelens one-shot installer (Windows PowerShell).
# Copies the universal skill into every detected harness skill dir and links the CLI.
$ErrorActionPreference = 'Stop'

$skillDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'skills\voicelens'

function Install-Skill([string]$dest) {
  $parent = Split-Path -Parent $dest
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -Recurse -Force $skillDir $dest
  Write-Host "skill -> $dest"
}

if (Test-Path "$HOME\.claude") { Install-Skill "$HOME\.claude\skills\voicelens" }
if (Test-Path "$HOME\.codex")  { Install-Skill "$HOME\.codex\skills\voicelens" }
if (Test-Path "$HOME\.agents") { Install-Skill "$HOME\.agents\skills\voicelens" }
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { "$HOME\.dsh" }
if (Test-Path $dshHome) { Install-Skill "$dshHome\skills\voicelens" }

Write-Host "linking CLI (npm link) ..."
npm link

Write-Host "done. verify with: voicelens doctor"
