package middleware

import (
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

// RequireSessionAuth rejects requests authenticated with an API key so that
// sensitive routes (such as API key management) can only be reached with a
// user's JWT session. It must run after AuthRequired.
func RequireSessionAuth() fiber.Handler {
	return func(c fiber.Ctx) error {
		if c.Locals(locals.APIKeyID) != nil {
			return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrSessionAuthRequired)
		}
		return c.Next()
	}
}
