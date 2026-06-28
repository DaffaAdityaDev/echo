package handler

import (
	"echo-backend/internal/service"
	"github.com/gofiber/fiber/v3"
)

type ModelHandler struct {
	ModelSvc service.ModelService
}

func NewModelHandler(modelSvc service.ModelService) *ModelHandler {
	return &ModelHandler{ModelSvc: modelSvc}
}

func (h *ModelHandler) HandleGetModels(c fiber.Ctx) error {
	models, err := h.ModelSvc.GetModels(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve models", "details": err.Error()})
	}
	return c.JSON(fiber.Map{"models": models})
}
