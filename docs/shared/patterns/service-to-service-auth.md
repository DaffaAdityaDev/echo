================================================================================
  SERVICE-TO-SERVICE AUTHENTICATION
================================================================================
  Module    : Service-to-Service Auth
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Echo uses a **symmetric (shared-secret) JWT scheme** for agent → backend
authentication. The agent self-signs a short-lived JWT and presents it as a
Bearer token when calling internal memory/state endpoints on the backend
(Memory Gateway). This replaces earlier approaches based on port separation
or simplistic static tokens for cross-service auth.

## Why JWT-Only (Decision Log)

Three approaches were evaluated for agent → backend auth:

| Approach          | Description                         | Result       |
+-------------------+-------------------------------------+--------------+
| A: Path-only      | Internal routes on same port,       | Rejected     |
|                   | no auth (rely on network isolation) |              |
| B: Port separation| Internal routes on separate port    | Rejected     |
|                   | (e.g. :8081), firewall rules        |              |
| C: JWT-only       | Agent signs JWT, backend verifies   | **Adopted**  |
|                   | with shared secret                  |              |

### Rationale

**A (Path-only)** was rejected because:
- No defense-in-depth — a single routing misconfiguration exposes internal
  endpoints publicly
- Impossible to distinguish agent calls from user calls in logs
- No non-repudiation — any process on the network could call internal routes

**B (Port separation)** was rejected because:
- Operational complexity — two ports to manage, firewall rules, health checks
- Container orchestration (K8s) makes port-based isolation brittle
- Still doesn't authenticate the caller — just restricts network access
- Adds complexity to docker-compose, ingress configs, and local dev

**C (JWT-only)** was adopted because:
- Cryptographic proof of identity — only the agent (who knows the secret)
  can sign a valid JWT
- Short TTL (60s) limits blast radius of token leakage
- Same port, same TLS — no extra infra
- Logged identity (sub: "agent") in every request for audit
- Easy to test and debug with curl
- Consistent with the existing User JWT pattern

## Symmetric JWT Flow

```
                        ┌─────────────────────────┐
                        │  SERVICE_JWT_SECRET      │
                        │  (shared, HS256)         │
                        └──────────┬──────────────┘
                                   │
                                   │ Known by both sides
                                   │
         ┌─────────────────────────┼────────────────────────┐
         │                         │                        │
         ▼                         │                        ▼
┌──────────────────┐              │               ┌──────────────────┐
│  AGENT            │              │               │  BACKEND          │
│  (Hono/Bun)       │              │               │  (Go/Fiber)       │
│                   │              │               │                   │
│  1. Create claims │              │               │  5. Parse JWT     │
│     sub: "agent"  │              │               │     Extract Bearer│
│     iat: now      │              │               │                   │
│     exp: now+60s  │              │               │  6. Verify sig    │
│                   │              │               │     with same     │
│  2. Sign with     │              │               │     SERVICE_JWT_  │
│     SERVICE_JWT_  │              │               │     SECRET        │
│     SECRET (HS256)│              │               │                   │
│                   │              │               │  7. Check claims  │
│  3. Attach as     │   POST /api  │               │     sub == "agent"│
│     Authorization:│   /v1/       │               │     exp > now     │
│     Bearer <JWT>  │   internal/* │               │                   │
│                   │──────────────┼──────────────►│  8. Set c.Locals( │
│  4. Send request  │              │               │     "service_name"│
│                   │              │               │     , "agent")    │
│                   │              │               │                   │
│                   │  200/201     │               │  9. Process       │
│                   │◄─────────────┼───────────────│     memory write  │
│                   │              │               │                   │
└──────────────────┘              │               └──────────────────┘
                                   │
                                   ▼
                    Both sides MUST be configured with
                    the identical SERVICE_JWT_SECRET
```

## Threat Model & Mitigations

| Threat                    | Impact                              | Mitigation                           |
+---------------------------+-------------------------------------+--------------------------------------+
| Secret leak (agent-side)  | Attacker can impersonate agent      | 1. Rotate SERVICE_JWT_SECRET         |
|                           |                                     | 2. Agent runs in isolated container  |
|                           |                                     | 3. Secret injected at deploy time,   |
|                           |                                     |    never in source                   |
| Secret leak (backend-side)| Same as above                      | 1. Same mitigations                  |
|                           |                                     | 2. Audit logging on secret access    |
| Replay attack             | Attacker reuses captured JWT        | 1. Short TTL (60s)                   |
|                           |                                     | 2. jti claim (optional) for          |
|                           |                                     |    idempotency checking              |
|                           |                                     | 3. Clock skew tolerance ≤ 30s        |
| JWT interception (MITM)  | Attacker sees token in transit      | 1. TLS required for all internal     |
|                           |                                     |    traffic in production             |
|                           |                                     | 2. Dev environments on same host     |
|                           |                                     |    (localhost, no network transit)   |
| Sub claim forgery        | Agent creates JWT with wrong sub    | 1. Backend hard-rejects sub !=       |
|                           |                                     |    "agent" with 403                  |
|                           |                                     | 2. No other sub values allowed       |
| Expired token            | Legitimate requests fail            | 1. Agent signs fresh per request     |
|                           |                                     | 2. Backend returns clear 401 with    |
|                           |                                     |    "token_expired" error             |
| Algorithm confusion      | Attacker changes alg to "none"      | 1. Backend binds to HS256 only       |
|                           |                                     | 2. golang-jwt/v5 blocks "none"       |
|                           |                                     |    by default since v5               |

### Additional Security Properties

1. **Defense in depth**: Even if an attacker bypasses the internal route
   guard, they still need the secret to forge a valid token.
2. **Auditability**: Every internal request carries `sub: "agent"` in the
   JWT, which the backend logs for audit trails.
3. **No session management**: Stateless — the backend never stores token
   state. Verification is purely cryptographic.
4. **No refresh flow**: Tokens are so short-lived (60s) that refresh is
   irrelevant. The agent signs a new one for each request.

## Code Implementation

### Agent (TypeScript)

Uses the `jsonwebtoken` library to sign a fresh JWT per request:

```typescript
// agent/src/adapter/backend/memory.adapter.ts
import { sign } from "jsonwebtoken";
import { ENV } from "../../config/env";

function createServiceJWT(): string {
  return sign(
    {
      sub: "agent",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    ENV.SERVICE_JWT_SECRET,
    { algorithm: "HS256" }
  );
}

async function callMemoryEndpoint(path: string, body: unknown): Promise<Response> {
  const token = createServiceJWT();
  return fetch(`${ENV.BACKEND_INTERNAL_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
```

### Backend (Go)

Uses the same `golang-jwt/v5` library as User JWT, but with a different
secret and stricter claim validation:

```go
// backend/internal/middleware/service_auth.go
package middleware

import (
    "strings"

    "github.com/gofiber/fiber/v3"
    "github.com/golang-jwt/jwt/v5"
)

func ServiceAuthRequired(secret string) fiber.Handler {
    return func(c fiber.Ctx) error {
        authHeader := c.Get("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                "error": "missing_token",
                "message": "Missing Authorization header",
            })
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fiber.ErrUnauthorized
            }
            return []byte(secret), nil
        })

        if err != nil || !token.Valid {
            return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                "error": "invalid_token",
                "message": "Invalid service token",
            })
        }

        claims := token.Claims.(jwt.MapClaims)

        if claims["sub"] != "agent" {
            return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
                "error": "invalid_subject",
                "message": "Token subject must be 'agent'",
            })
        }

        c.Locals("service_name", claims["sub"])
        return c.Next()
    }
}
```

### Wiring the Middleware (Go Router)

```go
// backend/internal/router/router.go
internalGroup := api.Group("/v1/internal")
internalGroup.Use(middleware.ServiceAuthRequired(cfg.ServiceJWTSecret))

internalGroup.Post("/memory/episodic", memoryHandler.HandleStoreEpisodic)
internalGroup.Post("/memory/semantic", memoryHandler.HandleStoreSemantic)
internalGroup.Post("/memory/procedural", memoryHandler.HandleStoreProcedural)
internalGroup.Post("/state/:key", memoryHandler.HandleSetState)
internalGroup.Post("/config/session", memoryHandler.HandleUpdateSessionConfig)
```

## Environment Variables

| Variable            | Service  | Required | Description                     |
+---------------------+----------+----------+---------------------------------+
| SERVICE_JWT_SECRET  | Backend  | Yes      | HS256 key for service JWT       |
|                     |          |          | (MUST differ from JWT_SECRET)   |
| SERVICE_JWT_SECRET  | Agent    | Yes      | Same secret for signing         |
| BACKEND_INTERNAL_URL| Agent    | Yes      | Base URL for backend internal   |
|                     |          |          | endpoints (e.g. localhost:8080) |
+---------------------+----------+----------+---------------------------------+

## Difference vs User JWT

| Aspect             | User JWT                   | Service JWT                     |
+--------------------+----------------------------+----------------------------------+
| Purpose            | Identify end-user           | Identify the agent service       |
| Issuer             | Go Backend (login handler)  | Agent (self-signed)              |
| Secret             | JWT_SECRET                  | SERVICE_JWT_SECRET               |
| Subject (sub)      | User ID (variable)          | "agent" (fixed)                  |
| Lifetime           | 72 hours                    | 60 seconds                       |
| Extraction         | Cookie or Authorization     | Authorization header only        |
| Middleware         | AuthRequired                | ServiceAuthRequired              |
| Rotation           | Planned refresh flow        | Freshly signed per request       |
| Audience           | Public API routes           | Internal /api/v1/internal/*      |
| Clock skew tolerance| None (long-lived)          | ≤ 30 seconds                     |

## Entry Points & Exports

- **Agent signing**: `agent/src/adapter/backend/memory.adapter.ts`
- **Backend verification**: `backend/internal/middleware/service_auth.go`
- **Route wiring**: `backend/internal/router/router.go`
- **Secret config**: `backend/internal/models/models.go` (ServiceJWTSecret field)
- **Agent env**: `agent/src/config/env.schema.ts` (SERVICE_JWT_SECRET,
  BACKEND_INTERNAL_URL)

## Source References

+---------------------------------------------------------------+-------+------------------------------+
| File                                                          | Lines | Role                         |
+---------------------------------------------------------------+-------+------------------------------+
| backend/internal/middleware/service_auth.go                   | 1-52  | Service JWT verification MW  |
| backend/internal/router/router.go                             | 40-52 | Internal route wiring        |
| agent/src/adapter/backend/memory.adapter.ts                  | 1-35  | Service JWT signing + fetch  |
| agent/src/config/env.schema.ts                                | 18-20 | SERVICE_JWT_SECRET,          |
|                                                               |       | BACKEND_INTERNAL_URL         |
| backend/internal/models/models.go                             | 32-56 | Config struct with           |
|                                                               |       | ServiceJWTSecret             |
+---------------------------------------------------------------+-------+------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
