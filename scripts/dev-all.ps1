# scripts/dev-all.ps1
# One-click startup for Entire Echo & KataraGnosis Ecosystem

Write-Host "==> [1/4] Starting Echo & Katara Infrastructure..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\.."

# Create shared network
docker network create dokploy-network 2>$null | Out-Null

# Start Echo infra (postgres & redis)
docker compose -f docker-compose.dev.yml up -d echo-postgres echo-redis

# Start Katara infra only (stop app containers if running in Docker to avoid port conflict)
Set-Location -Path "$PSScriptRoot\..\app\KataraGnosis"
docker compose up -d katara_db katara_redis katara_qdrant katara_garage
docker stop katara_backend katara_frontend 2>$null | Out-Null

Write-Host "==> [2/4] Initializing GarageHQ..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\.."
$nodeId = (docker exec katara_garage /garage status 2>$null | Select-String -Pattern '^[0-9a-f]{16}' | ForEach-Object { $_.Line.Split(' ')[0] })
if ($nodeId) {
    docker exec katara_garage /garage layout assign -z garage -c 1G $nodeId 2>$null | Out-Null
    docker exec katara_garage /garage layout apply --version 1 2>$null | Out-Null
    docker exec katara_garage /garage bucket create inquizitive-docs 2>$null | Out-Null
    docker exec katara_garage /garage key import --yes -n katara-key GK7082bfabda7d6c2f702bd721 81661ba4ae2b57e8b1744ea041d116875c9f899049741d6c454511f6556fa3c2 2>$null | Out-Null
    docker exec katara_garage /garage bucket allow --read --write --key GK7082bfabda7d6c2f702bd721 inquizitive-docs 2>$null | Out-Null
}

Write-Host "==> [3/4] Launching All 5 Application Services..." -ForegroundColor Green
Write-Host "Echo Backend: http://localhost:8080" -ForegroundColor White
Write-Host "Echo Agent:   http://localhost:3001" -ForegroundColor White
Write-Host "Echo Web:     http://localhost:3000" -ForegroundColor White
Write-Host "Katara BE:    http://localhost:8090" -ForegroundColor White
Write-Host "Katara FE:    http://localhost:3002" -ForegroundColor White
Write-Host "Press Ctrl+C to terminate all services." -ForegroundColor Yellow

bunx concurrently -n "ECHO-BE,ECHO-AGENT,ECHO-WEB,KATARA-BE,KATARA-FE" -c "blue.bold,green.bold,yellow.bold,cyan.bold,magenta.bold" --kill-others `
    "cd backend && go run cmd/server/main.go" `
    "cd agent && bun dev" `
    "cd app/web && bun dev" `
    "cd app/KataraGnosis/backend && go run cmd/server/main.go" `
    "cd app/KataraGnosis/frontend && bun dev"
