==============================================================================
  API Client Pattern
==============================================================================
  Module    : API Client Pattern
  Service   : Web
  Version   : 2.1
  Updated   : 2026-08-07 (onResponse callback for reading X-Session-ID from SSE responses)
==============================================================================

## Deskripsi

The frontend uses **axios** as its HTTP client layer with **TanStack React Query** for
server-state caching and data fetching. Standard JSON requests go through an axios
instance (`api-client.ts`), while Server-Sent Events (SSE) streaming uses native `fetch`
for better ReadableStream support. All requests automatically inject W3C `traceparent`
headers for distributed tracing via `telemetry-fetch.ts`.

## Authentication (cookie-only)

Auth TIDAK dikelola di client. `api-client.ts` TIDAK membaca/menulis token dari
`localStorage` — token disimpan sebagai **httpOnly cookie** (`auth_token`/`token`)
yang di-set oleh route `app/api/auth/login`. Setiap request mengirim cookie via
`withCredentials: true`; **Next.js API route** (`app/api/**`) yang membaca cookie
via `getRequestToken()` dan meneruskan `Authorization: Bearer` ke Go gateway.

```
client → axios (cookie, no localStorage token) → app/api route → getRequestToken() → gateway
```

Response 401 → redirect ke `/login` (tanpa membersihkan localStorage).

## Fetcher Layer Convention

`features/<feature>/services/<feature>-api.ts` adalah **satu-satunya** pemanggil
`@/lib/api-client` (`api.get/post/put/patch/delete/stream/streamGet`). React-query
`queryFn` dan mutations memanggil method fetcher ini — hooks TIDAK memanggil
`api.*` langsung.

## File Structure

```
src/lib/
+-- api-client.ts         # Axios-based API client + SSE stream (native fetch)
+-- telemetry-fetch.ts    # W3C trace context generator
+-- get-query-client.ts   # QueryClient factory + browser singleton
+-- queries.ts            # Predefined query objects (modelQueries)
```

## Flow Diagrams

### Standard Request Flow (axios)

```
+-------------------------------------------------------------------------+
�                  Feature Hook (e.g., useAuth)                          �
�                          �                                              �
�                          v                                              �
�              useQuery/useMutation({ queryFn })                         �
�                          �                                              �
�                          v                                              �
�              api.get<T>("/auth/me")                                     �
�              api.post<T>("/auth/login", body)                          �
�                          �                                              �
�                          v                                              �
�            request<T>(endpoint, options)                                �
�                          �                                              �
�        +-----------------+-----------------+                           �
�        v                 v                 v                           �
� +--------------+  +------------------+  +------------------+           �
� � Axios        �  � Request          �  � Response         �           �
� � client       �  � interceptor:     �  � interceptor:     �           �
� � (axios.create�  � inject           �  � unwrap data,     �           �
� �  with        �  � traceparent,     �  � normalize errors �           �
� �  baseURL,    �  � x-agent-         �  �                  �           �
� �  timeout)    �  � session-id       �  �                  �           �
� +--------------+  +------------------+  +------------------+           �
�                          �                                              �
�                          v                                              �
�                 return response.data (as T)                             �
+-------------------------------------------------------------------------+
```

### SSE Stream Flow (native fetch)

```
+-------------------------------------------------------------------------+
�                   useChatStream.sendMessage(text)                       �
�                          �                                              �
�                          v                                              �
�              api.stream<StreamPacket>("/chat", payload, onChunk)        �
�                          �                                              �
�        +-----------------+-----------------+                           �
�        v                 v                 v                           �
� +------------------+  +------------------+  +----------------------+   �
� � POST /chat with  �  � Get ReadableStream� � Read chunks via       �   �
� � JSON body +      �  � from response.body� � reader.read() loop    �   �
� � trace headers    �  � (native fetch)    � �                      �   �
� +------------------+  +------------------+  +----------------------+   �
�                                                    �                   �
�                                                    v                   �
�                              +--------------------------------------+   �
�                              �     Buffer partial lines             �   �
�                              �     (handle split packets)           �   �
�                              +--------------------------------------+   �
�                                               v                         �
�                              +--------------------------------------+   �
�                              �     For each complete line:          �   �
�                              � +----------------------------------+ �   �
�                              � � Skip empty + comment lines       � �   �
�                              � �   (": heartbeat" SSE comments)   � �   �
�                              � � Strip "data: " prefix            � �   �
�                              � � Skip "[DONE]"                    � �   �
�                              � � JSON.parse ? onChunk(parsed)     � �   �
�                              � � Fallback ? onChunk({             � �   �
�                              � �   content: raw })                � �   �
�                              � +----------------------------------+ �   �
�                              +--------------------------------------+   �
+-------------------------------------------------------------------------+
```

> **Note:** The actual `api-client.ts` uses a hardcoded `baseURL: '/api'` (not
> `API_CONFIG.BASE_URL` + `API_VERSION`). The Go gateway routes are mounted under
> `/api/v1`, so requests to `/api/v1/chat` resolve correctly. The doc below
> describes the design intent; the code uses the simpler hardcoded approach.
>
> **Note:** The `x-agent-session-id` header is injected by the fetch interceptor
> when the request config or body contains a `sessionId` field.
> A 401 response triggers a redirect to `/login`.

### Reading Response Headers from SSE (`onResponse`)

`api.stream()` accepts an optional `onResponse` callback in `opts` — it fires
with the native `Response` as soon as the fetch promise resolves, BEFORE any
chunk is processed. This is the only way to read response headers from a
streaming request (a `Response.headers` object is not readable after the body
has been consumed).

```typescript
api.stream(
  CHAT_ENDPOINTS.STREAM,
  { message, sessionId },          // minimal payload — no model/mode/features
  onChunk,
  {
    signal,
    onResponse: (res) => {
      const id = res.headers.get("X-Session-ID");
      if (id) store.setActiveSession(id);   // new-session id learned here
    },
  },
);
```

The gateway ALWAYS sets `X-Session-ID` on `POST /api/v1/chat` responses with
the session id in use. When the request omits `sessionId` (New Chat), the
gateway creates the session server-side and the frontend reads the new id from
this header.

## API Client Export (`api-client.ts`)

### Types

```typescript
type ApiRequestOptions = AxiosRequestConfig & {
  params?: Record<string, string>;
  version?: string;
};
```

### Methods

+----------+------------------------------------------------+--------------------------------------------+
| Method   | Signature                                      | Description                                |
+----------+------------------------------------------------+--------------------------------------------+
| api.get  | api.get<T>(url, opts?) => Promise<T>           | GET request via axios                      |
+----------+------------------------------------------------+--------------------------------------------+
| api.post | api.post<T>(url, body, opts?) => Promise<T>    | POST request with JSON body via axios      |
+----------+------------------------------------------------+--------------------------------------------+
| api.put  | api.put<T>(url, body, opts?) => Promise<T>     | PUT request with JSON body via axios       |
+----------+------------------------------------------------+--------------------------------------------+
| api.delete | api.delete<T>(url, opts?) => Promise<T>      | DELETE request via axios                   |
+----------+------------------------------------------------+--------------------------------------------+
| api.stream | api.stream(endpoint, body, onChunk, opts?)  | SSE streaming POST (native fetch)          |
|          | => Promise<void>                               | opts.onResponse fires with the native     |
|          |                                                | Response for header reads (e.g.            |
|          |                                                | X-Session-ID)                              |
+----------+------------------------------------------------+--------------------------------------------+
| api.streamGet | api.streamGet(endpoint, onChunk, opts?) => Promise<void> | SSE streaming GET (native fetch) — used for session log replay (`/sessions/{id}/stream`) |
+----------+------------------------------------------------+--------------------------------------------+

### Axios Instance Configuration

| Option     | Value                                         | Description                     |
|------------|-----------------------------------------------|---------------------------------|
| baseURL    | `'/api'` (hardcoded)                          | Default API base path           |
| timeout    | 30000                                         | Request timeout in ms           |
| headers    | `{ 'Content-Type': 'application/json' }`      | Default request headers         |

### Request Interceptor

Injects `traceparent` from `generateTraceContext()` and conditionally adds
`x-agent-session-id` from `config.data.sessionId`.

### Response Interceptor

Unwraps `response.data` on success. On error, extracts `error.response.data.message`
or `error.response.statusText` and throws as an `Error`.

## Telemetry (`telemetry-fetch.ts`)

### `generateTraceContext()`

Generates W3C-compliant trace context:
- `traceId`: 32 hex chars (16 random bytes)
- `spanId`: 16 hex chars (8 random bytes)
- `traceparent`: `00-{traceId}-{spanId}-01`

Uses `crypto.getRandomValues()` when available, falls back to `Math.random()`.

### `traceAwareFetch()` (removed)

Was a standalone fetch wrapper � removed as dead code. The axios interceptor
handles all trace context injection.

## React Query Integration

The API client is consumed via **TanStack React Query** hooks for caching and
data-fetching state management.

### Pattern: Query + Mutation Hooks

```typescript
// src/features/auth/hooks/useAuth.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { authApi } from "./services/auth-api";
import { AUTH_QUERY_KEYS } from "./constants";

export function useAuth() {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEYS.ME,
    queryFn: authApi.me,
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
  });

  return { user: query.data, isLoading: query.isLoading, login: loginMutation.mutateAsync };
}
```

### Pattern: Predefined Query Objects

```typescript
// src/lib/queries.ts
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

### Pattern: SSE Streaming (no React Query)

Streaming endpoints bypass React Query and use `api.stream()` directly with
a callback-based approach for real-time chunks.

```typescript
// src/features/chat/services/chat-api.ts
export const chatApi = {
  sendMessage: async (message: string, sessionId?: string, onChunk: (data: StreamPacket) => void) => {
    return api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, { message, sessionId }, onChunk);
  },
  getHistory: async (): Promise<Message[]> => {
    return api.get(CHAT_ENDPOINTS.HISTORY);
  },
};
```

## Dependencies

### Internal

- `@/constants` � `API_CONFIG`, `API_VERSION`

### External

- `axios` ^1.16.0 � HTTP client
- `@tanstack/react-query` � server-state management
- `@tanstack/react-query-devtools` � dev tools

## Source References

+---------------------------+---------+----------------------------------------------------+
| File                      | Lines   | Description                                        |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 1-129   | Full API client: axios instance, request(),        |
|                           |         | stream(), api export                               |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 1-11    | Imports, BASE_URL, axios.create(config)            |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 13-26   | Request interceptor � traceparent injection        |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 28-37   | Response interceptor � error normalization         |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 39-42   | ApiRequestOptions type (extends AxiosRequestConfig) |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 44-53   | request<T>() � axios-based HTTP request            |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 55-100  | stream<T>() � SSE streaming (native fetch)         |
+---------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts     | 102-109 | api object � exposes get, post, put, delete, stream|
+---------------------------+---------+----------------------------------------------------+
| src/lib/telemetry-fetch.ts| 12-40   | generateTraceContext() � W3C traceparent generation|
+---------------------------+---------+----------------------------------------------------+
| src/lib/telemetry-fetch.ts| 45-57   | traceAwareFetch() � removed (dead code)           |
+---------------------------+---------+----------------------------------------------------+

===============================================================================
  � 2026 Echo � All Rights Reserved
===============================================================================
