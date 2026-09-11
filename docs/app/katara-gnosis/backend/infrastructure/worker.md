# Katara Backend: Background Worker Architecture

> Asynq Redis task queue processing asynchronous document ingestion and weekly synthesis.

---

## 1. Asynq Setup & Task Types

Katara backend utilizes `github.com/hibiken/asynq` for reliable background processing.

- **Redis Connection**: `REDIS_URL=redis://localhost:6379/1`
- **Task Queues**:
  - `critical`: High priority immediate reprocessing.
  - `default`: Document ingestion and flashcard extraction.
  - `low`: Weekly synthesis generation.

### Task Type Constants

```go
const (
    TaskTypeIngestSource     = "katara:ingest_source"
    TaskTypeReprocessSource  = "katara:reprocess_source"
    TaskTypeWeeklySynthesis  = "katara:weekly_synthesis"
)
```

---

## 2. Ingestion Task Workflow

```
[POST /sources] ──▶ Enqueue TaskTypeIngestSource
                           │
                           ▼
                 [Asynq Worker Processor]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
1. Fetch from GarageHQ         2. Parse Text / PDF
             │                           │
             └─────────────┬─────────────┘
                           ▼
3. Call LLM: Extract Atomic Flashcards (300-500 tokens)
                           ▼
4. Generate Vector Embeddings via configured Provider
                           ▼
5. Upsert points into Qdrant (`katara_flashcards`)
                           ▼
6. Insert into `katara_flashcards` & `katara_srs_states`
                           ▼
7. Mark `katara_sources.status = 'ready'` & `katara_jobs.status = 'done'`
```

---

## 3. Retry & Failure Policy

- Maximum retries: 3 attempts with exponential backoff.
- On terminal failure: `katara_sources.status` is marked as `'failed'` with error details stored in `katara_sources.error` and `katara_jobs.error`.
