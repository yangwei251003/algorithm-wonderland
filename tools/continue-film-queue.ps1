param(
  [Parameter(Mandatory=$true)][int]$WaitForProcess,
  [Parameter(Mandatory=$true)][string]$Queue
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$queueFile = Join-Path $projectRoot 'qa/v2-successor-render-queues.json'
$definition = (Get-Content -LiteralPath $queueFile -Raw | ConvertFrom-Json).queues | Where-Object name -eq $Queue
if (-not $definition -or $definition.waitFor -ne $WaitForProcess) { throw 'Queue/process binding does not match its recorded task.' }
$target = Get-CimInstance Win32_Process -Filter "ProcessId = $WaitForProcess"
if ($target -and $target.CommandLine -notmatch 'media/manim/produce_batch.py final') { throw 'Refusing to wait on an unrelated process.' }
Write-Output "Queue $Queue waits for the current assigned render batch to finish; no additional rendering slot is opened."
if ($target) { Wait-Process -Id $WaitForProcess -ErrorAction SilentlyContinue }
Set-Location -LiteralPath $projectRoot
$pythonForFilms = Join-Path $projectRoot 'media/manim/.venv/Scripts/python.exe'
& $pythonForFilms -X utf8 media/manim/produce_batch.py final @($definition.ids)
exit $LASTEXITCODE
