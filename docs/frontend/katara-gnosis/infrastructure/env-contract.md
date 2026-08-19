================================================================================
  KataraGnosis Environment Contract
================================================================================
  Module    : Env Contract
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

All KataraGnosis env vars are declared in backend/internal/config/config.go
(Load) with sane dev defaults, documented in backend/.env.example and in
docker-compose.yml environment blocks. Secrets are NEVER committed.

Backend (Go) Variables
----------------------

+--------------------------+---------------------------+----------------------+
| Var                      | Default                   | Notes                |
+--------------------------+---------------------------+----------------------+
| QDRANT_URL               | http://localhost:6334     | gRPC endpoint.       |
| GARAGE_ENDPOINT          | http://localhost:3900     | S3 API endpoint.     |
| GARAGE_ACCESS_KEY        | (empty)                   | Set via make         |
|                          |                           | katara-garage-init.  |
| GARAGE_SECRET_KEY        | (empty)                   | Secret.              |
| GARAGE_BUCKET            | inquizitive-docs          |                      |
| EMBEDDING_PROVIDER       | gemini                    | gemini |             |
|                          |                           | openai-compatible.   |
| EMBEDDING_BASE_URL       | (empty)                   | Required for         |
|                          |                           | openai-compatible.   |
| EMBEDDING_API_KEY        | (empty)                   | Secret; gemini key.  |
| EMBEDDING_MODEL          | gemini-embedding-001      |                      |
| KATARA_TIMEZONE          | Asia/Jakarta              | SRS date boundaries, |
|                          |                           | cron scheduling.     |
| KATARA_SESSION_SIZE      | 10                        | Daily drill size.    |
| KATARA_TARGET_QUESTIONS  | 6                         | Daily target.        |
| KATARA_TARGET_SCORE      | 60                        | Score threshold.     |
| KATARA_GRACE_DAYS        | 1                         | Streak grace/week.   |
| WORKER_INTERVAL          | 15m                       | Existing worker;     |
|                          |                           | Asynq uses its own   |
|                          |                           | schedule + Redis.    |
+--------------------------+---------------------------+----------------------+

Frontend (Next.js) Variables
----------------------------

+--------------------------+---------------------------+----------------------+
| Var                      | Default                   | Notes                |
+--------------------------+---------------------------+----------------------+
| BACKEND_URL              | http://localhost:8080     | Go backend, BFF uses |
|                          |                           | server-side.         |
| NEXT_PUBLIC_API_URL      | (empty)                   | Public-facing base   |
|                          |                           | URL for deployed app |
|                          |                           | (mirrors echo web).  |
+--------------------------+---------------------------+----------------------+

Validation (config.ValidateSecrets extension)
---------------------------------------------

  At startup, backend logs warnings (not fatal) for:
    - QDRANT_URL unset -> katara disabled? NO: fail-hard applies when
      SET but unreachable. If UNSET, katara endpoints return 503 with
      "not configured" (distinct message for diagnostics).

  Fatal at startup when:
    - QDRANT_URL set and Ping fails.
    - GARAGE_ENDPOINT/KEYS set and EnsureBucket fails.
    - EMBEDDING_PROVIDER invalid value.
    - EMBEDDING_PROVIDER=openai-compatible and EMBEDDING_MODEL empty.

Secrets Policy
--------------

  - GARAGE_SECRET_KEY, EMBEDDING_API_KEY: env only, never in code or
    committed .env files (root .gitignore already excludes .env).
  - Docker compose: pass via ${VAR} substitution from the shell.

Local Dev Flow
--------------

  cp backend/.env.example backend/.env   # then fill GARAGE_* /
  EMBEDDING_*
  docker compose up -d qdrant garage redis postgres
  make katara-garage-init                # idempotent bucket + key
  bun --cwd frontend/KataraGnosis dev     # port 3002

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
