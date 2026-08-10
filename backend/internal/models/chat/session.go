package chatmodel

import "time"

type Session struct {
	// Unique session identifier
	ID string `json:"id" example:"sess_abc123"`
	// ID of the session owner
	UserID int `json:"user_id" example:"1"`
	// Session title
	Title string `json:"title" example:"Build a REST API with Express"`
	// Summarized context of the conversation
	ContextSummary string `json:"context_summary" example:"User is building a REST API for a todo app using Express and Prisma"`
	// Session status: "active" or "deleted"
	Status string `json:"status" example:"active"`
	// Strategy version from the catalog, e.g. nlah:v1
	StrategyVersion string `json:"strategy_version,omitempty" example:"nlah:v1"`
	// Timestamp of the last access
	LastAccessedAt time.Time `json:"last_accessed_at,omitempty" example:"2026-01-15T11:45:00Z"`
	// Timestamp of session creation
	CreatedAt time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
	// Timestamp of the last update
	UpdatedAt time.Time `json:"updated_at" example:"2026-01-15T11:45:00Z"`
	// Number of messages in the session
	MessageCount int `json:"message_count,omitempty" example:"12"`
	// Approximate token count of the session
	TokenCount int `json:"token_count,omitempty" example:"3421"`
}
