package worker

import (
	"context"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/session"
	"echo-backend/internal/service/consolidation"
	"echo-backend/internal/service/settings"
	"echo-backend/internal/service/strategy"
	"fmt"
	"log/slog"
	"runtime/debug"
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

	slog.Info(msgconst.InfoWorkerStarted, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyInterval, interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info(msgconst.InfoWorkerShuttingDown, msgconst.ComponentKey, msgconst.ComponentLifecycle)
			return
		case <-ticker.C:
			w.runCycleSafe(ctx, interval)
		}
	}
}

func (w *Worker) runCycleSafe(ctx context.Context, interval time.Duration) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error(msgconst.ErrCyclePanicRecovered, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyPanic, fmt.Sprintf("%v", r), msgconst.KeyStack, string(debug.Stack()))
		}
	}()
	w.runCycle(ctx, interval)
}

func (w *Worker) runCycle(ctx context.Context, interval time.Duration) {
	if w.rdb != nil {
		lockKey := "lifecycle:scan_lock"
		acquired, err := w.rdb.SetNX(ctx, lockKey, "locked", interval-5*time.Second).Result()
		if err != nil || !acquired {
			slog.Warn(msgconst.WarnCycleSkipped, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyReason, "lock not acquired or another replica running")
			return
		}
	}

	slog.Info(msgconst.InfoStartingMaintenanceCycle, msgconst.ComponentKey, msgconst.ComponentLifecycle)

	w.runConsolidationJob(ctx)

	w.runDecayAndGCJob(ctx)

	w.runCacheRefreshJob(ctx)

	slog.Info(msgconst.InfoMaintenanceCycleDone, msgconst.ComponentKey, msgconst.ComponentLifecycle)
}

func (w *Worker) runConsolidationJob(ctx context.Context) {
	idleWindow := 30 * time.Minute
	idleBefore := time.Now().Add(-idleWindow)
	sessions, err := w.sessionRepo.ScanSessionsForConsolidation(ctx, idleBefore, w.cfg.PRUNE_THRESHOLD, 50)
	if err != nil {
		slog.Error(msgconst.ErrConsolidationScan, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyErr, err)
		return
	}

	for _, sess := range sessions {
		userPrefs, err := w.settingsSvc.GetSettingsInternal(ctx, sess.UserID)
		if err != nil || userPrefs == nil {
			slog.Warn(msgconst.WarnSkipSessionProviderCfg, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeySessionID, sess.ID, msgconst.KeyUserID, sess.UserID)
			continue
		}

		providerMap := map[string]interface{}{
			"type":               userPrefs.ProviderType,
			"base_url":           userPrefs.BaseURL,
			"model":              userPrefs.DefaultModel,
			"max_context_tokens": aitype.ContextWindowFor(aitype.ProviderType(userPrefs.ProviderType), userPrefs.DefaultModel),
		}
		if userPrefs.APIKey != "" {
			providerMap["api_key"] = userPrefs.APIKey
		}

		slog.Info(msgconst.InfoConsolidatingIdleSession, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeySessionID, sess.ID, msgconst.KeyTokenCount, sess.TokenCount)
		cCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		if err := w.consolidationSvc.TriggerConsolidation(cCtx, sess.ID, providerMap); err != nil {
			slog.Error(msgconst.ErrConsolidationFailed, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeySessionID, sess.ID, msgconst.KeyErr, err)
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
		slog.Error(msgconst.ErrDeprecatedScan, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyErr, err)
	} else if len(deprecatedIDs) > 0 {
		slog.Info(msgconst.InfoEvaluatedStage1Decay, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeySessions, len(deprecatedIDs), msgconst.KeyCutoffDays, deprecateDays)
	}

	archivedIDs, err := w.sessionRepo.ScanSessionsForArchive(ctx, archiveCutoff)
	if err != nil {
		slog.Error(msgconst.ErrArchiveScan, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyErr, err)
	} else if len(archivedIDs) > 0 {
		slog.Info(msgconst.InfoArchivedInactiveSessions, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeySessions, len(archivedIDs))
	}

	gcRetentionDays := archiveDays + 30
	gcCutoff := time.Now().AddDate(0, 0, -gcRetentionDays)
	deletedMsgCount, err := w.sessionRepo.DeleteMessagesForArchivedSessions(ctx, gcCutoff)
	if err != nil {
		slog.Error(msgconst.ErrGCError, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyErr, err)
	} else if deletedMsgCount > 0 {
		slog.Info(msgconst.InfoGCDeletedMessages, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyMessages, deletedMsgCount)
	}
}

func (w *Worker) runCacheRefreshJob(ctx context.Context) {
	if _, err := w.strategySvc.GetRollout(ctx); err != nil {
		slog.Error(msgconst.ErrRefreshStrategyRollout, msgconst.ComponentKey, msgconst.ComponentLifecycle, msgconst.KeyErr, err)
	} else {
		slog.Info(msgconst.InfoRefreshedStrategyRollout, msgconst.ComponentKey, msgconst.ComponentLifecycle)
	}
}
