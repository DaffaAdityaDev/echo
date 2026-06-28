package service

import (
	"context"
	"echo-backend/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

const openCodeGoPrefix = "opencode-go/"

type openCodeGoCache struct {
	mu        sync.RWMutex
	models    []models.ModelInfo
	expiresAt time.Time
}

type lmStudioCache struct {
	mu        sync.RWMutex
	models    []models.ModelInfo
	expiresAt time.Time
}

type ModelService interface {
	GetModels(ctx context.Context) ([]models.ModelInfo, error)
	ResolveModel(modelID string) (*models.ProviderConfig, error)
	GetDefault() *models.ProviderConfig
}

type modelService struct {
	cfg     *models.Config
	goCache openCodeGoCache
	lmCache lmStudioCache
}

func NewModelService(cfg *models.Config) ModelService {
	return &modelService{cfg: cfg}
}

func (s *modelService) GetModels(ctx context.Context) ([]models.ModelInfo, error) {
	var result []models.ModelInfo

	if s.cfg.OpenAIAPIKey != "" {
		for _, m := range s.cfg.OpenAIModels {
			result = append(result, models.ModelInfo{
				ID:           m,
				Name:         m,
				ProviderType: models.ProviderOpenAI,
				ProviderName: "OpenAI",
			})
		}
	}

	if s.cfg.AnthropicAPIKey != "" {
		for _, m := range s.cfg.AnthropicModels {
			result = append(result, models.ModelInfo{
				ID:           m,
				Name:         m,
				ProviderType: models.ProviderAnthropic,
				ProviderName: "Anthropic",
			})
		}
	}

	if s.cfg.LMStudioBaseURL != "" {
		lmModels := s.getCachedLMStudioModels(ctx)
		result = append(result, lmModels...)
	}

	if s.cfg.OpenCodeGoAPIKey != "" {
		goModels := s.getCachedOpenCodeModels(ctx)
		result = append(result, goModels...)
	}

	return result, nil
}

func (s *modelService) ResolveModel(modelID string) (*models.ProviderConfig, error) {
	for _, m := range s.cfg.OpenAIModels {
		if m == modelID {
			apiKey := s.cfg.OpenAIAPIKey
			return &models.ProviderConfig{
				Type:    models.ProviderOpenAI,
				BaseURL: s.cfg.OpenAIBaseURL,
				APIKey:  apiKey,
				Model:   modelID,
			}, nil
		}
	}

	for _, m := range s.cfg.AnthropicModels {
		if m == modelID {
			return &models.ProviderConfig{
				Type:    models.ProviderAnthropic,
				BaseURL: s.cfg.AnthropicBaseURL,
				APIKey:  s.cfg.AnthropicAPIKey,
				Model:   modelID,
			}, nil
		}
	}

	if s.cfg.OpenCodeGoAPIKey != "" && strings.HasPrefix(modelID, openCodeGoPrefix) {
		suffix := strings.TrimPrefix(modelID, openCodeGoPrefix)
		return &models.ProviderConfig{
			Type:    models.ProviderOpenCode,
			BaseURL: "https://opencode.ai/zen/go/v1",
			APIKey:  s.cfg.OpenCodeGoAPIKey,
			Model:   suffix,
		}, nil
	}

	if s.cfg.LMStudioBaseURL != "" {
		lmModels := s.getCachedLMStudioModels(context.Background())
		for _, lm := range lmModels {
			if lm.ID == modelID {
				return &models.ProviderConfig{
					Type:    models.ProviderLMStudio,
					BaseURL: s.cfg.LMStudioBaseURL,
					APIKey:  s.cfg.LMStudioAPIKey,
					Model:   modelID,
				}, nil
			}
		}
		if strings.HasPrefix(modelID, "lmstudio") || strings.HasPrefix(modelID, "local") {
			return &models.ProviderConfig{
				Type:    models.ProviderLMStudio,
				BaseURL: s.cfg.LMStudioBaseURL,
				APIKey:  s.cfg.LMStudioAPIKey,
				Model:   modelID,
			}, nil
		}
	}

	return nil, fmt.Errorf("unknown model: %s", modelID)
}

func (s *modelService) GetDefault() *models.ProviderConfig {
	cfg, err := s.ResolveModel(s.cfg.DefaultModel)
	if err != nil {
		if s.cfg.OpenAIAPIKey == "" {
			log.Printf("warning: GetDefault() fallback with no OpenAI API key configured")
		}
		return &models.ProviderConfig{
			Type:    models.ProviderOpenAI,
			BaseURL: s.cfg.OpenAIBaseURL,
			APIKey:  s.cfg.OpenAIAPIKey,
			Model:   s.cfg.DefaultModel,
		}
	}
	return cfg
}

func (s *modelService) getCachedOpenCodeModels(ctx context.Context) []models.ModelInfo {
	s.goCache.mu.RLock()
	if time.Now().Before(s.goCache.expiresAt) {
		defer s.goCache.mu.RUnlock()
		return s.goCache.models
	}
	s.goCache.mu.RUnlock()

	s.goCache.mu.Lock()
	defer s.goCache.mu.Unlock()
	if time.Now().Before(s.goCache.expiresAt) {
		return s.goCache.models
	}

	models, err := s.fetchOpenCodeGoModels(ctx)
	if err != nil {
		log.Printf("opencode-go: failed to fetch models: %v", err)
		return nil
	}
	s.goCache.models = models
	s.goCache.expiresAt = time.Now().Add(5 * time.Minute)
	return models
}

func (s *modelService) getCachedLMStudioModels(ctx context.Context) []models.ModelInfo {
	s.lmCache.mu.RLock()
	if time.Now().Before(s.lmCache.expiresAt) {
		defer s.lmCache.mu.RUnlock()
		return s.lmCache.models
	}
	s.lmCache.mu.RUnlock()

	s.lmCache.mu.Lock()
	defer s.lmCache.mu.Unlock()
	if time.Now().Before(s.lmCache.expiresAt) {
		return s.lmCache.models
	}

	models, err := s.fetchLMStudioModels(ctx)
	if err != nil {
		log.Printf("lm-studio: failed to fetch models from %s: %v", s.cfg.LMStudioBaseURL, err)
		return nil
	}
	s.lmCache.models = models
	s.lmCache.expiresAt = time.Now().Add(30 * time.Second)
	return models
}

func (s *modelService) fetchOpenCodeGoModels(ctx context.Context) ([]models.ModelInfo, error) {
	url := "https://opencode.ai/zen/go/v1/models"
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.OpenCodeGoAPIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apiResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, err
	}

	var items []models.ModelInfo
	for _, m := range apiResp.Data {
		items = append(items, models.ModelInfo{
			ID:           openCodeGoPrefix + m.ID,
			Name:         m.ID,
			ProviderType: openCodeProviderType(m.ID),
			ProviderName: "OpenCode Go",
		})
	}
	return items, nil
}

func openCodeProviderType(modelID string) models.ProviderType {
	return models.ProviderOpenCode
}

func (s *modelService) fetchLMStudioModels(ctx context.Context) ([]models.ModelInfo, error) {
	url := fmt.Sprintf("%s/v1/models", s.cfg.LMStudioBaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var lmResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &lmResp); err != nil {
		return nil, err
	}

	var items []models.ModelInfo
	for _, m := range lmResp.Data {
		items = append(items, models.ModelInfo{
			ID:           m.ID,
			Name:         m.ID,
			ProviderType: models.ProviderLMStudio,
			ProviderName: "LM Studio",
		})
	}
	return items, nil
}
