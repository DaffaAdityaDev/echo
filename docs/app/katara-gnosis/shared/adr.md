# KataraGnosis Architecture Decision Records (ADRs)

---

## ADR-001: Exclusive Use of Qdrant for Vector Operations (Fail-Hard Infra)

- **Status**: Accepted
- **Context**: Semantic search and flashcard vector retrieval require low-latency similarity operations.
- **Decision**: Katara flashcard embeddings live exclusively in Qdrant (`katara_flashcards` collection). If Qdrant is unavailable, semantic search returns HTTP 503 rather than silently degrading to SQL `ILIKE` queries.
- **Consequences**: Strict infrastructure requirement; clean separation between vector search and relational state.

---

## ADR-002: Next.js 16 App Router & BFF Architecture

- **Status**: Accepted
- **Context**: Browser client requires secure authentication handling, CSRF protection, and centralized API routing.
- **Decision**: The frontend runs Next.js 16 on port 3002. All browser requests pass through internal BFF route handlers (`app/api/*`) which forward to the Go backend (`http://localhost:8090`).
- **Consequences**: The browser never directly contacts port 8090. Cookies remain `httpOnly`.

---

## ADR-003: Single 7-Day JWT Authentication Cookie

- **Status**: Accepted
- **Context**: Katara learning sessions are intensive daily routines. Frequent token expiration disrupts review streaks.
- **Decision**: Katara uses a single 7-day HMAC-SHA256 JWT stored in an `httpOnly` cookie (`auth_token`), omitting the complex access/refresh token pair.
- **Consequences**: Simple token management; transparent session persistence.

---

## ADR-004: Standalone Go Fiber Backend Service & Database (Reversal)

- **Status**: Accepted (Replaces former embedded route design)
- **Context**: The Echo backend is strictly an AI agent harness. Mixing domain-specific learning tables, FSRS schedulers, and drill queues inside Echo creates unwanted coupling and schema bloat.
- **Decision**: Katara operates as a standalone Go service (`katara-backend`, port 8090) with its own database (`katara_db`). Echo backend remains pure and untouched.
- **Consequences**: Total architectural independence; independent deployment lifecycle and zero blast radius on Echo core.

---

## ADR-005: Dedicated App Folder Location (`app/KataraGnosis`)

- **Status**: Accepted
- **Context**: Monorepo applications reside under `app/`.
- **Decision**: Katara is located at `app/KataraGnosis/` containing `frontend/` (Next.js) and `backend/` (Go service).
- **Consequences**: Clean organization consistent with other monorepo apps (`app/web`, `app/dekstop`, `app/discord`).

---

## ADR-006: Tailwind CSS v4 CSS-First Design Tokens

- **Status**: Accepted
- **Context**: Consistent dark palette and visual hierarchy across all learning interfaces.
- **Decision**: Tokens are declared verbatim in `globals.css` via `@theme inline`. Hand-rolled custom primitives are built rather than relying on heavy component libraries.
- **Consequences**: Zero stylesheet bloat, fast Turbopack compilation, predictable custom styling.

---

## ADR-007: TipTap v2 Block Editor for Extractions & Notes

- **Status**: Accepted
- **Context**: Users require rich formatting, mathematical equations, task lists, and quick slash commands for learning notes.
- **Decision**: TipTap v2 is used on the client-side (`dynamic(..., { ssr: false })`) with 1.5s debounced auto-save.
- **Consequences**: Rich interactive editor with zero server-side rendering hydration mismatches.

---

## ADR-008: FSRS + Latency Hesitation Scoring

- **Status**: Accepted
- **Context**: Standard SRS algorithms (e.g. SM-2) only record subjective recall grades (1-5).
- **Decision**: Katara implements FSRS combined with millisecond response latency tracking. Answers are classified into `mastered`, `hesitant`, and `impulsive` to detect false confidence.
- **Consequences**: Precise memory retention modeling and actionable weakness analytics.

---

## ADR-009: Standalone Mandiri Authentication

- **Status**: Accepted
- **Context**: Katara operates independently of Echo's authentication server.
- **Decision**: The Katara backend maintains its own `users` table (`id`, `email`, `password_hash`, `name`, `role`, `tier`) and provides `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/logout`.
- **Consequences**: Full authentication autonomy for Katara users.
