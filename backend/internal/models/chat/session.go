package chatmodel

import "time"

type Session struct {
	ID              string    `json:"id" example:"sess_abc123"`
	UserID          int       `json:"user_id" example:"1"`
	Title           string    `json:"title" example:"Build a REST API with Express"`
	ContextSummary  string    `json:"context_summary" example:"User is building a REST API for a todo app using Express and Prisma"`
	Status          string    `json:"status" example:"active"`
	StrategyVersion string    `json:"strategy_version,omitempty" example:"nlah:v1"`
	LastAccessedAt  time.Time `json:"last_accessed_at,omitempty" example:"2026-01-15T11:45:00Z"`
	CreatedAt       time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
	UpdatedAt       time.Time `json:"updated_at" example:"2026-01-15T11:45:00Z"`
	MessageCount    int       `json:"message_count,omitempty" example:"12"`
	TokenCount      int       `json:"token_count,omitempty" example:"3421"`
}
