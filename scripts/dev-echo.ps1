# scripts/dev-echo.ps1
# One-click startup for Echo Ecosystem (Backend :8080 + Agent :3001 + Web :3000)

Write-Host "==> [1/2] Starting Echo Infrastructure (Postgres & Redis)..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\.."

docker network create dokploy-network 2>$null | Out-Null
docker compose -f docker-compose.dev.yml up -d echo-postgres echo-redis

Write-Host "==> [2/2] Launching Echo Backend, Agent & Web Frontend..." -ForegroundColor Green
Write-Host "Echo Backend: http://localhost:8080" -ForegroundColor White
Write-Host "Echo Agent:   http://localhost:3001" -ForegroundColor White
Write-Host "Echo Web:     http://localhost:3000" -ForegroundColor White
Write-Host "Press Ctrl+C to terminate all Echo services." -ForegroundColor Yellow

bunx concurrently -n "ECHO-BE,ECHO-AGENT,ECHO-WEB" -c "blue.bold,green.bold,yellow.bold" --kill-others `
    "cd backend && go run cmd/server/main.go" `
    "cd agent && bun dev" `
    "cd app/web && bun dev"
