================================================================================
  Database - PostgreSQL & Redis Infrastructure
================================================================================
  Module    : Database Infrastructure
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
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

# Server does NOT auto-migrate. Run migrate separately first.
go run ./cmd/server
```

### Seed Default Users

```bash
cd backend

DATABASE_URL="postgres://user:password@localhost:5432/echo_db?sslmode=disable" \
go run ./cmd/db/seed
```

Seed data:
| Email            | Password | Name    | Role    |
|------------------|----------|---------|---------|
| admin@gmail.com  | root     | Admin   | admin   |

Edit `cmd/db/seed/main.go` to add more users.

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

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/database/db.go                  | Infrastructure struct - Redis client       |
| internal/database/postgres.go            | pgx pool factory - Connect()               |
| internal/constants/db/postgres.go        | SQL queries & error messages               |
| internal/models/models.go                | DB wrapper struct, User model              |
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

  // database/postgres.go
  func Connect(connString string) (*models.DB, error) {
      ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
      defer cancel()

      config, err := pgxpool.ParseConfig(connString)
      // ...
      config.MaxConns = 10
      config.MinConns = 2

      pool, err := pgxpool.NewWithConfig(ctx, config)
      // ping validation
      return &models.DB{Pool: pool}, nil
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
    ├─ pgxpool.ParseConfig(connString) -> config
    ├─ pgxpool.NewWithConfig(ctx, config) -> pool
    ├─ pool.Ping(ctx) -> validate connectivity
    │
    ├─ Success -> return &models.DB{Pool: pool}
    └─ Failure -> return error (config/pool/ping)
          │
          └─ Shutdown: db.Pool.Close()

Redis Connection
----------------

  // database/db.go
  func NewInfrastructure(cfg *models.Config) *Infrastructure {
      infra := &Infrastructure{}

      if cfg.RedisAddr != "" {
          infra.Redis = redis.NewClient(&redis.Options{
              Addr:     cfg.RedisAddr,
              Password: cfg.RedisPassword,
              DB:       0,
          })
      }
      return infra
  }

pgvector Extension
------------------

pgvector is supported on the memory_semantic table. If the vector extension
is available, a 1536-dimension embedding column + IVFFlat index is created.
If unavailable (e.g. local dev without pgvector), the table falls back to
text-only storage.

Migration Strategy
------------------

Migrations are run via the standalone CLI only — they do NOT execute on
server start. Raw SQL constants are defined in schema.go:

  cmd/db/migrate/    # go run ./cmd/db/migrate (standalone)
  cmd/db/seed/       # go run ./cmd/db/seed (seed users)

Migration code:

  internal/database/schema.go
    ├── schemaUsers        → CREATE TABLE users
    ├── schemaVector       → memory_semantic (with pgvector)
    ├── schemaNoVector     → memory_semantic (text only)
    ├── schemaProcedural   → memory_procedural
    └── Migrate(infra)     → orchestrates all table creation

Entry Points & Exports
----------------------

+-------------------------+--------------+------------------------------------+
| Symbol                  | Kind         | Path                               |
+-------------------------+--------------+------------------------------------+
| Infrastructure         | Struct       | database/db.go:11                  |
| NewInfrastructure(cfg) | Constructor  | database/db.go:16                  |
| Connect(connString)    | Function     | database/postgres.go:14            |
| Migrate(infra)         | Function     | database/schema.go:46              |
| DB                      | Struct       | models/models.go:56               |
| DB.Close()              | Method       | models/models.go:60               |
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

- internal/database/db.go - Infrastructure struct
- internal/database/postgres.go - pgx pool connection factory
- internal/constants/db/postgres.go - SQL queries & error constants
- internal/models/models.go:56-62 - DB struct wrapper

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
