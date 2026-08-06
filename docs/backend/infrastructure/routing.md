================================================================================
  Routing - Route Definitions & Group Versioning
================================================================================
  Module    : Routing
  Service   : backend
  Version   : 1.1
  Updated   : 2026-08-05
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
| GET    | /                                                   | Inline (redirect)          | No   | → /api/docs     |
| GET    | /api/docs                                           | Inline                     | No   | Scalar API UI   |
| GET    | /api/docs/openapi.json                              | Inline                     | No   | OpenAPI spec    |
| POST   | /api/v1/auth/register                               | authhdl.HandleRegister     | No   | Register        |
| POST   | /api/v1/auth/login                                  | authhdl.HandleLogin        | No   | Login           |
| GET    | /api/v1/auth/me                                     | authhdl.HandleMe           | Yes  | Current user    |
| POST   | /api/v1/auth/logout                                 | authhdl.HandleLogout       | Yes  | Logout          |
| POST   | /api/v1/chat                                        | chathdl.HandleChat         | Yes  | Chat/stream     |
| GET    | /api/v1/skills                                      | chathdl.HandleGetSkills    | No   | Skill catalog   |
| GET    | /api/v1/missions/:missionId/stream                  | chathdl.StreamMissionLogs  | Yes  | Mission log SSE |
| POST   | /api/v1/missions/:id/approve                        | chathdl.HandleApproveTool  | Yes  | HITL approve    |
| POST   | /api/v1/missions/:id/deny                           | chathdl.HandleDenyTool     | Yes  | HITL deny       |
| GET    | /api/v1/models                                      | aimodelhdl.HandleGetModels | Yes  | Model listing   |
| GET    | /api/v1/features                                    | featureshdl.HandleGetFeatures | No  | Feature catalog |
| GET    | /api/v1/strategies                                  | strathdl.HandleGetStrategies | Yes | Strategy catalog|
| GET    | /api/v1/settings/defaults                           | setthdl.HandleGetDefaults  | No   | Default settings|
| GET    | /api/v1/settings                                    | setthdl.HandleGetSettings  | Yes  | Get settings    |
| PUT    | /api/v1/settings                                    | setthdl.HandleUpdateSettings | Yes | Update settings |
| POST   | /api/v1/sessions                                    | sessionhdl.HandleCreateSession | Yes | Create session|
| GET    | /api/v1/sessions                                    | sessionhdl.HandleListSessions | Yes | List sessions |
| GET    | /api/v1/sessions/:id                                | sessionhdl.HandleGetSession | Yes  | Get session     |
| PATCH  | /api/v1/sessions/:id                                | sessionhdl.HandleUpdateSession | Yes | Update session |
| GET    | /api/v1/sessions/:id/messages                       | sessionhdl.HandleGetSessionMessages | Yes | Session messages |
| DELETE | /api/v1/sessions/:id                                | sessionhdl.HandleDeleteSession | Yes | Delete session |
| POST   | /api/v1/sessions/:id/generate-title                 | sessionhdl.HandleGenerateTitle | Yes | Generate title|
| GET    | /api/v1/admin/api-keys                              | adminhdl.HandleListKeys    | Yes  | List API keys   |
| POST   | /api/v1/admin/api-keys                              | adminhdl.HandleCreateKey   | Yes  | Create API key  |
| DELETE | /api/v1/admin/api-keys/:id                          | adminhdl.HandleRevokeKey   | Yes  | Revoke API key  |
| GET    | /api/v1/admin/stats                                 | adminhdl.HandleStats       | Yes  | Admin stats     |
| GET    | /api/v1/studio/prompts                              | llmops.NewPromptHandler    | Yes  | List templates  |
| POST   | /api/v1/studio/prompts                              | llmops.NewPromptHandler    | Yes  | Create template |
| GET    | /api/v1/studio/prompts/active                       | llmops.NewPromptHandler    | Yes  | Active prompt   |
| GET    | /api/v1/studio/prompts/:id/versions                 | llmops.NewPromptHandler    | Yes  | List versions   |
| GET    | /api/v1/studio/prompts/:id/versions/:v              | llmops.NewPromptHandler    | Yes  | Get version     |
| POST   | /api/v1/studio/prompts/:id/versions                 | llmops.NewPromptHandler    | Yes  | Create version  |
| POST   | /api/v1/studio/prompts/:id/promote/:version         | llmops.NewPromptHandler    | Yes  | Promote version |
| POST   | /api/v1/studio/prompts/:id/rollback/:version        | llmops.NewPromptHandler    | Yes  | Rollback version|
| POST   | /api/v1/internal/sessions/:id/prune                 | sessionhdl.HandlePruneSession | Int | Prune session |
| POST   | /api/v1/internal/memory/episodic/store              | memhdl.HandleStoreEpisodic | Int  | Store episodic  |
| POST   | /api/v1/internal/memory/episodic/recall             | memhdl.HandleGetEpisodic   | Int  | Recall episodic  |
| POST   | /api/v1/internal/memory/semantic/store              | memhdl.HandleStoreSemantic | Int  | Store semantic  |
| POST   | /api/v1/internal/memory/semantic/search             | memhdl.HandleSemanticSearch | Int | Search semantic |
| POST   | /api/v1/internal/memory/procedural/store            | memhdl.HandleStoreProcedural | Int | Store procedural|
| POST   | /api/v1/internal/memory/procedural/get              | memhdl.HandleGetProcedural | Int  | Get procedural  |
| GET    | /api/v1/internal/prompts/active                     | llmops.NewAgentPromptHandler | Int | Agent active prompt |
+--------+-----------------------------------------------------+----------------------------+------+-----------------+

Auth legend: `No` public · `Yes` JWT (`AuthRequired`) · `Int` service JWT
(`InternalAuthRequired`). Admin group uses `AuthOrAPIKeyRequired`. Studio
prompt mutating routes additionally use `RequireRoles("admin",
"prompt_engineer", ...)`.

DI Wiring Flow
--------------

  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      // 1. Infrastructure
      pool := database.NewPostgresPool(cfg)
      rdb  := database.NewRedisClient(cfg)
      if pool != nil { database.Migrate(pool) }   // auto-migrate at startup

      // 2. Repositories (sub-packages)
      userRepo     := authrepo.NewRepository(pool)
      sessionRepo  := sessrepo.NewRepository(pool)
      apiKeyRepo   := adminrepo.NewRepository(pool)
      settingsRepo := setrepo.NewRepository(pool)
      featuresRepo := featuresrepo.NewRepository(pool)

      // 3. Services (sub-packages)
      authSvc          := authsvc.NewService(cfg, userRepo)
      settingsSvc      := settsvc.NewService(cfg, settingsRepo)
      aimodelSvc       := aimodelSvc.NewService(cfg, settingsSvc)
      consolidationSvc := consolid.NewService(cfg, sessionRepo)
      strategySvc      := stratsvc.NewService(cfg, settingsRepo, rdb)
      featuresSvc      := featuressvc.NewService(cfg, rdb, featuresRepo)

      // 4. Handlers (sub-packages)
      authHandler     := authhdl.NewHandler(cfg, authSvc)
      chatHandler     := chathdl.NewHandler(cfg, rdb, aimodelSvc, sessionRepo,
                           consolidationSvc, strategySvc, featuresSvc)
      sessionHandler  := sessionhdl.NewHandler(cfg, sessionRepo, consolidationSvc,
                           aimodelSvc, strategySvc)
      aimodelHandler  := aimodelhdl.NewHandler(aimodelSvc)
      strategyHandler := strathdl.NewHandler(strategySvc)
      featuresHandler := featureshdl.NewHandler(featuresSvc)
      adminHandler    := adminhdl.NewHandler(cfg, apiKeyRepo)
      memoryHandler   := memhdl.NewHandler(rdb, pool)
      settingsHandler := setthdl.NewHandler(cfg, settingsSvc)

      // 5. Lifecycle worker (consolidation, archive, deprecate)
      lifecycleWorker := worker.NewLifecycleWorker(cfg, sessionRepo, settingsSvc,
                           consolidationSvc, strategySvc, rdb)
      go lifecycleWorker.Start(context.Background())

      // 6. LLMOps module
      llmopsPromptRepo        := propsrepo.NewRepository(pool)
      llmopsPromptSvc         := llmopsSvc.NewPromptService(llmopsPromptRepo, rdb)
      llmopsPromptHandler     := llmops.NewPromptHandler(llmopsPromptSvc)
      llmopsAgentPromptHandler := llmops.NewAgentPromptHandler(llmopsPromptSvc)

      // 7. Routes...
  }

Route Grouping
--------------

  /
  ├── /health                          (global, no prefix)
  ├── /                                (redirect → /api/docs)
  ├── /api/docs                        (Scalar UI)
  ├── /api/docs/openapi.json           (OpenAPI spec)
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
      ├── GET  /missions/:missionId/stream
      ├── POST /missions/:id/approve
      ├── POST /missions/:id/deny
      ├── GET  /models
      ├── GET  /features
      ├── GET  /strategies
      ├── GET  /settings/defaults
      ├── GET  /settings
      ├── PUT  /settings
      │
      ├── /sessions                    (AuthRequired group)
      │   ├── POST /
      │   ├── GET  /
      │   ├── GET  /:id
      │   ├── PATCH /:id
      │   ├── GET  /:id/messages
      │   ├── DELETE /:id
      │   └── POST /:id/generate-title
      │
      ├── /admin                       (AuthOrAPIKeyRequired group)
      │   ├── GET  /api-keys
      │   ├── POST /api-keys
      │   ├── DELETE /api-keys/:id
      │   └── GET  /stats
      │
      ├── /studio                      (LLMOps)
      │   └── /prompts                 (RequireRoles on mutations)
      │       ├── GET  /
      │       ├── POST /
      │       ├── GET  /active
      │       ├── GET  /:id/versions
      │       ├── GET  /:id/versions/:v
      │       ├── POST /:id/versions
      │       ├── POST /:id/promote/:version
      │       └── POST /:id/rollback/:version
      │
      └── /internal                    (InternalAuthRequired group)
          ├── /sessions/:id/prune
          ├── GET  /prompts/active
          └── /memory
              ├── POST /episodic/store
              ├── POST /episodic/recall
              ├── POST /semantic/store
              ├── POST /semantic/search
              ├── POST /procedural/store
              └── POST /procedural/get

Path Constants
--------------

  // constants/routes/v1.go
  const (
      V1APIPrefix = "/api/v1"
      V1AuthGroup = "/auth"

      V1PathHealth   = "/health"
      V1PathRegister = "/register"
      V1PathLogin    = "/login"
      V1PathMe       = "/me"
      V1PathLogout   = "/logout"
      V1PathChat     = "/chat"
      V1PathSkills   = "/skills"
      V1PathModels   = "/models"
      V1PathFeatures = "/features"
      V1PathStrategies = "/strategies"
      V1PathSettings         = "/settings"
      V1PathSettingsDefaults = "/settings/defaults"

      V1AdminGroup    = "/admin"
      V1InternalGroup = "/internal"
      V1PathDocs      = "/docs"
  )

Middleware Binding
------------------

Global middleware (recover, logger, CORS) is registered in main.go before
SetupRoutes. Route-level middleware is applied per group.

  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      api := fbApp.Group(routes.V1APIPrefix)

      // Public auth routes
      authGrp := api.Group(routes.V1AuthGroup)
      authGrp.Post(routes.V1PathRegister, authHandler.HandleRegister)
      authGrp.Post(routes.V1PathLogin, authHandler.HandleLogin)
      authGrp.Get(routes.V1PathMe, middleware.AuthRequired(cfg.JWTSecret), authHandler.HandleMe)
      authGrp.Post(routes.V1PathLogout, middleware.AuthRequired(cfg.JWTSecret), authHandler.HandleLogout)

      // Protected routes
      api.Post(routes.V1PathChat, middleware.AuthRequired(cfg.JWTSecret), chatHandler.HandleChat)
      api.Get(routes.V1PathStrategies, middleware.AuthRequired(cfg.JWTSecret), strategyHandler.HandleGetStrategies)
      api.Get(routes.V1PathSettingsDefaults, settingsHandler.HandleGetDefaults)
      api.Get(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleGetSettings)
      api.Put(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleUpdateSettings)

      // Admin routes (JWT or API key)
      adminGroup := api.Group(routes.V1AdminGroup, middleware.AuthOrAPIKeyRequired(cfg, apiKeyRepo))

      // Internal routes (service JWT)
      internalGroup := api.Group(routes.V1InternalGroup, middleware.InternalAuthRequired(cfg))
      internalGroup.Get("/prompts/active", llmopsAgentPromptHandler.HandleGetAgentActivePrompt)
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

- internal/router/router.go:42-205 - Full route setup (DI wiring 42-93, docs 96-130, API v1 routes 133-204)
- internal/constants/routes/v1.go:3-25 - Route path constants
- internal/handler/*/handler.go - Handler implementations
- cmd/server/main.go:70-74 - Global middleware (recover, logger, CORS)

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
