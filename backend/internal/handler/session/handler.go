package session

import (
	"bytes"
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
)

type SessionRepo interface {
	CreateSession(ctx context.Context, userID int, title string) (*chatmodel.Session, error)
	GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
	ListByUser(ctx context.Context, userID int) ([]*chatmodel.Session, error)
	GetSessionMessages(ctx context.Context, sessionID string) ([]*chatmodel.Message, error)
	UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error
	GetSessionTokenCount(ctx context.Context, sessionID string) (int, error)
}

type ConsolidationSvc interface {
	CheckThreshold(ctx context.Context, sessionID string) (bool, error)
	TriggerConsolidation(ctx context.Context, sessionID string, providerConfig map[string]interface{}) error
}

type ModelSvc interface {
	ResolveProviderConfig(userID int, modelID string) (*aitype.ProviderConfig, error)
}

type Handler struct {
	Cfg              *cfgmodel.Config
	SessionRepo      SessionRepo
	ConsolidationSvc ConsolidationSvc
	ModelSvc         ModelSvc
}

func NewHandler(cfg *cfgmodel.Config, sessionRepo SessionRepo, consolidationSvc ConsolidationSvc, modelSvc ModelSvc) *Handler {
	return &Handler{
		Cfg:              cfg,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
		ModelSvc:         modelSvc,
	}
}

type CreateSessionRequest struct {
	Title string `json:"title" example:"Build a REST API with Express"`
}

func (h *Handler) HandleCreateSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	var req CreateSessionRequest
	_ = c.Bind().JSON(&req)

	title := req.Title
	if title == "" {
		title = db.DefaultSessionTitle
	}

	session, err := h.SessionRepo.CreateSession(c.Context(), userID, title)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to create session", err.Error())
	}

	return handlerutil.RespondCreated(c, session)
}

func (h *Handler) HandleListSessions(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	sessions, err := h.SessionRepo.ListByUser(c.Context(), userID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to list sessions", err.Error())
	}

	if sessions == nil {
		sessions = []*chatmodel.Session{}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"sessions": sessions})
}

func (h *Handler) HandleGetSession(c fiber.Ctx) error {
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

	return handlerutil.RespondSuccess(c, session)
}

func (h *Handler) HandleGetSessionMessages(c fiber.Ctx) error {
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

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to get messages", err.Error())
	}

	if messages == nil {
		messages = []*chatmodel.Message{}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"messages": messages})
}

func (h *Handler) HandleUpdateSession(c fiber.Ctx) error {
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

	var req struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if req.Title == "" && req.Summary == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "At least one of 'title' or 'summary' is required")
	}

	if err := h.SessionRepo.UpdateTitleAndSummary(c.Context(), sessionID, req.Title, req.Summary); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to update session")
	}

	return handlerutil.RespondMessage(c, "Session updated")
}

func (h *Handler) HandleDeleteSession(c fiber.Ctx) error {
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

	err = h.SessionRepo.DeleteSession(c.Context(), sessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to delete session", err.Error())
	}

	return handlerutil.RespondMessage(c, "Session soft deleted")
}

type GenerateTitleRequest struct {
	Model string `json:"model"`
}

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
		return handlerutil.RespondSuccess(c, fiber.Map{"title": session.Title, "summary": session.ContextSummary, "cached": true})
	}

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID)
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

	providerCfg, err := h.ModelSvc.ResolveProviderConfig(userID, modelID)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}

	var conversation strings.Builder
	for _, m := range messages {
		if m.Role != "user" && m.Role != "assistant" && m.Role != "system" {
			continue
		}
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		conversation.WriteString(fmt.Sprintf("%s: %s\n", m.Role, content))
	}

	systemPrompt := `You are an AI session metadata generator. Given the conversation history, generate a concise, human-readable Title (3 to 6 words, Title Case, no quotes, no period) and a 1-sentence Summary describing the main topic or objective.
Respond ONLY with a valid JSON object in this exact format:
{"title": "Concise Topic Title", "summary": "Short 1-sentence summary of the conversation topic."}`

	reqBody := map[string]interface{}{
		"model": providerCfg.Model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": conversation.String()},
		},
		"temperature": 0.3,
		"max_tokens":  1024,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to build request")
	}

	endpoint := strings.TrimSuffix(providerCfg.BaseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(c.Context(), "POST", endpoint, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request")
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if providerCfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+providerCfg.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("[AUTO-TITLE] HTTP request failed for session %s: %v", sessionID, err)
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "LLM provider request failed")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[AUTO-TITLE] Provider returned status %d for session %s: %s", resp.StatusCode, sessionID, string(respBody))
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
		log.Printf("[AUTO-TITLE] Failed to parse chat completion for session %s: err=%v choices=%d", sessionID, err, len(chatCompletion.Choices))
		log.Printf("[AUTO-TITLE] Full response body: %s", string(respBytes))
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "Failed to parse LLM response")
	}

	rawContent := strings.TrimSpace(chatCompletion.Choices[0].Message.Content)
	if rawContent == "" {
		rawContent = strings.TrimSpace(chatCompletion.Choices[0].Message.ReasoningContent)
	}

	re := regexp.MustCompile(`\{[\s\S]*\}`)
	if match := re.FindString(rawContent); match != "" {
		rawContent = match
	}

	var metaData struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
	}

	if err := json.Unmarshal([]byte(rawContent), &metaData); err != nil {
		log.Printf("[AUTO-TITLE] Failed to parse JSON for session %s: %v", sessionID, err)
		log.Printf("[AUTO-TITLE] Content after regex: %s", truncateStr(rawContent, 500))
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

	log.Printf("[AUTO-TITLE] Generated title for session %s: '%s'", sessionID, title)
	return handlerutil.RespondSuccess(c, fiber.Map{"title": title, "summary": summary})
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

type PruneRequest struct {
	ProviderConfig map[string]interface{} `json:"provider_config"`
}

func (h *Handler) HandlePruneSession(c fiber.Ctx) error {
	sessionID := c.Params("id")
	if sessionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Session ID is required")
	}

	var req PruneRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	err := h.ConsolidationSvc.TriggerConsolidation(c.Context(), sessionID, req.ProviderConfig)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Consolidation failed", err.Error())
	}

	return handlerutil.RespondMessage(c, "Session pruned and consolidated successfully")
}
