================================================================================
  KataraGnosis Architecture Blueprint
================================================================================
  Module    : Architecture
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

KataraGnosis is a standalone Next.js application ("learning drill engine") that
reuses the Echo monorepo backend as its API gateway. The user uploads study
material (PDF, markdown, plain text) into a "lake" (domain). An AI pipeline
atomizes the material into flashcards (atomic cards) tagged with domain,
sub-topic, and archetype, then embeds them into Qdrant. The user drills daily:
the backend builds a 70/30 mix of due spaced-repetition reviews and new
material, generates quiz questions on demand via the LLM, evaluates answers
(instant for objective, AI-graded for open-ended), and records everything into
PostgreSQL for progress tracking.

The middle-way philosophy (see daily-protocol.md): the user never manages a
taxonomy — AI auto-clusters on ingestion, the user only executes daily drills.

Components
----------

  +----------------+          +----------------------------------------------+
  |                |  REST    |               Echo Backend (Go/Fiber v3)      |
  |  KataraGnosis  |  /api    |                                              |
  |  Next.js app   +--------> |  handler/katara/*    service/katara/*         |
  |  (port 3002)   |  BFF     |  repository/katara/*                          |
  |                |          |  worker/katara (Asynq)   handler/memory       |
  +----------------+          +---+-----------------------+------+-----------+
                                |                       |              |
                 PostgreSQL     |        Qdrant (gRPC)  |   GarageHQ   |
                 (schema.go     |        katara_         |   (S3,       |
                  + katara      |        flashcards      |    bucket     |
                  tables)       |        semantic_memory |    inquiz-    |
                                |                       |    itive-docs)|
                                +-----------------------++--------------+
                                                        |
                                                   Asynq (Redis)
                                                   ingest_source,
                                                   weekly_synthesis
                                                        |
                                                   LLM providers
                                                   (opencode-go /
                                                   openai / anthropic /
                                                   lm-studio / gemini
                                                   for embeddings)

The browser never calls the backend directly: every request goes through the
Next.js BFF proxy layer (src/app/api/...), which injects the httpOnly auth
cookie (pattern copied from frontend/web).

Tech Stack
----------

+------------------+---------------------------+----------------------------------+
| Layer            | Technology                | Rationale                        |
+------------------+---------------------------+----------------------------------+
| Frontend         | Next.js 16.2.6 + React 19 | Standalone app, port 3002.       |
|                  | + TypeScript 7            | Version mirrors frontend/web.    |
| UI               | Tailwind v4 + custom UI   | CSS-first tokens, no shadcn.     |
|                  | kit + TipTap v2           | Notion-like block editor.        |
| Server state     | TanStack React Query v5   | Query cache as server store.     |
| Client state     | Zustand v5                | Inline-selector UI state.        |
| Backend          | Go + Fiber v3 (echo       | Extend existing gateway; reuse   |
|                  | backend)                  | auth, tiers, prompt templates.   |
| Database         | PostgreSQL                | Single source of truth, ACID.    |
| Vector engine    | Qdrant (Rust)             | gRPC client, payload filters,    |
|                  |                           | fail-hard (no ILIKE fallback).   |
| Blob storage     | GarageHQ (Rust)           | S3-compatible, self-hosted,      |
|                  |                           | bucket inquizitive-docs.         |
| Broker / queue   | Redis + Asynq             | Background ingest + synthesis    |
|                  |                           | jobs.                            |
| SRS              | go-fsrs (FSRS-5)          | Free Spaced Repetition Scheduler;|
|                  |                           | SM-2 fallback if dep unusable.   |
| PDF extraction   | pdfcpu (Go)               | Text-layer extraction, v1 only.  |
| Embeddings       | EMBEDDING_PROVIDER        | gemini | openai-compatible       |
|                  |                           | (covers LM Studio / local).      |
+------------------+---------------------------+----------------------------------+

Data Flows
----------

### Ingestion (async)

  Upload (multipart)
       │
       ▼
  POST /api/v1/katara/sources ──► store blob in Garage (object_key =
       │                            <user_id>/<source_id>.<ext>)
       ▼
  Enqueue Asynq task "ingest_source"
       ▼
  Worker:
   1. Fetch blob from Garage
   2. Extract text (pdfcpu for PDF; raw for md/txt)
   3. Split into chunks (300-500 tokens, heading-aware)
   4. LLM tag each chunk: domain, sub_topic, archetype, keypoints[] (JSON contract)
   5. Generate embedding per chunk (embed service)
   6. Upsert points into Qdrant katara_flashcards (payload + user_id filter)
   7. Insert flashcards into PostgreSQL (single ACID transaction)
   8. Update source status: processing -> ready | failed

### Drill (synchronous, per-question)

  POST /api/v1/katara/drills            ──► create session, build 70/30 mix
  GET  /api/v1/katara/drills/:id/next   ──► serve next question; generate
                                            on demand via LLM if new card
                                            (cached in `questions` table)
  POST /api/v1/katara/drills/:id/answer ──► auto-check MCQ / AI-grade essay,
                                            record attempt + latency class,
                                            update FSRS state, return
                                            feedback + distractor breakdown

### Progress (computed on read)

  GET /api/v1/katara/progress   ──► mastery matrix per sub_topic (FSRS state +
                                    7-day accuracy), streak, weak spots
  GET /api/v1/katara/synthesis/weekly ──► Asynq job renders 1-page Weakness
                                          Synthesis Sheet via LLM

Folder Layout (target)
----------------------

  web/KataraGnosis/                  <- standalone app (port 3002)
  ├── AGENTS.md
  ├── docs/                          <- this documentation tree
  └── src/
      ├── app/
      │   ├── layout.tsx
      │   ├── login/page.tsx
      │   ├── (katara)/              <- authed shell (AuthGuard + Sidebar)
      │   │   ├── page.tsx           <- dashboard
      │   │   ├── library/page.tsx
      │   │   ├── library/sources/[id]/page.tsx
      │   │   ├── drill/[sessionId]/page.tsx
      │   │   ├── progress/page.tsx
      │   │   └── settings/page.tsx
      │   └── api/                   <- BFF proxies to backend /api/v1
      ├── components/ui/
      ├── features/                  <- auth, library, drill, progress,
      │                                 settings, shared
      ├── lib/                       <- api-client, query client, proxy-fetch
      ├── constants/
      └── utils/

Backend additions (in echo backend/):
  internal/handler/katara/           <- Fiber handlers
  internal/service/katara/           <- ingest, atomize, quiz, drill, srs,
                                         progress, embed
  internal/repository/katara/        <- pgx SQL
  internal/worker/katara.go          <- Asynq server registration
  internal/pkg/garage/               <- minio-go wrapper (S3 client)
  internal/pkg/qdrant/               <- qdrant go-client wrapper

Key Design Decisions (detail in shared/adr.md)
----------------------------------------------

+--------+--------------------------------------------------------------+
| ADR-01 | Qdrant is the only vector engine; no ILIKE fallback. If       |
|        | Qdrant is unreachable, semantic operations fail hard.         |
| ADR-02 | Blob storage is GarageHQ (S3-compatible); client is minio-go. |
| ADR-03 | Questions are generated on demand per drill and cached in     |
|        | the `questions` table.                                        |
| ADR-04 | KataraGnosis extends the echo backend (no separate Go         |
|        | service).                                                     |
| ADR-05 | The app is standalone at web/KataraGnosis, port 3002.         |
| ADR-06 | Background jobs run on Asynq over Redis (ingest, synthesis).  |
| ADR-07 | The library editor is TipTap v2 (Notion-like blocks).         |
| ADR-08 | Embedding is a general provider-agnostic service: gemini or   |
|        | any OpenAI-compatible /v1/embeddings endpoint.                |
+--------+--------------------------------------------------------------+

Non-Goals (v1)
--------------

- No video/audio transcription (deferred to P4).
- No vision/multimodal PDF parsing (deferred; pdfcpu text layer only).
- No multi-user collaboration, no public sharing.
- No pgvector usage for KataraGnosis data (Qdrant owns vectors).
- No changes to the agent service (Hono) in v1.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
