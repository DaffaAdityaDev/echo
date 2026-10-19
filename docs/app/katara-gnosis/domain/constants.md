# KataraGnosis Domain Constants & Routes

> Canonical constants, enums, defaults, and API endpoints for KataraGnosis.

---

## 1. Backend Route Constants (`katara-backend` Port 8090)

```go
package routes

const (
    // Standalone Authentication
    AuthRegister = "/api/v1/auth/register"
    AuthLogin    = "/api/v1/auth/login"
    AuthMe       = "/api/v1/auth/me"
    AuthLogout   = "/api/v1/auth/logout"

    // Knowledge Lakes
    KataraLakes      = "/api/v1/katara/lakes"
    KataraLakeDetail = "/api/v1/katara/lakes/:id"

    // Sources & Material Extraction
    KataraSources         = "/api/v1/katara/sources"
    KataraSourceDetail    = "/api/v1/katara/sources/:id"
    KataraSourceChunks    = "/api/v1/katara/sources/:id/chunks"
    KataraSourceReprocess = "/api/v1/katara/sources/:id/reprocess"

    // Flashcards & Semantic Retrieval
    KataraFlashcards      = "/api/v1/katara/flashcards"
    KataraFlashcardDetail = "/api/v1/katara/flashcards/:id"
    KataraFlashcardSearch = "/api/v1/katara/flashcards/search"

    // Spaced Drills & Practice Runner
    KataraDrills       = "/api/v1/katara/drills"
    KataraDrillDetail  = "/api/v1/katara/drills/:id"
    KataraDrillNext    = "/api/v1/katara/drills/:id/next"
    KataraDrillAnswer  = "/api/v1/katara/drills/:id/answer"
    KataraDrillResults = "/api/v1/katara/drills/:id/results"

    // Progress, Today Summary & Synthesis
    KataraToday                = "/api/v1/katara/today"
    KataraProgress             = "/api/v1/katara/progress"
    KataraSynthesisWeekly      = "/api/v1/katara/synthesis/weekly"
    KataraSynthesisWeeklyRegen = "/api/v1/katara/synthesis/weekly/regenerate"

    // User Settings & Job Tracking
    KataraSettings  = "/api/v1/katara/settings"
    KataraJobDetail = "/api/v1/katara/jobs/:id"
)
```

---

## 2. Domain Enums

### 2.1 Source Types & Statuses

- **Source Types**: `pdf`, `markdown`, `text`
- **Source Statuses**: `uploaded`, `processing`, `ready`, `failed`

### 2.2 Flashcard Archetypes

- `conceptual`: Regulatory definitions, core theories, legal articles.
- `procedural`: Multi-step processes, mathematical formulas, algorithms.
- `scenario`: Case studies, ethical dilemmas, decision analysis.

### 2.3 Question Types & Difficulties

- **Question Types**: `mcq`, `true_false`, `short_answer`, `scenario`
- **Difficulties**: `easy`, `medium`, `hard`

### 2.4 Hesitation Classes

- `mastered`: Response duration $\le 30\text{s}$ and correct.
- `hesitant`: Response duration $> 30\text{s}$ and correct.
- `impulsive`: Response duration $< 5\text{s}$ and incorrect.

### 2.5 SRS States (FSRS)

- `new`: Unattempted card.
- `learning`: In early review cycle.
- `review`: Scheduled long-term retention review.
- `relearning`: Lapsed card undergoing re-consolidation.

### 2.6 Background Job Types & Statuses

- **Job Types**: `ingest_source`, `reprocess_source`, `weekly_synthesis`
- **Job Statuses**: `queued`, `running`, `done`, `failed`

---

## 3. System Defaults

| Parameter                  | Default Value      | Description                                          |
| -------------------------- | ------------------ | ---------------------------------------------------- |
| `DefaultSessionSize`       | `10`               | Questions per daily drill session                    |
| `DefaultReviewRatio`       | `0.7`              | Proportion of due review cards (70%)                 |
| `DefaultNewRatio`          | `0.3`              | Proportion of new unlearned cards (30%)              |
| `DefaultTargetQuestions`   | `6`                | Minimum daily questions to keep streak               |
| `DefaultTargetScore`       | `60.0`             | Minimum score percentage to pass daily goal          |
| `DefaultGraceDays`         | `1`                | Permitted streak rest days per week                  |
| `DefaultGarageBucket`      | `inquizitive-docs` | Storage bucket for uploaded documents                |
| `DefaultBackendPort`       | `8090`             | Katara Go backend HTTP port                          |
| `DefaultFrontendPort`      | `3002`             | Katara Next.js web client HTTP port                  |
| `MaxLatencyClampMs`        | `1800000`          | Max latency recording ceiling (30 min)               |
| `MCQHesitationThresholdMs` | `30000`            | Latency boundary between mastered and hesitant (30s) |
