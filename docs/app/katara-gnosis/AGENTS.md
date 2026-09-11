<reference>docs/shared/patterns/acid-solid-clean-code.md</reference>
<reference>docs/shared/patterns/anti-slop.md</reference>
<reference>docs/app/katara-gnosis/README.md</reference>
<reference>docs/app/katara-gnosis/architecture.md</reference>
<reference>docs/app/katara-gnosis/daily-protocol.md</reference>
<reference>docs/app/katara-gnosis/shared/adr.md</reference>
<reference>docs/app/katara-gnosis/shared/contracts.md</reference>
<reference>docs/app/katara-gnosis/domain/models.md</reference>
<reference>docs/app/katara-gnosis/domain/constants.md</reference>
<reference>docs/app/katara-gnosis/frontend/README.md</reference>
<reference>docs/app/katara-gnosis/frontend/infrastructure/routing.md</reference>
<reference>docs/app/katara-gnosis/frontend/infrastructure/state-management.md</reference>
<reference>docs/app/katara-gnosis/frontend/infrastructure/api-client.md</reference>
<reference>docs/app/katara-gnosis/frontend/application/patterns/feature-based-architecture.md</reference>
<reference>docs/app/katara-gnosis/frontend/application/patterns/editor-integration.md</reference>
<reference>docs/app/katara-gnosis/frontend/application/features/auth.md</reference>
<reference>docs/app/katara-gnosis/frontend/design-system/tokens.md</reference>
<reference>docs/app/katara-gnosis/frontend/design-system/components.md</reference>
<reference>docs/app/katara-gnosis/frontend/design-system/tailwind.md</reference>
<reference>docs/app/katara-gnosis/backend/README.md</reference>
<reference>docs/app/katara-gnosis/backend/infrastructure/routing.md</reference>
<reference>docs/app/katara-gnosis/backend/infrastructure/database.md</reference>
<reference>docs/app/katara-gnosis/backend/infrastructure/worker.md</reference>
<reference>docs/app/katara-gnosis/backend/application/patterns/ingestion-pipeline.md</reference>
<reference>docs/app/katara-gnosis/infrastructure/env-contract.md</reference>
<reference>docs/app/katara-gnosis/infrastructure/docker-compose.md</reference>

# KataraGnosis System Agent Rules

KataraGnosis is a standalone learning and test-preparation platform located at `app/KataraGnosis/` with its own Go backend (`app/KataraGnosis/backend`) and Next.js frontend (`app/KataraGnosis/frontend`). All decisions are locked in `docs/app/katara-gnosis/` — read references BEFORE writing code.

## Non-Negotiable Rules

- **Standalone Service & Database**: Katara backend runs on port 8090 backed by `katara_db`. Echo backend is NOT touched.
- **Standalone Auth**: Katara backend manages its own `users` table and JWT issuance.
- **Fail-Hard Vector Infra**: Qdrant is required for semantic search; no SQL `ILIKE` fallback.
- **Docs-First**: Any contract, schema, or route change MUST update matching docs in `docs/app/katara-gnosis/`.
- **UI in Bahasa Indonesia**, code/comments in English.

## Verification Gates

| Layer                  | Directory                   | Verification Command |
| ---------------------- | --------------------------- | -------------------- |
| **Frontend Typecheck** | `app/KataraGnosis/frontend` | `npx tsc --noEmit`   |
| **Frontend Lint**      | `app/KataraGnosis/frontend` | `bun run lint`       |
| **Frontend Build**     | `app/KataraGnosis/frontend` | `bun run build`      |
| **Backend Build**      | `app/KataraGnosis/backend`  | `go build ./...`     |
| **Backend Vet**        | `app/KataraGnosis/backend`  | `go vet ./...`       |
