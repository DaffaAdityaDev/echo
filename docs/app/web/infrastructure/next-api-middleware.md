================================================================================
  Next.js API Route Middleware
================================================================================
  Module    : Next API Middleware
  Service   : Web
  Version   : 1.0
  Updated   : 2026-08-06
================================================================================

## Deskripsi

`src/app/api/**/route.ts` adalah **satu-satunya jembatan** antara frontend dan
Go gateway. Semua request backend WAJIB lewat route ini — tidak ada akses
langsung ke gateway (no `/api/v1/:path*` rewrite bypass). Route ini berperan
sebagai middleware untuk auth/token dan mengembalikan JSON.

## Alur

```
Client → axios/fetch (baseURL "/api") → app/api/<path>/route.ts
  → proxyToBackend(path) ← getRequestToken() + Bearer, forward ke Go gateway
  → NextResponse.json    ← return JSON (status dipertahankan)
```

## Pola Umum (JSON proxy)

```typescript
import type { NextRequest } from "next/server";
import { proxyToBackend, readJsonBody } from "@/lib/backend-proxy";

export async function GET() {
  return proxyToBackend("/path");
}

export async function POST(req: NextRequest) {
  return proxyToBackend("/path", "POST", await readJsonBody(req));
}
```

Segmen path dinamis WAJIB di-`encodeURIComponent` sebelum diteruskan.

## Helper

| Helper | File | Peran |
|---|---|---|
| `proxyToBackend(path, method?, body?)` | `src/lib/backend-proxy.ts` | Bearer + `Content-Type: application/json`, relay JSON via `proxyFetch` |
| `proxyStreamToBackend(path, req, forwardHeaders?)` | `src/lib/backend-proxy.ts` | Relay SSE POST via `proxyEventStream`, abort upstream saat client disconnect |
| `readJsonBody(req)` | `src/lib/backend-proxy.ts` | Baca body JSON request untuk diteruskan |
| `getRequestToken()` | `src/lib/get-request-token.ts` | Baca token: cookie `auth_token` dulu, fallback header `Authorization` |
| `proxyFetch(url, init)` | `src/lib/proxy-fetch.ts` | Fetch gateway → `NextResponse.json` (status dipertahankan) |
| `proxyEventStream(url, init, forwardHeaders)` | `src/lib/proxy-stream.ts` | Relay `text/event-stream`; backend mati → JSON 502 |
| `authSessionResponse(res, text)` | `src/lib/auth-session-response.ts` | Login/refresh: pindahkan token ke httpOnly cookie, hapus dari body |

## SSE Relay (pengecualian untuk streaming)

Endpoint streaming tidak bisa lewat `proxyFetch` (akan di-buffer). Gunakan
`proxyStreamToBackend` seperti `app/api/chat/stream/route.ts` dan
`app/api/sessions/[id]/approve|deny/route.ts`.

## Pengecualian yang disengaja

- `app/api/auth/login`, `app/api/auth/refresh` — akuisisi token: fetch gateway + set httpOnly cookie (`authSessionResponse`).
- `app/api/auth/logout` — revoke best-effort ke gateway, lalu hapus cookie lokal.
- `app/api/docs/spec` — baca swagger statis dari disk (tanpa auth).

## Aturan

1. Semua fetch ke gateway lewat route `app/api/**`.
2. Route memakai `proxyToBackend()` / `proxyStreamToBackend()` (kecuali pengecualian di atas).
3. Jangan menambah rewrite `/api/v1` untuk bypass route.
4. Token tidak pernah dibaca/ditulis dari `localStorage` di client.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
