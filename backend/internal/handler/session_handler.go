package handler

import (
	"bytes"
	"echo-backend/internal/constants/db"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/internal/service"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
)

type SessionHandler struct {
	Cfg              *models.Config
	SessionRepo      *repository.SessionRepository
	ConsolidationSvc *service.ConsolidationService
	ModelSvc         *service.ModelService
}

func NewSessionHandler(cfg *models.Config, sessionRepo *repository.SessionRepository, consolidationSvc *service.ConsolidationService, modelSvc *service.ModelService) *SessionHandler {
	return &SessionHandler{
		Cfg:              cfg,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
		ModelSvc:         modelSvc,
	}
}

type CreateSessionRequest struct {
	Title string `json:"title" example:"Build a REST API with Express"`
}

// @Summary Create a new session
// @Description Initialize a new chat session for the current user
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSessionRequest false "Session title"
// @Success 201 {object} models.Session
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to create session"
// @Router /api/v1/sessions [post]
func (h *SessionHandler) HandleCreateSession(c fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateSessionRequest
	_ = c.Bind().JSON(&req) // Bind body if present, fallback to default title

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

// @Summary List user sessions
// @Description Retrieve all active chat sessions belonging to the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "List of sessions"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to list sessions"
// @Router /api/v1/sessions [get]
func (h *SessionHandler) HandleListSessions(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

// @Summary Get session details
// @Description Fetch session metadata by ID
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} models.Session
// @Failure 400 {object} map[string]string "Missing session ID"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden: ownership mismatch"
// @Failure 404 {object} map[string]string "Session not found"
// @Router /api/v1/sessions/{id} [get]
func (h *SessionHandler) HandleGetSession(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

// @Summary Get session messages
// @Description Retrieve message history for a specific chat session
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} map[string]interface{} "List of messages"
// @Failure 400 {object} map[string]string "Missing session ID"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden: ownership mismatch"
// @Failure 404 {object} map[string]string "Session not found"
// @Router /api/v1/sessions/{id}/messages [get]
func (h *SessionHandler) HandleGetSessionMessages(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

// @Summary Update session metadata
// @Description Update session title and/or summary
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Param request body object true "Title and summary fields"
// @Success 200 {object} map[string]string "Session updated"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden: ownership mismatch"
// @Failure 404 {object} map[string]string "Session not found"
// @Router /api/v1/sessions/{id} [patch]
func (h *SessionHandler) HandleUpdateSession(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

// @Summary Delete session
// @Description Soft-delete a chat session
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} map[string]string "Session soft deleted"
// @Failure 400 {object} map[string]string "Missing session ID"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden: ownership mismatch"
// @Failure 404 {object} map[string]string "Session not found"
// @Router /api/v1/sessions/{id} [delete]
func (h *SessionHandler) HandleDeleteSession(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

// @Summary Generate title and summary for a session
// @Description Trigger LLM-driven title and summary generation based on conversation history
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Param request body GenerateTitleRequest false "Optional model selection"
// @Success 200 {object} map[string]string "Generated title and summary"
// @Failure 400 {object} map[string]string "Invalid request or session state"
// @Failure 404 {object} map[string]string "Session not found"
// @Failure 500 {object} map[string]string "Failed to generate title"
// @Router /api/v1/sessions/{id}/title [post]
type GenerateTitleRequest struct {
	Model string `json:"model"`
}

func (h *SessionHandler) HandleGenerateTitle(c fiber.Ctx) error {
	userID, err := getUserID(c)
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

	// Skip if already has a custom title (not default)
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

	providerCfg, err := h.ModelSvc.ResolveModel(modelID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unknown model: " + modelID})
	}

	// Build conversation text from messages (only user, assistant, system with content)
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
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "LLM provider returned error"})
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
	ProviderConfig map[string]interface{} `json:"provider_config" example:"{\"type\":\"openai\",\"base_url\":\"https://api.openai.com/v1\",\"model\":\"gpt-4o\"}"`
}

// @Summary Prune and consolidate session
// @Description Trigger LLM-driven memory consolidation for a session
// @Tags Internal
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Param request body PruneRequest true "Provider config payload"
// @Success 200 {object} map[string]string "Consolidation status"
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 500 {object} map[string]string "Consolidation failed"
// @Router /api/v1/internal/sessions/{id}/prune [post]
func (h *SessionHandler) HandlePruneSession(c fiber.Ctx) error {
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
