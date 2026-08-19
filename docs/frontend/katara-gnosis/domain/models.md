================================================================================
  KataraGnosis Data Models - ERD & JSONB Shapes
================================================================================
  Module    : Models
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

PostgreSQL remains the single source of truth. Qdrant holds only vectors and
retrieval payloads (never authoritative content). GarageHQ holds raw blobs.
All KataraGnosis tables are created in backend/internal/database/schema.go
(the authoritative schema file, executed at startup and by cmd/db/migrate).

Entity Relationship Diagram
---------------------------

  users (echo)
    │ 1 ── N
    ▼
  lakes ──1── N── sources ──1── N── flashcards ──1── N── questions
    │                    │                │
    │                    │                │            ┌─ srs_states (FSRS)
    │                    │                └──1── N─────┤
    │                    │                             └─ attempts
    │                    │                                │
    │                    │                                └── N ── 1 drill_sessions
    │                    │
    └── 1 ── N ─────────┴── jobs

  weekly_sheets (1 per user per week, derived from attempts)

Table Specifications
--------------------

### lakes

  Purpose: user-defined domain container (e.g., "PCPM Bank Indonesia",
  "Piano Theory", "System Design").

  +-------------+----------------+-------------------------------------------------+
  | Column      | Type           | Notes                                           |
  +-------------+----------------+-------------------------------------------------+
  | id          | UUID PK        |                                                 |
  | user_id     | INT NOT NULL   | FK users.id                                     |
  | name        | TEXT NOT NULL  | Display name                                   |
  | slug        | TEXT NOT NULL  | UNIQUE(user_id, slug)                          |
  | description | TEXT           |                                                 |
  | icon        | TEXT           | Emoji or lucide icon name                      |
  | status      | TEXT NOT NULL  | active | archived (CHECK)                        |
  | created_at  | TIMESTAMPTZ    |                                                 |
  | updated_at  | TIMESTAMPTZ    |                                                 |
  +-------------+----------------+-------------------------------------------------+

  Indexes: (user_id), UNIQUE(user_id, slug)

### sources

  Purpose: an uploaded blob and its processing state.

  +--------------+----------------+------------------------------------------------+
  | Column       | Type           | Notes                                          |
  +--------------+----------------+------------------------------------------------+
  | id           | UUID PK        |                                                |
  | lake_id      | UUID NOT NULL  | FK lakes.id                                    |
  | user_id      | INT NOT NULL   | FK users.id                                    |
  | title        | TEXT NOT NULL  |                                                |
  | source_type  | TEXT NOT NULL  | pdf | markdown | text (CHECK)                |
  | object_key   | TEXT NOT NULL  | Garage key: <user_id>/<source_id>.<ext>       |
  | mime_type    | TEXT           |                                                |
  | size_bytes   | BIGINT         |                                                |
  | char_count   | INT            | Extracted text length (set at atomize)        |
  | status       | TEXT NOT NULL  | uploaded|processing|ready|failed (CHECK)      |
  | error        | TEXT           | Last failure message (status=failed)          |
  | flashcard_count| INT NOT NULL DEFAULT 0 | Filled at atomize                     |
  | created_at   | TIMESTAMPTZ    |                                                |
  | updated_at   | TIMESTAMPTZ    |                                                |
  +--------------+----------------+------------------------------------------------+

  Indexes: (user_id), (lake_id), (status)

### flashcards

  Purpose: the atomic unit of knowledge and the FSRS item. Each flashcard
  carries AI-extracted metadata (domain, sub_topic, archetype, keypoints)
  that powers the Smart Feed, mastery matrix, and weak-spot logic.

  +--------------+----------------+------------------------------------------------+
  | Column       | Type           | Notes                                          |
  +--------------+----------------+------------------------------------------------+
  | id           | UUID PK        | Also used as Qdrant point ID.                  |
  | source_id    | UUID NOT NULL  | FK sources.id                                  |
  | lake_id      | UUID NOT NULL  | FK lakes.id                                    |
  | user_id      | INT NOT NULL   | FK users.id                                    |
  | content      | TEXT NOT NULL  | Atomic chunk (300-500 tokens).                |
  | domain       | TEXT NOT NULL  | AI-extracted domain label.                     |
  | sub_topic    | TEXT NOT NULL  | AI-extracted sub-topic label.                  |
  | archetype    | TEXT NOT NULL  | conceptual | procedural | scenario (CHECK)    |
  | keypoints    | JSONB NOT NULL | Array of 3-5 strings (AI-extracted facts).    |
  | position     | INT NOT NULL   | Order within the source.                       |
  | created_at   | TIMESTAMPTZ    |                                                |
  +--------------+----------------+------------------------------------------------+

  Indexes: (user_id, sub_topic), (lake_id), (source_id), UNIQUE(source_id, position)

  keypoints JSONB shape:

      [ "Instrumen utama kebijakan moneter BI adalah BI-Rate.",
        "Operasi Pasar Terbuka dilakukan melalui lelang SBN.",
        "Giro Wajib Minimum (GWM) adalah instrumen cadangan bank." ]

### questions

  Purpose: AI-generated (or manual) quiz questions. Generated on demand per
  drill and cached here; due-review repeats reuse the same row.

  +-------------------+----------------+----------------------------------------------+
  | Column            | Type           | Notes                                        |
  +-------------------+----------------+----------------------------------------------+
  | id                | UUID PK        |                                              |
  | flashcard_id      | UUID NULL      | FK flashcards.id (source of truth); NULL for |
  |                   |                | cross-domain synthesized questions.          |
  | lake_id           | UUID NOT NULL  | FK lakes.id                                  |
  | user_id           | INT NOT NULL   | FK users.id                                  |
  | question_type     | TEXT NOT NULL  | mcq|true_false|short_answer|scenario (CHECK) |
  | prompt            | JSONB NOT NULL | Question payload (below).                    |
  | difficulty        | TEXT NOT NULL  | easy | medium | hard (CHECK)                  |
  | explanation       | TEXT NOT NULL  | Correct-answer explanation (stored at         |
  |                   |                | generation -> instant feedback).             |
  | distractor_labels | JSONB NOT NULL | Per-option trap labels (below).              |
  | status            | TEXT NOT NULL  | active | retired (CHECK)                       |
  | source            | TEXT NOT NULL  | ai | manual (CHECK)                           |
  | created_at        | TIMESTAMPTZ    |                                              |
  +-------------------+----------------+----------------------------------------------+

  Indexes: (user_id), (lake_id), (flashcard_id), (status)

  prompt JSONB by type:

    mcq:
    {
      "text": "Apa instrumen utama kebijakan moneter Bank Indonesia?",
      "options": ["BI-Rate", "Tarif PPN", "Harga minyak", "Nilai tukar acak"],
      "correct_index": 0
    }
    true_false:
    { "text": "GWM adalah instrumen cadangan wajib bank.", "answer": true }
    short_answer:
    { "text": "Jelaskan mekanisme transmisi kebijakan moneter dalam 2 kalimat." }
    scenario:
    {
      "text": "Rupiah melemah akibat capital outflow. BI menaikkan BI-Rate. " +
              "Jelaskan trade-off terhadap sektor riil.",
      "sources": ["flashcard_id_a", "flashcard_id_b"]   // cross-domain exam
    }

  distractor_labels JSONB shape (per option index, mcq/true_false only;
  empty array for open types):

    [
      { "index": 1, "trap": "false_causation", "note": "Sebab-akibat terbalik." },
      { "index": 2, "trap": "extreme_generalization", "note": "Pernyataan 'selalu' tidak didukung." },
      { "index": 3, "trap": "partial_truth", "note": "Benar secara teori tapi tidak menjawab konteks." }
    ]

### attempts

  Purpose: one answer record; the raw material for progress and synthesis.

  +-------------------+------------------+-------------------------------------------+
  | Column            | Type             | Notes                                     |
  +-------------------+------------------+-------------------------------------------+
  | id                | BIGSERIAL PK     |                                           |
  | user_id           | INT NOT NULL     | FK users.id                               |
  | question_id       | UUID NOT NULL    | FK questions.id                           |
  | drill_session_id  | UUID NOT NULL    | FK drill_sessions.id                      |
  | answer            | JSONB NOT NULL   | selected_index | text | grade-request     |
  | is_correct        | BOOLEAN NOT NULL | TRUE for grade >= 4 (essay), partial       |
  |                   |                  | (grade 2-3) stored as is_correct=false +   |
  |                   |                  | ai_feedback.partial_credit=true            |
  | latency_ms        | INT NOT NULL     | Time from question shown to submit.        |
  | hesitation_class  | TEXT NOT NULL    | mastered|hesitant|impulsive (CHECK)        |
  | ai_feedback       | JSONB            | Essay grading result (below); NULL for     |
  |                   |                  | auto-checked objective questions.          |
  | created_at        | TIMESTAMPTZ      |                                           |
  +-------------------+------------------+-------------------------------------------+

  Indexes: (user_id, created_at), (question_id), (drill_session_id)

  ai_feedback JSONB shape (essay/scenario grading):

    {
      "grade": 4,                    // 1-5 rubric
      "partial_credit": false,
      "feedback": "Menjawab instrumen dengan benar, tapi melewatkan efek "
                  "terhadap sektor riil.",
      "follow_up": "Apa dampak kenaikan BI-Rate terhadap investasi dan "
                   "daya beli?",
      "key_principle": "Transmisi kebijakan moneter: suku bunga -> kredit -> "
                       "aktivitas ekonomi -> inflasi."
    }

### drill_sessions

  Purpose: one daily session; mix frozen at creation.

  +----------------+-----------------+--------------------------------------------+
  | Column         | Type            | Notes                                      |
  +----------------+-----------------+--------------------------------------------+
  | id             | UUID PK         |                                            |
  | user_id        | INT NOT NULL    | FK users.id                                |
  | date           | DATE NOT NULL   | Session calendar day (local tz).           |
  | mix            | JSONB NOT NULL  | Frozen mix definition (below).             |
  | total          | INT NOT NULL    | Questions served.                          |
  | correct        | INT NOT NULL    | Full-credit correct count.                 |
  | partial        | INT NOT NULL DEFAULT 0 | Partial-credit (grade 2-3) count.   |
  | score          | NUMERIC(5,2)    | 0-100 session score.                       |
  | duration_ms    | INT             | Total active time.                         |
  | completed_at   | TIMESTAMPTZ     | NULL while running.                        |
  | created_at     | TIMESTAMPTZ     |                                            |
  +----------------+-----------------+--------------------------------------------+

  Indexes: (user_id, date), UNIQUE(user_id, date, id)

  mix JSONB shape:

    {
      "size": 10,
      "review_ids": ["fc_1", "fc_2"],      // flashcard ids (due SRS)
      "new_ids":    ["fc_9", "fc_10"],     // flashcard ids (never drilled)
      "lake_weights": { "lake_uuid": 0.6, "lake_uuid_2": 0.4 }
    }

### srs_states

  Purpose: FSRS (go-fsrs) state per item; the schedule that builds the 70%
  review portion. item_type 'flashcard' drives review feed; item_type
  'question' optionally overrides per-question scheduling (v1: flashcard only).

  +------------------+----------------+--------------------------------------------+
  | Column           | Type           | Notes                                      |
  +------------------+----------------+--------------------------------------------+
  | user_id          | INT NOT NULL   |                                            |
  | item_type        | TEXT NOT NULL  | flashcard (CHECK; 'question' reserved)     |
  | item_id          | UUID NOT NULL  | FK flashcards.id                           |
  | due_at           | TIMESTAMPTZ    | When the item becomes eligible.            |
  | stability        | DOUBLE PRECISION NOT NULL | FSRS stability (days).            |
  | difficulty       | DOUBLE PRECISION NOT NULL | FSRS difficulty (1-10).           |
  | elapsed_days     | INT NOT NULL   | Days since last review.                    |
  | scheduled_days   | INT NOT NULL   | Interval just scheduled.                   |
  | reps             | INT NOT NULL   | Total reviews.                             |
  | lapses           | INT NOT NULL   | Times forgotten.                           |
  | state            | TEXT NOT NULL  | new | learning | review | relearning (CHECK) |
  | last_review_at   | TIMESTAMPTZ    |                                            |
  | created_at       | TIMESTAMPTZ    |                                            |
  +------------------+----------------+--------------------------------------------+

  PK: (user_id, item_type, item_id)

### jobs

  Purpose: Asynq task visibility + idempotency guard. The UI polls job status
  for upload progress.

  +------------+------------------+----------------------------------------------+
  | Column     | Type             | Notes                                        |
  +------------+------------------+----------------------------------------------+
  | id         | UUID PK          | Task id (asynq payload).                     |
  | user_id    | INT NOT NULL     |                                              |
  | type       | TEXT NOT NULL    | ingest_source|reprocess_source|             |
  |            |                  | weekly_synthesis (CHECK)                     |
  | ref_id     | UUID NULL        | source id or null for weekly_synthesis.      |
  | status     | TEXT NOT NULL    | queued|running|done|failed (CHECK)           |
  | error      | TEXT             |                                              |
  | created_at | TIMESTAMPTZ      |                                              |
  | updated_at | TIMESTAMPTZ      |                                              |
  +------------+------------------+----------------------------------------------+

  Indexes: (user_id, created_at DESC), (status)

### weekly_sheets

  Purpose: cached weekly Weakness Synthesis output.

  +------------+------------------+----------------------------------------------+
  | Column     | Type             | Notes                                        |
  +------------+------------------+----------------------------------------------+
  | user_id    | INT NOT NULL     |                                              |
  | week_start | DATE NOT NULL    | Monday of the sheet week.                    |
  | content    | JSONB NOT NULL   | { summary_md, weak_topics[], mistakes[] }    |
  | created_at | TIMESTAMPTZ      |                                              |
  +------------+------------------+----------------------------------------------+

  PK: (user_id, week_start)

Qdrant Collections
------------------

### katara_flashcards

  +-----------+---------------------+-----------------------------------------+
  | Field     | Value               | Notes                                   |
  +-----------+---------------------+-----------------------------------------+
  | id        | flashcard UUID      | Same id as flashcards.id                |
  | vector    | embedding (dims by  | Generated by EMBEDDING_PROVIDER.        |
  |           | provider, default   |                                        |
  |           | 768 gemini-embedding) |                                       |
  | payload   | { user_id,          | ALL searches MUST filter user_id.       |
  |           |   lake_id,          |                                        |
  |           |   source_id,        |                                        |
  |           |   domain,           |                                        |
  |           |   sub_topic,        |                                        |
  |           |   archetype,        |                                        |
  |           |   keypoints,        |                                        |
  |           |   content_preview } | Truncated content for search result     |
  |           |                     | display (first 200 chars).              |
  +-----------+---------------------+-----------------------------------------+

  Indexes: full-text disabled; scalar index on payload["user_id"],
  payload["sub_topic"].

### semantic_memory (migrated from echo pgvector)

  +-----------+---------------------+-----------------------------------------+
  | Field     | Value               | Notes                                   |
  +-----------+---------------------+-----------------------------------------+
  | id        | memory id (sem_*)   | Same id as memory_semantic.id in PG     |
  | vector    | embedding (provider | Generated server-side if request omits. |
  |           | dependent)          |                                        |
  | payload   | { content,          | Free-form metadata preserved.           |
  |           |   metadata,         |                                        |
  |           |   created_at }      |                                        |
  +-----------+---------------------+-----------------------------------------+

  The echo handler internal/handler/memory/semantic.go is rewritten to use
  Qdrant exclusively. There is NO ILIKE fallback (see shared/adr.md, ADR-01).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
