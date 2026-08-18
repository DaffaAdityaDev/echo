package middleware

import (
	authconst "echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func InternalAuthRequired(cfg *cfgmodel.Config) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get(authconst.HeaderAuthorization)
		if !strings.HasPrefix(authHeader, authconst.BearerPrefix) {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingInternalToken)
		}

		tokenString := strings.TrimPrefix(authHeader, authconst.BearerPrefix)
		if tokenString == "" {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingInternalToken)
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.ServiceJWTSecret), nil
		}, jwt.WithValidMethods([]string{domainconst.SigningAlgHS256}))
		if err != nil || !token.Valid {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidInternalToken)
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidTokenClaims)
		}

		sub, ok := claims[authconst.ClaimSubject].(string)
		if !ok || sub != domainconst.AgentSubject {
			return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrInvalidTokenSubject)
		}

		c.Locals(locals.ServiceName, sub)
		return c.Next()
	}
}
