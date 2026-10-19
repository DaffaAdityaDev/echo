package main

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	envconst "echo-backend/internal/constants/env"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
)

var (
	agentHTTPURL  = strings.TrimRight(os.Getenv(envconst.AgentHTTPURL), "/")
	internalToken = os.Getenv(envconst.InternalAuthToken)
	tokenCache    = map[string]int{}
)

// countTokensCached counts content with the agent's official tiktoken endpoint
// (BPE tokenizer), cached per unique content. Falls back to chars/4 (with a
// warning) only when the agent is unreachable.
func countTokensCached(content string) int {
	if n, ok := tokenCache[content]; ok {
		return n
	}
	n := countTokensViaAgent(content)
	tokenCache[content] = n
	return n
}

func countTokensViaAgent(text string) int {
	if agentHTTPURL == "" || internalToken == "" {
		return estimateTokens(text)
	}

	payload, err := json.Marshal(map[string]string{"text": text})
	if err != nil {
		return estimateTokens(text)
	}

	req, err := http.NewRequest(http.MethodPost, agentHTTPURL+"/api/v1/internal/tokenize", bytes.NewReader(payload))
	if err != nil {
		return estimateTokens(text)
	}
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	req.Header.Set(httpxconst.HeaderXInternalToken, internalToken)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Warn(msgconst.WarnAgentTokenizeUnreachable, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		return estimateTokens(text)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		slog.Warn(msgconst.WarnAgentTokenizeFailed, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyStatus, resp.StatusCode)
		return estimateTokens(text)
	}

	var out struct {
		Tokens int `json:"tokens"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		slog.Warn(msgconst.WarnAgentTokenizeDecode, msgconst.ComponentKey, msgconst.ComponentSeed, msgconst.KeyErr, err)
		return estimateTokens(text)
	}
	return out.Tokens
}

// estimateTokens is the last-resort chars/4 approximation used only when the
// agent's tokenizer endpoint is unreachable.
func estimateTokens(content string) int {
	tokens := len(content) / 4
	if tokens == 0 && len(content) > 0 {
		return 1
	}
	return tokens
}
