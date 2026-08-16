package chat

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

// HandleApproveTool godoc
// @Summary Approve a pending tool call
// @Description Approves a human-in-the-loop tool approval request for a session
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID with a pending tool approval request. The session must belong to the authenticated user (403 otherwise)."
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id}/approve [post]
func (h *Handler) HandleApproveTool(c fiber.Ctx) error {
	return h.handleHitlAction(c, "approve")
}

// HandleDenyTool godoc
// @Summary Deny a pending tool call
// @Description Denies a human-in-the-loop tool approval request for a session
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID with a pending tool approval request. The session must belong to the authenticated user (403 otherwise)."
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id}/deny [post]
func (h *Handler) HandleDenyTool(c fiber.Ctx) error {
	return h.handleHitlAction(c, "deny")
}

func (h *Handler) handleHitlAction(c fiber.Ctx, action string) error {
	sessionID := c.Params("id")
	if sessionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "session ID required")
	}

	sess, err := h.SessionRepo.GetByID(c.Context(), sessionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session", err.Error())
	}
	if sess == nil || sess.Status == "deleted" {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
	}
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}
	if sess.UserID != userID {
		return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
	}

	var body map[string]interface{}
	if err := c.Bind().JSON(&body); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	agentURL := fmt.Sprintf("%s/api/v1/sessions/%s/%s", h.Cfg.AgentHTTPURL, sessionID, action)
	jsonPayload, err := json.Marshal(body)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Failed to serialize request body")
	}

	agentReq, err := http.NewRequestWithContext(c.Context(), "POST", agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request")
	}
	agentReq.Header.Set("Content-Type", "application/json")
	agentReq.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "Agent unreachable")
	}
	defer func() { _ = resp.Body.Close() }()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		slog.Error("failed to read agent response", "component", "chat", "action", action, "session_id", sessionID, "err", err)
		return handlerutil.RespondError(c, resp.StatusCode, "Agent rejected")
	}
	if resp.StatusCode != http.StatusOK {
		return handlerutil.RespondErrorDetail(c, resp.StatusCode, "Agent rejected", string(bodyBytes))
	}

	c.Response().Header.Set("Content-Type", "text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache, no-transform")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("Transfer-Encoding", "chunked")
	c.Response().Header.Set("X-Accel-Buffering", "no")

	return c.SendStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(resp.Body)
		for {
			line, rErr := reader.ReadBytes('\n')
			if len(line) > 0 {
				if _, wErr := w.Write(line); wErr != nil {
					break
				}
				if err := w.Flush(); err != nil {
					break
				}
			}
			if rErr != nil {
				break
			}
		}
	})
}
