================================================================================
  KataraGnosis Backend Database
================================================================================
  Module    : Database
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

KataraGnosis tables are added to backend/internal/database/schema.go — the
single authoritative schema file executed at startup and by cmd/db/migrate.
Tables are plain names per ADR-04 extension of the existing echo schema
(users, sessions, ...). Full column definitions live in domain/models.md.

What Is Added
-------------

  1. New tables: lakes, sources, flashcards, questions, attempts,
     drill_sessions, srs_states, jobs, weekly_sheets.
  2. CHECK constraints for every enum column (duplicated from
     domain/constants.md).
  3. Indexes listed per table in domain/models.md.
  4. Extension note: pgvector remains installed for legacy memory_semantic
     column; KataraGnosis does NOT use it (Qdrant owns vectors).
  5. A startup verification block that checks Qdrant reachability when
     QDRANT_URL is set and logs a fatal error if unreachable (fail-hard,
     see shared/error-handling.md). The same check runs for GarageHQ.

ACID Requirements (from acid-solid-clean-code.md)
-------------------------------------------------

Multi-statement sequences MUST run in one transaction:

+-----------------------------------------------+-----------------------------------+
| Sequence                                      | Transaction scope                |
+-----------------------------------------------+-----------------------------------+
| Finish atomize: insert flashcards + update    | 1 tx (insert flashcards, set     |
| sources.status + flashcard_count + char_count | sources.status=ready, counts)    |
+-----------------------------------------------+-----------------------------------+
| Delete source: delete flashcards + srs_states | 1 tx; Qdrant + Garage deletes    |
| + questions + attempts + source row           | happen after commit (best-       |
|                                               | effort, logged on failure)       |
+-----------------------------------------------+-----------------------------------+
| Record answer: insert attempt + update        | 1 tx (attempt + drill_sessions   |
| drill_sessions totals + upsert srs_state      | counters + FSRS state)           |
+-----------------------------------------------+-----------------------------------+
| Create drill: insert drill_sessions (mix)     | 1 tx (no other writes)           |
+-----------------------------------------------+-----------------------------------+

Pattern:

  tx, err := pool.Begin(ctx)
  if err != nil { return fmt.Errorf("tx begin: %w", err) }
  defer tx.Rollback(ctx)
  ... tx.Exec(ctx, ...)
  return tx.Commit(ctx)

Context & Timeout
-----------------

- Every DB call uses a context with timeout (10s default; 30s for atomize
  batch inserts).
- Background worker operations (ingest) use context.Background() derived
  contexts with generous timeouts (2 min per stage) — writes must survive
  the HTTP request lifecycle.

Concurrency
-----------

- Asynq processes one ingest task per source at a time; job table + status
  transitions (queued -> running -> done|failed) guard against double
  processing. A source in status processing rejects a second ingest enqueue
  (409).
- srs_state upserts are single-row; no session-level locks needed.

Anti-Patterns To Avoid
----------------------

- No N+1: list endpoints JOIN lake/source aggregates (flashcard_count,
  question_count) in one query.
- No string interpolation in SQL — pgx parameterized queries only.
- No silent fallbacks in KataraGnosis queries (fail-hard).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
