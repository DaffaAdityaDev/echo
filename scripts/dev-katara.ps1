# scripts/dev-katara.ps1
# One-click startup for KataraGnosis Development Stack (Infrastructure + Backend + Frontend)

Write-Host "==> [1/3] Starting Katara Infrastructure (Postgres, Redis, Qdrant, Garage)..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\..\app\KataraGnosis"
docker compose up -d katara_db katara_redis katara_qdrant katara_garage

Write-Host "==> [2/3] Verifying GarageHQ cluster & bucket initialization..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\.."
$nodeId = (docker exec katara_garage /garage status 2>$null | Select-String -Pattern '^[0-9a-f]{16}' | ForEach-Object { $_.Line.Split(' ')[0] })
if ($nodeId) {
    docker exec katara_garage /garage layout assign -z garage -c 1G $nodeId 2>$null | Out-Null
    docker exec katara_garage /garage layout apply --version 1 2>$null | Out-Null
    docker exec katara_garage /garage bucket create inquizitive-docs 2>$null | Out-Null
    docker exec katara_garage /garage key import --yes -n katara-key GK7082bfabda7d6c2f702bd721 81661ba4ae2b57e8b1744ea041d116875c9f899049741d6c454511f6556fa3c2 2>$null | Out-Null
    docker exec katara_garage /garage bucket allow --read --write --key GK7082bfabda7d6c2f702bd721 inquizitive-docs 2>$null | Out-Null
}

Write-Host "==> [3/3] Starting Katara Backend (:8090) & Frontend (:3002)..." -ForegroundColor Green
Write-Host "Press Ctrl+C to terminate both services." -ForegroundColor Yellow

bunx concurrently -n "KATARA-BE,KATARA-FE" -c "cyan.bold,magenta.bold" --kill-others `
    "cd app/KataraGnosis/backend && go run cmd/server/main.go" `
    "cd app/KataraGnosis/frontend && bun dev"
