package chat

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	domainconst "echo-backend/internal/constants/domain"
	msgconst "echo-backend/internal/constants/msg"

	chatmodel "echo-backend/internal/models/chat"
	"echo-backend/internal/pkg/historycap"
)

const historyFetchLimit = 200

// buildCappedHistory loads the session's recent messages and applies the token
// cap before they are forwarded to the agent. Keeps the newest messages.
func (h *Handler) buildCappedHistory(ctx context.Context, sessionID string) ([]*chatmodel.Message, error) {
	dbMessages, err := h.SessionRepo.GetSessionMessages(ctx, sessionID, historyFetchLimit, 0)
	if err != nil {
		return nil, err
	}

	capped := historycap.Cap(dbMessages, h.Cfg.HistoryMaxTokens, h.Cfg.HistoryMaxMsgChars, true)

	if len(capped) != len(dbMessages) {
		slog.Info(msgconst.InfoChatHistoryCapped, msgconst.ComponentKey, msgconst.ComponentHistory, msgconst.KeySessionID, sessionID, msgconst.KeyIncluded, len(capped), msgconst.KeyTotal, len(dbMessages))
	}
	return capped, nil
}

// buildAgentHistory converts stored messages into the agent's history: the
// context summary first, then user/assistant/system turns. Step-only roles are
// dropped, and so are empty assistant messages (placeholders of interrupted
// or failed turns), which providers reject or misread as blank replies.
func buildAgentHistory(contextSummary string, dbMessages []*chatmodel.Message) []HistoryMessage {
	var history []HistoryMessage
	if contextSummary != "" {
		history = append(history, HistoryMessage{
			Role:    domainconst.MessageRoleSystem,
			Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", contextSummary),
		})
	}
	for _, dbMsg := range dbMessages {
		if isStepRole(dbMsg.Role) || isEmptyAssistantMessage(dbMsg) {
			continue
		}
		history = append(history, HistoryMessage{Role: dbMsg.Role, Content: dbMsg.Content})
	}
	return history
}

func isStepRole(role string) bool {
	return role == "thought" || role == "tool_call" || role == "tool_result"
}

func isEmptyAssistantMessage(msg *chatmodel.Message) bool {
	return msg.Role == domainconst.MessageRoleAssistant && strings.TrimSpace(msg.Content) == ""
}
