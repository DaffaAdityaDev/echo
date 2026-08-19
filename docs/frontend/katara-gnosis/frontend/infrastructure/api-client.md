================================================================================
  KataraGnosis Frontend API Client (BFF Proxy)
================================================================================
  Module    : API Client
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The browser NEVER calls the Go backend directly. All requests flow through
Next.js route handlers (src/app/api/...) which forward to the backend at
BACKEND_URL (default http://localhost:8080) /api/v1, carrying the httpOnly
auth cookie. This mirrors frontend/web/src/lib/api-client.ts,
proxy-fetch.ts and get-request-token.ts.

Client Layer (src/lib/api-client.ts)
------------------------------------

  axios instance baseURL "/api", timeout 30s, withCredentials true.

  interceptors:
    request : inject traceparent (telemetry) when enabled
    response: 401 (non-auth endpoints) -> window.location = "/login"
              errors normalized via extractErrorMessage

  exports: api = { get, post, put, patch, delete }
  uploads : api.postForm(url, formData, { timeout: 120000 }) — multipart,
            50 MB cap, onUploadProgress optional for the progress bar.

Server Layer (BFF route handlers)
---------------------------------

  Pattern per route (copied from frontend/web):

    app/api/katara/lakes/route.ts:

      import { getRequestToken } from "@/lib/get-request-token";
      import { proxyFetch } from "@/lib/proxy-fetch";

      export async function GET() {
        const token = await getRequestToken();      // cookie auth_token
        return proxyFetch(`${BACKEND_URL}/api/v1/katara/lakes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      export async function POST(req: Request) {
        const token = await getRequestToken();
        const body = await req.json();
        return proxyFetch(`${BACKEND_URL}/api/v1/katara/lakes`, {
          method: "POST", headers: { ... , "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

  - proxyFetch normalizes JSON/204/empty/error responses (copy of
    frontend/web/src/lib/proxy-fetch.ts).
  - Multipart upload route streams the FormData body straight through
    (no re-serialization): body: req.body with original content-type
    headers preserved.
  - Timeout policy: katara LLM-backed endpoints (drill/next, drill/answer
    for essays) may take 30-60s: those proxies pass a 90s fetch timeout.

Auth Cookie
-----------

  - Login: POST /api/auth/login -> backend /api/v1/auth/login; the token is
    stripped from the response and set as httpOnly cookie "auth_token"
    (7 days, sameSite lax, path "/") on the app origin (port 3002).
  - Logout: /api/auth/logout clears the cookie (backend revoke).
  - Server reads: getRequestToken() -> cookies() (Next 16 async API).

Error Normalization
-------------------

  - Backend errors: {error, details} -> extractErrorMessage -> thrown as
    ApiError {status, message}.
  - UI treats 503 (infra down) specially: banner "Layanan penyimpanan
    sedang tidak tersedia" + retry.

Feature Services
----------------

  Each feature owns services/<feature>-api.ts (authApi, lakeApi,
  sourceApi, flashcardApi, drillApi, progressApi, settingsApi) mapping
  snake_case -> camelCase exactly like frontend/web chat-api.ts.

  lib/constants/api.ts      ENDPOINTS + getBackendApiUrl() (BACKEND_URL,
                            default http://localhost:8080)
  constants/query-keys.ts   query key factories

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
