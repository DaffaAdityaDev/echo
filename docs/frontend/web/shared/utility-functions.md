================================================================================
  Utility Functions
================================================================================
  Module    : Utility Functions
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Small, pure utility functions shared across the frontend. Currently consists of the `cn()` classname merger (used by all UI components) and the HTTP helper functions in the API client (axios-based with SSE streaming on native fetch).

## File Structure

```
src/utils/
└── cn.ts               # clsx + tailwind-merge utility

src/lib/
├── api-client.ts       # request(), stream(), ApiRequestOptions type
└── telemetry-fetch.ts  # generateTraceContext(), traceAwareFetch()
```

## Flow Diagram

### cn() Usage Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              Component (e.g., Button.tsx)                           │
│                              │                                     │
│       import { cn } from "@/utils/cn"                              │
│       cn(clsx(conditional classes), user className)                │
│                              │                                     │
│                              v                                     │
│                    cn(...inputs: ClassValue[])                      │
│                              │                                     │
│        ┌─────────────────────┴─────────────────────┐               │
│        v                                           v               │
│ ┌──────────────────┐                   ┌──────────────────────────┐ │
│ │ clsx(inputs)     │                   │ twMerge(...)             │ │
│ │ → resolve        │                   │ → merge Tailwind classes│ │
│ │   conditionals   │                   │   (last wins)            │ │
│ │   into single    │                   │                          │ │
│ │   string         │                   │                          │ │
│ └──────────────────┘                   └────────────┬─────────────┘ │
│                                                     v               │
│                                          ┌──────────────────────────┐│
│                                          │   Final className string ││
│                                          └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Functions

### `cn()` (`src/utils/cn.ts`)

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- **Purpose**: Merges Tailwind CSS class names, resolving conflicts predictably (last class wins).
- **Parameters**: Any number of `ClassValue` arguments (strings, objects, arrays, falsy values).
- **Returns**: A single merged className string.
- **Usage**: Every UI component (`Button`, `Card`, `Input`, `Badge`, `Skeleton`) and many feature components (e.g., `Sidebar`, `MessageItem`, `AgentProgress`).

### `request<T>()` (`src/lib/api-client.ts` — lines 44-53)

```typescript
async function request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T>
```

- Uses axios client with `baseURL`, optional `version`, endpoint, and `params`
- Trace headers injected via axios request interceptor
- Returns `response.data` (already parsed JSON)
- Errors normalized via axios response interceptor

### `stream<T>()` (`src/lib/api-client.ts` — lines 55-100)

```typescript
async function stream<T = unknown>(endpoint: string, body: unknown, onChunk: (data: T) => void, options: ApiRequestOptions = {}): Promise<void>
```

- POSTs JSON body, reads `ReadableStream` via `getReader()`
- Buffers partial lines across chunks
- Strips `data: ` SSE prefix, skips `[DONE]`, parses JSON and calls `onChunk`
- Fallback: wraps raw string as `{ content: string }`

### `generateTraceContext()` (`src/lib/telemetry-fetch.ts` — lines 12-40)

```typescript
function generateTraceContext(): TraceContext
```

- Generates W3C `traceparent` header value
- Returns `{ traceparent, traceId, spanId }`

### `traceAwareFetch()` (`src/lib/telemetry-fetch.ts` — lines 45-57)

```typescript
async function traceAwareFetch(url: string, sessionId?: string, options: RequestInit = {}): Promise<Response>
```

- Fetch wrapper that automatically injects W3C trace headers

### `ApiRequestOptions` type (`src/lib/api-client.ts` — lines 39-42)

```typescript
type ApiRequestOptions = AxiosRequestConfig & {
  params?: Record<string, string>;
  version?: string;
};
```

## Dependencies

### Internal

- `@/constants` (for `api-client.ts` — `API_CONFIG`, `API_VERSION`)

### External

- `clsx` — conditional classname library
- `tailwind-merge` — intelligent Tailwind CSS class merger
- `axios` — HTTP client for API requests

## Source References

+-----------------------------------+---------+----------------------------------------------------+
| File                              | Lines   | Description                                        |
+-----------------------------------+---------+----------------------------------------------------+
| src/utils/cn.ts                   | 1-10    | cn() function — clsx + twMerge                     |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts             | 39-42   | ApiRequestOptions type (extends AxiosRequestConfig) |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts             | 44-53   | request<T>() — HTTP request helper (axios)         |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/api-client.ts             | 55-100  | stream<T>() — SSE streaming helper (native fetch)  |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/telemetry-fetch.ts        | 6-10    | TraceContext interface                             |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/telemetry-fetch.ts        | 12-40   | generateTraceContext()                             |
+-----------------------------------+---------+----------------------------------------------------+
| src/lib/telemetry-fetch.ts        | 45-57   | traceAwareFetch() wrapper                          |
+-----------------------------------+---------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
