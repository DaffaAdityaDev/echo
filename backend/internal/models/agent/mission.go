package agentmodel

type AgentMissionPayload struct {
	SessionID          string         `json:"session_id,omitempty"`
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
