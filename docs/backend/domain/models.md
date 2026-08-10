================================================================================
  Domain Models - Struct Definitions & Relationships
================================================================================
  Module    : Domain Models
  Service   : backend
  Version   : 1.2
  Updated   : 2026-08-05
================================================================================

Overview
--------

Domain models represent data used across all backend layers - from database
to JSON responses. Structs use JSON tags for serialization and have fields
corresponding to the PostgreSQL database schema.

File Structure
--------------

Models are split by domain into separate packages (one file per package, not
a single models.go):

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/models/auth/user.go             | User, ApiKey                               |
| internal/models/chat/session.go          | Session                                    |
| internal/models/chat/message.go          | Message                                    |
| internal/models/features/feature.go      | Feature                                    |
| internal/models/llmops/prompt.go         | PromptTemplate, PromptVersion              |
| internal/models/user/preferences.go      | UserPreferences + HarnessFeatureToggles    |
| internal/models/ai/provider.go           | ProviderType, ProviderConfig               |
| internal/models/ai/model.go              | ModelInfo                                  |
| internal/models/agent/thought.go         | ThoughtStep                                |
| internal/models/agent/mission.go         | AgentMissionPayload, AgentResult           |
| internal/models/config/config.go         | Config (env-loaded runtime settings)       |
+------------------------------------------+--------------------------------------------+

Entity Overview
---------------

  ┌───────────────┐
  │     User      │
  ├───────────────┤
  │  id           │
  │  email        │
  │  password_hash│
  │  name         │
  │  role         │
  │  created_at   │
  │  updated_at   │
  └───────────────┘

  ┌───────────────┐
  │    Session    │
  ├───────────────┤
  │  id           │
  │  user_id      │
  │  title        │
  │  context_summary│
  │  status       │
  │  strategy_version │
  │  last_accessed_at │
  │  created_at   │
  │  updated_at   │
  │  message_count│
  │  token_count  │
  └───────────────┘

  ┌───────────────┐
  │    Message    │
  ├───────────────┤
  │  id           │
  │  session_id   │
  │  role         │
  │  content      │
  │  token_count  │
  │  turn_number  │
  │  steps        │
  │  status       │
  │  created_at   │
  └───────────────┘

  ┌───────────────┐
  │   Feature     │
  ├───────────────┤
  │  id           │
  │  name         │
  │  description  │
  │  tier_requirement │
  │  ui_schema    │
  │  status       │
  │  created_at   │
  │  updated_at   │
  └───────────────┘

Struct Definitions
------------------

  User
  ~~~~
  (internal/models/auth/user.go)

  type User struct {
      ID           int       `json:"id"`
      Email        string    `json:"email"`
      PasswordHash string    `json:"-"`
      Name         string    `json:"name"`
      Role         string    `json:"role"`
      CreatedAt    time.Time `json:"created_at"`
      UpdatedAt    time.Time `json:"updated_at"`
  }

+--------------+----------+--------------+----------------------------+
| Field        | Type     | JSON         | Note                       |
+--------------+----------+--------------+----------------------------+
| ID           | int      | id           | Primary key                |
| Email        | string   | email        | Unique                     |
| PasswordHash | string   | *hidden*     | json:"-" never serialized  |
| Name         | string   | name         | Display name               |
| Role         | string   | role         | e.g. "admin", "user"       |
| CreatedAt    | time.Time| created_at   | Auto-set by DB             |
| UpdatedAt    | time.Time| updated_at   | Auto-set by DB             |
+--------------+----------+--------------+----------------------------+

  ApiKey
  ~~~~~~
  (internal/models/auth/apikey.go)

  type ApiKey struct {
      ID        string    `json:"id"`
      KeyHash   string    `json:"-"`
      Prefix    string    `json:"prefix"`
      Name      string    `json:"name"`
      Scopes    []string  `json:"scopes"`
      UserID    string    `json:"user_id"`
      Status    string    `json:"status"`
      CreatedAt time.Time `json:"created_at"`
  }

  KeyHash is the SHA-256 hash of the raw key, never the key itself.

  Session
  ~~~~~~~
  (internal/models/chat/session.go)

  type Session struct {
      ID             string    `json:"id"`
      UserID         int       `json:"user_id"`
      Title          string    `json:"title"`
      ContextSummary string    `json:"context_summary"`
      Status         string    `json:"status"`
      StrategyVersion string   `json:"strategy_version,omitempty"`
      LastAccessedAt time.Time `json:"last_accessed_at,omitempty"`
      CreatedAt      time.Time `json:"created_at"`
      UpdatedAt      time.Time `json:"updated_at"`
      MessageCount   int       `json:"message_count,omitempty"`
      TokenCount     int       `json:"token_count,omitempty"`
  }

  Message
  ~~~~~~~
  (internal/models/chat/message.go)

  type Message struct {
      ID         int64           `json:"id"`
      SessionID  string          `json:"session_id"`
      Role       string          `json:"role"`
      Content    string          `json:"content"`
      TokenCount int             `json:"token_count"`
      TurnNumber int             `json:"turn_number"`
      Steps      json.RawMessage `json:"steps,omitempty"`
      Status     string          `json:"status"`
      CreatedAt  time.Time       `json:"created_at"`
  }

  Steps holds a JSON array of ThoughtStep objects (reasoning / tool_call /
  tool_result entries) captured during the turn.

  Feature
  ~~~~~~~
  (internal/models/features/feature.go)

  type Feature struct {
      ID              string          `json:"id"`
      Name            string          `json:"name"`
      Description     string          `json:"description"`
      TierRequirement string          `json:"tier_requirement"`
      UISchema        json.RawMessage `json:"ui_schema"`
      Status          string          `json:"status"`
      CreatedAt       time.Time       `json:"created_at"`
      UpdatedAt       time.Time       `json:"updated_at"`
  }

  PromptTemplate & PromptVersion
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  (internal/models/llmops/prompt.go)

  type PromptTemplate struct {
      ID            string    `json:"id"`
      TenantID      string    `json:"tenant_id"`
      Name          string    `json:"name"`
      Description   string    `json:"description"`
      ActiveVersion int       `json:"active_version"`
      CreatedAt     time.Time `json:"created_at"`
      UpdatedAt     time.Time `json:"updated_at"`
  }

  type PromptVersion struct {
      ID           string   `json:"id"`
      TemplateID   string   `json:"template_id"`
      Version      int      `json:"version"`
      SystemPrompt string   `json:"system_prompt"`
      BoundTools   []string `json:"bound_tools"`
      Variables    []string `json:"variables"`
      Status       string   `json:"status"`
      CreatedBy    string   `json:"created_by"`
      CreatedAt    time.Time `json:"created_at"`
  }

  UserPreferences
  ~~~~~~~~~~~~~~~
  (internal/models/user/preferences.go)

  type UserPreferences struct {
      UserID          int                    `json:"user_id"`
      DefaultMode     string                 `json:"default_mode"`
      DefaultModel    string                 `json:"default_model"`
      DefaultFeatures []string               `json:"default_features"`
      DefaultSkills   []string               `json:"default_skills"`
      ProviderType    string                 `json:"provider_type"`
      APIKey          string                 `json:"api_key,omitempty"`
      HasAPIKey       bool                   `json:"has_api_key"`
      BaseURL         string                 `json:"base_url"`
      HarnessToggles  *HarnessFeatureToggles `json:"harness_toggles,omitempty"`
  }

  APIKey is encrypted at rest using AES-256-GCM with ENCRYPTION_KEY.
  Only returned to client when explicitly requested (json:"api_key,omitempty").
  HasAPIKey is a boolean flag so clients can render state without the key.
  The frontend never pre-fills it — user must re-enter to change.

  HarnessFeatureToggles (and its config sub-structs LoopDetectionConfig,
  BudgetMonitorConfig, SystemNoticesConfig, HitlGuardConfig,
  ContextOptimizationConfig) mirror the agent harness guard-module toggles
  (all in internal/models/user/preferences.go).

  Provider Types & Config
  ~~~~~~~~~~~~~~~~~~~~~~~
  (internal/models/ai/provider.go)

  type ProviderType string

  const (
      ProviderOpenAI    ProviderType = "openai"
      ProviderAnthropic ProviderType = "anthropic"
      ProviderLMStudio  ProviderType = "lm-studio"
      ProviderOpenCode  ProviderType = "opencode-go"
  )

  type ProviderConfig struct {
      Type    ProviderType `json:"type"`
      BaseURL string       `json:"base_url"`
      APIKey  string       `json:"api_key,omitempty"`
      Model   string       `json:"model"`
  }

  ModelInfo
  ~~~~~~~~~
  (internal/models/ai/model.go)

  type ModelInfo struct {
      ID                 string       `json:"id"`
      Name               string       `json:"name,omitempty"`
      ProviderType       ProviderType `json:"provider_type"`
      ProviderName       string       `json:"provider_name"`
      SupportsMultimodal bool         `json:"supports_multimodal"`
  }

  ThoughtStep
  ~~~~~~~~~~~
  (internal/models/agent/thought.go)

  type ThoughtStep struct {
      Type      string          `json:"type"`
      Content   string          `json:"content,omitempty"`
      ToolName  string          `json:"toolName,omitempty"`
      ToolInput json.RawMessage `json:"toolInput,omitempty"`
  }

  AgentMissionPayload & AgentResult
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  (internal/models/agent/mission.go)

  type AgentMissionPayload struct {
      SessionID            string         `json:"session_id,omitempty"`
      TemplateID           string         `json:"template_id,omitempty"`
      PromptVersionID      string         `json:"prompt_version_id,omitempty"`
      SystemPromptOverride string         `json:"system_prompt_override,omitempty"`
      Prompt               string         `json:"prompt"`
      Tools                []string       `json:"tools,omitempty"`
      ProviderConfig       map[string]any `json:"provider_config,omitempty"`
  }

  type AgentResult struct {
      Content   string  `json:"content"`
      CostUSD   float64 `json:"cost_usd"`
      LatencyMS int     `json:"latency_ms"`
  }

  Config
  ~~~~~~
  (internal/models/config/config.go)

  type Config struct {
      Port                string
      DatabaseURL         string
      JWTSecret           string
      ServiceJWTSecret    string
      Environment         string
      AgentHTTPURL        string
      AllowOrigins        string
      RedisAddr           string
      RedisPassword       string
      OtelCollectorAddr   string
      EnableOtel          bool
      InternalAuthToken   string
      DefaultModel        string
      EncryptionKey       string
      EvaluatorEndpoint   string
      EvaluatorAPIKey     string
      EvaluatorModel      string
      PRUNE_THRESHOLD         int
      PRUNE_KEEP_LATEST_TURNS int
      SUMMARIZE_MAX_TOKENS    int
      StrategyRolloutDefault  float64
      WorkerInterval          string
      DecayDeprecateAfter     int
      DecayArchiveAfter       int
  }

(Config does not have JSON tags - internal use only)

  Provider API keys and base URLs removed from Config.
  They are now per-user, stored encrypted in UserPreferences.

  StrategyRolloutDefault controls the default rollout fraction for strategy
  version rollout. WorkerInterval is a string (e.g. "15m") parsed lazily at
  use time. DecayDeprecateAfter/DecayArchiveAfter (days) drive the strategy
  lifecycle worker's deprecation/archival of stale versions.

JSON Tags Convention
--------------------

+----------------------+-------------------------------------------+
| Tag                  | Meaning                                   |
+----------------------+-------------------------------------------+
| json:"id"            | Exported with given name                  |
| json:"-"             | Never serialized (passwords, secrets)     |
| json:"omitempty"     | Omitted if zero value                     |
| json:"api_key,       | Omitted if empty string                   |
| omitempty"           |                                           |
+----------------------+-------------------------------------------+

Entry Points & Exports
----------------------

+--------------------+--------------+--------------------------------------+
| Symbol             | Kind         | Path                                 |
+--------------------+--------------+--------------------------------------+
| User               | Struct       | internal/models/auth/user.go:5       |
| ApiKey             | Struct       | internal/models/auth/apikey.go:5     |
| Session            | Struct       | internal/models/chat/session.go:5    |
| Message            | Struct       | internal/models/chat/message.go:8    |
| Feature            | Struct       | internal/models/features/feature.go:8|
| PromptTemplate     | Struct       | internal/models/llmops/prompt.go:5   |
| PromptVersion      | Struct       | internal/models/llmops/prompt.go:15  |
| UserPreferences    | Struct       | internal/models/user/preferences.go:3|
| HarnessFeatureToggles | Struct    | internal/models/user/preferences.go:16|
| ProviderType       | Type (string)| internal/models/ai/provider.go:3    |
| ProviderConfig     | Struct       | internal/models/ai/provider.go:23   |
| ModelInfo          | Struct       | internal/models/ai/model.go:3       |
| ThoughtStep        | Struct       | internal/models/agent/thought.go:5  |
| AgentMissionPayload| Struct       | internal/models/agent/mission.go:3  |
| AgentResult        | Struct       | internal/models/agent/mission.go:13 |
| Config             | Struct       | internal/models/config/config.go:3  |
| ProviderOpenAI     | Constant     | internal/models/ai/provider.go:6    |
| ProviderAnthropic  | Constant     | internal/models/ai/provider.go:7    |
| ProviderLMStudio   | Constant     | internal/models/ai/provider.go:8    |
| ProviderOpenCode   | Constant     | internal/models/ai/provider.go:9    |
+--------------------+--------------+--------------------------------------+

Source References
-----------------

- internal/models/auth/user.go       - User, ApiKey
- internal/models/chat/session.go    - Session
- internal/models/chat/message.go    - Message
- internal/models/features/feature.go - Feature
- internal/models/llmops/prompt.go   - PromptTemplate, PromptVersion
- internal/models/user/preferences.go - UserPreferences, HarnessFeatureToggles
- internal/models/ai/provider.go     - ProviderType, ProviderConfig
- internal/models/ai/model.go        - ModelInfo
- internal/models/agent/thought.go   - ThoughtStep
- internal/models/agent/mission.go   - AgentMissionPayload, AgentResult
- internal/models/config/config.go   - Config

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
