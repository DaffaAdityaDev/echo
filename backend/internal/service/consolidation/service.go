package consolidation

import (
	"bytes"
	"context"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"echo-backend/internal/pkg/historycap"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

type SessionRepo interface {
	GetSessionTokenCount(ctx context.Context, sessionID string) (int, error)
	GetMaxTurnNumber(ctx context.Context, sessionID string) (int, error)
	GetSessionMessagesOldestFirst(ctx context.Context, sessionID string, limit int) ([]*chatmodel.Message, error)
	GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error)
	PruneSession(ctx context.Context, sessionID string, newSummary string, pruneLimitTurn int) error
}

type Service struct {
	cfg         *cfgmodel.Config
	sessionRepo SessionRepo
}

func NewService(cfg *cfgmodel.Config, sessionRepo SessionRepo) *Service {
	return &Service{
		cfg:         cfg,
		sessionRepo: sessionRepo,
	}
}

// shouldSkip reports whether a session is too large to summarize. Summarizing
// astronomically large sessions (e.g. load-test sessions with millions of
// tokens) would exceed the provider context window and fail, so they are
// skipped instead of attempted. A threshold of 0 disables the guard.
func (s *Service) shouldSkip(tokenCount, skipThreshold int) bool {
	return skipThreshold > 0 && tokenCount > skipThreshold
}

// skipThresholdFor returns the token count above which consolidation is
// skipped. An explicit CONSOLIDATION_SKIP_TOKENS override wins; otherwise the
// threshold is derived from the model's context window (skip ratio), falling
// back to 200k when the window is unknown. A derived ratio of 0 disables the
// guard.
func (s *Service) skipThresholdFor(maxContextTokens int) int {
	if s.cfg.ConsolidationSkipTokens > 0 {
		return s.cfg.ConsolidationSkipTokens
	}
	if maxContextTokens <= 0 {
		return 200000
	}
	ratio := s.cfg.ConsolidationSkipRatio
	if ratio <= 0 {
		return 0
	}
	if ratio > 100 {
		ratio = 100
	}
	return maxContextTokens * ratio / 100
}

// payloadBudgetFor returns the token budget for the summarize payload. An
// explicit HISTORY_MAX_TOKENS override wins; otherwise the budget is derived
// from the model's context window (payload ratio), falling back to 50k when
// the window is unknown.
func (s *Service) payloadBudgetFor(maxContextTokens int) int {
	if s.cfg.HistoryMaxTokens > 0 {
		return s.cfg.HistoryMaxTokens
	}
	if maxContextTokens <= 0 {
		return 50000
	}
	ratio := s.cfg.SummarizePayloadRatio
	if ratio <= 0 {
		ratio = 60
	}
	if ratio > 100 {
		ratio = 100
	}
	return maxContextTokens * ratio / 100
}

// maxContextTokensFrom extracts the model context window from a provider
// config map ("max_context_tokens"), returning 0 when absent or unparsable.
func maxContextTokensFrom(providerConfig map[string]interface{}) int {
	if providerConfig == nil {
		return 0
	}
	v, ok := providerConfig["max_context_tokens"]
	if !ok {
		return 0
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case json.Number:
		i, err := n.Int64()
		if err != nil {
			return 0
		}
		return int(i)
	default:
		return 0
	}
}

func (s *Service) CheckThreshold(ctx context.Context, sessionID string, providerConfig map[string]interface{}) (bool, error) {
	tokenCount, err := s.sessionRepo.GetSessionTokenCount(ctx, sessionID)
	if err != nil {
		return false, fmt.Errorf("failed to check token count: %w", err)
	}

	skipThreshold := s.skipThresholdFor(maxContextTokensFrom(providerConfig))
	if s.shouldSkip(tokenCount, skipThreshold) {
		slog.Info(msgconst.InfoConsolidationSkipThreshold, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, sessionID, msgconst.KeyTokens, tokenCount, msgconst.KeySkipThreshold, skipThreshold)
		return false, nil
	}

	return tokenCount >= s.cfg.PRUNE_THRESHOLD, nil
}

type SummarizeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type SummarizeRequest struct {
	SessionID        string                 `json:"session_id"`
	Messages         []SummarizeMessage     `json:"messages"`
	MaxSummaryTokens int                    `json:"max_summary_tokens"`
	ProviderConfig   map[string]interface{} `json:"provider_config"`
}

type SummarizeResponse struct {
	Summary            string `json:"summary"`
	TokenCount         int    `json:"token_count"`
	MessagesSummarized int    `json:"messages_summarized"`
}

func (s *Service) TriggerConsolidation(ctx context.Context, sessionID string, providerConfig map[string]interface{}) error {
	// Guard applies to every caller (lifecycle worker, chat auto-compact,
	// manual prune): never attempt to summarize a session whose size would
	// exceed the provider context window.
	tokenCount, err := s.sessionRepo.GetSessionTokenCount(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to check token count: %w", err)
	}
	skipThreshold := s.skipThresholdFor(maxContextTokensFrom(providerConfig))
	if s.shouldSkip(tokenCount, skipThreshold) {
		slog.Info(msgconst.InfoConsolidationTokensExceed, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, sessionID, msgconst.KeyTokens, tokenCount, msgconst.KeySkipThreshold, skipThreshold)
		return nil
	}

	maxTurn, err := s.sessionRepo.GetMaxTurnNumber(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get max turn: %w", err)
	}

	pruneLimitTurn := maxTurn - s.cfg.PRUNE_KEEP_LATEST_TURNS
	if pruneLimitTurn <= 0 {
		slog.Info(msgconst.InfoConsolidationBelowKeep, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, sessionID, msgconst.KeyMaxTurn, maxTurn, msgconst.KeyKeepTurns, s.cfg.PRUNE_KEEP_LATEST_TURNS)
		return nil
	}

	// Cap the messages loaded for summarization — never pull the entire
	// session (a 1M-context session would exceed the provider context window).
	// Fetch the OLDEST messages: consolidation summarizes the old turns, and
	// the capped query must not paginate from the newest end or the old turns
	// would fall outside the window once a session exceeds the cap.
	allMessages, err := s.sessionRepo.GetSessionMessagesOldestFirst(ctx, sessionID, 200)
	if err != nil {
		return fmt.Errorf("failed to load messages for pruning: %w", err)
	}

	var messagesToSummarize []*chatmodel.Message
	for _, m := range allMessages {
		if m.TurnNumber <= pruneLimitTurn {
			messagesToSummarize = append(messagesToSummarize, m)
		}
	}

	if len(messagesToSummarize) == 0 {
		return nil
	}

	// Cap the payload the same way chat history is capped: truncate oversized
	// contents and keep only the OLDEST messages that fit the token budget
	// (derived from the model context window). Without this, a few oversized
	// messages would still exceed the provider context window and fail the
	// summarization.
	payloadBudget := s.payloadBudgetFor(maxContextTokensFrom(providerConfig))
	cappedMessages := historycap.Cap(messagesToSummarize, payloadBudget, payloadBudget*2, false)
	if len(cappedMessages) != len(messagesToSummarize) {
		slog.Info(msgconst.InfoConsolidationPayloadCapped, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, sessionID, msgconst.KeyIncluded, len(cappedMessages), msgconst.KeyTotal, len(messagesToSummarize))
	}

	var summarizeMessages []SummarizeMessage
	for _, m := range cappedMessages {
		summarizeMessages = append(summarizeMessages, SummarizeMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	slog.Info(msgconst.InfoConsolidationSummarizing, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeyMessages, len(summarizeMessages), msgconst.KeyUpToTurn, pruneLimitTurn, msgconst.KeySessionID, sessionID)

	reqBody := SummarizeRequest{
		SessionID:        sessionID,
		Messages:         summarizeMessages,
		MaxSummaryTokens: s.cfg.SUMMARIZE_MAX_TOKENS,
		ProviderConfig:   providerConfig,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to serialize summarize request: %w", err)
	}

	agentURL := fmt.Sprintf("%s/api/v1/internal/sessions/summarize", s.cfg.AgentHTTPURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, agentURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to create request to agent: %w", err)
	}
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	req.Header.Set(httpxconst.HeaderXInternalToken, s.cfg.InternalAuthToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to contact agent for summarization: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("agent summarization failed with status: %d", resp.StatusCode)
	}

	var sumResp SummarizeResponse
	if err := json.NewDecoder(resp.Body).Decode(&sumResp); err != nil {
		return fmt.Errorf("failed to decode agent response: %w", err)
	}

	session, err := s.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to fetch session: %w", err)
	}

	newSummary := sumResp.Summary
	if session.ContextSummary != "" {
		newSummary = session.ContextSummary + "\n\n" + sumResp.Summary
	}

	err = s.sessionRepo.PruneSession(ctx, sessionID, newSummary, pruneLimitTurn)
	if err != nil {
		return fmt.Errorf("failed to execute prune session transaction: %w", err)
	}

	slog.Info(msgconst.InfoConsolidationPruned, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, sessionID, msgconst.KeyNewSummaryLen, len(newSummary))
	return nil
}
