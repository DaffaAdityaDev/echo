================================================================================
  TanStack Query Setup
================================================================================
  Module    : TanStack Query Setup
  Service   : Web
  Version   : 1.1
  Updated   : 2026-08-07 (query standard: cache retention, retry, focus, auth staleTime)
================================================================================

## Deskripsi

Configures TanStack React Query for server-state management. Uses a singleton `QueryClient` pattern that works correctly across both server-side rendering and client-side hydration. Default stale time is 60 seconds, and pending queries are also dehydrated so the UI shows loading state immediately.

## File Structure

```
src/lib/
├── get-query-client.ts    # QueryClient factory + browser singleton
└── queries.ts             # Predefined query objects (modelQueries)

src/constants/
├── query-keys.ts          # Centralized query key definitions
└── index.ts               # QUERY_CONFIG (stale time, status)

src/app/
├── providers.tsx          # QueryClientProvider + DevTools
└── page.tsx               # Server prefetch + HydrationBoundary
```

## Flow Diagrams

### Server Rendering

```
┌─────────────────────────────────────────────────────────────────────┐
│            Request → page.tsx (async server component)              │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│ │ getQueryClient() │   │ prefetchQuery    │   │ dehydrate(query- │ │
│ │ → new QueryClient│   │ (modelQueries.   │   │ Client) →        │ │
│ │   [new each req] │   │  list())         │   │ serialized state │ │
│ └──────────────────┘   └──────────────────┘   └──────────────────┘ │
│                              │                                     │
│                              v                                     │
│              <HydrationBoundary state={dehydratedState}>            │
│                              │                                     │
│                              v                                     │
│                        <ChatInterface>                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Client Hydration

```
┌─────────────────────────────────────────────────────────────────────┐
│                   Browser → providers.tsx                           │
│                              │                                     │
│                              v                                     │
│                         getQueryClient()                            │
│                              │                                     │
│              ┌───────────────┴───────────────┐                     │
│              v                               v                     │
│ ┌────────────────────────┐   ┌────────────────────────────────┐     │
│ │ browserQueryClient     │   │ browserQueryClient             │     │
│ │ exists?                │   │ missing?                       │     │
│ │ → return it [singleton]│   │ → makeQueryClient() → cache it │     │
│ └────────────────────────┘   └────────────────────────────────┘     │
│                              │                                     │
│                              v                                     │
│              QueryClientProvider client={queryClient}               │
│                              │                                     │
│              ┌───────────────┴───────────────┐                     │
│              v                               v                     │
│ ┌────────────────────────┐   ┌────────────────────────────────┐     │
│ │ ReactQueryDevtools     │   │ HydrationBoundary             │     │
│ │ (dev only)             │   │ state={serverState}           │     │
│ └────────────────────────┘   │ → restores prefetched data    │     │
│                              └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## QueryClient Factory

### `getQueryClient()` (`src/lib/get-query-client.ts`)

```typescript
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_CONFIG.STALE_TIME,       // 60,000ms
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === QUERY_CONFIG.STATUS.PENDING,
      },
    },
  });
}
```

+------------------------+----------+---------------------------------------------------+
| Option                 | Value    | Effect                                            |
+------------------------+----------+---------------------------------------------------+
| staleTime              | 60000    | Data is fresh for 60s before refetch              |
|                        | (1 min)  |                                                   |
+------------------------+----------+---------------------------------------------------+
| shouldDehydrateQuery   | Success  | Pending queries are also sent to the client       |
|                        | or       | (shows loading spinner)                           |
|                        | Pending  |                                                   |
+------------------------+----------+---------------------------------------------------+

### Server vs Browser Singleton

```typescript
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();          // fresh for each request
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient(); // singleton
  }
  return browserQueryClient;
}
```

## Query Key Conventions

### Global keys (`src/constants/query-keys.ts`)

```typescript
export const QUERY_KEYS = {
  MODELS: {
    ALL: ["models"],
  },
} as const;
```

### Feature-specific keys (`src/features/auth/constants.ts`)

```typescript
export const AUTH_QUERY_KEYS = {
  ME: ["auth", "me"],
} as const;
```

Convention: array of strings in descending scope (`["domain", "subdomain"]`).

## Predefined Queries

### `modelQueries` (`src/lib/queries.ts`)

```typescript
export const modelQueries = {
  all: QUERY_KEYS.MODELS.ALL,
  list: () => ({
    queryKey: modelQueries.all,
    queryFn: modelsApi.list,   // ← fetcher dari features/chat/services/models-api.ts
  }),
};
```

> `queryFn` WAJIB memanggil fetcher `services/<feature>-api.ts` — bukan `api.*`
> inline di hook. `useModels` menggunakan `modelQueries.list()`.

Used by:
- `useModels` hook — client-side query (via Custom Hook layer)

> Note: Page tidak boleh langsung akses RQ query. Semua interaksi data
> harus lewat custom hooks. Lihat three-layer-architecture.md.

## Integration Points

+--------------------------------------+----------------------------------------------------+
| File                                 | How it uses TanStack Query                         |
+--------------------------------------+----------------------------------------------------+
| src/app/layout.tsx                   | Root layout — renders Providers wrapper             |
+--------------------------------------+----------------------------------------------------+
| src/app/providers.tsx                | Wraps app in QueryClientProvider                   |
+--------------------------------------+----------------------------------------------------+
| src/app/(chat)/page.tsx              | Client page — calls useChatPage() hook             |
+--------------------------------------+----------------------------------------------------+
| src/features/auth/hooks/useAuth.ts   | useQuery for auth me, useMutation for login        |
+--------------------------------------+----------------------------------------------------+
| src/features/chat/hooks/useModels.ts | useQuery wrapping modelQueries.list()              |
+--------------------------------------+----------------------------------------------------+
| src/features/chat/hooks/useChatPage.ts| useQuery for sessions + messages (dedup by key)   |
+--------------------------------------+----------------------------------------------------+
| src/features/settings/hooks/         | useQuery for settings fetch (dedup by key),        |
| useSettingsPage.ts                   | Zustand for local persistence                      |
+--------------------------------------+----------------------------------------------------+

## Dedup Pattern — useQuery + Zustand

When multiple components mount simultaneously and need the same data, React Query
deduplicates by `queryKey`. Only one network request is made per key.

### Pattern: Fetch via useQuery, sync to Zustand

```typescript
// In a shared hook (called by multiple components):
const { data } = useQuery({
  queryKey: ["settings"],    // ← same key = single request
  queryFn: settingsApi.get,
  staleTime: 60_000,
});

useEffect(() => {
  if (data) setConfig(data); // ← sync into Zustand store
}, [data, setConfig]);
```

**Before:** manual `useEffect` + module-level `fetchInFlight` flag (brittle).
**After:** React Query dedup by key — works automatically for `SettingsPage`
and `SettingsModal` sharing the same hook.

### Pattern — Session & Messages via useQuery

```typescript
// useChatPage.ts
const { data: sessionsList } = useQuery({
  queryKey: ["sessions"],
  queryFn: sessionApi.list,
  enabled: isAuthenticated,
  staleTime: 30_000,
});

const { data: messagesData } = useQuery({
  queryKey: ["sessions", activeSessionId, "messages"],
  queryFn: () => sessionApi.getMessages(activeSessionId!),
  enabled: !!activeSessionId,
  staleTime: 30_000,
});

// Sync to Zustand store
useEffect(() => {
  if (sessionsList) setSessions(sessionsList);
}, [sessionsList]);

useEffect(() => {
  if (messagesData) setMessages(transform(messagesData));
}, [messagesData]);
```

Key insight: when `activeSessionId` changes (via `selectSession`), React Query
automatically re-fetches messages because the `queryKey` changed — no manual
fetch needed.

## Standard Query Options (WAJIB)

Semua `useQuery` / `useInfiniteQuery` di web WAJIB memakai `QUERY_STANDARD`
dari `src/lib/query-standard.ts`:

```typescript
// src/lib/query-standard.ts
import { keepPreviousData } from "@tanstack/react-query";

export const QUERY_STANDARD = {
  retry: 1,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;
```

+--------------------------------+-------------------------------------------+
| Option                         | Alasan                                    |
+--------------------------------+-------------------------------------------+
| placeholderData:               | React Query v5 MEMBUANG `data` saat       |
| keepPreviousData               | refetch gagal (breaking v4). Tanpa ini,   |
|                                | satu kegagalan refetch membuat list       |
|                                | tampil kosong ("No recent chats") dan     |
|                                | MENETAP sampai query dimuat ulang. Data   |
|                                | lama tetap tampil selama refetch/error.   |
+--------------------------------+-------------------------------------------+
| retry: 1                       | Hindari retry storm (default 3).          |
+--------------------------------+-------------------------------------------+
| refetchOnWindowFocus: false    | Sinkronisasi lewat invalidasi eksplisit   |
|                                | (invalidateQueries + exact), bukan        |
|                                | refetch tak terduga saat tab fokus.       |
+--------------------------------+-------------------------------------------+

Contoh pemakaian:

```typescript
const query = useQuery({
  queryKey: ["features"],
  queryFn: featuresApi.list,
  ...QUERY_STANDARD,
  staleTime: 5 * 60_000,          // per-domain; lihat tabel di bawah
});
```

### Query dengan key berubah per-seleksi

`keepPreviousData` menampilkan data query sebelumnya sebagai placeholder saat
key berubah — untuk messages (per session) dan prompt versions (per template)
ini SALAH: akan menampilkan chat/versi milik entitas lain. Wajib menimpa
`placeholderData` dengan fungsi yang dibatasi key sebelumnya:

```typescript
// messages per session (queryKey: ["sessions", activeSessionId, "messages"])
placeholderData: (prev, prevQuery) => (prevQuery?.queryKey?.[1] === activeSessionId ? prev : undefined),

// prompt versions per template (queryKey: ["studio", "prompts", id, "versions"])
placeholderData: (prev, prevQuery) => (prevQuery?.queryKey?.[2] === templateId ? prev : undefined),
```

### staleTime per domain

+-------------------------------+----------------+--------------------------------+
| Domain                        | staleTime      | Keterangan                     |
+-------------------------------+----------------+--------------------------------+
| ["auth", "me"]                | 5 menit        | Mount komponen baru (mis.      |
|                               |                | SettingsModal) tidak memicu    |
|                               |                | refetch auth → tidak flip      |
|                               |                | isAuthenticated. Expiry tetap  |
|                               |                | ditangani interceptor 401.     |
+-------------------------------+----------------+--------------------------------+
| ["sessions"] (infinite)       | 30 detik       | List utama; di-refresh via     |
|                               |                | invalidate exact setelah       |
|                               |                | create/delete/title-gen.       |
+-------------------------------+----------------+--------------------------------+
| ["sessions", id, "messages"]  | 30 detik       | Pesan per session (infinite).  |
+-------------------------------+----------------+--------------------------------+
| ["models"], ["features"],     | 5 menit        | Katalog statis-ish.            |
| ["skills"]                    |                |                                |
+-------------------------------+----------------+--------------------------------+
| ["settings"]                  | 60 detik       | retry: false (override).       |
+-------------------------------+----------------+--------------------------------+
| ["studio", ...]               | 5 menit        | Prompts/maturity; invalidated  |
|                               |                | eksplisit oleh mutation.       |
+-------------------------------+----------------+--------------------------------+

### UI tiga-state (loading / error / empty)

Empty state ("No recent chats", "No messages") HANYA dirender saat query
sukses dan benar-benar kosong:

1. query pending tanpa data → indikator loading
2. query error tanpa data → pesan error + tombol Retry (`refetch`)
3. query error dengan data (placeholder) → banner "Failed to refresh" + Retry,
   data lama tetap tampil
4. sukses & kosong → empty state

Referensi: `SessionList.tsx` (sidebar), `ChatPage.tsx` (messages), 
`PromptLibrary.tsx` (studio). Lihat `ui-components.md`.

## Dependencies

### Internal

- `@/constants` — `QUERY_CONFIG`, `QUERY_KEYS`
- `@/lib/api-client` — `api.get()` inside queryFn

### External

- `@tanstack/react-query` — `QueryClient`, `QueryClientProvider`, `useQuery`, `useMutation`, `dehydrate`, `HydrationBoundary`, `defaultShouldDehydrateQuery`, `isServer`
- `@tanstack/react-query-devtools` — `ReactQueryDevtools`

## Source References

+----------------------------------+---------+----------------------------------------------------+
| File                             | Lines   | Description                                        |
+----------------------------------+---------+----------------------------------------------------+
| src/lib/get-query-client.ts      | 1-35    | makeQueryClient(), getQueryClient() — factory +    |
|                                  |         | singleton                                          |
+----------------------------------+---------+----------------------------------------------------+
| src/lib/get-query-client.ts      | 4-19    | Default options: staleTime, dehydrate config       |
+----------------------------------+---------+----------------------------------------------------+
| src/lib/queries.ts               | 1-21    | modelQueries — reusable list query with Model type |
+----------------------------------+---------+----------------------------------------------------+
| src/constants/query-keys.ts      | 1-5     | QUERY_KEYS definition                              |
+----------------------------------+---------+----------------------------------------------------+
| src/constants/index.ts           | 20-27   | QUERY_CONFIG — STALE_TIME, STATUS values           |
+----------------------------------+---------+----------------------------------------------------+
| src/app/providers.tsx            | 1-19    | Providers — QueryClientProvider + DevTools         |
+----------------------------------+---------+----------------------------------------------------+
| src/app/layout.tsx               | 1-34    | Root layout — wraps providers                      |
+----------------------------------+---------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
