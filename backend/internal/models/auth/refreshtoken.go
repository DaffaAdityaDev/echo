package authmodel

import (
	"errors"
	"time"
)

// ErrRefreshTokenNotActive is returned by a rotation when the presented
// refresh token was already revoked, typically by a concurrent rotation that
// won the race.
var ErrRefreshTokenNotActive = errors.New("refresh token is no longer active")

type RefreshToken struct {
	ID          int64      `json:"id"`
	UserID      int        `json:"user_id"`
	TokenHash   string     `json:"-"`
	DeviceLabel string     `json:"device_label"`
	ExpiresAt   time.Time  `json:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}
