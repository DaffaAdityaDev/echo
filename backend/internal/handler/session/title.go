package session

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	authconst "echo-backend/internal/constants/auth"
	"echo-backend/internal/constants/db"
	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type GenerateTitleRequest struct {
	// Model is the model ID used for generation; falls back to the configured default when empty.
	Model string `json:"model"`
}

type GenerateTitleResponse struct {
	// Title is the generated session title.
	Title string `json:"title"`
	// Summary is a one-sentence summary of the session conversation.
	Summary string `json:"summary"`
	// Cached is true when the response was served from the existing session metadata.
	Cached bool `json:"cached"`
}

// titleHistoryLimit caps how many messages are sent to the LLM for title
// generation — the full history would otherwise be stringified and shipped
// to the provider on every call.
const titleHistoryLimit = 40

// jsonObjectRe extracts the JSON object from an LLM reply that may wrap it
// in prose.
var jsonObjectRe = regexp.MustCompile(`\{[\s\S]*\}`)

// HandleGenerateTitle godoc
// @Summary Generate a session title
// @Description Generates a title and summary from the session history using an LLM
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Param request body GenerateTitleRequest true "Model selection (optional)"
// @Success 200 {object} GenerateTitleResponse "Generated title and summary"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Failure 502 {object} map[string]string
// @Router /api/v1/sessions/{id}/generate-title [post]
func (h *Handler) HandleGenerateTitle(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Session ID is required")
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to get session", err.Error())
	}
	if session == nil || session.Status == "deleted" {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
	}
	if session.UserID != userID {
		return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
	}

	if session.Title != "" && session.Title != db.DefaultSessionTitle {
		return handlerutil.RespondSuccess(c, GenerateTitleResponse{Title: session.Title, Summary: session.ContextSummary, Cached: true})
	}

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID, titleHistoryLimit, 0)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to get messages", err.Error())
	}

	if len(messages) == 0 {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "No messages to summarize")
	}

	var req GenerateTitleRequest
	if len(c.Body()) > 0 {
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
		}
	}

	modelID := req.Model
	if modelID == "" {
		modelID = h.Cfg.DefaultModel
	}

	providerCfg, err := h.ModelSvc.ResolveProviderConfig(c.Context(), userID, modelID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}

	var conversation strings.Builder
	for _, m := range messages {
		if m.Role != domainconst.MessageRoleUser && m.Role != domainconst.MessageRoleAssistant && m.Role != domainconst.MessageRoleSystem {
			continue
		}
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		fmt.Fprintf(&conversation, "%s: %s\n", m.Role, content)
	}

	systemPrompt := `You are an AI session metadata generator. Given the conversation history, generate a concise, human-readable Title (3 to 6 words, Title Case, no quotes, no period) and a 1-sentence Summary describing the main topic or objective.
Respond ONLY with a valid JSON object in this exact format:
{"title": "Concise Topic Title", "summary": "Short 1-sentence summary of the conversation topic."}`

	reqBody := map[string]interface{}{
		"model": providerCfg.Model,
		"messages": []map[string]string{
			{"role": domainconst.MessageRoleSystem, "content": systemPrompt},
			{"role": domainconst.MessageRoleUser, "content": conversation.String()},
		},
		"temperature": 0.3,
		"max_tokens":  1024,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to build request")
	}

	endpoint := buildChatCompletionsURL(providerCfg.BaseURL)
	httpReq, err := http.NewRequestWithContext(c.Context(), http.MethodPost, endpoint, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request")
	}

	httpReq.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	if providerCfg.APIKey != "" {
		httpReq.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+providerCfg.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		slog.Error(msgconst.ErrTitleHTTPRequest, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "err", err)
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "LLM provider request failed")
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			slog.Error(msgconst.ErrTitleReadErrorResponse, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "err", err)
			return handlerutil.RespondError(c, fiber.StatusBadGateway, "LLM provider returned error")
		}
		slog.Warn(msgconst.WarnTitleProviderNon200, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "status", resp.StatusCode, "body", string(respBody))
		return handlerutil.RespondError(c, fiber.StatusBadGateway, fmt.Sprintf("LLM provider returned error (%d): %s", resp.StatusCode, string(respBody)))
	}

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to read LLM response")
	}

	var chatCompletion struct {
		Choices []struct {
			Message struct {
				Content          string `json:"content"`
				ReasoningContent string `json:"reasoning_content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &chatCompletion); err != nil || len(chatCompletion.Choices) == 0 {
		slog.Error(msgconst.ErrTitleParseCompletion, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "err", err, "choices", len(chatCompletion.Choices))
		slog.Debug(msgconst.DebugTitleFullBody, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "body", string(respBytes))
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "Failed to parse LLM response")
	}

	rawContent := strings.TrimSpace(chatCompletion.Choices[0].Message.Content)
	if rawContent == "" {
		rawContent = strings.TrimSpace(chatCompletion.Choices[0].Message.ReasoningContent)
	}

	if match := jsonObjectRe.FindString(rawContent); match != "" {
		rawContent = match
	}

	var metaData struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
	}

	if err := json.Unmarshal([]byte(rawContent), &metaData); err != nil {
		slog.Error(msgconst.ErrTitleParseJSON, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "err", err)
		slog.Debug(msgconst.DebugTitleContentAfterRegex, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "content", truncateStr(rawContent, 500))
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "LLM response is not valid JSON")
	}

	title := strings.TrimSpace(metaData.Title)
	summary := strings.TrimSpace(metaData.Summary)

	if title == "" {
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "LLM returned empty title")
	}

	if err := h.SessionRepo.UpdateTitleAndSummary(c.Context(), sessionID, title, summary); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to save title")
	}

	slog.Info(msgconst.InfoTitleGenerated, msgconst.ComponentKey, msgconst.ComponentAutoTitle, "session_id", sessionID, "title", title)
	return handlerutil.RespondSuccess(c, GenerateTitleResponse{Title: title, Summary: summary})
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func buildChatCompletionsURL(baseURL string) string {
	base := strings.TrimRight(baseURL, "/")
	if strings.HasSuffix(base, "/chat/completions") {
		return base
	}
	if !strings.HasSuffix(base, "/v1") {
		return base + "/v1/chat/completions"
	}
	return base + "/chat/completions"
}
