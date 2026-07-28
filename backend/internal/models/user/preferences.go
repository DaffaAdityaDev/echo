package usermodel

type UserPreferences struct {
	UserID         int                    `json:"user_id" example:"1"`
	DefaultMode    string                 `json:"default_mode" example:"agent"`
	DefaultModel   string                 `json:"default_model" example:"gpt-4o"`
	DefaultFeatures []string               `json:"default_features" example:"web-browsing,code-interpreter"`
	DefaultSkills  []string               `json:"default_skills" example:"python,research"`
	ProviderType   string                 `json:"provider_type" example:"opencode-go"`
	APIKey         string                 `json:"api_key,omitempty" example:""`
	HasAPIKey      bool                   `json:"has_api_key"`
	BaseURL        string                 `json:"base_url" example:"https://opencode.ai/zen/go/v1"`
	HarnessToggles *HarnessFeatureToggles `json:"harness_toggles,omitempty"`
}

type HarnessFeatureToggles struct {
	LoopDetection       *LoopDetectionConfig       `json:"loopDetection,omitempty"`
	BudgetMonitor       *BudgetMonitorConfig       `json:"budgetMonitor,omitempty"`
	SystemNotices       *SystemNoticesConfig       `json:"systemNotices,omitempty"`
	HitlGuard           *HitlGuardConfig           `json:"hitlGuard,omitempty"`
	ContextOptimization *ContextOptimizationConfig `json:"contextOptimization,omitempty"`
}

type LoopDetectionConfig struct {
	Enabled                     bool     `json:"enabled"`
	EnableExactMatch            *bool    `json:"enableExactMatch,omitempty"`
	EnableCosineSimilarity      *bool    `json:"enableCosineSimilarity,omitempty"`
	MaxConsecutiveIdenticalCalls *int    `json:"maxConsecutiveIdenticalCalls,omitempty"`
	SimilarityThreshold         *float64 `json:"similarityThreshold,omitempty"`
	WindowSize                  *int     `json:"windowSize,omitempty"`
}

type BudgetMonitorConfig struct {
	Enabled         bool    `json:"enabled"`
	EnforceMaxSteps *bool   `json:"enforceMaxSteps,omitempty"`
	MaxSteps        *int    `json:"maxSteps,omitempty"`
	EnforceTimeout  *bool   `json:"enforceTimeout,omitempty"`
	MaxDurationMs   *int    `json:"maxDurationMs,omitempty"`
	EnforceCostCap  *bool   `json:"enforceCostCap,omitempty"`
	MaxCostUsd      *float64 `json:"maxCostUsd,omitempty"`
}

type SystemNoticesConfig struct {
	Enabled               bool  `json:"enabled"`
	EmitLoopWarnings      *bool `json:"emitLoopWarnings,omitempty"`
	EmitCompactionNotices *bool `json:"emitCompactionNotices,omitempty"`
	EmitBudgetWarnings    *bool `json:"emitBudgetWarnings,omitempty"`
	EmitPacingWarnings    *bool `json:"emitPacingWarnings,omitempty"`
}

type HitlGuardConfig struct {
	Enabled        bool     `json:"enabled"`
	ProtectedTools []string `json:"protectedTools,omitempty"`
	TtlMinutes     *int     `json:"ttlMinutes,omitempty"`
}

type ContextOptimizationConfig struct {
	Enabled                   bool   `json:"enabled"`
	EnablePrefixCachingLayout *bool `json:"enablePrefixCachingLayout,omitempty"`
	EnableAutoCompaction      *bool `json:"enableAutoCompaction,omitempty"`
	CompactionThresholdRatio  *float64 `json:"compactionThresholdRatio,omitempty"`
	KeepLastTurnsCount        *int    `json:"keepLastTurnsCount,omitempty"`
}
