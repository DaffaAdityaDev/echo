package handler

import (
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/internal/service"

	"github.com/gofiber/fiber/v3"
)

type SessionHandler struct {
	Cfg              *models.Config
	SessionRepo      *repository.SessionRepository
	ConsolidationSvc *service.ConsolidationService
}

func NewSessionHandler(cfg *models.Config, sessionRepo *repository.SessionRepository, consolidationSvc *service.ConsolidationService) *SessionHandler {
	return &SessionHandler{
		Cfg:              cfg,
		SessionRepo:      sessionRepo,
		ConsolidationSvc: consolidationSvc,
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
		title = "New Chat Session"
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
