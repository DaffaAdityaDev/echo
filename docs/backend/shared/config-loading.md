================================================================================
  Config Loading - Environment-Based Configuration
================================================================================
  Module    : Config Loading
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

Application configuration is loaded from environment variables with fallback
to default values from constants/config. Loading occurs in config.Load(),
which is called from main.go after .env is loaded.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/config/config.go                | Config loader - reads env vars             |
| internal/constants/config/defaults.go    | All default constants                      |
| internal/models/models.go                | Config struct                              |
+------------------------------------------+--------------------------------------------+

Flow
----

  ┌──────────────────┐    ┌──────────────────────┐
  │  .env File        │    │ Environment Variables │
  └────────┬─────────┘    └──────────┬───────────┘
           │  godotenv.Load()        │
           └────────────┬────────────┘
                        ▼
                 ┌─────────────┐
                 │ config.Load │
                 └──────┬──────┘
                        │
            ┌───────────┴───────────┐
            │  getEnv(key, default) │
            │    if env var set ->  │
            │      return value     │
            │    else -> return     │
            │      default constant │
            └───────────┬───────────┘
                        ▼
                   *models.Config
                        │
            ┌───────────┴───────────┐
            │ Used by:              │
            │ - Server (port, CORS) │
            │ - Auth (JWT secret)   │
            │ - Database (URL)      │
            │ - ModelService (keys) │
            │ - Tracing (OTel)      │
            └───────────────────────┘

Load Function
-------------

  func Load() *models.Config {
      return &models.Config{
          Port:          getEnv("PORT", cfgConst.DefaultPort),
          DatabaseURL:   getEnv("DATABASE_URL", cfgConst.DefaultDatabaseURL),
          JWTSecret:     getEnv("JWT_SECRET", cfgConst.DefaultJWTSecret),
          Environment:   getEnv("ENVIRONMENT", cfgConst.DefaultEnvironment),
          AgentHTTPURL:  getEnv("HONO_API_URL",
                          getEnv("AGENT_HTTP_URL",
                              cfgConst.DefaultAgentHTTPURL)),
          AllowOrigins:  getEnv("ALLOW_ORIGINS", cfgConst.DefaultAllowOrigins),
          RedisAddr:     getEnv("REDIS_ADDR", cfgConst.DefaultRedisAddr),
          RedisPassword: getEnv("REDIS_PASSWORD", cfgConst.DefaultRedisPass),
          OtelCollectorAddr: getEnv("OTEL_COLLECTOR_ADDR", "otel-collector:4317"),
          EnableOtel:        getEnv("ENABLE_OTEL", "false") == "true",
          InternalAuthToken: getEnv("INTERNAL_AUTH_TOKEN", "default-internal-token-secret"),
          OpenAIAPIKey:      os.Getenv("OPENAI_API_KEY"),
          OpenAIBaseURL:    getEnv("OPENAI_BASE_URL", cfgConst.DefaultOpenAIBaseURL),
          OpenAIModels:     splitEnv(getEnv("OPENAI_MODELS", "gpt-4o,gpt-4o-mini")),
          AnthropicAPIKey:   os.Getenv("ANTHROPIC_API_KEY"),
          AnthropicBaseURL:  getEnv("ANTHROPIC_BASE_URL", cfgConst.DefaultAnthropicBaseURL),
          AnthropicModels:   splitEnv(getEnv("ANTHROPIC_MODELS", "claude-3-5-sonnet-latest,claude-3-haiku")),
          LMStudioBaseURL:    os.Getenv("LM_STUDIO_BASE_URL"),
          LMStudioAPIKey:     os.Getenv("LM_STUDIO_API_KEY"),
          OpenCodeGoAPIKey:   os.Getenv("OPENCODE_GO_API_KEY"),
          DefaultModel:       getEnv("DEFAULT_MODEL", cfgConst.DefaultModel),
      }
  }

Helper Functions
----------------

  // getEnv reads an environment variable.
  // If empty or not set, returns defaultValue.
  func getEnv(key, defaultValue string) string {
      if value := os.Getenv(key); value != "" {
          return value
      }
      return defaultValue
  }

  // splitEnv splits a CSV string into a slice.
  // Example: "gpt-4o,gpt-4o-mini" -> ["gpt-4o", "gpt-4o-mini"]
  func splitEnv(val string) []string {
      parts := strings.Split(val, ",")
      result := make([]string, 0, len(parts))
      for _, p := range parts {
          p = strings.TrimSpace(p)
          if p != "" {
              result = append(result, p)
          }
      }
      return result
  }

Full Config Struct
------------------

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

Config Field Dependency Map
---------------------------

  Config Field              Used By
  ─────────────────────────────────────────────────────────────────────
  Port                      -> server.Start()
  DatabaseURL               -> database.Connect()
  JWTSecret                 -> auth handler, AuthRequired middleware
  Environment               -> cookie Secure flag
  AgentHTTPURL              -> chat handler (agent relay)
  AllowOrigins              -> CORS middleware
  RedisAddr                 -> infrastructure.NewInfrastructure()
  RedisPassword             -> infrastructure.NewInfrastructure()
  OtelCollectorAddr         -> observability.InitTracer()
  EnableOtel                -> main.go (conditional init)
  InternalAuthToken         -> chat handler (agent headers)
  OpenAI*                   -> model service
  Anthropic*                -> model service
  LMStudio*                 -> model service
  OpenCodeGo*               -> model service
  DefaultModel              -> model service

Entry Points & Exports
----------------------

+----------------------+----------+----------------------------+
| Symbol               | Kind     | Path                       |
+----------------------+----------+----------------------------+
| Load()               | Function | config/config.go:10        |
| getEnv(key, default) | Helper   | config/config.go:48        |
| splitEnv(val)        | Helper   | config/config.go:36        |
+----------------------+----------+----------------------------+

Dependencies
------------

+----------------------------+-----------------------------------------------+
| Dependency                 | Used For                                      |
+----------------------------+-----------------------------------------------+
| os.Getenv                  | Reading environment variables                 |
| github.com/joho/godotenv  | Loading .env file                             |
| internal/constants/config  | Default fallback values                      |
+----------------------------+-----------------------------------------------+

Source References
-----------------

- internal/config/config.go - Config loader
- internal/constants/config/defaults.go - Default values
- internal/models/models.go:32-54 - Config struct
- cmd/server/main.go:16-21 - Config loading call

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
