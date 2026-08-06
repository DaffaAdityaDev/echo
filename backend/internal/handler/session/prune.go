package session

import (
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type PruneRequest struct {
	ProviderConfig map[string]interface{} `json:"provider_config"`
}

// HandlePruneSession godoc
// @Summary Prune and consolidate a session
// @Description Triggers token-threshold pruning and consolidation for a session (internal)
// @Tags Sessions
// @Accept json
// @Produce json
// @Param id path string true "Session ID"
// @Param request body PruneRequest true "Provider configuration"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/internal/sessions/{id}/prune [post]
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
