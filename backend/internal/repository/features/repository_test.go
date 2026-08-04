package features

import (
	"bufio"
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestFeatureRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	if f, err := os.Open("../../.env"); err == nil {
		defer func() { _ = f.Close() }()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				if _, ok := os.LookupEnv(key); !ok {
					_ = os.Setenv(key, val)
				}
			}
		}
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	connCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Skipf("Failed to parse database config, skipping: %v", err)
	}
	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(connCtx, poolCfg)
	if err != nil {
		t.Skipf("Failed to create connection pool, skipping: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(connCtx); err != nil {
		t.Skipf("Database unreachable, skipping integration test: %v", err)
	}

	repo := NewRepository(pool)

	active, err := repo.ListActive(ctx)
	if err != nil {
		t.Fatalf("Failed to list active features: %v", err)
	}
	if len(active) < 3 {
		t.Fatalf("Expected at least 3 seeded features, got %d", len(active))
	}

	byID := map[string]string{}
	for _, f := range active {
		byID[f.ID] = f.TierRequirement
		if f.Status != "active" {
			t.Errorf("Expected status 'active' for %s, got %q", f.ID, f.Status)
		}
	}
	if byID["delegate_task"] != "pro" {
		t.Errorf("Expected delegate_task tier 'pro', got %q", byID["delegate_task"])
	}
	if byID["web_search"] != "free" {
		t.Errorf("Expected web_search tier 'free', got %q", byID["web_search"])
	}
	if byID["write_todos"] != "free" {
		t.Errorf("Expected write_todos tier 'free', got %q", byID["write_todos"])
	}

	feat, err := repo.GetByID(ctx, "web_search")
	if err != nil {
		t.Fatalf("Failed to get feature by ID: %v", err)
	}
	if feat == nil {
		t.Fatal("Expected web_search feature, got nil")
	}
	if feat.Name != "Web Search" {
		t.Errorf("Expected name 'Web Search', got %q", feat.Name)
	}
	if len(feat.UISchema) == 0 {
		t.Error("Expected ui_schema to be populated")
	}

	missing, err := repo.GetByID(ctx, "no_such_feature")
	if err != nil {
		t.Fatalf("Failed to query missing feature: %v", err)
	}
	if missing != nil {
		t.Errorf("Expected nil for missing feature, got %+v", missing)
	}
}
