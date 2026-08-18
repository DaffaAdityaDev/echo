package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
)

// countTokensViaAgent counts tokens with the agent's official tiktoken
// endpoint (BPE tokenizer). The chars/4 approximation is used ONLY as a
// last-resort fallback when the agent is unreachable (logged).
func (h *Handler) countTokensViaAgent(ctx context.Context, text string) int {
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	body, err := json.Marshal(map[string]string{"text": text})
	if err != nil {
		return estimateTokensFallback(text)
	}

	agentURL := h.Cfg.AgentHTTPURL + "/api/v1/internal/tokenize"
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, agentURL, bytes.NewBuffer(body))
	if err != nil {
		return estimateTokensFallback(text)
	}
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	req.Header.Set(httpxconst.HeaderXInternalToken, h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(req)
	if err != nil {
		slog.Warn(msgconst.WarnTokensAgentUnreachable, msgconst.ComponentKey, msgconst.ComponentTokens, msgconst.KeyErr, err)
		return estimateTokensFallback(text)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		slog.Warn(msgconst.WarnTokensAgentFailed, msgconst.ComponentKey, msgconst.ComponentTokens, msgconst.KeyStatus, resp.StatusCode)
		return estimateTokensFallback(text)
	}

	var out struct {
		Tokens int `json:"tokens"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		slog.Warn(msgconst.WarnTokensAgentDecodeFailed, msgconst.ComponentKey, msgconst.ComponentTokens, msgconst.KeyErr, err)
		return estimateTokensFallback(text)
	}
	return out.Tokens
}

// estimateTokensFallback is the last-resort chars/4 approximation used only
// when the agent's tokenizer is unreachable.
func estimateTokensFallback(text string) int {
	tokens := len(text) / 4
	if tokens == 0 && len(text) > 0 {
		return 1
	}
	return tokens
}
