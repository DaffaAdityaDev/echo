================================================================================
  Model Management - Provider-Agnostic Model Resolution
================================================================================
  Module    : Model Management
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Model Management feature provides model listing and resolution. The
backend aggregates models from all configured providers (OpenAI, Anthropic,
LM Studio, OpenCode Go), consolidates them into a single list, and offers a
mechanism to resolve a model ID into a full provider configuration (base URL,
API key, provider type).

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/model_handler.go        | ModelHandler - HTTP handler for GET /models|
| internal/service/model_service.go        | ModelService - listing, resolution, caching|
| internal/models/models.go                | ModelInfo, ProviderConfig, ProviderType    |
| internal/config/config.go                | Config loading - model lists from env vars |
+------------------------------------------+--------------------------------------------+

Flow Diagram - Model Listing
----------------------------

  ┌──────────┐         ┌──────────────────┐         ┌──────────────────────┐
  │  Client  │         │  Go Backend      │         │ External Providers   │
  └────┬─────┘         └────────┬─────────┘         └──────────┬───────────┘
       │  GET /api/v1/models    │                              │
       │───────────────────────►│                              │
       │                        │  OpenAPIKey set?             │
       │                        │  yes -> append OpenAIModels  │
       │                        │                              │
       │                        │  AnthropicAPIKey set?        │
       │                        │  yes -> append AnthropicModels│
       │                        │                              │
       │                        │  LMStudioBaseURL set?        │
       │                        │  check cache (30s TTL)       │
       │                        │  if expired: GET /v1/models  │
       │                        │─────────────────────────────►│
       │                        │  parse Data[].id             │
       │                        │◄─────────────────────────────│
       │                        │                              │
       │                        │  OpenCodeGoAPIKey set?       │
       │                        │  check cache (5min TTL)      │
       │                        │  if expired: GET /v1/models  │
       │                        │─────────────────────────────►│
       │                        │  prefix with "opencode-go/"  │
       │                        │◄─────────────────────────────│
        │  {models: [...]}       │                              │
        │◄───────────────────────│                              │

Response Schema
---------------

Response body for `GET /api/v1/models`:

```json
{
  "models": [
    {
      "id": "gpt-4o",
      "name": "gpt-4o",
      "provider_type": "openai",
      "provider_name": "OpenAI"
    },
    {
      "id": "claude-3-5-sonnet-20241022",
      "name": "claude-3-5-sonnet-20241022",
      "provider_type": "anthropic",
      "provider_name": "Anthropic"
    },
    {
      "id": "lmstudio-model-1",
      "name": "lmstudio-model-1",
      "provider_type": "lm-studio",
      "provider_name": "LM Studio"
    },
    {
      "id": "opencode-go/qwen-72b",
      "name": "qwen-72b",
      "provider_type": "opencode-go",
      "provider_name": "OpenCode Go"
    }
  ]
}
```

ModelInfo Fields
----------------

| Field          | Type         | JSON Key       | Notes                          |
|----------------|--------------|----------------|--------------------------------|
| ID             | string       | `id`           | Unique model identifier        |
| Name           | string       | `name`         | Display name; omitempty        |
| ProviderType   | ProviderType | `provider_type`| Provider enum value            |
| ProviderName   | string       | `provider_name`| Human-readable provider label  |

`ProviderType` enum: `openai`, `anthropic`, `lm-studio`, `opencode-go`.

Model Resolution Flow
---------------------

  ResolveModel("gpt-4o")
    │
    ├─ Check OpenAIModels list -> match "gpt-4o"
    │     └─ Return ProviderConfig{Type:openai, BaseURL, APIKey, Model:"gpt-4o"}
    │
    ├─ Check AnthropicModels list -> match?
    │     └─ Return ProviderConfig{Type:anthropic, BaseURL, APIKey, Model:"..."}
    │
    ├─ Check OpenCodeGo prefix "opencode-go/" -> match?
    │     └─ Strip prefix -> Model = suffix
    │     └─ Return ProviderConfig{Type:opencode-go, BaseURL, APIKey, Model}
    │
    ├─ Check LM Studio cache -> match model ID?
    │     └─ Or fallback: if starts with "lmstudio"/"local"
    │     └─ Return ProviderConfig{Type:lm-studio, BaseURL, APIKey, Model}
    │
    └─ No match -> return error "unknown model: <modelID>"

Caching Strategy
----------------

+--------------+--------------------+-------+------------------------------------+
| Provider     | Cache Type         | TTL   | Mechanism                          |
+--------------+--------------------+-------+------------------------------------+
| LM Studio    | In-memory (RWMutex)| 30s   | Double-checked locking             |
| OpenCode Go  | In-memory (RWMutex)| 5 min | Double-checked locking             |
+--------------+--------------------+-------+------------------------------------+

  getCachedLMStudioModels(ctx)
    RLock -> if not expired -> return
    Lock -> double-check -> if expired -> fetch -> store -> return

  getCachedOpenCodeModels(ctx)
    RLock -> if not expired -> return
    Lock -> double-check -> if expired -> fetch -> store -> return

Entry Points & Exports
----------------------

+-----------------------------------+--------------+-------------------------------+
| Symbol                            | Kind         | Path                          |
+-----------------------------------+--------------+-------------------------------+
| NewModelHandler(modelSvc)         | Constructor  | handler/model_handler.go:12   |
| HandleGetModels(c)                | Method       | handler/model_handler.go:16   |
| NewModelService(cfg)              | Constructor  | service/model_service.go:42   |
| ModelService                      | Interface    | service/model_service.go:30   |
| GetModels(ctx)                    | Method       | service/model_service.go:46   |
| ResolveModel(modelID)             | Method       | service/model_service.go:84   |
| GetDefault()                      | Method       | service/model_service.go:143  |
| fetchOpenCodeGoModels(ctx)        | Private      | service/model_service.go:207  |
| fetchLMStudioModels(ctx)          | Private      | service/model_service.go:252  |
+-----------------------------------+--------------+-------------------------------+

Dependencies
------------

+-----------------------------+-------------------------------------------+
| Dependency                  | Used For                                  |
+-----------------------------+-------------------------------------------+
| github.com/gofiber/fiber/v3 | HTTP handler, JSON response               |
| net/http                    | Fetching models from LM Studio / OpenCode |
| sync.RWMutex                | Thread-safe cache                         |
| encoding/json               | Parsing API responses                     |
+-----------------------------+-------------------------------------------+

Source References
-----------------

- internal/handler/model_handler.go - Model listing HTTP handler
- internal/service/model_service.go - ModelService interface + implementation
- internal/models/models.go:25-30 - ModelInfo struct
- internal/models/models.go:9-16 - ProviderType constants
- internal/router/router.go:50 - Route registration

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
