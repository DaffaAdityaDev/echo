================================================================================
  KataraGnosis Qdrant Vector Engine
================================================================================
  Module    : Qdrant
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Qdrant is the sole vector store for KataraGnosis AND for the migrated echo
semantic memory (ADR-01: no ILIKE fallback anywhere). Communication is via
gRPC (port 6334) using github.com/qdrant/go-client.

Collections
-----------

### katara_flashcards

  +----------------+-----------------------------------------------------------+
  | Field          | Value                                                     |
  +----------------+-----------------------------------------------------------+
  | id             | flashcard UUID (same as PG row)                           |
  | vectors        | float32 vector, dimension fixed per EMBEDDING_MODEL       |
  |                | (gemini-embedding-001 -> 768)                             |
  | payload        | user_id, lake_id, source_id, domain, sub_topic,           |
  |                | archetype, keypoints[], content_preview (200 chars)       |
  +----------------+-----------------------------------------------------------+

  Filters used (always include user_id):
    - user_id EQUALS
    - lake_id / source_id / domain / sub_topic EQUALS
    - archetype EQUALS
    - Qdrant scalar index on user_id + sub_topic (payload schema
      created at collection creation).

### semantic_memory

  +----------------+-----------------------------------------------------------+
  | Field          | Value                                                     |
  +----------------+-----------------------------------------------------------+
  | id             | memory id (sem_*) — kept identical to PG memory_semantic  |
  | vectors        | provider-dependent dimensions                              |
  | payload        | content, metadata (free-form), created_at                 |
  +----------------+-----------------------------------------------------------+

  NOTE: PG memory_semantic table remains (legacy column), but the handler
  is rewritten to Qdrant-only (handler/memory/semantic.go).

Go Client Wrapper (internal/pkg/qdrant)
---------------------------------------

  type VectorStore interface {
      EnsureCollections(ctx) error                    // idempotent create
      Upsert(ctx, collection string,
              points []*Point) error                  // Point{ID, Vector, Payload}
      Search(ctx, collection string,
              vector []float32, filter map[string]any,
              limit uint64) ([]SearchHit, error)      // cosine
      DeleteByFilter(ctx, collection string,
              filter map[string]any) error
      DeleteByIDs(ctx, collection string, ids []string) error
      Ping(ctx) error                                 // health check
  }

  - Single connection with dial timeout 5s; gRPC keepalive 30s.
  - Search returns hit id + score; hydration of full content happens via
    PG (point ids are the flashcard UUIDs).
  - Distances: cosine (default).

Fail-Hard Behavior
------------------

  +--------------------------------+-------------------------------------------+
  | Scenario                       | Behavior                                  |
  +--------------------------------+-------------------------------------------+
  | Qdrant down at startup         | Backend logs FATAL (QDRANT_URL set);      |
  |                                | katara endpoints return 503.              |
  | Search while down              | 503 (shared/error-handling.md).           |
  | Upsert fails mid-ingest        | Job fails (retryable); PG not written     |
  |                                | (both-or-neither).                        |
  | Collection missing             | EnsureCollections at startup + first-use  |
  |                                | create; never silently skips.             |
  +--------------------------------+-------------------------------------------+

Payload Indexes
---------------

  Created with the collection definition (on first EnsureCollections):

    katara_flashcards:
      user_id    -> keyword index
      sub_topic  -> keyword index
      domain     -> keyword index (optional perf)

  No full-text index (Qdrant is vector-only here; ILIKE browsing lives
  in PG flashcards endpoint — that is a PG feature, not a Qdrant fallback).

Operations
----------

  - Backup: qdrant snapshot API (nightly via asynq job, P4) OR volume
    snapshot (docker). Volume snapshot is sufficient in v1.
  - Tuning: HNSW defaults (m=16, ef_construct=100); collections are
    small (personal use); no tuning knobs exposed in v1.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
