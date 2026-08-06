package consolidation

import (
	"bytes"
	"context"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"encoding/json"
	"fmt"
	"log"
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

func (s *Service) CheckThreshold(ctx context.Context, sessionID string) (bool, error) {
	tokenCount, err := s.sessionRepo.GetSessionTokenCount(ctx, sessionID)
	if err != nil {
		return false, fmt.Errorf("failed to check token count: %w", err)
	}

	// Skip consolidation for astronomically large sessions (e.g. load-test
	// sessions with millions of tokens) — summarizing them would exceed the
	// provider context window and fail.
	if s.cfg.ConsolidationSkipTokens > 0 && tokenCount > s.cfg.ConsolidationSkipTokens {
		log.Printf("[CONSOLIDATION] Session %s has %d tokens, exceeding skip threshold %d. Skipping consolidation.",
			sessionID, tokenCount, s.cfg.ConsolidationSkipTokens)
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
	maxTurn, err := s.sessionRepo.GetMaxTurnNumber(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("failed to get max turn: %w", err)
	}

	pruneLimitTurn := maxTurn - s.cfg.PRUNE_KEEP_LATEST_TURNS
	if pruneLimitTurn <= 0 {
		log.Printf("[CONSOLIDATION] Session %s has max turn %d, which is less than keepTurns %d. Skipping pruning.", sessionID, maxTurn, s.cfg.PRUNE_KEEP_LATEST_TURNS)
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

	var messagesToSummarize []SummarizeMessage
	for _, m := range allMessages {
		if m.TurnNumber <= pruneLimitTurn {
			messagesToSummarize = append(messagesToSummarize, SummarizeMessage{
				Role:    m.Role,
				Content: m.Content,
			})
		}
	}

	if len(messagesToSummarize) == 0 {
		return nil
	}

	log.Printf("[CONSOLIDATION] Summarizing %d messages up to turn %d for session %s", len(messagesToSummarize), pruneLimitTurn, sessionID)

	reqBody := SummarizeRequest{
		SessionID:        sessionID,
		Messages:         messagesToSummarize,
		MaxSummaryTokens: s.cfg.SUMMARIZE_MAX_TOKENS,
		ProviderConfig:   providerConfig,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to serialize summarize request: %w", err)
	}

	agentURL := fmt.Sprintf("%s/api/internal/sessions/summarize", s.cfg.AgentHTTPURL)
	req, err := http.NewRequestWithContext(ctx, "POST", agentURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to create request to agent: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.cfg.InternalAuthToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to contact agent for summarization: %w", err)
	}
	defer resp.Body.Close()

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

	log.Printf("[CONSOLIDATION] Pruning successful for session %s. New summary length: %d chars.", sessionID, len(newSummary))
	return nil
}
