package worker

import (
	"testing"
	"time"

	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"
)

func TestNewLifecycleWorker(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{
		WorkerInterval:      "15m",
		DecayDeprecateAfter: 30,
		DecayArchiveAfter:   90,
	}

	w := NewLifecycleWorker(cfg, nil, nil, nil, nil, nil)
	if w == nil {
		t.Fatal("Expected NewLifecycleWorker to return non-nil instance")
	}
}

func TestScanLockTTL_AlwaysPositiveAndBelowLongIntervals(t *testing.T) {
	t.Parallel()

	tests := []struct {
		interval time.Duration
		want     time.Duration
	}{
		{interval: 15 * time.Minute, want: 15*time.Minute - 5*time.Second},
		{interval: 6 * time.Second, want: 3 * time.Second},
		{interval: 5 * time.Second, want: 2500 * time.Millisecond},
		{interval: 2 * time.Second, want: time.Second},
		{interval: 500 * time.Millisecond, want: time.Second},
	}
	for _, tt := range tests {
		if got := scanLockTTL(tt.interval); got != tt.want {
			t.Errorf("scanLockTTL(%s) = %s, want %s", tt.interval, got, tt.want)
		}
	}
}

func TestConsolidationProviderConfig_StripsOpenCodePrefix(t *testing.T) {
	t.Parallel()

	prefs := &usermodel.UserPreferences{
		ProviderType: "opencode-go",
		BaseURL:      "https://opencode.ai/zen/go/v1",
		DefaultModel: "opencode-go/deepseek-v4-flash",
		APIKey:       "key",
	}

	got := consolidationProviderConfig(prefs)
	if got["model"] != "deepseek-v4-flash" {
		t.Fatalf("expected provider prefix stripped, got %v", got["model"])
	}
	if got["api_key"] != "key" {
		t.Fatalf("expected api key forwarded, got %v", got["api_key"])
	}
}
