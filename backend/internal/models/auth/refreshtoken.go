package authmodel

import "time"

type RefreshToken struct {
	ID          int64      `json:"id"`
	UserID      int        `json:"user_id"`
	TokenHash   string     `json:"-"`
	DeviceLabel string     `json:"device_label"`
	ExpiresAt   time.Time  `json:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}
