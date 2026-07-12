================================================================================
  Models
================================================================================
  Module    : Models
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

Domain structs used across the Discord bot are defined in `internal/models/` (shared configuration) and locally within handler files (request/response DTOs, stream packets). There are separate models for configuration, HTTP API payloads, and SSE stream parsing.

## File Structure

```
internal/
├── models/
│   └── config.go             # Config struct
├── handler/
│   ├── discord.go            # DiscordJob, ChatRequest, StreamPacket, ModelInfo, ModelsResponse
│   └── health.go            # (no custom types)
├── router/
│   └── router.go             # ModelUpdateRequest
└── bot/
    └── handler.go            # ChatRequest, StreamPacket (simple bot version)
```

## Flow Diagram

```
┌──────────────────────────┐   ┌────────────────────────────────────┐   ┌────────────────────────────┐
│   models/config.go       │   │      handler/discord.go            │   │    router/router.go        │
│                          │   │                                    │   │                            │
│  ┌────────────────────┐  │   │  ┌─────────────────────────────┐   │   │  ┌────────────────────┐    │
│  │ Config             │  │   │  │ DiscordJob                  │   │   │  │ ModelUpdateRequest │    │
│  │  DiscordToken      │  │   │  │  Session *discordgo         │   │   │  │  ChannelID string  │    │
│  │  BackendURL        │  │   │  │  Event *MessageC            │   │   │  │  Model string      │    │
│  │  ServerPort        │  │   │  └─────────────────────────────┘   │   │  └────────────────────┘    │
│  │  GuildID           │  │   │  ┌─────────────────────────────┐   │   └────────────────────────────┘
│  └─────────┬──────────┘  │   │  │ ChatRequest                 │   │
│            ↑             │   │  │  Message string             │   │   ┌────────────────────────────┐
│            │             │   │  │  Model   string             │   │   │     bot/handler.go         │
│     config.Load()        │   │  │  Mode    string             │   │   │                            │
│            │             │   │  │  MissionID string           │   │   │  ┌────────────────────┐    │
│            │             │   │  └─────────────────────────────┘   │   │  │ ChatRequest        │    │
│            │             │   │  ┌─────────────────────────────┐   │   │  │ (same structure)  │    │
│            │             │   │  │ StreamPacket                │   │   │  └────────────────────┘    │
│            │             │   │  │  Type    string             │   │   │                            │
│            │             │   │  │  Content string             │   │   │  ┌────────────────────┐    │
│            │             │   │  └─────────────────────────────┘   │   │  │ StreamPacket       │    │
│            │             │   │  ┌─────────────────────────────┐   │   │  │ (same structure)  │    │
│            │             │   │  │ ModelInfo                   │   │   │  └────────────────────┘    │
│            │             │   │  │  ID   string                │   │   └────────────────────────────┘
│            │             │   │  │  Name string                │   │
│            │             │   │  └─────────────────────────────┘   │
│            │             │   │  ┌─────────────────────────────┐   │
│            │             │   │  │ ModelsResponse              │   │
│            │             │   │  │  Models []ModelInfo         │   │
│            │             │   │  └─────────────────────────────┘   │
└──────────────────────────┘   └────────────────────────────────────┘
```

## Model Definitions

### 1. Config (`models/config.go`)

```
internal/models/config.go:4-9
```

```go
type Config struct {
    DiscordToken string
    BackendURL   string
    ServerPort   string
    GuildID      string
}
```

### 2. Discord Job (`handler/discord.go`)

```
internal/handler/discord.go:19-22
```

```go
type DiscordJob struct {
    Session *discordgo.Session
    Event   *discordgo.MessageCreate
}
```

- Used as the unit of work in the worker pool queue
- Carries both the Discord session reference and the incoming event

### 3. Chat Request (two copies)

```
internal/handler/discord.go:31-36
internal/bot/handler.go:16-21
```

```go
type ChatRequest struct {
    Message   string `json:"message"`
    Model     string `json:"model"`
    Mode      string `json:"mode"`
    MissionID string `json:"missionId"`
}
```

- Sent as JSON body to `POST /api/v1/chat`
- `MissionID` is set to the Discord channel ID

### 4. Stream Packet (two copies)

```
internal/handler/discord.go:38-41
internal/bot/handler.go:24-27
```

```go
type StreamPacket struct {
    Type    string `json:"type"`
    Content string `json:"content"`
}
```

- Represents one line of the SSE `data:` stream from the backend
- `Type`: `"content"`, `"done"`, or `"error"`

### 5. Model Info + Response

```
internal/handler/discord.go:132-140
```

```go
type ModelInfo struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

type ModelsResponse struct {
    Models []ModelInfo `json:"models"`
}
```

- `ModelInfo`: individual model descriptor from the backend
- `ModelsResponse`: wrapper for `GET /api/v1/models` response

### 6. Model Update Request (`router/router.go`)

```
internal/router/router.go:13-16
```

```go
type ModelUpdateRequest struct {
    ChannelID string `json:"channel_id"`
    Model     string `json:"model"`
}
```

- Received by `POST /model` endpoint
- Used to set the active model per channel via `sync.Map`

## Duplication Note

The `ChatRequest` and `StreamPacket` structs are defined in **two places** (`internal/handler/discord.go` and `internal/bot/handler.go`) because the simple bot (`internal/bot/`) and the production handler (`internal/handler/`) are independent packages with no shared DTOs. These could be refactored into `internal/models/` if both implementations are maintained long-term.

## Source Refs

+----------------------------------+-----------+------------------------------------------+
| File                             | Line(s)   | Type(s)                                  |
+----------------------------------+-----------+------------------------------------------+
| internal/models/config.go        | 4-9       | Config                                   |
+----------------------------------+-----------+------------------------------------------+
| internal/handler/discord.go      | 19-22     | DiscordJob                               |
+----------------------------------+-----------+------------------------------------------+
| internal/handler/discord.go      | 31-36     | ChatRequest                              |
+----------------------------------+-----------+------------------------------------------+
| internal/handler/discord.go      | 38-41     | StreamPacket                             |
+----------------------------------+-----------+------------------------------------------+
| internal/handler/discord.go      | 132-140   | ModelInfo, ModelsResponse                |
+----------------------------------+-----------+------------------------------------------+
| internal/router/router.go        | 13-16     | ModelUpdateRequest                       |
+----------------------------------+-----------+------------------------------------------+
| internal/bot/handler.go          | 16-27     | ChatRequest, StreamPacket (duplicate)    |
+----------------------------------+-----------+------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
