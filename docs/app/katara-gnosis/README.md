# KataraGnosis: AI-Powered Learning & Drill System

> Standalone learning and test preparation platform with its own Go backend (`katara-backend`), Next.js 16 frontend, PostgreSQL (`katara_db`), Qdrant vector database, GarageHQ object storage, and Redis task queue.

---

## 1. Overview & Architecture

KataraGnosis is located at `app/KataraGnosis/` as a self-contained monorepo app:

- **Frontend** (`app/KataraGnosis/frontend`): Next.js 16.2.6, React 19, TypeScript, Tailwind CSS v4, TipTap v2 on port 3002.
- **Backend** (`app/KataraGnosis/backend`): Go + Fiber v3 service (`katara-backend`), standalone PostgreSQL database (`katara_db`), standalone auth (JWT + `users` table), FSRS algorithm, Asynq background workers on port 8090.
- **Data Stores**:
  - PostgreSQL (`katara_db`): Relational metadata, users, lakes, sources, flashcards, SRS states, drill sessions, attempts, jobs, weekly sheets.
  - Qdrant (`katara_flashcards` collection): Semantic search and vector retrieval for flashcards.
  - GarageHQ (`inquizitive-docs` bucket): Raw document and source asset storage.
  - Redis: Asynq worker queues for ingestion, reprocessing, and synthesis.

---

## 2. Directory Structure

```
app/KataraGnosis/
├── frontend/                     # Next.js 16 Web Client (Port 3002)
│   ├── src/
│   │   ├── app/                  # App Router & BFF API Proxies
│   │   ├── components/ui/        # 15 UI Primitives (tokens-driven)
│   │   ├── features/             # Feature modules (auth, library, drill, progress, settings, shared)
│   │   ├── lib/                  # api-client, proxy-fetch, query-standard
│   │   └── utils/                # cn, error
│   ├── package.json
│   ├── tsconfig.json
│   └── AGENTS.md
│
└── backend/                      # Standalone Go Service (Port 8090)
    ├── cmd/server/               # main.go
    ├── internal/
    │   ├── constants/            # katara enums, route constants, prompts
    │   ├── database/             # schema.go (katara_db DDL) & connection pool
    │   ├── handler/              # HTTP Fiber v3 handlers
    │   ├── middleware/           # auth JWT, CORS, recovery, logging
    │   ├── models/               # DTOs, domain structs
    │   ├── pkg/                  # garage client, qdrant client, fsrs, jwt
    │   ├── repository/           # PostgreSQL data access layer
    │   ├── service/              # Business logic & AI orchestration
    │   └── worker/               # Asynq tasks & consumers
    ├── go.mod
    └── AGENTS.md
```

---

## 3. Documentation Map

| Category         | File                                                                                                                    | Description                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Architecture** | [architecture.md](file:///c:/programming/echo/docs/app/katara-gnosis/architecture.md)                                   | High-level system topology, data flow, component diagram      |
| **Protocol**     | [daily-protocol.md](file:///c:/programming/echo/docs/app/katara-gnosis/daily-protocol.md)                               | 20-minute daily learning & drill protocol specification       |
| **Decisions**    | [shared/adr.md](file:///c:/programming/echo/docs/app/katara-gnosis/shared/adr.md)                                       | Architecture Decision Records (ADR-001 through ADR-009)       |
| **Contracts**    | [shared/contracts.md](file:///c:/programming/echo/docs/app/katara-gnosis/shared/contracts.md)                           | HTTP API contracts between Frontend BFF and Katara Backend    |
| **Domain**       | [domain/models.md](file:///c:/programming/echo/docs/app/katara-gnosis/domain/models.md)                                 | Database models and JSON entities                             |
| **Domain**       | [domain/constants.md](file:///c:/programming/echo/docs/app/katara-gnosis/domain/constants.md)                           | Enums, route constants, defaults                              |
| **Frontend**     | [frontend/README.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/README.md)                             | Frontend architecture, routing, design system, TipTap editor  |
| **Backend**      | [backend/README.md](file:///c:/programming/echo/docs/app/katara-gnosis/backend/README.md)                               | Go backend architecture, database schema, FSRS engine, worker |
| **Infra**        | [infrastructure/env-contract.md](file:///c:/programming/echo/docs/app/katara-gnosis/infrastructure/env-contract.md)     | Environment variables contract for Katara backend & frontend  |
| **Infra**        | [infrastructure/docker-compose.md](file:///c:/programming/echo/docs/app/katara-gnosis/infrastructure/docker-compose.md) | Docker Compose services definition                            |
