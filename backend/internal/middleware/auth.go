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
		// 1. Try to get token from cookie (Secure practice)
		tokenString := c.Cookies(auth.TokenCookie)

		// 2. Fallback to Authorization header
		if tokenString == "" {
			authHeader := c.Get(auth.HeaderAuthorization)
			if strings.HasPrefix(authHeader, auth.BearerPrefix) {
				tokenString = strings.TrimPrefix(authHeader, auth.BearerPrefix)
			}
		}

		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": auth.ErrMissingToken,
			})
		}

		// 3. Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": auth.ErrInvalidToken,
			})
		}

		// 4. Set claims to context for downstream handlers
		claims := token.Claims.(jwt.MapClaims)
		c.Locals("user_id", claims["sub"])

		return c.Next()
	}
}
