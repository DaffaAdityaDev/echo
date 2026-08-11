package chat

import (
	"context"
	"fmt"
	"net/http"

	"echo-backend/internal/handler/handlerutil"
	cfgmodel "echo-backend/internal/models/config"

	"github.com/gofiber/fiber/v3"
)

// HandleInterrupt godoc
// @Summary Interrupt an in-flight chat turn
// @Description Requests cancellation of the currently streaming mission for a session. Idempotent: sessions without an active run return success without side effects. The turn is finalized as interrupted when the stream ends.
// @Tags Chat
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID with an in-flight mission. The session must belong to the authenticated user (403 otherwise)."
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/sessions/{id}/cancel [post]
func (h *Handler) HandleInterrupt(c fiber.Ctx) error {
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

	// Signal the active run (if any). Idempotent: no active run → no-op.
	activeRunsMu.Lock()
	run := activeRuns[sessionID]
	activeRunsMu.Unlock()
	if run != nil {
		select {
		case <-run.cancelCh:
		default:
			close(run.cancelCh)
		}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{"status": "ok"})
}

// cancelAgentMission asks the agent to cancel the mission for a session. The
// agent aborts the in-flight LLM provider stream via its CancellationManager.
func cancelAgentMission(ctx context.Context, cfg *cfgmodel.Config, sessionID string) error {
	agentURL := fmt.Sprintf("%s/api/v1/sessions/%s/cancel", cfg.AgentHTTPURL, sessionID)
	req, err := http.NewRequestWithContext(ctx, "POST", agentURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Internal-Token", cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("agent cancel rejected with status %d", resp.StatusCode)
	}
	return nil
}
