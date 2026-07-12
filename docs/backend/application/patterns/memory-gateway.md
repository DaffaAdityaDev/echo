================================================================================
  Memory Gateway - Agent Memory Backend
================================================================================
  Module    : Memory Gateway
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
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

  Agent (Hono/Fastify)
       │
       │  POST /api/v1/internal/memory/episodic
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
  │  │     - Call service layer                     │  │
  │  └──────────────────┬───────────────────────────┘  │
  │                     │                              │
  │  ┌──────────────────▼───────────────────────────┐  │
  │  │  3. Data layer                                │  │
  │  │     Episodic ──► Redis (temporal)             │  │
  │  │     Semantic ──► pgvector (embeddings)        │  │
  │  │     Procedural ──► Postgres (structured)      │  │
  │  └──────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────┘
       │
       │  200 OK { "id": "mem_xxx", "status": "stored" }
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

Endpoint Reference
------------------

### Episodic Memory

  POST /api/v1/internal/memory/episodic
  Authorization: Bearer <Service JWT>

  Request:
  {
      "session_id": "sess_abc123",
      "content":    { ... },        // any JSON-serializable payload
      "ttl_seconds": 86400          // optional, default 24h
  }

  Response (201):
  {
      "id":     "mem_ep_9f3a",
      "status": "stored"
  }

  GET /api/v1/internal/memory/episodic?session_id=sess_abc123
  Authorization: Bearer <Service JWT>

  Response (200):
  {
      "session_id": "sess_abc123",
      "entries": [
          { "id": "mem_ep_9f3a", "content": {...}, "ts": "2026-07-09T12:00:00Z" }
      ]
  }

### Semantic Memory

  POST /api/v1/internal/memory/semantic
  Authorization: Bearer <Service JWT>

  Request:
  {
      "text":      "The user prefers dark mode in all applications",
      "metadata":  { "source": "conversation", "confidence": 0.95 },
      "embedding": [0.012, -0.034, ...]          // optional, backend computes
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
      "query":       "user preference dark mode",
      "top_k":       5,
      "min_score":   0.7
  }

  Response (200):
  {
      "results": [
          {
              "id":       "mem_sm_b4c2",
              "text":     "The user prefers dark mode in all applications",
              "score":    0.92,
              "metadata": { "source": "conversation" }
          }
      ]
  }

### Procedural Memory

  POST /api/v1/internal/memory/procedural
  Authorization: Bearer <Service JWT>

  Request:
  {
      "step_id":      "step_42",
      "action":       "execute_sql",
      "input":        "SELECT * FROM users",
      "output":       "42 rows returned",
      "status":       "success",
      "duration_ms":  123
  }

  Response (201):
  {
      "id":     "mem_pr_d1e6",
      "status": "recorded"
  }

  GET /api/v1/internal/memory/procedural?task_id=task_xyz
  Authorization: Bearer <Service JWT>

  Response (200):
  {
      "steps": [
          { "step_id": "step_42", "action": "execute_sql", "status": "success" }
      ]
  }

Route Registration
------------------

Routes are registered in the internal group inside SetupRoutes():

  // router.go
  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      infra := database.NewInfrastructure(cfg)

      // ... public routes ...

      // Internal routes (agent only)
      internal := api.Group("/internal",
          middleware.InternalAuthRequired(cfg.InternalAuthToken),
      )

      memory := handler.NewMemoryHandler(infra)
      internal.Post("/memory/episodic",   memory.HandleStoreEpisodic)
      internal.Get("/memory/episodic",    memory.HandleGetEpisodic)
      internal.Post("/memory/semantic",   memory.HandleStoreSemantic)
      internal.Post("/memory/semantic/search", memory.HandleSearchSemantic)
      internal.Post("/memory/procedural", memory.HandleStoreProcedural)
      internal.Get("/memory/procedural",  memory.HandleGetProcedural)
  }

Backend Responsibilities
------------------------

+---------------------------+------------------------------------------------+
| Responsibility            | Implementation                                 |
+---------------------------+------------------------------------------------+
| Redis connection          | database.Infrastructure.Redis                  |
| pgvector / Postgres       | database.Infrastructure.DB (pgx pool)          |
| Connection pooling        | pgxpool + Redis pool config                    |
| Embedding computation     | Optional: internal call to OpenAI / local model|
| TTL enforcement           | Redis EXPIRE on episodic writes                |
| Vector search             | pgvector cosine / inner product queries        |
| Structured query building | repository layer for procedural memory         |
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

Entry Points & Exports
-----------------------

+------------------------------+----------+----------------------------------------+
| Symbol                       | Kind     | Path                                   |
+------------------------------+----------+----------------------------------------+
| SetupRoutes(fbApp, cfg)      | Function | router/router.go:15                    |
| InternalAuthRequired(secret) | MW       | middleware/internal.go:12              |
| MemoryHandler                | Struct   | handler/memory.go (planned)            |
| HandleStoreEpisodic          | Handler  | handler/memory.go (planned)            |
| HandleGetEpisodic            | Handler  | handler/memory.go (planned)            |
| HandleStoreSemantic          | Handler  | handler/memory.go (planned)            |
| HandleSearchSemantic         | Handler  | handler/memory.go (planned)            |
| HandleStoreProcedural        | Handler  | handler/memory.go (planned)            |
| HandleGetProcedural          | Handler  | handler/memory.go (planned)            |
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

- internal/router/router.go:40-55 - Internal route group registration
- internal/middleware/internal.go - InternalAuthRequired middleware
- internal/handler/memory.go - Memory handler (planned)
- internal/service/memory.go - Memory service (planned)
- internal/database/infrastructure.go - Redis + Postgres pools
- internal/models/models.go:56-62 - DB struct

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
