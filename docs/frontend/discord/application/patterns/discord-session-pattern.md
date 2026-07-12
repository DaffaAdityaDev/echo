================================================================================
  Discord Session Pattern
================================================================================
  Module    : Discord Session Pattern
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The Discord bot manages a `discordgo.Session` that connects to Discord's WebSocket Gateway. The session lifecycle — creation, intents configuration, connection, and graceful shutdown — is handled by the `Server` struct in `internal/server/server.go`. A simpler alternative `Bot` struct exists in `internal/bot/bot.go` for single-purpose use.

## File Structure

```
internal/
├── server/server.go          # Primary: Server wraps session + Fiber
└── bot/bot.go                # Alternative: standalone Bot struct
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              main()                                │
│                              │                                     │
│                              v                                     │
│                          config.Load()                             │
│                              │                                     │
│                              v                                     │
│                       server.NewServer(cfg)                        │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│ │ discordgo.New    │  │ dg.AddHandler    │  │ dg.Identify.    │   │
│ │ ("Bot " + token) │  │ (OnMessageCreate)│  │ Intents =        │   │
│ │                  │  │ dg.AddHandler    │  │ IntentsGuild-    │   │
│ │ Session created  │  │ (OnInteraction-  │  │ Messages |       │   │
│ │ (not connected)  │  │  Create)         │  │ IntentsDirect-   │   │
│ └──────────────────┘  └──────────────────┘  │ Messages         │   │
│                                              └──────────────────┘   │
│                              │                                     │
│                              v                                     │
│                            srv.Start()                             │
│                              │                                     │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│ │ DiscordSession.  │  │ Register slash   │  │ Start worker     │   │
│ │ Open()           │  │ commands         │  │ pool (50 gorou-  │   │
│ │                  │  │ (/model, /mode)  │  │ tines)           │   │
│ │ WebSocket        │  │                  │  │                  │   │
│ │ connection       │  │                  │  │ Start Fiber HTTP │   │
│ │ established      │  │                  │  │ server (gorou-   │   │
│ │ Bot appears      │  │                  │  │ tine)            │   │
│ │ online           │  │                  │  │                  │   │
│ └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                              │                                     │
│                              v                                     │
│                   Waiting for SIGINT/SIGTERM                       │
│                              │                                     │
│                              v                                     │
│                             srv.Stop()                             │
│        ┌─────────────────────┼─────────────────────┐               │
│        v                     v                     v               │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│ │ cancelWorkers()  │  │ DiscordSession.  │  │ FiberApp.        │   │
│ │ → Stop worker    │  │ Close()          │  │ Shutdown()       │   │
│ │   pool           │  │ → Disconnect     │  │ → Stop HTTP      │   │
│ │                  │  │   from Gateway   │  │   server          │   │
│ └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Session creation**: `internal/server/server.go:36-39`
- **Session open**: `internal/server/server.go:64-66`
- **Session close**: `internal/server/server.go:117-119`

## Dependencies

+-------------------------------+-----------+---------------------------------------------+
| Package                       | Version   | Purpose                                     |
+-------------------------------+-----------+---------------------------------------------+
| github.com/bwmarrin/discordgo | v0.29.0   | Discord API + Gateway WebSocket client      |
+-------------------------------+-----------+---------------------------------------------+

## Session Lifecycle

### 1. Creation (`discordgo.New`)

```
internal/server/server.go:36
```

```go
dg, err := discordgo.New("Bot " + cfg.DiscordToken)
```

- Creates a new session with the bot token (prefixed with `"Bot "`)
- No network connection yet

### 2. Intent Configuration

```
internal/server/server.go:47
```

```go
dg.Identify.Intents = discordgo.IntentsGuildMessages | discordgo.IntentsDirectMessages
```

- `IntentsGuildMessages`: receive messages in guilds the bot is in
- `IntentsDirectMessages`: receive direct messages
- Intents must match those enabled in the Discord Developer Portal

### 3. Event Handler Registration

```
internal/server/server.go:43-44
```

```go
dg.AddHandler(discordHandler.OnMessageCreate)
dg.AddHandler(discordHandler.OnInteractionCreate)
```

### 4. Connection (`Session.Open`)

```
internal/server/server.go:64
```

```go
if err := s.DiscordSession.Open(); err != nil {
    return fmt.Errorf("failed to open Discord session: %w", err)
}
```

- Opens WebSocket connection to Discord Gateway
- Performs identify handshake with configured intents
- Starts receiving events
- Blocks until connected

### 5. Slash Command Registration

```
internal/server/server.go:70-89
```

- `ApplicationCommandCreate` registers `/model` and `/mode` commands
- If `GuildID` is set, commands are scoped to that guild (instant registration)
- If empty, commands are global (may take up to 1 hour to propagate)

### 6. Graceful Disconnection (`Session.Close`)

```
internal/server/server.go:117-119
```

```go
if err := s.DiscordSession.Close(); err != nil {
    log.Printf("Error closing Discord session: %v", err)
}
```

- Sends a WebSocket close frame to disconnect from the Gateway
- Closes WebSocket connection
- Called in `srv.Stop()` on SIGINT/SIGTERM

## Alternative: Simple Bot (`internal/bot/bot.go`)

```
internal/bot/bot.go:10-55
```

```go
type Bot struct {
    Session    *discordgo.Session
    BackendURL string
}
```

- Simpler design, no worker pool
- `registerHandlers()` adds `messageCreate` directly
- `configureIntents()` sets `IntentsGuildMessages | IntentsDirectMessages`
- **Not used** — this package is dead code, not imported by `main.go` or any other package

## Source Refs

+----------------------------------+-----------+----------------------------------------------------+
| File                             | Line(s)   | Role                                               |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 36-39     | Discord session creation                           |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 43-47     | Handler registration + intents                     |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 64-66     | Session.Open — Gateway connect                     |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 70-89     | Slash command registration                         |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 117-119   | Session.Close — Gateway disconnect                 |
+----------------------------------+-----------+----------------------------------------------------+
| internal/server/server.go        | 109-124   | Full Stop sequence                                 |
+----------------------------------+-----------+----------------------------------------------------+
| internal/bot/bot.go              | 16-55     | Alternative simple Bot lifecycle                   |
+----------------------------------+-----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
