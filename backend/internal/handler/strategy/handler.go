package strategy

import (
	"echo-backend/internal/handler/handlerutil"
	stratSvc "echo-backend/internal/service/strategy"
	"log/slog"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	strategySvc *stratSvc.Service
}

func NewHandler(strategySvc *stratSvc.Service) *Handler {
	return &Handler{strategySvc: strategySvc}
}

// HandleGetStrategies godoc
// @Summary List strategy catalog
// @Description Returns the strategy catalog merged with gateway rollout percentages
// @Tags Strategies
// @Produce json
// @Security BearerAuth
// @Success 200 {object} stratSvc.CatalogResponse "Strategy catalog with rollout percentages"
// @Failure 500 {object} map[string]string
// @Router /api/v1/strategies [get]
func (h *Handler) HandleGetStrategies(c fiber.Ctx) error {
	catalog, err := h.strategySvc.GetCatalog(c.Context())
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve strategy catalog", err.Error())
	}

	rollouts, err := h.strategySvc.GetRollout(c.Context())
	if err != nil {
		slog.Warn("failed to load rollout percentages, returning catalog without them", "component", "strategy", "err", err)
		rollouts = map[string]stratSvc.RolloutCfg{}
	}
	defaultRollout := h.strategySvc.GetDefaultRollout()

	for i := range catalog {
		for j := range catalog[i].Versions {
			vName := catalog[i].Versions[j].Version
			rCfg, exists := rollouts[vName]
			if !exists {
				continue
			}
			val := defaultRollout
			if rCfg.Rollout != nil {
				val = *rCfg.Rollout
			}
			catalog[i].Versions[j].Rollout = &val
		}
	}

	return handlerutil.RespondSuccess(c, stratSvc.CatalogResponse{Strategies: catalog})
}
