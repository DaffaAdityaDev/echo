# KataraGnosis Domain Models & Database Schema

> Relational data models stored in PostgreSQL database `katara_db`.

---

## 1. Relational Entity Diagram

```
users (id) ──┬──< katara_lakes (id) ──┬──< katara_sources (id) ──< katara_flashcards (id)
             │                        │                                   │
             │                        └───────────────────────────────────┤
             │                                                            ▼
             ├──< katara_drill_sessions (id) ──< katara_attempts ──> katara_srs_states
             │                                          │
             ├──< katara_questions (id) ────────────────┘
             │
             ├──< katara_jobs (id)
             ├──< katara_weekly_sheets (id)
             └──< katara_user_settings (user_id)
```

---

## 2. Table Specifications

### 2.1 `users`

| Column          | Type          | Constraints               | Description            |
| --------------- | ------------- | ------------------------- | ---------------------- |
| `id`            | `BIGSERIAL`   | `PRIMARY KEY`             | Unique Katara user ID  |
| `email`         | `TEXT`        | `UNIQUE NOT NULL`         | Login email address    |
| `password_hash` | `TEXT`        | `NOT NULL`                | Bcrypt hashed password |
| `name`          | `TEXT`        | `NOT NULL`                | User full display name |
| `role`          | `TEXT`        | `NOT NULL DEFAULT 'user'` | `user` or `admin`      |
| `tier`          | `TEXT`        | `NOT NULL DEFAULT 'free'` | `free` or `pro`        |
| `created_at`    | `TIMESTAMPTZ` | `DEFAULT NOW()`           | Registration timestamp |
| `updated_at`    | `TIMESTAMPTZ` | `DEFAULT NOW()`           | Last update timestamp  |

### 2.2 `katara_lakes`

| Column        | Type          | Constraints                              | Description                             |
| ------------- | ------------- | ---------------------------------------- | --------------------------------------- |
| `id`          | `TEXT`        | `PRIMARY KEY`                            | e.g. `lake_<uuid>`                      |
| `user_id`     | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE` | Owner user ID                           |
| `name`        | `TEXT`        | `NOT NULL`                               | Lake title (e.g. "PCPM Bank Indonesia") |
| `slug`        | `TEXT`        | `NOT NULL`                               | URL slug                                |
| `description` | `TEXT`        | `NULLABLE`                               | Domain overview                         |
| `icon`        | `TEXT`        | `NULLABLE`                               | Lucide icon name                        |
| `status`      | `TEXT`        | `DEFAULT 'active'`                       | `active` or `archived`                  |
| `created_at`  | `TIMESTAMPTZ` | `DEFAULT NOW()`                          | Creation timestamp                      |
| `updated_at`  | `TIMESTAMPTZ` | `DEFAULT NOW()`                          | Update timestamp                        |

### 2.3 `katara_sources`

| Column        | Type          | Constraints                                     | Description                                 |
| ------------- | ------------- | ----------------------------------------------- | ------------------------------------------- |
| `id`          | `TEXT`        | `PRIMARY KEY`                                   | e.g. `src_<uuid>`                           |
| `lake_id`     | `TEXT`        | `REFERENCES katara_lakes(id) ON DELETE CASCADE` | Parent Lake ID                              |
| `user_id`     | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE`        | Owner user ID                               |
| `title`       | `TEXT`        | `NOT NULL`                                      | Source material title                       |
| `source_type` | `TEXT`        | `NOT NULL DEFAULT 'text'`                       | `pdf`, `markdown`, `text`                   |
| `object_key`  | `TEXT`        | `NOT NULL`                                      | GarageHQ S3 object key                      |
| `mime_type`   | `TEXT`        | `NULLABLE`                                      | MIME type                                   |
| `size_bytes`  | `BIGINT`      | `NULLABLE`                                      | Document size in bytes                      |
| `char_count`  | `INT`         | `DEFAULT 0`                                     | Extracted character count                   |
| `status`      | `TEXT`        | `DEFAULT 'uploaded'`                            | `uploaded`, `processing`, `ready`, `failed` |
| `error`       | `TEXT`        | `NULLABLE`                                      | Ingestion error details if failed           |
| `notes_html`  | `TEXT`        | `NULLABLE`                                      | Additional TipTap user notes                |
| `created_at`  | `TIMESTAMPTZ` | `DEFAULT NOW()`                                 | Upload timestamp                            |
| `updated_at`  | `TIMESTAMPTZ` | `DEFAULT NOW()`                                 | Update timestamp                            |

### 2.4 `katara_flashcards`

| Column            | Type          | Constraints                                        | Description                            |
| ----------------- | ------------- | -------------------------------------------------- | -------------------------------------- |
| `id`              | `TEXT`        | `PRIMARY KEY`                                      | e.g. `fc_<uuid>`                       |
| `source_id`       | `TEXT`        | `REFERENCES katara_sources(id) ON DELETE SET NULL` | Origin source ID                       |
| `lake_id`         | `TEXT`        | `REFERENCES katara_lakes(id) ON DELETE CASCADE`    | Parent Lake ID                         |
| `user_id`         | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE`           | Owner user ID                          |
| `content`         | `TEXT`        | `NOT NULL`                                         | Atomic material text (300-500 tokens)  |
| `domain`          | `TEXT`        | `NOT NULL`                                         | Knowledge domain                       |
| `sub_topic`       | `TEXT`        | `NOT NULL`                                         | Sub-topic label                        |
| `archetype`       | `TEXT`        | `NOT NULL DEFAULT 'conceptual'`                    | `conceptual`, `procedural`, `scenario` |
| `keypoints`       | `JSONB`       | `DEFAULT '[]'`                                     | List of core fact strings              |
| `position`        | `INT`         | `DEFAULT 0`                                        | Ordering within source                 |
| `qdrant_point_id` | `TEXT`        | `NULLABLE`                                         | Point UUID in Qdrant                   |
| `created_at`      | `TIMESTAMPTZ` | `DEFAULT NOW()`                                    | Creation timestamp                     |
| `updated_at`      | `TIMESTAMPTZ` | `DEFAULT NOW()`                                    | Update timestamp                       |

### 2.5 `katara_srs_states`

| Column             | Type          | Constraints                                          | Description                               |
| ------------------ | ------------- | ---------------------------------------------------- | ----------------------------------------- |
| `id`               | `TEXT`        | `PRIMARY KEY`                                        | e.g. `srs_<fc_uuid>`                      |
| `flashcard_id`     | `TEXT`        | `REFERENCES katara_flashcards(id) ON DELETE CASCADE` | Flashcard ID                              |
| `user_id`          | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE`             | User ID                                   |
| `due_at`           | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()`                             | Next review due timestamp                 |
| `stability`        | `FLOAT`       | `NOT NULL DEFAULT 0.4`                               | FSRS memory stability (days)              |
| `difficulty`       | `FLOAT`       | `NOT NULL DEFAULT 4.0`                               | FSRS difficulty (1.0 - 10.0)              |
| `elapsed_days`     | `INT`         | `DEFAULT 0`                                          | Days since last review                    |
| `scheduled_days`   | `INT`         | `DEFAULT 0`                                          | Scheduled interval                        |
| `reps`             | `INT`         | `DEFAULT 0`                                          | Total review count                        |
| `lapses`           | `INT`         | `DEFAULT 0`                                          | Total forgetting count                    |
| `state`            | `TEXT`        | `DEFAULT 'new'`                                      | `new`, `learning`, `review`, `relearning` |
| `last_reviewed_at` | `TIMESTAMPTZ` | `NULLABLE`                                           | Last review timestamp                     |
| `created_at`       | `TIMESTAMPTZ` | `DEFAULT NOW()`                                      | Initial creation                          |
| `updated_at`       | `TIMESTAMPTZ` | `DEFAULT NOW()`                                      | Last update                               |

### 2.6 `katara_drill_sessions`

| Column         | Type          | Constraints                                            | Description                    |
| -------------- | ------------- | ------------------------------------------------------ | ------------------------------ |
| `id`           | `TEXT`        | `PRIMARY KEY`                                          | e.g. `sess_<uuid>`             |
| `user_id`      | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE`               | User ID                        |
| `date`         | `DATE`        | `NOT NULL DEFAULT CURRENT_DATE`                        | Session calendar date          |
| `mix`          | `JSONB`       | `DEFAULT '{"size":10,"review_count":7,"new_count":3}'` | Session composition            |
| `total`        | `INT`         | `DEFAULT 0`                                            | Total questions served         |
| `correct`      | `INT`         | `DEFAULT 0`                                            | Total correct answers          |
| `partial`      | `INT`         | `DEFAULT 0`                                            | Total partial credits          |
| `score`        | `FLOAT`       | `NULLABLE`                                             | Final percentage score (0-100) |
| `completed_at` | `TIMESTAMPTZ` | `NULLABLE`                                             | Completion timestamp           |
| `created_at`   | `TIMESTAMPTZ` | `DEFAULT NOW()`                                        | Start timestamp                |

### 2.7 `katara_attempts`

| Column             | Type          | Constraints                                              | Description                         |
| ------------------ | ------------- | -------------------------------------------------------- | ----------------------------------- |
| `id`               | `TEXT`        | `PRIMARY KEY`                                            | e.g. `att_<uuid>`                   |
| `drill_session_id` | `TEXT`        | `REFERENCES katara_drill_sessions(id) ON DELETE CASCADE` | Drill session ID                    |
| `question_id`      | `TEXT`        | `REFERENCES katara_questions(id) ON DELETE CASCADE`      | Question ID                         |
| `user_id`          | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE`                 | User ID                             |
| `flashcard_id`     | `TEXT`        | `REFERENCES katara_flashcards(id) ON DELETE SET NULL`    | Target card ID                      |
| `selected_index`   | `INT`         | `NULLABLE`                                               | MCQ selected option index           |
| `text_answer`      | `TEXT`        | `NULLABLE`                                               | Short answer / essay text           |
| `bool_answer`      | `BOOLEAN`     | `NULLABLE`                                               | True/False answer                   |
| `is_correct`       | `BOOLEAN`     | `NOT NULL DEFAULT FALSE`                                 | Accuracy boolean                    |
| `partial_credit`   | `BOOLEAN`     | `NOT NULL DEFAULT FALSE`                                 | Partial credit flag                 |
| `latency_ms`       | `INT`         | `NOT NULL DEFAULT 0`                                     | Response duration in ms             |
| `hesitation_class` | `TEXT`        | `NOT NULL DEFAULT 'mastered'`                            | `mastered`, `hesitant`, `impulsive` |
| `ai_feedback`      | `JSONB`       | `NULLABLE`                                               | LLM evaluation details              |
| `answered_at`      | `TIMESTAMPTZ` | `DEFAULT NOW()`                                          | Submission timestamp                |

### 2.8 `katara_jobs`

| Column           | Type          | Constraints                              | Description                                             |
| ---------------- | ------------- | ---------------------------------------- | ------------------------------------------------------- |
| `id`             | `TEXT`        | `PRIMARY KEY`                            | e.g. `job_<uuid>`                                       |
| `user_id`        | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE` | User ID                                                 |
| `type`           | `TEXT`        | `NOT NULL`                               | `ingest_source`, `reprocess_source`, `weekly_synthesis` |
| `status`         | `TEXT`        | `DEFAULT 'queued'`                       | `queued`, `running`, `done`, `failed`                   |
| `progress_stage` | `TEXT`        | `NULLABLE`                               | Human-readable pipeline step                            |
| `error`          | `TEXT`        | `NULLABLE`                               | Error message if failed                                 |
| `created_at`     | `TIMESTAMPTZ` | `DEFAULT NOW()`                          | Enqueued timestamp                                      |
| `updated_at`     | `TIMESTAMPTZ` | `DEFAULT NOW()`                          | Last update                                             |

### 2.9 `katara_weekly_sheets`

| Column       | Type          | Constraints                              | Description                             |
| ------------ | ------------- | ---------------------------------------- | --------------------------------------- |
| `id`         | `TEXT`        | `PRIMARY KEY`                            | e.g. `sheet_<uuid>`                     |
| `user_id`    | `BIGINT`      | `REFERENCES users(id) ON DELETE CASCADE` | User ID                                 |
| `week_start` | `DATE`        | `NOT NULL`                               | Monday date of review week              |
| `content`    | `JSONB`       | `NOT NULL`                               | `{ summary_md, weak_topics, mistakes }` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()`                          | Generation timestamp                    |

### 2.10 `katara_user_settings`

| Column              | Type          | Constraints                                          | Description                          |
| ------------------- | ------------- | ---------------------------------------------------- | ------------------------------------ |
| `user_id`           | `BIGINT`      | `PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE` | User ID                              |
| `session_size`      | `INT`         | `NOT NULL DEFAULT 10`                                | Daily drill count (5-50)             |
| `target_questions`  | `INT`         | `NOT NULL DEFAULT 6`                                 | Min daily questions for streak       |
| `target_score`      | `FLOAT`       | `NOT NULL DEFAULT 60.0`                              | Min daily average score              |
| `grace_days`        | `INT`         | `NOT NULL DEFAULT 1`                                 | Allowed weekly missed days (0-3)     |
| `review_multiplier` | `FLOAT`       | `NOT NULL DEFAULT 1.0`                               | FSRS interval multiplier (0.7 - 1.5) |
| `created_at`        | `TIMESTAMPTZ` | `DEFAULT NOW()`                                      | Creation timestamp                   |
| `updated_at`        | `TIMESTAMPTZ` | `DEFAULT NOW()`                                      | Last update                          |
