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

// HandleGetModels godoc
// @Summary List available AI models
// @Description Returns the AI model catalog available to the authenticated user
// @Tags Models
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Router /api/v1/models [get]
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
