package chat

import (
	"strings"
	"sync"
	"time"

	"echo-backend/internal/models/config"

	"echo-backend/internal/repository/session"
	"echo-backend/internal/service/aimodel"
	"echo-backend/internal/service/consolidation"
	featuresvc "echo-backend/internal/service/features"
	settsvc "echo-backend/internal/service/settings"
	stratSvc "echo-backend/internal/service/strategy"

	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/trace"
)

// Per-session in-process mutexes serialize chat turns on the same session.
// Refcounted so a lock entry is deleted once no goroutine uses it anymore:
// the old sync.Map grew unboundedly (one entry per session ever used), and a
// naive delete-after-unlock races with a goroutine that already fetched the
// mutex and is queued on Lock.
type sessionLockEntry struct {
	mu   sync.Mutex
	refs int
}

var (
	sessionLocksMu sync.Mutex
	sessionLocks   = make(map[string]*sessionLockEntry)
)

func acquireSessionLock(sessionID string) func() {
	if sessionID == "" {
		return func() {}
	}
	sessionLocksMu.Lock()
	entry := sessionLocks[sessionID]
	if entry == nil {
		entry = &sessionLockEntry{}
		sessionLocks[sessionID] = entry
	}
	entry.refs++
	sessionLocksMu.Unlock()

	entry.mu.Lock()
	return func() {
		entry.mu.Unlock()
		sessionLocksMu.Lock()
		entry.refs--
		if entry.refs == 0 {
			delete(sessionLocks, sessionID)
		}
		sessionLocksMu.Unlock()
	}
}

func retryDBOperation(attempts int, delay time.Duration, fn func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		err = fn()
		if err == nil {
			return nil
		}
		if i < attempts-1 {
			time.Sleep(delay * time.Duration(1<<i))
		}
	}
	return err
}

type Handler struct {
	Cfg              *cfgmodel.Config
	RedisClient      *redis.Client
	HonoAPIURL       string
	ModelSvc         *aimodel.Service
	SessionRepo      *session.Repository
	ConsolidationSvc *consolidation.Service
	StrategySvc      *stratSvc.Service
	FeaturesSvc      *featuresvc.Service
	SettingsSvc      *settsvc.Service
}

func NewHandler(
	cfg *cfgmodel.Config,
	rdb *redis.Client,
	modelSvc *aimodel.Service,
	sessionRepo *session.Repository,
	consolidationSvc *consolidation.Service,
	strategySvc *stratSvc.Service,
	featuresSvc *featuresvc.Service,
	settingsSvc *settsvc.Service,
) *Handler {
	return &Handler{
		Cfg:              cfg,
		RedisClient:      rdb,
		HonoAPIURL:       cfg.AgentHTTPURL,
		ModelSvc:         modelSvc,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
		StrategySvc:      strategySvc,
		FeaturesSvc:      featuresSvc,
		SettingsSvc:      settingsSvc,
	}
}

type HistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the payload for a single chat turn.
type ChatRequest struct {
	// Message is the user's chat message. First message in a session.
	Message string `json:"message" binding:"required" example:"Build a REST API with Express"`
	// SessionID is an optional session ID. Omit to start a new session (the
	// backend creates it and returns its ID in the X-Session-ID response
	// header). Include to continue an existing session.
	SessionID string `json:"sessionId" example:"sess_abc123"`
	// Model is an optional model override. When set, it takes precedence over
	// the user's default model. Clients without user identity (e.g. the Discord
	// bot's per-channel selection) use this.
	Model string `json:"model" example:"nvidia/nemotron-3-nano-4b"`
	// Mode is an optional agent mode override. When set, it takes precedence
	// over the user's default mode.
	Mode string `json:"mode" example:"agent"`
}

func parseTraceparent(tp string) (trace.SpanContext, bool) {
	if !strings.HasPrefix(tp, "00-") {
		return trace.SpanContext{}, false
	}
	parts := strings.Split(tp, "-")
	if len(parts) < 3 {
		return trace.SpanContext{}, false
	}
	traceID, err := trace.TraceIDFromHex(parts[1])
	if err != nil {
		return trace.SpanContext{}, false
	}
	spanID, err := trace.SpanIDFromHex(parts[2])
	if err != nil {
		return trace.SpanContext{}, false
	}
	return trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	}), true
}
