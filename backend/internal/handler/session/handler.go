package session

import (
	"context"
	"strconv"

	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
)

type SessionRepo interface {
	CreateSession(ctx context.Context, userID int, title string, strategyVersion string) (*chatmodel.Session, error)
	GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
	ListByUser(ctx context.Context, userID int, limit int, offset int) ([]*chatmodel.Session, error)
	GetSessionMessages(ctx context.Context, sessionID string, limit int, offset int) ([]*chatmodel.Message, error)
	UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error
	GetSessionTokenCount(ctx context.Context, sessionID string) (int, error)
	CountByUser(ctx context.Context, userID int) (int, error)
	CountMessagesBySession(ctx context.Context, sessionID string) (int, error)
}

type ConsolidationSvc interface {
	CheckThreshold(ctx context.Context, sessionID string) (bool, error)
	TriggerConsolidation(ctx context.Context, sessionID string, providerConfig map[string]interface{}) error
}

// parseNonNegativeInt parses a query int, defaulting to 0 and clamping
// negative values so they never reach SQL as LIMIT/OFFSET (which 500s).
func parseNonNegativeInt(s string) int {
	val, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	if val < 0 {
		return 0
	}
	return val
}

type ModelSvc interface {
	ResolveProviderConfig(userID int, modelID string) (*aitype.ProviderConfig, error)
}

type StrategySvc interface {
	IsValidVersion(ctx context.Context, version string) bool
}

type Handler struct {
	Cfg              *cfgmodel.Config
	SessionRepo      SessionRepo
	ConsolidationSvc ConsolidationSvc
	ModelSvc         ModelSvc
	StrategySvc      StrategySvc
}

func NewHandler(cfg *cfgmodel.Config, sessionRepo SessionRepo, consolidationSvc ConsolidationSvc, modelSvc ModelSvc, strategySvc ...StrategySvc) *Handler {
	h := &Handler{
		Cfg:              cfg,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
		ModelSvc:         modelSvc,
	}
	if len(strategySvc) > 0 {
		h.StrategySvc = strategySvc[0]
	}
	return h
}

type CreateSessionRequest struct {
	Title           string `json:"title" example:"Build a REST API with Express"`
	StrategyVersion string `json:"strategyVersion,omitempty" example:"nlah:v1"`
}

type PaginationMeta struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

type ListSessionsResponse struct {
	Sessions   []*chatmodel.Session `json:"sessions"`
	Pagination PaginationMeta       `json:"pagination"`
}

type GetMessagesResponse struct {
	Messages   []*chatmodel.Message `json:"messages"`
	Pagination PaginationMeta       `json:"pagination"`
}
