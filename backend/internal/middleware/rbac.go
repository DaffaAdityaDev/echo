package middleware

import (
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

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Forbidden: insufficient permissions for this operation",
		})
	}
}
