package main

import (
	"echo-backend/internal/config"
	envconst "echo-backend/internal/constants/env"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/database"
	pkglogger "echo-backend/internal/pkg/logger"
	"fmt"
	"log/slog"
	"os"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		slog.Info(msgconst.MsgNoEnvFileDev)
	}

	pkglogger.Init(os.Getenv(envconst.Environment))

	cfg := config.Load()

	pool := database.NewPostgresPool(cfg)
	if pool == nil {
		slog.Error(fmt.Sprintf(msgconst.ErrDatabaseURLNotSet, envconst.DatabaseURL))
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.Migrate(pool); err != nil {
		slog.Error(msgconst.ErrMigrationFailed, msgconst.KeyErr, err)
		os.Exit(1)
	}

	slog.Info(msgconst.InfoMigrationCompleted)
}
