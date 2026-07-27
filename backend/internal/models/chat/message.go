package chatmodel

import (
	"encoding/json"
	"time"
)

type Message struct {
	ID         int64           `json:"id" example:"42"`
	SessionID  string          `json:"session_id" example:"sess_abc123"`
	Role       string          `json:"role" example:"assistant"`
	Content    string          `json:"content" example:"Echo is an AI agent platform that can autonomously execute complex tasks by reasoning, using tools, and learning from feedback."`
	TokenCount int             `json:"token_count" example:"156"`
	TurnNumber int             `json:"turn_number" example:"3"`
	Steps      json.RawMessage `json:"steps,omitempty"`
	Status     string          `json:"status" example:"complete"`
	CreatedAt  time.Time       `json:"created_at" example:"2026-01-15T10:35:00Z"`
}
