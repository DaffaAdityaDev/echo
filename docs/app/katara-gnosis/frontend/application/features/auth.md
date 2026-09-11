# Katara Frontend: Standalone Authentication Feature

> User registration, login, session guard, and cookie lifecycle for KataraGnosis.

---

## 1. Authentication Topology

Katara implements its own standalone authentication independent of Echo:

```
[Browser Form: /login]
         │
         ▼
[BFF Proxy: POST /api/auth/login] ──▶ [Katara Backend: POST /api/v1/auth/login]
         │                                       │
         │◀────── Returns JWT Token + User ──────┘
         │
[Sets httpOnly Cookie 'auth_token' (7 days)]
         │
         ▼
[Redirects to / or target page]
```

---

## 2. Components & Hooks

- `LoginPage.tsx`: Single page handling both Login and Registration with a mode toggle.
- `AuthGuard.tsx`: Wrapper for protected routes. Redirects unauthenticated users to `/login?redirect=...`.
- `useAuth.ts`: Hook loading current user from `/api/auth/me` with `staleTime: 5 minutes`.
- `useLogin.ts`: Handles login / register mutation and error toast messaging.
- `authStore.ts`: Global Zustand store holding active user profile.
