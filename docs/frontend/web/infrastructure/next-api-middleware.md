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
  → getRequestToken()   ← token dari httpOnly cookie / Authorization header
  → proxyFetch(gateway) ← forward ke Go dengan Bearer
  → NextResponse.json   ← return JSON
```

## Pola Umum (JSON proxy)

```typescript
import type { NextRequest } from "next/server";
import { getBackendApiUrl } from "@/constants/api";
import { getRequestToken } from "@/lib/get-request-token";
import { proxyFetch } from "@/lib/proxy-fetch";

const BASE_URL = getBackendApiUrl();

export async function GET(req: NextRequest) {
  const token = await getRequestToken();
  return proxyFetch(`${BASE_URL}/path`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

## Helper

| Helper | File | Peran |
|---|---|---|
| `getRequestToken()` | `src/lib/get-request-token.ts` | Baca token: cookie `auth_token`/`token` dulu, fallback header `Authorization` |
| `proxyFetch(url, init)` | `src/lib/proxy-fetch.ts` | Fetch gateway → `NextResponse.json` (status dipertahankan) |

## SSE Relay (pengecualian untuk streaming)

Endpoint streaming tidak bisa lewat `proxyFetch` (akan di-buffer). Gunakan pola
relay seperti `app/api/chat/stream/route.ts`: baca `getRequestToken()`, fetch ke
gateway, lalu salurkan `upstream.body` sebagai respons streaming.

## Pengecualian yang disengaja

- `app/api/auth/login` — endpoint akuisisi token: fetch gateway + set httpOnly cookie.
- `app/api/auth/logout` — invalidasi cookie lokal (tanpa panggil gateway).
- `app/api/docs/spec` — baca swagger statis dari disk (tanpa auth).

## Aturan

1. Semua fetch ke gateway lewat route `app/api/**`.
2. Route memakai `getRequestToken()` + `proxyFetch()` (kecuali pengecualian di atas).
3. Jangan menambah rewrite `/api/v1` untuk bypass route.
4. Token tidak pernah dibaca/ditulis dari `localStorage` di client.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
