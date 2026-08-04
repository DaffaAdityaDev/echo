package router

import (
	"context"
	"log"


	"echo-backend/internal/constants/app"
	"echo-backend/internal/constants/routes"
	"echo-backend/internal/database"
	"echo-backend/internal/handler/handlerutil"
	authhdl "echo-backend/internal/handler/auth"
	adminhdl "echo-backend/internal/handler/admin"
	chathdl "echo-backend/internal/handler/chat"
	featureshdl "echo-backend/internal/handler/features"
	memhdl "echo-backend/internal/handler/memory"
	aimodelhdl "echo-backend/internal/handler/aimodel"
	sessionhdl "echo-backend/internal/handler/session"
	setthdl "echo-backend/internal/handler/settings"
	strathdl "echo-backend/internal/handler/strategy"
	"echo-backend/internal/handler/llmops"
	"echo-backend/internal/middleware"
	"echo-backend/internal/models/config"
	authrepo "echo-backend/internal/repository/auth"
	adminrepo "echo-backend/internal/repository/admin"
	featuresrepo "echo-backend/internal/repository/features"
	propsrepo "echo-backend/internal/repository/llmops/module/props"
	sessrepo "echo-backend/internal/repository/session"
	setrepo "echo-backend/internal/repository/settings"
	authsvc "echo-backend/internal/service/auth"
	consolid "echo-backend/internal/service/consolidation"
	llmopsSvc "echo-backend/internal/service/llmops"
	aimodelSvc "echo-backend/internal/service/aimodel"
	featuressvc "echo-backend/internal/service/features"
	settsvc "echo-backend/internal/service/settings"
	stratsvc "echo-backend/internal/service/strategy"
	"echo-backend/internal/worker"

	"github.com/gofiber/fiber/v3"
)

func SetupRoutes(fbApp *fiber.App, cfg *cfgmodel.Config) {
	// 1. Initialize Infrastructure
	pool := database.NewPostgresPool(cfg)
	rdb := database.NewRedisClient(cfg)

	if pool != nil {
		if err := database.Migrate(pool); err != nil {
			log.Printf("⚠️ Warning: Database auto-migration error: %v", err)
		}
	}

	// 2. Initialize Repositories
	userRepo := authrepo.NewRepository(pool)
	sessionRepo := sessrepo.NewRepository(pool)
	apiKeyRepo := adminrepo.NewRepository(pool)
	settingsRepo := setrepo.NewRepository(pool)
	featuresRepo := featuresrepo.NewRepository(pool)

	// 3. Initialize Services
	authSvc := authsvc.NewService(cfg, userRepo)
	settingsSvc := settsvc.NewService(cfg, settingsRepo)
	aimodelSvcInstance := aimodelSvc.NewService(cfg, settingsSvc)
	consolidationSvc := consolid.NewService(cfg, sessionRepo)
	strategySvc := stratsvc.NewService(cfg, settingsRepo, rdb)
	featuresSvc := featuressvc.NewService(cfg, rdb, featuresRepo)

	// 4. Initialize Handlers
	authHandler := authhdl.NewHandler(cfg, authSvc)
	chatHandler := chathdl.NewHandler(cfg, rdb, aimodelSvcInstance, sessionRepo, consolidationSvc, strategySvc, featuresSvc)
	sessionHandler := sessionhdl.NewHandler(cfg, sessionRepo, consolidationSvc, aimodelSvcInstance, strategySvc)
	aimodelHandler := aimodelhdl.NewHandler(aimodelSvcInstance)
	strategyHandler := strathdl.NewHandler(strategySvc)
	featuresHandler := featureshdl.NewHandler(featuresSvc)
	adminHandler := adminhdl.NewHandler(cfg, apiKeyRepo)
	memoryHandler := memhdl.NewHandler(rdb, pool)
	settingsHandler := setthdl.NewHandler(cfg, settingsSvc)

	// 5. Initialize Lifecycle Worker
	lifecycleWorker := worker.NewLifecycleWorker(cfg, sessionRepo, settingsSvc, consolidationSvc, strategySvc, rdb)
	go lifecycleWorker.Start(context.Background())



	// 5. Initialize LLMOps Module
	llmopsPromptRepo := propsrepo.NewRepository(pool)

	llmopsPromptSvc := llmopsSvc.NewPromptService(llmopsPromptRepo)

	llmopsPlaygroundSvc := llmopsSvc.NewPlaygroundService(aimodelSvcInstance, cfg.AgentHTTPURL, cfg.InternalAuthToken)

	llmopsPromptHandler := llmops.NewPromptHandler(llmopsPromptSvc)
	llmopsStudioHandler := llmops.NewStudioHandler(llmopsPlaygroundSvc)

	// Global Health Check
	fbApp.Get(routes.V1PathHealth, func(c fiber.Ctx) error {
		return handlerutil.RespondSuccess(c, fiber.Map{
			"status":  app.HealthStatus,
			"message": app.HealthMessage,
		})
	})

	fbApp.Get("/", func(c fiber.Ctx) error {
		return c.Redirect().To("/api/docs")
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
	api.Get("/missions/:missionId/stream", chatHandler.StreamMissionLogs)
	api.Post("/missions/:id/approve", middleware.AuthRequired(cfg.JWTSecret), chatHandler.HandleApproveTool)
	api.Post("/missions/:id/deny", middleware.AuthRequired(cfg.JWTSecret), chatHandler.HandleDenyTool)
	api.Get(routes.V1PathModels, middleware.AuthRequired(cfg.JWTSecret), aimodelHandler.HandleGetModels)
	api.Get(routes.V1PathFeatures, featuresHandler.HandleGetFeatures)
	api.Get(routes.V1PathStrategies, middleware.AuthRequired(cfg.JWTSecret), strategyHandler.HandleGetStrategies)


	// Settings routes
	api.Get(routes.V1PathSettingsDefaults, settingsHandler.HandleGetDefaults)
	api.Get(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleGetSettings)
	api.Put(routes.V1PathSettings, middleware.AuthRequired(cfg.JWTSecret), settingsHandler.HandleUpdateSettings)

	// Session routes
	sessionsGroup := api.Group("/sessions", middleware.AuthRequired(cfg.JWTSecret))
	sessionsGroup.Post("", sessionHandler.HandleCreateSession)
	sessionsGroup.Get("", sessionHandler.HandleListSessions)
	sessionsGroup.Get("/:id", sessionHandler.HandleGetSession)
	sessionsGroup.Patch("/:id", sessionHandler.HandleUpdateSession)
	sessionsGroup.Get("/:id/messages", sessionHandler.HandleGetSessionMessages)
	sessionsGroup.Delete("/:id", sessionHandler.HandleDeleteSession)
	sessionsGroup.Post("/:id/generate-title", sessionHandler.HandleGenerateTitle)

	// Admin routes (user JWT or API key required)
	adminGroup := api.Group(routes.V1AdminGroup, middleware.AuthOrAPIKeyRequired(cfg, apiKeyRepo))
	adminGroup.Get("/api-keys", adminHandler.HandleListKeys)
	adminGroup.Post("/api-keys", adminHandler.HandleCreateKey)
	adminGroup.Delete("/api-keys/:id", adminHandler.HandleRevokeKey)
	adminGroup.Get("/stats", adminHandler.HandleStats)

	// LLMOps Studio Routes
	studio := api.Group("/studio")

	prompts := studio.Group("/prompts")
	prompts.Get("", llmopsPromptHandler.HandleListTemplates)
	prompts.Get("/", llmopsPromptHandler.HandleListTemplates)
	prompts.Post("", middleware.RequireRoles("admin", "prompt_engineer", "product_manager"), llmopsPromptHandler.HandleCreateTemplate)
	prompts.Post("/", middleware.RequireRoles("admin", "prompt_engineer", "product_manager"), llmopsPromptHandler.HandleCreateTemplate)
	prompts.Get("/active", llmopsPromptHandler.HandleGetActivePrompt)
	prompts.Get("/:id/versions", llmopsPromptHandler.HandleListVersions)
	prompts.Get("/:id/versions/:v", llmopsPromptHandler.HandleGetVersion)
	prompts.Post("/:id/versions", middleware.RequireRoles("admin", "prompt_engineer"), llmopsPromptHandler.HandleCreateVersion)
	prompts.Post("/:id/promote/:version", middleware.RequireRoles("admin", "product_manager", "admin_bisnis"), llmopsPromptHandler.HandlePromote)
	prompts.Post("/:id/rollback/:version", middleware.RequireRoles("admin", "product_manager", "admin_bisnis"), llmopsPromptHandler.HandleRollback)

	studio.Post("/playground", middleware.AuthRequired(cfg.JWTSecret), llmopsStudioHandler.HandleRunPlayground)

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
