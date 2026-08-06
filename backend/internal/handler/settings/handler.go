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
	DefaultMode     string                           `json:"default_mode"`
	DefaultModel    string                           `json:"default_model"`
	DefaultFeatures []string                         `json:"default_features"`
	DefaultSkills   []string                         `json:"default_skills"`
	ProviderType    string                           `json:"provider_type"`
	APIKey          *string                          `json:"api_key"`
	KeepAPIKey      bool                             `json:"keep_api_key"`
	BaseURL         string                           `json:"base_url"`
	HarnessToggles  *usermodel.HarnessFeatureToggles `json:"harness_toggles"`
}

// HandleGetSettings godoc
// @Summary Get user settings
// @Description Returns the authenticated user's preferences
// @Tags Settings
// @Produce json
// @Security BearerAuth
// @Success 200 {object} usermodel.UserPreferences
// @Failure 401 {object} map[string]string
// @Router /api/v1/settings [get]
func (h *Handler) HandleGetSettings(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	prefs, err := h.SettingsSvc.GetSettings(c.Context(), userID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to get settings", err.Error())
	}

	return handlerutil.RespondSuccess(c, prefs)
}

// HandleUpdateSettings godoc
// @Summary Update user settings
// @Description Updates the authenticated user's preferences
// @Tags Settings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateSettingsRequest true "Settings payload"
// @Success 200 {object} usermodel.UserPreferences
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/v1/settings [put]
func (h *Handler) HandleUpdateSettings(c fiber.Ctx) error {
	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	var req UpdateSettingsRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request body")
	}

	if req.ProviderType != "" && !aitype.IsValidProvider(req.ProviderType) {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Unknown provider type: "+req.ProviderType)
	}

	prefs := &usermodel.UserPreferences{
		DefaultMode:     req.DefaultMode,
		DefaultModel:    req.DefaultModel,
		DefaultFeatures: req.DefaultFeatures,
		DefaultSkills:   req.DefaultSkills,
		ProviderType:    req.ProviderType,
		BaseURL:         req.BaseURL,
		HarnessToggles:  req.HarnessToggles,
	}
	if req.APIKey != nil {
		prefs.APIKey = *req.APIKey
	}

	updated, err := h.SettingsSvc.UpdateSettings(c.Context(), userID, prefs, req.KeepAPIKey)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to update settings", err.Error())
	}

	return handlerutil.RespondSuccess(c, updated)
}

// HandleGetDefaults godoc
// @Summary Get default settings
// @Description Returns platform-wide default settings
// @Tags Settings
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/settings/defaults [get]
func (h *Handler) HandleGetDefaults(c fiber.Ctx) error {
	defaults := h.SettingsSvc.GetDefaults()
	return handlerutil.RespondSuccess(c, defaults)
}
