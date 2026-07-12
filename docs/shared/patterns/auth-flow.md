================================================================================
  AUTHENTICATION FLOW
================================================================================
  Module    : Auth Flow
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Two distinct JWT authentication systems coexist in Echo:

1. **User JWT**: Issued by the Go Fiber gateway at login for end-user
   (client) requests. Validated by the gateway's `AuthRequired` middleware.
2. **Service JWT**: Self-signed by the Agent for service-to-service calls
   back to the Gateway (Memory Gateway). Validated by a separate
   `ServiceAuthRequired` middleware using a different secret.

The Hono Agent also uses a shared `INTERNAL_AUTH_TOKEN` for Go → Agent
calls. The frontend uses React Query with a custom hook.

## File Structure

+------------------------------------+--------------------------------------------+
| Location                           | Role                                       |
+------------------------------------+--------------------------------------------+
| backend/internal/handler/          |                                            |
|   auth_handler.go                  | Login handler, JWT creation, cookie set    |
| backend/internal/middleware/       |                                            |
|   auth.go                         | AuthRequired middleware (User JWT)         |
|   service_auth.go                 | ServiceAuthRequired middleware (Service    |
|                                   |   JWT)                                     |
| backend/internal/constants/auth/   |                                            |
|   jwt.go                          | Cookie name, header, error constants       |
| backend/internal/service/         |                                            |
|   auth_service.go                  | Auth service interface                     |
| agent/src/app/middleware/auth.ts   | Agent auth middleware (internal token)     |
| agent/src/core/agent/plugins/     |                                            |
|   memory-plugin.ts                | Service JWT signing + memory fetch         |
| agent/src/shared/constants/       |                                            |
|   middleware.ts                    | AUTH_CONSTANTS                             |
| agent/src/config/env.schema.ts    | Env validation                             |
| frontend/web/src/features/auth/   |                                            |
|   services/auth-api.ts            | Auth API service                           |
|   hooks/useAuth.ts                | useAuth React Query hook                   |
| frontend/web/src/lib/api-client.ts| API client                                 |
+------------------------------------+--------------------------------------------+

## ASCII Flow Diagram

                       JWT AUTH FLOW — FULL CHAIN
                       ─────────────────────────────

  ┌──────────────┐           ┌──────────────────┐           ┌──────────────────┐
  │   FRONTEND   │           │   GO BACKEND     │           │   HONO AGENT     │
  │  (Next.js)   │           │   (Fiber)        │           │   (Bun/Hono)     │
  └──────┬───────┘           └────────┬─────────┘           └────────┬─────────┘
         │                           │                              │
         │   LOGIN FLOW             │                              │
         │   POST /auth/login       │                              │
         │   { username }           │                              │
         │─────────────────────────►│                              │
         │                           │                              │
         │                           │  Create JWT Claims:          │
         │                           │   sub: userID               │
         │                           │   exp: now + 72h            │
         │                           │   iat: now                  │
         │                           │                              │
         │                           │  Sign with JWT_SECRET       │
         │                           │  (HS256)                    │
         │                           │                              │
         │  Set Cookie:              │                              │
         │   auth_token (httpOnly,   │                              │
         │   secure, SameSite=Lax)   │                              │
         │  Response:                │                              │
         │  { token, user }         │                              │
         │◄─────────────────────────│                              │
         │                           │                              │
         │                           │                              │
         │   CHAT REQUEST           │                              │
         │   POST /chat              │                              │
         │   Cookie: auth_token=xxx  │                              │
         │   (or Authorization:      │                              │
         │    Bearer xxx)           │                              │
         │─────────────────────────►│                              │
         │                           │                              │
         │                           │  AuthRequired(secret):       │
         │                           │   1. Read Cookie:           │
         │                           │      "auth_token"           │
         │                           │   2. Fallback Header:       │
         │                           │      "Authorization: Bearer"│
         │                           │   3. jwt.Parse(token)       │
         │                           │      with secret            │
         │                           │   4. Set c.Locals(          │
         │                           │      "user_id", claims)     │
         │                           │                              │
         │                           │  Forward to Agent:           │
         │                           │  Header: X-Internal-Token   │
         │                           │────────────────────────────►│
         │                           │                              │
         │                           │                              │  authMiddleware():
         │                           │                              │   1. Skip if path == "/"
         │                           │                              │   2. Read Authorization or
         │                           │                              │      X-Internal-Token
         │                           │                              │   3. Compare with
         │                           │                              │      INTERNAL_AUTH_TOKEN
         │                           │                              │   4. 403 if mismatch
         │                           │                              │
         │   SSE Stream             │                              │
         │◄─────────────────────────│◄─────────────────────────────│
         │                           │                              │

  ┌────────┬────────┐       ┌────────┬────────┐       ┌────────┬────────┐
  │ TOKEN EXTRACTION │       │ TOKEN VALIDATION │       │ INTERNAL TOKEN  │
  │                  │       │                  │       │    CHECK        │
  │  Cookie:         │       │  jwt.Parse()     │       │  req.Header(    │
  │  auth_token      │       │  ParseClaims     │       │  X-Internal-    │
  │                  │       │  Check expiry    │       │  Token) ===     │
  │  Header: Bearer  │       │  Set Locals      │       │  ENV.INTERNAL_  │
  │                  │       │                  │       │  AUTH_TOKEN     │
  └──────────────────┘       └──────────────────┘       └──────────────────┘

## Token Structure

### JWT Claims

```json
{
  "sub": "user-id-string",
  "exp": 1712345678,       // 72 hours from issuance
  "iat": 1712315678        // issuance timestamp
}
```

### Signing
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret**: `JWT_SECRET` environment variable
- **Library**: `github.com/golang-jwt/jwt/v5`

## Expiry & Refresh

+--------+----------+---------------------------+-------------------+
| Token  | Lifetime | Storage                   | Current Status    |
+--------+----------+---------------------------+-------------------+
| Access | 72 hours | HTTP-only cookie +        | Implemented       |
|        |          |   response body           |                   |
| Refresh| N/A      | N/A                       | Not yet           |
|        |          |                           |   implemented     |
+--------+----------+---------------------------+-------------------+

### Planned Refresh Flow

```
Access Token: 15 minutes (short-lived)
Refresh Token: 7 days (httpOnly cookie)
/refresh endpoint -> validates refresh token -> issues new access token
```

## Token Extraction (Go Middleware)

Priority order:
1. **Cookie**: `auth_token` (secure httpOnly)
2. **Header**: `Authorization: Bearer <token>`

```go
func AuthRequired(secret string) fiber.Handler {
    return func(c fiber.Ctx) error {
        // 1. Try cookie
        tokenString := c.Cookies("auth_token")

        // 2. Fallback to Authorization header
        if tokenString == "" {
            authHeader := c.Get("Authorization")
            if strings.HasPrefix(authHeader, "Bearer ") {
                tokenString = strings.TrimPrefix(authHeader, "Bearer ")
            }
        }

        // 3. Parse and validate
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            return c.Status(401).JSON(fiber.Map{"error": "Unauthorized: Invalid token"})
        }

        c.Locals("user_id", token.Claims.(jwt.MapClaims)["sub"])
        return c.Next()
    }
}
```

## Internal Service Auth (Go -> Agent)

Go authenticates to Hono Agent using a shared secret:

```
Go sets header: X-Internal-Token: <INTERNAL_AUTH_TOKEN>
             or: Authorization: Bearer <INTERNAL_AUTH_TOKEN>

Agent reads:    c.req.header("X-Internal-Token")
             or c.req.header("Authorization").substring("Bearer ".length)

Agent compares: receivedToken === ENV.INTERNAL_AUTH_TOKEN
                -> 403 if mismatch
```

## Service JWT Flow (Agent → Backend)

The agent needs to persist memory and state during mission execution. Since the
agent is **stateless** (no direct DB access), it calls back into the backend
via internal HTTP endpoints. These calls use a **Service JWT** that the agent
signs itself.

### Flow Diagram

```
                        SERVICE JWT FLOW
                        ─────────────────

  ┌──────────────────────┐           ┌──────────────────────┐
  │   HONO AGENT         │           │   GO BACKEND         │
  │   (Bun/Hono)         │           │   (Memory Gateway)   │
  └────────┬─────────────┘           └──────────┬───────────┘
           │                                     │
           │  1. Agent mission needs             │
           │     to persist memory               │
           │                                     │
           │  2. Sign JWT:                       │
           │     { sub: "agent",                 │
           │       iat: now,                     │
           │       exp: now + 60s }              │
           │     Key: SERVICE_JWT_SECRET         │
           │     (HS256)                         │
           │                                     │
           │  3. POST /api/v1/internal/          │
           │     memory/episodic                 │
           │     Authorization: Bearer <JWT>     │
           │     { payload }                     │
           │───────────────────────────────────►│
           │                                     │
           │                                     │  4. ServiceAuthRequired:
           │                                     │     - Parse Bearer token
           │                                     │     - jwt.Parse with
           │                                     │       SERVICE_JWT_SECRET
           │                                     │     - Verify sub == "agent"
           │                                     │     - Check exp not expired
           │                                     │
           │                                     │  5. Process request
           │                                     │     (write to PostgreSQL)
           │                                     │
           │  6. 200 { success: true }           │
           │◄────────────────────────────────────│
           │                                     │
```

### Key Properties

| Property        | User JWT                      | Service JWT                      |
|-----------------+-------------------------------+----------------------------------|
| Issuer          | Go Backend (at login)         | Agent (self-signed per request)  |
| Secret          | JWT_SECRET                    | SERVICE_JWT_SECRET               |
| Subject (sub)   | User ID (string)              | "agent" (fixed string)           |
| Lifetime        | 72 hours                      | 60 seconds (short-lived)         |
| Audience        | End-user clients              | Backend internal routes          |
| Signing Library | golang-jwt/v5                 | jsonwebtoken (agent)             |
| Rotation        | Planned refresh flow          | Every request (freshly signed)   |

### Signing in Agent (TypeScript)

```typescript
import { sign } from "jsonwebtoken";

function createServiceJWT(): string {
  return sign(
    {
      sub: "agent",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    SERVICE_JWT_SECRET,
    { algorithm: "HS256" }
  );
}
```

### Verifying in Backend (Go)

```go
func ServiceAuthRequired(secret string) fiber.Handler {
    return func(c fiber.Ctx) error {
        authHeader := c.Get("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            return c.Status(401).JSON(fiber.Map{"error": "Missing token"})
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            return c.Status(401).JSON(fiber.Map{"error": "Invalid service token"})
        }

        claims := token.Claims.(jwt.MapClaims)
        if claims["sub"] != "agent" {
            return c.Status(403).JSON(fiber.Map{"error": "Invalid subject"})
        }

        c.Locals("service_name", claims["sub"])
        return c.Next()
    }
}
```

### Security Rules

1. `SERVICE_JWT_SECRET` MUST be different from `JWT_SECRET`
2. Service JWT MUST have `sub: "agent"` — rejected otherwise
3. Service JWT lifetime SHOULD be ≤ 60 seconds (fresh per request)
4. Clock skew tolerance SHOULD be ≤ 30 seconds
5. Never log or expose `SERVICE_JWT_SECRET` in agent output/errors

## Frontend Auth Flow

### useAuth Hook

```typescript
function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.ME });
    },
  });

  return { user, isLoading, isAuthenticated: !!user, login: loginMutation.mutate };
}
```

### authApi Service

```typescript
export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials),
  logout: () => api.post("/auth/logout", {}),
  me: () => api.get("/auth/me"),
};
```

## Planned Token Rotation

```
1. Access token: 15 min, in memory
2. Refresh token: 7 days, httpOnly cookie
3. On 401: interceptor calls /refresh
4. New access token stored in memory
5. Retry original request
```

## Entry Points & Exports

- **Go auth handler**: `backend/internal/handler/auth_handler.go` —
  `HandleRegister`, `HandleLogin`
- **Go auth middleware**: `backend/internal/middleware/auth.go` —
  `AuthRequired`
- **Go auth constants**: `backend/internal/constants/auth/jwt.go` —
  header/cookie names, error messages
- **Agent auth middleware**: `agent/src/app/middleware/auth.ts` — internal
  token validation
- **Agent auth constants**: `agent/src/shared/constants/middleware.ts` —
  `AUTH_CONSTANTS`
- **Frontend auth API**: `frontend/web/src/features/auth/services/auth-api.ts`
- **Frontend auth hook**: `frontend/web/src/features/auth/hooks/useAuth.ts`
- **Frontend API client**: `frontend/web/src/lib/api-client.ts`

## Dependencies

- **Go JWT**: `github.com/golang-jwt/jwt/v5`
- **Agent auth**: Manual header comparison (no external library)
- **Frontend auth**: `@tanstack/react-query`

## Source References

+-------------------------------------------------------+-------+--------------------------------------+
| File                                                  | Lines | Role                                 |
+-------------------------------------------------------+-------+--------------------------------------+
| backend/internal/handler/auth_handler.go              | 30-68 | Login handler, JWT creation, cookie  |
|                                                       |       |   set                                |
| backend/internal/middleware/auth.go                   | 12-48 | AuthRequired middleware (User JWT)   |
| backend/internal/middleware/service_auth.go           | 1-52  | ServiceAuthRequired middleware       |
|                                                       |       |   (Service JWT)                      |
| backend/internal/constants/auth/jwt.go                | 1-12  | Cookie name, header, error constants |
| agent/src/app/middleware/auth.ts                      | 6-32  | Agent auth middleware                |
| agent/src/core/agent/plugins/memory-plugin.ts         | 1-35  | Service JWT signing + memory fetch   |
| agent/src/shared/constants/middleware.ts              | 1-9   | AUTH_CONSTANTS                       |
| frontend/web/src/features/auth/services/auth-api.ts   | 1-17  | Auth API service                     |
| frontend/web/src/features/auth/hooks/useAuth.ts       | 1-30  | useAuth React Query hook             |
+-------------------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
