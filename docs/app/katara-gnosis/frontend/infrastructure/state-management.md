# Katara Frontend: State Management Architecture

> Server state caching rules with TanStack React Query v5 and client stores with Zustand v5.

---

## 1. Query Keys Factory

Defined centrally in `src/constants/query-keys.ts`:

- `QUERY_KEYS.auth.me()`
- `QUERY_KEYS.lakes.all()` / `QUERY_KEYS.lakes.detail(id)`
- `QUERY_KEYS.sources.all(filters)` / `QUERY_KEYS.sources.detail(id)` / `QUERY_KEYS.sources.chunks(id)`
- `QUERY_KEYS.flashcards.all(filters)` / `QUERY_KEYS.flashcards.detail(id)`
- `QUERY_KEYS.drills.detail(id)` / `QUERY_KEYS.drills.next(id)` / `QUERY_KEYS.drills.results(id)`
- `QUERY_KEYS.today()`
- `QUERY_KEYS.progress()`
- `QUERY_KEYS.synthesis.weekly()`
- `QUERY_KEYS.settings()`
- `QUERY_KEYS.jobs.detail(id)`

---

## 2. Invalidation Maps

| Mutation                  | Invalidation Target                                                     |
| ------------------------- | ----------------------------------------------------------------------- |
| Create / Delete Lake      | `lakes.all()`, `today()`, `progress()`                                  |
| Upload / Delete Source    | `sources.all()`, `lakes.all()`, `today()`, `progress()`                 |
| Create / Update Flashcard | `sources.chunks(sourceId)`, `flashcards.all()`, `today()`, `progress()` |
| Submit Drill Answer       | `drills.next(sessionId)`, `today()`, `progress()`                       |
| Regenerate Weekly Sheet   | `synthesis.weekly()`                                                    |
| Update Settings           | `settings()`, `today()`                                                 |

---

## 3. Zustand UI Stores

- `authStore`: Current user object and authentication flag.
- `drillStore`: Active practice runner transient state (current question, timer start, last feedback, results, generating flag).
- `settingsStore`: Local copy of user preference inputs.
