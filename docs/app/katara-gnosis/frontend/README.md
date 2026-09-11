# KataraGnosis Frontend Layer

> Next.js 16 web application located at `app/KataraGnosis/frontend/` running on port 3002.

---

## 1. Stack & Specifications

- **Framework**: Next.js 16.2.6 (App Router, Turbopack, Standalone mode)
- **Runtime**: React 19.2.4 + TypeScript 7.0.2
- **Styling**: Tailwind CSS v4 (@theme inline tokens, hand-rolled UI kit)
- **Editor**: TipTap v2 block editor (client-side only, 1.5s debounced auto-save)
- **State Management**: TanStack React Query v5 (Server State) + Zustand v5 (UI State)
- **Math & Markdown**: KaTeX + react-markdown
- **Linter & Formatter**: Biome 2.5.5

---

## 2. Directory Structure

```
app/KataraGnosis/frontend/src/
├── app/                          # App Router Pages & BFF Route Handlers
│   ├── (katara)/                 # Authenticated Shell layout (Sidebar + Header)
│   │   ├── drill/[sessionId]/    # Full-screen Practice Runner
│   │   ├── library/              # Knowledge Lake & Document Browser
│   │   ├── progress/             # Mastery Matrix & Weekly Synthesis
│   │   ├── settings/             # Practice Configuration
│   │   └── page.tsx              # Dashboard & Daily Goal Feed
│   ├── api/                      # BFF Proxies forwarding to Go Backend (8090)
│   ├── login/                    # Authentication (Login / Register)
│   └── globals.css               # @theme inline Design Tokens
├── components/ui/                # 15 Base Primitives (Button, Modal, Input, etc.)
├── features/                     # Domain modules (auth, library, drill, progress, settings)
├── lib/                          # api-client, proxy-fetch, query-standard
└── utils/                        # cn, error helpers
```

---

## 3. Documentation Map

| Category           | File                                                                                                                                                                 | Description                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Infrastructure** | [infrastructure/api-client.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/infrastructure/api-client.md)                                             | Centralized fetch wrapper & BFF proxy architecture            |
| **Infrastructure** | [infrastructure/routing.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/infrastructure/routing.md)                                                   | Next.js App Router layout & full-screen routes                |
| **Infrastructure** | [infrastructure/state-management.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/infrastructure/state-management.md)                                 | TanStack Query v5 cache rules & Zustand stores                |
| **Features**       | [application/features/auth.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/features/auth.md)                                             | Standalone login/register, AuthGuard, 7-day cookie            |
| **Features**       | [application/features/dashboard-progress.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/features/dashboard-progress.md)                 | Daily goal tracking, streak, mastery matrix, weekly synthesis |
| **Features**       | [application/features/drill.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/features/drill.md)                                           | Full-screen runner, MCQ traps, hesitation feedback            |
| **Features**       | [application/features/library.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/features/library.md)                                       | Lake explorer, document upload, chunk cards, semantic search  |
| **Patterns**       | [application/patterns/editor-integration.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/patterns/editor-integration.md)                 | TipTap v2 4-file setup & auto-save lifecycle                  |
| **Patterns**       | [application/patterns/feature-based-architecture.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/application/patterns/feature-based-architecture.md) | 3-layer feature boundary rules                                |
| **Design System**  | [design-system/tokens.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/design-system/tokens.md)                                                       | Color palette, radius tokens, typography scales               |
| **Design System**  | [design-system/components.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/design-system/components.md)                                               | 15 UI primitive specifications                                |
| **Design System**  | [design-system/tailwind.md](file:///c:/programming/echo/docs/app/katara-gnosis/frontend/design-system/tailwind.md)                                                   | Tailwind CSS v4 CSS-first configuration                       |
