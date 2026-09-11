# KataraGnosis Backend Layer (`katara-backend`)

> Standalone Go + Fiber v3 backend service located at `app/KataraGnosis/backend/` running on port 8090.

---

## 1. Overview

The Katara backend is completely decoupled from the Echo agent harness. It provides:

- Standalone user management & JWT authentication.
- PostgreSQL data persistence with `pgxpool` (`katara_db`).
- Document ingestion & parsing into Qdrant vectors and GarageHQ assets.
- FSRS memory stability algorithm.
- AI question generation & adaptive practice evaluation.
- Asynq Redis background task worker.

---

## 2. Package Organization

```
app/KataraGnosis/backend/
├── cmd/
│   └── server/                   # main.go entrypoint
├── internal/
│   ├── config/                   # env loading & validation
│   ├── constants/                # enums, routes, prompts
│   ├── database/                 # schema.go & connection pool
│   ├── handler/                  # HTTP route handlers (Fiber v3)
│   ├── middleware/               # Auth JWT, CORS, Request Logger
│   ├── models/                   # Domain entities & DTOs
│   ├── pkg/
│   │   ├── fsrs/                 # Spaced repetition engine
│   │   ├── garage/               # GarageHQ S3 client
│   │   ├── jwt/                  # Standalone token signer
│   │   └── qdrant/               # Qdrant vector client
│   ├── repository/               # PostgreSQL data access layer
│   ├── service/                  # Business logic & LLM orchestration
│   └── worker/                   # Asynq processor & task definitions
├── go.mod
└── AGENTS.md
```

---

## 3. Documentation Map

| Category           | File                                                                                                                                                | Description                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Infrastructure** | [infrastructure/routing.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/infrastructure/routing.md)                                   | Fiber v3 router, port 8090, middleware stack                   |
| **Infrastructure** | [infrastructure/database.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/infrastructure/database.md)                                 | PostgreSQL `katara_db`, connection pooling, schema migrations  |
| **Infrastructure** | [infrastructure/worker.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/infrastructure/worker.md)                                     | Asynq task queues, retry policies, background pipelines        |
| **Patterns**       | [application/patterns/ingestion-pipeline.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/application/patterns/ingestion-pipeline.md) | PDF/Text -> Garage -> LLM extraction -> Qdrant -> FSRS         |
| **Features**       | [application/features/libraries.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/application/features/libraries.md)                   | Lakes, sources, flashcards, semantic search                    |
| **Features**       | [application/features/drills.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/application/features/drills.md)                         | Adaptive drill runner, FSRS scheduling, latency evaluation     |
| **Features**       | [application/features/progress.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/application/features/progress.md)                     | Daily target analytics, 7-day mastery matrix, weekly synthesis |
| **Features**       | [application/features/embeddings.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/application/features/embeddings.md)                 | Dense vector generation (Gemini / OpenAI / Ollama)             |
| **Shared**         | [shared/ai-call-pattern.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/shared/ai-call-pattern.md)                                   | LLM prompt templates and structured JSON parsing               |
| **Shared**         | [shared/error-handling.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/shared/error-handling.md)                                     | Error handling, status mapping, and fail-hard governance       |
