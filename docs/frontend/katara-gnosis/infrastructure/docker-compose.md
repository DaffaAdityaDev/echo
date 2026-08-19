================================================================================
  KataraGnosis Docker Compose
================================================================================
  Module    : Docker Compose
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The root docker-compose.yml gains Qdrant and GarageHQ services and drops
the unused Chroma service (ADR on infra replacement — no code references
chromadb; agent CHROMA_URL env is removed).

Changes to docker-compose.yml
-----------------------------

### Remove

  - chroma service block
  - chroma_data volume

### Add: qdrant

  qdrant:
    image: qdrant/qdrant:v1.15.0        # pinned minor
    container_name: echo_qdrant
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
    ports:
      - "6333:6333"                     # REST
      - "6334:6334"                     # gRPC (backend client)
    volumes:
      - qdrant_data:/qdrant/storage
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:6333/healthz >/dev/null || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks: [dokploy-network]

### Add: garage

  garage:
    image: dxflrs/garage:v1.1.0          # pinned minor
    container_name: echo_garage
    command: ["server"]                 # entrypoint binary + subcommand
    environment:
      - RUST_LOG=${GARAGE_LOG_LEVEL:-info}
      - GARAGE_RPC_SECRET=${GARAGE_RPC_SECRET:-<random-32-hex>}
      - GARAGE_ADMIN_TOKEN=${GARAGE_ADMIN_TOKEN:-<random-32-hex>}
    volumes:
      - ./infra/garage/garage.toml:/etc/garage/garage.toml:ro
      - garage_data:/var/lib/garage
    ports:
      - "3900:3900"                     # S3 API
      - "3903:3903"                     # admin API (CLI)
    healthcheck:
      test: ["CMD-SHELL", "garage status >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 12
    restart: unless-stopped
    networks: [dokploy-network]

  garage.toml (infra/garage/garage.toml):

    metadata_dir = "/var/lib/garage/meta"
    data_dir     = "/var/lib/garage/data"
    replication_factor = 1
    rpc_bind_addr = "[::]:3901"
    rpc_secret = "${GARAGE_RPC_SECRET}"
    [s3_api]
      s3_region = "us-east-1"
      api_bind_addr = "[::]:3900"
      root_domain = ".s3.localhost"
    [admin]
      api_bind_addr = "[::]:3903"
      admin_token = "${GARAGE_ADMIN_TOKEN}"
    [db_engine]
      type = "lmdb"

### Volumes

  qdrant_data:
  garage_data:

### Backend env additions (echo-backend service)

  - QDRANT_URL=${QDRANT_URL:-http://qdrant:6334}
  - GARAGE_ENDPOINT=${GARAGE_ENDPOINT:-http://garage:3900}
  - GARAGE_ACCESS_KEY=${GARAGE_ACCESS_KEY:-}
  - GARAGE_SECRET_KEY=${GARAGE_SECRET_KEY:-}
  - GARAGE_BUCKET=${GARAGE_BUCKET:-inquizitive-docs}
  - EMBEDDING_PROVIDER=${EMBEDDING_PROVIDER:-gemini}
  - EMBEDDING_BASE_URL=${EMBEDDING_BASE_URL:-}
  - EMBEDDING_API_KEY=${EMBEDDING_API_KEY:-}
  - EMBEDDING_MODEL=${EMBEDDING_MODEL:-gemini-embedding-001}
  - KATARA_TIMEZONE=${KATARA_TIMEZONE:-Asia/Jakarta}

  depends_on: qdrant + garage (condition: service_healthy) added to
  echo-backend.

### Agent env

  - Remove CHROMA_URL (unused). Agent untouched otherwise in v1.

Ports Summary (local dev)
-------------------------

+----------------------+---------+--------------------------------------------+
| Service              | Port    | Used by                                    |
+----------------------+---------+--------------------------------------------+
| KataraGnosis (Next)  | 3002    | Browser (BFF -> backend 8080)              |
| Echo web (Next)      | 3000    | Existing app (unchanged)                   |
| Echo backend (Go)    | 8080    | BFF proxy                                  |
| Qdrant REST          | 6333    | Debug/curl                                |
| Qdrant gRPC          | 6334    | Backend go-client                          |
| Garage S3 API        | 3900    | Backend minio-go, local S3 tooling         |
| Garage admin         | 3903    | garage CLI (make target)                   |
| Redis                | 6379    | Asynq + caches                             |
| Postgres             | 5432    | Backend                                   |
+----------------------+---------+--------------------------------------------+

Local Dev Without Docker
------------------------

  - Qdrant binary (cargo install or release download), Garage release
    binary — both documented in their upstream READMEs; env points to
    localhost ports. Not required for the primary dev loop (docker).

Kubernetes (infra/k8s)
----------------------

  - infra/k8s/chroma.yaml is legacy and scheduled for replacement by
    qdrant.yaml + garage.yaml (P4 follow-up; out of v1 scope).
  - dokploy-network remains the external network (unchanged).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
