================================================================================
  KataraGnosis Constants & Enums
================================================================================
  Module    : Constants
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

All KataraGnosis enums and defaults live in
backend/internal/constants/katara/ (Go) and frontend constants files
(frontend features' constants.ts). Database shape is enforced by CHECK
constraints (never trust application validation alone — see
acid-solid-clean-code.md).

Enums
-----

### source_type (sources.source_type)

+------------+-------------------------------------------------------------+
| Value      | Meaning                                                     |
+------------+-------------------------------------------------------------+
| pdf        | PDF document; text extracted via pdfcpu.                    |
| markdown   | Markdown text; chunked by headings.                         |
| text       | Plain text; chunked by paragraphs.                          |
+------------+-------------------------------------------------------------+

### source.status (sources.status)

+------------+-------------------------------------------------------------+
| Value      | Meaning                                                     |
+------------+-------------------------------------------------------------+
| uploaded   | Blob stored in Garage; job not yet consumed.                |
| processing | Asynq ingest task running.                                  |
| ready      | Flashcards + Qdrant upserts complete.                       |
| failed     | Pipeline errored; `error` column holds message.             |
+------------+-------------------------------------------------------------+

### archetype (flashcards.archetype)

+------------+-------------------------------------------------------------+
| Value      | Meaning                                                     |
+------------+-------------------------------------------------------------+
| conceptual | Definitions, theory, regulation, history.                   |
| procedural | Formulas, syntax, step-by-step rules (e.g., chord           |
|            | progressions, TKD arithmetic).                              |
| scenario   | Case studies, ethics (AKHLAK), interpretation exercises.    |
+------------+-------------------------------------------------------------+

Archetype drives question-type bias during generation (see
backend/application/features/drills.md).

### question_type (questions.question_type)

+--------------+-----------------------------------------------------------+
| Value        | Meaning                                                   |
+--------------+-----------------------------------------------------------+
| mcq          | Multiple choice, 4 options, instant auto-check.           |
| true_false   | True/false, instant auto-check.                           |
| short_answer | Open text, AI-graded 1-5 (rubric).                        |
| scenario     | Case study, AI-graded 1-5, may cross domains.             |
+--------------+-----------------------------------------------------------+

### question.difficulty

+--------+------------------------------------------------------------------+
| Value  | Weight (session scoring)                                        |
+--------+------------------------------------------------------------------+
| easy   | 1.00                                                             |
| medium | 1.10                                                             |
| hard   | 1.25                                                             |
+--------+------------------------------------------------------------------+

### hesitation_class (attempts.hesitation_class)

+------------+-------------------------------------------------------------+
| Value      | Meaning (see daily-protocol.md Latency Classification)       |
+------------+-------------------------------------------------------------+
| mastered   | <= 30s and correct.                                          |
| hesitant   | > 30s (either result) or 30-60s correct.                     |
| impulsive  | <= 30s and wrong.                                            |
+------------+-------------------------------------------------------------+

### srs_states.state (FSRS)

+-------------+------------------------------------------------------------+
| Value       | Meaning                                                    |
+-------------+------------------------------------------------------------+
| new         | Never reviewed.                                            |
| learning    | First exposure / short intervals.                          |
| review      | Normal scheduled reviews.                                  |
| relearning  | Re-introduced after a lapse.                               |
+-------------+------------------------------------------------------------+

### job.type (jobs.type)

+-------------------+--------------------------------------------------------+
| Value             | Meaning                                                |
+-------------------+--------------------------------------------------------+
| ingest_source     | Full ingestion pipeline for a source.                  |
| reprocess_source  | Re-run atomization (retag / re-embed).                 |
| weekly_synthesis  | Generate the weekly Weakness Synthesis Sheet.          |
+-------------------+--------------------------------------------------------+

### job.status (jobs.status)

+---------+------------------------------------------------------------------+
| Value   | Meaning                                                          |
+---------+------------------------------------------------------------------+
| queued  | Enqueued in Asynq, not started.                                 |
| running | In progress.                                                     |
| done    | Completed.                                                       |
| failed  | Failed; `error` populated; retryable jobs re-enqueue (max 3).   |
+---------+------------------------------------------------------------------+

### distractor trap labels (questions.distractor_labels[].trap)

+------------------------+-------------------------------------------------+
| Value                  | Meaning                                         |
+------------------------+-------------------------------------------------+
| false_causation        | Wrong cause-effect relation.                    |
| extreme_generalization | Absolute wording ("selalu", "pasti", "semua").  |
| partial_truth          | Theoretically true but irrelevant to the prompt.|
| out_of_scope           | Outside the knowledge domain of the question.   |
+------------------------+-------------------------------------------------+

Defaults
--------

+-----------------------------+------------------------------------------------+
| Constant                    | Default                                        |
+-----------------------------+------------------------------------------------+
| Drill session size          | 10                                             |
| Smart feed review ratio     | 0.7                                            |
| Target daily questions      | 6                                              |
| Target score threshold      | 60                                             |
| Grace days per week         | 1                                              |
| Chunk target size           | 300-500 tokens                                 |
| Keypoints per flashcard     | 3-5                                            |
| Qdrant search limit (default)| 10                                             |
| MCQ latency thresholds      | mastered <= 30000ms, impulsive < 30000ms       |
| Essay grade pass            | >= 4                                           |
| Garage bucket               | inquizitive-docs                               |
+-----------------------------+------------------------------------------------+

Route Constants
---------------

Backend (internal/constants/routes/katara.go):

  /api/v1/katara/lakes
  /api/v1/katara/lakes/:id
  /api/v1/katara/lakes/:id/sources
  /api/v1/katara/sources
  /api/v1/katara/sources/:id
  /api/v1/katara/sources/:id/chunks          (flashcards of a source)
  /api/v1/katara/sources/:id/reprocess
  /api/v1/katara/flashcards
  /api/v1/katara/flashcards/search           (semantic search)
  /api/v1/katara/drills
  /api/v1/katara/drills/:id
  /api/v1/katara/drills/:id/next
  /api/v1/katara/drills/:id/answer
  /api/v1/katara/drills/:id/results
  /api/v1/katara/today
  /api/v1/katara/progress
  /api/v1/katara/synthesis/weekly
  /api/v1/katara/jobs/:id
  /api/v1/internal/embeddings                (service-to-service, general)

Full payloads in shared/contracts.md.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
