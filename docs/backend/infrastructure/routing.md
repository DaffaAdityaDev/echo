================================================================================
  Routing - Route Definitions & Group Versioning
================================================================================
  Module    : Routing
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-27
================================================================================

Overview
--------

The Router uses Fiber Group for API versioning (/api/v1). All routes are
registered in SetupRoutes(), which also serves as the central dependency
injection point connecting infrastructure, repositories, services, and
handlers. Each handler domain lives in its own sub-package and is imported
with a short alias (e.g. authhdl, chathdl).

File Structure
--------------

+------------------------------------------------+--------------------------------------------+
| Path                                           | Description                                |
+------------------------------------------------+--------------------------------------------+
| internal/router/router.go                      | Route definitions & DI wiring              |
| internal/constants/routes/v1.go                | Route path constants                       |
+------------------------------------------------+--------------------------------------------+

Route Table
-----------

+--------+-----------------------------------------------------+----------------------------+------+-----------------+
| Method | Path                                                | Handler                    | Auth | Description     |
+--------+-----------------------------------------------------+----------------------------+------+-----------------+
| GET    | /health                                             | Inline                     | No   | Health check    |
| POST   | /api/v1/auth/register                               | authhdl.HandleRegister     | No   | Register        |
| POST   | /api/v1/auth/login                                  | authhdl.HandleLogin        | No   | Login           |
| GET    | /api/v1/auth/me                                     | authhdl.HandleMe           | Yes  | Current user    |
| POST   | /api/v1/auth/logout                                 | authhdl.HandleLogout       | Yes  | Logout          |
| POST   | /api/v1/chat                                        | chathdl.HandleChat         | Yes  | Chat/stream     |
| GET    | /api/v1/skills                                      | chathdl.HandleGetSkills    | No   | Skill catalog   |
| GET    | /api/v1/models                                      | modelhdl.HandleGetModels   | Yes  | Model listing   |
| GET    | /api/v1/features                                    | chathdl.HandleGetFeatures  | No   | Feature catalog |
| POST   | /api/v1/sessions                                    | sessionhdl.HandleCreate    | Yes  | Create session  |
| GET    | /api/v1/sessions                                    | sessionhdl.HandleList      | Yes  | List sessions   |
| GET    | /api/v1/sessions/:id                                | sessionhdl.HandleGet       | Yes  | Get session     |
| PATCH  | /api/v1/sessions/:id                                | sessionhdl.HandleUpdate    | Yes  | Update session  |
| DELETE | /api/v1/sessions/:id                                | sessionhdl.HandleDelete    | Yes  | Delete session  |
| POST   | /api/v1/sessions/:id/generate-title                 | sessionhdl.HandleGenTitle  | Yes  | Generate title  |
| GET    | /api/v1/admin/api-keys                              | adminhdl.HandleListKeys    | Yes  | List API keys   |
| POST   | /api/v1/admin/api-keys                              | adminhdl.HandleCreateKey   | Yes  | Create API key  |
| DELETE | /api/v1/admin/api-keys/:id                          | adminhdl.HandleRevokeKey   | Yes  | Revoke API key  |
| GET    | /api/v1/admin/stats                                 | adminhdl.HandleStats       | Yes  | Admin stats     |
+--------+-----------------------------------------------------+----------------------------+------+-----------------+

DI Wiring Flow
--------------

  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      // 1. Infrastructure
      pool := database.NewPostgresPool(cfg)
      rdb  := database.NewRedisClient(cfg)

      // 2. Repositories (sub-packages)
      userRepo     := authrepo.NewRepository(pool)
      sessionRepo  := sessrepo.NewRepository(pool)
      apiKeyRepo   := adminrepo.NewRepository(pool)
      settingsRepo := setrepo.NewRepository(pool)

      // 3. Services (sub-packages)
      authSvc := authsvc.NewService(cfg, userRepo)
      modelSvc := modelsvc.NewService(cfg, settingsSvc)
      consolidationSvc := consolid.NewService(cfg, sessionRepo)
      settingsSvc := settsvc.NewService(cfg, settingsRepo)

      // 4. Handlers (sub-packages)
      authHandler    := authhdl.NewHandler(cfg, authSvc)
      chatHandler    := chathdl.NewHandler(cfg, rdb, modelSvc, sessionRepo, consolidationSvc)
      sessionHandler := sessionhdl.NewHandler(cfg, sessionRepo, consolidationSvc, modelSvc)
      modelHandler   := modelhdl.NewHandler(modelSvc)
      adminHandler   := adminhdl.NewHandler(cfg, apiKeyRepo)
      memoryHandler  := memhdl.NewHandler(rdb, pool)
      settingsHandler := setthdl.NewHandler(cfg, settingsSvc)

      // 5. Routes...
  }

Route Grouping
--------------

  /
  ├── /health                          (global, no prefix)
  │
  └── /api/v1                          (V1APIPrefix)
      ├── /auth                        (V1AuthGroup)
      │   ├── POST /register
      │   ├── POST /login
      │   ├── GET  /me
      │   └── POST /logout
      │
      ├── POST /chat
      ├── GET  /skills
      ├── GET  /models
      ├── GET  /features
      │
      ├── /sessions                    (AuthRequired group)
      │   ├── POST /
      │   ├── GET  /
      │   ├── GET  /:id
      │   ├── PATCH /:id
      │   ├── DELETE /:id
      │   └── POST /:id/generate-title
      │
      ├── /admin/api-keys              (AuthOrAPIKeyRequired group)
      │   ├── GET  /
      │   ├── POST /
      │   └── DELETE /:id
      │
      ├── /studio                      (LLMOps)
      │   └── POST /playground
      │
      └── /internal                    (InternalAuthRequired group)
          ├── /sessions/:id/prune
          └── /memory/...

Path Constants
--------------

  // constants/routes/v1.go
  const (
      V1APIPrefix = "/api/v1"
      V1AuthGroup = "/auth"
      V1AdminGroup = "/admin"
      V1InternalGroup = "/internal"

      V1PathHealth   = "/health"
      V1PathRegister = "/register"
      V1PathLogin    = "/login"
      V1PathMe       = "/me"
      V1PathLogout   = "/logout"
      V1PathChat     = "/chat"
      V1PathSkills   = "/skills"
      V1PathModels   = "/models"
      V1PathFeatures = "/features"
      V1PathSettings         = "/settings"
      V1PathSettingsDefaults = "/settings/defaults"
  )

Middleware Binding
------------------

Global middleware (recover, logger, CORS) is registered in server.go before
SetupRoutes. Route-level middleware is applied per group.

  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      api := fbApp.Group(routes.V1APIPrefix)

      // Public auth routes
      authGrp := api.Group(routes.V1AuthGroup)
      authGrp.Post(routes.V1PathRegister, authHandler.HandleRegister)
      authGrp.Post(routes.V1PathLogin, authHandler.HandleLogin)

      // Protected routes
      api.Post(routes.V1PathChat, middleware.AuthRequired(cfg.JWTSecret), chatHandler.HandleChat)

      // Admin routes (JWT or API key)
      adminGroup := api.Group(routes.V1AdminGroup, middleware.AuthOrAPIKeyRequired(cfg, apiKeyRepo))

      // Internal routes (service JWT)
      internalGroup := api.Group(routes.V1InternalGroup, middleware.InternalAuthRequired(cfg))
  }

Entry Points & Exports
----------------------

+----------------------+----------+----------------------------+
| Symbol               | Kind     | Path                       |
+----------------------+----------+----------------------------+
| SetupRoutes(fbApp,   | Function | router/router.go           |
| cfg)                 |          |                            |
+----------------------+----------+----------------------------+

Dependencies
------------

+----------------------+-------------------------------------------+
| Dependency           | Used For                                  |
+----------------------+-------------------------------------------+
| github.com/gofiber/  | Router, group, context                    |
| fiber/v3             |                                           |
| database             | DB/Redis access                           |
| handler/*            | HTTP handlers (sub-packages)              |
| service/*            | Business logic (sub-packages)             |
| repository/*         | Data access (sub-packages)                |
| middleware           | Auth, CORS, logging middleware            |
+----------------------+-------------------------------------------+

Source References
-----------------

- internal/router/router.go - Full route setup
- internal/constants/routes/v1.go - Route path constants
- internal/handler/*/handler.go - Handler implementations

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
