package middleware

import (
	"echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// AuthRequired verifies the JWT token from either the Authorization header or a cookie.
func AuthRequired(secret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		tryToken := func(s string) bool {
			if s == "" {
				return false
			}
			token, err := jwt.Parse(s, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			}, jwt.WithValidMethods([]string{domainconst.SigningAlgHS256}))
			if err != nil || !token.Valid {
				return false
			}
			claims := token.Claims.(jwt.MapClaims)
			c.Locals("user_id", claims["sub"])
			c.Locals("user_role", claims["role"])
			c.Locals(LocalsKeyUserTier, TierFromClaims(claims))
			c.Locals(LocalsKeyUserEmail, EmailFromClaims(claims))
			return true
		}

		// Try cookie first
		if tryToken(c.Cookies(auth.TokenCookie)) {
			return c.Next()
		}

		// Fallback to Authorization header
		authHeader := c.Get(auth.HeaderAuthorization)
		if strings.HasPrefix(authHeader, auth.BearerPrefix) {
			if tryToken(strings.TrimPrefix(authHeader, auth.BearerPrefix)) {
				return c.Next()
			}
		}

		return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingToken)
	}
}
