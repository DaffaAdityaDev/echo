package service

import (
	"context"
	"fmt"
	"log"

	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"echo-backend/pkg/crypto"
)

type SettingsService struct {
	cfg          *models.Config
	settingsRepo *repository.SettingsRepository
}

func NewSettingsService(cfg *models.Config, settingsRepo *repository.SettingsRepository) *SettingsService {
	return &SettingsService{
		cfg:          cfg,
		settingsRepo: settingsRepo,
	}
}

func (s *SettingsService) GetDefaults() *models.UserPreferences {
	defaultFeatures := []string{"web_search", "write_todos"}
	return &models.UserPreferences{
		UserID:         0,
		DefaultMode:    "standard",
		DefaultModel:   s.cfg.DefaultModel,
		DefaultFeatures: defaultFeatures,
		DefaultSkills:  []string{},
		ProviderType:   "opencode-go",
		APIKey:         "",
		BaseURL:        defaultBaseURL("opencode-go"),
	}
}

func (s *SettingsService) GetSettings(ctx context.Context, userID int) (*models.UserPreferences, error) {
	prefs, err := s.settingsRepo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if prefs == nil {
		return s.GetDefaults(), nil
	}

	// Decrypt API key (graceful failure on ENCRYPTION_KEY rotation)
	if prefs.APIKey != "" {
		decrypted, decErr := crypto.Decrypt(prefs.APIKey, []byte(s.cfg.EncryptionKey))
		if decErr != nil {
			log.Printf("[SETTINGS] Failed to decrypt API key for user %d: %v", userID, decErr)
			prefs.APIKey = ""
		} else {
			prefs.APIKey = decrypted
		}
	}

	// Mask API key before returning to client
	prefs.APIKey = crypto.MaskAPIKey(prefs.APIKey)

	if prefs.DefaultModel == "" {
		prefs.DefaultModel = s.cfg.DefaultModel
	}
	if prefs.ProviderType == "" {
		prefs.ProviderType = "opencode-go"
	}
	if prefs.BaseURL == "" {
		prefs.BaseURL = defaultBaseURL(prefs.ProviderType)
	}

	return prefs, nil
}

func (s *SettingsService) UpdateSettings(ctx context.Context, userID int, prefs *models.UserPreferences, keepAPIKey bool) (*models.UserPreferences, error) {
	// Determine API key strategy
	if keepAPIKey && prefs.APIKey == "" {
		// User wants to keep existing key — fetch current encrypted key
		existing, err := s.settingsRepo.Get(ctx, userID)
		if err == nil && existing != nil && existing.APIKey != "" {
			prefs.APIKey = existing.APIKey // Already encrypted, preserve as-is
		}
	} else if prefs.APIKey != "" {
		// New key provided — encrypt it
		encrypted, encErr := crypto.Encrypt(prefs.APIKey, []byte(s.cfg.EncryptionKey))
		if encErr != nil {
			return nil, fmt.Errorf("failed to encrypt API key: %w", encErr)
		}
		prefs.APIKey = encrypted
	}
	// else: prefs.APIKey == "" && !keepAPIKey → clear the key (store empty)

	updated, err := s.settingsRepo.Upsert(ctx, userID, prefs)
	if err != nil {
		return nil, err
	}

	if updated.APIKey != "" {
		decrypted, decErr := crypto.Decrypt(updated.APIKey, []byte(s.cfg.EncryptionKey))
		if decErr != nil {
			log.Printf("[SETTINGS] Failed to decrypt API key after update for user %d: %v", userID, decErr)
			updated.APIKey = ""
		} else {
			updated.APIKey = crypto.MaskAPIKey(decrypted)
		}
	}

	return updated, nil
}

// GetSettingsInternal returns raw (decrypted, unmasked) preferences for internal service-to-service use.
func (s *SettingsService) GetSettingsInternal(ctx context.Context, userID int) (*models.UserPreferences, error) {
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
			log.Printf("[SETTINGS] Failed to decrypt API key for user %d: %v", userID, decErr)
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
		prefs.BaseURL = defaultBaseURL(prefs.ProviderType)
	}

	return prefs, nil
}
