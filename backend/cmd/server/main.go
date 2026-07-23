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

import (
	"bufio"
	"echo-backend/internal/config"
	"echo-backend/internal/constants/app"
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
	// Load .env file
	if f, err := os.Open(".env"); err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				if _, ok := os.LookupEnv(key); !ok {
					os.Setenv(key, val)
				}
			}
		}
	} else {
		log.Println(app.MsgNoEnvFile)
	}

	// Load configuration
	cfg := config.Load()

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
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "traceparent", "x-agent-session-id"},
	}))

	// Routes
	router.SetupRoutes(appInstance, cfg)

	// Start
	log.Printf("Server starting on port %s", cfg.Port)
	if err := appInstance.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("%s: %v", app.ErrServerStartup, err)
	}
}



