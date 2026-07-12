===============================================================================
  DATABASE SCHEMA — Complete Reference
===============================================================================
  Module    : Database Schema
  Service   : Shared / Contracts
  Version   : 2.0
  Updated   : 2026-07-10 (full audit: existing code + current designs)
===============================================================================

## Description

Complete PostgreSQL schema with pgvector extension + Redis data layout for
Echo's platform. Covers all tables found in source code (`schema.go`,
`init-*.sql`), tables designed for upcoming features (session management),
and legacy planned tables (goals, spaced repetition).

**Status Convention:**
  - `Active` — table exists in code (`CREATE TABLE` in a SQL/migration file)
  - `Draft` — designed but not yet implemented in code
  - `Planned` — legacy design from earlier architecture, not yet implemented

---

## File Structure

+------------------------------------------+---------------------------------------------+
| File                                     | Role                                        |
+------------------------------------------+---------------------------------------------+
| backend/internal/database/schema.go      | Auto-migrate: users, memory_semantic,       |
|                                          |   memory_procedural                         |
| backend/scripts/init-pgvector.sql        | pgvector + tool_catalog table + HNSW index  |
| backend/scripts/init-nuq.sql             | NUQ queue system (4 tables) + pg_cron jobs  |
| backend/internal/database/schema.go      | api_keys table DDL + auto-migration         |
| backend/internal/models/models.go        | ApiKey struct definition                    |
| backend/internal/constants/db/postgres.go| SQL queries (users CRUD)                    |
| backend/internal/database/postgres.go    | pgx pool initialization                     |
| infra/k8s/postgres.yaml                  | K8s with init SQL ConfigMap                 |
+------------------------------------------+---------------------------------------------+

---

## Storage Architecture

```
PostgreSQL                              Redis
┌─────────────────────────┐             ┌─────────────────────────┐
│  users (Active)         │             │  memory:episodic:<sid>  │
│  api_keys (Active)      │             │  features cache (TTL)   │
│  memory_semantic (Active)│            │  skills cache (TTL)     │
│  memory_procedural(Active)│           │  mission state (TTL)    │
│  tool_catalog (Active)  │             │                         │
│  user_preferences (Active)│            └─────────────────────────┘
│  sessions (Active)      │
│  messages (Active)      │
│  goals (Planned)        │
│  skill_nodes (Planned)  │             NUQ (PostgreSQL schema)
│  topics (Planned)       │             ┌─────────────────────────┐
│  cards (Planned)        │             │  queue_scrape (Active)  │
│  missions (Planned)     │             │  queue_scrape_backlog   │
│  answers (Planned)      │             │  queue_crawl_finished   │
└─────────────────────────┘             │  group_crawl (Active)   │
                                        └─────────────────────────┘
```

---

## Column Types & Constraints

### users `[Active — schema.go:39]`

The central user account. Created on registration.

```sql
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL        PRIMARY KEY,
    email         TEXT          UNIQUE NOT NULL,
    password_hash TEXT          NOT NULL,
    name          TEXT          NOT NULL,
    role          TEXT          NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW()
);
```

### memory_semantic `[Active — schema.go:10]`

Long-term semantic memory (knowledge fragments). Supports vector search via
pgvector when available (1536-dim), falls back to content-only search.

```sql
CREATE TABLE IF NOT EXISTS memory_semantic (
    id         TEXT          PRIMARY KEY,
    content    TEXT          NOT NULL,
    embedding  vector(1536),              -- only when pgvector available
    metadata   JSONB         DEFAULT '{}',
    created_at TIMESTAMPTZ   DEFAULT NOW()
);

-- pgvector index (created only if vector extension loaded)
CREATE INDEX IF NOT EXISTS idx_memory_semantic_embedding
ON memory_semantic USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### memory_procedural `[Active — schema.go:28]`

Procedural memory: tool usage patterns, workflows, and step-by-step procedures.
Keyed by id and name for direct lookup.

```sql
CREATE TABLE IF NOT EXISTS memory_procedural (
    id         TEXT          PRIMARY KEY,
    name       TEXT          UNIQUE NOT NULL,
    content    TEXT          NOT NULL,
    metadata   JSONB         DEFAULT '{}',
    created_at TIMESTAMPTZ   DEFAULT NOW(),
    updated_at TIMESTAMPTZ   DEFAULT NOW()
);
```

### tool_catalog `[Active — init-pgvector.sql:5]`

Vector-indexed tool catalog for semantic tool retrieval. Uses 384-dim
embeddings (all-MiniLM-L6-v2) with HNSW index.

```sql
CREATE TABLE IF NOT EXISTS tool_catalog (
    id          SERIAL        PRIMARY KEY,
    name        TEXT          NOT NULL UNIQUE,
    description TEXT,
    schema      JSONB,                     -- OpenAI function-calling schema
    embedding   vector(384)                -- all-MiniLM-L6-v2
);

CREATE INDEX IF NOT EXISTS tool_catalog_hnsw_idx
ON tool_catalog USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### user_preferences `[Active — schema.go:80]`

Per-user default preferences for mode, model, features, and skills. Used
by Settings page and chat initialization.

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id          INTEGER   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_mode     TEXT      DEFAULT 'standard',
    default_model    TEXT      DEFAULT '',
    default_features TEXT[]    DEFAULT '{}',
    default_skills   TEXT[]    DEFAULT '{}',
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### api_keys `[Active — schema.go DDL]`

API key management for admin access. Stored in PostgreSQL for stateless architecture.
Migrated from Redis to PostgreSQL.

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    TEXT          NOT NULL UNIQUE,
    prefix      TEXT          NOT NULL,
    name        TEXT          NOT NULL DEFAULT '',
    scopes      TEXT[]        DEFAULT '{}',
    user_id     TEXT          NOT NULL,
    status      TEXT          NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
```

### sessions `[Active — schema.go:51]`

Conversation session per user. Managed by Go Backend (Session Authority).
See `docs/agent/application/features/state-session/session-management.md`.

```sql
CREATE TABLE sessions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT          DEFAULT '',
    context_summary TEXT,                      -- hard consolidation result (BLOCK 3)
    status          TEXT          DEFAULT 'active'
                                  CHECK (status IN ('active', 'archived', 'deleted')),
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id, updated_at DESC);
```

### messages `[Active — schema.go:65]`

Canonical conversation history per session. Written by Go on `turn_complete`.
Read by Go to build BLOCK 4 (Accumulated History) for LLM requests.

```sql
CREATE TABLE messages (
    id           BIGSERIAL     PRIMARY KEY,
    session_id   UUID          NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role         TEXT          NOT NULL
                               CHECK (role IN ('user', 'assistant', 'system', 'tool_result', 'thought', 'tool_call')),
    content      TEXT          NOT NULL,
    token_count  INTEGER       DEFAULT 0,     -- from LLM response metadata
    turn_number  INTEGER       NOT NULL,       -- sequential per session
    created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- Role semantics:
--   user        — user message (stored in history)
--   assistant   — final assistant response (stored in history)
--   system      — context summary from consolidation (stored in history)
--   tool_result — tool execution result (stripped from LLM context, saved for UI)
--   thought     — reasoning/thinking tokens (stripped from LLM context, saved for UI)
--   tool_call   — tool invocation details (stripped from LLM context, saved for UI)
-- Only user + assistant + system are sent to the LLM on turn resume.

CREATE INDEX idx_messages_session ON messages (session_id, turn_number);
```

---

## Legacy Planned Tables (not yet implemented)

These tables are defined in the original architecture plan (`docs/architecture-plan.md`)
but have no code implementation yet. Included for reference.

### goals `[Planned]`

```sql
CREATE TABLE goals (
    id          SERIAL        PRIMARY KEY,
    user_id     INTEGER       NOT NULL REFERENCES users(id),
    title       TEXT          NOT NULL,
    description TEXT,
    target_date DATE,
    skill_tree  JSONB,                        -- cached DAG snapshot
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

### skill_nodes `[Planned]`

```sql
CREATE TABLE skill_nodes (
    id              SERIAL        PRIMARY KEY,
    goal_id         INTEGER       NOT NULL REFERENCES goals(id),
    name            TEXT          NOT NULL,
    difficulty      TEXT,
    estimated_hours INTEGER,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

### skill_edges `[Planned]`

```sql
CREATE TABLE skill_edges (
    id                SERIAL    PRIMARY KEY,
    parent_node_id    INTEGER   NOT NULL REFERENCES skill_nodes(id),
    child_node_id     INTEGER   NOT NULL REFERENCES skill_nodes(id),
    prerequisite_type TEXT
);
```

### topics `[Planned]`

```sql
CREATE TABLE topics (
    id              SERIAL        PRIMARY KEY,
    user_id         INTEGER       NOT NULL REFERENCES users(id),
    name            TEXT          NOT NULL,
    tag             TEXT,
    difficulty      TEXT,
    estimated_hours INTEGER,
    content_path    TEXT,                      -- path to S3/local content
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

### cards `[Planned]`

Spaced repetition cards (SM-2 algorithm).

```sql
CREATE TABLE cards (
    id          SERIAL        PRIMARY KEY,
    user_id     INTEGER       NOT NULL REFERENCES users(id),
    topic_id    INTEGER       NOT NULL REFERENCES topics(id),
    question    TEXT          NOT NULL,
    answer      TEXT          NOT NULL,
    ef          FLOAT,                         -- Easiness factor (SM-2)
    interval    INTEGER,                       -- Days (SM-2)
    due         TIMESTAMPTZ,                   -- Next review date
    repetitions INTEGER       DEFAULT 0,
    last_score  INTEGER,
    priority    INTEGER       DEFAULT 0,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

### missions `[Planned]`

```sql
CREATE TABLE missions (
    id          SERIAL        PRIMARY KEY,
    user_id     INTEGER       NOT NULL REFERENCES users(id),
    skill_id    INTEGER       REFERENCES skill_nodes(id),
    prompt      TEXT          NOT NULL,
    type        TEXT          NOT NULL CHECK (type IN ('code', 'read', 'build')),
    status      TEXT,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

### answers `[Planned]`

```sql
CREATE TABLE answers (
    id          SERIAL        PRIMARY KEY,
    card_id     INTEGER       NOT NULL REFERENCES cards(id),
    user_id     INTEGER       NOT NULL REFERENCES users(id),
    text        TEXT          NOT NULL,
    score       INTEGER,                      -- LLM evaluation 0-100
    feedback    TEXT,                          -- LLM feedback
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);
```

---

## Redis Data Layout (Non-Relational)

Ephemeral state and cached data are stored in Redis with TTL.

### Episodic Memory `[Active — memory_handler.go]`

```redis
memory:episodic:<session_id>  → List of JSON blobs    # LPUSH / LRANGE
TTL: 24 hours
```

---

## NUQ Queue System (Web Scraping Pipeline) `[Active — init-nuq.sql]`

**NUQ = Notified Unified Queue.** PostgreSQL-based job queue for web scraping
and crawl management. Uses pg_cron for maintenance, LISTEN/NOTIFY for worker
communication, and aggressive autovacuum tuning.

### Custom Enums

```sql
CREATE TYPE nuq.job_status AS ENUM ('queued', 'active', 'completed', 'failed');
CREATE TYPE nuq.group_status AS ENUM ('active', 'completed', 'cancelled');
```

### queue_scrape `[Active — init-nuq.sql:48]`

Main job queue. Holds individual scrape jobs. Partial indexes for queued,
active, failed, and completed states. Group-aware via `group_id`.

```sql
CREATE TABLE IF NOT EXISTS nuq.queue_scrape (
    id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    status            nuq.job_status  NOT NULL DEFAULT 'queued',
    data              JSONB,
    priority          INT       NOT NULL DEFAULT 0,
    lock              UUID,                     -- worker lock
    locked_at         TIMESTAMPTZ,
    stalls            INTEGER,                  -- retry counter (max 9)
    finished_at       TIMESTAMPTZ,
    listen_channel_id TEXT,                     -- for RabbitMQ listenable jobs
    returnvalue       JSONB,                    -- self-host only
    failedreason      TEXT,                     -- self-host only
    owner_id          UUID,
    group_id          UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Autovacuum tuning (high-write table)
ALTER TABLE nuq.queue_scrape SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_vacuum_cost_limit = 10000,
    autovacuum_vacuum_cost_delay = 0
);
```

**Indexes (11 partial indexes — see `init-nuq.sql:72-100`):**
  - `queue_scrape_active_locked_at_idx` — WHERE status = 'active'
  - `nuq_queue_scrape_queued_optimal_2_idx` — WHERE status = 'queued'
  - `nuq_queue_scrape_failed_created_at_idx` — WHERE status = 'failed'
  - `nuq_queue_scrape_completed_standalone_created_at_idx` — WHERE status = 'completed' AND group_id IS NULL
  - `nuq_queue_scrape_failed_standalone_created_at_idx` — WHERE status = 'failed' AND group_id IS NULL
  - `nuq_queue_scrape_group_id_idx` — WHERE group_id IS NOT NULL
  - `nuq_queue_scrape_group_owner_mode_idx` — WHERE mode = 'single_urls'
  - `nuq_queue_scrape_group_mode_status_idx` — WHERE mode = 'single_urls'
  - `nuq_queue_scrape_group_completed_listing_idx` — WHERE status = 'completed' AND mode = 'single_urls'
  - `idx_queue_scrape_group_status` — WHERE status IN ('active', 'queued')
  - Plus full table reindex cadence via pg_cron (16 staggered schedules)

### queue_scrape_backlog `[Active — init-nuq.sql:102]`

Delayed/timed-out jobs pending retry.

```sql
CREATE TABLE IF NOT EXISTS nuq.queue_scrape_backlog (
    id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    data              JSONB,
    owner_id          UUID,
    group_id          UUID,
    priority          INT       NOT NULL DEFAULT 0,
    times_out_at      TIMESTAMPTZ,
    listen_channel_id TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:** owner_id, group_id (mode), times_out_at, group_id lookup.

### queue_crawl_finished `[Active — init-nuq.sql:184]`

Completed crawl results, inserted automatically when a group_crawl finishes.

```sql
CREATE TABLE IF NOT EXISTS nuq.queue_crawl_finished (
    id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    status            nuq.job_status  NOT NULL DEFAULT 'queued',
    data              JSONB,
    priority          INT       NOT NULL DEFAULT 0,
    lock              UUID,
    locked_at         TIMESTAMPTZ,
    stalls            INTEGER,
    finished_at       TIMESTAMPTZ,
    listen_channel_id TEXT,
    returnvalue       JSONB,
    failedreason      TEXT,
    owner_id          UUID,
    group_id          UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same autovacuum tuning as queue_scrape
```

**Indexes:** 7 partial indexes mirroring queue_scrape pattern + group_id.

### group_crawl `[Active — init-nuq.sql:249]`

Groups multiple scrape jobs into a single crawl session. Auto-finishes when
all child jobs complete.

```sql
CREATE TABLE IF NOT EXISTS nuq.group_crawl (
    id         UUID            PRIMARY KEY,
    status     nuq.group_status NOT NULL DEFAULT 'active',
    owner_id   UUID            NOT NULL,
    ttl        BIGINT          NOT NULL DEFAULT 86400000,   -- ms
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

**Indexes:** status (active), expires_at (completed).

### pg_cron Maintenance Jobs

```
Job                               Interval     Description
───────────────────────────────── ──────────── ─────────────────────────────────
nuq_queue_scrape_clean_completed  */5 min      DELETE completed rows >1h
nuq_queue_scrape_clean_failed     */5 min      DELETE failed rows >6h
nuq_queue_scrape_lock_reaper      15 sec       Release stale locks, max 9 stalls
nuq_queue_scrape_backlog_reaper   * * * * *    DELETE expired backlog entries
nuq_queue_crawl_finished_clean    */5 min      Same as queue_scrape pattern
nuq_queue_crawl_finished_lock    15 sec        Same as queue_scrape pattern
nuq_group_crawl_finished         15 sec        Auto-finish groups with no active jobs
nuq_group_crawl_clean            * * * * *     Batched cleanup (500/victim, SKIP LOCKED)
nuq_maintenance_watchdog         * * * * *     Cancel REINDEX running >18 min
nuq_reindex_* (16 schedules)     02:00-10:20   Staggered per-index REINDEX CONCURRENTLY
cron_job_run_details_prune       0 * * * *     DELETE pg_cron logs >24h
```

---

## Index Summary

### PostgreSQL (Application Tables)

| Table | Index | Type | Status |
|-------|-------|------|--------|
| memory_semantic | `idx_memory_semantic_embedding` | ivfflat (vector_cosine_ops) | Active |
| tool_catalog | `tool_catalog_hnsw_idx` | hnsw (vector_cosine_ops) | Active |
| sessions | `idx_sessions_user_id` | btree (user_id, updated_at DESC) | Active |
| messages | `idx_messages_session` | btree (session_id, turn_number) | Active |
| api_keys | `idx_api_keys_user_id` | btree (user_id) | Active |
| api_keys | `idx_api_keys_key_hash` | btree (key_hash) | Active |

### NUQ (Scrape Pipeline)

| Table | Index Count | Type |
|-------|-------------|------|
| queue_scrape | 11 | Partial btree |
| queue_scrape_backlog | 4 | btree |
| queue_crawl_finished | 7 | Partial btree |
| group_crawl | 2 | Partial btree |

---

## Migration Strategy

- **Tool**: Auto-migration via `backend/internal/database/schema.go:Migrate()` at
  startup. Creates users, memory_semantic, memory_procedural with best-effort
  pgvector support.
- **Vector extension**: `CREATE EXTENSION IF NOT EXISTS vector` attempted before
  memory_semantic creation. Falls back to content-only if unavailable.
- **Init scripts**: `init-pgvector.sql` and `init-nuq.sql` mounted to PostgreSQL
  init directory for Docker/K8s.
- **Sessions + Messages + User Preferences**: Created at startup via
  `schema.go:Migrate()`. Raw SQL migrations also exist in `backend/migrations/`
  for reference and manual use.
- **K8s**: ConfigMap with init SQL mounted to `/docker-entrypoint-initdb.d/`.
- **Development**: Docker Compose mounts init scripts directly.

---

## Entry Points & Exports

- **Auto-migration**: `backend/internal/database/schema.go` — `Migrate()`
- **Init scripts**: `backend/scripts/init-pgvector.sql`, `backend/scripts/init-nuq.sql`
- **Go models**: `backend/internal/models/models.go`
- **SQL constants**: `backend/internal/constants/db/postgres.go`
- **DB connection**: `backend/internal/database/postgres.go`

---

## Source References

+------------------------------------------------+-----------+-----------------------------------+
| File                                           | Lines     | Role                              |
+------------------------------------------------+-----------+-----------------------------------+
| backend/internal/database/schema.go            | 9-53      | users, memory_semantic,           |
|                                                |           | memory_procedural, user_preferences DDL |
| backend/internal/database/postgres.go          | 1-48      | pgx pool + Migrate() call         |
| backend/scripts/init-pgvector.sql              | 1-16      | tool_catalog DDL + HNSW index     |
| backend/scripts/init-nuq.sql                   | 1-332     | NUQ: 4 tables, 30+ indexes,       |
|                                                |           | enums, pg_cron jobs               |
| backend/internal/database/schema.go            | (api_keys DDL) | API key PostgreSQL storage        |
| backend/internal/handler/memory_handler.go     | 34-131    | Episodic (Redis) storage          |
| backend/internal/models/models.go              | 65-73     | ApiKey struct definition          |
| docs/agent/application/features/state-session/ |           | sessions + messages table design  |
|   session-management.md                        |           |                                   |
| docs/architecture-plan.md                      |           | Legacy planned table definitions  |
+------------------------------------------------+-----------+-----------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
