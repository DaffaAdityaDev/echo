package main

// @title           Echo Backend API
// @version         1.0
// @description     Core API Server for Echo Platform providing Auth, Chat, Sessions, Models, Settings, Admin, Memory, and System Services.
// @termsOfService  https://echo.app/terms

// @contact.name    Echo API Support
// @contact.url     https://echo.app/support
// @contact.email   support@echo.app

// @license.name    Apache 2.0
// @license.url     http://www.apache.org/licenses/LICENSE-2.0.html

// @host            localhost:8080
// @BasePath        /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Bearer token authorization header (Format: Bearer <JWT>).

// @securityDefinitions.apikey InternalAuth
// @in header
// @name X-Internal-Token
// @description Internal service JWT token (Format: Bearer <service JWT>).

import (
	"echo-backend/internal/config"
	"echo-backend/internal/constants/app"
	"echo-backend/internal/database"
	"echo-backend/internal/router"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Println(app.MsgNoEnvFile)
	}

	// Load configuration
	cfg := config.Load()

	if err := config.ValidateSecrets(cfg); err != nil {
		log.Fatalf("Refusing to start: %v", err)
	}

	// Run database migration before serving traffic
	if pool := database.NewPostgresPool(cfg); pool != nil {
		if err := database.Migrate(pool); err != nil {
			log.Printf("Warning: Database auto-migration error: %v", err)
		}
		pool.Close()
	}

	// Initialize server
	appInstance := fiber.New(fiber.Config{
		AppName: app.Name,
	})

	// Middleware
	appInstance.Use(recover.New())
	appInstance.Use(logger.New(logger.Config{
		Format: app.LogFormat,
	}))
	appInstance.Use(cors.New(cors.Config{
		AllowOrigins:     corsAllowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "traceparent", "x-agent-session-id"},
		AllowCredentials: true,
	}))

	// Routes
	router.SetupRoutes(appInstance, cfg)

	// Start
	log.Printf("Server starting on port %s", cfg.Port)
	if err := appInstance.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("%s: %v", app.ErrServerStartup, err)
	}
}

// corsAllowedOrigins returns the browser origins allowed to call the API with
// credentials (cookie auth), from CORS_ALLOWED_ORIGINS (comma-separated).
// Wildcards cannot be combined with credentialed requests, so the default is
// restricted to local development origins.
func corsAllowedOrigins() []string {
	raw := strings.TrimSpace(envOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"))
	origins := []string{}
	for _, origin := range strings.Split(raw, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{"http://localhost:3000"}
	}
	return origins
}

func envOrDefault(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
