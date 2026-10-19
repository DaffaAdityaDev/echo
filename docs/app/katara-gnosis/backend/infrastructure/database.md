# Katara Backend: Database Architecture

> PostgreSQL database connection pooling and schema management for `katara_db`.

---

## 1. Connection & Pooling (`pgxpool`)

Katara backend connects directly to PostgreSQL database `katara_db` using `github.com/jackc/pgx/v5/pgxpool`.

- **Environment Variable**: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/katara_db?sslmode=disable`
- **Pool Configuration**:
  - `MaxConns`: 25
  - `MinConns`: 5
  - `MaxConnLifetime`: 1 hour
  - `MaxConnIdleTime`: 30 minutes

---

## 2. Schema Lifecycle & Migrations

All DDL definitions are declared in `app/KataraGnosis/backend/internal/database/schema.go`.
On service startup, `Migrate(ctx, pool)` automatically executes idempotent `CREATE TABLE IF NOT EXISTS` and index creation statements.

### Key Database Tables

- `users`: User credentials and roles.
- `katara_lakes`: Knowledge domain containers.
- `katara_sources`: Ingested document records.
- `katara_flashcards`: Atomic conceptual knowledge units.
- `katara_srs_states`: FSRS parameters per card.
- `katara_questions`: Served drill items.
- `katara_drill_sessions`: Daily and custom drill session records.
- `katara_attempts`: Individual user answer submissions and latencies.
- `katara_jobs`: Background ingestion and synthesis tasks.
- `katara_weekly_sheets`: AI synthesized weekly reports.
- `katara_user_settings`: User practice thresholds and FSRS multipliers.
