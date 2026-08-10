package llmops

import (
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/llmops"
	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type AgentPromptHandler struct {
	promptSvc llmops.PromptService
}

func NewAgentPromptHandler(promptSvc llmops.PromptService) *AgentPromptHandler {
	return &AgentPromptHandler{promptSvc: promptSvc}
}

// HandleGetAgentActivePrompt godoc
// @Summary Get active prompt for the agent (internal)
// @Description Returns the active production prompt version for the agent (service-to-service)
// @Tags Internal
// @Produce json
// @Param template query string true "Template name"
// @Success 200 {object} llmopsmodel.PromptVersion "Active production prompt version"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Security InternalAuth
// @Router /api/v1/internal/prompts/active [get]
func (h *AgentPromptHandler) HandleGetAgentActivePrompt(c fiber.Ctx) error {
	template := c.Query("template")
	if template == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Query parameter 'template' is required")
	}

	tenantID := c.Get("X-Tenant-ID", "local")
	var pv *llmopsmodel.PromptVersion
	pv, err := h.promptSvc.GetActivePrompt(c.Context(), tenantID, template)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, err.Error())
	}

	return handlerutil.RespondSuccess(c, pv)
}
