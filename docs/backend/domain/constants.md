================================================================================
  Constants - Application Constants
================================================================================
  Module    : Application Constants
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

All application constants are organized by domain into separate packages:
application metadata, JWT authentication, configuration defaults, database
queries, and route paths.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/constants/app/app.go            | Application name, log format, health check |
| internal/constants/auth/jwt.go           | JWT header/cookie names, error messages    |
| internal/constants/config/defaults.go    | Environment variable defaults              |
| internal/constants/db/postgres.go        | SQL queries, error messages                |
| internal/constants/routes/v1.go          | URL path constants                         |
+------------------------------------------+--------------------------------------------+

Package: app - Application Constants
------------------------------------

  // File: internal/constants/app/app.go

  const (
      Name          = "Echo Backend API"
      LogFormat     = "[${time}] ${status} - ${latency} ${method} ${path}\n"
      TimeFormat    = "2006-01-02 15:04:05"
      HealthStatus  = "ok"
      HealthMessage = "Echo Backend API is running"
  )

  const (
      MsgNoEnvFile     = "No .env file found, using system environment variables"
      ErrServerStartup = "Failed to start server"
  )

+------------------+--------------------------------------------------------+----------------------------+
| Constant         | Value                                                  | Usage                      |
+------------------+--------------------------------------------------------+----------------------------+
| Name             | "Echo Backend API"                                     | Fiber AppName config       |
| LogFormat        | "[${time}] ${status} - ${latency} ${method} ${path}\n" | Fiber logger format        |
| TimeFormat       | "2006-01-02 15:04:05"                                  | Go time format             |
| HealthStatus     | "ok"                                                   | Health check response      |
| HealthMessage    | "Echo Backend API is running"                           | Health check response      |
| MsgNoEnvFile     | (message)                                              | Warning log                |
| ErrServerStartup | (message)                                              | Fatal log                  |
+------------------+--------------------------------------------------------+----------------------------+

Package: auth - JWT Constants
------------------------------

  // File: internal/constants/auth/jwt.go

  const (
      HeaderAuthorization = "Authorization"
      BearerPrefix        = "Bearer "
      TokenCookie         = "auth_token"
  )

  const (
      ErrMissingToken = "Unauthorized: Missing token"
      ErrInvalidToken = "Unauthorized: Invalid token"
  )

+---------------------+---------------------------+----------------------------+
| Constant            | Value                     | Usage                      |
+---------------------+---------------------------+----------------------------+
| HeaderAuthorization | "Authorization"           | HTTP header name           |
| BearerPrefix        | "Bearer "                 | Auth header prefix         |
| TokenCookie         | "auth_token"              | Cookie name for JWT        |
| ErrMissingToken     | (message)                 | 401 response               |
| ErrInvalidToken     | (message)                 | 401 response               |
+---------------------+---------------------------+----------------------------+

Package: config - Default Values
--------------------------------

  // File: internal/constants/config/defaults.go

  // Server defaults
  const (
      DefaultPort         = "8080"
      DefaultDatabaseURL  = "postgresql://localhost/echo_db?sslmode=disable"
      DefaultJWTSecret    = "your-secret-key"
      DefaultEnvironment  = "development"
      DefaultAgentHTTPURL = "http://localhost:3001"
      DefaultAllowOrigins = "http://localhost:3000"
  )

  // Redis defaults
  const (
      DefaultRedisAddr = "localhost:6379"
      DefaultRedisPass = ""
  )

  // LLM Provider defaults
  const (
      DefaultOpenAIBaseURL    = "https://api.openai.com/v1"
      DefaultAnthropicBaseURL = "https://api.anthropic.com"
      DefaultLMStudioBaseURL  = "http://localhost:1234"
      DefaultModel            = "gpt-4o"
  )

+-------------------+--------------------------------------------------------+-------------------------------+
| Env Var           | Default / Behavior                                     | Constant / Note               |
+-------------------+--------------------------------------------------------+-------------------------------+
| PORT              | "8080"                                                 | DefaultPort                   |
| DATABASE_URL      | "postgresql://localhost/echo_db?..."                   | DefaultDatabaseURL            |
| JWT_SECRET        | "your-secret-key"                                      | DefaultJWTSecret              |
| ENVIRONMENT       | "development"                                          | DefaultEnvironment            |
| AGENT_HTTP_URL    | "http://localhost:3001"                                 | DefaultAgentHTTPURL           |
| ALLOW_ORIGINS     | "http://localhost:3000"                                 | DefaultAllowOrigins           |
| REDIS_ADDR        | "localhost:6379"                                       | DefaultRedisAddr              |
| OPENAI_BASE_URL   | "https://api.openai.com/v1"                            | DefaultOpenAIBaseURL          |
| ANTHROPIC_BASE_URL| "https://api.anthropic.com"                            | DefaultAnthropicBaseURL       |
| LM_STUDIO_BASE_URL| No default (os.Getenv, empty if unset)                 | Constant exists but NOT used  |
| DEFAULT_MODEL     | "gpt-4o"                                               | DefaultModel                  |
+-------------------+--------------------------------------------------------+-------------------------------+

Package: db - Database Constants
---------------------------------

  // File: internal/constants/db/postgres.go

  // Messages
  const (
      MsgPostgresConnected = "Connected to PostgreSQL successfully"
  )

  // Error constants
  const (
      ErrPostgresConfig = "unable to parse database config"
      ErrPostgresPool   = "unable to create connection pool"
      ErrPostgresPing   = "unable to ping database"
      ErrCreateUser     = "failed to create user"
      ErrGetUserEmail   = "failed to get user by email"
  )

  // SQL Queries
  const (
      QueryCreateUser = `
          INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id, created_at, updated_at
      `
      QueryGetUserByEmail = `
          SELECT id, email, password_hash, name, role, created_at, updated_at
          FROM users
          WHERE email = $1
      `
  )

Package: routes - Route Paths
------------------------------

  // File: internal/constants/routes/v1.go

  const (
      V1APIPrefix = "/api/v1"
      V1AuthGroup = "/auth"

      V1PathHealth   = "/health"
      V1PathRegister = "/register"
      V1PathLogin    = "/login"
      V1PathChat     = "/chat"
      V1PathModels   = "/models"
      V1PathFeatures = "/features"
  )

Entry Points & Exports
----------------------

+------------------+-----------------+----------------------------------------------------+
| Package          | File            | Key Exports                                        |
+------------------+-----------------+----------------------------------------------------+
| constants/app    | app.go          | Name, LogFormat, TimeFormat, HealthStatus,         |
|                  |                 | HealthMessage                                      |
| constants/auth   | jwt.go          | HeaderAuthorization, BearerPrefix, TokenCookie,    |
|                  |                 | ErrMissingToken, ErrInvalidToken                   |
| constants/config | defaults.go     | DefaultPort, DefaultJWTSecret, DefaultDatabaseURL  |
|                  |                 | etc.                                               |
| constants/db     | postgres.go     | QueryCreateUser, QueryGetUserByEmail, error consts |
| constants/routes | v1.go           | V1APIPrefix, V1PathHealth, V1PathChat, etc.        |
+------------------+-----------------+----------------------------------------------------+

Source References
-----------------

- internal/constants/app/app.go
- internal/constants/auth/jwt.go
- internal/constants/config/defaults.go
- internal/constants/db/postgres.go
- internal/constants/routes/v1.go

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
