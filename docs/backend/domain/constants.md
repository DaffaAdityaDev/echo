================================================================================
  Constants - Application Constants
================================================================================
  Module    : Application Constants
  Service   : backend
   Version   : 1.1
   Updated   : 2026-07-26
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
      LogFormat     = "[${time}] ${status} ${method} ${white}${path}${reset} ip=${ip} route=${route} latency=${latency} in=${bytesReceived}B out=${bytesSent}B ${magenta}ua=${ua}${reset} err=${error}\n"
      LogTimeFormat = "2006-01-02 15:04:05.000"
      LogFormatJSON     = `{"time":"${time}","pid":${pid},"status":${status},"method":"${method}","path":"${path}","route":"${route}","ip":"${ip}","latency":"${latency}","in":${bytesReceived},"out":${bytesSent},"ua":"${ua}","err":"${error}"}` + "\n"
      LogTimeFormatJSON = "2006-01-02T15:04:05.000Z"
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
| LogFormat        | Dev access log (color tags, human-friendly)            | Fiber logger format (dev)  |
| LogTimeFormat    | "2006-01-02 15:04:05.000"                              | Dev log time format        |
| LogFormatJSON    | One JSON object per line, no ANSI escapes              | Fiber logger format (prod) |
| LogTimeFormatJSON| "2006-01-02T15:04:05.000Z"                             | Prod log time format (UTC) |
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

  // LLM Model defaults
  const (
      DefaultModel            = "opencode-go/deepseek-v4-flash"
      DefaultServiceJWTSecret = "default-service-jwt-secret"
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
| DEFAULT_MODEL     | "opencode-go/deepseek-v4-flash"                        | DefaultModel                  |
| ENCRYPTION_KEY    | Required, exactly 32 ASCII chars                       | No default — must be set      |
+-------------------+--------------------------------------------------------+-------------------------------+

  Provider API keys and base URLs removed from server-level config.
  They are now per-user settings stored encrypted in the database.

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

  // SQL Queries (constants/db/postgres.go — full surface, by domain)
  // Users:
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
      QueryGetUserByID = `... WHERE id = $1 ...`
  )

  // Sessions & messages: QueryCreateSession, QueryListSessions, QueryGetSession,
  //   QueryPinSessionStrategyVersion, QueryTouchSession, QueryDeleteSession,
  //   QueryUpdateContextSummary, QueryUpdateSessionTitleAndSummary,
  //   QueryGetSessionMessages, QueryInsertMessageWithStatus,
  //   QueryInsertAssistantPlaceholder, QueryUpdateMessageContent,
  //   QueryUpdateMessageStatus, QueryMarkSessionStreamingInterrupted,
  //   QueryGetSessionTokenCount, QueryGetMaxTurnNumber,
  //   QueryDeleteMessagesUpToTurn, QueryInsertMessage, QueryUpdateSessionUpdatedAt
  // Settings: QueryGetAppSetting, QueryUpsertAppSetting
  // Preferences: QueryUpsertPreferences, QueryGetPreferences
  // Features: QueryListActiveFeatures, QueryGetFeatureByID
  // API keys: QueryCreateApiKey, QueryGetApiKeyByHash, QueryGetApiKeysByUser,
  //   QueryListApiKeys, QueryRevokeApiKey, QueryGetApiKeyByID
  // Lifecycle: QueryScanSessionsForConsolidation, QueryScanSessionsForArchive,
  //   QueryDeleteMessagesForArchivedSessions, QueryScanSessionsForDeprecate

Package: routes - Route Paths
------------------------------

  // File: internal/constants/routes/v1.go

  const (
      V1APIPrefix = "/api/v1"
      V1AuthGroup = "/auth"

      V1PathHealth     = "/health"
      V1PathRegister   = "/register"
      V1PathLogin      = "/login"
      V1PathMe         = "/me"
      V1PathLogout     = "/logout"
      V1PathChat       = "/chat"
      V1PathSkills     = "/skills"
      V1PathModels     = "/models"
      V1PathFeatures   = "/features"
      V1PathStrategies = "/strategies"
      V1PathSettings   = "/settings"

      V1PathSettingsDefaults = "/settings/defaults"

      V1AdminGroup = "/admin"

      V1InternalGroup = "/internal"
      V1PathDocs      = "/docs"
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
| constants/config | defaults.go     | DefaultPort, DefaultJWTSecret, DefaultDatabaseURL, |
|                  |                 | DefaultModel, etc.                                 |
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
