package router

import (
	"context"

	"echo-backend/internal/constants/app"
	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/routes"
	"echo-backend/internal/database"
	adminhdl "echo-backend/internal/handler/admin"
	aimodelhdl "echo-backend/internal/handler/aimodel"
	authhdl "echo-backend/internal/handler/auth"
	chathdl "echo-backend/internal/handler/chat"
	featureshdl "echo-backend/internal/handler/features"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/handler/llmops"
	memhdl "echo-backend/internal/handler/memory"
	sessionhdl "echo-backend/internal/handler/session"
	setthdl "echo-backend/internal/handler/settings"
	strathdl "echo-backend/internal/handler/strategy"
	"echo-backend/internal/middleware"
	"echo-backend/internal/models/config"
	adminrepo "echo-backend/internal/repository/admin"
	authrepo "echo-backend/internal/repository/auth"
	featuresrepo "echo-backend/internal/repository/features"
	propsrepo "echo-backend/internal/repository/llmops/module/props"
	sessrepo "echo-backend/internal/repository/session"
	setrepo "echo-backend/internal/repository/settings"
	aimodelSvc "echo-backend/internal/service/aimodel"
	authsvc "echo-backend/internal/service/auth"
	consolid "echo-backend/internal/service/consolidation"
	featuressvc "echo-backend/internal/service/features"
	llmopsSvc "echo-backend/internal/service/llmops"
	settsvc "echo-backend/internal/service/settings"
	stratsvc "echo-backend/internal/service/strategy"
	tiersvc "echo-backend/internal/service/tier"
	"echo-backend/internal/worker"

	"github.com/gofiber/fiber/v3"
)

func SetupRoutes(fbApp *fiber.App, cfg *cfgmodel.Config) {
	// 1. Initialize Infrastructure
	pool := database.NewPostgresPool(cfg)
	rdb := database.NewRedisClient(cfg)

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

	// Tier resolution for the auth middleware: per-request cache-aside lookup.
	tierSvc := tiersvc.NewService(tiersvc.NewRedisCache(rdb), userRepo)
	authRequired := middleware.AuthRequired(cfg.JWTSecret, tierSvc.Resolve)

	// 4. Initialize Handlers
	authHandler := authhdl.NewHandler(cfg, authSvc)
	chatHandler := chathdl.NewHandler(cfg, rdb, aimodelSvcInstance, sessionRepo, consolidationSvc, strategySvc, featuresSvc, settingsSvc)
	sessionHandler := sessionhdl.NewHandler(cfg, sessionRepo, consolidationSvc, aimodelSvcInstance, strategySvc)
	aimodelHandler := aimodelhdl.NewHandler(aimodelSvcInstance)
	strategyHandler := strathdl.NewHandler(strategySvc)
	featuresHandler := featureshdl.NewHandler(featuresSvc)
	adminHandler := adminhdl.NewHandler(cfg, apiKeyRepo)
	memoryHandler := memhdl.NewHandler(rdb, pool)
	settingsHandler := setthdl.NewHandler(cfg, settingsSvc)

	// 5. Initialize Lifecycle Worker
	lifecycleWorker := worker.NewLifecycleWorker(cfg, sessionRepo, settingsSvc, consolidationSvc, strategySvc, rdb)
	lifecycleCtx, lifecycleCancel := context.WithCancel(context.Background())
	fbApp.Hooks().OnPreShutdown(func() error { lifecycleCancel(); return nil })
	go lifecycleWorker.Start(lifecycleCtx)

	// 5. Initialize LLMOps Module
	llmopsPromptRepo := propsrepo.NewRepository(pool)

	llmopsPromptSvc := llmopsSvc.NewPromptService(llmopsPromptRepo, rdb)

	llmopsPromptHandler := llmops.NewPromptHandler(llmopsPromptSvc)
	llmopsAgentPromptHandler := llmops.NewAgentPromptHandler(llmopsPromptSvc)

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
		c.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSONCharsetUTF8)
		return c.SendFile("./api/docs/swagger.json")
	})

	fbApp.Get("/api/docs", func(c fiber.Ctx) error {
		c.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeHTMLCharsetUTF8)
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
	authGrp.Post(routes.V1PathRefresh, authHandler.HandleRefresh)
	authGrp.Get(routes.V1PathMe, authRequired, authHandler.HandleMe)
	authGrp.Post(routes.V1PathLogout, authHandler.HandleLogout)

	// Feature routes
	api.Post(routes.V1PathChat, authRequired, chatHandler.HandleChat)
	api.Get(routes.V1PathSkills, chatHandler.HandleGetSkills)
	api.Get(routes.V1PathModels, authRequired, aimodelHandler.HandleGetModels)
	api.Get(routes.V1PathFeatures, authRequired, featuresHandler.HandleGetFeatures)
	api.Get(routes.V1PathStrategies, authRequired, strategyHandler.HandleGetStrategies)

	// Settings routes
	api.Get(routes.V1PathSettingsDefaults, settingsHandler.HandleGetDefaults)
	api.Get(routes.V1PathSettings, authRequired, settingsHandler.HandleGetSettings)
	api.Put(routes.V1PathSettings, authRequired, settingsHandler.HandleUpdateSettings)

	// Session routes
	sessionsGroup := api.Group("/sessions", authRequired)
	sessionsGroup.Post("", sessionHandler.HandleCreateSession)
	sessionsGroup.Get("", sessionHandler.HandleListSessions)
	sessionsGroup.Get("/:id", sessionHandler.HandleGetSession)
	sessionsGroup.Patch("/:id", sessionHandler.HandleUpdateSession)
	sessionsGroup.Get("/:id/messages", sessionHandler.HandleGetSessionMessages)
	sessionsGroup.Delete("/:id", sessionHandler.HandleDeleteSession)
	sessionsGroup.Post("/:id/generate-title", sessionHandler.HandleGenerateTitle)
	sessionsGroup.Post("/:id/approve", chatHandler.HandleApproveTool)
	sessionsGroup.Post("/:id/deny", chatHandler.HandleDenyTool)
	sessionsGroup.Post("/:id/cancel", chatHandler.HandleInterrupt)

	// Admin routes (user JWT or API key required)
	adminGroup := api.Group(routes.V1AdminGroup, middleware.AuthOrAPIKeyRequired(cfg, apiKeyRepo))
	adminGroup.Get("/api-keys", adminHandler.HandleListKeys)
	adminGroup.Post("/api-keys", adminHandler.HandleCreateKey)
	adminGroup.Delete("/api-keys/:id", adminHandler.HandleRevokeKey)
	adminGroup.Get("/stats", adminHandler.HandleStats)

	// LLMOps Studio Routes
	studio := api.Group("/studio")

	prompts := studio.Group("/prompts")
	prompts.Get("", authRequired, llmopsPromptHandler.HandleListTemplates)
	prompts.Post("", authRequired, middleware.RequireRoles(domainconst.RoleAdmin, domainconst.RolePromptEngineer, domainconst.RoleProductManager), llmopsPromptHandler.HandleCreateTemplate)
	prompts.Get("/active", authRequired, llmopsPromptHandler.HandleGetActivePrompt)
	prompts.Get("/:id/versions", authRequired, llmopsPromptHandler.HandleListVersions)
	prompts.Get("/:id/versions/:v", authRequired, llmopsPromptHandler.HandleGetVersion)
	prompts.Post("/:id/versions", authRequired, middleware.RequireRoles(domainconst.RoleAdmin, domainconst.RolePromptEngineer), llmopsPromptHandler.HandleCreateVersion)
	prompts.Post("/:id/promote/:version", authRequired, middleware.RequireRoles(domainconst.RoleAdmin, domainconst.RoleProductManager, domainconst.RoleAdminBisnis), llmopsPromptHandler.HandlePromote)
	prompts.Post("/:id/rollback/:version", authRequired, middleware.RequireRoles(domainconst.RoleAdmin, domainconst.RoleProductManager, domainconst.RoleAdminBisnis), llmopsPromptHandler.HandleRollback)

	// Internal routes (service JWT required)
	internalGroup := api.Group(routes.V1InternalGroup, middleware.InternalAuthRequired(cfg))

	internalGroup.Get("/prompts/active", llmopsAgentPromptHandler.HandleGetAgentActivePrompt)

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
