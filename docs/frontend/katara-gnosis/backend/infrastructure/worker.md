================================================================================
  KataraGnosis Background Worker (Asynq)
================================================================================
  Module    : Worker
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Background jobs run on Asynq (github.com/hibiken/asynq) backed by the
existing Redis instance. Asynq provides retries, dedup, scheduling, and
observability out of the box. Redis is REQUIRED for KataraGnosis: if Redis is
unreachable, upload endpoints return 503 (fail-hard, ADR-01/ADR-06).

Task Types
----------

+---------------------+--------------------------------------------------------+
| Task                | Purpose                                                |
+---------------------+--------------------------------------------------------+
| ingest_source       | Full ingestion: fetch blob, extract text, chunk, tag,  |
|                     | embed, upsert Qdrant, insert flashcards.               |
| reprocess_source    | Re-run atomization on an existing source (retag /      |
|                     | re-embed after user edits or model change).            |
| weekly_synthesis    | Generate the Weakness Synthesis Sheet for a user       |
|                     | (scheduled Monday 06:00 local).                        |
+---------------------+--------------------------------------------------------+

Architecture
------------

  +-------------------+       enqueue        +---------------------+
  | Katara handlers   | -------------------> | Asynq Client        |
  | (upload,          | payload: {task_id,   +----------+----------+
  |  reprocess,       | user_id, ref_id}                |
  |  regenerate)      |                                v
  +-------------------+                    +---------------------+
                                           | Asynq Server        |
                                           | (in-process, started|
                                           | in main.go as       |
                                           | goroutine)          |
                                           +----------+----------+
                                                      |
                          +-------------------+       | dequeue
                          | Redis (queues:    | <-----+
                          |  katara:default,  |
                          |  katara:cron)     |
                          +-------------------+       |
                                                      v
                                          +---------------------+
                                          | Task handler        |
                                          | (service/katara/    |
                                          |  ingest.go,          |
                                          |  progress.go)        |
                                          +---------------------+

Server Setup (internal/worker/katara.go)
----------------------------------------

  - Created in main.go alongside the existing lifecycle worker goroutine.
  - asynq.Server configured with:
      Concurrency: 2 (ingest is LLM-bound, not CPU-bound)
      Queues: { "katara:default": 6, "katara:cron": 3 }
  - asynq.RedisClientOpt derived from REDIS_ADDR/REDIS_PASSWORD.
  - mux.HandleFunc(task types) -> service methods.
  - Graceful shutdown via app.Shutdown() (server.Shutdown() on context
    cancel).
  - If Redis is unavailable at startup, the worker logs FATAL and the
    server refuses to start KataraGnosis endpoints (fail-hard).

Job Lifecycle & Idempotency
---------------------------

  enqueue:
    1. Insert jobs row (status=queued, type, ref_id, user_id).
    2. asynq.NewTask(taskType, payload{task_id, user_id, ref_id}).
    3. On enqueue error: mark jobs row failed with error.

  execution (per task):
    1. Load job row; transition queued -> running.
    2. Run pipeline (see ingestion-pipeline.md).
    3. On success: transition running -> done, update counters.
    4. On error: transition -> failed with error message; retry via
       asynq's built-in retry (max 3 attempts, backoff 30s/2m/10m).
       Non-retryable failures (invalid PDF, LLM contract violation) set
       asynq.ResultFailed() to skip retries.

  duplicate guard: uploads check sources.status != processing before
  enqueueing (409 Conflict otherwise).

UI Visibility
-------------

  GET /api/v1/katara/jobs/:id returns {status, error, progress_stage} where
  progress_stage is one of: upload, extract, chunk, tag, embed, index,
  persist. Handlers emit stage updates by PATCHing the jobs row (cheap,
  worker-paced).

Scheduling
----------

  weekly_synthesis: asynq.NewPeriodicTask("0 6 * * 1", task) registered at
  server boot (cron queue). Timezone = Asia/Jakarta (configurable via env
  KATARA_TIMEZONE).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
