================================================================================
  Routing - Route Definitions & Group Versioning
================================================================================
  Module    : Routing
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Router uses Fiber Group for API versioning (/api/v1). All routes are
registered in SetupRoutes(), which also serves as the central dependency
injection point connecting infrastructure, repositories, services, and
handlers.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/router/router.go                | Route definitions & DI wiring              |
| internal/constants/routes/v1.go          | Route path constants                       |
+------------------------------------------+--------------------------------------------+

Route Table
-----------

+--------+-----------------------------------------------------+----------------------------+------+-----------------+
| Method | Path                                                | Handler                    | Auth | Description     |
+--------+-----------------------------------------------------+----------------------------+------+-----------------+
| GET    | /health                                             | Inline                     | No   | Health check    |
| POST   | /api/v1/auth/register                               | authHandler.HandleRegister | No   | Register (stub) |
| POST   | /api/v1/auth/login                                  | authHandler.HandleLogin    | No   | Login (mock)    |
| POST   | /api/v1/chat                                        | chatHandler.HandleChat     | No   | Chat/stream     |
| GET    | /api/v1/v1/missions/:missionId/stream               | chatHandler.StreamMission  | No   | SSE stream      |
|        |                                                     | Logs                       |      |                 |
| GET    | /api/v1/models                                      | modelHandler.HandleGetMod  | No   | Model listing   |
|        |                                                     | els                        |      |                 |
| GET    | /api/v1/features                                    | chatHandler.HandleGetFeat  | No   | Feature catalog |
|        |                                                     | ures                       |      |                 |
+--------+-----------------------------------------------------+----------------------------+------+-----------------+

NOTE: The stream route has a duplicated `/v1` prefix in the actual router
(router.go:49 uses `/v1/missions/:missionId/stream` within the `/api/v1`
group, resulting in `/api/v1/v1/missions/:missionId/stream`).

DI Wiring Flow
--------------

  func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
      // 1. Infrastructure
      infra := database.NewInfrastructure(cfg)

      // 2. Repositories
      userRepo := repository.NewUserRepository(infra)

      // 3. Services
      authSvc := service.NewAuthService(cfg, userRepo)
      modelSvc := service.NewModelService(cfg)

      // 4. Handlers
      authHandler := handler.NewAuthHandler(cfg, authSvc)
      chatHandler := handler.NewChatHandler(cfg, infra.Redis, modelSvc)
      modelHandler := handler.NewModelHandler(modelSvc)
      ...
  }

Route Grouping
--------------

  /
  ├── /health                          (global, no prefix)
  │
  └── /api/v1                          (V1APIPrefix)
      ├── /auth                        (V1AuthGroup)
      │   ├── POST /register           (V1PathRegister)
      │   └── POST /login              (V1PathLogin)
      │
      ├── POST /chat                   (V1PathChat)
      ├── GET  /v1/missions/:missionId/stream   (NOTE: extra /v1 in actual code)
      ├── GET  /models                 (V1PathModels)
      └── GET  /features               (V1PathFeatures)

Path Constants
--------------

  // constants/routes/v1.go
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

Middleware Binding
------------------

Global middleware (recover, logger, CORS) is registered in server.go before
SetupRoutes:

  // server.go
  fbApp.Use(recover.New())
  fbApp.Use(logger.New(...))
  fbApp.Use(cors.New(...))
  router.SetupRoutes(fbApp, cfg)

Auth middleware (AuthRequired) is not yet bound to a specific route group
(open for development). Planned binding:

  // Planned (when auth is implemented):
  authGrp := api.Group(routes.V1AuthGroup)
  authGrp.Post(routes.V1PathRegister, authHandler.HandleRegister)
  authGrp.Post(routes.V1PathLogin, authHandler.HandleLogin)

  protected := api.Group("", middleware.AuthRequired(cfg.JWTSecret))
  protected.Post(routes.V1PathChat, chatHandler.HandleChat)

Entry Points & Exports
----------------------

+----------------------+----------+---------------------------+
| Symbol               | Kind     | Path                      |
+----------------------+----------+---------------------------+
| SetupRoutes(fbApp,   | Function | router/router.go:15       |
| cfg)                 |          |                           |
+----------------------+----------+---------------------------+

Dependencies
------------

+----------------------+-------------------------------------------+
| Dependency           | Used For                                  |
+----------------------+-------------------------------------------+
| github.com/gofiber/  | Router, group, context                    |
| fiber/v3             |                                           |
| database.Infrastructure | Redis/DB access                       |
| repository.*         | Data access                               |
| service.*            | Business logic                            |
| handler.*            | HTTP handlers                             |
+----------------------+-------------------------------------------+

Source References
-----------------

- internal/router/router.go - Full route setup
- internal/constants/routes/v1.go - Route path constants

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
