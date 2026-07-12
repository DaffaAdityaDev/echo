================================================================================
  Handler Pattern - HTTP Layer Structure
================================================================================
  Module    : Handler Pattern
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

Handlers are the thin HTTP layer that receives requests from the Fiber
context, calls the service layer, and returns JSON responses. No business
logic resides in handlers - only request parsing, response formatting, and
error mapping.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/auth_handler.go         | Auth routes handler                        |
| internal/handler/chat_handler.go         | Chat, stream, features handler             |
| internal/handler/model_handler.go        | Model listing handler                      |
| internal/router/router.go                | Route registration & DI wiring             |
+------------------------------------------+--------------------------------------------+

Handler Pattern
---------------

  type AuthHandler struct {
      Cfg     *models.Config
      AuthSvc service.AuthService
  }

  func NewAuthHandler(cfg *models.Config, authSvc service.AuthService) *AuthHandler {
      return &AuthHandler{Cfg: cfg, AuthSvc: authSvc}
  }

  func (h *AuthHandler) HandleLogin(c fiber.Ctx) error {
      // 1. Parse request (JSON body, params, headers)
      // 2. Call service layer
      // 3. Format response (JSON, cookies, status codes)
      // 4. Return error or JSON
  }

Flow
----

  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐    ┌───────────┐    ┌──────────┐
  │ Request  │───►│ Fiber Router │───►│ Middleware Chain │───►│ Handler  │───►│ Response │
  └──────────┘    └──────────────┘    └────────┬─────────┘    └─────┬─────┘    └──────────┘
                                               │                    │
                                          AuthRequired           Parse JSON
                                          Logger                 Call Service
                                          CORS                   Format JSON
                                          Recovery               Set Cookies

Request Parsing
---------------

  // JSON body parsing
  var req ChatRequest
  if err := c.Bind().JSON(&req); err != nil {
      return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
  }

  // Path parameters
  missionID := c.Params("missionId")

  // Query parameters (via mode, etc.)

  // Headers
  userTier := c.Get("X-User-Tier")
  traceparent := c.Get("traceparent")

  // Cookie
  tokenString := c.Cookies("auth_token")

Response Formatting
-------------------

  // Success (any status code)
  c.JSON(fiber.Map{"key": value})
  c.Status(201).JSON(fiber.Map{"created": true})

  // Error
  c.Status(400).JSON(fiber.Map{"error": "message"})
  c.Status(500).JSON(fiber.Map{"error": "message", "details": "..."})

  // Cookie setting
  c.Cookie(&fiber.Cookie{Name: "auth_token", Value: token, HTTPOnly: true, ...})

Streaming Response Pattern
--------------------------

  // SSE streaming via SendStreamWriter
  c.Response().Header.Set("Content-Type", "text/event-stream")
  c.Response().Header.Set("Cache-Control", "no-cache")
  // ... more SSE headers

  return c.SendStreamWriter(func(w *bufio.Writer) {
      // Read from source, write to w, flush
  })

Error Handling Convention
-------------------------

+-------------+-------------------------------------------+
| Status Code | Condition                                 |
+-------------+-------------------------------------------+
| 400         | Invalid request (bad JSON, unknown model) |
| 401         | Missing/invalid JWT token                 |
| 403         | Feature access denied (free tier)         |
| 500         | Server error (agent unreachable, etc.)    |
| 501         | Not implemented (register)                |
+-------------+-------------------------------------------+

Entry Points & Exports
----------------------

+----------------------------------+------------------------------------+
| Constructor                      | File                               |
+----------------------------------+------------------------------------+
| NewAuthHandler(cfg, authSvc)     | handler/auth_handler.go:17         |
| NewChatHandler(cfg, rdb, modelSvc)| handler/chat_handler.go:31        |
| NewModelHandler(modelSvc)        | handler/model_handler.go:12        |
+----------------------------------+------------------------------------+

Dependencies
------------

+-----------------------------+-----------------------------------------------+
| Dependency                  | Used For                                      |
+-----------------------------+-----------------------------------------------+
| github.com/gofiber/fiber/v3 | HTTP context, JSON, cookies, streaming        |
| bufio                       | Stream writer for SSE relay                   |
| service.*                   | Business logic interfaces                     |
+-----------------------------+-----------------------------------------------+

Source References
-----------------

- internal/handler/auth_handler.go - Auth handler pattern
- internal/handler/chat_handler.go - Chat + SSE handler pattern
- internal/handler/model_handler.go - Model handler pattern
- internal/router/router.go - Handler registration

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
