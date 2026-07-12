================================================================================
  Health Check
================================================================================
  Module    : Health Check
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

A lightweight HTTP health endpoint exposed by the Fiber server to signal that the bot process is running and accepting requests. Used for monitoring, container orchestration (liveness probes), and load balancer health checks.

## File Structure

```
internal/handler/health.go
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HTTP GET /health                            │
│                              │                                     │
│                              v                                     │
│                    HealthHandler.Check()                           │
│                              │                                     │
│                              v                                     │
│                      Response: 200 OK                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  {                                                         │    │
│  │    "status": "ok",                                         │    │
│  │    "bot": "running"                                        │    │
│  │  }                                                         │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Route registration**: `internal/router/router.go:20`
- **Handler**: `internal/handler/health.go`

## Dependencies

+-------------------------------+-----------+---------------------------------------------+
| Package                       | Version   | Purpose                                     |
+-------------------------------+-----------+---------------------------------------------+
| github.com/gofiber/fiber/v3   | v3.3.0    | HTTP server framework                       |
+-------------------------------+-----------+---------------------------------------------+

## Implementation

```
internal/handler/health.go:1-16
```

```go
package handler

import "github.com/gofiber/fiber/v3"

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
    return &HealthHandler{}
}

func (h *HealthHandler) Check(c fiber.Ctx) error {
    return c.JSON(fiber.Map{
        "status": "ok",
        "bot":    "running",
    })
}
```

### Route Registration

```
internal/router/router.go:20
```

```go
fbApp.Get("/health", healthHandler.Check)
```

### Response Format

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "bot": "running"
}
```

## Usage

### Curl

```bash
$ curl http://localhost:8081/health
{"bot":"running","status":"ok"}
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8081/health || exit 1
```

## Source Refs

+-----------------------------------+-----------+----------------------------------------------------+
| File                              | Line(s)   | Role                                               |
+-----------------------------------+-----------+----------------------------------------------------+
| internal/handler/health.go        | 5-15      | HealthHandler type + Check method                  |
+-----------------------------------+-----------+----------------------------------------------------+
| internal/router/router.go        | 20        | Route GET /health registration                     |
+-----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 50-51     | Handler instantiation + route wiring               |
+-----------------------------------+-----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
