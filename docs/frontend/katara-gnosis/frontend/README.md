================================================================================
  KataraGnosis Frontend Documentation Index
================================================================================
  Module    : Frontend Domain
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
================================================================================

The frontend is a standalone Next.js 16 application living at
frontend/KataraGnosis (the repository's `web/KataraGnosis` on disk root is
`frontend/`). It mirrors the architecture, linting, and state conventions of
frontend/web (feature-based architecture, BFF proxies, React Query + Zustand,
Biome, Tailwind v4).

Documentation Index
-------------------

+--------------------------------------------------+--------------------------+
| Module                                           | Description              |
+--------------------------------------------------+--------------------------+
| infrastructure/routing.md                        | Routes, page-hook        |
|                                                  | pattern, shell.          |
| infrastructure/state-management.md               | Zustand stores, React    |
|                                                  | Query config.            |
| infrastructure/api-client.md                     | BFF proxy, auth cookie,  |
|                                                  | error normalization.     |
| application/patterns/feature-based-architecture.md| Feature module layout,  |
|                                                  | barrels, naming.         |
| application/patterns/editor-integration.md       | TipTap editor setup.     |
| application/features/auth.md                     | Login, guard, 401 flow.  |
| application/features/library.md                  | Notion-like library UI,  |
|                                                  | upload, reader, search.  |
| application/features/drill.md                    | Drill runner UX.         |
| application/features/dashboard-progress.md       | Dashboard + progress +   |
|                                                  | weekly sheet.            |
| design-system/tokens.md                          | Design tokens.           |
| design-system/components.md                      | UI kit inventory.        |
| design-system/tailwind.md                        | Tailwind v4 setup.       |
+--------------------------------------------------+--------------------------+

Language Convention
-------------------

- Code, types, variable names: English.
- UI copy (labels, buttons, empty states, toasts): Bahasa Indonesia.
  Example: "Mulai Sesi Hari Ini", "Target tercapai", "Kartu berhasil
  dibuat".

Verification Gates (enforced per anti-slop.md)
----------------------------------------------

  npx tsc --noEmit
  bun run build
  bun run lint        (biome check --write .)

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
