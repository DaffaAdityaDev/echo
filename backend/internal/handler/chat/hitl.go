package chat

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	httpxconst "echo-backend/internal/constants/httpx"
	msgconst "echo-backend/internal/constants/msg"
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
// @Failure 502 {object} map[string]string
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
// @Failure 502 {object} map[string]string
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

	agentReq, err := http.NewRequestWithContext(c.Context(), http.MethodPost, agentURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create request")
	}
	agentReq.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	agentReq.Header.Set(httpxconst.HeaderXInternalToken, h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(agentReq)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadGateway, "Agent unreachable")
	}
	if resp.StatusCode != http.StatusOK {
		detail, readErr := readUpstreamError(resp)
		if readErr != nil {
			slog.Error(msgconst.ErrChatReadAgentResponse, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyAction, action, msgconst.KeySessionID, sessionID, msgconst.KeyErr, readErr)
		}
		return handlerutil.RespondErrorDetail(c, upstreamFailureStatus(resp.StatusCode), "Agent rejected", detail)
	}

	setSSEHeaders(c)

	// fasthttp runs the stream writer on its own goroutine after the handler
	// returns, so the agent body is owned and closed by the writer.
	return c.SendStreamWriter(func(w *bufio.Writer) {
		defer func() { _ = resp.Body.Close() }()
		if err := relaySSE(w, resp.Body); err != nil {
			slog.Error(msgconst.ErrChatAgentStreamAborted, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyAction, action, msgconst.KeySessionID, sessionID, msgconst.KeyErr, err)
		}
	})
}

// relaySSE forwards the agent's SSE stream line by line, flushing each line so
// the client sees packets as they arrive. A clean upstream EOF is not an error.
func relaySSE(w *bufio.Writer, body io.Reader) error {
	reader := bufio.NewReader(body)
	for {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			if _, err := w.Write(line); err != nil {
				return fmt.Errorf("write to client: %w", err)
			}
			if err := w.Flush(); err != nil {
				return fmt.Errorf("flush to client: %w", err)
			}
		}
		if errors.Is(readErr, io.EOF) {
			return nil
		}
		if readErr != nil {
			return fmt.Errorf("read agent stream: %w", readErr)
		}
	}
}
