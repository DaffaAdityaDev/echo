================================================================================
  API Client
================================================================================
  Module    : API Client
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

A thin Axios wrapper configured to communicate with the Echo Go backend. The client is created once and exported as a singleton, consumed by React Query hooks in the renderer components.

## File Structure

```
src/renderer/src/lib/api.ts
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              .env                                   │
│                   VITE_API_URL=http://localhost:3000/api/v1         │
│                              │                                     │
│                              v                                     │
│         api.ts ─── create Axios instance ───→  api                 │
│                                                  │                 │
│   Chat.tsx                                      │                 │
│     useQuery({ queryFn:                         │                 │
│       api.get("/models") })                     │                 │
│     useMutation({ mutationFn:                   │                 │
│       api.post("/chat", data) })                │                 │
│                                                  v                 │
│                                           ┌──────────────────┐     │
│                                           │   Go Backend     │     │
│                                           │ http://localhost │     │
│                                           │ :3000            │     │
│                                           └──────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Definition**: `src/renderer/src/lib/api.ts:3`
- **Imported by**: `src/renderer/src/components/Chat.tsx:9`

## Dependencies

+---------+-----------+-------------------+
| Package | Version   | Purpose           |
+---------+-----------+-------------------+
| axios   | ^1.13.4   | HTTP client       |
+---------+-----------+-------------------+

## Implementation

```
src/renderer/src/lib/api.ts:1-8
```

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Key Details

1. **Base URL** — reads from `VITE_API_URL` Vite env variable (defined in `frontend/dekstop/.env`)
2. **Fallback** — defaults to `http://localhost:3000/api/v1` if env is not set
3. **Content-Type** — always `application/json`
4. **Singleton** — the module exports a single pre-configured instance; no per-request configuration needed

### Environment Config

```
# frontend/dekstop/.env:1
VITE_API_URL=http://localhost:3000/api/v1
```

Vite exposes env vars prefixed with `VITE_` to the renderer source code at build/run time.

## Usage in Components

### GET `/models`

```
src/renderer/src/components/Chat.tsx:36-45
```

```typescript
const res = await api.get("/models")
// → GET http://localhost:3000/api/v1/models
return res.data.models || []
```

### POST `/chat`

```
src/renderer/src/components/Chat.tsx:57-59
```

```typescript
const res = await api.post("/chat", { message, model })
// → POST http://localhost:3000/api/v1/chat
return res.data
```

## Source Refs

+---------------------------------------------+---------+------------------------------------------+
| File                                        | Line(s) | Role                                     |
+---------------------------------------------+---------+------------------------------------------+
| src/renderer/src/lib/api.ts                 | 3-8     | Axios instance creation                  |
+---------------------------------------------+---------+------------------------------------------+
| .env                                        | 1       | VITE_API_URL definition                  |
+---------------------------------------------+---------+------------------------------------------+
| src/renderer/src/components/Chat.tsx        | 9, 36,  | Consumer imports                         |
|                                             | 57      |                                          |
+---------------------------------------------+---------+------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
