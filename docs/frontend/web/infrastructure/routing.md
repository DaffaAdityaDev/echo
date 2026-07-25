================================================================================
  Routing
================================================================================
  Module    : Routing
  Service   : Web
  Version   : 2.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Uses Next.js App Router for page-based routing.

Setiap page adalah **pure orchestrator** — tugasnya cuma:
1. Panggil custom hook ("Page hook") → dapetin data + actions
2. Pass return value sebagai props ke component

Page TIDAK boleh berisi:
- ❌ useState / useRef / useEffect
- ❌ Data fetching langsung (fetch, axios, api.get)
- ❌ Akses Zustand store langsung
- ❌ Logic bisnis apapun

## File Structure

```
src/app/
├── (main)/                  ← Main app shell (includes studio sub-pages)
│   ├── layout.tsx           ← Main layout shell
│   ├── page.tsx             ← Chat route — useChatPage() → <ChatPage>
│   ├── studio/page.tsx      ← Studio dashboard
│   ├── prompts/page.tsx     ← Prompt library
│   ├── playground/page.tsx  ← Playground
│   ├── evals/page.tsx       ← Evaluation dashboard
│   ├── shadow/page.tsx      ← Shadow testing
│   ├── maturity/page.tsx    ← Maturity assessment
│   └── audit/page.tsx       ← Audit trail
│
├── login/
│   └── page.tsx             ← useAuth().loginAsync → <LoginForm>
│
├── settings/
│   └── page.tsx             ← useSettingsPage() → <SettingsPage>
│
├── admin/
│   ├── layout.tsx           ← Admin sidebar layout
│   ├── page.tsx             ← useAdminDashboardPage() → <AdminDashboardPage>
│   └── api-keys/
│       └── page.tsx         ← useAdminApiKeysPage() → <AdminApiKeysPage>
│
├── docs/
│   └── page.tsx             ← API documentation viewer
│
├── api/                     ← Next.js API routes (proxy ke Go backend)
│   ├── auth/
│   │   ├── me/route.ts
│   │   ├── login/route.ts
│   │   └── logout/route.ts
│   ├── chat/
│   │   ├── stream/route.ts
│   │   ├── history/route.ts
│   │   └── clear/route.ts
│   ├── models/route.ts
│   ├── features/route.ts
│   ├── skills/route.ts
│   ├── sessions/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── messages/route.ts
│   │       └── generate-title/route.ts
│   ├── settings/
│   │   ├── route.ts
│   │   └── defaults/route.ts
│   ├── admin/
│   │   ├── stats/route.ts
│   │   └── api-keys/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   └── studio/
│       ├── prompts/
│       │   ├── route.ts
│       │   ├── active/route.ts
│       │   └── [id]/
│       │       ├── versions/route.ts
│       │       └── versions/[v]/route.ts
│       ├── evals/
│       │   ├── datasets/route.ts
│       │   ├── run/route.ts
│       │   └── runs/[id]/route.ts
│       ├── shadow/history/[id]/route.ts
│       ├── audit/route.ts
│       └── playground/route.ts
│
├── globals.css
├── layout.tsx
├── providers.tsx
└── error.tsx
```

## Flow Diagrams

### Page as Orchestrator

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Request for "/"                             │
│                              │                                     │
│                              v                                     │
│                    layout.tsx (server)                              │
│                              │                                     │
│                              v                                     │
│                    providers.tsx (client)                           │
│                              │                                     │
│                              v                                     │
│                     (chat)/page.tsx                                 │
│                              │                                     │
│  ┌───────────────────────────┼───────────────────────────────┐     │
│  │                           v                               │     │
│  │              useChatPage() ← custom hook                   │     │
│  │                           │                               │     │
│  │                           v                               │     │
│  │              return { messages, models,                   │     │
│  │                      isLoading, sendMessage, ... }        │     │
│  │                           │                               │     │
│  │                           v                               │     │
│  │              <ChatPage messages={messages}                │     │
│  │                       isLoading={isLoading}               │     │
│  │                       onSend={sendMessage}                │     │
│  │                       ...                                │     │
│  │              />                                           │     │
│  └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Handling

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Request                             │
│                              │                                     │
│                              v                                     │
│                    layout.tsx (server)                              │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐     │
│ │ Load Inter + │   │ Set metadata    │   │ Apply dark theme │     │
│ │ Outfit fonts  │   │ (title, desc)  │   │ global classes   │     │
│ └──────────────┘   └──────────────────┘   └──────────────────┘     │
│                              │                                     │
│                              v                                     │
│                    providers.tsx (client)                           │
│                              │                                     │
│                              v                                     │
│                    page.tsx (client component)                      │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐     │
│ │ useChatPage()│   │ Destructure      │   │ Pass props ke    │     │
│ │ (hook)       │   │ return value     │   │ ChatPage comp    │     │
│ └──────────────┘   └──────────────────┘   └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Error / Loading Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                         layout.tsx                                 │
│                              │                                     │
│              ┌───────────────┴───────────────┐                     │
│              v                               v                     │
│ ┌────────────────────────┐   ┌────────────────────────────────┐     │
│ │     loading.tsx        │   │         error.tsx              │     │
│ │  (shown during         │   │  (shown if page.tsx throws)   │     │
│ │   page.tsx async work) │   │                                │     │
│ └────────────────────────┘   │  ┌──────────────────────────┐  │     │
│                              │  │ "Try again" button →     │  │     │
│                              │  │ reset()                  │  │     │
│                              │  └──────────────────────────┘  │     │
│                              └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## Page Examples

### Chat Page

```typescript
"use client";
import { useChatPage } from "@/features/chat/hooks/useChatPage";
import { ChatPage } from "@/features/chat/components/ChatPage";

export default function ChatRoute() {
  const chat = useChatPage();
  return <ChatPage {...chat} />;
}
```

### Settings Page

```typescript
"use client";
import { useSettingsPage } from "@/features/settings/hooks/useSettingsPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";

export default function SettingsRoute() {
  const settings = useSettingsPage();
  return <SettingsPage {...settings} />;
}
```

### Login Page

```typescript
"use client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginRoute() {
  const { loginAsync, isLoggingIn, loginError } = useAuth();
  return <LoginForm loginAsync={loginAsync} isLoggingIn={isLoggingIn} loginError={loginError} />;
}
```

## Next.js API Routes (Proxy)

Semua API request dari frontend → Next.js API route → Backend Go.

Tugas Next.js API route:
1. Read JWT dari cookie (`__session` or `token`)
2. Forward request ke Go backend (`localhost:8080`)
3. Return response ke browser

```
Browser                  Next.js API Route                Go Backend
  │                           │                              │
  │  GET /api/models          │                              │
  │ ───────────────────────>  │                              │
  │                           │  GET /v1/models              │
  │                           │  Authorization: Bearer <JWT> │
  │                           │ ───────────────────────────> │
  │                           │                              │
  │                           │  <── 200 { models: [...] }  │
  │  <── 200 { models: [...] }│                              │
  └───────────────────────────┴──────────────────────────────┘
```

## Dependencies

### Internal

- `@/features/*/hooks/*` — Page-level custom hooks (useChatPage, useSettingsPage, etc.)
- `@/features/*/components/*` — Stateless page components (ChatPage, SettingsPage, etc.)
- `@/lib/get-query-client` — QueryClient factory (for server prefetch)

### External

- `next` — `next/font/google`, App Router, API Routes
- `@tanstack/react-query` — `dehydrate`, `HydrationBoundary`, `QueryClientProvider`

## Source References

+--------------------------------------+---------+----------------------------------------+
| File                                 | Lines   | Description                            |
+--------------------------------------+---------+----------------------------------------+
| src/app/(main)/page.tsx              | 1-10    | Chat route — hooks → props → component |
+--------------------------------------+---------+----------------------------------------+
| src/app/login/page.tsx               | 1-10    | Login route - useAuth + LoginForm — hooks → props → component|
+--------------------------------------+---------+----------------------------------------+
| src/app/settings/page.tsx            | 1-10    | Settings route — hooks → props → comp  |
+--------------------------------------+---------+----------------------------------------+
| src/app/admin/page.tsx               | 1-10    | Admin dashboard route                  |
+--------------------------------------+---------+----------------------------------------+
| src/app/error.tsx                    | 1-36    | Error boundary with retry              |
+--------------------------------------+---------+----------------------------------------+

+--------------------------------------+---------+----------------------------------------+
| src/app/layout.tsx                   | 1-34    | Root layout — HTML, fonts, Providers   |
+--------------------------------------+---------+----------------------------------------+
| src/app/providers.tsx                | 1-19    | TanStack Query provider wrapper        |
+--------------------------------------+---------+----------------------------------------+
| src/app/api/chat/stream/route.ts     | 1-40    | Next.js API route — proxy to Go SSE   |
+--------------------------------------+---------+----------------------------------------+
| src/app/api/auth/login/route.ts      | 1-30    | Next.js API route — login proxy       |
+--------------------------------------+---------+----------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
