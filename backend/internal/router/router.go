package router

import (
	"echo-backend/internal/constants/app"
	"echo-backend/internal/constants/routes"
	"echo-backend/internal/database"
	"echo-backend/internal/handler"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/internal/service"

	"github.com/gofiber/fiber/v3"
)

func SetupRoutes(fbApp *fiber.App, cfg *models.Config) {
	// 1. Initialize Infrastructure
	infra := database.NewInfrastructure(cfg)

	// 2. Initialize Repositories
	userRepo := repository.NewUserRepository(infra)

	// 3. Initialize Services
	authSvc := service.NewAuthService(cfg, userRepo)

	// 4. Initialize Handlers
	authHandler := handler.NewAuthHandler(cfg, authSvc)
	chatHandler := handler.NewChatHandler(cfg, infra.Redis)
	modelHandler := handler.NewModelHandler(cfg)

	// Global Health Check
	fbApp.Get(routes.V1PathHealth, func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  app.HealthStatus,
			"message": app.HealthMessage,
		})
	})

	// API v1 Routes
	api := fbApp.Group(routes.V1APIPrefix)

	// Auth routes
	authGrp := api.Group(routes.V1AuthGroup)
	authGrp.Post(routes.V1PathRegister, authHandler.HandleRegister)
	authGrp.Post(routes.V1PathLogin, authHandler.HandleLogin)

	// Feature routes
	api.Post(routes.V1PathChat, chatHandler.HandleChat)
	api.Get("/v1/missions/:missionId/stream", chatHandler.StreamMissionLogs)
	api.Get(routes.V1PathModels, modelHandler.HandleGetModels)
	api.Get(routes.V1PathFeatures, chatHandler.HandleGetFeatures)
}
