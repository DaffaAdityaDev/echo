package middleware

import (
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

func RequireRoles(allowedRoles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userRole, ok := c.Locals("user_role").(string)
		if !ok || userRole == "" {
			return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: insufficient role")
		}

		for _, role := range allowedRoles {
			if userRole == role {
				return c.Next()
			}
		}

		return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: insufficient role")
	}
}
