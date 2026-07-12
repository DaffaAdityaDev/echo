================================================================================
  Constants
================================================================================
  Module    : Constants
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Centralized constants module at `src/constants/` containing shared configuration values for API endpoints, query keys, app config, storage keys, and UI config. Re-exported through a barrel `index.ts`.

## File Structure

```
src/constants/
├── api.ts            # API version, endpoint paths
├── query-keys.ts     # TanStack Query key definitions
└── index.ts          # Barrel — re-exports + app/storage/UI config
```

## Flow Diagram

### Import Resolution

```
┌─────────────────────────────────────────────────────────────────────┐
│ import { ENDPOINTS, QUERY_KEYS, API_CONFIG, STORAGE_KEYS }         │
│                              from "@/constants"                     │
│                              │                                     │
│                              v                                     │
│                    src/constants/index.ts                           │
│                              │                                     │
│              ┌───────────────┴───────────────┐                     │
│              v                               v                     │
│ ┌────────────────────────┐   ┌────────────────────────────────┐     │
│ │ src/constants/         │   │ src/constants/api.ts           │     │
│ │ query-keys.ts          │   │                                │     │
│ │ └── QUERY_KEYS         │   │ └── API_VERSION                │     │
│ └────────────────────────┘   │ └── ENDPOINTS                  │     │
│                              └────────────────────────────────┘     │
│                                                                     │
│   Also exports directly from index.ts:                              │
│     ├── API_CONFIG      — base URL, timeout                        │
│     ├── APP_CONFIG      — app name, version                        │
│     ├── STORAGE_KEYS    — localStorage key names                   │
│     ├── QUERY_CONFIG    — stale time, status enum                  │
│     └── UI_CONFIG       — scroll behavior                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Files

### `api.ts`

```typescript
export const API_VERSION = "v1";

export const ENDPOINTS = {
  MODELS: {
    LIST: "/models",
  },
} as const;
```

### `query-keys.ts`

```typescript
export const QUERY_KEYS = {
  MODELS: {
    ALL: ["models"],
  },
} as const;
```

### `index.ts` (barrel)

Exports everything from `api.ts` and `query-keys.ts`, plus additional config:

+--------------+----------------------------------------+-----------------------------------------------+
| Export       | Value                                  | Description                                   |
+--------------+----------------------------------------+-----------------------------------------------+
| API_VERSION  | "v1"                                   | API version prefix                            |
+--------------+----------------------------------------+-----------------------------------------------+
| ENDPOINTS    | { MODELS: { LIST: "/models" } }        | Shared endpoint paths                         |
+--------------+----------------------------------------+-----------------------------------------------+
| QUERY_KEYS   | { MODELS: { ALL: ["models"] } }        | Query key constants                           |
+--------------+----------------------------------------+-----------------------------------------------+
| API_CONFIG   | { BASE_URL, TIMEOUT }                  | Base URL (from env or default) + 15s timeout  |
+--------------+----------------------------------------+-----------------------------------------------+
| APP_CONFIG   | { NAME: "ECHO Brain", VERSION: "1.0.0" } | App metadata                               |
+--------------+----------------------------------------+-----------------------------------------------+
| STORAGE_KEYS | { AUTH_TOKEN, CHAT_HISTORY, THEME }    | localStorage keys                             |
+--------------+----------------------------------------+-----------------------------------------------+
| QUERY_CONFIG | { STALE_TIME: 60000, STATUS: {...} }   | TanStack Query config                         |
+--------------+----------------------------------------+-----------------------------------------------+
| UI_CONFIG    | { SCROLL_BEHAVIOR: "smooth" }          | UI preferences                                |
+--------------+----------------------------------------+-----------------------------------------------+

### Key Values

```typescript
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  TIMEOUT: 15000,
};

export const APP_CONFIG = {
  NAME: "ECHO Brain",
  VERSION: "1.0.0",
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: "echo_auth_token",
  CHAT_HISTORY: "echo_chat_history",
  THEME: "echo_theme",
};

export const QUERY_CONFIG = {
  STALE_TIME: 60 * 1000,
  STATUS: {
    PENDING: "pending",
    SUCCESS: "success",
    ERROR: "error",
  },
} as const;

export const UI_CONFIG = {
  SCROLL_BEHAVIOR: "smooth" as ScrollBehavior,
};
```

## Usage Across the Codebase

+--------------------------------------+---------------------------------------+
| Consumer                             | What it imports                       |
+--------------------------------------+---------------------------------------+
| src/lib/api-client.ts                | API_CONFIG, API_VERSION — base URL    |
|                                      | construction                          |
+--------------------------------------+---------------------------------------+
| src/lib/queries.ts                   | QUERY_KEYS, ENDPOINTS — model query   |
|                                      | factory                               |
+--------------------------------------+---------------------------------------+
| src/lib/get-query-client.ts          | QUERY_CONFIG — stale time             |
+--------------------------------------+---------------------------------------+
| src/features/chat/components/        | UI_CONFIG — scroll behavior           |
| MessageList.tsx                      |                                       |
+--------------------------------------+---------------------------------------+
| Feature-specific constants live      | AUTH_ENDPOINTS, CHAT_ENDPOINTS, etc.  |
| within the feature folder            |                                       |
+--------------------------------------+---------------------------------------+

## Dependencies

### Internal

- None (leaf module)

### External

- None

## Source References

+-----------------------------+---------+----------------------------------------------------+
| File                        | Lines   | Description                                        |
+-----------------------------+---------+----------------------------------------------------+
| src/constants/api.ts        | 1-7     | API_VERSION, ENDPOINTS.MODELS.LIST                 |
+-----------------------------+---------+----------------------------------------------------+
| src/constants/query-keys.ts | 1-5     | QUERY_KEYS.MODELS.ALL                              |
+-----------------------------+---------+----------------------------------------------------+
| src/constants/index.ts      | 1-31    | Barrel re-exports, API_CONFIG, APP_CONFIG,         |
|                             |         | STORAGE_KEYS, QUERY_CONFIG, UI_CONFIG               |
+-----------------------------+---------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
