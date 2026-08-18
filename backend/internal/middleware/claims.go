package middleware

import (
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// subString extracts the "sub" claim as a string, returning "" when absent or
// of an unexpected type.
func subString(claims jwt.MapClaims) string {
	sub, _ := claims[authconst.ClaimSubject].(string)
	return sub
}

// EmailFromClaims extracts the "email" claim from a verified JWT, returning
// an empty string when absent.
func EmailFromClaims(claims jwt.MapClaims) string {
	email, _ := claims[authconst.ClaimEmail].(string)
	return email
}

// UserTier returns the tier stored on the request by AuthRequired, falling
// back to the free tier when no verified claims are present. Tier is resolved
// per request by the AuthRequired middleware (database + Redis cache-aside) —
// it is never taken from the JWT or from request headers, which clients could
// spoof. The Locals keys themselves live in constants/locals.
func UserTier(c fiber.Ctx) string {
	tier, _ := c.Locals(locals.UserTier).(string)
	return domainconst.NormalizeTier(tier)
}

// UserEmail returns the email stored on the request by AuthRequired, falling
// back to an empty string when no verified claims are present.
func UserEmail(c fiber.Ctx) string {
	email, _ := c.Locals(locals.UserEmail).(string)
	return email
}
