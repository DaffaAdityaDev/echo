# KataraGnosis Docker Compose Setup

> Multi-container setup for running KataraGnosis backend, frontend, and dedicated infrastructure (`app/KataraGnosis/docker-compose.yml`).

---

## 1. Services Architecture

```yaml
services:
  katara_db:
    image: postgres:16-alpine
    container_name: katara_db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgresPassword123
      POSTGRES_DB: katara_db
    ports:
      - "5433:5432"
    volumes:
      - katara_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d katara_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  katara_redis:
    image: redis:7-alpine
    container_name: katara_redis
    ports:
      - "6380:6379"
    volumes:
      - katara_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  katara_qdrant:
    image: qdrant/qdrant:v1.13.0
    container_name: katara_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - katara_qdrant_data:/qdrant/storage
    healthcheck:
      test: ["CMD-SHELL", "bash -c '</dev/tcp/localhost/6333'"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  katara_garage:
    image: dxflrs/garage:v1.1.0
    container_name: katara_garage
    ports:
      - "3900:3900"
      - "3903:3903"
    volumes:
      - ./infra/garage/garage.toml:/etc/garage.toml:ro
      - katara_garage_data:/var/lib/garage
    restart: unless-stopped

  katara_backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: katara_backend
    ports:
      - "8090:8090"
    environment:
      PORT: 8090
      DATABASE_URL: postgres://postgres:postgresPassword123@katara_db:5432/katara_db?sslmode=disable
      JWT_SECRET: ${KATARA_JWT_SECRET:-katara-development-super-secret-jwt-key-2026}
      REDIS_URL: redis://katara_redis:6379/1
      QDRANT_URL: http://katara_qdrant:6333
      GARAGE_ENDPOINT: http://katara_garage:3900
      GARAGE_REGION: garage
      GARAGE_ACCESS_KEY: ${GARAGE_ACCESS_KEY:-garage-access-key}
      GARAGE_SECRET_KEY: ${GARAGE_SECRET_KEY:-garage-secret-key}
      GARAGE_BUCKET: inquizitive-docs
      EMBEDDING_PROVIDER: ${EMBEDDING_PROVIDER:-gemini}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OLLAMA_ENDPOINT: ${OLLAMA_ENDPOINT:-http://host.docker.internal:11434}
      KATARA_SESSION_SIZE: 10
      KATARA_TARGET_DAILY_QUESTIONS: 6
      KATARA_TARGET_SCORE_THRESHOLD: 60.0
      KATARA_GRACE_DAYS_PER_WEEK: 1
    depends_on:
      katara_db:
        condition: service_healthy
      katara_redis:
        condition: service_healthy
      katara_qdrant:
        condition: service_started
      katara_garage:
        condition: service_started
    restart: unless-stopped

  katara_frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: katara_frontend
    ports:
      - "3002:3002"
    environment:
      PORT: 3002
      BACKEND_URL: http://katara_backend:8090
    depends_on:
      - katara_backend
    restart: unless-stopped

volumes:
  katara_db_data:
  katara_redis_data:
  katara_qdrant_data:
  katara_garage_data:
```
