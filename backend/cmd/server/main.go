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
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	envconst "echo-backend/internal/constants/env"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/database"
	pkglogger "echo-backend/internal/pkg/logger"
	"echo-backend/internal/router"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		slog.Info(msgconst.MsgNoEnvFile)
	}
	pkglogger.Init(os.Getenv(envconst.Environment))
	pkglogger.EnableLoki(os.Getenv(envconst.LokiURL))

	// Load configuration
	cfg := config.Load()

	if err := config.ValidateSecrets(cfg); err != nil {
		slog.Error(msgconst.ErrRefuseToStart, "err", err)
		os.Exit(1)
	}

	fmt.Println(app.Banner)

	// Run database migration before serving traffic
	if pool := database.NewPostgresPool(cfg); pool != nil {
		if err := database.Migrate(pool); err != nil {
			slog.Warn(msgconst.WarnDBAutoMigration, "err", err)
		}
		pool.Close()
	}

	// Initialize server
	appInstance := fiber.New(fiber.Config{
		AppName:      app.Name,
		ErrorHandler: errorHandler,
	})

	// Middleware
	appInstance.Use(recover.New(recover.Config{
		EnableStackTrace: true,
		StackTraceHandler: func(_ fiber.Ctx, e any) {
			slog.Error(msgconst.ErrPanicRecovered, msgconst.ComponentKey, msgconst.ComponentServer, "panic", fmt.Sprintf("%v", e), "stack", string(debug.Stack()))
		},
	}))

	// Access log: human-friendly with colors in dev, machine-readable JSON
	// without ANSI escapes in production. When the Loki sink is enabled the
	// line is tee'd to it in JSON, console format included.
	logFormat, logTimeFormat, disableColors := app.LogFormat, app.LogTimeFormat, false
	var logOutput io.Writer = os.Stdout
	if strings.EqualFold(cfg.Environment, domainconst.Production) {
		logFormat, logTimeFormat, disableColors = app.LogFormatJSON, app.LogTimeFormatJSON, true
	}
	if lokiOutput := pkglogger.LokiWriter(); lokiOutput != nil {
		logFormat, logTimeFormat, disableColors = app.LogFormatJSON, app.LogTimeFormatJSON, true
		logOutput = io.MultiWriter(os.Stdout, lokiOutput)
	}
	appInstance.Use(logger.New(logger.Config{
		Format:        logFormat,
		TimeFormat:    logTimeFormat,
		DisableColors: disableColors,
		Stream:        logOutput,
	}))
	appInstance.Use(cors.New(cors.Config{
		AllowOrigins:     corsAllowedOrigins(),
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{httpxconst.HeaderOrigin, httpxconst.HeaderContentType, httpxconst.HeaderAccept, authconst.HeaderAuthorization, httpxconst.HeaderTraceparent, httpxconst.HeaderAgentSessionID},
		AllowCredentials: true,
	}))

	// Routes
	router.SetupRoutes(appInstance, cfg)

	// Start
	slog.Info(msgconst.MsgServerStarting, "port", cfg.Port)
	if err := appInstance.Listen(":" + cfg.Port); err != nil {
		slog.Error(msgconst.ErrServerStartup, "err", err)
		os.Exit(1)
	}
}

// errorHandler renders handler errors as JSON without clobbering a response
// body that a handler already wrote (RespondErrorDetail writes and returns a
// non-nil error). Plain errors become a generic 500, matching fiber defaults.
func errorHandler(c fiber.Ctx, err error) error {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		if len(c.Response().Body()) > 0 {
			return nil
		}
		return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message, "details": ""})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"error":   "Internal Server Error",
		"details": "",
	})
}

// corsAllowedOrigins returns the browser origins allowed to call the API with
// credentials (cookie auth), from CORS_ALLOWED_ORIGINS (comma-separated).
// Wildcards cannot be combined with credentialed requests, so the default is
// restricted to local development origins.
func corsAllowedOrigins() []string {
	raw := strings.TrimSpace(envOrDefault(envconst.CORSAllowedOrigins, "http://localhost:3000,http://127.0.0.1:3000"))
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
