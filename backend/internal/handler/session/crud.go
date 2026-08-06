package session

import (
	"echo-backend/internal/constants/db"
	"echo-backend/internal/handler/handlerutil"
	chatmodel "echo-backend/internal/models/chat"

	"github.com/gofiber/fiber/v3"
)

// HandleCreateSession godoc
// @Summary Create a session
// @Description Creates a new chat session with an optional strategy version
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSessionRequest true "Session payload"
// @Success 201 {object} chatmodel.Session
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/v1/sessions [post]
func (h *Handler) HandleCreateSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	var req CreateSessionRequest
	_ = c.Bind().JSON(&req)

	if req.StrategyVersion != "" && h.StrategySvc != nil {
		if !h.StrategySvc.IsValidVersion(c.Context(), req.StrategyVersion) {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version")
		}
	}

	title := req.Title
	if title == "" {
		title = db.DefaultSessionTitle
	}

	session, err := h.SessionRepo.CreateSession(c.Context(), userID, title, req.StrategyVersion)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to create session", err.Error())
	}

	return handlerutil.RespondCreated(c, session)
}

// HandleListSessions godoc
// @Summary List user sessions
// @Description Returns all active sessions for the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Router /api/v1/sessions [get]
func (h *Handler) HandleListSessions(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	limitVal := parseNonNegativeInt(c.Query("limit"))
	offsetVal := parseNonNegativeInt(c.Query("offset"))

	sessions, err := h.SessionRepo.ListByUser(c.Context(), userID, limitVal, offsetVal)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to list sessions", err.Error())
	}

	if sessions == nil {
		sessions = []*chatmodel.Session{}
	}

	totalVal, err := h.SessionRepo.CountByUser(c.Context(), userID)
	if err != nil {
		totalVal = len(sessions)
	}

	return handlerutil.RespondSuccess(c, ListSessionsResponse{
		Sessions: sessions,
		Pagination: PaginationMeta{
			Limit:  limitVal,
			Offset: offsetVal,
			Total:  totalVal,
		},
	})
}

// HandleGetSession godoc
// @Summary Get a session
// @Description Returns a session owned by the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} chatmodel.Session
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id} [get]
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

// HandleGetSessionMessages godoc
// @Summary Get session messages
// @Description Returns the message history of a session owned by the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id}/messages [get]
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

	limitVal := parseNonNegativeInt(c.Query("limit"))
	offsetVal := parseNonNegativeInt(c.Query("offset"))

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), sessionID, limitVal, offsetVal)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to get messages", err.Error())
	}

	if messages == nil {
		messages = []*chatmodel.Message{}
	}

	totalVal, err := h.SessionRepo.CountMessagesBySession(c.Context(), sessionID)
	if err != nil {
		totalVal = len(messages)
	}

	return handlerutil.RespondSuccess(c, GetMessagesResponse{
		Messages: messages,
		Pagination: PaginationMeta{
			Limit:  limitVal,
			Offset: offsetVal,
			Total:  totalVal,
		},
	})
}

// HandleUpdateSession godoc
// @Summary Update a session
// @Description Updates the title and/or summary of a session owned by the authenticated user
// @Tags Sessions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Param request body object true "Title and/or summary"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id} [patch]
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

// HandleDeleteSession godoc
// @Summary Delete a session
// @Description Soft-deletes a session owned by the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id} [delete]
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
