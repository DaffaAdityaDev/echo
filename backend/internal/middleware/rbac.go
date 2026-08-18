package middleware

import (
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

func RequireRoles(allowedRoles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userRole, ok := c.Locals(locals.UserRole).(string)
		if !ok || userRole == "" {
			return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrInsufficientRole)
		}

		for _, role := range allowedRoles {
			if userRole == role {
				return c.Next()
			}
		}

		return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrInsufficientRole)
	}
}
