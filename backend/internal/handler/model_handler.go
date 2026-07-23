package handler

import (
	"echo-backend/internal/service"
	"github.com/gofiber/fiber/v3"
)

type ModelHandler struct {
	ModelSvc *service.ModelService
}

func NewModelHandler(modelSvc *service.ModelService) *ModelHandler {
	return &ModelHandler{ModelSvc: modelSvc}
}

// @Summary Get available LLM models
// @Description Fetch aggregated LLM model catalog from configured providers (OpenAI, Anthropic, LM Studio, OpenCode Go)
// @Tags Models
// @Produce json
// @Success 200 {object} map[string]interface{} "List of available models"
// @Failure 500 {object} map[string]string "Failed to retrieve models"
// @Router /api/v1/models [get]
func (h *ModelHandler) HandleGetModels(c fiber.Ctx) error {
	models, err := h.ModelSvc.GetModels(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve models", "details": err.Error()})
	}
	return c.JSON(fiber.Map{"models": models})
}
