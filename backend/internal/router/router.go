package router

import (
	"echo-backend/internal/constants/app"
	"echo-backend/internal/constants/routes"
	"echo-backend/internal/database"
	"echo-backend/internal/handler"
	"echo-backend/internal/middleware"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/internal/service"

	"github.com/gofiber/fiber/v3"
)

func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
	// 1. Initialize Infrastructure
	pool := database.NewPostgresPool(cfg)
	rdb := database.NewRedisClient(cfg)

	// 2. Initialize Repositories
	userRepo := repository.NewUserRepository(pool)
	sessionRepo := repository.NewSessionRepository(pool)
	apiKeyRepo := repository.NewApiKeyRepository(pool)

	// 3. Initialize Services
	authSvc := service.NewAuthService(cfg, userRepo)
	modelSvc := service.NewModelService(cfg)
	settingsRepo := repository.NewSettingsRepository(pool)
	settingsSvc := service.NewSettingsService(cfg, settingsRepo)
	consolidationSvc := service.NewConsolidationService(cfg, sessionRepo)

	// 4. Initialize Handlers
	authHandler := &handler.AuthHandler{Cfg: cfg, AuthSvc: authSvc}
	chatHandler := &handler.ChatHandler{Cfg: cfg, RedisClient: rdb, HonoAPIURL: cfg.AgentHTTPURL, ModelSvc: modelSvc, SessionRepo: sessionRepo, ConsolidationSvc: consolidationSvc}
	sessionHandler := &handler.SessionHandler{Cfg: cfg, SessionRepo: sessionRepo, ConsolidationSvc: consolidationSvc}
	modelHandler := &handler.ModelHandler{ModelSvc: modelSvc}
	adminHandler := handler.NewAdminHandler(cfg, apiKeyRepo)
	memoryHandler := handler.NewMemoryHandler(rdb, pool)
	settingsHandler := &handler.SettingsHandler{Cfg: cfg, SettingsSvc: settingsSvc}

	// Global Health Check
	fbApp.Get(routes.V1PathHealth, func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  app.HealthStatus,
			"message": app.HealthMessage,
		})
	})

	// API Documentation (Scalar UI & OpenAPI spec)
	fbApp.Get("/api/docs/openapi.json", func(c fiber.Ctx) error {
		c.Set("Content-Type", "application/json; charset=utf-8")
		return c.SendFile("./api/docs/swagger.json")
	})

	fbApp.Get("/api/docs", func(c fiber.Ctx) error {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.SendString(`<!doctype html>
<html>
  <head>
    <title>Echo Backend API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/docs/openapi.json">
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`)
	})

	// API v1 Routes
	api := fbApp.Group(routes.V1APIPrefix)

	// Auth routes
	authGrp := api.Group(routes.V1AuthGroup)
	authGrp.Post(routes.V1PathRegister, authHandler.HandleRegister)
	authGrp.Post(routes.V1PathLogin, authHandler.HandleLogin)
	authGrp.Get(routes.V1PathMe, middleware.AuthRequired(cfg.JWTSecret), authHandler.HandleMe)
	authGrp.Post(routes.V1PathLogout, middleware.AuthRequired(cfg.JWTSecret), authHandler.HandleLogout)

	// Feature routes
	api.Post(routes.V1PathChat, middleware.AuthRequired(cfg.JWTSecret), chatHandler.HandleChat)
	api.Get(routes.V1PathSkills, chatHandler.HandleGetSkills)
	api.Get("/v1/missions/:missionId/stream", chatHandler.StreamMissionLogs)
	api.Get(routes.V1PathModels, modelHandler.HandleGetModels)
	api.Get(routes.V1PathFeatures, chatHandler.HandleGetFeatures)

	// Settings routes
	api.Get(routes.V1PathSettingsDefaults, settingsHandler.HandleGetDefaults)
	api.Get(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleGetSettings)
	api.Put(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleUpdateSettings)

	// Session routes
	sessionsGroup := api.Group("/sessions", middleware.AuthRequired(cfg.JWTSecret))
	sessionsGroup.Post("", sessionHandler.HandleCreateSession)
	sessionsGroup.Get("", sessionHandler.HandleListSessions)
	sessionsGroup.Get("/:id", sessionHandler.HandleGetSession)
	sessionsGroup.Get("/:id/messages", sessionHandler.HandleGetSessionMessages)
	sessionsGroup.Delete("/:id", sessionHandler.HandleDeleteSession)

	// Admin routes (user JWT or API key required)
	adminGroup := api.Group(routes.V1AdminGroup, middleware.AuthOrAPIKeyRequired(cfg, apiKeyRepo))
	adminGroup.Get("/api-keys", adminHandler.HandleListKeys)
	adminGroup.Post("/api-keys", adminHandler.HandleCreateKey)
	adminGroup.Delete("/api-keys/:id", adminHandler.HandleRevokeKey)
	adminGroup.Get("/stats", adminHandler.HandleStats)

	// Internal routes (service JWT required)
	internalGroup := api.Group(routes.V1InternalGroup, middleware.InternalAuthRequired(cfg))
	
	internalSessionsGroup := internalGroup.Group("/sessions")
	internalSessionsGroup.Post("/:id/prune", sessionHandler.HandlePruneSession)

	memoryGroup := internalGroup.Group("/memory")
	memoryGroup.Post("/episodic/store", memoryHandler.HandleStoreEpisodic)
	memoryGroup.Post("/episodic/recall", memoryHandler.HandleGetEpisodic)
	memoryGroup.Post("/semantic/store", memoryHandler.HandleStoreSemantic)
	memoryGroup.Post("/semantic/search", memoryHandler.HandleSemanticSearch)
	memoryGroup.Post("/procedural/store", memoryHandler.HandleStoreProcedural)
	memoryGroup.Post("/procedural/get", memoryHandler.HandleGetProcedural)
}
