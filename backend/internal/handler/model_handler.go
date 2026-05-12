package handler

import (
	"echo-backend/internal/models"
	"fmt"
	"io"
	"net/http"

	"github.com/gofiber/fiber/v3"
)

type ModelHandler struct {
	Cfg *models.Config
}

func NewModelHandler(cfg *models.Config) *ModelHandler {
	return &ModelHandler{Cfg: cfg}
}

func (h *ModelHandler) HandleGetModels(c fiber.Ctx) error {
	agentURL := fmt.Sprintf("%s/api/models", h.Cfg.AgentHTTPURL)

	resp, err := http.Get(agentURL)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Agent service unavailable"})
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return c.Status(resp.StatusCode).Send(body)
}
