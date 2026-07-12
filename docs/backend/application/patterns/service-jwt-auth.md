================================================================================
  Service JWT Authentication - Internal Route Protection
================================================================================
  Module    : Service JWT Authentication
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

Service JWT authentication protects internal routes consumed exclusively by
the agent (Hono/Fastify). Unlike User JWT, which authenticates end-user
browser sessions, Service JWT authenticates server-to-server communication
using a symmetric shared secret known only to the backend and the agent.

The middleware lives at `internal/middleware/internal.go` and is applied to the
`/api/v1/internal/*` route group.

User JWT vs Service JWT
-----------------------

+----------------------+---------------------------+---------------------------+
| Property             | User JWT                  | Service JWT               |
+----------------------+---------------------------+---------------------------+
| Audience             | Browser / mobile clients  | Agent (Hono/Fastify)      |
+----------------------+---------------------------+---------------------------+
| Token source         | Cookie or Authorization   | Authorization header only |
|                      | header                    |                           |
+----------------------+---------------------------+---------------------------+
| Secret               | JWT_SECRET env var        | INTERNAL_AUTH_TOKEN       |
|                      | (user-facing)             | (service-to-service)      |
+----------------------+---------------------------+---------------------------+
| Algorithm            | HS256                     | HS256                     |
+----------------------+---------------------------+---------------------------+
| Subject (sub)        | User ID (arbitrary)       | Fixed: "agent"            |
+----------------------+---------------------------+---------------------------+
| Verification         | Token valid -> pass        | Token valid + sub check   |
+----------------------+---------------------------+---------------------------+
| c.Locals key         | "user_id"                 | "agent_id"                |
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

  Payload:
  {
      "sub":   "agent",               // fixed — verifies caller identity
      "iat":   1720468800,            // issued at (Unix epoch)
      "exp":   1720472400,            // expiration (e.g. 1 hour)
      "iss":   "echo-agent",          // issuer identifier
      "scope": "memory:read memory:write"  // optional: fine-grained access
  }

  Signature:
      HMAC-SHA256(base64(header) + "." + base64(payload), INTERNAL_AUTH_TOKEN)

Implementation
--------------

### Config Loading

The shared secret is loaded from the `INTERNAL_AUTH_TOKEN` environment variable:

  // config/config.go
  InternalAuthToken: getEnv("INTERNAL_AUTH_TOKEN",
      "default-internal-token-secret"),

  // .env
  INTERNAL_AUTH_TOKEN=super-secret-service-key-abc123

### Middleware Code

The middleware is defined at `internal/middleware/internal.go`:

  package middleware

  import (
      "echo-backend/internal/constants/auth"
      "strings"

      "github.com/gofiber/fiber/v3"
      "github.com/golang-jwt/jwt/v5"
  )

  // InternalAuthRequired verifies the Service JWT from the Authorization header.
  // The token must:
  //   1. Have a valid HMAC-SHA256 signature (INTERNAL_AUTH_TOKEN)
  //   2. Have sub == "agent"
  func InternalAuthRequired(secret string) fiber.Handler {
      return func(c fiber.Ctx) error {
          // 1. Read Authorization header
          authHeader := c.Get(auth.HeaderAuthorization)
          if !strings.HasPrefix(authHeader, auth.BearerPrefix) {
              return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                  "error": auth.ErrMissingToken,
              })
          }

          tokenString := strings.TrimPrefix(authHeader, auth.BearerPrefix)

          // 2. Parse and validate token
          token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
              return []byte(secret), nil
          })

          if err != nil || !token.Valid {
              return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
                  "error": auth.ErrInvalidToken,
              })
          }

          // 3. Verify subject is "agent"
          claims := token.Claims.(jwt.MapClaims)
          if claims["sub"] != "agent" {
              return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
                  "error": "Forbidden: Invalid service identity",
              })
          }

          // 4. Set agent context
          c.Locals("agent_id", claims["sub"])

          return c.Next()
      }
  }

### Route Registration

The middleware is bound at the group level so it applies to all internal routes:

  // router.go
  internal := api.Group("/internal",
      middleware.InternalAuthRequired(cfg.InternalAuthToken),
  )

  internal.Post("/memory/episodic",   memoryHandler.HandleStoreEpisodic)
  internal.Post("/memory/semantic",   memoryHandler.HandleStoreSemantic)
  internal.Post("/memory/procedural", memoryHandler.HandleStoreProcedural)

Signing + Verification Flow
---------------------------

  Agent (Hono)                              Backend (Fiber)
  ──────────────────                        ────────────────

  ┌──────────────────────┐
  │ Build payload:       │
  │ sub="agent",         │
  │ iat=now, exp=now+1h, │
  │ iss="echo-agent"     │
  └──────────┬───────────┘
             │
  ┌──────────▼───────────┐
  │ Sign with            │
  │ INTERNAL_AUTH_TOKEN  │
  │ (HMAC-SHA256)        │
  └──────────┬───────────┘
             │
  ┌──────────▼───────────┐
  │ Attach to request:   │
  │ Authorization:       │
  │ Bearer <token>       │
  └──────────┬───────────┘
             │
             │  HTTP POST /api/v1/internal/memory/episodic
             ├──────────────────────────────────────────────►
             │
             │                              ┌───────────────────▼─────┐
             │                              │ Receive token           │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Parse JWT               │
             │                              │ Verify signature with   │
             │                              │ INTERNAL_AUTH_TOKEN     │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Check sub == "agent"    │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ c.Locals("agent_id",    │
             │                              │   "agent")              │
             │                              │ -> c.Next()             │
             │                              └───────────────────┬─────┘
             │                              ┌───────────────────▼─────┐
             │                              │ Handler processes       │
             │                              │ memory request          │
             │                              └─────────────────────────┘
             │
             │  200 OK { "id": "mem_xxx", "status": "stored" }
             ◄──────────────────────────────────────────────────

Security Considerations
-----------------------

+---------------------------+------------------------------------------------+
| Consideration             | Mitigation                                     |
+---------------------------+------------------------------------------------+
| Secret rotation           | INTERNAL_AUTH_TOKEN can be rotated without     |
|                           | downtime — agent and backend updated together  |
+---------------------------+------------------------------------------------+
| Token expiration          | Agent should mint short-lived tokens (1h max)  |
|                           | and refresh as needed                          |
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
| Default secret            | Default INTERNAL_AUTH_TOKEN value exists for   |
|                           | development only. Production MUST set a        |
|                           | strong, unique secret.                         |
+---------------------------+------------------------------------------------+

Config Mapping
--------------

+--------------------------+------------------+-------------------------------------+
| Config Field             | Env Var          | Default                             |
+--------------------------+------------------+-------------------------------------+
| InternalAuthToken        | INTERNAL_AUTH_   | default-internal-token-secret       |
|                          | TOKEN            |                                     |
+--------------------------+------------------+-------------------------------------+
| JWTSecret                | JWT_SECRET       | (separate — for user JWT)           |
+--------------------------+------------------+-------------------------------------+

Entry Points & Exports
-----------------------

+-----------------------------+----------+--------------------------------------+
| Symbol                      | Kind     | Path                                 |
+-----------------------------+----------+--------------------------------------+
| InternalAuthRequired(secret)| MW       | middleware/internal.go:12            |
|                             | factory  |                                      |
| InternalAuthToken           | Config   | models/models.go:43                  |
|                             | field    |                                      |
| Load()                      | Function | config/config.go:10                  |
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
| internal/constants/auth    | Header/prefix constants (Authorization, Bearer) |
+----------------------------+--------------------------------------------------+

Source References
-----------------

- internal/middleware/internal.go - InternalAuthRequired implementation
- internal/router/router.go:40-55 - Internal route group with middleware binding
- internal/config/config.go:22 - INTERNAL_AUTH_TOKEN config load
- internal/models/models.go:43 - Config.InternalAuthToken field
- internal/constants/auth/jwt.go - Header/Bearer constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
