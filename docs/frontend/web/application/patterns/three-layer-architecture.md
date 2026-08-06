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

1. **Custom Hooks Layer** — logic, state, data fetching (zustand + react-query)
2. **Page Layer** — orchestrator: route + wiring hooks → components
3. **Component Layer** — pure UI, data hanya via custom hooks

**Alur data WAJIB:**
```
Component → custom hook → zustand (client state + mirror server state)
                        → react-query (server state) → queryFn → services/ fetcher
                        → app/api route (Next API = auth/token middleware) → Go backend
```

Setiap layer punya batasan akses yang tegas:

| Layer | Akses Zustand? | Akses RQ? | Akses services/api-client? | useState/useEffect? | Panggil hooks? |
|-------|:----:|:----:|:----:|:----:|:----:|
| **Custom Hook** | ✅ | ✅ | ✅ (services only) | ✅ | ✅ |
| **Page** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Component** | ❌ | ❌ | ❌ | ✅ (event/UI state) | ✅ (data hooks) |

> **Aturan emas:** komponen TIDAK boleh import `**/stores/*`, `@tanstack/react-query`,
> `@/lib/api-client`, `axios`, atau `**/services/*` secara langsung. Semua data —
> termasuk baca store — harus lewat custom hook. Satu-satunya pengecualian: hooks
> memanggil `services/` fetcher; fetcher memanggil `app/api` route.

## Layer Detail

### 1. Custom Hooks Layer

Lapisan paling bawah (dalam konteks dependency). Satu-satunya layer yang boleh:

- **Akses Zustand stores** — membaca/menulis client state
- **Akses React Query** — queries + mutations untuk server state
- **Punya `useState` / `useEffect`** — internal logic
- **Panggil hooks lain** — compose hooks untuk reusable logic

**TIDAK boleh:**
- Merender JSX
- Memanggil `services/*` / `@/lib/api-client` langsung di luar react-query queryFn

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
- Panggil custom hooks lain selain data/selector hooks (mis. `useAuth()`, `useSettings()`, `useAgentState()`)
- Akses Zustand store langsung
- Akses React Query / react-query hooks
- Akses services / api-client / axios
- Data fetching

**Yang BOLEH ada di component:**
- Props destructuring + typing
- JSX rendering
- Event handlers (onClick, onSubmit, onChange) yang dipanggil dari props
- Memanggil **custom hook data** untuk membaca data (selector hooks seperti
  `useAgentState()`, `useMessages()`) — ini JALUR WAJIB untuk akses data
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
│                       PAGE / COMPONENT LAYER                        │
│  page.tsx → <ChatPage/> → komponen panggil data hook               │
│  (data TIDAK pernah di-import langsung dari store/RQ/service)       │
└──────────────────────────────┼─────────────────────────────────────┘
                               │ props / data hooks
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVICES / FETCHER LAYER                         │
│  features/<feature>/services/<feature>-api.ts                       │
│    authApi.me() → api.get("/auth/me")                               │
│    sessionApi.list() → api.get("/sessions?limit=10")               │
└──────────────────────────────┼─────────────────────────────────────┘
                               │ axios/fetch (baseURL = "/api")
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                 NEXT.JS API ROUTE (MIDDLEWARE) LAYER                │
│  src/app/api/**/route.ts                                            │
│    getRequestToken()  ← auth dari httpOnly cookie (server-side)     │
│    proxyFetch(gatewayUrl, { Authorization: Bearer <token> })        │
│    → return NextResponse.json (JSON saja; SSE pakai relay khusus)   │
└──────────────────────────────┼─────────────────────────────────────┘
                               │ fetch (X-Internal)
                               v
┌─────────────────────────────────────────────────────────────────────┐
│                        GO BACKEND (gateway)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Layer (fetcher) & Next.js API Middleware

`services/*` (`features/<feature>/services/<feature>-api.ts`) adalah **lapisan
fetcher** — satu-satunya yang memanggil `@/lib/api-client`. Hanya custom hooks
yang menggunakannya.

`app/api/**` adalah **lapisan middleware**: membaca token dari httpOnly cookie
(`getRequestToken()`), meneruskan ke Go gateway (`proxyFetch()`), dan mengembalikan
JSON. Semua panggilan backend WAJIB lewat route ini — **TIDAK ada akses langsung
ke gateway** (no `/api/v1` rewrite bypass).

```
Component → Custom Hook → Service/Fetcher (axios) → Next.js API Route (auth middleware) → Go Backend
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

1. **Import check** — komponen/page TIDAK boleh import `@/lib/api-client`, `axios`,
   `@tanstack/react-query`, `**/stores/*`, atau `**/services/*` secara langsung.
   Semua akses data lewat custom hook.
2. **No useState/useEffect in page.tsx** — page cuma panggil Page hook, gak boleh
   manage state sendiri.
3. **Data hooks in component** — komponen memanggil data/selector hooks
   (`useAgentState()`, `useMessages()`, `useAuth()`, dst) untuk semua data.
   TIDAK ada akses store/RQ/service langsung.
4. **One bridge hook per feature** — setiap feature punya satu `use<Nama>Page` yang
   jadi entry point buat page.
5. **Fetcher only from hooks** — `services/*` dipanggil HANYA dari custom hooks
   (di dalam react-query queryFn atau mutasi).
6. **Next API middleware** — semua request backend lewat `app/api/**`. Tidak ada
   fetch langsung ke gateway.

## Source References

+------------------------------------------+---------+------------------------------------+
| File                                     | Lines   | Description                        |
+------------------------------------------+---------+------------------------------------+
| src/features/chat/hooks/useChatPage.ts   | 1-50    | Page hook — bridge for chat        |
+------------------------------------------+---------+------------------------------------+
<!-- useLoginPage.ts does not exist — login page uses useAuth() directly -->
+------------------------------------------+---------+------------------------------------+
| src/features/settings/hooks/             | 1-40    | Page hook — bridge for settings    |
| useSettingsPage.ts                       |         |                                    |
+------------------------------------------+---------+------------------------------------+
| src/app/(main)/page.tsx                  | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/app/login/page.tsx                   | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/app/settings/page.tsx                | 1-10    | Page — pure orchestrator           |
+------------------------------------------+---------+------------------------------------+
| src/features/chat/components/            | 1-80    | Component — stateless, pure UI     |
| ChatPage.tsx                             |         |                                    |
+------------------------------------------+---------+------------------------------------+
| docs/frontend/web/infrastructure/        | 1-330   | Detailed state management pattern  |
| state-management.md                      |         |                                    |
+------------------------------------------+---------+------------------------------------+
| docs/frontend/web/infrastructure/        | 1-290   | Detailed routing page pattern      |
| routing.md                               |         |                                    |
+------------------------------------------+---------+------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
