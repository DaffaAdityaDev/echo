package service

import (
	"context"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
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
	return prefs, nil
}

func (s *SettingsService) UpdateSettings(ctx context.Context, userID int, prefs *models.UserPreferences) (*models.UserPreferences, error) {
	return s.settingsRepo.Upsert(ctx, userID, prefs)
}
