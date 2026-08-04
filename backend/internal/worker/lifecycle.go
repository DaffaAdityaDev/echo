package worker

import (
	"context"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/session"
	"echo-backend/internal/service/consolidation"
	"echo-backend/internal/service/settings"
	"echo-backend/internal/service/strategy"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type Worker struct {
	cfg              *cfgmodel.Config
	sessionRepo      *session.Repository
	settingsSvc      *settings.Service
	consolidationSvc *consolidation.Service
	strategySvc      *strategy.Service
	rdb              *redis.Client
}

func NewLifecycleWorker(
	cfg *cfgmodel.Config,
	sessionRepo *session.Repository,
	settingsSvc *settings.Service,
	consolidationSvc *consolidation.Service,
	strategySvc *strategy.Service,
	rdb *redis.Client,
) *Worker {
	return &Worker{
		cfg:              cfg,
		sessionRepo:      sessionRepo,
		settingsSvc:      settingsSvc,
		consolidationSvc: consolidationSvc,
		strategySvc:      strategySvc,
		rdb:              rdb,
	}
}

func (w *Worker) Start(ctx context.Context) {
	interval, err := time.ParseDuration(w.cfg.WorkerInterval)
	if err != nil || interval <= 0 {
		interval = 15 * time.Minute
	}

	log.Printf("[LIFECYCLE] Worker started with interval %s", interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[LIFECYCLE] Worker shutting down...")
			return
		case <-ticker.C:
			w.runCycle(ctx, interval)
		}
	}
}

func (w *Worker) runCycle(ctx context.Context, interval time.Duration) {
	if w.rdb != nil {
		lockKey := "lifecycle:scan_lock"
		acquired, err := w.rdb.SetNX(ctx, lockKey, "locked", interval-5*time.Second).Result()
		if err != nil || !acquired {
			log.Println("[LIFECYCLE] Cycle skipped: lock not acquired or another replica running")
			return
		}
	}

	log.Println("[LIFECYCLE] Starting maintenance cycle")

	w.runConsolidationJob(ctx)

	w.runDecayAndGCJob(ctx)

	w.runCacheRefreshJob(ctx)

	log.Println("[LIFECYCLE] Maintenance cycle completed")
}

func (w *Worker) runConsolidationJob(ctx context.Context) {
	idleWindow := 30 * time.Minute
	idleBefore := time.Now().Add(-idleWindow)
	sessions, err := w.sessionRepo.ScanSessionsForConsolidation(ctx, idleBefore, w.cfg.PRUNE_THRESHOLD, 50)
	if err != nil {
		log.Printf("[LIFECYCLE] Consolidation scan error: %v", err)
		return
	}

	for _, sess := range sessions {
		userPrefs, err := w.settingsSvc.GetSettingsInternal(ctx, sess.UserID)
		if err != nil || userPrefs == nil {
			log.Printf("[LIFECYCLE] Skip session %s: provider config resolution failed for user %d", sess.ID, sess.UserID)
			continue
		}

		providerMap := map[string]interface{}{
			"type":     userPrefs.ProviderType,
			"base_url": userPrefs.BaseURL,
			"model":    userPrefs.DefaultModel,
		}
		if userPrefs.APIKey != "" {
			providerMap["api_key"] = userPrefs.APIKey
		}

		log.Printf("[LIFECYCLE] Consolidating idle session %s (token count: %d)", sess.ID, sess.TokenCount)
		cCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if err := w.consolidationSvc.TriggerConsolidation(cCtx, sess.ID, providerMap); err != nil {
			log.Printf("[LIFECYCLE] Consolidation failed for session %s: %v", sess.ID, err)
		}
		cancel()
	}
}

func (w *Worker) runDecayAndGCJob(ctx context.Context) {
	deprecateDays := w.cfg.DecayDeprecateAfter
	if deprecateDays <= 0 {
		deprecateDays = 30
	}
	archiveDays := w.cfg.DecayArchiveAfter
	if archiveDays <= 0 {
		archiveDays = 90
	}

	deprecateCutoff := time.Now().AddDate(0, 0, -deprecateDays)
	archiveCutoff := time.Now().AddDate(0, 0, -archiveDays)

	deprecatedIDs, err := w.sessionRepo.ScanSessionsForDeprecate(ctx, deprecateCutoff, archiveCutoff)
	if err != nil {
		log.Printf("[LIFECYCLE] Deprecated scan error: %v", err)
	} else if len(deprecatedIDs) > 0 {
		log.Printf("[LIFECYCLE] Evaluated stage-1 decay (derived deprecated) for %d sessions past %d days cutoff", len(deprecatedIDs), deprecateDays)
	}

	archivedIDs, err := w.sessionRepo.ScanSessionsForArchive(ctx, archiveCutoff)
	if err != nil {
		log.Printf("[LIFECYCLE] Archive scan error: %v", err)
	} else if len(archivedIDs) > 0 {
		log.Printf("[LIFECYCLE] Archived %d inactive sessions", len(archivedIDs))
	}


	gcRetentionDays := archiveDays + 30
	gcCutoff := time.Now().AddDate(0, 0, -gcRetentionDays)
	deletedMsgCount, err := w.sessionRepo.DeleteMessagesForArchivedSessions(ctx, gcCutoff)
	if err != nil {
		log.Printf("[LIFECYCLE] GC error: %v", err)
	} else if deletedMsgCount > 0 {
		log.Printf("[LIFECYCLE] GC deleted %d messages for retention-drained archived sessions", deletedMsgCount)
	}
}

func (w *Worker) runCacheRefreshJob(ctx context.Context) {
	if _, err := w.strategySvc.GetRollout(ctx); err != nil {
		log.Printf("[LIFECYCLE] Failed to refresh strategy rollout cache: %v", err)
	} else {
		log.Println("[LIFECYCLE] Refreshed strategy:rollout cache")
	}
}
