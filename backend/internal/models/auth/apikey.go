package authmodel

import "time"

type ApiKey struct {
	ID        string    `json:"id" example:"key_a1b2c3d4e5f6"`             // Unique API key ID
	KeyHash   string    `json:"-"`                                         // SHA-256 hash of the full secret key (never serialized)
	Prefix    string    `json:"prefix" example:"sk_a1b2c3d4"`              // Prefix of the full key, shown for display purposes
	Name      string    `json:"name" example:"Production API Key"`         // Display name for the API key
	Scopes    []string  `json:"scopes" example:"read,write,admin"`         // Optional permission scopes
	UserID    string    `json:"user_id" example:"1"`                       // ID of the user who owns the key
	Status    string    `json:"status" example:"active"`                   // Key status (e.g. active, revoked)
	CreatedAt time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"` // Key creation time
}
