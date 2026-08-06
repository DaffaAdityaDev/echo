package features

import (
	"context"
	"echo-backend/internal/models/config"
	featuresmodel "echo-backend/internal/models/features"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

const implementedCacheKey = "agent:features"

const implementedCacheTTL = 10 * time.Minute

type ImplementedFeature struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type FeatureResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Locked      bool   `json:"locked"`
}

type ErrUnknownFeature struct {
	ID string
}

func (e ErrUnknownFeature) Error() string {
	return fmt.Sprintf("Unknown feature '%s'", e.ID)
}

type ErrFeatureLocked struct {
	Name string
}

func (e ErrFeatureLocked) Error() string {
	return fmt.Sprintf("Feature '%s' requires a Pro subscription.", e.Name)
}

type FeatureRepository interface {
	ListActive(ctx context.Context) ([]featuresmodel.Feature, error)
}

type Service struct {
	cfg        *cfgmodel.Config
	rdb        *redis.Client
	repo       FeatureRepository
	httpClient *http.Client
}

func NewService(cfg *cfgmodel.Config, rdb *redis.Client, repo FeatureRepository) *Service {
	return &Service{
		cfg:        cfg,
		rdb:        rdb,
		repo:       repo,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *Service) GetImplementedSet(ctx context.Context) ([]ImplementedFeature, error) {
	if s.rdb != nil {
		cached, err := s.rdb.Get(ctx, implementedCacheKey).Result()
		if err == nil && cached != "" {
			var features []ImplementedFeature
			if err := json.Unmarshal([]byte(cached), &features); err == nil {
				return features, nil
			}
		}
	}

	agentURL := fmt.Sprintf("%s/api/features", s.cfg.AgentHTTPURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, agentURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create agent features request: %w", err)
	}
	req.Header.Set("X-Internal-Token", s.cfg.InternalAuthToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch implemented features from agent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("agent features request failed: status %d, details: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read agent features response: %w", err)
	}

	var features []ImplementedFeature
	if err := json.Unmarshal(bodyBytes, &features); err != nil {
		return nil, fmt.Errorf("failed to decode agent features response: %w", err)
	}

	if s.rdb != nil {
		if err := s.rdb.Set(ctx, implementedCacheKey, bodyBytes, implementedCacheTTL).Err(); err != nil {
			log.Printf("[FEATURES] Failed to cache implemented features in Redis: %v", err)
		}
	}

	return features, nil
}

func (s *Service) ResolvePublicCatalog(ctx context.Context, userTier string) ([]FeatureResponse, error) {
	active, err := s.repo.ListActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load active features: %w", err)
	}

	implemented, err := s.GetImplementedSet(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load implemented features: %w", err)
	}

	implementedIDs := make(map[string]struct{}, len(implemented))
	for _, f := range implemented {
		implementedIDs[f.ID] = struct{}{}
	}

	response := make([]FeatureResponse, 0, len(active))
	for _, f := range active {
		if _, ok := implementedIDs[f.ID]; !ok {
			continue
		}
		response = append(response, FeatureResponse{
			ID:          f.ID,
			Name:        f.Name,
			Description: f.Description,
			Locked:      userTier == "free" && f.TierRequirement == "pro",
		})
	}
	return response, nil
}

// ValidateRequest checks requested feature IDs against the active DB catalog
// intersected with the agent's implemented set. Unknown features return
// ErrUnknownFeature; pro-tier features requested by a free user return
// ErrFeatureLocked. If either catalog cannot be loaded, validation is skipped
// (fail-open), preserving the pre-existing chat behavior.
func (s *Service) ValidateRequest(ctx context.Context, featureIDs []string, userTier string) error {
	if len(featureIDs) == 0 {
		return nil
	}

	active, err := s.repo.ListActive(ctx)
	if err != nil {
		log.Printf("[FEATURES] ValidateRequest: failed to load active features, skipping validation: %v", err)
		return nil
	}

	implemented, err := s.GetImplementedSet(ctx)
	if err != nil {
		log.Printf("[FEATURES] ValidateRequest: failed to load implemented features, skipping validation: %v", err)
		return nil
	}

	implementedIDs := make(map[string]struct{}, len(implemented))
	for _, f := range implemented {
		implementedIDs[f.ID] = struct{}{}
	}

	activeByID := make(map[string]featuresmodel.Feature, len(active))
	for _, f := range active {
		activeByID[f.ID] = f
	}

	for _, id := range featureIDs {
		feat, known := activeByID[id]
		if _, implemented := implementedIDs[id]; !known || !implemented {
			return ErrUnknownFeature{ID: id}
		}
		if userTier == "free" && feat.TierRequirement == "pro" {
			return ErrFeatureLocked{Name: feat.Name}
		}
	}
	return nil
}
