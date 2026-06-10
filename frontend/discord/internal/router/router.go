package router

import (
	"encoding/json"
	"fmt"
	"io"
	"magi/internal/handler"
	"net/http"

	"github.com/gofiber/fiber/v3"
)

type ModelUpdateRequest struct {
	ChannelID string `json:"channel_id"`
	Model     string `json:"model"`
}

// SetupRoutes registers the HTTP route endpoints on the Fiber application instance.
func SetupRoutes(fbApp *fiber.App, healthHandler *handler.HealthHandler, discordHandler *handler.DiscordHandler) {
	fbApp.Get("/health", healthHandler.Check)

	// GET /model - Fetch and return available models from backend (Hybrid HTTP API)
	fbApp.Get("/model", func(c fiber.Ctx) error {
		backendURL := fmt.Sprintf("%s/api/v1/models", discordHandler.Cfg.BackendURL)
		resp, err := http.Get(backendURL)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to connect to backend service"})
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to read backend response"})
		}

		var modelsResp handler.ModelsResponse
		if err := json.Unmarshal(bodyBytes, &modelsResp); err != nil {
			// Fallback: return raw response if unmarshal fails
			return c.Status(resp.StatusCode).Send(bodyBytes)
		}

		// Extract IDs to return a clean string slice for the GET endpoint
		var modelsList []string
		for _, mdl := range modelsResp.Models {
			modelsList = append(modelsList, mdl.ID)
		}

		return c.JSON(modelsList)
	})

	// POST /model - Set the active model for a channel (Hybrid HTTP API)
	fbApp.Post("/model", func(c fiber.Ctx) error {
		var req ModelUpdateRequest
		if err := c.Bind().JSON(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}

		if req.ChannelID == "" || req.Model == "" {
			return c.Status(400).JSON(fiber.Map{"error": "channel_id and model are required"})
		}

		// Store in the shared Discord Handler state
		discordHandler.ChannelModels.Store(req.ChannelID, req.Model)

		return c.JSON(fiber.Map{
			"status":     "success",
			"channel_id": req.ChannelID,
			"model":      req.Model,
		})
	})
}
