package llmopsmodel

import "time"

// PromptTemplate is a prompt template owned by a tenant.
type PromptTemplate struct {
	// ID is the unique identifier of the template.
	ID string `json:"id"`
	// TenantID is the tenant that owns the template.
	TenantID string `json:"tenant_id"`
	// Name is the display name of the template.
	Name string `json:"name"`
	// Description is a human-readable description of the template.
	Description string `json:"description"`
	// ActiveVersion is the version currently promoted to production.
	ActiveVersion int `json:"active_version"`
	// CreatedAt is when the template was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt is when the template was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// PromptVersion is a single version of a prompt template.
type PromptVersion struct {
	// ID is the unique identifier of the version.
	ID string `json:"id"`
	// TemplateID is the template this version belongs to.
	TemplateID string `json:"template_id"`
	// Version is the version number, incrementing within a template.
	Version int `json:"version"`
	// SystemPrompt is the full system prompt text.
	SystemPrompt string `json:"system_prompt"`
	// BoundTools are the tools the prompt is allowed to call.
	BoundTools []string `json:"bound_tools"`
	// Variables are the template variables used by the prompt.
	Variables []string `json:"variables"`
	// Status is the lifecycle status of the version (draft|production).
	Status string `json:"status"`
	// CreatedBy is the actor who created the version.
	CreatedBy string `json:"created_by"`
	// CreatedAt is when the version was created.
	CreatedAt time.Time `json:"created_at"`
}
