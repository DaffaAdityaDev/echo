package usermodel

// UserPreferences represents a user's persisted chat and provider settings.
type UserPreferences struct {
	// UserID is the owning user's ID; 0 when these are platform defaults.
	UserID int `json:"user_id" example:"1"`
	// DefaultMode is the preferred chat mode: standard|agent.
	DefaultMode string `json:"default_mode" example:"agent"`
	// DefaultModel is the preferred model ID or name.
	DefaultModel string `json:"default_model" example:"gpt-4o"`
	// DefaultFeatures lists the enabled agent features.
	DefaultFeatures []string `json:"default_features" example:"web-browsing,code-interpreter"`
	// DefaultSkills lists the enabled agent skills.
	DefaultSkills []string `json:"default_skills" example:"python,research"`
	// ProviderType is the LLM provider type, e.g. opencode-go.
	ProviderType string `json:"provider_type" example:"opencode-go"`
	// APIKey is the stored provider API key; always empty on read.
	APIKey string `json:"api_key,omitempty" example:""`
	// HasAPIKey reports whether a provider API key is stored.
	HasAPIKey bool `json:"has_api_key"`
	// BaseURL is a custom provider base URL.
	BaseURL string `json:"base_url" example:"https://opencode.ai/zen/go/v1"`
	// HarnessToggles holds agent harness feature toggles.
	HarnessToggles *HarnessFeatureToggles `json:"harness_toggles,omitempty"`
}

// HarnessFeatureToggles groups the agent harness feature toggles.
type HarnessFeatureToggles struct {
	// LoopDetection enables detection of repeated identical agent calls.
	LoopDetection *LoopDetectionConfig `json:"loopDetection,omitempty"`
	// BudgetMonitor enables enforcement of step, duration, and cost budgets.
	BudgetMonitor *BudgetMonitorConfig `json:"budgetMonitor,omitempty"`
	// SystemNotices enables emitting warnings as system notices.
	SystemNotices *SystemNoticesConfig `json:"systemNotices,omitempty"`
	// HitlGuard enables requiring human approval for protected tools.
	HitlGuard *HitlGuardConfig `json:"hitlGuard,omitempty"`
	// ContextOptimization enables context window optimization.
	ContextOptimization *ContextOptimizationConfig `json:"contextOptimization,omitempty"`
}

// LoopDetectionConfig configures detection of identical repeated calls.
type LoopDetectionConfig struct {
	// Enabled turns loop detection on or off.
	Enabled bool `json:"enabled"`
	// EnableExactMatch matches repeated identical calls exactly.
	EnableExactMatch *bool `json:"enableExactMatch,omitempty"`
	// EnableCosineSimilarity matches repeated calls by cosine similarity.
	EnableCosineSimilarity *bool `json:"enableCosineSimilarity,omitempty"`
	// MaxConsecutiveIdenticalCalls caps consecutive identical calls before warning.
	MaxConsecutiveIdenticalCalls *int `json:"maxConsecutiveIdenticalCalls,omitempty"`
	// SimilarityThreshold is the 0-1 similarity score that counts as a match.
	SimilarityThreshold *float64 `json:"similarityThreshold,omitempty"`
	// WindowSize is the number of recent calls examined for loops.
	WindowSize *int `json:"windowSize,omitempty"`
}

// BudgetMonitorConfig configures budget enforcement for agent runs.
type BudgetMonitorConfig struct {
	// Enabled turns budget monitoring on or off.
	Enabled bool `json:"enabled"`
	// EnforceMaxSteps enforces the maximum number of agent steps.
	EnforceMaxSteps *bool `json:"enforceMaxSteps,omitempty"`
	// MaxSteps is the maximum number of agent steps allowed.
	MaxSteps *int `json:"maxSteps,omitempty"`
	// EnforceTimeout enforces the maximum run duration.
	EnforceTimeout *bool `json:"enforceTimeout,omitempty"`
	// MaxDurationMs is the maximum run duration in milliseconds.
	MaxDurationMs *int `json:"maxDurationMs,omitempty"`
	// EnforceCostCap enforces the maximum spend.
	EnforceCostCap *bool `json:"enforceCostCap,omitempty"`
	// MaxCostUsd is the maximum spend in USD.
	MaxCostUsd *float64 `json:"maxCostUsd,omitempty"`
}

// SystemNoticesConfig configures which warnings surface as system notices.
type SystemNoticesConfig struct {
	// Enabled turns system notices on or off.
	Enabled bool `json:"enabled"`
	// EmitLoopWarnings emits loop detection warnings as notices.
	EmitLoopWarnings *bool `json:"emitLoopWarnings,omitempty"`
	// EmitCompactionNotices emits context compaction notices.
	EmitCompactionNotices *bool `json:"emitCompactionNotices,omitempty"`
	// EmitBudgetWarnings emits budget limit warnings as notices.
	EmitBudgetWarnings *bool `json:"emitBudgetWarnings,omitempty"`
	// EmitPacingWarnings emits pacing throttling warnings as notices.
	EmitPacingWarnings *bool `json:"emitPacingWarnings,omitempty"`
}

// HitlGuardConfig configures human-in-the-loop approval for protected tools.
type HitlGuardConfig struct {
	// Enabled turns the hitl guard on or off.
	Enabled bool `json:"enabled"`
	// ProtectedTools lists tools requiring human approval.
	ProtectedTools []string `json:"protectedTools,omitempty"`
	// TtlMinutes is how long an approval stays valid, in minutes.
	TtlMinutes *int `json:"ttlMinutes,omitempty"`
}

// ContextOptimizationConfig configures context window optimizations.
type ContextOptimizationConfig struct {
	// Enabled turns context optimization on or off.
	Enabled bool `json:"enabled"`
	// EnablePrefixCachingLayout optimizes message layout for prefix caching.
	EnablePrefixCachingLayout *bool `json:"enablePrefixCachingLayout,omitempty"`
	// EnableAutoCompaction automatically compacts context when it grows.
	EnableAutoCompaction *bool `json:"enableAutoCompaction,omitempty"`
	// CompactionThresholdRatio is the usage ratio that triggers compaction.
	CompactionThresholdRatio *float64 `json:"compactionThresholdRatio,omitempty"`
	// KeepLastTurnsCount is the number of recent turns kept after compaction.
	KeepLastTurnsCount *int `json:"keepLastTurnsCount,omitempty"`
}
