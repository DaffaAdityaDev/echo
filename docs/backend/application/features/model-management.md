================================================================================
  Model Management - Per-User Provider-Agnostic Model Resolution
================================================================================
  Module    : Model Management
  Service   : backend
  Version   : 2.0
  Updated   : 2026-08-05
================================================================================

Overview
--------

The Model Management feature lists and resolves models for the *authenticated
user's own provider configuration*. There are no server-level provider API
keys anymore: each user stores `provider_type`, `api_key`, and `base_url`
encrypted in their UserPreferences (see docs/backend/domain/models.md). The
model listing is therefore per-user — two users with different providers see
different model catalogs.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/aimodel/handler.go       | ModelHandler - HTTP handler for GET /models|
| internal/service/aimodel/service.go       | ModelService - listing, resolution, caching|
| internal/models/ai/model.go               | ModelInfo, ProviderType, ProviderConfig    |
| internal/models/ai/provider.go            | ProviderType enum + constants              |
+------------------------------------------+--------------------------------------------+

Flow Diagram - Model Listing
----------------------------

  ┌──────────┐         ┌──────────────────┐         ┌──────────────────────┐
  │  Client  │         │  Go Backend      │         │ External Providers   │
  └────┬─────┘         └────────┬─────────┘         └──────────┬───────────┘
       │  GET /api/v1/models    │                              │
       │  (User JWT)            │                              │
       │───────────────────────►│                              │
       │                        │  Load UserPreferences(userID)│
       │                        │  (provider_type/api_key/     │
       │                        │   base_url)                  │
       │                        │  no provider configured?     │
       │                        │  -> empty list               │
       │                        │  api_key empty & provider != │
       │                        │  lm-studio? -> empty list    │
       │                        │                              │
       │                        │  check cache (30s TTL, key = │
       │                        │  provider|base_url)          │
       │                        │  if expired: GET {modelsURL} │
       │                        │─────────────────────────────►│
       │                        │  parse Data[].id, transform  │
       │                        │◄─────────────────────────────│
       │  {models: [...]}       │                              │
       │◄───────────────────────│                              │
       │                        │                              │
       │                        │  NOTE: opencode-go always     │
       │                        │  fetches from the hardcoded  │
       │                        │  https://opencode.ai/zen/go/  │
       │                        │  v1/models (see Known Limits)│
       └────────────────────────┴──────────────────────────────┘

Response Schema
---------------

Response body for `GET /api/v1/models` (authenticated):

```json
{
  "models": [
    {
      "id": "opencode-go/deepseek-v4-flash",
      "name": "deepseek-v4-flash",
      "provider_type": "opencode-go",
      "provider_name": "OpenCode Go",
      "supports_multimodal": true
    }
  ]
}
```

ModelInfo Fields
----------------

| Field             | Type         | JSON Key           | Notes                          |
|-------------------|--------------|--------------------|--------------------------------|
| ID                | string       | `id`               | Unique model identifier        |
| Name              | string       | `name`             | Display name; omitempty        |
| ProviderType      | ProviderType | `provider_type`    | Provider enum value            |
| ProviderName      | string       | `provider_name`    | Human-readable provider label  |
| SupportsMultimodal| bool         | `supports_multimodal` | Heuristic from model id    |

`ProviderType` enum: `openai`, `anthropic`, `lm-studio`, `opencode-go`.

opencode-go model IDs are prefixed with `opencode-go/` in the catalog.

Listing Behavior
----------------

1. `GetModels(ctx, userID)` loads the user's `UserPreferences` via
   `GetSettingsInternal`.
2. Empty list `[]` is returned when:
   - the user has no provider type configured (`provider_type == ""`), or
   - the user has no API key AND the provider is not `lm-studio`
     (LM Studio runs locally and needs no key).
3. If `base_url` is empty it is normalized via `defaultBaseURL(providerType)`.
4. Results are cached in-memory for 30 seconds, keyed by
   `provider_type|base_url` (single shared cache — there is no separate
   5-minute OpenCode Go cache anymore).

LM Studio base URL normalization: `modelsURL()` appends `/v1/models` unless
the base already ends with `/v1`. All other providers use the same helper.

Model Resolution Flow
---------------------

  ResolveProviderConfig(userID, "opencode-go/deepseek-v4-flash")
    │
    ├─ Load UserPreferences(userID)
    │     └─ none configured -> error "provider tidak dikonfigurasi"
    │
    ├─ api_key empty & provider != lm-studio -> error (API key required)
    │
    ├─ base_url empty -> defaultBaseURL(providerType)
    │
    ├─ provider == opencode-go -> strip "opencode-go/" prefix -> Model
    │
    └─ Return ProviderConfig{Type, BaseURL, APIKey, Model}

This is used by the chat handler before every mission so the agent receives a
per-user provider config.

Known Limitations
-----------------

- I-3: For `opencode-go` the model fetch always hits the hardcoded
  `https://opencode.ai/zen/go/v1/models` URL, regardless of any custom
  `base_url` the user configured. The user's base_url is still honored at
  chat/execution time via ResolveProviderConfig, only the *listing* fetch is
  pinned to the official endpoint.

Caching Strategy
----------------

+--------------+--------------------+-------+------------------------------------+
| Provider     | Cache Type         | TTL   | Mechanism                          |
+--------------+--------------------+-------+------------------------------------+
| All (shared) | In-memory (RWMutex)| 30s   | Double-checked locking, keyed by   |
|              |                    |       | provider_type|base_url; failed     |
|              |                    |       | fetches cache an empty entry for   |
|              |                    |       | the same 30s window                |
+--------------+--------------------+-------+------------------------------------+

  getCachedModels(ctx, providerType, apiKey, baseURL)
    RLock -> if not expired -> return
    Lock -> double-check -> if expired -> fetch -> store -> return

Entry Points & Exports
----------------------

+-----------------------------------+--------------+-------------------------------+
| Symbol                            | Kind         | Path                          |
+-----------------------------------+--------------+-------------------------------+
| NewService(cfg, settingsSvc)      | Constructor  | service/aimodel/service.go:42  |
| GetModels(ctx, userID)            | Method       | service/aimodel/service.go:83  |
| ResolveProviderConfig(userID,     | Method       | service/aimodel/service.go:232 |
|   modelID)                        |              |                               |
| HandleGetModels(c)                | Method       | handler/aimodel/handler.go     |
+-----------------------------------+--------------+-------------------------------+

Removed in 2.0: `GetDefault()`, `fetchOpenCodeGoModels(ctx)`,
`fetchLMStudioModels(ctx)` — all deleted with the env-key-based provider
config model.

Dependencies
------------

+-----------------------------+-------------------------------------------+
| Dependency                  | Used For                                  |
+-----------------------------+-------------------------------------------+
| github.com/gofiber/fiber/v3 | HTTP handler, JSON response               |
| net/http                    | Fetching models from the configured       |
|                             | provider's /models endpoint               |
| sync.RWMutex                | Thread-safe cache                         |
| encoding/json               | Parsing API responses                     |
+-----------------------------+-------------------------------------------+

Source References
-----------------

- internal/service/aimodel/service.go - ModelService (GetModels, ResolveProviderConfig, 30s cache)
- internal/handler/aimodel/handler.go - GET /api/v1/models handler
- internal/models/ai/model.go - ModelInfo struct (incl. SupportsMultimodal)
- internal/models/ai/provider.go - ProviderType constants
- internal/router/router.go:148 - Route registration (User JWT required)

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
