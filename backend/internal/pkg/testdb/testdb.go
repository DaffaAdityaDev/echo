// Package testdb opens the Postgres pool shared by repository integration
// tests, skipping the calling test when no database is configured or reachable.
package testdb

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"echo-backend/internal/config"
	envconst "echo-backend/internal/constants/env"
	msgconst "echo-backend/internal/constants/msg"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	connectTimeout = 5 * time.Second
	maxConns       = 10
	minConns       = 2
)

// OpenPool returns a pool for DATABASE_URL (falling back to the module-root
// .env) that is closed on test cleanup. It skips the test in -short mode or
// when the database is unavailable.
func OpenPool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	loadModuleDotEnv(t)
	dbURL := os.Getenv(envconst.DatabaseURL)
	if dbURL == "" {
		t.Skipf(msgconst.MsgSkipIntegrationTest, envconst.DatabaseURL)
	}

	poolCfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Failed to parse database config, skipping: %v", err)
	}
	poolCfg.MaxConns = maxConns
	poolCfg.MinConns = minConns

	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		t.Skipf("Failed to create connection pool, skipping: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database unreachable, skipping integration test: %v", err)
	}
	return pool
}

func loadModuleDotEnv(t testing.TB) {
	t.Helper()
	root, err := moduleRoot()
	if err != nil {
		t.Logf("module root not found, relying on process env: %v", err)
		return
	}
	if err := config.LoadDotEnv(filepath.Join(root, ".env")); err != nil && !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("load .env: %v", err)
	}
}

func moduleRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}
