package middleware

import (
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Locals keys and tier values shared across handlers. Tier comes from the
// signed JWT issued at login/registration — it is never taken from request
// headers, which clients could spoof.
const (
	LocalsKeyUserTier  = "user_tier"
	LocalsKeyUserEmail = "user_email"

	TierFree = "free"
	TierPro  = "pro"
)

// TierFromClaims extracts the "tier" claim from a verified JWT. A missing,
// empty, or unknown claim resolves to TierFree (least privilege).
func TierFromClaims(claims jwt.MapClaims) string {
	tier, _ := claims["tier"].(string)
	return normalizeTier(tier)
}

// EmailFromClaims extracts the "email" claim from a verified JWT, returning
// an empty string when absent.
func EmailFromClaims(claims jwt.MapClaims) string {
	email, _ := claims["email"].(string)
	return email
}

// UserTier returns the tier stored on the request by AuthRequired, falling
// back to TierFree when no verified claims are present.
func UserTier(c fiber.Ctx) string {
	tier, _ := c.Locals(LocalsKeyUserTier).(string)
	return normalizeTier(tier)
}

// UserEmail returns the email stored on the request by AuthRequired, falling
// back to an empty string when no verified claims are present.
func UserEmail(c fiber.Ctx) string {
	email, _ := c.Locals(LocalsKeyUserEmail).(string)
	return email
}

func normalizeTier(tier string) string {
	if tier != TierFree && tier != TierPro {
		return TierFree
	}
	return tier
}
