package chat

import (
	"context"
	"log"

	chatmodel "echo-backend/internal/models/chat"
)

const historyFetchLimit = 200

// buildCappedHistory loads the session's recent messages and applies the token
// cap before they are forwarded to the agent. See capHistory.
func (h *Handler) buildCappedHistory(ctx context.Context, sessionID string) ([]*chatmodel.Message, error) {
	dbMessages, err := h.SessionRepo.GetSessionMessages(ctx, sessionID, historyFetchLimit, 0)
	if err != nil {
		return nil, err
	}

	capped := capHistory(dbMessages, h.Cfg.HistoryMaxTokens, h.Cfg.HistoryMaxMsgChars)

	if len(capped) != len(dbMessages) {
		log.Printf("[HISTORY] Session %s history capped: %d/%d messages included", sessionID, len(capped), len(dbMessages))
	}
	return capped, nil
}

// capHistory keeps only the newest messages that fit within maxTokens (dropping
// older ones), truncating any single message content beyond maxMsgChars. Input
// must be chronological (oldest first, as returned by the repository); output
// preserves that order. Prevents multi-MB payloads (e.g. 1M-context stress
// sessions) from being forwarded to the agent.
func capHistory(messages []*chatmodel.Message, maxTokens int, maxMsgChars int) []*chatmodel.Message {
	if maxTokens <= 0 {
		maxTokens = 50000
	}
	if maxMsgChars <= 0 {
		maxMsgChars = 100000
	}

	var capped []*chatmodel.Message
	totalTokens := 0

	for i := len(messages) - 1; i >= 0; i-- {
		m := messages[i]
		charge := m.TokenCount
		if len(m.Content) > maxMsgChars {
			m.Content = m.Content[:maxMsgChars] + "\n...[truncated]"
			// Charge an estimate for the truncated content so one oversized
			// message does not silently evict every older message (the stored
			// TokenCount reflects the pre-truncation size).
			charge = len(m.Content) / 4
		}
		if totalTokens > 0 && totalTokens+charge > maxTokens {
			continue // drop older messages beyond the token cap
		}
		totalTokens += charge
		capped = append([]*chatmodel.Message{m}, capped...)
	}

	return capped
}
