package main

import (
	"echo-backend/internal/config"
	"echo-backend/internal/database"
	pkglogger "echo-backend/internal/pkg/logger"
	"log/slog"
	"os"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		slog.Info("no .env file found, using system environment variables")
	}

	pkglogger.Init(os.Getenv("ENVIRONMENT"))

	cfg := config.Load()

	pool := database.NewPostgresPool(cfg)
	if pool == nil {
		slog.Error("DATABASE_URL not set or database pool initialization failed")
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.Migrate(pool); err != nil {
		slog.Error("migration failed", "err", err)
		os.Exit(1)
	}

	slog.Info("database migration completed successfully")
}
