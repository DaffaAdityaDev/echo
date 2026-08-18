package middleware

import (
	"context"
	"echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// TierResolver returns the effective tier for a user id (as a string, the
// form used in the JWT "sub" claim). Implementations resolve per request so
// tier changes apply without waiting for token expiry.
type TierResolver func(ctx context.Context, userID string) string

// AuthRequired verifies the JWT token from either the Authorization header or
// a cookie, then attaches identity claims and the resolved tier to the
// request context.
func AuthRequired(secret string, resolveTier TierResolver) fiber.Handler {
	if resolveTier == nil {
		resolveTier = func(context.Context, string) string { return domainconst.TierFree }
	}
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
			c.Locals(locals.UserID, claims[auth.ClaimSubject])
			c.Locals(locals.UserRole, claims[auth.ClaimRole])
			c.Locals(locals.UserTier, resolveTier(c.Context(), subString(claims)))
			c.Locals(locals.UserEmail, EmailFromClaims(claims))
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
