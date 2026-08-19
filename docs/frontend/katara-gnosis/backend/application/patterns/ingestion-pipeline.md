================================================================================
  KataraGnosis Ingestion Pipeline
================================================================================
  Module    : Ingestion Pipeline
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The ingestion pipeline turns an uploaded blob (PDF / markdown / text) into a
set of AI-tagged flashcards persisted in PostgreSQL and indexed as vectors in
Qdrant. It runs as an Asynq task (worker.md) and is the only place that
writes flashcards.

Sequence
--------

  User/BFF                                   Backend                       Garage / Qdrant / LLM
  --------                                   -------                       --------------------
     |  POST /sources (multipart)               |
     |----------------------------------------->|
     |                                          | stream blob -> PUT object
     |                                          |-----------------------------> Garage
     |                                          | insert sources(status=uploaded)
     |                                          | enqueue task ingest_source
     | 201 {source_id, job_id}                  |
     |------------------------------------------|
     |  GET /jobs/:id  (poll)                   |  worker: stages update
     |----------------------------------------->|

  Worker stages (single task):
   1. extract    GET object <- Garage; pdfcpu text (PDF) or raw bytes (md/txt)
   2. chunk      split into 300-500 token chunks, heading-aware
   3. tag        LLM per chunk: domain, sub_topic, archetype, keypoints[3-5]
   4. embed      embed service per chunk (batch)
   5. index      Qdrant upsert katara_flashcards (payload + user_id)
   6. persist    PG transaction: insert flashcards + update sources
                 (status=ready, char_count, flashcard_count)

  On failure at any stage: sources.status=failed + jobs row failed + retry
  policy per worker.md.

Chunking (stage 2)
------------------

+----------------+-------------------------------------------------------------+
| Source type    | Strategy                                                    |
+----------------+-------------------------------------------------------------+
| markdown       | Split on headings (#..####), then paragraphs; merge until   |
|                | 300-500 tokens (approx 400-700 words of Indonesian/English  |
|                | mix is ~450 tokens).                                        |
| text           | Split on blank lines, merge up to target size.              |
| pdf            | pdfcpu extracts text pages; pages are concatenated and the  |
|                | same paragraph-merging applies. Headings are inferred from  |
|                | font-size deltas (pdfcpu extraction results) when present.  |
+----------------+-------------------------------------------------------------+

Chunks are created with `position` ordering; duplicate detection is a
simple hash of content on (source_id, position) to keep reprocessing safe.

AI Tagging (stage 3) — JSON contract
------------------------------------

Prompt template: prompt_templates name `katara.atomize` (fallback constant in
service/katara/atomize.go). The LLM receives one chunk at a time and must
return strict JSON:

  {
    "domain": "Kebanksentralan",
    "sub_topic": "Transmisi Kebijakan Moneter",
    "archetype": "conceptual",          // conceptual | procedural | scenario
    "keypoints": [
      "BI-Rate adalah suku bunga acuan yang ditetapkan BI.",
      "Perubahan BI-Rate memengaruhi suku bunga kredit dan deposito.",
      "Transmisi berjalan melalui jalur kredit, ekspektasi, dan nilai tukar."
    ]
  }

Rules:

- domain/sub_topic labels are free-form but MUST be short (<= 60 chars);
  the service normalizes by lowercasing and collapsing whitespace.
- archetype MUST be one of the three enum values; invalid -> retry once,
  then fail the job (LLM contract violation, non-retryable).
- keypoints MUST be 3-5 strings, each a standalone fact.
- Request sent with temperature 0.2; response validated with a Go-side
  schema (strict parsing, no graceful degradation).

Embedding (stage 4)
-------------------

Calls service/katara/embed.go (see embeddings.md). Batches of 16 chunks per
call. If embedding fails: job fails (retryable) — no chunk is written
without its vector (Qdrant and PG stay consistent: both or neither).

Qdrant Upsert (stage 5)
-----------------------

Via pkg/qdrant wrapper (gRPC). Point ID = flashcard UUID (generated
server-side BEFORE persist so Qdrant and PG reference the same id).
Payload per domain/models.md (katara_flashcards). The wrapper ensures the
collection exists (create on first use) and always includes the user_id
payload + scalar index on user_id/sub_topic.

PostgreSQL Persist (stage 6)
----------------------------

One transaction (ACID):

  INSERT INTO flashcards (...)  -- batched
  UPDATE sources SET status='ready', char_count=..., flashcard_count=...
  DELETE stale flashcards of source (reprocess case) -- before insert

Reprocessing
------------

POST /sources/:id/reprocess enqueues reprocess_source:
  - source status -> processing; stale flashcards deleted in tx at persist
    stage; Qdrant points deleted for source_id before re-upsert.
  - Used after user edits source text or changes the embedding provider.

Latency Budget
--------------

- PDF extraction: <= 10s for 100-page text PDF (pdfcpu).
- LLM tagging: ~1.5-3s per chunk (15-30s for a 10-chunk source).
- Embedding: ~1-2s per batch.
- Total typical: 30-90s per source; UI shows progress_stage via jobs polling.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
