package chat

import (
	"context"
	msgconst "echo-backend/internal/constants/msg"
	"log/slog"

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
