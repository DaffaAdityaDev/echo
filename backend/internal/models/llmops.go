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
