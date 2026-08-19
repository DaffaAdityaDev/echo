================================================================================
  Feature-Based Architecture
================================================================================
  Module    : Feature-Based Architecture
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The frontend organizes code by **feature domain** rather than by technical role. Each feature (`auth/`, `chat/`) is a self-contained module with its own types, services, hooks, components, and constants. This colocation improves cohesion and makes features independently testable and removable.

## File Structure

```
src/features/
├── auth/
│   ├── constants.ts       # AUTH_ENDPOINTS, AUTH_QUERY_KEYS
│   ├── index.ts           # Barrel — public exports
│   ├── types/
│   │   └── index.ts       # User, AuthState, LoginCredentials
│   ├── hooks/
│   │   └── useAuth.ts     # useAuth hook
│   └── services/
│       └── auth-api.ts    # authApi HTTP methods
│
└── chat/
    ├── constants.ts       # CHAT_ROLES, CHAT_MODES, PACKET_TYPES, etc.
    ├── index.ts           # Barrel — public exports
    ├── types/
    │   └── index.ts       # Message, StreamPacket, ThoughtStep, etc.
    ├── hooks/             # Orchestrator + data-fetching hooks
    │   ├── useChatPage.ts
    │   ├── useChatStream.ts
    │   ├── useFeatures.ts
    │   ├── useModels.ts
    │   ├── useSessions.ts
    │   └── useSkills.ts
    ├── components/        # UI components
    │   ├── ChatPage.tsx   # Thin orchestrator
    │   ├── ChatInput.tsx
    │   ├── MessageList.tsx
    │   ├── MessageItem.tsx
    │   ├── SessionSidebar.tsx   # Shell
    │   ├── ToolCallTimeline.tsx
    │   ├── AgentProgress.tsx
    │   ├── AgentStatusBadge.tsx
    │   ├── DegradationToast.tsx
    │   ├── ModelSelectorModal.tsx
    │   ├── chat-page/     # ChatPage sub-parts (ChatHeader, WelcomeHero, MissionInfoBar)
    │   ├── debug/         # DebugDrawer + 4 telemetry panels
    │   ├── sidebar/       # SessionList + SessionListItem
    │   └── steps/         # ThoughtStepView + step renders
    ├── stores/
    │   └── chatStore.ts   # Zustand store for conversation state
    └── services/
        ├── chat-api.ts    # chatApi HTTP methods
        └── stream/        # applyStreamPacket dispatcher + per-group handlers
```

## Feature Module Structure

```
┌───────────────────────────────────────────────────┐
│            Feature Module Structure               │
│                    (per feature)                   │
├───────────────────────────────────────────────────┤
│                                                    │
│   constants.ts  ────→  Named constants,            │
│                         endpoint paths,            │
│                         query key factories        │
│                                                    │
│   types/        ────→  TypeScript interfaces       │
│                         and type aliases            │
│                                                    │
│   hooks/        ────→  React hooks (orchestrator,  │
│                         TanStack Query wrappers)   │
│                                                    │
│   services/     ────→  Thin wrappers around        │
│                         api-client calls           │
│                                                    │
│   api/          ────→  TanStack Query hooks        │
│                         (optional — admin, studio) │
│                                                    │
│   stores/       ────→  Zustand stores for          │
│                         local client state         │
│                                                    │
│   components/   ────→  UI components scoped        │
│                         to the feature             │
│                                                    │
│   index.ts      ────→  Barrel — re-exports         │
│                         public surface area        │
│                         (components + hooks + types)│
│                                                    │
└───────────────────────────────────────────────────┘
```

### Cross-Feature Consumption

```
┌───────────────────────────────────────────────────────────────────┐
│                      app/(main)/page.tsx                          │
│                              │                                    │
│              ┌───────────────┴───────────────┐                    │
│              v                               v                    │
│ ┌──────────────────────────┐   ┌──────────────────────────────┐   │
│ │ import { ChatPage }      │   │ import { useAuth }           │   │
│ │ from "@/features/chat"   │   │ from "@/features/auth"       │   │
│ └──────────────────────────┘   └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## Barrel Export Convention

Each feature's `index.ts` selectively re-exports the **public API surface**. Internal components, constants, and types stay private unless exported here.

### Examples

**auth/index.ts**

```typescript
export * from "./components/LoginForm";
export * from "./components/AuthGuard";
export * from "./hooks/useAuth";
export * from "./types";
```

> Note: Constants, services, and stores are **not** re-exported from the barrel.
> They are internal implementation details consumed by the feature's own hooks.

**chat/index.ts**

```typescript
// Components
export * from "./components/ChatPage";
export * from "./components/ChatInput";
export * from "./components/MessageList";
// ... other components

// Hooks
export * from "./hooks/useChatPage";
export * from "./hooks/useChatStream";
export * from "./hooks/useModels";
export * from "./hooks/useSessions";

// Types (named)
export type { Message, StreamPacket, ... } from "./types";
```

## Naming Conventions

+-----------+---------------------+------------------------------------------+
| Layer     | Convention          | Example                                  |
+-----------+---------------------+------------------------------------------+
| Types     | PascalCase          | User, AuthState, StreamPacket            |
|           | interfaces          |                                          |
+-----------+---------------------+------------------------------------------+
| Hooks     | use + PascalCase    | useAuth, useChatStream, useModels        |
+-----------+---------------------+------------------------------------------+
| Services  | camelCase object    | authApi, chatApi                         |
+-----------+---------------------+------------------------------------------+
| Components| PascalCase functions | ChatPage, MessageItem                      |
+-----------+---------------------+------------------------------------------+
| Constants | UPPER_SNAKE for     | AUTH_ENDPOINTS, CHAT_ROLES               |
|           | endpoint/query-key  |                                          |
+-----------+---------------------+------------------------------------------+
| Files     | kebab-case          | chat-api.ts, chat-stream.ts             |
+-----------+---------------------+------------------------------------------+

## Dependencies

### Internal

- Feature modules depend on `@/lib/api-client`, `@/lib/queries`, `@/utils/cn`, `@/constants`
- Feature modules **should not** import from other features to avoid cross-feature coupling.
  Exceptions exist where sharing is necessary (settings module imports chat hooks for
  feature/skill/model lists).

### External

- `@tanstack/react-query` — hooks for server state
- `framer-motion` — animations in chat components
- `lucide-react` — icons

## Source References

+-------------------------------------------------+-------+----------------------------------------------+
| File                                            | Lines | Description                                  |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/auth/index.ts                      | 1-4   | Auth barrel — public exports                 |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/auth/types/index.ts                | 1-17  | Auth types                                   |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/auth/hooks/useAuth.ts              | 5-30  | Auth hook                                    |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/auth/services/auth-api.ts          | 5-16  | Auth API service                             |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/chat/index.ts                      | 1-4   | Chat barrel — public exports                 |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/chat/types/index.ts                | 1-124 | Chat types                                   |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/chat/api/useChatStream.ts          | 8-260 | Chat SSE stream hook                         |
+-------------------------------------------------+-------+----------------------------------------------+
| src/features/chat/components/ChatInterface.tsx  | 14-72 | Chat orchestrator component                  |
+-------------------------------------------------+-------+----------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
