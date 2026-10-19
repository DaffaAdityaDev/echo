package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"echo-backend/internal/config"
	domainconst "echo-backend/internal/constants/domain"
	envconst "echo-backend/internal/constants/env"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/database"
	authmodel "echo-backend/internal/models/auth"
	pkglogger "echo-backend/internal/pkg/logger"
	authrepo "echo-backend/internal/repository/auth"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	loadTest := flag.Bool("load-test", false, "Seed stress session + 50 bulk sessions (dev only, TRUNCATES sessions)")
	flag.Parse()

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

	ctx := context.Background()
	userRepo := authrepo.NewRepository(pool)

	adminPassword := os.Getenv(envconst.AdminPassword)
	if adminPassword == "" {
		slog.Error(fmt.Sprintf(msgconst.ErrAdminPasswordRequired, envconst.AdminPassword))
		os.Exit(1)
	}

	email := "admin@gmail.com"
	var adminUser *authmodel.User
	existingUser, err := userRepo.GetByEmail(ctx, email)
	if err != nil {
		slog.Error(msgconst.ErrCheckExistingUser, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}

	if existingUser != nil {
		slog.Info(msgconst.InfoUserAlreadyExists, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyEmail, email, msgconst.KeyUserID, existingUser.ID)
		adminUser = existingUser
	} else {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err != nil {
			slog.Error(msgconst.ErrHashPassword, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
			os.Exit(1)
		}

		adminUser = &authmodel.User{
			Email:        email,
			PasswordHash: string(hashedPassword),
			Name:         "Admin",
			Role:         domainconst.RoleAdmin,
			Tier:         domainconst.TierPro,
		}

		if err := userRepo.Create(ctx, adminUser); err != nil {
			slog.Error(msgconst.ErrSeedAdminUser, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
			os.Exit(1)
		}
		slog.Info(msgconst.InfoSeededDefaultAdmin, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyUserID, adminUser.ID)
	}

	if !*loadTest {
		slog.Info(msgconst.InfoSafeModeSkip, msgconst.ComponentKey, msgconst.ComponentSeed)
		slog.Info(msgconst.InfoDatabaseSeeded, msgconst.ComponentKey, msgconst.ComponentSeed)
		return
	}

	// ---- Load-test path (development only) ----

	if strings.EqualFold(cfg.Environment, domainconst.Production) {
		slog.Error(fmt.Sprintf(msgconst.ErrLoadTestInProduction, envconst.Environment))
		os.Exit(1)
	}

	fmt.Print("--load-test will TRUNCATE all sessions and messages. Type 'yes' to continue: ")
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Scan()
	if strings.TrimSpace(strings.ToLower(scanner.Text())) != "yes" {
		slog.Error(msgconst.ErrLoadTestAborted)
		os.Exit(1)
	}

	slog.Info(msgconst.InfoCleanupSessions, msgconst.ComponentKey, msgconst.ComponentSeed)
	if _, err := pool.Exec(ctx, "TRUNCATE TABLE sessions CASCADE"); err != nil {
		slog.Error(msgconst.ErrTruncateSessions, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		os.Exit(1)
	}
	slog.Info(msgconst.InfoSessionsTruncated, msgconst.ComponentKey, msgconst.ComponentSeed)

	seedStressSession(ctx, pool, adminUser.ID)
	seedBulkSessions(ctx, pool, adminUser.ID)

	slog.Info(msgconst.InfoLoadTestSeedingDone, msgconst.ComponentKey, msgconst.ComponentSeed)
}
