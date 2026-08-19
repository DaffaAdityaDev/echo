<reference>docs/shared/patterns/acid-solid-clean-code.md</reference>
<reference>docs/shared/patterns/anti-slop.md</reference>
<reference>docs/frontend/katara-gnosis/README.md</reference>
<reference>docs/frontend/katara-gnosis/architecture.md</reference>
<reference>docs/frontend/katara-gnosis/daily-protocol.md</reference>
<reference>docs/frontend/katara-gnosis/shared/adr.md</reference>
<reference>docs/frontend/katara-gnosis/shared/contracts.md</reference>

# KataraGnosis Agent Rules

KataraGnosis is a standalone Next.js learning-drill app (port 3002) backed by
the Echo Go backend. All design decisions are locked in `docs/` — read the
referenced docs BEFORE writing code and keep them in sync (docs-first).

## Non-Negotiable

- **Fail-hard infra**: Qdrant, GarageHQ, Redis, and the embedding provider
  are required. No ILIKE fallbacks, no silent degradation (ADR-01).
- **Docs-first**: any contract, pattern, or convention change MUST update
  the matching doc in `docs/` in the same change.
- **UI copy in Bahasa Indonesia**, code/API in English.
- **Both-or-neither persistence**: PG and Qdrant writes are atomic in
  intent; never persist without the vector (error-handling.md).
- **On-demand question generation** (ADR-03): generate per drill, cache in
  the `questions` table, reuse on reviews.

## Verification Gates (all must pass)

| Layer | Command |
|---|---|
| Frontend typecheck | `npx tsc --noEmit` (in frontend/KataraGnosis) |
| Frontend build | `bun run build` |
| Frontend lint | `bun run lint` (biome) |
| Backend (shared with echo) | `make test`, `golangci-lint run ./internal/...`, `go build` |

## Conventions

- Feature-based architecture (`docs/frontend/application/patterns/
  feature-based-architecture.md`): components/hooks/services/stores/types/
  constants per feature, barrel `index.ts`.
- BFF proxy only — the browser never calls the Go backend directly
  (`docs/frontend/infrastructure/api-client.md`).
- React Query for server state, Zustand for UI state, inline selectors,
  no wrapper-hook boilerplate.
- Tailwind v4 CSS-first tokens — never arbitrary hex literals in JSX.
- Strict TS: no `any` crossing service boundaries; map snake_case ->
  camelCase explicitly.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
