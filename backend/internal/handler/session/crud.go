package session

import (
	"context"

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
// @Success 201 {object} chatmodel.Session "Created session"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions [post]
func (h *Handler) HandleCreateSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	var req CreateSessionRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}

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
		return respondInternalError(c, "Failed to create session", err)
	}

	return handlerutil.RespondCreated(c, session)
}

// HandleListSessions godoc
// @Summary List user sessions
// @Description Returns all active sessions for the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Maximum number of sessions to return (0 = no limit)"
// @Param offset query int false "Number of sessions to skip"
// @Success 200 {object} ListSessionsResponse "List of sessions with pagination"
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
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
		return respondInternalError(c, "Failed to list sessions", err)
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
// @Success 200 {object} chatmodel.Session "Session details"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions/{id} [get]
func (h *Handler) HandleGetSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	session, err := h.loadOwnedSession(c, userID)
	if err != nil {
		return err
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
// @Param limit query int false "Maximum number of messages to return (0 = no limit)"
// @Param offset query int false "Number of messages to skip"
// @Success 200 {object} GetMessagesResponse "Messages with pagination"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions/{id}/messages [get]
func (h *Handler) HandleGetSessionMessages(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	session, err := h.loadOwnedSession(c, userID)
	if err != nil {
		return err
	}

	limitVal := parseNonNegativeInt(c.Query("limit"))
	offsetVal := parseNonNegativeInt(c.Query("offset"))

	messages, err := h.SessionRepo.GetSessionMessages(c.Context(), session.ID, limitVal, offsetVal)
	if err != nil {
		return respondInternalError(c, "Failed to get messages", err)
	}

	if messages == nil {
		messages = []*chatmodel.Message{}
	}

	totalVal, err := h.SessionRepo.CountMessagesBySession(c.Context(), session.ID)
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
// @Param request body UpdateSessionRequest true "Title and/or summary"
// @Success 200 {object} MessageResponse "Confirmation"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions/{id} [patch]
func (h *Handler) HandleUpdateSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	session, err := h.loadOwnedSession(c, userID)
	if err != nil {
		return err
	}

	var req UpdateSessionRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if req.Title == "" && req.Summary == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "At least one of 'title' or 'summary' is required")
	}

	if err := h.applySessionUpdate(c.Context(), session.ID, req); err != nil {
		return respondInternalError(c, "Failed to update session", err)
	}

	return handlerutil.RespondMessage(c, "Session updated")
}

// applySessionUpdate writes only the fields present in req so a title-only
// PATCH never clears the consolidation summary and vice versa.
func (h *Handler) applySessionUpdate(ctx context.Context, sessionID string, req UpdateSessionRequest) error {
	switch {
	case req.Summary == "":
		return h.SessionRepo.UpdateTitle(ctx, sessionID, req.Title)
	case req.Title == "":
		return h.SessionRepo.UpdateContextSummary(ctx, sessionID, req.Summary)
	default:
		return h.SessionRepo.UpdateTitleAndSummary(ctx, sessionID, req.Title, req.Summary)
	}
}

// HandleDeleteSession godoc
// @Summary Delete a session
// @Description Soft-deletes a session owned by the authenticated user
// @Tags Sessions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} MessageResponse "Confirmation"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/sessions/{id} [delete]
func (h *Handler) HandleDeleteSession(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	session, err := h.loadOwnedSession(c, userID)
	if err != nil {
		return err
	}

	if err := h.SessionRepo.DeleteSession(c.Context(), session.ID); err != nil {
		return respondInternalError(c, "Failed to delete session", err)
	}

	return handlerutil.RespondMessage(c, "Session soft deleted")
}
