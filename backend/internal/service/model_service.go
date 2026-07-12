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

var httpClient = &http.Client{}

const openCodeGoPrefix = "opencode-go/"

type modelCache struct {
	mu        sync.RWMutex
	models    []models.ModelInfo
	expiresAt time.Time
}

type ModelService struct {
	cfg     *models.Config
	goCache modelCache
	lmCache modelCache
}

func NewModelService(cfg *models.Config) *ModelService {
	return &ModelService{cfg: cfg}
}

func (s *ModelService) GetModels(ctx context.Context) ([]models.ModelInfo, error) {
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

func (s *ModelService) ResolveModel(modelID string) (*models.ProviderConfig, error) {
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

func (s *ModelService) GetDefault() *models.ProviderConfig {
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

func (s *ModelService) getCachedModels(ctx context.Context, cache *modelCache, ttl time.Duration, fetch func(context.Context) ([]models.ModelInfo, error)) []models.ModelInfo {
	cache.mu.RLock()
	if time.Now().Before(cache.expiresAt) {
		defer cache.mu.RUnlock()
		return cache.models
	}
	cache.mu.RUnlock()

	cache.mu.Lock()
	defer cache.mu.Unlock()
	if time.Now().Before(cache.expiresAt) {
		return cache.models
	}

	models, err := fetch(ctx)
	if err != nil {
		log.Printf("failed to fetch models: %v", err)
		return nil
	}
	cache.models = models
	cache.expiresAt = time.Now().Add(ttl)
	return models
}

func (s *ModelService) getCachedOpenCodeModels(ctx context.Context) []models.ModelInfo {
	return s.getCachedModels(ctx, &s.goCache, 5*time.Minute, s.fetchOpenCodeGoModels)
}

func (s *ModelService) getCachedLMStudioModels(ctx context.Context) []models.ModelInfo {
	return s.getCachedModels(ctx, &s.lmCache, 30*time.Second, s.fetchLMStudioModels)
}

func (s *ModelService) fetchModels(ctx context.Context, url, apiKey string, transform func(id string) models.ModelInfo) ([]models.ModelInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := httpClient.Do(req)
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
		items = append(items, transform(m.ID))
	}
	return items, nil
}

func (s *ModelService) fetchOpenCodeGoModels(ctx context.Context) ([]models.ModelInfo, error) {
	return s.fetchModels(ctx, "https://opencode.ai/zen/go/v1/models", s.cfg.OpenCodeGoAPIKey, func(id string) models.ModelInfo {
		return models.ModelInfo{
			ID:           openCodeGoPrefix + id,
			Name:         id,
			ProviderType: models.ProviderOpenCode,
			ProviderName: "OpenCode Go",
		}
	})
}

func (s *ModelService) fetchLMStudioModels(ctx context.Context) ([]models.ModelInfo, error) {
	return s.fetchModels(ctx, fmt.Sprintf("%s/v1/models", s.cfg.LMStudioBaseURL), "", func(id string) models.ModelInfo {
		return models.ModelInfo{
			ID:           id,
			Name:         id,
			ProviderType: models.ProviderLMStudio,
			ProviderName: "LM Studio",
		}
	})
}
