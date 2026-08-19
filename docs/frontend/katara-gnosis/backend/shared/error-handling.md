================================================================================
  KataraGnosis Error Handling - Fail-Hard Semantics
================================================================================
  Module    : Error Handling
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

KataraGnosis adopts a strict fail-hard philosophy (ADR-01): infrastructure
(Qdrant, GarageHQ, Redis, embedding provider) is REQUIRED. There are no
silent degradations, no ILIKE fallbacks, no "best effort then continue with
stale data". If the user's study data cannot be persisted consistently, the
operation fails loudly with a clear message.

Rules
-----

+---------------------+-------------------------------------------------------+
| Rule                | Behavior                                              |
+---------------------+-------------------------------------------------------+
| Qdrant unreachable  | Semantic search, ingestion, manual card save return   |
|                     | 503; ingest job fails (retryable). Startup logs fatal |
|                     | config error if QDRANT_URL set but unreachable.       |
| Garage unreachable  | Upload returns 503; download/presign returns 503.     |
| Redis unreachable   | Upload (enqueue) returns 503; worker refuses to start.|
| Embedding failure   | Ingestion fails; search returns 503; never index with |
|                     | missing vectors.                                      |
| LLM contract        | JSON parse/validation failure -> one retry, then job  |
| violation           | fails (non-retryable) with explicit message.          |
| Partial writes      | Never: PG persist and Qdrant upsert are "both or      |
|                     | neither" (PG commit last; on Qdrant failure the PG tx |
|                     | is not executed; on PG failure Qdrant points are      |
|                     | removed in the same error path).                      |
+---------------------+-------------------------------------------------------+

Error Taxonomy (backend/internal/models/katara/errors.go)
---------------------------------------------------------

  var (
      ErrQdrantUnavailable   = errors.New("katara: qdrant unavailable")
      ErrGarageUnavailable   = errors.New("katara: garage unavailable")
      ErrRedisUnavailable    = errors.New("katara: redis unavailable")
      ErrLLMContractViolated = errors.New("katara: llm contract violation")
      ErrSourceBusy          = errors.New("katara: source already processing")
      ErrDrillAnswered       = errors.New("katara: question already answered in session")
      ErrSourceUnsupported   = errors.New("katara: unsupported source type")
  )

HTTP Mapping (handlerutil reuse)
--------------------------------

  - ErrQdrantUnavailable / ErrGarageUnavailable / ErrRedisUnavailable
    -> 503 with friendly message.
  - ErrLLMContractViolated -> 502 with "generator produced invalid
    output; try again".
  - ErrSourceBusy -> 409.
  - ErrDrillAnswered -> 409.
  - ErrSourceUnsupported -> 400.
  - Unknown errors -> 500 via the app-level ErrorHandler (existing).

Logging
-------

All failures log with slog structured keys (component=katara, err, user_id,
ref_id) so Grafana/Loki queries can group by stage. Retryable vs
non-retryable is encoded in the job row + asynq result (worker.md).

Consistency Guarantee (both-or-neither)
---------------------------------------

  Ingestion final steps:

    1. Upsert Qdrant points (all chunks of the source).
    2. PG transaction: insert flashcards, update sources.status.
    3. If (1) fails -> job failed; nothing was persisted in PG (step 2
       never ran).
    4. If (2) fails -> delete Qdrant points for source_id (same error
       path), mark job failed.

  Reconciliation: a nightly Asynq task compares PG flashcards vs Qdrant
  points per source and re-upserts missing vectors (self-healing, logged).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
