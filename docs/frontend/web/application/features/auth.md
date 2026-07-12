================================================================================
  Auth Feature
================================================================================
  Module    : Auth Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Deskripsi

Handles user authentication — login, logout, session retrieval — using JWT tokens managed by TanStack Query and persisted in a Zustand store via `useAuthStore`. The feature provides a `useAuth` hook that exposes authentication state and login/logout mutations to the rest of the application.

## File Structure

```
src/features/auth/
├── constants.ts
├── index.ts
├── components/
│   ├── AuthGuard.tsx
│   ├── LoginForm.tsx
│   └── LoginPage.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useLoginPage.ts
├── services/
│   └── auth-api.ts
├── stores/
│   └── authStore.ts
└── types/
    └── index.ts
```

## Flow Diagrams

### Login Flow

```
┌─────────────────┐
│    LoginForm    │
│  (139 lines,    │
│ form + validasi)│
└────────┬────────┘
         │ calls loginAsync(credentials) — injected via props
         v
┌──────────────────────┐
│  useLoginPage hook   │
│  (bridge: merges     │
│  useAuth +           │
│  useAuthStore)       │
└──────────┬───────────┘
           │ delegates to loginMutation.mutateAsync(creds)
           v
┌──────────────────────┐
│   useAuth hook       │
│   (loginMutation)    │
└──────────┬───────────┘
           │ mutationFn: authApi.login(creds)
           v
┌──────────────────────────┐
│ authApi.login(credentials)│
└────────┬─────────────────┘
         │ api.post("/auth/login", creds)
         v
┌──────────────────────┐     LoginResponse    ┌─────────────┐
│     Backend API      │ ──────────────────→  │ { token,    │
│                      │                      │   user }    │
└──────────┬───────────┘                      └─────────────┘
           │ onSuccess → setToken(token) → localStorage + Zustand
           │             queryClient.invalidateQueries(["auth","me"])
           v
┌──────────────────────┐     User object      ┌──────────────────┐
│     authApi.me()     │ ──────────────────→  │ cached in        │
│                      │                      │ TanStack Query   │
└──────────┬───────────┘                      └──────────────────┘
           v
┌──────────────────────────────────────────────┐
│ useAuth().user / isAuthenticated /           │
│ isLoggingIn / loginError / logout /          │
│ isLoggingOut — available app-wide            │
└──────────────────────────────────────────────┘
```

### Logout Flow

```
┌──────────┐
│  Button  │
│ (Sign out)│
└─────┬────┘
      │ calls useAuth().logout()
      v
┌──────────────────────┐
│  useAuth hook        │
│  (logoutMutation)    │
└──────┬───────────────┘
       │ mutationFn: authApi.logout
       v
┌──────────────────────┐
│ authApi.logout()     │
│ → POST /auth/logout  │
└──────────┬───────────┘
           │ onSuccess
           v
┌──────────────────────────────────────────┐
│ clearAuth()                              │
│  → localStorage.removeItem(AUTH_TOKEN)   │
│  → set({ user: null, token: null })      │
│ queryClient.clear()                      │
│ router.push("/login")                    │
└──────────────────────────────────────────┘
```

### Session Check Flow

```
┌─────────────────┐
│    useAuth()    │
└────────┬────────┘
         │ useQuery({ queryKey: ["auth","me"],
         │           queryFn: authApi.me,
         │           enabled: !!token,
         │           retry: false })
         v
┌──────────────────────┐
│  GET /api/v1/auth/me │
└──────────┬───────────┘
           │
      ┌────┴─────┐
      │          │
      v          v
┌────────┐  ┌────────┐
│ 200    │  │ 401    │
│ user   │  │ error  │
│ object │  │(no re- │
│        │  │ try)   │
│ isAuth │  │ isAuth │
│ = true │  │ = false│
└────────┘  └────────┘
```

## Entry Points & Exports

+------------------+-----------+----------------------------------------------------+
| Export           | Kind      | Source                                             |
+------------------+-----------+----------------------------------------------------+
| useAuth          | Hook      | src/features/auth/hooks/useAuth.ts                 |
+------------------+-----------+----------------------------------------------------+
| authApi          | Service   | src/features/auth/services/auth-api.ts             |
+------------------+-----------+----------------------------------------------------+
| LoginForm        | Component | src/features/auth/components/LoginForm.tsx         |
+------------------+-----------+----------------------------------------------------+
| AuthGuard        | Component | src/features/auth/components/AuthGuard.tsx         |
+------------------+-----------+----------------------------------------------------+
| User             | Type      | src/features/auth/types/index.ts                   |
+------------------+-----------+----------------------------------------------------+
| AuthState        | Type      | src/features/auth/types/index.ts                   |
+------------------+-----------+----------------------------------------------------+
| LoginCredentials | Type      | src/features/auth/types/index.ts                   |
+------------------+-----------+----------------------------------------------------+
| LoginResponse    | Type      | src/features/auth/types/index.ts                   |
+------------------+-----------+----------------------------------------------------+
| AUTH_ENDPOINTS   | Constants | src/features/auth/constants.ts                     |
+------------------+-----------+----------------------------------------------------+
| AUTH_QUERY_KEYS  | Constants | src/features/auth/constants.ts                     |
+------------------+-----------+----------------------------------------------------+

> **Note:** `AUTH_ENDPOINTS` and `AUTH_QUERY_KEYS` are **not** re-exported through the feature barrel (`index.ts`). They must be imported directly from `src/features/auth/constants.ts`.

### Barrel export (`src/features/auth/index.ts`)

```typescript
export * from "./hooks/useAuth";
export * from "./services/auth-api";
export * from "./types";
export * from "./components/LoginForm";
export * from "./components/AuthGuard";
```

> `LoginPage` and `useLoginPage` are internal-only — used within the feature, not re-exported from the barrel.

### Components

+------------+--------+-----------------------------------------------------------+
| Component  | Export | Description                                               |
+------------+--------+-----------------------------------------------------------+
| LoginForm  | Yes    | Form with email/password fields, client-side validation,  |
|            |        | loading state, show/hide password toggle, error banner.   |
|            |        | Props: loginAsync, isLoggingIn, loginError.               |
+------------+--------+-----------------------------------------------------------+
| LoginPage  | No     | Full-screen layout wrapper — centers LoginForm with       |
|            |        | branding header ("Sign in / Welcome back to Echo").       |
|            |        | Source: components/LoginPage.tsx.                         |
+------------+--------+-----------------------------------------------------------+
| AuthGuard  | Yes    | Route guard — redirects unauthenticated users to          |
|            |        | `/login?redirect=<path>`. Shows loading spinner while     |
|            |        | session is being checked. Uses useAuth internally.        |
|            |        | Source: components/AuthGuard.tsx.                         |
+------------+--------+-----------------------------------------------------------+

### Hooks

+--------------+--------+----------------------------------------------------------+
| Hook         | Export | Description                                              |
+--------------+--------+----------------------------------------------------------+
| useAuth      | Yes    | Core auth hook — user, isLoading, isAuthenticated,       |
|              |        | login, loginAsync, isLoggingIn, loginError, logout,      |
|              |        | isLoggingOut. Uses TanStack Query for session +          |
|              |        | mutations, integrates with authStore for token.          |
+--------------+--------+----------------------------------------------------------+
| useLoginPage | No     | Bridge hook — merges useAuth + useAuthStore to expose    |
|              |        | auth state and raw token in a single interface for       |
|              |        | the login page. Source: hooks/useLoginPage.ts.           |
+--------------+--------+----------------------------------------------------------+

### Store

+--------------+--------+----------------------------------------------------------+
| Store        | Export | Description                                              |
+--------------+--------+----------------------------------------------------------+
| useAuthStore | No     | Zustand store — persists token to localStorage.          |
|              |        | State: token, user. Actions: setToken, setUser,          |
|              |        | clearAuth. Source: stores/authStore.ts.                  |
+--------------+--------+----------------------------------------------------------+

## Dependencies

### Internal

- `@/lib/api-client` — HTTP client for all API calls
- `@/constants` — `STORAGE_KEYS.AUTH_TOKEN` for localStorage key

### External

- `@tanstack/react-query` — `useQuery`, `useMutation`, `useQueryClient`
- `zustand` — lightweight state management for token persistence

## Source References

+-----------------------------------------+---------+-------------------------------------------------------+
| File                                    | Lines   | Description                                           |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/types/index.ts        | 1-23    | User, AuthState, LoginCredentials, LoginResponse      |
|                                         |         | interfaces                                            |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/constants.ts          | 1-9     | AUTH_ENDPOINTS (LOGIN, LOGOUT, ME) and                |
|                                         |         | AUTH_QUERY_KEYS                                       |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/services/auth-api.ts  | 5-17    | authApi object with login, logout, me methods         |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/hooks/useAuth.ts      | 8-52    | useAuth hook — query for user, mutations for          |
|                                         |         | login and logout, authStore integration               |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/hooks/useLoginPage.ts | 1-12    | Bridge hook merging useAuth + useAuthStore            |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/stores/authStore.ts   | 1-29    | Zustand store — token persistence, setToken,          |
|                                         |         | clearAuth                                             |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/components/LoginForm  | 1-139   | Login form with validation, loading, show/hide        |
| .tsx                                    |         | password toggle                                       |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/components/AuthGuard  | 1-50    | Route guard — redirects unauthenticated, loading      |
| .tsx                                    |         | spinner                                               |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/components/LoginPage  | 1-19    | Login page layout wrapper                             |
| .tsx                                    |         |                                                       |
+-----------------------------------------+---------+-------------------------------------------------------+
| src/features/auth/index.ts              | 1-5     | Barrel re-exports                                     |
+-----------------------------------------+---------+-------------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
