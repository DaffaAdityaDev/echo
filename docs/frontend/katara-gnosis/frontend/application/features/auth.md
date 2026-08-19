================================================================================
  KataraGnosis Frontend Auth
================================================================================
  Module    : Auth
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Authentication reuses the Echo backend auth endpoints (JWT, bcrypt). The
app runs on port 3002, so cookies are set on ITS origin via the BFF proxy
— the backend never sets cookies for the app (backend cookie flow is for
frontend/web; here we take the token from the response body and set it
ourselves). This mirrors frontend/web auth-flow.md with one difference:
the cookie is managed by the BFF, not the upstream.

Flow
----

  Login:
    POST /api/auth/login          (BFF)
      -> POST {BACKEND_URL}/api/v1/auth/login   {email, password}
      <- 200 {token, user, ...}
      -> setCookie("auth_token", token, {
             httpOnly: true, sameSite: "lax", path: "/",
             maxAge: 7*24*60*60, secure: NODE_ENV === "production" })
      -> {user} (token stripped)

  Me:
    GET /api/auth/me              (BFF)
      -> cookie -> Authorization: Bearer
      -> GET {BACKEND_URL}/api/v1/auth/me
      <- user | 401

  Logout:
    POST /api/auth/logout         (BFF)
      -> POST backend logout (revoke where supported)
      -> clearCookie("auth_token")
      -> invalidate ["auth","me"]

Client
------

  features/auth:
    AuthGuard.tsx        wraps (katara) layout; shows loader until
                         resolved; redirects to /login?redirect=<path>
    useAuth.ts           useQuery(["auth","me"], { retry:false,
                         staleTime: 5*60_000 }) synced into authStore
    loginMutation        invalidates ["auth","me"], router.push(redirect)
    logoutMutation       clears store + query cache + cookie route

  401 Handling
  ------------
    axios response interceptor: on 401 from non-auth endpoints ->
    window.location.href = "/login" (same as frontend/web).

Registration
------------

  First run: the app offers "Buat akun" calling backend
  POST /api/v1/auth/register (proxy route /api/auth/register), then
  auto-login. Personal-use default tier applies (backend tier service).

Session Persistence
-------------------

  - auth_token cookie: 7 days, refreshed on login.
  - No localStorage tokens ever (matches repo security standard).
  - AuthGuard + cookie both protect; SSR-safe (getRequestToken reads
    cookies() server-side).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
