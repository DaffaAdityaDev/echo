================================================================================
  Database - PostgreSQL & Redis Infrastructure
================================================================================
  Module    : Database Infrastructure
  Service   : backend
  Version   : 1.1
  Updated   : 2026-08-05 (schema.go auto-migration, reference-only 001-010)
================================================================================

Overview
--------

The backend defines two data stores: PostgreSQL (via pgx connection pool) and
Redis for caching and PubSub (SaaS mode streaming). PostgreSQL is the single
source of truth for all persistent data including API keys, sessions, messages,
and user accounts. Redis is used as a pure cache layer (features, skills,
episodic memory with TTL). All stateful data has been migrated to PostgreSQL
for a fully stateless architecture.

## CLI Commands

### Run Migrations

```bash
cd backend

# Standalone migration (creates/updates tables without starting server)
DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
go run ./cmd/db/migrate

# Server auto-migrates on startup (SetupRoutes → database.Migrate(pool)),
# so the standalone CLI is optional — but recommended for explicit control.
go run ./cmd/server
```

### Seed Default Users

```bash
cd backend

DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
go run ./cmd/db/seed
```

**Safe mode (default, no flags):** only ensures the default admin user exists
(created if missing). Never truncates or writes fake data — safe to run in any
environment, including the `echo-seed` compose service.

Seed data (password overridable via `ADMIN_PASSWORD`, default `root`):

| Email            | Password | Name    | Role    |
|------------------|----------|---------|---------|
| admin@gmail.com  | root     | Admin   | admin   |

Edit `cmd/db/seed/main.go` to add more users.

### Load Test Seeding (Development Only)

```bash
cd backend

# TRUNCATES all sessions/messages, then seeds:
#   - 1 stress session "🔥 Stress Test Session (1M Context)" — 10 turns (20
#     messages) of ~4 MB / ~1M tokens each, for frontend render + pagination tests
#   - 50 bulk sessions (1,000 realistic long-format messages) for list pagination tests
DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
go run ./cmd/db/seed --load-test
```

Safety guards (hard-coded in `cmd/db/seed/main.go`):

1. Refuses to run when `APP_ENV=production`.
2. Requires an interactive `yes` confirmation before truncating.
3. Docker Compose (`echo-seed`) and Kubernetes never pass `--load-test`, so
   deployment pipelines can never trigger a truncation.

Token counts are EXACT: the seeder calls the agent's
`POST /api/internal/tokenize` (official tiktoken BPE, `o200k_base`) per unique
content, cached in-memory. Falls back to chars/4 with a warning only when the
agent is unreachable.

### Quick Start (First Time)

```bash
docker compose up -d postgres redis

cd backend
DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
  go run ./cmd/db/migrate

DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
  go run ./cmd/db/seed

JWT_SECRET="your-secret-key-min-32-chars!!" \
  DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
  REDIS_ADDR="localhost:6379" \
  go run ./cmd/server
```

## Tables Created by Migrations

| Table              | Purpose                              |
|--------------------|--------------------------------------|
| `users`            | Authentication, roles, profiles      |
| `memory_semantic`  | Vector/generic semantic memory store |
| `memory_procedural`| Procedural knowledge storage         |
| `api_keys`        | API key management (migrated from Redis) |
| `sessions`        | Conversation sessions (+ `strategy_version`, `last_accessed_at` via Migrate()) |
| `messages`        | Canonical per-session history        |
| `user_preferences`| Per-user defaults + harness toggles  |
| `prompt_templates` / `prompt_versions` | LLMOps Studio (20260725_001) |

Migrations are executed by `Migrate()` in `internal/database/schema.go`, which
runs both on server start (via `SetupRoutes`) and via the standalone CLI. It
creates all tables (memory_semantic, memory_procedural, users, sessions,
messages, user_preferences, api_keys, features, app_settings, prompt_templates,
prompt_versions) and applies idempotent `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` statements (strategy_version, last_accessed_at, messages.steps/status,
user_preferences provider fields).

The numbered files under `backend/migrations/` (001-010) are **reference-only**
— they document the schema evolution but are NOT executed at runtime. The
authoritative DDL lives in `schema.go`; the 20260725_001_llmops_studio pair is
the one exception executed as a constant (`schemaLLMOpsStudio`) inside
`Migrate()`. Migration 010 (`010_add_prompt_template_setting`) seeds the
`prompt_template_name` key in `app_settings`.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/database/db.go                  | Connection factories - NewRedisClient(),  |
|                                          |   NewPostgresPool()                        |
| internal/database/schema.go              | DDL constants + Migrate(pool) orchestrator|
| internal/constants/db/postgres.go        | SQL queries & error messages               |
+------------------------------------------+--------------------------------------------+

Infrastructure Architecture
---------------------------

                         ┌──────────────────────────────────────┐
                         │  Backend Data Layer                    │
                         │                                      │
                         │  ┌──────────────────────────────┐    │
                         │  │  PostgreSQL (pgx pool)       │    │
                         │  │  ├─ users, api_keys          │    │
                         │  │  ├─ sessions, messages       │    │
                         │  │  ├─ memory_*                 │    │
                         │  │  └─ user_preferences         │    │
                         │  └────────────┬─────────────────┘    │
                         │               │                      │
                         │  ┌────────────┴─────────────────┐    │
                         │  │  Redis Cache (go-redis)      │    │
                         │  │  ├─ features/skills (10m)    │    │
                         │  │  ├─ episodic memory (24h)    │    │
                         │  │  └─ Pub/Sub (SaaS mode)      │    │
                         │  └──────────────────────────────┘    │
                         └──────────────────────────────────────┘

PostgreSQL Connection - pgx Pool
--------------------------------

  // database/db.go
  func NewPostgresPool(cfg *cfgmodel.Config) *pgxpool.Pool {
      if cfg.DatabaseURL == "" { return nil }

      ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
      defer cancel()

      config, err := pgxpool.ParseConfig(cfg.DatabaseURL)
      // ...
      config.MaxConns = 10
      config.MinConns = 2

      pool, err := pgxpool.NewWithConfig(ctx, config)
      // ping validation (Fatal on error)
      return pool
  }

Pool Configuration
------------------

+------------------+-------+-----------------------------------+
| Setting          | Value | Description                       |
+------------------+-------+-----------------------------------+
| MaxConns         | 10    | Maximum connections in pool       |
| MinConns         | 2     | Minimum idle connections          |
| Connect Timeout  | 5s    | Context timeout for connection    |
+------------------+-------+-----------------------------------+

Connection Lifecycle
--------------------

  START
    │
    ├─ NewPostgresPool(cfg) -> pgxpool.Pool (nil-safe when URL empty)
    ├─ pgxpool.ParseConfig(cfg.DatabaseURL) -> config
    ├─ pgxpool.NewWithConfig(ctx, config) -> pool
    ├─ pool.Ping(ctx) -> validate connectivity
    │
    ├─ Success -> return pool
    └─ Failure -> log.Fatalf (config/pool/ping)

Redis Connection
----------------

  // database/db.go
  func NewRedisClient(cfg *cfgmodel.Config) *redis.Client {
      if cfg.RedisAddr == "" { return nil }   // Redis optional

      rdb := redis.NewClient(&redis.Options{
          Addr:     cfg.RedisAddr,
          Password: cfg.RedisPassword,
          DB:       0,
      })
      return rdb
  }

pgvector Extension
------------------

pgvector is supported on the memory_semantic table. If the vector extension
is available, a 1536-dimension embedding column + IVFFlat index is created.
If unavailable (e.g. local dev without pgvector), the table falls back to
text-only storage.

Migration Strategy
------------------

Migrations run automatically on server start (`SetupRoutes` → `database.Migrate(pool)`)
and can also be run standalone via the CLI. All DDL is idempotent
(`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

  cmd/db/migrate/    # go run ./cmd/db/migrate (standalone)
  cmd/db/seed/       # go run ./cmd/db/seed (seed users)

Migration code:

  internal/database/schema.go
    ├── schemaVector       → memory_semantic (with pgvector, 1536-dim)
    ├── schemaNoVector     → memory_semantic (text only)
    ├── schemaProcedural   → memory_procedural
    ├── schemaUsers        → users
    ├── schemaSessions     → sessions (+ strategy_version, last_accessed_at)
    ├── schemaMessages     → messages (+ steps, status columns)
    ├── schemaUserPreferences → user_preferences (+ provider fields)
    ├── schemaLLMOpsStudio → prompt_templates, prompt_versions
    ├── schemaFeatures     → features
    ├── schemaApiKeys      → api_keys
    └── Migrate(pool)      → orchestrates all table creation

Entry Points & Exports
----------------------

+-------------------------+--------------+------------------------------------+
| Symbol                  | Kind         | Path                               |
+-------------------------+--------------+------------------------------------+
| NewRedisClient(cfg)     | Function     | database/db.go:14                  |
| NewPostgresPool(cfg)    | Function     | database/db.go:28                  |
| Migrate(pool)           | Function     | database/schema.go:158             |
+-------------------------+--------------+------------------------------------+

Dependencies
------------

+-----------------------------------+-------------------------------------------+
| Dependency                        | Used For                                  |
+-----------------------------------+-------------------------------------------+
| github.com/jackc/pgx/v5/pgxpool  | PostgreSQL connection pool                |
| github.com/redis/go-redis/v9     | Redis client                              |
+-----------------------------------+-------------------------------------------+

Source References
-----------------

- internal/database/db.go:14-26 - NewRedisClient
- internal/database/db.go:28-55 - NewPostgresPool (pgx pool factory)
- internal/database/schema.go:11-157 - DDL constants (schemaVector ... schemaApiKeys)
- internal/database/schema.go:158-263 - Migrate(pool) orchestrator
- internal/constants/db/postgres.go - SQL queries & error constants
- internal/router/router.go:44-51 - Server startup auto-migration

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
