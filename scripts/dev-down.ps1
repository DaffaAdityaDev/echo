# scripts/dev-down.ps1
# Cleanly stop all Docker infrastructure and free up development ports

Write-Host "==> Stopping Docker Infrastructure..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\.."
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>$null
docker compose -f app/KataraGnosis/docker-compose.yml down -v 2>$null

Write-Host "==> Releasing Local Development Ports (8080, 3001, 3000, 8090, 3002)..." -ForegroundColor Cyan
$ports = @(8080, 3001, 3000, 8090, 3002)
foreach ($port in $ports) {
    try {
        $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
        foreach ($p in $pids) {
            if ($p -and $p -ne 0) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Write-Host "Killed process $p on port $port" -ForegroundColor Yellow
            }
        }
    } catch {}
}

Write-Host "==> All development services and containers have been stopped." -ForegroundColor Green
