# Katara Frontend: API Client & BFF Proxy Architecture

> Centralized HTTP fetch client forwarding browser requests to Katara Backend (`http://localhost:8090`).

---

## 1. BFF Proxy Pattern

The browser never directly connects to the Go backend. Instead, browser code invokes `/api/*` on the Next.js origin (`http://localhost:3002`), which transparently proxies the request to `http://localhost:8090`:

```
┌─────────────────┐             ┌─────────────────────┐             ┌──────────────────┐
│ Browser Client  │─── /api ───▶│ Next.js BFF Proxy   │─── Bearer ─▶│ Katara Backend   │
│ (Port 3002)     │             │ Reads auth_token ck │             │ (Port 8090)      │
└─────────────────┘             └─────────────────────┘             └──────────────────┘
```

---

## 2. API Utilities

- `src/lib/constants/api.ts`: Defines `BACKEND_URL` (default `http://localhost:8090`) and endpoint constant paths.
- `src/lib/proxy-fetch.ts`: Server-side proxy helper that extracts the `auth_token` cookie from request headers and injects `Authorization: Bearer <token>`. Supports configurable timeouts (default 30s, 90s for drill operations).
- `src/lib/api-client.ts`: Client-side typed wrapper (`api.get`, `api.post`, `api.patch`, `api.delete`, `api.postForm`) mapping responses and errors.
