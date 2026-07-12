================================================================================
  Three-Layer Architecture
================================================================================
  Module    : Three-Layer Architecture
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Arsitektur frontend dibagi menjadi 3 layer ketat dengan tanggung jawab terpisah.
NLAH is an internal execution harness, not a user-facing mode — the frontend
sends `mode: "agent"` which internally maps to NLAH strategy.

1. **Custom Hooks Layer** — logic, state, data fetching
2. **Page Layer** — orchestrator: route + wiring hooks → components
3. **Component Layer** — pure UI, stateless

Setiap layer punya batasan akses yang tegas:

| Layer | Akses Zustand? | Akses RQ? | useState/useEffect? | Panggil hooks? |
|-------|:----:|:----:|:----:|:----:|
| **Custom Hook** | ✅ | ✅ | ✅ | ✅ |
| **Page** | ❌ | ❌ | ❌ | ✅ |
| **Component** | ❌ | ❌ | ❌ | ❌ |

## Layer Detail

### 1. Custom Hooks Layer

Lapisan paling bawah (dalam konteks dependency). Satu-satunya layer yang boleh:

- **Akses Zustand stores** — membaca/menulis client state
- **Akses React Query** — queries + mutations untuk server state
- **Punya `useState` / `useEffect`** — internal logic
- **Panggil hooks lain** — compose hooks untuk reusable logic

**TIDAK boleh:**
- Merender JSX

Setiap feature punya minimal satu "Page hook" yang menggabungkan semua hook terkait:

```
features/chat/hooks/
├── useChatPage.ts       ← Bridge: gabungin chatStore + useModels + useChatStream
├── useChatStream.ts     ← SSE stream handler
└── useModels.ts         ← RQ query models
```

### 2. Page Layer

Lapisan tengah. Setiap file di `app/*/page.tsx` adalah **pure orchestrator**.

Tugasnya cuma:
1. Panggil Page hook
2. Spread return value sebagai props ke component

```typescript
"use client";
import { useChatPage } from "@/features/chat/hooks/useChatPage";
import { ChatPage } from "@/features/chat/components/ChatPage";

export default function ChatRoute() {
  const chat = useChatPage();
  return <ChatPage {...chat} />;
}
```

**TIDAK boleh:**
- useState / useRef / useEffect
- Data fetching / axios / api calls
- Akses Zustand store langsung
- Logic bisnis apapun

### 3. Component Layer

Lapisan paling atas (paling dekat ke user). **Stateless, pure UI**.

```typescript
interface ChatPageProps {
  messages: Message[];
  isLoading: boolean;
  models: Model[];
  selectedModel: string;
  onSend: (msg: string) => void;
  // ...
}

export function ChatPage({ messages, isLoading, models, onSend, ...rest }: ChatPageProps) {
  return (
    <div>
      <Sidebar models={models} selectedModel={rest.selectedModel} ... />
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} isLoading={isLoading} />
      <AgentProgress progress={rest.agentProgress} />
    </div>
  );
}
```

**TIDAK boleh:**
- Panggil custom hooks (useAuth, useSettings, useChatPage, dll)
- Akses Zustand store langsung
- useState / useEffect (kecuali event handlers seperti onClick)
- Data fetching

**Yang BOLEH ada di component:**
- Props destructuring + typing
- JSX rendering
- Event handlers (onClick, onSubmit, onChange) yang dipanggil dari props
- Conditional rendering (loading/error/empty states via props)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      HOOKS LAYER                                   │
│  useChatPage() internally:                                         │
│    messages ← useChatStore(s => s.messages)       [Zustand]       │
│    models   ← useModels()                         [React Query]   │
│    stream   ← useChatStream()                     [SSE → Zustand] │
│                              │                                     │
│    return { messages, models, isLoading, sendMessage, ... }        │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                       PAGE LAYER                                   │
│  const chat = useChatPage();                                       │
│  <ChatPage messages={chat.messages} ... />                         │
└──────────────────────────────┼─────────────────────────────────────┘
                               │ props
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                                 │
│  function ChatPage({ messages, models, onSend }: Props) {          │
│    return <MessageList messages={messages} />                      │
│  }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Layer

Service layer (`features/*/services/`) berisi fungsi-fungsi yang manggil Axios.
Hanya custom hooks yang menggunakannya.

```
Component → Page → Custom Hook → Service (Axios) → Next.js API Route → Go Backend
```

## Conventions

### Naming

| Layer | Convention | Example |
|-------|-----------|---------|
| Page hook | `use<Nama>Page` | `useChatPage`, `useSettingsPage` |
| Page file | `app/.../page.tsx` | route component |
| Page component | `<Nama>Page` | `ChatPage`, `SettingsPage` |
| Zustand store | `<nama>Store` | `chatStore`, `authStore` |
| Service | `<nama>-api` | `chat-api`, `auth-api` |

### Directory Per Feature

```
features/<feature>/
├── stores/          ← Zustand store
├── hooks/           ← Page hook + RQ hooks
├── components/      ← UI components (stateless)
└── services/        ← Axios API calls
```

### Spreading Props

Page hook return value harus di-spread ke component props untuk menghindari
nested prop drilling di page:

```typescript
// ✅ Good
const chat = useChatPage();
return <ChatPage {...chat} />;

// ❌ Bad
const { messages, isLoading } = useChatPage();
return <ChatPage messages={messages} isLoading={isLoading} />;
```

## Enforcement Rules

1. **Import check** — jangan import `api-client`, `axios`, `useQuery`, atau Zustand store
   di dalam file component atau page (selain hooks).
2. **No useState in page.tsx** — page cuma panggil hooks, gak boleh manage state sendiri.
3. **No hooks in component** — component gak boleh panggil `useAuth()`, `useSettings()`, dll.
   Semua data harus datang dari props.
4. **One bridge hook per feature** — setiap feature punya satu `use<Nama>Page` yang
   jadi entry point buat page.

## Source References

+------------------------------------------+---------+------------------------------------+
| File                                     | Lines   | Description                        |
+------------------------------------------+---------+------------------------------------+
| src/features/chat/hooks/useChatPage.ts   | 1-50    | Page hook — bridge for chat        |
+------------------------------------------+---------+------------------------------------+
| src/features/auth/hooks/useLoginPage.ts  | 1-30    | Page hook — bridge for login       |
+------------------------------------------+---------+------------------------------------+
| src/features/settings/hooks/             | 1-40    | Page hook — bridge for settings    |
| useSettingsPage.ts                       |         |                                    |
+------------------------------------------+---------+------------------------------------+
| src/app/(chat)/page.tsx                  | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/app/login/page.tsx                   | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/app/settings/page.tsx                | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/features/chat/components/            | 1-80    | Component — stateless, pure UI     |
| ChatPage.tsx                             |         |                                    |
+------------------------------------------+---------+------------------------------------+
| src/infrastructure/state-management.md   | 1-250   | Detailed state management pattern  |
+------------------------------------------+---------+------------------------------------+
| src/infrastructure/routing.md            | 1-200   | Detailed routing page pattern      |
+------------------------------------------+---------+------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
