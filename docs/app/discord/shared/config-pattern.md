================================================================================
  Config Pattern
================================================================================
  Module    : Config Pattern
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Configuration is loaded from environment variables and an optional `.env` file using a custom loader in `internal/config/config.go`. The config struct is defined in `internal/models/config.go` and used across the application by the Server, Handlers, and Router.

## File Structure

```
internal/
├── config/
│   └── config.go            # Load() + helper functions
└── models/
    └── config.go            # Config struct definition
```

## Flow Diagram

```
┌────────────────────────┐    ┌──────────────────────────────────┐
│      .env file         │    │   Environment Variables          │
│  ┌──────────────────┐  │    │  ┌────────────────────────────┐  │
│  │ DISCORD_TOKEN=   │  │    │  │ DISCORD_TOKEN              │  │
│  │ BACKEND_URL=     │──┼────┼──│ BACKEND_URL                │  │
│  │ PORT=            │  │(lower│ │ PORT                       │  │
│  │ GUILD_ID=        │  │ prio)│ │ GUILD_ID                   │  │
│  └──────────────────┘  │    │  └────────────────────────────┘  │
└────────────────────────┘    └──────────────┬───────────────────┘
                                             │
                                             v
                                    config.Load()
                                             │
                                             v
                                    models.Config
                                   ┌─────────────────────────────┐
                                   │ DiscordToken: string         │
                                   │ BackendURL: string           │
                                   │ ServerPort: string           │
                                   │ GuildID: string              │
                                   └──────────────┬───────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────┐
                 v                                v                    v
     ┌────────────────────┐    ┌───────────────────────┐  ┌───────────────────┐
     │ server.NewServer   │    │ handler.NewDiscord-   │  │ router.SetupRoutes│
     │ (cfg)              │    │ Handler(cfg, ...)     │  │ (..., discord-    │
     └────────────────────┘    └───────────────────────┘  │ Handler)          │
                                                          └───────────────────┘
```

## Entry Points

- **Config loading**: `internal/config/config.go:11`
- **Config model**: `internal/models/config.go:4`
- **Called from**: `main.go:16`

## Dependencies

None (standard library only: `os`, `bufio`, `strings`)

## Config Model

```
internal/models/config.go:4-9
```

```go
type Config struct {
    DiscordToken string  // Bot token from DISCORD_TOKEN env
    BackendURL   string  // Echo backend URL (default: http://localhost:8080)
    ServerPort   string  // Fiber listen port (default: :8081)
    GuildID      string  // Discord guild ID for slash commands (optional)
}
```

## Config Loading Logic

```
internal/config/config.go:11-28
```

### 1. `.env` File Parsing (`loadEnv`)

```
internal/config/config.go:39-67
```

- Opens `.env` file in the working directory
- Skips empty lines and comments (`#`)
- Splits on first `=` sign
- Trims whitespace and surrounding quotes from values
- Only sets env var if **not already defined** (env vars take priority over `.env`)

### 2. Environment Variable Resolution

+-----------------+--------------------------+------------------------------------------+
| Config Field    | Env Var                  | Default                                  |
+-----------------+--------------------------+------------------------------------------+
| DiscordToken    | DISCORD_TOKEN            | "" (required, program exits if empty)    |
+-----------------+--------------------------+------------------------------------------+
| BackendURL      | BACKEND_URL              | http://localhost:8080                     |
+-----------------+--------------------------+------------------------------------------+
| ServerPort      | PORT                     | :8081                                    |
+-----------------+--------------------------+------------------------------------------+
| GuildID         | GUILD_ID /               | "" (optional)                            |
|                 | ALLOWED_GUILD_ID         |                                          |
+-----------------+--------------------------+------------------------------------------+

### 3. Port Normalization

```
internal/config/config.go:16-18
```

```go
serverPort := getEnv("PORT", ":8081")
if !strings.HasPrefix(serverPort, ":") {
    serverPort = ":" + serverPort
}
```

- Ensures port always has a `:` prefix for Fiber's `Listen()`

### 4. Token Validation

Token validation is **not** in `config.Load()` — it is done in `main.go` after loading:

```
main.go:18-20
```

```go
if cfg.DiscordToken == "" {
    log.Fatal("Error: DISCORD_TOKEN is not configured. Check your environment or .env file.")
}
```

- Hard requirement: the bot will not start without a valid Discord token

## Usage in Application

```go
// main.go:16
cfg := config.Load()

// server.go:25
srv, err := server.NewServer(cfg)

// discord.go:43
discordHandler := handler.NewDiscordHandler(cfg, 10000)
```

## Source Refs

+------------------------------+-----------+----------------------------------------------------+
| File                         | Line(s)   | Role                                               |
+------------------------------+-----------+----------------------------------------------------+
| internal/config/config.go    | 11-28     | Load() — main loading function                     |
+------------------------------+-----------+----------------------------------------------------+
| internal/config/config.go    | 31-36     | getEnv() helper                                    |
+------------------------------+-----------+----------------------------------------------------+
| internal/config/config.go    | 39-67     | loadEnv() — .env file parser                       |
+------------------------------+-----------+----------------------------------------------------+
| internal/models/config.go    | 4-9       | Config struct definition                           |
+------------------------------+-----------+----------------------------------------------------+
| main.go                      | 16-19     | Config loading + token validation                  |
+------------------------------+-----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
