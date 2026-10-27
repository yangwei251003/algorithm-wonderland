param([string]$PackageRoot = '', [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localUrl = 'http://127.0.0.1:5188/'
$deliveryPath = if ($PackageRoot) { [System.IO.Path]::GetFullPath($PackageRoot).TrimEnd('\') } else { Join-Path $projectRoot 'delivery' }
if (-not $PackageRoot -and -not (Test-Path -LiteralPath (Join-Path $deliveryPath 'index.html'))) {
    $reviewPath = Join-Path $projectRoot 'delivery-review'
    if (Test-Path -LiteralPath (Join-Path $reviewPath 'index.html')) { $deliveryPath = $reviewPath; Write-Host '正在打开制作中审查版；影片仍在逐条核验。' }
}
if (-not (Test-Path -LiteralPath (Join-Path $deliveryPath 'index.html'))) { throw '本地体验馆尚未完成打包，请先完成制作与验收。' }
$running = $false
try {
    $health = Invoke-RestMethod -Uri ($localUrl + '__algorithm_health') -TimeoutSec 2
    if ($health.app -eq 'algorithm-wonderland' -and $health.root -eq $deliveryPath) { $running = $true }
    else { throw '5188端口正由其他服务使用。' }
} catch [System.Net.WebException] { }
if (-not $running) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $serverPath = Join-Path $PSScriptRoot 'local-server.mjs'
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverPath + '"', '"' + $deliveryPath + '"') -WindowStyle Hidden -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $deliveryPath 'local-server.log') -RedirectStandardError (Join-Path $deliveryPath 'local-server-errors.log')
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 200
        try { $health = Invoke-RestMethod -Uri ($localUrl + '__algorithm_health') -TimeoutSec 1; if ($health.app -eq 'algorithm-wonderland' -and $health.root -eq $deliveryPath) { $ready=$true; break } } catch { }
    }
    if (-not $ready) { throw '本地体验馆未能启动，请查看使用说明。' }
}
if (-not $NoBrowser) { Start-Process $localUrl }
