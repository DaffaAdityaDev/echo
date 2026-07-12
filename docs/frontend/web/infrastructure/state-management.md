================================================================================
  State Management
================================================================================
  Module    : State Management
  Service   : Web
  Version   : 2.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Three-layer state architecture:

1. **Zustand Stores** — client-side UI state (selectedModel, messages, sidebarOpen, etc.)
2. **React Query** — server state (models, auth user, settings, etc.)
3. **Custom Hooks** — SATU-SATUNYA bridge yang boleh akses Zustand + RQ.

Page dan Component DILARANG akses Zustang store atau React Query langsung.
Semua interaksi data harus lewat custom hooks.

## Aturan

| Layer | Akses Zustand? | Akses RQ? | useState/useEffect? | Panggil hooks? |
|-------|:----:|:----:|:----:|:----:|
| **Custom Hook** | ✅ | ✅ | ✅ | ✅ |
| **Page** | ❌ | ❌ | ❌ | ✅ |
| **Component** | ❌ | ❌ | ❌ | ❌ |

- **Custom Hook**: satu-satunya layer yg punya logic, state, data fetching
- **Page**: cuma panggil hooks → pass ke component. NO logic, NO state sendiri
- **Component**: pure function dari props ke UI. NO hooks internal

## File Structure

```
src/
├── features/
│   ├── chat/
│   │   ├── stores/chatStore.ts         ← Zustand: client-side chat state
│   │   ├── hooks/useChatPage.ts        ← Bridge: wraps chatStore + useModels + useChatStream
│   │   ├── hooks/useModels.ts          ← RQ query
│   │   ├── hooks/useChatStream.ts      ← SSE stream + writes to chatStore
│   │   ├── components/ChatPage.tsx     ← Stateless UI
│   │   └── services/chat-api.ts        ← Axios calls
│   │
│   ├── auth/
│   │   ├── stores/authStore.ts         ← Zustand: user, token
│   │   ├── hooks/useLoginPage.ts       ← Bridge: wraps authStore + useAuth
│   │   ├── hooks/useAuth.ts            ← RQ queries + mutations
│   │   └── services/auth-api.ts
│   │
│   ├── settings/
│   │   ├── stores/settingsStore.ts     ← Zustand: config, loaded
│   │   ├── hooks/useSettingsPage.ts    ← Bridge: wraps settingsStore + useSettings
│   │   ├── hooks/useSettings.ts        ← RQ queries + mutations
│   │   └── services/settings-api.ts
│   │
│   └── admin/
│       ├── stores/adminStore.ts        ← Zustand (minimal, mostly RQ)
│       ├── hooks/useAdminDashPage.ts   ← Bridge
│       ├── hooks/useAdminStats.ts      ← RQ
│       ├── hooks/useApiKeys.ts         ← RQ
│       └── services/admin-api.ts
│
├── lib/
│   ├── api-client.ts          ← Axios → baseURL: "/api/..." (Next.js API routes)
│   ├── get-query-client.ts    ← QueryClient factory + singleton
│   └── queries.ts             ← modelQueries reusable definitions
│
└── constants/
    └── query-keys.ts          ← QUERY_KEYS constant
```

## Zustand Stores

### chatStore

```typescript
interface ChatState {
  selectedModel: string;
  mode: ChatMode; // 'standard' | 'agent'
  selectedFeatures: string[];
  sidebarOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  agentProgress: AgentProgress | null;

  setSelectedModel: (model: string) => void;
  setMode: (mode: ChatMode) => void; // 'standard' | 'agent'
  setSelectedFeatures: (features: string[]) => void;
  toggleSidebar: () => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  setAgentProgress: (progress: AgentProgress | null) => void;
  clearMessages: () => void;
}
```

### authStore

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}
```

### settingsStore

```typescript
interface SettingsState {
  config: AgentConfig;
  loaded: boolean;

  setConfig: (config: AgentConfig) => void;
  resetConfig: () => void;
}
```

### adminStore

```typescript
interface AdminState {
  // Minimal — mostly managed by React Query
}
```

## Flow Diagrams

### Three-Layer Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      HOOKS LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  useChatPage()                                               │  │
│  │  ┌──────────────────┐  ┌───────────────┐  ┌───────────────┐ │  │
│  │  │ useChatStore()   │  │ useModels()   │  │ useChatStream │ │  │
│  │  │ (Zustand select) │  │ (RQ query)    │  │ (SSE + write) │ │  │
│  │  └──────────────────┘  └───────────────┘  └───────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                   return { messages, isLoading,                    │
│                           sendMessage, clearMessages,              │
│                           selectedModel, setSelectedModel, ... }   │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                       PAGE LAYER                                   │
│  app/(chat)/page.tsx                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ const { messages, isLoading, sendMessage, ... }              │  │
│  │   = useChatPage();                                           │  │
│  │                                                              │  │
│  │ <ChatPage                                                     │  │
│  │   messages={messages}                                        │  │
│  │   isLoading={isLoading}                                      │  │
│  │   onSend={sendMessage}                                       │  │
│  │   ...                                                        │  │
│  │ />                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┼─────────────────────────────────────┘
                               │ props
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                                 │
│  ChatPage ← stateless, pure UI                                    │
│  ├── Sidebar ← receives features, selectedModel, callbacks        │
│  ├── MessageList ← receives messages, isLoading                   │
│  ├── ChatInput ← receives onSend, isLoading                       │
│  └── AgentProgress ← receives agentProgress                       │
└─────────────────────────────────────────────────────────────────────┘
```

### TanStack Query Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Custom Hook (e.g. useModels)                     │
│                              │                                     │
│                              v                                     │
│                    useQuery({                                       │
│                      queryKey: ["models"],                          │
│                      queryFn: () => api.get("/api/models")          │
│                    })                                               │
│                              │                                     │
│                              v                                     │
│               Axios → /api/models → Next.js API Route              │
│                              │                                     │
│                              v                                     │
│               Attach JWT from cookie → Forward to Go               │
│                              │                                     │
│                              v                                     │
│                    Go Backend (localhost:8080)                      │
└─────────────────────────────────────────────────────────────────────┘
```

### SSE Stream Flow (Chat)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    useChatStream (inside useChatPage)                │
│                              │                                     │
│   sendMessage() ─────────────┼─────────────────────────────────┐   │
│                              │                                  │   │
│                              v                                  │   │
│               fetch("/api/chat/stream", { signal, body })       │   │
│                              │                                  │   │
│                              v                                  │   │
│               ReadableStream → onChunk callback                 │   │
│                              │                                  │   │
│        ┌─────────────────────┼─────────────────────┐            │   │
│        v                     v                     v            │   │
│ ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐ │   │
│ │ PACKET_TYPES │   │ PACKET_TYPES     │   │ PACKET_TYPES     │ │   │
│ │ .CONTENT:    │   │ .METADATA:       │   │ .TOOL_RESULT:    │ │   │
│ │ append to    │   │ update message   │   │ push step to     │ │   │
│ │ lastMessage  │   │ meta             │   │ lastMessage      │ │   │
│ │ content      │   │                  │   │ steps            │ │   │
│ └──────────────┘   └──────────────────┘   └──────────────────┘ │   │
│                              │                                  │   │
│                              v                                  │   │
│               chatStore.getState().setMessages(updated)         │   │
└─────────────────────────────────────────────────────────────────────┘
```

## Custom Hook Pattern

Setiap feature punya hook "Page" yg jadi bridge utama:

```typescript
// features/chat/hooks/useChatPage.ts
export function useChatPage() {
  const config = useSettingsStore(s => s.config);
  const models = useModels();
  const { messages, isLoading, agentProgress, sendMessage, clearMessages } =
    useChatStream(activeModelId, mode, selectedFeatures);

  return {
    // Server state
    models: models.data ?? [],
    modelsLoading: models.isLoading,

    // Client state dari Zustand (via store selector)
    selectedModel,
    mode,
    selectedFeatures,
    sidebarOpen,
    setSelectedModel,
    setMode,
    setSelectedFeatures,
    toggleSidebar,

    // Stream state + actions
    messages,
    isLoading,
    agentProgress,
    sendMessage,
    clearMessages,
  };
}
```

Page tinggal consume:

```typescript
// app/(chat)/page.tsx
"use client";
export default function ChatPageRoute() {
  const chat = useChatPage();
  return <ChatPage {...chat} />;
}
```

## Dependencies

### Internal

- `@/features/*/stores` — Zustand store definitions
- `@/features/*/services` — Axios API calls
- `@/lib/api-client` — Axios instance (base: "/api/...")
- `@/lib/get-query-client` — QueryClient factory
- `@/constants` — QUERY_CONFIG, QUERY_KEYS

### External

- `zustand` — Client state management
- `@tanstack/react-query` — Server state management
- `axios` — HTTP client

## Source References

+------------------------------------------+---------+--------------------------------------------+
| File                                     | Lines   | Description                                |
+------------------------------------------+---------+--------------------------------------------+
| src/features/chat/stores/chatStore.ts    | 1-80    | Zustand store — chat client state          |
+------------------------------------------+---------+--------------------------------------------+
| src/features/auth/stores/authStore.ts    | 1-50    | Zustand store — auth state                 |
+------------------------------------------+---------+--------------------------------------------+
| src/features/settings/stores/            | 1-60    | Zustand store — settings state             |
| settingsStore.ts                         |         |                                            |
+------------------------------------------+---------+--------------------------------------------+
| src/features/chat/hooks/useChatPage.ts   | 1-50    | Bridge hook — gabungin store + RQ + stream |
+------------------------------------------+---------+--------------------------------------------+
| src/features/auth/hooks/useLoginPage.ts  | 1-30    | Bridge hook — login page logic             |
+------------------------------------------+---------+--------------------------------------------+
| src/features/settings/hooks/             | 1-40    | Bridge hook — settings page logic          |
| useSettingsPage.ts                       |         |                                            |
+------------------------------------------+---------+--------------------------------------------+
| src/features/chat/hooks/useChatStream.ts | 1-270   | SSE stream handler — writes ke chatStore   |
+------------------------------------------+---------+--------------------------------------------+
| src/features/auth/hooks/useAuth.ts       | 1-80    | RQ queries + mutations for auth            |
+------------------------------------------+---------+--------------------------------------------+
| src/features/chat/hooks/useModels.ts     | 1-20    | RQ query for models                        |
+------------------------------------------+---------+--------------------------------------------+
| src/lib/api-client.ts                    | 1-80    | Axios instance — base URL "/api/..."       |
+------------------------------------------+---------+--------------------------------------------+
| src/lib/get-query-client.ts              | 1-35    | QueryClient factory                        |
+------------------------------------------+---------+--------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
