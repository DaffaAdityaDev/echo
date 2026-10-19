.PHONY: dev-up dev-down dev-logs prod-up prod-down prod-logs deploy clean status swagger-gen help

# Default target
.DEFAULT_GOAL := help

help:
	@echo "======================================================================="
	@echo "                     ECHO APP BUILD & DEPLOYMENT SYSTEM"
	@echo "======================================================================="
	@echo "Development Stack:"
	@echo "  make dev-echo          - Run backend, agent and web on the host (infra in Docker)"
	@echo "  make dev-up            - Start Echo development stack"
	@echo "  make dev-infra         - Start Echo infrastructure (postgres + redis)"
	@echo "  make dev-down          - Stop Echo stack and remove volumes"
	@echo ""
	@echo "Production:"
	@echo "  make prod-up           - Build and start the production stack"
	@echo "  make deploy            - Rebuild and restart production (keeps data volumes)"
	@echo "  make prod-down         - Stop production (keeps data volumes)"
	@echo ""
	@echo "KataraGnosis Stack (Hot-Reloading):"
	@echo "  make katara-dev        - Run Katara locally with auto-infra (Concurrently)"
	@echo "  make katara-docker-dev - Run Katara 100% in Docker with live volume hot-reload"
	@echo "  make katara-docker-down- Stop Katara Docker stack and volumes"
	@echo "  make katara-docker-logs- View Katara Docker logs"
	@echo ""
	@echo "Full Ecosystem (Echo + Katara - All 5 Services):"
	@echo "  make dev-all           - 1-Click start all infra & 5 applications"
	@echo "  make dev-all-down      - 1-Click teardown of all stacks"
	@echo "======================================================================="

# Swagger Docs Generation
swagger-gen:
	cd backend && go run github.com/swaggo/swag/cmd/swag@latest init -g cmd/server/main.go -o api/docs --parseDependency --parseInternal

# Development
dev-up:
	-docker network create dokploy-network
	docker compose -f docker-compose.dev.yml up -d --build

dev-infra:
	-docker network create dokploy-network
	docker compose -f docker-compose.dev.yml up -d echo-postgres echo-redis

dev-echo: dev-infra
	bunx concurrently -n "ECHO-BE,ECHO-AGENT,ECHO-WEB" -c "blue.bold,green.bold,yellow.bold" --kill-others \
		"cd backend && go run cmd/server/main.go" \
		"cd agent && bun dev" \
		"cd app/web && bun dev"

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Production
prod-up:
	-docker network create dokploy-network
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Deployment (clean build & deploy)
deploy:
	@echo "Deploying production stack..."
	-docker network create dokploy-network
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
	@echo "Deployment complete. Production containers are running."

# Utilities
status:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

clean:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
	docker system prune -f

# Katara Targets
katara-infra:
	cd app/KataraGnosis && docker compose up -d katara_db katara_redis katara_qdrant katara_garage
	@$(MAKE) katara-garage-init

katara-dev: katara-infra
	bunx concurrently -n "KATARA-BE,KATARA-FE" -c "cyan.bold,magenta.bold" --kill-others \
		"cd app/KataraGnosis/backend && go run cmd/server/main.go" \
		"cd app/KataraGnosis/frontend && bun dev"

katara-backend-build:
	cd app/KataraGnosis/backend && go build ./...

katara-backend-test:
	cd app/KataraGnosis/backend && go test ./...

katara-seed:
	cd app/KataraGnosis/backend && go run ./cmd/seed

katara-frontend-build:
	cd app/KataraGnosis/frontend && bun run build

# Katara Docker Hot-Reload (Volume Mounted)
katara-docker-dev:
	cd app/KataraGnosis && docker compose -f docker-compose.dev.yml up -d --build
	@$(MAKE) katara-garage-init
	@echo "Katara Docker Hot-Reload stack running. Frontend: http://localhost:3002, Backend: http://localhost:8090"

katara-docker-down:
	cd app/KataraGnosis && docker compose -f docker-compose.dev.yml down -v

katara-docker-logs:
	cd app/KataraGnosis && docker compose -f docker-compose.dev.yml logs -f

katara-dev-up: katara-docker-dev

katara-dev-down: katara-docker-down

katara-dev-logs: katara-docker-logs

katara-garage-init:
	@echo "Initializing GarageHQ single-node cluster and bucket..."
	@bash -c 'NODE_ID=$$(docker exec katara_garage /garage status 2>/dev/null | grep -E "^[0-9a-f]{16}" | awk "{print \$$1}" | head -n 1); \
	if [ -n "$$NODE_ID" ]; then \
		docker exec katara_garage /garage layout assign -z garage -c 1G $$NODE_ID; \
		docker exec katara_garage /garage layout apply --version 1; \
		docker exec katara_garage /garage bucket create inquizitive-docs 2>/dev/null || true; \
		docker exec katara_garage /garage key import --yes -n katara-key GK7082bfabda7d6c2f702bd721 81661ba4ae2b57e8b1744ea041d116875c9f899049741d6c454511f6556fa3c2 2>/dev/null || true; \
		docker exec katara_garage /garage bucket allow --read --write --key GK7082bfabda7d6c2f702bd721 inquizitive-docs 2>/dev/null || true; \
		echo "GarageHQ cluster, katara-key, and bucket inquizitive-docs initialized successfully."; \
	fi'

# One-Click Full Stack (Echo + Katara Ecosystem)
dev-all-infra:
	-docker network create dokploy-network
	docker compose -f docker-compose.dev.yml up -d echo-postgres echo-redis
	cd app/KataraGnosis && docker compose up -d katara_db katara_redis katara_qdrant katara_garage
	@$(MAKE) katara-garage-init

dev-all: dev-all-infra
	bunx concurrently -n "ECHO-BE,ECHO-AGENT,ECHO-WEB,KATARA-BE,KATARA-FE" -c "blue.bold,green.bold,yellow.bold,cyan.bold,magenta.bold" --kill-others \
		"cd backend && go run cmd/server/main.go" \
		"cd agent && bun dev" \
		"cd app/web && bun dev" \
		"cd app/KataraGnosis/backend && go run cmd/server/main.go" \
		"cd app/KataraGnosis/frontend && bun dev"

dev-all-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	cd app/KataraGnosis && docker compose down -v
