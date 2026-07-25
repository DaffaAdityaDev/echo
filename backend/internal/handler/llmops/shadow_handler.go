package llmops

import (
	"strconv"

	"echo-backend/internal/service/llmops"
	"github.com/gofiber/fiber/v3"
)

type ShadowHandler struct {
	shadowSvc llmops.ShadowService
}

func NewShadowHandler(shadowSvc llmops.ShadowService) *ShadowHandler {
	return &ShadowHandler{shadowSvc: shadowSvc}
}

func (h *ShadowHandler) HandleGetShadowHistory(c fiber.Ctx) error {
	templateID := c.Params("id")
	limitStr := c.Query("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	runs, err := h.shadowSvc.GetComparisonHistory(c.Context(), templateID, limit)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"shadow_runs": runs})
}
