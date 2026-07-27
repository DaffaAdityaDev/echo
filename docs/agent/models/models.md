================================================================================
  Models - LLM Model Listing Endpoints
================================================================================
  Module    : Model Management
  Service   : agent (internal) + Go backend (primary)
  Version   : 1.1
  Updated   : 2026-07-26 (per-user model fetching on Go backend)
================================================================================

## Description

Model listing is now **per-user** on the Go backend. `GET /api/v1/models`
reads the authenticated user's provider config from `UserPreferences`,
fetches models from their configured provider API, and returns the list.

The agent still has `GET /api/models` as an internal endpoint, proxying to
`LLM_MODEL_API_URL`, but this is **secondary** — the primary model endpoint
for clients is the Go backend.

---

## Flow Diagram (Primary — Go Backend)

```
┌──────────────────────────────────────────────────────────────────────┐
│                   HTTP GET /api/v1/models                             │
│                   Auth: JWT (user_id from token)                      │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                handler/aimodel/handler.go → HandleGetModels()            │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              service/aimodel/service.go → GetModels(ctx, userID)        │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
            ▼                                         ▼
┌──────────────────────────┐  ┌──────────────────────────────────────┐
│  1. GetSettingsInternal() │  │  On error or no api_key:             │
│     (decrypts API key)    │  │  return { models: [] }               │
│                          │  └──────────────────────────────────────┘
│  2. modelsURL(baseURL)   │
│     → /v1/models         │
│                          │
│  3. fetch(URL, API key)  │
│                          │
│  4. Transform response   │
│     → { models: [...] }  │
└──────────────────────────┘
```

### modelsURL() helper

```go
func modelsURL(baseURL string) string {
    base := strings.TrimRight(baseURL, "/")
    if !strings.HasSuffix(base, "/v1") {
        return base + "/v1/models"
    }
    return base + "/models"
}
```

## Entry Points & Exports

+--------------------+-----------------------------+----------------------------+
| Export             | Source                      | Type                       |
+--------------------+-----------------------------+----------------------------+
| Go GET /models     | backend/router.go:121       | JWT-protected route        |
| Go GetModels()     | service/aimodel/service.go:55 | Per-user model fetch       |
| Go modelsURL()     | service/aimodel/service.go:110| URL constructor helper     |
| Agent GET /models  | adapter/inbound/api/models/model.routes.ts:6 | Internal proxy (secondary) |
+--------------------+-----------------------------+----------------------------+

## Dependencies

+---------------------------+----------------------------------------------------+
| Dependency                | Purpose                                            |
+---------------------------+----------------------------------------------------+
| ModelService              | Orchestrates per-user model fetch                  |
| SettingsService           | Reads user prefs + decrypts API key                |
| ENCRYPTION_KEY            | AES-256-GCM key for API key decryption             |
| modelCache                | Single instance cache with 30s TTL                 |
+---------------------------+----------------------------------------------------+

## Source References

+-----------------------+-----------------------------+----------------------------------------------+
| Ref                   | File                        | Key Lines                                    |
+-----------------------+-----------------------------+----------------------------------------------+
| Go route              | router.go:121               | GET /api/v1/models (JWT required)            |
| Go handler            | handler/aimodel/handler.go:30 | HandleGetModels — extracts userID from JWT   |
| Go service            | service/aimodel/service.go:55 | GetModels(ctx, userID)                       |
| modelsURL()           | service/aimodel/service.go:110| URL construction logic                       |
| Cache                 | service/aimodel/service.go:28 | 30s TTL, shared across all users             |
| Agent route           | adapter/inbound/api/models/model.routes.ts:6 | GET /api/models (Internal auth)              |
| Agent controller      | adapter/inbound/api/models/model.controller.ts:9-11 | Proxies to LLM_MODEL_API_URL                 |
+-----------------------+-----------------------------+----------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
