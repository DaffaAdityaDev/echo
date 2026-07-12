================================================================================
  Domain Models - Struct Definitions & Relationships
================================================================================
  Module    : Domain Models
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

Domain models represent data used across all backend layers - from database
to JSON responses. Structs use JSON tags for serialization and have fields
corresponding to the PostgreSQL database schema.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/models/models.go                | All domain model structs                   |
+------------------------------------------+--------------------------------------------+

Entity Relationship (only User model exists — others are future/planned)
-----------------------------------------------------------------------

  ┌─────────────────┐
  │     User        │
  ├─────────────────┤
  │  id             │
  │  email          │
  │  password_hash  │
  │  name           │
  │  role           │
  │  created_at     │
  │  updated_at     │
  └─────────────────┘

  No other domain models (Goal, Mission, Topic, Card, Answer) are
  defined in the current codebase. The User model is the only entity.

Struct Definitions
------------------

  User
  ~~~~

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

  Config
  ~~~~~~

  type Config struct {
      Port              string
      DatabaseURL       string
      JWTSecret         string
      Environment       string
      AgentHTTPURL      string
      AllowOrigins      string
      RedisAddr         string
      RedisPassword     string
      OtelCollectorAddr string
      EnableOtel        bool
      InternalAuthToken string
      OpenAIAPIKey      string
      OpenAIBaseURL     string
      OpenAIModels      []string
      AnthropicAPIKey   string
      AnthropicBaseURL  string
      AnthropicModels   []string
      LMStudioBaseURL   string
      LMStudioAPIKey    string
      OpenCodeGoAPIKey  string
      DefaultModel      string
  }

(Config does not have JSON tags - internal use only)

  Provider Configs
  ~~~~~~~~~~~~~~~~

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

  type ModelInfo struct {
      ID           string       `json:"id"`
      Name         string       `json:"name,omitempty"`
      ProviderType ProviderType `json:"provider_type"`
      ProviderName string       `json:"provider_name"`
  }

  DB Wrapper
  ~~~~~~~~~~

  type DB struct {
      Pool *pgxpool.Pool
  }

  func (db *DB) Close() {
      db.Pool.Close()
  }

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

+--------------------+--------------+-------------------------------+
| Symbol             | Kind         | Path                          |
+--------------------+--------------+-------------------------------+
| User               | Struct       | models/models.go:64           |
| Config             | Struct       | models/models.go:32           |
| DB                 | Struct       | models/models.go:56           |
| ProviderType       | Type (string)| models/models.go:9            |
| ProviderConfig     | Struct       | models/models.go:18           |
| ModelInfo          | Struct       | models/models.go:25           |
| ProviderOpenAI     | Constant     | models/models.go:12           |
| ProviderAnthropic  | Constant     | models/models.go:13           |
| ProviderLMStudio   | Constant     | models/models.go:14           |
| ProviderOpenCode   | Constant     | models/models.go:15           |
+--------------------+--------------+-------------------------------+

Source References
-----------------

- internal/models/models.go - All domain model definitions

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
