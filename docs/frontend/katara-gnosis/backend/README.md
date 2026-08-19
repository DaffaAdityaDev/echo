================================================================================
  KataraGnosis Backend Documentation Index
================================================================================
  Module    : Backend Domain
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
================================================================================

The KataraGnosis backend is implemented inside the Echo Go backend
(backend/). It follows the existing handler -> service -> repository
layering, ACID/SOLID rules, and the fail-hard error philosophy of
KataraGnosis (shared/error-handling.md).

Documentation Index
-------------------

+----------------------------------------------+------------------------------+
| Module                                       | Description                  |
+----------------------------------------------+------------------------------+
| infrastructure/routing.md                    | Route registration,          |
|                                              | middleware, swagger.         |
| infrastructure/database.md                   | schema.go additions, ACID    |
|                                              | transactions, indexes.       |
| infrastructure/worker.md                     | Asynq server, tasks, retries.|
| application/patterns/ingestion-pipeline.md   | Upload -> atomize -> embed   |
|                                              | -> Qdrant -> PG pipeline.    |
| application/features/libraries.md            | Lakes, sources, flashcards,  |
|                                              | semantic search.             |
| application/features/drills.md               | Drill engine, on-demand      |
|                                              | generation, evaluation, SRS. |
| application/features/progress.md             | Mastery, streaks, weak       |
|                                              | spots, weekly synthesis.     |
| application/features/embeddings.md           | General embedding endpoint.  |
| shared/ai-call-pattern.md                    | Direct LLM call pattern and  |
|                                              | prompt-contract JSON.        |
| shared/error-handling.md                     | Fail-hard semantics.         |
+----------------------------------------------+------------------------------+

Package Layout (backend/internal)
---------------------------------

  handler/katara/        Fiber handlers (thin, request binding only)
  service/katara/        Business logic (ingest, atomize, quiz, drill, srs,
                         progress, embed)
  repository/katara/     pgx SQL, one file per aggregate
  pkg/garage/            minio-go wrapper (S3 client for GarageHQ)
  pkg/qdrant/            qdrant go-client wrapper (collections, upsert,
                         search, delete)
  worker/katara.go       Asynq server registration + task handlers
  constants/katara/      Enums, defaults, route paths (see domain/constants.md)

Dependencies (backend/go.mod additions)
---------------------------------------

+------------------------------+------------------------------------------------+
| Dependency                   | Purpose                                        |
+------------------------------+------------------------------------------------+
| github.com/qdrant/go-client  | Qdrant gRPC client.                            |
| github.com/minio/minio-go/v7| S3-compatible client for GarageHQ.             |
| github.com/hibiken/asynq     | Redis-backed task queue.                       |
| github.com/pdfcpu/pdfcpu     | PDF text extraction (text layer, v1).          |
| github.com/open-spaced-      | FSRS-5 scheduler; SM-2 fallback if this        |
| repetition/go-fsrs           | dependency cannot be used.                     |
+------------------------------+------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
