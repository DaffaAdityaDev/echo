================================================================================
  Service JWT Authentication - Internal Route Protection
================================================================================
  Module    : Service JWT Authentication
  Service   : backend
  Version   : 2.0
  Updated   : 2026-08-05 (SERVICE_JWT_SECRET, internal_auth.go, 60s expiry)
================================================================================

Overview
--------

Service JWT authentication protects internal routes consumed exclusively by
the agent (Hono/Bun). Unlike User JWT, which authenticates end-user browser
sessions, Service JWT authenticates server-to-server communication using a
symmetric shared secret known only to the backend and the agent.

The middleware lives at `internal/middleware/internal_auth.go` and is applied
to the `/api/v1/internal/*` route group.

User JWT vs Service JWT
-----------------------

+----------------------+---------------------------+---------------------------+
| Property             | User JWT                  | Service JWT               |
+----------------------+---------------------------+---------------------------+
| Audience             | Browser / mobile clients  | Agent (Hono/Bun)          |
+----------------------+---------------------------+---------------------------+
| Token source         | Cookie or Authorization   | Authorization header only |
|                      | header                    |                           |
+----------------------+---------------------------+---------------------------+
| Secret               | JWT_SECRET env var        | SERVICE_JWT_SECRET        |
|                      | (user-facing)             | (service-to-service)      |
+----------------------+---------------------------+---------------------------+
| Algorithm            | HS256                     | HS256                     |
+----------------------+---------------------------+---------------------------+
| Subject (sub)        | User ID (arbitrary)       | Fixed: "agent"            |
+----------------------+---------------------------+---------------------------+
| Verification         | Token valid -> pass        | Token valid + sub check   |
+----------------------+---------------------------+---------------------------+
| c.Locals key         | "user_id"                 | "service_name"            |
+----------------------+---------------------------+---------------------------+
| Route prefix         | /api/v1/*                 | /api/v1/internal/*        |
+----------------------+---------------------------+---------------------------+

Token Structure
---------------

  Header:
  {
      "alg": "HS256",
      "typ": "JWT"
  }

  Payload (minted by agent/src/shared/utils/jwt.ts):
  {
      "sub":   "agent",               // fixed — verifies caller identity
      "iat":   1720468800,            // issued at — added by jsonwebtoken
      "exp":   1720468860,            // expiration — 60 seconds (JWT_EXPIRY = "60s")
  }

  Signature:
      HMAC-SHA256(base64(header) + "." + base64(payload), SERVICE_JWT_SECRET)

Note: the agent mints tokens with `jsonwebtoken` `sign()` using
`expiresIn: "60s"`. Tokens are short-lived (60 seconds, not 1 hour) and
re-minted per outbound request (`signServiceJwt()` in
`agent/src/shared/utils/jwt.ts`). The payload carries only `sub` plus the
`iat`/`exp` claims added by the signing library — no `iss`, `scope`, or
`jti` claims.

Implementation
--------------

### Config Loading

The shared secret is loaded from the `SERVICE_JWT_SECRET` environment variable:

  // internal/config/config.go
  c.ServiceJWTSecret = envStr("SERVICE_JWT_SECRET", cfgConst.DefaultServiceJWTSecret)

  // .env
  SERVICE_JWT_SECRET=change-this-to-a-secure-service-jwt-secret-min32chars

### Middleware Code

The middleware is defined at `internal/middleware/internal_auth.go`:

  package middleware

  import (
      "echo-backend/internal/handler/handlerutil"
      "echo-backend/internal/models/config"
      "strings"

      "github.com/gofiber/fiber/v3"
      "github.com/golang-jwt/jwt/v5"
  )

  // InternalAuthRequired verifies the Service JWT from the Authorization header.
  // The token must:
  //   1. Have a valid HMAC-SHA256 signature (SERVICE_JWT_SECRET)
  //   2. Have sub == "agent"
  func InternalAuthRequired(cfg *cfgmodel.Config) fiber.Handler {
      return func(c fiber.Ctx) error {
          // 1. Read Authorization header
          authHeader := c.Get("Authorization")
          if !strings.HasPrefix(authHeader, "Bearer ") {
              return handlerutil.RespondError(c, fiber.StatusUnauthorized,
                  "Unauthorized: Missing internal token")
          }

          tokenString := strings.TrimPrefix(authHeader, "Bearer ")

          // 2. Parse and validate token
          token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
              return []byte(cfg.ServiceJWTSecret), nil
          }, jwt.WithValidMethods([]string{"HS256"}))
          if err != nil || !token.Valid {
              return handlerutil.RespondError(c, fiber.StatusUnauthorized,
                  "Unauthorized: Invalid internal token")
          }

          // 3. Verify subject is "agent"
          claims, ok := token.Claims.(jwt.MapClaims)
          if !ok {
              return handlerutil.RespondError(c, fiber.StatusUnauthorized,
                  "Unauthorized: Invalid token claims")
          }
          sub, ok := claims["sub"].(string)
          if !ok || sub != "agent" {
              return handlerutil.RespondError(c, fiber.StatusForbidden,
                  "Forbidden: Invalid token subject")
          }

          // 4. Set service context
          c.Locals("service_name", sub)

          return c.Next()
      }
  }

### Route Registration

The middleware is bound at the group level so it applies to all internal routes:

  // router.go
  internalGroup := api.Group(routes.V1InternalGroup, middleware.InternalAuthRequired(cfg))

  internalSessionsGroup := internalGroup.Group("/sessions")
  internalSessionsGroup.Post("/:id/prune", sessionHandler.HandlePruneSession)

  memoryGroup := internalGroup.Group("/memory")
  memoryGroup.Post("/episodic/store", memoryHandler.HandleStoreEpisodic)
  memoryGroup.Post("/episodic/recall", memoryHandler.HandleGetEpisodic)
  memoryGroup.Post("/semantic/store", memoryHandler.HandleStoreSemantic)
  memoryGroup.Post("/semantic/search", memoryHandler.HandleSemanticSearch)
  memoryGroup.Post("/procedural/store", memoryHandler.HandleStoreProcedural)
  memoryGroup.Post("/procedural/get", memoryHandler.HandleGetProcedural)

Signing + Verification Flow
---------------------------

  Agent (Bun)                              Backend (Fiber)
  ──────────────────                        ────────────────

  ┌──────────────────────┐
  │ signServiceJwt():    │
  │ sub="agent",         │
  │ exp = now + 60s,     │
  │ sign with            │
  │ SERVICE_JWT_SECRET   │
  └──────────┬───────────┘
             │
  ┌──────────▼───────────┐
  │ Attach to request:   │
  │ Authorization:       │
  │ Bearer <token>       │
  └──────────┬───────────┘
             │
             │  HTTP POST /api/v1/internal/memory/episodic/recall
             ├──────────────────────────────────────────────►
             │
             │                              ┌───────────────────▼─────┐
             │                              │ Receive token           │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Parse JWT               │
             │                              │ Verify signature with   │
             │                              │ SERVICE_JWT_SECRET      │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Check sub == "agent"    │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ c.Locals("service_name",│
             │                              │   "agent")              │
             │                              │ -> c.Next()             │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Handler processes       │
             │                              │ memory request          │
             │                              └─────────────────────────┘
             │
             │  200 OK { "session_id": ..., "entries": [...], "total": n }
             ◄──────────────────────────────────────────────────

Security Considerations
-----------------------

+---------------------------+------------------------------------------------+
| Consideration             | Mitigation                                     |
+---------------------------+------------------------------------------------+
| Secret rotation           | SERVICE_JWT_SECRET can be rotated without      |
|                           | downtime — agent and backend updated together  |
+---------------------------+------------------------------------------------+
| Token expiration          | Agent mints short-lived tokens (60 seconds)    |
|                           | per outbound request (see jwt.ts)              |
+---------------------------+------------------------------------------------+
| No cookie path            | Service JWT is read from Authorization header  |
|                           | only — never from cookies (no CSRF risk)       |
+---------------------------+------------------------------------------------+
| Subject pinning           | In addition to valid signature, middleware     |
|                           | checks sub == "agent" to prevent token reuse   |
|                           | from other services                            |
+---------------------------+------------------------------------------------+
| Transport security        | All internal routes MUST be served over TLS    |
|                           | in production (HTTPS)                          |
+---------------------------+------------------------------------------------+
| Default secret            | Default SERVICE_JWT_SECRET value exists for    |
|                           | development only. Production MUST set a        |
|                           | strong, unique secret (>= 32 chars per the     |
|                           | agent's zod schema).                           |
+---------------------------+------------------------------------------------+
| Distinct secrets          | SERVICE_JWT_SECRET must be different from      |
|                           | JWT_SECRET (user JWT) — see env-contract.      |
+---------------------------+------------------------------------------------+

Config Mapping
--------------

+--------------------------+------------------+-------------------------------------+
| Config Field             | Env Var          | Default                             |
+--------------------------+------------------+-------------------------------------+
| ServiceJWTSecret         | SERVICE_JWT_     | change-this-to-a-secure-service-    |
|                          | SECRET           | jwt-secret-min32chars               |
+--------------------------+------------------+-------------------------------------+
| JWTSecret                | JWT_SECRET       | (separate — for user JWT)           |
+--------------------------+------------------+-------------------------------------+

Entry Points & Exports
-----------------------

+-----------------------------+----------+--------------------------------------+
| Symbol                      | Kind     | Path                                 |
+-----------------------------+----------+--------------------------------------+
| InternalAuthRequired(cfg)   | MW       | middleware/internal_auth.go:12       |
|                             | factory  |                                      |
| ServiceJWTSecret            | Config   | models/config/config.go:16           |
|                             | field    |                                      |
| signServiceJwt()            | Function | agent/src/shared/utils/jwt.ts:14     |
+-----------------------------+----------+--------------------------------------+

Dependencies
------------

+----------------------------+--------------------------------------------------+
| Dependency                 | Used For                                         |
+----------------------------+--------------------------------------------------+
| github.com/gofiber/fiber   | HTTP context, JSON responses, group-level        |
| /v3                        | middleware binding                               |
| github.com/golang-jwt      | Token parsing and HMAC-SHA256 signature          |
| /jwt/v5                    | verification                                     |
| jsonwebtoken (agent)       | Token minting (expiresIn "60s")                  |
+----------------------------+--------------------------------------------------+

Source References
-----------------

- internal/middleware/internal_auth.go - InternalAuthRequired implementation
- internal/router/router.go:193 - Internal route group with middleware binding
- internal/config/config.go:25 - SERVICE_JWT_SECRET config load
- internal/models/config/config.go:16 - Config.ServiceJWTSecret field
- agent/src/shared/utils/jwt.ts - signServiceJwt (60s expiry, sub: agent)
- internal/constants/auth/jwt.go - Header/Bearer constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
