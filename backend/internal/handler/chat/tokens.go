package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

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

	agentURL := h.Cfg.AgentHTTPURL + "/api/internal/tokenize"
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, agentURL, bytes.NewBuffer(body))
	if err != nil {
		return estimateTokensFallback(text)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(req)
	if err != nil {
		slog.Warn("agent tokenize unreachable, falling back to estimate", "component", "tokens", "err", err)
		return estimateTokensFallback(text)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		slog.Warn("agent tokenize failed, falling back to estimate", "component", "tokens", "status", resp.StatusCode)
		return estimateTokensFallback(text)
	}

	var out struct {
		Tokens int `json:"tokens"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		slog.Warn("agent tokenize decode failed, falling back to estimate", "component", "tokens", "err", err)
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
