package session

import (
	"bytes"
	"context"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
)

type SessionRepo interface {
	CreateSession(ctx context.Context, userID int, title string) (*models.Session, error)
	GetByID(ctx context.Context, sessionID string) (*models.Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
	ListByUser(ctx context.Context, userID int) ([]*models.Session, error)
	GetSessionMessages(ctx context.Context, sessionID string) ([]*models.Message, error)
	UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error
	GetSessionTokenCount(ctx context.Context, sessionID string) (int, error)
}

type ConsolidationSvc interface {
	CheckThreshold(ctx context.Context, sessionID string) (bool, error)
	TriggerConsolidation(ctx context.Context, sessionID string, providerConfig map[string]interface{}) error
}

type ModelSvc interface {
	ResolveProviderConfig(userID int, modelID string) (*models.ProviderConfig, error)
}

type Handler struct {
	Cfg              *models.Config
	SessionRepo      SessionRepo
	ConsolidationSvc ConsolidationSvc
	ModelSvc         ModelSvc
}

func NewHandler(cfg *models.Config, sessionRepo SessionRepo, consolidationSvc ConsolidationSvc, modelSvc ModelSvc) *Handler {
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
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateSessionRequest
	_ = c.Bind().JSON(&req)

	title := req.Title
	if title == "" {
		title = db.DefaultSessionTitle
	}

	session, err := h.SessionRepo.CreateSession(c.Context(), userID, title)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session", "details": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(session)
}

func (h *Handler) HandleListSessions(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessions, err := h.SessionRepo.ListByUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list sessions", "details": err.Error()})
	}

	if sessions == nil {
		sessions = []*models.Session{}
	}

	return c.JSON(fiber.Map{"sessions": sessions})
}

func (h *Handler) HandleGetSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get session", "details": err.Error()})
	}

	if session == nil || session.Status == "deleted" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}

	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
	}

	return c.JSON(session)
}

func (h *Handler) HandleGetSessionMessages(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get session", "details": err.Error()})
	}
	if session == nil || session.Status == "deleted" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
	}

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get messages", "details": err.Error()})
	}

	if messages == nil {
		messages = []*models.Message{}
	}

	return c.JSON(fiber.Map{"messages": messages})
}

func (h *Handler) HandleUpdateSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get session", "details": err.Error()})
	}
	if session == nil || session.Status == "deleted" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
	}

	var req struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
	}
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Title == "" && req.Summary == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "At least one of 'title' or 'summary' is required"})
	}

	if err := h.SessionRepo.UpdateTitleAndSummary(c.Context(), sessionID, req.Title, req.Summary); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update session"})
	}

	return c.JSON(fiber.Map{"message": "Session updated"})
}

func (h *Handler) HandleDeleteSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get session", "details": err.Error()})
	}

	if session == nil || session.Status == "deleted" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}

	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
	}

	err = h.SessionRepo.DeleteSession(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete session", "details": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "Session soft deleted"})
}

type GenerateTitleRequest struct {
	Model string `json:"model"`
}

func (h *Handler) HandleGenerateTitle(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	session, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get session", "details": err.Error()})
	}
	if session == nil || session.Status == "deleted" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden: ownership mismatch"})
	}

	if session.Title != "" && session.Title != db.DefaultSessionTitle {
		return c.JSON(fiber.Map{"title": session.Title, "summary": session.ContextSummary, "cached": true})
	}

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get messages", "details": err.Error()})
	}

	if len(messages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No messages to summarize"})
	}

	var req GenerateTitleRequest
	if len(c.Body()) > 0 {
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
		}
	}

	modelID := req.Model
	if modelID == "" {
		modelID = h.Cfg.DefaultModel
	}

	providerCfg, err := h.ModelSvc.ResolveProviderConfig(userID, modelID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
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
		"max_tokens":  150,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to build request"})
	}

	endpoint := strings.TrimSuffix(providerCfg.BaseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(c.Context(), "POST", endpoint, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create request"})
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if providerCfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+providerCfg.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		log.Printf("[AUTO-TITLE] HTTP request failed for session %s: %v", sessionID, err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "LLM provider request failed"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[AUTO-TITLE] Provider returned status %d for session %s: %s", resp.StatusCode, sessionID, string(respBody))
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("LLM provider returned error (%d): %s", resp.StatusCode, string(respBody)),
		})
	}

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read LLM response"})
	}

	var chatCompletion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &chatCompletion); err != nil || len(chatCompletion.Choices) == 0 {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Failed to parse LLM response"})
	}

	rawContent := strings.TrimSpace(chatCompletion.Choices[0].Message.Content)
	rawContent = strings.TrimPrefix(rawContent, "```json")
	rawContent = strings.TrimPrefix(rawContent, "```")
	rawContent = strings.TrimSuffix(rawContent, "```")
	rawContent = strings.TrimSpace(rawContent)

	var metaData struct {
		Title   string `json:"title"`
		Summary string `json:"summary"`
	}

	if err := json.Unmarshal([]byte(rawContent), &metaData); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "LLM response is not valid JSON"})
	}

	title := strings.TrimSpace(metaData.Title)
	summary := strings.TrimSpace(metaData.Summary)

	if title == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "LLM returned empty title"})
	}

	if err := h.SessionRepo.UpdateTitleAndSummary(c.Context(), sessionID, title, summary); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save title"})
	}

	log.Printf("[AUTO-TITLE] Generated title for session %s: '%s'", sessionID, title)
	return c.JSON(fiber.Map{"title": title, "summary": summary})
}

type PruneRequest struct {
	ProviderConfig map[string]interface{} `json:"provider_config"`
}

func (h *Handler) HandlePruneSession(c fiber.Ctx) error {
	sessionID := c.Params("id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Session ID is required"})
	}

	var req PruneRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	err := h.ConsolidationSvc.TriggerConsolidation(c.Context(), sessionID, req.ProviderConfig)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Consolidation failed", "details": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "Session pruned and consolidated successfully"})
}
