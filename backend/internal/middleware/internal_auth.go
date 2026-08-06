package middleware

import (
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func InternalAuthRequired(cfg *cfgmodel.Config) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing internal token")
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == "" {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing internal token")
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.ServiceJWTSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}))
		if err != nil || !token.Valid {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Invalid internal token")
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Invalid token claims")
		}

		sub, ok := claims["sub"].(string)
		if !ok || sub != "agent" {
			return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: Invalid token subject")
		}

		c.Locals("service_name", sub)
		return c.Next()
	}
}
