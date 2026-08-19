================================================================================
  KataraGnosis Library Domain (Lakes, Sources, Flashcards)
================================================================================
  Module    : Libraries
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The library domain manages the three-tier hierarchy:
lake (domain) -> source (uploaded document) -> flashcards (atomic cards).
Handlers are thin; all logic lives in service/katara and repository/katara.

Lakes
-----

  POST   /katara/lakes          body {name, slug?, description?, icon?}
  GET    /katara/lakes          list with aggregates: source_count,
                                flashcard_count, mastery overview (computed
                                via progress service, light version)
  GET    /katara/lakes/:id      detail + recent sources
  PATCH  /katara/lakes/:id      update name/description/icon/status
  DELETE /katara/lakes/:id      soft archive (status=archived); hard delete
                                only if no sources. Archiving hides the lake
                                from the feed but keeps data.

  Rules:
  - slug auto-generated from name if absent; UNIQUE(user_id, slug).
  - delete/archive cascade: archiving a lake hides its sources/flashcards
    from feeds but keeps them; daily mix never selects archived lakes.

Sources (Upload)
----------------

  POST /katara/sources   multipart/form-data: file, lake_id, title?

  Flow:
    1. Validate mime/size (<= 50 MB; allowed: pdf, md, txt).
    2. Generate source UUID + object_key = "<user_id>/<source_id>.<ext>".
    3. Stream blob to Garage (minio-go PutObject, context timeout 2 min).
    4. INSERT sources (status=uploaded).
    5. Enqueue ingest_source (worker.md). On enqueue failure -> rollback
       row + delete blob (fail-hard).
    6. Return 201 {source_id, job_id}.

  GET /katara/sources               list for a lake (query lake_id) with
                                    status, flashcard_count, created_at
  GET /katara/sources/:id           detail incl. progress_stage from jobs
  GET /katara/sources/:id/download  presigned GET URL (5 min TTL)
  GET /katara/sources/:id/chunks    flashcards of the source, ordered by
                                    position (for the Notion-like reader)
  DELETE /katara/sources/:id        cascade per database.md (PG tx after
                                    commit: Qdrant delete by source_id
                                    filter + Garage delete — best-effort,
                                    logged)
  POST /katara/sources/:id/reprocess  re-run ingestion (ingestion-pipeline.md)

Flashcards
----------

  GET /katara/flashcards            filters: lake_id, domain, sub_topic,
                                    archetype, search (ILIKE on content for
                                    the "browse" view), pagination
  GET /katara/flashcards/:id        full card + keypoints + linked question
                                    count + SRS state summary (due_at,
                                    reps, lapses)
  POST /katara/flashcards           manual card creation (from TipTap
                                    editor notes): content, domain,
                                    sub_topic, archetype, keypoints,
                                    lake_id, source_id nullable
                                    (source = 'manual'); also embeds the
                                    content and upserts Qdrant so manual
                                    cards participate in semantic search
  PATCH /katara/flashcards/:id      edit content/metadata; re-embed +
                                    re-upsert Qdrant in the same request
                                    (synchronous, single card)
  DELETE /katara/flashcards/:id     delete card + Qdrant point + srs_state

Semantic Search
---------------

  POST /katara/flashcards/search
  body: { query, lake_id?, limit? (default 10) }

  Flow:
    1. Embed the query via embed service (same provider as index).
    2. Qdrant search with filter { user_id, lake_id? }, limit N.
    3. Hydrate results with full flashcard content from PG (by point id).
    4. Return ranked list with score + content_preview + keypoints.

  Fail-hard: if Qdrant is down, the endpoint returns 503 — never falls
  back to ILIKE (ADR-01).

Delete Cascade Notes
--------------------

  - Deleting a source also retires its questions (status=retired) — attempts
    are kept for analytics but questions are removed from feeds.
  - Qdrant/Garage cleanup is best-effort and logged with slog; a scheduled
    cleanup job (same Asynq server, hourly) reconciles orphaned points/objects.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
