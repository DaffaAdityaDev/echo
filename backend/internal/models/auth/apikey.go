package authmodel

import "time"

type ApiKey struct {
	ID        string    `json:"id" example:"key_a1b2c3d4e5f6"`
	KeyHash   string    `json:"-"`
	Prefix    string    `json:"prefix" example:"sk_a1b2c3d4"`
	Name      string    `json:"name" example:"Production API Key"`
	Scopes    []string  `json:"scopes" example:"read,write,admin"`
	UserID    string    `json:"user_id" example:"1"`
	Status    string    `json:"status" example:"active"`
	CreatedAt time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
}
