package authmodel

import "time"

type User struct {
	ID           int       `json:"id" example:"1"`
	Email        string    `json:"email" example:"jane@example.com"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name" example:"Jane Doe"`
	Role         string    `json:"role" example:"user"`
	CreatedAt    time.Time `json:"created_at" example:"2026-01-15T10:30:00Z"`
	UpdatedAt    time.Time `json:"updated_at" example:"2026-01-15T10:30:00Z"`
}
