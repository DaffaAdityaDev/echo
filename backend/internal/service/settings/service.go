package settings

import (
	"context"
	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"
	"echo-backend/internal/repository/settings"
	aimodel "echo-backend/internal/service/aimodel"
	"echo-backend/pkg/crypto"
	"encoding/json"
	"fmt"
	"log/slog"
)

const PromptTemplateSettingKey = "prompt_template_name"

func ResolvePromptTemplateName(raw []byte, tenantID, fallback string) string {
	var mapping map[string]string
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &mapping); err != nil {
			slog.Warn("failed to parse prompt_template_name app setting", "component", "settings", "err", err)
		}
	}
	if name := mapping[tenantID]; name != "" {
		return name
	}
	if name := mapping["default"]; name != "" {
		return name
	}
	return fallback
}

type Service struct {
	cfg          *cfgmodel.Config
	settingsRepo *settings.Repository
}

func NewService(cfg *cfgmodel.Config, settingsRepo *settings.Repository) *Service {
	return &Service{
		cfg:          cfg,
		settingsRepo: settingsRepo,
	}
}

func (s *Service) GetDefaults() *usermodel.UserPreferences {
	defaultFeatures := []string{"write_todos"}
	return &usermodel.UserPreferences{
		UserID:          0,
		DefaultMode:     "standard",
		DefaultModel:    s.cfg.DefaultModel,
		DefaultFeatures: defaultFeatures,
		DefaultSkills:   []string{},
		ProviderType:    "opencode-go",
		APIKey:          "",
		BaseURL:         aimodel.DefaultBaseURL("opencode-go"),
	}
}

func (s *Service) GetSettings(ctx context.Context, userID int) (*usermodel.UserPreferences, error) {
	prefs, err := s.settingsRepo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if prefs == nil {
		return s.GetDefaults(), nil
	}

	prefs.HasAPIKey = prefs.APIKey != ""
	prefs.APIKey = ""

	if prefs.DefaultModel == "" {
		prefs.DefaultModel = s.cfg.DefaultModel
	}
	if prefs.ProviderType == "" {
		prefs.ProviderType = "opencode-go"
	}
	if prefs.BaseURL == "" {
		prefs.BaseURL = aimodel.DefaultBaseURL(prefs.ProviderType)
	}

	return prefs, nil
}

func (s *Service) UpdateSettings(ctx context.Context, userID int, prefs *usermodel.UserPreferences, keepAPIKey bool) (*usermodel.UserPreferences, error) {
	if keepAPIKey && prefs.APIKey == "" {
		existing, err := s.settingsRepo.Get(ctx, userID)
		if err == nil && existing != nil && existing.APIKey != "" {
			prefs.APIKey = existing.APIKey
		}
	} else if prefs.APIKey != "" {
		encrypted, encErr := crypto.Encrypt(prefs.APIKey, []byte(s.cfg.EncryptionKey))
		if encErr != nil {
			return nil, fmt.Errorf("failed to encrypt API key: %w", encErr)
		}
		prefs.APIKey = encrypted
	}

	updated, err := s.settingsRepo.Upsert(ctx, userID, prefs)
	if err != nil {
		return nil, err
	}

	updated.HasAPIKey = updated.APIKey != ""
	updated.APIKey = ""

	return updated, nil
}

func (s *Service) GetSettingsInternal(ctx context.Context, userID int) (*usermodel.UserPreferences, error) {
	prefs, err := s.settingsRepo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if prefs == nil {
		return s.GetDefaults(), nil
	}

	if prefs.APIKey != "" {
		decrypted, decErr := crypto.Decrypt(prefs.APIKey, []byte(s.cfg.EncryptionKey))
		if decErr != nil {
			slog.Error("failed to decrypt api key", "component", "settings", "user_id", userID, "err", decErr)
			prefs.APIKey = ""
		} else {
			prefs.APIKey = decrypted
		}
	}

	if prefs.DefaultModel == "" {
		prefs.DefaultModel = s.cfg.DefaultModel
	}
	if prefs.ProviderType == "" {
		prefs.ProviderType = "opencode-go"
	}
	if prefs.BaseURL == "" {
		prefs.BaseURL = aimodel.DefaultBaseURL(prefs.ProviderType)
	}

	return prefs, nil
}

func (s *Service) ResolvePromptTemplateNameForTenant(ctx context.Context, tenantID string) (string, error) {
	raw, err := s.settingsRepo.GetAppSetting(ctx, PromptTemplateSettingKey)
	if err != nil {
		return "", fmt.Errorf("failed to query app setting %s: %w", PromptTemplateSettingKey, err)
	}

	cfgDefault := ""
	if s.cfg != nil {
		cfgDefault = s.cfg.PromptTemplateName
	}

	res := ResolvePromptTemplateName(raw, tenantID, cfgDefault)
	if res != "" {
		return res, nil
	}

	latest, err := s.settingsRepo.GetLatestActivePromptTemplateName(ctx, tenantID)
	if err != nil {
		slog.Warn("failed to query latest active prompt template", "component", "settings", "err", err)
		return "", nil
	}

	return latest, nil
}
