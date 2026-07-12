package middleware

import (
	"echo-backend/internal/constants/auth"
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
			})
			if err != nil || !token.Valid {
				return false
			}
			claims := token.Claims.(jwt.MapClaims)
			c.Locals("user_id", claims["sub"])
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

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": auth.ErrMissingToken,
		})
	}
}
