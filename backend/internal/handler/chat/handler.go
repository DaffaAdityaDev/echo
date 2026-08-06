package chat

import (
	"encoding/json"
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

var sessionLocks sync.Map

func acquireSessionLock(sessionID string) func() {
	if sessionID == "" {
		return func() {}
	}
	actual, _ := sessionLocks.LoadOrStore(sessionID, &sync.Mutex{})
	mu := actual.(*sync.Mutex)
	mu.Lock()
	return func() { mu.Unlock() }
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

func terminalPacket(raw string) bool {
	var p struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return false
	}
	return p.Type == "mission_completed" || p.Type == "error"
}

// Synthetic packet the stream emits after the replayed history segment, before
// the first live event. The recovery client switches from replay to live mode
// on it.
const replayDonePacket = `{"type":"replay_done"}`

// A stream with no recorded events after this window is treated as expired:
// no terminal packet will ever arrive, so close instead of blocking forever.
// Cancelled as soon as the first live event is received.
const missionStreamIdleTimeout = 5 * time.Second

// For a stream with recorded history but no terminal (agent died mid-run), a
// sliding window reset on each live event closes it after this much silence.
const missionStreamPartialIdleTimeout = 60 * time.Second

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

type ChatRequest struct {
	Message         string                 `json:"message"`
	Model           string                 `json:"model"`
	Mode            string                 `json:"mode"`
	StrategyVersion string                 `json:"strategyVersion,omitempty"`
	SessionID       string                 `json:"sessionId"`
	MissionID       string                 `json:"missionId"`
	History         []HistoryMessage       `json:"history"`
	Features        []string               `json:"features"`
	Skills          []string               `json:"skills"`
	Config          map[string]interface{} `json:"config,omitempty"`
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
