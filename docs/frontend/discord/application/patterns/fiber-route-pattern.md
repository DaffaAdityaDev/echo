================================================================================
  Fiber Route Pattern
================================================================================
  Module    : Fiber Route Pattern
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The Discord bot uses the [Fiber v3](https://docs.gofiber.io/) HTTP framework to expose auxiliary HTTP endpoints alongside the Discord WebSocket connection. Routes are defined in `internal/router/router.go` and mounted on the Fiber app created in `internal/server/server.go`. The router provides a hybrid HTTP API for health checks and model management.

## File Structure

```
internal/
├── router/
│   └── router.go            # Route definitions
├── handler/
│   ├── health.go            # Health check handler
│   └── discord.go           # DiscordHandler (shared state for routes)
└── server/
    └── server.go            # Fiber app creation + middleware
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HTTP Request                              │
│                              │                                     │
│                              v                                     │
│                    Fiber App (port :8081)                           │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│ │ Middleware:      │  │ Middleware:      │  │ Router.          │   │
│ │ recover.New()   │  │ logger.New()     │  │ SetupRoutes(     │   │
│ │                  │  │                  │  │  fbApp,          │   │
│ └──────────────────┘  └──────────────────┘  │  healthHandler,  │   │
│                                              │  discordHandler) │   │
│                                              └──────────────────┘   │
│                              │                                     │
│                              v                                     │
│              ┌───────────────────────────────┐                     │
│              │   GET /health                 │                     │
│              │   → HealthHandler.Check       │                     │
│              ├───────────────────────────────┤                     │
│              │   GET /model                  │                     │
│              │   → Fetch models from         │                     │
│              │     Go Backend (proxies to    │                     │
│              │     {BACKEND_URL}/api/v1/     │                     │
│              │     models)                   │                     │
│              ├───────────────────────────────┤                     │
│              │   POST /model                 │                     │
│              │   → Set model for a channel   │                     │
│              │     Body: { channel_id,       │                     │
│              │     model }                   │                     │
│              │   → Updates discordHandler.   │                     │
│              │     ChannelModels             │                     │
│              └───────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Fiber app creation**: `internal/server/server.go:27-29`
- **Middleware**: `internal/server/server.go:32-33`
- **Route registration**: `internal/router/router.go:19`
- **HTTP listen**: `internal/server/server.go:99-102`

## Dependencies

+---------------------------------------------------+-----------+---------------------------------------------+
| Package                                           | Version   | Purpose                                     |
+---------------------------------------------------+-----------+---------------------------------------------+
| github.com/gofiber/fiber/v3                       | v3.3.0    | HTTP framework                              |
+---------------------------------------------------+-----------+---------------------------------------------+
| github.com/gofiber/fiber/v3/middleware/logger     | —         | Request logging                             |
+---------------------------------------------------+-----------+---------------------------------------------+
| github.com/gofiber/fiber/v3/middleware/recover    | —         | Panic recovery                              |
+---------------------------------------------------+-----------+---------------------------------------------+

## Route Definitions

### `GET /health`

```
internal/router/router.go:20
internal/handler/health.go:11-15
```

- Returns `{"status":"ok","bot":"running"}`
- Used for liveness/readiness probes

### `GET /model`

```
internal/router/router.go:23-49
```

- Proxies to `{BackendURL}/api/v1/models`
- Parses `ModelsResponse`, extracts model IDs
- Returns clean `[]string` JSON array
- On error returns `500` with error message

### `POST /model`

```
internal/router/router.go:52-70
```

- Accepts `{ "channel_id": "...", "model": "..." }`
- Validates required fields
- Stores in `discordHandler.ChannelModels` via `sync.Map.Store()`
- Returns `{ "status": "success", "channel_id": "...", "model": "..." }`

### Route Parameter Types

```
internal/router/router.go:13-16
```

```go
type ModelUpdateRequest struct {
    ChannelID string `json:"channel_id"`
    Model     string `json:"model"`
}
```

## Middleware Stack

```
internal/server/server.go:32-33
```

```go
fbApp.Use(recover.New())   // Prevents crashes from panicking handlers
fbApp.Use(logger.New())    // Logs every request (method, path, status, latency)
```

Logger middleware output format (Fiber default):

```
[2026-07-09 11:45:00] 200 GET /health 1.2ms
[2026-07-09 11:45:01] 200 GET /model 45ms
[2026-07-09 11:45:02] 200 POST /model 3ms
```

## Server Configuration

```
internal/server/server.go:27-29
```

```go
fbApp := fiber.New(fiber.Config{
    AppName: "Magi Discord Bot Server",
})
```

- Listens on port from config (`ServerPort`, default `:8081`)
- Runs in a goroutine so it does not block the Discord session

## Source Refs

+----------------------------------+-----------+----------------------------------------------------+
| File                             | Line(s)   | Role                                               |
+----------------------------------+-----------+----------------------------------------------------+
| internal/router/router.go        | 19-71     | All route definitions                              |
+----------------------------------+-----------+----------------------------------------------------+
| internal/router/router.go        | 13-16     | Request types                                      |
+----------------------------------+-----------+----------------------------------------------------+
| internal/handler/health.go       | 5-15      | Health handler                                     |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 27-33     | Fiber app + middleware setup                       |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 50-51     | Handler instantiation + wiring                     |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 98-103    | HTTP listen in goroutine                           |
+----------------------------------+-----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
