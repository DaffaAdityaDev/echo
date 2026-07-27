package middleware

import (
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

func RequireRoles(allowedRoles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userRole := c.Get("X-User-Role")
		if userRole == "" {
			userRole = "admin"
		}

		for _, role := range allowedRoles {
			if userRole == role {
				return c.Next()
			}
		}

		return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: insufficient permissions for this operation")
	}
}
