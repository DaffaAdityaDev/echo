package aimodel

import (
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models"
	"echo-backend/internal/service/aimodel"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	ModelSvc *aimodel.Service
}

func NewHandler(modelSvc *aimodel.Service) *Handler {
	return &Handler{ModelSvc: modelSvc}
}

func (h *Handler) HandleGetModels(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
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
