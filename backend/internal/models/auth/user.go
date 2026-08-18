package authmodel

import "time"

type User struct {
	ID           int       `json:"id" example:"1"`                            // Unique user ID
	Email        string    `json:"email" example:"jane@example.com"`          // User email address
	PasswordHash string    `json:"-"`                                         // BCrypt hash of the user's password (never serialized)
	Name         string    `json:"name" example:"Jane Doe"`                   // User display name
	Role         string    `json:"role" example:"user"`                       // User role (e.g. user, admin)
	Tier         string    `json:"tier" example:"free"`                       // User subscription tier (free, pro)
	CreatedAt    time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"` // User creation time
	UpdatedAt    time.Time `json:"updated_at" example:"2026-01-15T10:30:00Z"` // Time of the last update
}
