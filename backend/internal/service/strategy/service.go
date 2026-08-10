package strategy

import (
	"context"
	"echo-backend/internal/models/config"
	"echo-backend/internal/repository/settings"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const DefaultStrategyVersion = "nlah:v1"

// StrategyVersionInfo describes a single strategy version.
type StrategyVersionInfo struct {
	// Version is the strategy version identifier, e.g. nlah:v1.
	Version string `json:"version"`
	// Status is the version lifecycle state: active|deprecated.
	Status string `json:"status"`
	// Aliases lists alternative version names.
	Aliases []string `json:"aliases"`
	// Rollout is the gateway rollout percentage 0-100, omitted when unconfigured.
	Rollout *float64 `json:"rollout,omitempty"`
}

// StrategyRegistryEntry describes one strategy and its available versions.
type StrategyRegistryEntry struct {
	// Name is the strategy name.
	Name string `json:"name"`
	// Versions lists the available versions of the strategy.
	Versions []StrategyVersionInfo `json:"versions"`
}

// CatalogResponse is the strategy catalog payload.
type CatalogResponse struct {
	// Strategies lists the strategy catalog entries.
	Strategies []StrategyRegistryEntry `json:"strategies"`
}

type RolloutCfg struct {
	Rollout *float64 `json:"rollout"`
}

type Service struct {
	cfg          *cfgmodel.Config
	settingsRepo *settings.Repository
	rdb          *redis.Client
	httpClient   *http.Client
}

func NewService(cfg *cfgmodel.Config, settingsRepo *settings.Repository, rdb *redis.Client) *Service {
	return &Service{
		cfg:          cfg,
		settingsRepo: settingsRepo,
		rdb:          rdb,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *Service) GetCatalog(ctx context.Context) ([]StrategyRegistryEntry, error) {
	cacheKey := "agent:strategies"
	if s.rdb != nil {
		if val, err := s.rdb.Get(ctx, cacheKey).Result(); err == nil && val != "" {
			var resp CatalogResponse
			if err := json.Unmarshal([]byte(val), &resp); err == nil {
				return resp.Strategies, nil
			}
		}
	}

	url := fmt.Sprintf("%s/api/strategies", s.cfg.AgentHTTPURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create strategy catalog request: %w", err)
	}
	req.Header.Set("X-Internal-Token", s.cfg.InternalAuthToken)

	res, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch strategy catalog from agent: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agent catalog status code: %d", res.StatusCode)
	}

	var resp CatalogResponse
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return nil, fmt.Errorf("failed to decode agent catalog response: %w", err)
	}

	if s.rdb != nil {
		if data, err := json.Marshal(resp); err == nil {
			s.rdb.Set(ctx, cacheKey, data, 10*time.Minute)
		}
	}

	return resp.Strategies, nil
}

func (s *Service) GetRollout(ctx context.Context) (map[string]RolloutCfg, error) {
	cacheKey := "strategy:rollout"
	if s.rdb != nil {
		if val, err := s.rdb.Get(ctx, cacheKey).Result(); err == nil && val != "" {
			var rollouts map[string]RolloutCfg
			if err := json.Unmarshal([]byte(val), &rollouts); err == nil {
				return rollouts, nil
			}
		}
	}

	raw, err := s.settingsRepo.GetAppSetting(ctx, "strategy_rollout")
	if err != nil {
		return nil, fmt.Errorf("failed to query app setting strategy_rollout: %w", err)
	}

	rollouts := make(map[string]RolloutCfg)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &rollouts)
	}

	if s.rdb != nil {
		if data, err := json.Marshal(rollouts); err == nil {
			s.rdb.Set(ctx, cacheKey, data, 10*time.Minute)
		}
	}

	return rollouts, nil
}

var ErrInvalidStrategyVersion = fmt.Errorf("invalid or deprecated strategy version requested")

func (s *Service) GetDefaultRollout() float64 {
	if s.cfg != nil && s.cfg.StrategyRolloutDefault > 0 {
		return s.cfg.StrategyRolloutDefault
	}
	return 0.1
}

func (s *Service) IsValidVersion(ctx context.Context, version string) bool {
	if version == "" {
		return true
	}
	version = strings.ToLower(strings.TrimSpace(version))
	catalog, err := s.GetCatalog(ctx)
	if err != nil {
		return true
	}
	for _, entry := range catalog {
		for _, vInfo := range entry.Versions {
			if strings.ToLower(strings.TrimSpace(vInfo.Version)) == version || containsString(vInfo.Aliases, version) {
				return true
			}
		}
	}
	return false
}

func (s *Service) ResolveVersion(ctx context.Context, sessionStrategyVersion, requestedVersion string, userID int) (string, error) {
	if sessionStrategyVersion != "" {
		return sessionStrategyVersion, nil
	}

	catalog, err := s.GetCatalog(ctx)
	if err != nil {
		if requestedVersion != "" {
			return requestedVersion, nil
		}
		return DefaultStrategyVersion, nil
	}

	rollouts, _ := s.GetRollout(ctx)

	return resolveVersion(catalog, rollouts, s.GetDefaultRollout(), requestedVersion, userID)
}

func resolveVersion(catalog []StrategyRegistryEntry, rollouts map[string]RolloutCfg, defaultRollout float64, requestedVersion string, userID int) (string, error) {
	if requestedVersion != "" {
		requested := strings.ToLower(strings.TrimSpace(requestedVersion))
		for _, entry := range catalog {
			for _, vInfo := range entry.Versions {
				if strings.ToLower(strings.TrimSpace(vInfo.Version)) == requested || containsString(vInfo.Aliases, requested) {
					if vInfo.Status == "deprecated" {
						return "", ErrInvalidStrategyVersion
					}
					return vInfo.Version, nil
				}
			}
		}
		return "", ErrInvalidStrategyVersion
	}

	if len(rollouts) == 0 {
		return DefaultStrategyVersion, nil
	}

	userFraction := float64(userID%100) / 100.0

	for _, entry := range catalog {
		for _, vInfo := range entry.Versions {
			if vInfo.Status == "deprecated" {
				continue
			}
			rCfg, configured := rollouts[vInfo.Version]
			if !configured {
				continue
			}
			rolloutPct := defaultRollout
			if rCfg.Rollout != nil {
				rolloutPct = *rCfg.Rollout
			}
			if rolloutPct <= 0 {
				continue
			}
			if userFraction < rolloutPct {
				return vInfo.Version, nil
			}
		}
	}

	return DefaultStrategyVersion, nil
}

func containsString(slice []string, val string) bool {
	for _, item := range slice {
		if strings.EqualFold(item, val) {
			return true
		}
	}
	return false
}
