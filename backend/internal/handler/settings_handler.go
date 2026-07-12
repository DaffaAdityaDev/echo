package handler

import (
	"echo-backend/internal/models"
	"echo-backend/internal/service"

	"github.com/gofiber/fiber/v3"
)

type SettingsHandler struct {
	Cfg           *models.Config
	SettingsSvc   *service.SettingsService
}

func NewSettingsHandler(cfg *models.Config, settingsSvc *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		Cfg:         cfg,
		SettingsSvc: settingsSvc,
	}
}

type UpdateSettingsRequest struct {
	DefaultMode     string   `json:"default_mode"`
	DefaultModel    string   `json:"default_model"`
	DefaultFeatures []string `json:"default_features"`
	DefaultSkills   []string `json:"default_skills"`
}

func (h *SettingsHandler) HandleGetSettings(c fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	prefs, err := h.SettingsSvc.GetSettings(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get settings", "details": err.Error()})
	}

	return c.JSON(prefs)
}

func (h *SettingsHandler) HandleUpdateSettings(c fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UpdateSettingsRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	prefs := &models.UserPreferences{
		DefaultMode:     req.DefaultMode,
		DefaultModel:    req.DefaultModel,
		DefaultFeatures: req.DefaultFeatures,
		DefaultSkills:   req.DefaultSkills,
	}

	updated, err := h.SettingsSvc.UpdateSettings(c.Context(), userID, prefs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update settings", "details": err.Error()})
	}

	return c.JSON(updated)
}

func (h *SettingsHandler) HandleGetDefaults(c fiber.Ctx) error {
	defaults := h.SettingsSvc.GetDefaults()
	return c.JSON(defaults)
}
