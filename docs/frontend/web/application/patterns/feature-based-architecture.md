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
    ├── api/               # Data-fetching hooks (TanStack / fetch)
    │   ├── useChatStream.ts
    │   ├── useFeatures.ts
    │   └── useModels.ts
    ├── components/        # UI components
    │   ├── ChatInterface.tsx
    │   ├── ChatInput.tsx
    │   ├── MessageList.tsx
    │   ├── MessageItem.tsx
    │   ├── Sidebar.tsx
    │   └── AgentProgress.tsx
    └── services/
        └── chat-api.ts    # chatApi HTTP/SSE methods
```

## Flow Diagram

### Feature Module Structure

```
┌───────────────────────────────────────────────────┐
│            Feature Module Structure               │
│                    (per feature)                   │
├───────────────────────────────────────────────────┤
│                                                    │
│   constants.ts  ────→  Named constants,            │
│                         enum-like objects,         │
│                         endpoint paths             │
│                                                    │
│   types/        ────→  TypeScript interfaces       │
│                         and type aliases            │
│                                                    │
│   hooks/        ────→  React hooks (stateful       │
│                         logic, TanStack Query      │
│                         wrappers)                  │
│                                                    │
│   api/          ────→  Data-fetching hooks         │
│                         (TanStack Query wrappers,  │
│                         SSE stream hooks)          │
│                                                    │
│   services/     ────→  Thin wrappers around        │
│                         api-client calls           │
│                                                    │
│   components/   ────→  UI components scoped        │
│                         to the feature             │
│                                                    │
│   index.ts      ────→  Barrel — re-exports         │
│                         public surface area        │
│                                                    │
└───────────────────────────────────────────────────┘
```

### Cross-Feature Consumption

```
┌───────────────────────────────────────────────────────────────────┐
│                         app/page.tsx                              │
│                              │                                    │
│              ┌───────────────┴───────────────┐                    │
│              v                               v                    │
│ ┌──────────────────────────┐   ┌──────────────────────────────┐   │
│ │ import { ChatInterface } │   │ import { useAuth }           │   │
│ │ from "@/features/chat"   │   │ from "@/features/auth"       │   │
│ └──────────────────────────┘   └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## Barrel Export Convention

Each feature's `index.ts` selectively re-exports the **public API surface**. Internal components, constants, and types stay private unless exported here.

### Examples

**auth/index.ts**

```typescript
export * from "./hooks/useAuth";
export * from "./services/auth-api";
export * from "./types";
// export * from "./components/LoginForm"; // Placeholder
```

**chat/index.ts**

```typescript
export * from "./components/ChatInterface";
export * from "./types";
export * from "./api/useModels";
export * from "./api/useChatStream";
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
| Components| PascalCase functions | ChatInterface, MessageItem               |
+-----------+---------------------+------------------------------------------+
| Constants | UPPER_SNAKE for     | AUTH_ENDPOINTS, CHAT_ROLES               |
|           | endpoint/query-key  |                                          |
+-----------+---------------------+------------------------------------------+
| Files     | kebab-case          | chat-api.ts, use-local-storage.ts        |
+-----------+---------------------+------------------------------------------+

## Dependencies

### Internal

- Feature modules depend on `@/lib/api-client`, `@/lib/queries`, `@/utils/cn`, `@/constants`
- Feature modules **do not** import from other features (avoid cross-feature coupling)

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
