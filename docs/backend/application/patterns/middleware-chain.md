================================================================================
  Middleware Chain - Request Pipeline
================================================================================
  Module    : Middleware Chain
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-27
================================================================================

Overview
--------

The Middleware chain is the request pipeline executed before the handler. The
backend uses Fiber built-in middleware and custom middleware for cross-cutting
concerns: logging, recovery, CORS, and JWT authentication. All middleware
lives in a single flat package (internal/middleware).

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/middleware/auth.go              | AuthRequired - User JWT validation         |
| internal/middleware/internal_auth.go     | InternalAuthRequired - Service JWT         |
| internal/middleware/api_key.go           | APIKeyRequired - validates against API keys|
| internal/middleware/auth_or_apikey.go    | AuthOrAPIKeyRequired - JWT fallback to API |
| internal/middleware/common.go            | Logger, ErrorHandler                       |
| internal/middleware/rbac.go              | RequireRoles - role-based access control   |
| internal/server/server.go                | Global middleware registration             |
| internal/router/router.go                | Per-route middleware                       |
+------------------------------------------+--------------------------------------------+

Middleware Chain Order
----------------------

  Request
    │
    ├─ (1) recover.New()
    │        Fiber built-in - panic recovery
    │
    ├─ (2) logger.New()
    │        Fiber built-in - request logging
    │        Dev:  [${time}] ${status} ${method} ${path} ip=.. route=.. latency=.. in=.. out=.. ua=.. err=.. (colors)
    │        Prod: one JSON object per line (no ANSI escapes)
    │        Format chosen in cmd/server/main.go from ENVIRONMENT
    │
    ├─ (3) cors.New()
    │        Fiber built-in - CORS headers
    │        AllowOrigins: from config
    │        AllowMethods: GET, POST, PUT, DELETE, OPTIONS
    │        AllowHeaders: Origin, Content-Type, Accept, Authorization,
    │                      traceparent, x-agent-session-id
    │        AllowCredentials: true
    │
    ├─ (4) AuthRequired(secret)          [PUBLIC routes]
    │        User JWT validation from cookie or Authorization header
    │        Sets c.Locals("user_id", claims["sub"])
    │
    ├─ (5) InternalAuthRequired(secret)  [INTERNAL routes only]
    │        Service JWT validation from Authorization header
    │        Verifies sub == "agent"
    │        Sets c.Locals("agent_id", claims["sub"])
    │
    └─ (6) Handler
            Business logic

Middleware Architecture - Dual Auth Paths
------------------------------------------

The backend supports two authentication paths: User JWT (for public API routes)
and Service JWT (for internal routes consumed by the agent).

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Fiber App                                                               │
  │                                                                          │
  │  ┌──────────┐   ┌──────────┐   ┌──────────┐                             │
  │  │ Recover  │──►│ Logger   │──►│ CORS     │                             │
  │  └──────────┘   └──────────┘   └──────────┘                             │
  │                                                                          │
  │  ┌─────────────────────────────┐    ┌──────────────────────────────────┐ │
  │  │  User JWT Path              │    │  Service JWT Path                │ │
  │  │                             │    │                                  │ │
  │  │  Browser / Mobile / Client  │    │  Agent (Hono/Fastify)            │ │
  │  │        │                    │    │        │                         │ │
  │  │        ▼                    │    │        ▼                         │ │
  │  │  AuthRequired(cfg.JWTSecret)│    │  InternalAuthRequired(secret)    │ │
  │  │        │                    │    │        │                         │ │
  │  │  c.Locals("user_id", sub)  │    │  c.Locals("agent_id", sub)       │ │
  │  │        │                    │    │        │                         │ │
  │  │        ▼                    │    │        ▼                         │ │
  │  │  Public Handlers            │    │  Internal Handlers               │ │
  │  │  (chat, models, features)   │    │  (memory endpoints)              │ │
  │  └─────────────────────────────┘    └──────────────────────────────────┘ │
  │                                                                          │
  │  Public group: /api/v1/*           Internal group: /api/v1/internal/*    │
  └──────────────────────────────────────────────────────────────────────────┘

AuthRequired Middleware (User JWT)
-----------------------------------

  AuthRequired(secret string) fiber.Handler
    │
    ├─ (1) Read cookie "auth_token"
    ├─ (2) If empty -> read header "Authorization: Bearer <token>"
    ├─ (3) If both empty -> 401 { "error": "Unauthorized: Missing token" }
    ├─ (4) jwt.Parse(token, keyFunc) -> validate HS256 signature
    ├─ (5) If invalid -> 401 { "error": "Unauthorized: Invalid token" }
    └─ (6) c.Locals("user_id", claims["sub"]) -> c.Next()

InternalAuthRequired Middleware (Service JWT)
----------------------------------------------

  InternalAuthRequired(secret string) fiber.Handler
    │
    ├─ (1) Read header "Authorization: Bearer <token>"
    ├─ (2) If empty -> 401 { "error": "Unauthorized: Missing token" }
    ├─ (3) jwt.Parse(token, keyFunc) -> validate HS256 signature
    ├─ (4) If invalid -> 401 { "error": "Unauthorized: Invalid token" }
    ├─ (5) Extract claims["sub"] -> if != "agent" -> 403
    │         { "error": "Forbidden: Invalid service identity" }
    └─ (6) c.Locals("agent_id", claims["sub"]) -> c.Next()

  Source code: internal/middleware/internal_auth.go

Logger Middleware
-----------------

  func Logger() fiber.Handler {
      return func(c fiber.Ctx) error {
          start := time.Now()
          err := c.Next()
          stop := time.Now()

          log.Printf("[%s] %d - %s %s %s",
              stop.Format("2006-01-02 15:04:05"),
              c.Response().StatusCode(),
              c.Method(),
              c.Path(),
              stop.Sub(start),
          )
          return err
      }
  }

Error Handler
-------------

  func ErrorHandler(c fiber.Ctx, err error) error {
      code := fiber.StatusInternalServerError
      if e, ok := err.(*fiber.Error); ok {
          code = e.Code
      }
      return c.Status(code).JSON(fiber.Map{
          "error": err.Error(),
      })
  }

CORS Configuration
------------------

+-------------------+----------------------------------------------------+
| Setting           | Value                                              |
+-------------------+----------------------------------------------------+
| AllowOrigins      | From ALLOW_ORIGINS env var (default: localhost:3000)|
| AllowMethods      | GET, POST, PUT, DELETE, OPTIONS                     |
| AllowHeaders      | Origin, Content-Type, Accept, Authorization,       |
|                   | traceparent, x-agent-session-id                    |
| AllowCredentials  | true                                               |
+-------------------+----------------------------------------------------+

Entry Points & Exports
----------------------

+-------------------------+-------------------+------------------------------------+
| Symbol                  | Kind              | Path                               |
+-------------------------+-------------------+------------------------------------+
| AuthRequired(secret)    | Middleware factory | middleware/auth.go                  |
| InternalAuthRequired    | Middleware factory | middleware/internal_auth.go         |
| (secret)                |                   |                                    |
| Logger()                | Middleware factory | middleware/common.go                |
| ErrorHandler(c, err)    | Error handler     | middleware/common.go                |
| RequireRoles(roles...)  | Middleware factory | middleware/rbac.go                  |
| AuthOrAPIKeyRequired    | Middleware factory | middleware/auth_or_apikey.go        |
| (cfg, apiKeyRepo)       |                   |                                    |
+-------------------------+-------------------+------------------------------------+

Dependencies
------------

+----------------------------------------------+-------------------------------------------+
| Dependency                                   | Used For                                  |
+----------------------------------------------+-------------------------------------------+
| github.com/gofiber/fiber/v3                  | Middleware, context, JSON error           |
| github.com/gofiber/fiber/v3/middleware/cors  | CORS headers                              |
| github.com/gofiber/fiber/v3/middleware/logger| Request logging                           |
| github.com/gofiber/fiber/v3/middleware/recover| Panic recovery                           |
| github.com/golang-jwt/jwt/v5                 | JWT token parsing                         |
+----------------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/middleware/auth.go - AuthRequired (user JWT) middleware
- internal/middleware/internal_auth.go - InternalAuthRequired (service JWT)
- internal/middleware/common.go - Logger, ErrorHandler
- internal/middleware/rbac.go - Role-based access control
- internal/server/server.go - Global middleware registration
- internal/router/router.go - Per-route middleware binding

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
