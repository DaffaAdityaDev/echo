package aimodel

import (
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/ai"
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
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	modelsList, err := h.ModelSvc.GetModels(c.Context(), userID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve models", err.Error())
	}
	if modelsList == nil {
		modelsList = []aitype.ModelInfo{}
	}
	return handlerutil.RespondSuccess(c, fiber.Map{"models": modelsList})
}
