================================================================================
  Discord Gateway (Backend API Connection)
================================================================================
  Module    : Discord Gateway
  Service   : Discord
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The Discord bot connects to the Echo main backend API (Go Fiber server on port 8080) to process chat requests and fetch available models. This is an **outbound HTTP client** connection — the bot does NOT embed or run the backend; it calls it as an external service. Communication uses REST + SSE (Server-Sent Events) for streaming responses.

## File Structure

```
internal/
├── handler/
│   └── discord.go            # processChat(), fetchModels()
├── router/
│   └── router.go             # GET /model → proxies to backend
```

## Flow Diagram

```
┌──────────────────┐       HTTP POST /api/v1/chat       ┌──────────────────┐
│                  │  ──────────────────────────────────→ │                  │
│  Discord Bot     │   { message, model, mode,           │  Echo Backend    │
│  (port :8081)    │     missionId }                     │  (port :8080)    │
│                  │  ←────────────────────────────────── │                  │
│  Handler         │   SSE stream: data: {...}           │  Fiber API       │
│  processChat()   │                                     │                  │
└──────────────────┘                                     └──────────────────┘

┌──────────────────┐       HTTP GET /api/v1/models       ┌──────────────────┐
│                  │  ──────────────────────────────────→ │                  │
│  Discord Bot     │                                     │  Echo Backend    │
│  fetchModels()   │  ←────────────────────────────────── │                  │
│  router /model   │   { models: [{ id, name }] }        │                  │
└──────────────────┘                                     └──────────────────┘
```

## Entry Points

- **Backend URL config**: `internal/models/config.go:6` → `BackendURL` field
- **Chat request**: `internal/handler/discord.go:273-283`
- **Models fetch**: `internal/handler/discord.go:217-240`, `internal/router/router.go:24-48`

## Dependencies

+----------------+------------------------------------------------------+
| Package        | Purpose                                              |
+----------------+------------------------------------------------------+
| net/http       | HTTP client for backend requests                     |
| (stdlib)       |                                                      |
+----------------+------------------------------------------------------+
| encoding/json  | Request/response marshalling                         |
+----------------+------------------------------------------------------+
| bufio          | SSE line-by-line scanner                             |
+----------------+------------------------------------------------------+

## Connection Details

### 1. Backend URL Configuration

```
internal/models/config.go:6
```

```go
type Config struct {
    BackendURL string  // Default: "http://localhost:8080"
}
```

- Set via `BACKEND_URL` env var or `.env` file
- Loaded in `internal/config/config.go:20`

### 2. Chat API Call

```
internal/handler/discord.go:273-283
```

```go
backendURL := fmt.Sprintf("%s/api/v1/chat", h.Cfg.BackendURL)
req, err := http.NewRequest("POST", backendURL, bytes.NewBuffer(jsonData))
req.Header.Set("Content-Type", "application/json")

client := &http.Client{}
resp, err := client.Do(req)
```

- Payload: `{ message, model, mode, missionId }`
- Response: SSE stream (`text/event-stream`)

### 3. Models API Call

```
internal/handler/discord.go:217-240
```

```go
backendURL := fmt.Sprintf("%s/api/v1/models", h.Cfg.BackendURL)
resp, err := http.Get(backendURL)
// Response: { models: [{ id: "...", name: "..." }] }
```

### 4. Router Proxy (`GET /model`)

```
internal/router/router.go:24-48
```

- When a client calls `GET /model` on the bot's Fiber server, it proxies to `{BackendURL}/api/v1/models`
- Returns a simplified `[]string` of model IDs

## SSE Stream Processing

```
internal/handler/discord.go:301-337
```

```
Incoming stream             Parsed packets               Rebuilt response
───────────────────────────────────────────────────────────────────────────
data: {"type":"content",    ──>  "Hel"
      "content":"Hel"}
data: {"type":"content",    ──>  "lo"
      "content":"lo"}
data: {"type":"done",       ──>  (ignored — only
      "content":""}              "content" type is
                                 processed)
                                                     ────────────────────
                                                     Final: "Hello"
```

### Packet Structure

```go
type StreamPacket struct {
    Type    string `json:"type"`    // "content" only type checked by code
    Content string `json:"content"`
}
```

> Note: The source code only processes `type: "content"` packets. `"done"` and `"error"` type values are not handled — packets with those types are silently dropped.

### Scanner Logic

- Lines are read with `bufio.NewScanner`
- Only lines starting with `data:` are processed
- `data:` prefix is stripped, remaining JSON is unmarshalled
- Packets of `type: "content"` are concatenated into the final response
- Parse failures are logged (up to 3 per request)

## Error Handling

+------------------------+------------------------------------------------+------------------------------------------+
| Scenario               | User Message                                   | Log                                      |
+------------------------+------------------------------------------------+------------------------------------------+
| Backend unreachable    | "Backend Agent tidak merespon..."              | Backend request failed: ...              |
+------------------------+------------------------------------------------+------------------------------------------+
| Non-200 status         | "Gagal memproses request (status)..."          | Backend returned status: ...            |
+------------------------+------------------------------------------------+------------------------------------------+
| Empty response         | "Agent tidak memberikan respon."               | —                                        |
+------------------------+------------------------------------------------+------------------------------------------+
| Truncated (>1900 runes)| "... (truncated)"                              | —                                        |
+------------------------+------------------------------------------------+------------------------------------------+

## Source Refs

+----------------------------------+-----------+----------------------------------------------------+
| File                             | Line(s)   | Role                                               |
+----------------------------------+-----------+----------------------------------------------------+
| internal/handler/discord.go      | 273-283   | HTTP POST to chat endpoint                         |
+----------------------------------+-----------+----------------------------------------------------+
| internal/handler/discord.go      | 217-240   | HTTP GET to models endpoint                        |
+----------------------------------+-----------+----------------------------------------------------+
| internal/handler/discord.go      | 301-337   | SSE stream parsing                                 |
+----------------------------------+-----------+----------------------------------------------------+
| internal/handler/discord.go      | 38-41     | StreamPacket struct                                |
+----------------------------------+-----------+----------------------------------------------------+
| internal/router/router.go        | 24-48     | Model proxy route                                  |
+----------------------------------+-----------+----------------------------------------------------+
| internal/models/config.go        | 6         | BackendURL config field                            |
+----------------------------------+-----------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
