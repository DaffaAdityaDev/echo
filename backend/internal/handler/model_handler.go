package handler

import (
	"echo-backend/internal/models"
	"echo-backend/internal/service"
	"github.com/gofiber/fiber/v3"
)

type ModelHandler struct {
	ModelSvc *service.ModelService
}

func NewModelHandler(modelSvc *service.ModelService) *ModelHandler {
	return &ModelHandler{ModelSvc: modelSvc}
}

// @Summary Get available LLM models for the authenticated user
// @Description Fetch models from the user's configured provider using their API key
// @Tags Models
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "List of available models"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to retrieve models"
// @Router /api/v1/models [get]
func (h *ModelHandler) HandleGetModels(c fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	modelsList, err := h.ModelSvc.GetModels(c.Context(), userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve models", "details": err.Error()})
	}
	if modelsList == nil {
		modelsList = []models.ModelInfo{}
	}
	return c.JSON(fiber.Map{"models": modelsList})
}
