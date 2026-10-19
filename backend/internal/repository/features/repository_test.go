package features

import (
	"context"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/pkg/testdb"
)

func TestFeatureRepository(t *testing.T) {
	pool := testdb.OpenPool(t)
	ctx := context.Background()

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
		if f.Status != domainconst.StatusActive {
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
}
