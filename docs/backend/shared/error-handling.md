================================================================================
  Error Handling - Error Types & HTTP Response Mapping
================================================================================
  Module    : Error Handling
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The backend uses a consistent error handling pattern across all handlers.
Errors are returned as JSON with an "error" field (and optional "details"
field). The Fiber global error handler catches unhandled errors, while
specific handlers manage business errors with appropriate status codes.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/middleware/common.go            | Global ErrorHandler                        |
| internal/handler/                        | Handler-specific error responses           |
| internal/constants/auth/jwt.go           | Auth-specific error messages               |
| internal/constants/db/postgres.go        | DB-specific error messages                 |
+------------------------------------------+--------------------------------------------+

Error Response Format
---------------------

  Standard Error
  ~~~~~~~~~~~~~~

  {
    "error": "Human-readable message"
  }

  Error with Details
  ~~~~~~~~~~~~~~~~~~

  {
    "error": "Agent request failed",
    "details": "<raw response body from agent>"
  }

HTTP Status Code Mapping
------------------------

+-------+------------------------------------------+----------------------------+
| Code  | Condition                                | Source                     |
+-------+------------------------------------------+----------------------------+
| 400   | Invalid JSON request body                | chat_handler.go:95         |
|       | Unknown model ID                         | chat_handler.go:146        |
|       | Missing required param (missionId)       | chat_handler.go:239        |
| 401   | Missing JWT token                        | middleware/auth.go:26-29   |
|       | Invalid/expired JWT token                | middleware/auth.go:36-40   |
| 403   | Feature requires Pro subscription        | chat_handler.go:129        |
| 500   | Failed to generate JWT                   | auth_handler.go:44         |
|       | Agent service unreachable                | chat_handler.go:197        |
|       | Agent request failed (non-200)           | chat_handler.go:203        |
|       | Failed to retrieve features              | chat_handler.go:405        |
|       | Failed to retrieve models                | model_handler.go:19        |
|       | Redis offline (SaaS stream)              | chat_handler.go:258        |
|       | Failed to create agent request           | chat_handler.go:183        |
| 501   | Register endpoint (stub)                 | auth_handler.go:25         |
+-------+------------------------------------------+----------------------------+

Error Flow
----------

  Handler
    │
    ├─ Validation error (bad JSON, missing field)
    │     └─ return c.Status(400).JSON(fiber.Map{"error": "..."})
    │
    ├─ Business logic error (unknown model, feature locked)
    │     └─ return c.Status(4xx).JSON(fiber.Map{"error": "..."})
    │
    ├─ External service error (agent unreachable)
    │     └─ return c.Status(500).JSON(fiber.Map{"error": "...", "details": "..."})
    │
    └─ Unhandled error (panic)
          └─ recover.New() middleware -> 500
          └─ ErrorHandler -> 500 { "error": "<panic message>" }

Global Error Handler
--------------------

  // middleware/common.go
  func ErrorHandler(c fiber.Ctx, err error) error {
      code := fiber.StatusInternalServerError
      if e, ok := err.(*fiber.Error); ok {
          code = e.Code
      }
      return c.Status(code).JSON(fiber.Map{
          "error": err.Error(),
      })
  }

Error Constants
---------------

  Auth
  ~~~~

  // constants/auth/jwt.go
  const (
      ErrMissingToken = "Unauthorized: Missing token"
      ErrInvalidToken = "Unauthorized: Invalid token"
  )

  Database
  ~~~~~~~~

  // constants/db/postgres.go
  const (
      ErrPostgresConfig = "unable to parse database config"
      ErrPostgresPool   = "unable to create connection pool"
      ErrPostgresPing   = "unable to ping database"
      ErrCreateUser     = "failed to create user"
      ErrGetUserEmail   = "failed to get user by email"
  )

Pattern: Wrap & Return
-----------------------

  // Pattern for error wrapping in handler:
  span.RecordError(err)
  return c.Status(500).JSON(fiber.Map{
      "error": "Agent service unreachable",
  })

  // Pattern with details from upstream response:
  bodyBytes, _ := io.ReadAll(resp.Body)
  return c.Status(resp.StatusCode).JSON(fiber.Map{
      "error":   "Agent request failed",
      "details": string(bodyBytes),
  })

  // Pattern with dynamic message:
  return c.Status(403).JSON(fiber.Map{
      "error": fmt.Sprintf("Feature '%s' requires a Pro subscription.", feat.Name),
  })

Error Handling Diagram
----------------------

  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
  │ Request  │───►│Fiber Router  │───►│ Middleware   │───►│ Handler  │───►│ Service  │
  └──────────┘    └──────────────┘    └──────┬───────┘    └─────┬─────┘    └──────────┘
                                             │                  │
                                        recover.New()     c.Status(4xx/5xx)
                                        ErrorHandler      .JSON(...)
                                             │                  │
                                             ▼                  ▼
                                       Catches panic      Response JSON
                                       -> 500 JSON

Entry Points & Exports
----------------------

+----------------------+-----------+------------------------------------+
| Symbol               | Kind      | Path                               |
+----------------------+-----------+------------------------------------+
| ErrorHandler(c, err) | Function  | middleware/common.go:29            |
| ErrMissingToken      | Constant  | constants/auth/jwt.go:10           |
| ErrInvalidToken      | Constant  | constants/auth/jwt.go:11           |
| ErrPostgresConfig    | Constant  | constants/db/postgres.go:5         |
| ErrPostgresPool      | Constant  | constants/db/postgres.go:6         |
| ErrPostgresPing      | Constant  | constants/db/postgres.go:7         |
| ErrCreateUser        | Constant  | constants/db/postgres.go:24        |
| ErrGetUserEmail      | Constant  | constants/db/postgres.go:25        |
+----------------------+-----------+------------------------------------+

Dependencies
------------

+-----------------------------------------------+-------------------------------------------+
| Dependency                                    | Used For                                  |
+-----------------------------------------------+-------------------------------------------+
| github.com/gofiber/fiber/v3                   | HTTP status codes, JSON response          |
| github.com/gofiber/fiber/v3/middleware/recover| Panic recovery                            |
+-----------------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/middleware/common.go:29-38 - Error handler
- internal/handler/auth_handler.go - Auth error responses
- internal/handler/chat_handler.go - Chat/stream/feature error responses
- internal/handler/model_handler.go - Model error responses
- internal/middleware/auth.go - Auth middleware error responses
- internal/constants/auth/jwt.go - Auth error constants
- internal/constants/db/postgres.go - DB error constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
