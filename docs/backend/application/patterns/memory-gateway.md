================================================================================
  Memory Gateway - Agent Memory Backend
================================================================================
  Module    : Memory Gateway
  Service   : backend
  Version   : 1.2
  Updated   : 2026-10-19 (memory scoped to the session owner)
================================================================================

Overview
--------

The Memory Gateway is a set of endpoints on the Echo backend that serve as the
agent's sole interface for memory read/write operations. The agent (Hono) never
accesses Redis or Postgres directly — all persistence goes through the backend
API, protected by a Service JWT.

This architecture ensures the agent remains stateless, avoids database
credentials, and centralizes data access control in one place.

Why Agent Cannot Hit the Database Directly
------------------------------------------

+-------------------------+-----------------------------------------------------+
| Concern                 | Rationale                                           |
+-------------------------+-----------------------------------------------------+
| Security                | Agent runs in a different trust domain. Backend     |
|                         | owns all DB credentials. Agent never sees them.     |
+-------------------------+-----------------------------------------------------+
| Statelessness           | Agent has no DB driver, no connection pools, no     |
|                         | migrations. Deploy/replace agent without DB changes.|
+-------------------------+-----------------------------------------------------+
| Separation of Concerns | Backend owns data access patterns (query optimization|
|                         | connection pooling, retries). Agent owns routing.   |
+-------------------------+-----------------------------------------------------+
| Auditing                | All memory operations logged at a single choke      |
|                         | point. Centralized observability.                   |
+-------------------------+-----------------------------------------------------+
| Future-proofing         | Adding a new storage backend requires zero agent    |
|                         | changes — only a new backend endpoint.              |
+-------------------------+-----------------------------------------------------+

Architecture Flow
-----------------

  Agent (TS agent service)
       │
       │  POST /api/v1/internal/memory/episodic/store
       │  Authorization: Bearer <Service JWT>
       │  Body: { "session_id": "...", "content": "..." }
       │
       ▼
  ┌───────────────────────────────────────────────────┐
  │  Backend (Fiber)                                   │
  │                                                     │
  │  ┌──────────────────────────────────────────────┐  │
  │  │  1. InternalAuthRequired middleware           │  │
  │  │     - Verify JWT signature (SERVICE_JWT_SECRET)│  │
  │  │     - Check sub == "agent"                    │  │
  │  └──────────────────┬───────────────────────────┘  │
  │                     │                              │
  │  ┌──────────────────▼───────────────────────────┐  │
  │  │  2. Route handler                             │  │
  │  │     - Parse body                              │  │
  │  │     - Resolve owner: sessions.user_id         │  │
  │  │       for session_id (404 if unknown/deleted) │  │
  │  │     - Read/write store scoped to that owner   │  │
  │  └──────────────────┬───────────────────────────┘  │
  │                     │                              │
  │  ┌──────────────────▼───────────────────────────┐  │
  │  │  3. Data layer                                │  │
  │  │     Episodic ──► Redis (list per owner+session)│  │
  │  │     Semantic ──► Postgres (text/vector)       │  │
  │  │     Procedural ──► Postgres (structured)      │  │
  │  └──────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────┘
       │
       │  201 Created { "id": "mem_xxx", "status": "stored" }
       ▼
  Agent confirms write

Three Memory Types
------------------

+------------+------------------+-------------------+----------------------------+
| Type       | Backend Storage  | Data Model        | Example Use Case           |
+------------+------------------+-------------------+----------------------------+
| Episodic   | Redis            | TTL-expiring KV   | Recent conversation turns, |
|            |                  | with session_id   | agent actions, logs        |
+------------+------------------+-------------------+----------------------------+
| Semantic   | pgvector         | Embedding vectors  | Long-term knowledge,       |
|            | (PostgreSQL)     | + metadata + text | facts, search results      |
+------------+------------------+-------------------+----------------------------+
| Procedural | PostgreSQL       | Structured tables | Agent state, step outcomes,|
|            |                  | with schemas      | task execution records     |
+------------+------------------+-------------------+----------------------------+

Ownership & Isolation
---------------------

Every memory request carries the `session_id` of the chat session the agent is
running. The backend never accepts an owner from the request body: it resolves
the owning `user_id` from the `sessions` table and scopes every read and write
by it. A model that is prompt-injected into sending a different value can at
most name a session id, and only sessions the backend knows map to an owner.

+-----------------------------+------------------------------------------------+
| Case                        | Behaviour                                      |
+-----------------------------+------------------------------------------------+
| session_id missing          | 400                                            |
| session_id unknown,         | 404 "Session not found" (before any store is   |
| malformed or deleted        | touched)                                       |
| Episodic key                | memory:episodic:{user_id}:{session_id}[:{slot}]|
| Semantic / procedural rows  | user_id column; reads filter user_id = owner   |
| Rows written before scoping | user_id IS NULL — orphaned, never returned     |
| Semantic id owned by another| 409 (upsert only overwrites the owner's row)   |
| user                        |                                                |
| Procedural name             | unique per user (user_id, name)                |
+-----------------------------+------------------------------------------------+

`slot` (episodic only, optional, `^[A-Za-z0-9_.:-]{1,128}$`) names a separate
list inside the session; the agent uses `paused:<approvalId>` for HITL pause
state. Because the key always embeds the owner and the session UUID, a slot
cannot reach another session's list.

Endpoint Reference
------------------

All memory routes are POST-only, registered under the internal group
(`/api/v1/internal/memory/...`) with action suffixes (`/store`, `/recall`,
`/search`, `/get`). Every route requires the Service JWT.

### Episodic Memory

  POST /api/v1/internal/memory/episodic/store
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id":  "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "slot":        "paused:appr_1", // optional
      "content":     { ... },        // opaque JSON payload
      "metadata":    { ... },        // optional
      "ttl_seconds": 86400           // optional, default 24h
  }

  Response (201):
  {
      "id":     "mem_ep_9f3a",
      "status": "stored"
  }

  POST /api/v1/internal/memory/episodic/recall
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "slot":       "paused:appr_1", // optional
      "limit":      20               // optional, default 50
  }

  Response (200):
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "entries": [
          { "content": {...}, "timestamp": "2026-07-09T12:00:00Z" }
      ],
      "total": 42
  }

### Semantic Memory

  POST /api/v1/internal/memory/semantic/store
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "id":         "mem_sm_b4c2",
      "content":    "The user prefers dark mode in all applications",
      "embedding":  [0.012, -0.034, ...],   // optional
      "metadata":   { "source": "conversation" }
  }

  Response (201):
  {
      "id":     "mem_sm_b4c2",
      "status": "indexed"
  }

  POST /api/v1/internal/memory/semantic/search
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "query":      "user preference dark mode",
      "limit":      5,               // optional, default 10
      "embedding":  [ ... ],         // accepted but unused
      "threshold":  0.7              // accepted but unused
  }

  Response (200):
  {
      "results": [
          {
              "id":         "mem_sm_b4c2",
              "content":    "The user prefers dark mode in all applications",
              "metadata":   { "source": "conversation" },
              "created_at": "2026-07-09T12:00:00Z"
          }
      ]
  }

  Note: search is an ILIKE substring match on `content`, restricted to the
  session owner's rows (`user_id = owner`). The embedding and
  threshold fields exist in the schema but are not used by the current
  implementation.

### Procedural Memory

  POST /api/v1/internal/memory/procedural/store
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "id":        "mem_pr_d1e6",
      "name":      "execute_sql",
      "content":   "SELECT * FROM users",
      "metadata":  { "step_id": "step_42" }     // optional
  }

  Response (201):
  {
      "id":     "mem_pr_d1e6",
      "status": "recorded"
  }

  POST /api/v1/internal/memory/procedural/get
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12",
      "name": "execute_sql"          // or "id"
  }

  Response (200):
  {
      "id":         "mem_pr_d1e6",
      "name":       "execute_sql",
      "content":    "SELECT * FROM users",
      "metadata":   { "step_id": "step_42" },
      "created_at": "2026-07-09T12:00:00Z",
      "updated_at": "2026-07-09T12:00:00Z"
  }

Route Registration
------------------

Routes are registered in the internal group inside SetupRoutes()
(`backend/internal/router/router.go:193-204`):

  // router.go
  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      // ...

      // Internal routes (service JWT required)
      internalGroup := api.Group("/api/v1/internal",
          middleware.InternalAuthRequired(cfg),
      )

      memoryGroup := internalGroup.Group("/memory")
      memoryGroup.Post("/episodic/store",   memoryHandler.HandleStoreEpisodic)
      memoryGroup.Post("/episodic/recall",  memoryHandler.HandleGetEpisodic)
      memoryGroup.Post("/semantic/store",   memoryHandler.HandleStoreSemantic)
      memoryGroup.Post("/semantic/search",  memoryHandler.HandleSemanticSearch)
      memoryGroup.Post("/procedural/store", memoryHandler.HandleStoreProcedural)
      memoryGroup.Post("/procedural/get",   memoryHandler.HandleGetProcedural)
  }

Backend Responsibilities
------------------------

+---------------------------+------------------------------------------------+
| Responsibility            | Implementation                                 |
+---------------------------+------------------------------------------------+
| Ownership                 | SessionLookup (session repo) resolves owner   |
| Redis connection          | redis.Client passed into memory.NewHandler    |
| pgvector / Postgres       | pgxpool.Pool passed into memory.NewHandler    |
| Connection pooling        | pgxpool + Redis client config                 |
| Embedding computation     | None — the agent supplies optional embeddings |
| TTL enforcement           | Redis EXPIRE on episodic writes (default 24h) |
| Text search               | ILIKE substring match on memory_semantic      |
| Structured query building | SQL in the memory handler                     |
+---------------------------+------------------------------------------------+

Future Extensibility
--------------------

New memory types can be added with zero agent changes:

  1. Add a new constant (e.g., "spatial" for geo-memory)
  2. Create a new storage backend or reuse an existing one
  3. Add a new route in the internal group
  4. Agent only needs to know the new endpoint path

  Example:
      internal.Post("/memory/spatial", memory.HandleStoreSpatial)

  The InternalAuthRequired middleware protects all of them automatically.

Memory Lifecycle & GC `[Active]`

-------------------------------

The gateway owns all retention policy; agents stay stateless:

- **Episodic (Redis)**: TTL-only GC today (24h). Lifecycle worker adds no
  active deletion — Redis handles expiry.
- **Session rows (PostgreSQL)**: decay scoring via `sessions.last_accessed_at`
  (migration 007) — derived `deprecated` window, then `status='archived'`
  (existing CHECK), then message deletion with row retention.
- **Worker scope**: `internal/worker/lifecycle.go` goroutine, ticker
  `WORKER_INTERVAL`, Redis SETNX lock for single-instance execution. See
  `docs/backend/infrastructure/server-lifecycle.md` and
  `docs/agent/domain/memory-and-retrieval-strategy.md`.

Entry Points & Exports
-----------------------

+------------------------------+----------+----------------------------------------+
| Symbol                       | Kind     | Path                                   |
+------------------------------+----------+----------------------------------------+
| SetupRoutes(fbApp, cfg)      | Function | router/router.go:193-204               |
| InternalAuthRequired(cfg)    | MW       | middleware/internal_auth.go:12         |
| NewHandler(rdb, pool, sess)  | Function | handler/memory/handler.go              |
| sessionOwner                 | Method   | handler/memory/ownership.go            |
| HandleStoreEpisodic          | Handler  | handler/memory/episodic.go             |
| HandleGetEpisodic            | Handler  | handler/memory/episodic.go             |
| HandleStoreSemantic          | Handler  | handler/memory/semantic.go             |
| HandleSemanticSearch         | Handler  | handler/memory/semantic.go             |
| HandleStoreProcedural        | Handler  | handler/memory/procedural.go           |
| HandleGetProcedural          | Handler  | handler/memory/procedural.go           |
+------------------------------+----------+----------------------------------------+

Dependencies
------------

+---------------------------+---------------------------------------------------+
| Dependency                | Used For                                          |
+---------------------------+---------------------------------------------------+
| github.com/gofiber/fiber  | HTTP framework, routing, middleware                |
| /v3                       |                                                   |
| github.com/go-redis/redis | Episodic memory (Redis client)                    |
| /v8                       |                                                   |
| github.com/jackc/pgx/v5  | Procedural + semantic memory (pgx pool)           |
| github.com/pgvector       | Semantic search (embedding queries)               |
| /pgvector-go              |                                                   |
| github.com/golang-jwt     | Service JWT verification (InternalAuthRequired)   |
| /jwt/v5                   |                                                   |
+---------------------------+---------------------------------------------------+

Source References
-----------------

- internal/router/router.go:193-204 - Internal route group registration
- internal/middleware/internal_auth.go - InternalAuthRequired middleware
- internal/handler/memory/*.go - Memory handlers (ownership.go: owner resolution)
- internal/database/schema.go - schemaMemoryOwnership (user_id columns, indexes)
- internal/handler/handlerutil/helpers.go - Response/error envelope
- internal/database/infrastructure.go - Redis + Postgres pools

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
