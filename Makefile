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
	docker compose -f docker-compose.dev.yml up -d --build

dev-infra:
	docker compose -f docker-compose.dev.yml up -d

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# Production
prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

prod-logs:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Deployment (clean build & deploy)
deploy:
	@echo "Deploying production stack..."
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
