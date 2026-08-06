package strategy

import (
	"context"
	"echo-backend/internal/models/config"
	"testing"
)

func TestService_GetDefaultRollout(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{
		StrategyRolloutDefault: 0.25,
	}

	svc := NewService(cfg, nil, nil)
	if got := svc.GetDefaultRollout(); got != 0.25 {
		t.Errorf("Expected GetDefaultRollout() to return 0.25, got %f", got)
	}

	svcNil := NewService(nil, nil, nil)
	if got := svcNil.GetDefaultRollout(); got != 0.1 {
		t.Errorf("Expected GetDefaultRollout() fallback to return 0.1, got %f", got)
	}
}

func TestService_IsValidVersion(t *testing.T) {
	t.Parallel()

	svc := NewService(nil, nil, nil)
	ctx := context.Background()

	// Empty string is valid (defaults to auto resolution)
	if !svc.IsValidVersion(ctx, "") {
		t.Error("Expected empty string to be valid")
	}
}

func TestService_ResolveVersion(t *testing.T) {
	t.Parallel()

	svc := NewService(nil, nil, nil)
	ctx := context.Background()

	// Pinned session strategy version returns pinned version directly
	res, err := svc.ResolveVersion(ctx, "standard:v1", DefaultStrategyVersion, 1)
	if err != nil {
		t.Fatalf("Unexpected error resolving pinned session: %v", err)
	}
	if res != "standard:v1" {
		t.Errorf("Expected pinned version 'standard:v1', got '%s'", res)
	}
}

func TestResolveVersion_ExplicitRequest(t *testing.T) {
	t.Parallel()

	catalog := []StrategyRegistryEntry{
		{Name: "standard", Versions: []StrategyVersionInfo{{Version: "standard:v1", Status: "active", Aliases: []string{"chat"}}}},
		{Name: "nlah", Versions: []StrategyVersionInfo{{Version: "nlah:v1", Status: "active", Aliases: []string{"agent"}}}},
		{Name: "deep_research", Versions: []StrategyVersionInfo{{Version: "deep_research:v1", Status: "deprecated", Aliases: []string{"research"}}}},
	}
	noRollouts := map[string]RolloutCfg{}

	tests := []struct {
		name      string
		requested string
		want      string
		wantErr   bool
	}{
		{name: "exact version", requested: "nlah:v1", want: "nlah:v1"},
		{name: "case-insensitive version", requested: "NLAH:v1", want: "nlah:v1"},
		{name: "alias match", requested: "agent", want: "nlah:v1"},
		{name: "alias case-insensitive", requested: "CHAT", want: "standard:v1"},
		{name: "unknown version rejected", requested: "garbage:v1", wantErr: true},
		{name: "deprecated version rejected", requested: "deep_research:v1", wantErr: true},
		{name: "empty request resolves to default without rollout config", requested: "", want: DefaultStrategyVersion},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := resolveVersion(catalog, noRollouts, 0.1, tt.requested, 42)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("Expected error for request %q, got version %q", tt.requested, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("Unexpected error for request %q: %v", tt.requested, err)
			}
			if got != tt.want {
				t.Errorf("Expected version %q, got %q", tt.want, got)
			}
		})
	}
}

func TestResolveVersion_Rollout(t *testing.T) {
	t.Parallel()

	catalog := []StrategyRegistryEntry{
		{Name: "standard", Versions: []StrategyVersionInfo{{Version: "standard:v1", Status: "active", Aliases: []string{"chat"}}}},
		{Name: "nlah", Versions: []StrategyVersionInfo{{Version: "nlah:v1", Status: "active", Aliases: []string{"agent"}}}},
	}

	t.Run("no rollout config never reroutes to unconfigured versions", func(t *testing.T) {
		t.Parallel()
		rollouts := map[string]RolloutCfg{}
		for userID := 0; userID < 100; userID++ {
			got, err := resolveVersion(catalog, rollouts, 0.1, "", userID)
			if err != nil {
				t.Fatalf("Unexpected error for user %d: %v", userID, err)
			}
			if got != DefaultStrategyVersion {
				t.Fatalf("User %d rerouted to %q with empty rollout config", userID, got)
			}
		}
	})

	t.Run("explicit rollout routes only the configured fraction", func(t *testing.T) {
		t.Parallel()
		r := 0.1
		rollouts := map[string]RolloutCfg{"nlah:v1": {Rollout: &r}}
		for userID := 0; userID < 100; userID++ {
			got, err := resolveVersion(catalog, rollouts, 0.1, "", userID)
			if err != nil {
				t.Fatalf("Unexpected error for user %d: %v", userID, err)
			}
			if userID%100 < 10 {
				if got != "nlah:v1" {
					t.Errorf("User %d expected canary nlah:v1, got %q", userID, got)
				}
			} else if got != DefaultStrategyVersion {
				t.Errorf("User %d expected default %q, got %q", userID, DefaultStrategyVersion, got)
			}
		}
	})

	t.Run("rollout 1.0 reaches 100% of new sessions", func(t *testing.T) {
		t.Parallel()
		r := 1.0
		rollouts := map[string]RolloutCfg{"nlah:v1": {Rollout: &r}}
		for userID := 0; userID < 100; userID++ {
			got, err := resolveVersion(catalog, rollouts, 0.1, "", userID)
			if err != nil {
				t.Fatalf("Unexpected error for user %d: %v", userID, err)
			}
			if got != "nlah:v1" {
				t.Errorf("User %d expected nlah:v1 at rollout 1.0, got %q", userID, got)
			}
		}
	})

	t.Run("entry without rollout value falls back to default rollout", func(t *testing.T) {
		t.Parallel()
		rollouts := map[string]RolloutCfg{"nlah:v1": {}}
		for userID := 0; userID < 100; userID++ {
			got, err := resolveVersion(catalog, rollouts, 0.25, "", userID)
			if err != nil {
				t.Fatalf("Unexpected error for user %d: %v", userID, err)
			}
			if userID%100 < 25 {
				if got != "nlah:v1" {
					t.Errorf("User %d expected canary nlah:v1, got %q", userID, got)
				}
			} else if got != DefaultStrategyVersion {
				t.Errorf("User %d expected default %q, got %q", userID, DefaultStrategyVersion, got)
			}
		}
	})

	t.Run("rollout zero excludes the version", func(t *testing.T) {
		t.Parallel()
		zero := 0.0
		rollouts := map[string]RolloutCfg{"nlah:v1": {Rollout: &zero}}
		for userID := 0; userID < 100; userID++ {
			got, err := resolveVersion(catalog, rollouts, 0.1, "", userID)
			if err != nil {
				t.Fatalf("Unexpected error for user %d: %v", userID, err)
			}
			if got != DefaultStrategyVersion {
				t.Errorf("User %d expected default %q at rollout 0, got %q", userID, DefaultStrategyVersion, got)
			}
		}
	})
}
