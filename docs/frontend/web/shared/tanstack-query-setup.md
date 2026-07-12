================================================================================
  TanStack Query Setup
================================================================================
  Module    : TanStack Query Setup
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
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
    queryFn: async () => {
      return api.get<{ models: Model[] }>(ENDPOINTS.MODELS.LIST);
    },
  }),
};
```

Used by:
- `page.tsx` — server-side prefetch (Next.js App Router)
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
