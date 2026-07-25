===============================================================================
  Admin Feature
===============================================================================
  Module    : Admin Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-25
===============================================================================

## Deskripsi

Administrative dashboard for system monitoring and API key management. Provides real-time system stats (users, missions, API keys, requests), API key provisioning with scope-based access control, and quick-action links to common management tasks.

## File Structure

```
src/features/admin/
├── index.ts
├── api/
│   ├── useAdminStats.ts
│   └── useApiKeys.ts
├── hooks/
│   ├── useAdminDashboardPage.ts
│   └── useAdminApiKeysPage.ts
├── components/
│   ├── AdminDashboardPage.tsx
│   ├── AdminApiKeysPage.tsx
│   ├── StatCard.tsx
│   ├── SystemStatusBanner.tsx
│   ├── QuickActionGrid.tsx
│   ├── ApiKeyList.tsx
│   ├── CreateKeyModal.tsx
│   └── KeyDisplay.tsx
├── stores/                     (empty — no local state needed)
└── types/
    └── index.ts
```

## Flow Diagrams

### Dashboard Page

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      AdminDashboardPage                                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  SystemStatusBanner                                                 │  │
│  │  Operational status / gateway latency / last updated / refresh btn  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ StatCard │ │ StatCard │ │ StatCard │ │ StatCard │                    │
│  │ Total    │ │ Active   │ │ API Keys │ │ API Reqs │                    │
│  │ Users    │ │ Missions │ │          │ │          │                    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  QuickActionGrid                                                    │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │  │
│  │  │ API Key Mgmt │ │ API Docs     │ │ System Tel.  │               │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

### API Keys Page

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      AdminApiKeysPage                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  KeyDisplay (conditional — shown once after creation)               │  │
│  │  API key value with copy/hide/reveal controls, "save this key" warn │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  ApiKeyList                                                        │  │
│  │  ┌─────┬──────────┬────────┬────────┬──────────────┬────────┐    │  │
│  │  │Name │ Prefix   │ Scopes │ Status │ Created At   │ Actions│    │  │
│  │  ├─────┼──────────┼────────┼────────┼──────────────┼────────┤    │  │
│  │  │ ... │ ech_•••• │ read   │ Active │ Jul 25 2026  │ 🗑️    │    │  │
│  │  └─────┴──────────┴────────┴────────┴──────────────┴────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  CreateKeyModal (modal overlay)                                     │  │
│  │  Key name input + scope checkboxes + generate button                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Entry Points & Exports

### Barrel (`src/features/admin/index.ts`)

+----------------------+-------------+---------------------------------------------------+
| Export               | Kind        | Source                                            |
+----------------------+-------------+---------------------------------------------------+
| AdminDashboardPage   | Component   | components/AdminDashboardPage.tsx                 |
| AdminApiKeysPage     | Component   | components/AdminApiKeysPage.tsx                   |
| StatCard             | Component   | components/StatCard.tsx                           |
| SystemStatusBanner   | Component   | components/SystemStatusBanner.tsx                 |
| QuickActionGrid      | Component   | components/QuickActionGrid.tsx                    |
| useAdminDashboardPage| Hook        | hooks/useAdminDashboardPage.ts                    |
| useAdminApiKeysPage  | Hook        | hooks/useAdminApiKeysPage.ts                      |
| ApiKey, AdminStats   | Type        | types/index.ts                                    |
+----------------------+-------------+---------------------------------------------------+

> **Note:** `api/` hooks are internal — consumed by feature hooks, not re-exported from the barrel.

### Components

+----------------------+--------------------------------------------------------------+
| Component            | Description                                                  |
+----------------------+--------------------------------------------------------------+
| AdminDashboardPage   | Dashboard page — composes StatCard[], SystemStatusBanner,    |
|                      | QuickActionGrid. Props: stats, isLoading, error, onRefresh.  |
+----------------------+--------------------------------------------------------------+
| AdminApiKeysPage     | API key management page — composes ApiKeyList, CreateKeyModal,|
|                      | KeyDisplay. Props: keys, isLoading, error, CRUD callbacks.   |
+----------------------+--------------------------------------------------------------+
| StatCard             | Metric card with icon, value, description, loading skeleton. |
|                      | Props: title, value, icon, description, glowColor, isLoading.|
+----------------------+--------------------------------------------------------------+
| SystemStatusBanner   | Operational status banner with latency, nodes, uptime,       |
|                      | refresh button. Props: isOperational, latencyMs, onRefresh.  |
+----------------------+--------------------------------------------------------------+
| QuickActionGrid      | Link grid to API keys, docs, telemetry.                      |
+----------------------+--------------------------------------------------------------+
| ApiKeyList           | Table of API keys with name, prefix, scopes, status, revoke. |
|                      | Empty state when no keys.                                    |
+----------------------+--------------------------------------------------------------+
| CreateKeyModal       | Modal form — key name + scope checkboxes + generate.         |
+----------------------+--------------------------------------------------------------+
| KeyDisplay           | One-time key reveal with copy/hide, "save this key" warning. |
+----------------------+--------------------------------------------------------------+

### Hooks & API

+-----------------------+---------------------------+-----------------------------------------------------+
| Export                | File                      | Purpose                                             |
+-----------------------+---------------------------+-----------------------------------------------------+
| useAdminDashboardPage | hooks/useAdminDashboard   | Orchestrator — wraps useAdminStats. Returns stats,  |
|                       | Page.ts                   | isLoading, error, onRefresh, dataUpdatedAt.         |
+-----------------------+---------------------------+-----------------------------------------------------+
| useAdminApiKeysPage   | hooks/useAdminApiKeysPage | Orchestrator — wraps useApiKeys + modal state.      |
|                       |                           | Returns keys, CRUD actions, isModalOpen flag.       |
+-----------------------+---------------------------+-----------------------------------------------------+

### TanStack Query Hooks (`api/` — internal)

+-------------------+---------------------------+-----------------------------------------------------+
| Export            | File                      | Purpose                                             |
+-------------------+---------------------------+-----------------------------------------------------+
| useAdminStats     | api/useAdminStats.ts       | Polling query (10s interval) for admin stats.       |
+-------------------+---------------------------+-----------------------------------------------------+
| useApiKeys        | api/useApiKeys.ts          | Query + mutations for API key CRUD.                 |
+-------------------+---------------------------+-----------------------------------------------------+

### Types (`types/index.ts`)

+-----------+-------------------------------------------------------------+
| Type      | Purpose                                                     |
+-----------+-------------------------------------------------------------+
| ApiKey    | id, name, prefix, key (one-time), scopes, status, createdAt |
| AdminStats| countUsers, countMissions, countApiKeys, totalRequests      |
+-----------+-------------------------------------------------------------+

## Dependencies

### Internal

- `@/lib/api-client` — `api.get()`, `api.post()`, `api.delete()`
- `@/components/ui/Button`, `Badge`, `Input`, `Skeleton`, `Card`
- `@/utils/cn` — classname merging
- `lucide-react` — icons

### External

- `@tanstack/react-query` — `useQuery`, `useMutation`, `useQueryClient`

## API Routes

All under `/api/v1/admin/*`. See `docs/shared/contracts/endpoints.md` for full route table.

## Source References

+-----------------------------------------------------------+--------+--------------------------------------------------+
| File                                                      | Lines  | Description                                      |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/types/index.ts                         | 1-17   | ApiKey, AdminStats types                         |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/api/useAdminStats.ts                   | 1-16   | TanStack Query hook with 10s polling             |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/api/useApiKeys.ts                      | 1-53   | Query + create/revoke mutations                  |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/hooks/useAdminDashboardPage.ts          | 1-21   | Orchestrator — wraps useAdminStats               |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/hooks/useAdminApiKeysPage.ts            | 1-26   | Orchestrator — wraps useApiKeys + modal state    |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/AdminDashboardPage.tsx      | 1-133  | Dashboard layout with StatCard grid + banner     |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/AdminApiKeysPage.tsx        | 1-112  | API key page with list, modal, key display       |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/ApiKeyList.tsx              | 1-111  | Key table with revoke action                     |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/CreateKeyModal.tsx          | 1-149  | Modal form with scope checkboxes                 |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/KeyDisplay.tsx              | 1-69   | Key reveal with copy/hide controls               |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/StatCard.tsx                | 1-70   | Reusable metric card with skeleton               |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/SystemStatusBanner.tsx      | 1-93   | Status banner with refresh                       |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/components/QuickActionGrid.tsx         | 1-75   | Quick action link cards                          |
+-----------------------------------------------------------+--------+--------------------------------------------------+
| src/features/admin/index.ts                               | 1-8    | Barrel exports — components, hooks, types        |
+-----------------------------------------------------------+--------+--------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
