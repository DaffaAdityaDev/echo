package features

import (
	"echo-backend/internal/handler/handlerutil"
	featuresvc "echo-backend/internal/service/features"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	featuresSvc *featuresvc.Service
}

func NewHandler(featuresSvc *featuresvc.Service) *Handler {
	return &Handler{featuresSvc: featuresSvc}
}

// HandleGetFeatures godoc
// @Summary List available agent features
// @Description Returns the catalog of agent features with tier-based locking
// @Tags Chat
// @Produce json
// @Param X-User-Tier header string false "User tier, default pro"
// @Success 200 {array} featuresvc.FeatureResponse "Catalog of agent features for the user's tier"
// @Failure 500 {object} map[string]string
// @Router /api/v1/features [get]
func (h *Handler) HandleGetFeatures(c fiber.Ctx) error {
	userTier := c.Get("X-User-Tier")
	if userTier == "" {
		userTier = "pro"
	}

	features, err := h.featuresSvc.ResolvePublicCatalog(c.Context(), userTier)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve features", err.Error())
	}

	return handlerutil.RespondSuccess(c, features)
}
