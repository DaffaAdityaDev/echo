package aimodel

import (
	"context"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	authconst "echo-backend/internal/constants/auth"
	msgconst "echo-backend/internal/constants/msg"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

const openCodeGoPrefix = "opencode-go/"

type cacheEntry struct {
	models    []aitype.ModelInfo
	err       error
	expiresAt time.Time
}

type modelCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
}

type SettingsProvider interface {
	GetSettingsInternal(ctx context.Context, userID int) (*usermodel.UserPreferences, error)
}

type Service struct {
	cfg         *cfgmodel.Config
	settingsSvc SettingsProvider
	cache       modelCache
}

func NewService(cfg *cfgmodel.Config, settingsSvc SettingsProvider) *Service {
	return &Service{cfg: cfg, settingsSvc: settingsSvc, cache: modelCache{entries: make(map[string]cacheEntry)}}
}

func cacheKey(providerType, baseURL string) string {
	return providerType + "|" + baseURL
}

func isMultimodalModel(id string) bool {
	lower := strings.ToLower(id)
	return strings.Contains(lower, "4o") ||
		strings.Contains(lower, "4.1") ||
		strings.Contains(lower, "4.5") ||
		strings.Contains(lower, "vision") ||
		strings.Contains(lower, "gpt-4-turbo") ||
		strings.Contains(lower, "claude-3") ||
		strings.Contains(lower, "claude-4") ||
		strings.Contains(lower, "claude-sonnet") ||
		strings.Contains(lower, "claude-opus") ||
		strings.Contains(lower, "o1") ||
		strings.Contains(lower, "o3") ||
		strings.Contains(lower, "o4") ||
		strings.Contains(lower, "-vl") ||
		strings.Contains(lower, "llava") ||
		strings.Contains(lower, "gemini")
}

// DefaultBaseURL returns the well-known base URL for a provider type, or an
// empty string when the provider has no default (e.g. a custom gateway).
func DefaultBaseURL(providerType string) string {
	switch providerType {
	case "opencode-go":
		return "https://opencode.ai/zen/go/v1"
	case "lm-studio":
		return "http://localhost:1234/v1"
	case "openai":
		return "https://api.openai.com/v1"
	case "anthropic":
		return "https://api.anthropic.com"
	}
	return ""
}

func (s *Service) GetModels(ctx context.Context, userID int) ([]aitype.ModelInfo, error) {
	prefs, err := s.settingsSvc.GetSettingsInternal(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}
	if prefs == nil || prefs.ProviderType == "" {
		return []aitype.ModelInfo{}, nil
	}
	if prefs.APIKey == "" && prefs.ProviderType != "lm-studio" {
		return []aitype.ModelInfo{}, nil
	}
	if prefs.BaseURL == "" {
		prefs.BaseURL = DefaultBaseURL(prefs.ProviderType)
	}

	return s.getCachedModels(ctx, prefs.ProviderType, prefs.APIKey, prefs.BaseURL)
}

func (s *Service) getCachedModels(ctx context.Context, providerType, apiKey, baseURL string) ([]aitype.ModelInfo, error) {
	key := cacheKey(providerType, baseURL)

	s.cache.mu.RLock()
	entry, ok := s.cache.entries[key]
	if ok && time.Now().Before(entry.expiresAt) {
		s.cache.mu.RUnlock()
		return entry.models, entry.err
	}
	s.cache.mu.RUnlock()

	s.cache.mu.Lock()
	entry, ok = s.cache.entries[key]
	if ok && time.Now().Before(entry.expiresAt) {
		s.cache.mu.Unlock()
		return entry.models, entry.err
	}

	models, err := s.fetchProviderModels(ctx, providerType, apiKey, baseURL)
	if err != nil {
		slog.Error(msgconst.ErrAimodelFetchModels, msgconst.ComponentKey, msgconst.ComponentModel, msgconst.KeyProvider, providerType, msgconst.KeyErr, err)
		s.cache.entries[key] = cacheEntry{err: err, expiresAt: time.Now().Add(30 * time.Second)}
		s.cache.mu.Unlock()
		return nil, fmt.Errorf("fetch provider models: %w", err)
	}

	s.cache.entries[key] = cacheEntry{models: models, expiresAt: time.Now().Add(30 * time.Second)}
	s.cache.mu.Unlock()
	return models, nil
}

func modelsURL(baseURL string) string {
	base := strings.TrimRight(baseURL, "/")
	if !strings.HasSuffix(base, "/v1") {
		return base + "/v1/models"
	}
	return base + "/models"
}

func (s *Service) fetchProviderModels(ctx context.Context, providerType, apiKey, baseURL string) ([]aitype.ModelInfo, error) {
	switch providerType {
	case "opencode-go":
		return s.fetchModels(ctx, providerType, "https://opencode.ai/zen/go/v1/models", apiKey, func(id string) aitype.ModelInfo {
			return aitype.ModelInfo{
				ID:                 openCodeGoPrefix + id,
				Name:               id,
				ProviderType:       aitype.ProviderOpenCode,
				ProviderName:       "OpenCode Go",
				SupportsMultimodal: isMultimodalModel(id),
				MaxContextTokens:   aitype.ContextWindowFor(aitype.ProviderOpenCode, id),
			}
		})
	case "lm-studio":
		return s.fetchModels(ctx, providerType, modelsURL(baseURL), apiKey, func(id string) aitype.ModelInfo {
			return aitype.ModelInfo{
				ID:                 id,
				Name:               id,
				ProviderType:       aitype.ProviderLMStudio,
				ProviderName:       "LM Studio",
				SupportsMultimodal: isMultimodalModel(id),
				MaxContextTokens:   aitype.ContextWindowFor(aitype.ProviderLMStudio, id),
			}
		})
	case "openai":
		return s.fetchModels(ctx, providerType, modelsURL(baseURL), apiKey, func(id string) aitype.ModelInfo {
			return aitype.ModelInfo{
				ID:                 id,
				Name:               id,
				ProviderType:       aitype.ProviderOpenAI,
				ProviderName:       "OpenAI",
				SupportsMultimodal: isMultimodalModel(id),
				MaxContextTokens:   aitype.ContextWindowFor(aitype.ProviderOpenAI, id),
			}
		})
	case "anthropic":
		return s.fetchModels(ctx, providerType, modelsURL(baseURL), apiKey, func(id string) aitype.ModelInfo {
			return aitype.ModelInfo{
				ID:                 id,
				Name:               id,
				ProviderType:       aitype.ProviderAnthropic,
				ProviderName:       "Anthropic",
				SupportsMultimodal: isMultimodalModel(id),
				MaxContextTokens:   aitype.ContextWindowFor(aitype.ProviderAnthropic, id),
			}
		})
	default:
		return nil, fmt.Errorf("unknown provider: %s", providerType)
	}
}

func (s *Service) fetchModels(ctx context.Context, providerType, url, apiKey string, transform func(id string) aitype.ModelInfo) ([]aitype.ModelInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		if providerType == "anthropic" {
			req.Header.Set("x-api-key", apiKey)
		} else {
			req.Header.Set(authconst.HeaderAuthorization, authconst.BearerPrefix+apiKey)
		}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, string(bodyBytes))
	}

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
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var items []aitype.ModelInfo
	for _, m := range apiResp.Data {
		items = append(items, transform(m.ID))
	}
	return items, nil
}

func (s *Service) ResolveProviderConfig(ctx context.Context, userID int, modelID string) (*aitype.ProviderConfig, error) {
	prefs, err := s.settingsSvc.GetSettingsInternal(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user settings: %w", err)
	}
	if prefs == nil || prefs.ProviderType == "" {
		return nil, fmt.Errorf("provider not configured: set it in Settings")
	}

	providerType := prefs.ProviderType
	apiKey := prefs.APIKey
	baseURL := prefs.BaseURL

	if apiKey == "" && providerType != "lm-studio" {
		return nil, fmt.Errorf("API key for provider %s is required: set it in Settings", providerType)
	}

	if baseURL == "" {
		baseURL = DefaultBaseURL(providerType)
	}

	modelName := modelID
	if providerType == "opencode-go" {
		modelName = strings.TrimPrefix(modelID, openCodeGoPrefix)
	}

	return &aitype.ProviderConfig{
		Type:             aitype.ProviderType(providerType),
		BaseURL:          baseURL,
		APIKey:           apiKey,
		Model:            modelName,
		MaxContextTokens: aitype.ContextWindowFor(aitype.ProviderType(providerType), modelName),
	}, nil
}
