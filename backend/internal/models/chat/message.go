package chatmodel

import (
	"encoding/json"
	"time"
)

type Message struct {
	// Unique message identifier
	ID int64 `json:"id" example:"42"`
	// ID of the session the message belongs to
	SessionID string `json:"session_id" example:"sess_abc123"`
	// Message role: "user", "assistant", "system", or "tool"
	Role string `json:"role" example:"assistant"`
	// Message content text
	Content string `json:"content" example:"Echo is an AI agent platform that can autonomously execute complex tasks by reasoning, using tools, and learning from feedback."`
	// Approximate token count of the message
	TokenCount int `json:"token_count" example:"156"`
	// Turn number of the message within the session
	TurnNumber int `json:"turn_number" example:"3"`
	// JSON array of agent thought steps
	Steps json.RawMessage `json:"steps,omitempty"`
	// Message status: "streaming", "complete", or "interrupted"
	Status string `json:"status" example:"complete"`
	// Timestamp of message creation
	CreatedAt time.Time `json:"created_at" example:"2026-01-15T10:35:00Z"`
}
