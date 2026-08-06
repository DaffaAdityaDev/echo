package worker

import (
	"echo-backend/internal/models/config"
	"testing"
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
