package settings

import (
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"
	"echo-backend/internal/service/settings"

	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	Cfg         *cfgmodel.Config
	SettingsSvc *settings.Service
}

func NewHandler(cfg *cfgmodel.Config, settingsSvc *settings.Service) *Handler {
	return &Handler{
		Cfg:         cfg,
		SettingsSvc: settingsSvc,
	}
}

type UpdateSettingsRequest struct {
	DefaultMode     string   `json:"default_mode"`
	DefaultModel    string   `json:"default_model"`
	DefaultFeatures []string `json:"default_features"`
	DefaultSkills   []string `json:"default_skills"`
	ProviderType    string   `json:"provider_type"`
	APIKey          *string  `json:"api_key"`
	KeepAPIKey      bool     `json:"keep_api_key"`
	BaseURL         string   `json:"base_url"`
}

func (h *Handler) HandleGetSettings(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	prefs, err := h.SettingsSvc.GetSettings(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get settings", "details": err.Error()})
	}

	return c.JSON(prefs)
}

func (h *Handler) HandleUpdateSettings(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UpdateSettingsRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ProviderType != "" && !aitype.IsValidProvider(req.ProviderType) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unknown provider type: " + req.ProviderType})
	}

	prefs := &usermodel.UserPreferences{
		DefaultMode:     req.DefaultMode,
		DefaultModel:    req.DefaultModel,
		DefaultFeatures: req.DefaultFeatures,
		DefaultSkills:   req.DefaultSkills,
		ProviderType:    req.ProviderType,
		BaseURL:         req.BaseURL,
	}
	if req.APIKey != nil {
		prefs.APIKey = *req.APIKey
	}

	updated, err := h.SettingsSvc.UpdateSettings(c.Context(), userID, prefs, req.KeepAPIKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update settings", "details": err.Error()})
	}

	return c.JSON(updated)
}

func (h *Handler) HandleGetDefaults(c fiber.Ctx) error {
	defaults := h.SettingsSvc.GetDefaults()
	return c.JSON(defaults)
}
