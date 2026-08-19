================================================================================
  Bot Handler (Message Processing)
================================================================================
  Module    : Bot Handler
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The Discord bot processes incoming messages, slash commands, and interactive components (dropdowns) through the **production handler** (`internal/handler/`) with a worker pool architecture. A **stub handler** exists in `internal/bot/` but is dead code — not imported or used by any package. The handler communicates with the Echo Go backend via HTTP, consumes an SSE stream, and posts the final reply back to Discord.

## File Structure

```
internal/
├── bot/
│   ├── bot.go              # Simple Bot struct with session lifecycle
│   └── handler.go          # Simple message handler (direct processing)
├── handler/
│   └── discord.go          # Production DiscordHandler with worker pool
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Discord Gateway Event                          │
│                              │                                     │
│                              v                                     │
│                      OnMessageCreate()                             │
│                              │                                     │
│              ┌───────────────┴───────────────┐                     │
│              v                               v                     │
│   ┌────────────────────┐   ┌────────────────────────────────────┐  │
│   │  bot mentioned?    │   │  (no) → ignore                     │  │
│   │  OR message starts │   │                                    │  │
│   │  with "!" ?        │   │                                    │  │
│   └────────┬───────────┘   └────────────────────────────────────┘  │
│            │ (yes)                                                 │
│            v                                                        │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │     Job Queue (buffered chan, cap 10000)                   │   │
│   └──────────────────────────┬─────────────────────────────────┘   │
│                              v                                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │     Worker Pool (50 goroutines)                            │   │
│   └──────────────────────────┬─────────────────────────────────┘   │
│                              v                                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │                     processChat()                          │   │
│   └──────────────────────────┬─────────────────────────────────┘   │
│                              │                                     │
│                              v                                     │
│               POST /api/v1/chat ─────────► Go Backend              │
│                              │                                     │
│                              ◄────────── SSE stream (data: {...})  │
│                              │                                     │
│                              v                                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  Parse SSE stream → Rebuild response                      │   │
│   └──────────────────────────┬─────────────────────────────────┘   │
│                              v                                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │              s.ChannelMessageSend()                        │   │
│   └──────────────────────────┬─────────────────────────────────┘   │
│                              v                                     │
│                       Discord Channel                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

+-----------------------+---------------------------+----------------------+
| Entry                 | File                      | Lines                |
+-----------------------+---------------------------+----------------------+
| Handler registration  | internal/server/server.go | 43-44                |
+-----------------------+---------------------------+----------------------+
| Worker start          | internal/server/server.go | 92-94                |
+-----------------------+---------------------------+----------------------+
| Slash command reg     | internal/server/server.go | 70-89                |
+-----------------------+---------------------------+----------------------+

## Dependencies

+-------------------------------------+-----------+---------------------------------------------+
| Package                             | Version   | Purpose                                     |
+-------------------------------------+-----------+---------------------------------------------+
| github.com/bwmarrin/discordgo       | v0.29.0   | Discord API client + WebSocket gateway      |
+-------------------------------------+-----------+---------------------------------------------+

## Handler Components

### 1. `DiscordHandler` Struct

```
internal/handler/discord.go:24-29
```

```go
type DiscordHandler struct {
    Cfg           *models.Config
    JobQueue      chan *DiscordJob
    ChannelModels sync.Map  // channelID → model name
    ChannelModes  sync.Map  // channelID → mode name
}
```

- `JobQueue`: buffered channel (capacity 10,000) acting as a work queue
- `ChannelModels` / `ChannelModes`: `sync.Map` for per-channel state (model selection, operation mode)

### 2. Message Handling (`OnMessageCreate`)

```
internal/handler/discord.go:73-104
```

- Filters: ignores own messages, processes only if bot is **mentioned** or message starts with `!`
- Enqueues `DiscordJob`; if queue full, replies with a rate-limit message
- Triggers typing indicator (`ChannelTyping`) to acknowledge receipt

### 3. Worker Pool

```
internal/handler/discord.go:51-69
```

- `Start(ctx, numWorkers)` launches N goroutines
- Each worker reads from `JobQueue` and calls `processChat()`
- Graceful shutdown via context cancellation

### 4. Chat Processing (`processChat`)

```
internal/handler/discord.go:243-358
```

- Reads per-channel model/mode from `sync.Map`
- Builds `ChatRequest` payload
- POSTs to Go Backend `{BackendURL}/api/v1/chat`
- Parses SSE response: scans lines for `data:` prefix, unmarshals `StreamPacket`, builds response from `type: "content"` packets
- Truncates to 1900 runes (Discord 2000-char limit)
- Sends final message to channel

### 5. Slash Commands

+---------+-------------------+---------------------------------------------------+
| Command | Handler           | Function                                          |
+---------+-------------------+---------------------------------------------------+
| /model  | handleSlashModel  | Fetches models from backend, shows Select Menu    |
|         |                   | dropdown                                          |
+---------+-------------------+---------------------------------------------------+
| /mode   | handleSlashMode   | Shows mode selection dropdown                     |
+---------+-------------------+---------------------------------------------------+

### 6. Interactive Components (Dropdown Callbacks)

+-----------------+---------------------------+---------------------------------------------+
| CustomID        | Handler                   | Function                                    |
+-----------------+---------------------------+---------------------------------------------+
| select_model    | handleDropdownSelection   | Stores selected model in ChannelModels      |
+-----------------+---------------------------+---------------------------------------------+
| select_mode     | handleModeDropdownSelection| Stores selected mode in ChannelModes        |
+-----------------+---------------------------+---------------------------------------------+

## SSE Parsing Logic

```
internal/handler/discord.go:301-337
```

```
Received SSE stream:
  data: {"type":"content","content":"Hello"}
  data: {"type":"content","content":" world"}
  data: {"type":"done","content":""}

Parsed result: "Hello world"
```

## Source Refs

+----------------------------------+----------+----------------------------------------------------+
| File                             | Lines    | Description                                        |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 24-29    | DiscordHandler struct definition                   |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 73-104   | OnMessageCreate — job producer                     |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 51-69    | Worker pool start + worker loop                    |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 243-358  | processChat — SSE + response                       |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 107-129  | OnInteractionCreate — slash + component dispatch   |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 142-214  | /model slash + dropdown handlers                   |
+----------------------------------+----------+----------------------------------------------------+
| internal/handler/discord.go      | 362-414  | /mode slash + dropdown handlers                    |
+----------------------------------+----------+----------------------------------------------------+
| internal/bot/bot.go              | —        | Unused / dead code — not imported by any package   |
+----------------------------------+----------+----------------------------------------------------+
| internal/bot/handler.go          | —        | Unused / dead code — not imported by any package   |
+----------------------------------+----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
