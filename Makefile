.PHONY: dev-up dev-down dev-logs prod-up prod-down prod-logs deploy clean status swagger-gen help

# Default target
.DEFAULT_GOAL := help

help:
	@echo "======================================================================="
	@echo "                     ECHO APP BUILD & DEPLOYMENT SYSTEM"
	@echo "======================================================================="
	@echo "Development Stack:"
	@echo "  make dev-up       - Start the development stack (with hot-reloading)"
	@echo "  make dev-infra    - Start infrastructure only (postgres + redis)"
	@echo "  make dev-down     - Stop the development stack and remove volumes"
	@echo "  make dev-logs     - Follow development stack logs"
	@echo ""
	@echo "Production Stack:"
	@echo "  make prod-up      - Start the production stack (pre-built assets)"
	@echo "  make prod-down    - Stop the production stack and remove volumes"
	@echo "  make prod-logs    - Follow production stack logs"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy       - Execute a clean build and start production stack"
	@echo ""
	@echo "Documentation:"
	@echo "  make swagger-gen  - Generate backend Swaggo OpenAPI spec"
	@echo ""
	@echo "Utility:"
	@echo "  make status       - Check status of all containers"
	@echo "  make clean        - Stop stacks and prune unused docker resources"
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
	docker compose -f docker-compose.dev.yml up -d

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Production
prod-up:
	-docker network create dokploy-network
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

prod-logs:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Deployment (clean build & deploy)
deploy:
	@echo "Deploying production stack..."
	-docker network create dokploy-network
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@echo "Deployment complete. Production containers are running."

# Utilities
status:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

clean:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
	docker system prune -f

# Katara Targets
katara-backend-build:
	cd app/KataraGnosis/backend && go build ./...

katara-backend-test:
	cd app/KataraGnosis/backend && go test ./...

katara-frontend-build:
	cd app/KataraGnosis/frontend && bun run build

katara-dev-up:
	cd app/KataraGnosis && docker compose up -d --build

katara-dev-down:
	cd app/KataraGnosis && docker compose down -v

katara-dev-logs:
	cd app/KataraGnosis && docker compose logs -f

katara-garage-init:
	@echo "Initializing GarageHQ single-node cluster and bucket..."
	@bash -c 'NODE_ID=$$(docker exec katara_garage /garage status 2>/dev/null | grep -E "^[0-9a-f]{16}" | awk "{print \$$1}" | head -n 1); \
	if [ -n "$$NODE_ID" ]; then \
		docker exec katara_garage /garage layout assign -z garage -c 1G $$NODE_ID; \
		docker exec katara_garage /garage layout apply --version 1; \
		docker exec katara_garage /garage bucket create inquizitive-docs 2>/dev/null || true; \
		docker exec katara_garage /garage key create katara-key 2>/dev/null || true; \
		docker exec katara_garage /garage bucket allow --read --write --key katara-key inquizitive-docs 2>/dev/null || true; \
		echo "GarageHQ cluster, katara-key, and bucket inquizitive-docs initialized successfully."; \
	fi'
