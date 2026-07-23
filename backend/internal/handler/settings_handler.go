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

// @Summary Get user settings
// @Description Retrieve current user preference settings
// @Tags Settings
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.UserPreferences
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to get settings"
// @Router /api/v1/settings [get]
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

// @Summary Update user settings
// @Description Save modified user preference settings
// @Tags Settings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateSettingsRequest true "Settings payload"
// @Success 200 {object} models.UserPreferences
// @Failure 400 {object} map[string]string "Invalid request body"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to update settings"
// @Router /api/v1/settings [put]
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

// @Summary Get system default settings
// @Description Retrieve baseline application defaults for modes, models, and features
// @Tags Settings
// @Produce json
// @Success 200 {object} models.UserPreferences
// @Router /api/v1/settings/defaults [get]
func (h *SettingsHandler) HandleGetDefaults(c fiber.Ctx) error {
	defaults := h.SettingsSvc.GetDefaults()
	return c.JSON(defaults)
}
