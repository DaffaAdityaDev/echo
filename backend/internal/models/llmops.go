package models

import (
	"time"
)

type PromptTemplate struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	ActiveVersion int       `json:"active_version"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PromptVersion struct {
	ID           string   `json:"id"`
	TemplateID   string   `json:"template_id"`
	Version      int      `json:"version"`
	SystemPrompt string   `json:"system_prompt"`
	BoundTools   []string `json:"bound_tools"`
	Variables    []string `json:"variables"`
	Status       string   `json:"status"`
	CreatedBy    string   `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
}

type EvalDataset struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenant_id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	TestCases   []TestCase `json:"test_cases"`
	CreatedBy   string     `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
}

type TestCase struct {
	Input          string `json:"input"`
	ExpectedOutput string `json:"expected_output"`
}

type EvalRun struct {
	ID              string           `json:"id"`
	PromptVersionID string           `json:"prompt_version_id"`
	DatasetID       *string          `json:"dataset_id,omitempty"`
	PassRate        int              `json:"pass_rate"`
	ScoreAccuracy   int              `json:"score_accuracy"`
	ScoreFormat     int              `json:"score_format"`
	ScoreTools      int              `json:"score_tools"`
	Details         []map[string]any `json:"details"`
	ExecutedBy      string           `json:"executed_by"`
	CreatedAt       time.Time        `json:"created_at"`
}

type ShadowRun struct {
	ID                 string    `json:"id"`
	TemplateID         string    `json:"template_id"`
	LiveVersionID      string    `json:"live_version_id"`
	CandidateVersionID string    `json:"candidate_version_id"`
	UserQuery          string    `json:"user_query"`
	LiveOutput         string    `json:"live_output"`
	ShadowOutput       string    `json:"shadow_output"`
	LiveCostUSD        float64   `json:"live_cost_usd"`
	ShadowCostUSD      float64   `json:"shadow_cost_usd"`
	LiveLatencyMS      int       `json:"live_latency_ms"`
	ShadowLatencyMS    int       `json:"shadow_latency_ms"`
	CreatedAt          time.Time `json:"created_at"`
}

type AuditLog struct {
	ID        string         `json:"id"`
	TenantID  string         `json:"tenant_id"`
	Actor     string         `json:"actor"`
	Action    string         `json:"action"`
	Resource  string         `json:"resource"`
	Payload   map[string]any `json:"payload"`
	CreatedAt time.Time      `json:"created_at"`
}

type AgentMissionPayload struct {
	MissionID            string         `json:"mission_id,omitempty"`
	TemplateID           string         `json:"template_id,omitempty"`
	PromptVersionID      string         `json:"prompt_version_id,omitempty"`
	SystemPromptOverride string         `json:"system_prompt_override,omitempty"`
	Prompt               string         `json:"prompt"`
	Tools                []string       `json:"tools,omitempty"`
	ProviderConfig       map[string]any `json:"provider_config,omitempty"`
}

type AgentResult struct {
	Content   string  `json:"content"`
	CostUSD   float64 `json:"cost_usd"`
	LatencyMS int     `json:"latency_ms"`
}
