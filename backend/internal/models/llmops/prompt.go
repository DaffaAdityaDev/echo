package llmopsmodel

import "time"

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
	ID           string    `json:"id"`
	TemplateID   string    `json:"template_id"`
	Version      int       `json:"version"`
	SystemPrompt string    `json:"system_prompt"`
	BoundTools   []string  `json:"bound_tools"`
	Variables    []string  `json:"variables"`
	Status       string    `json:"status"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
}
