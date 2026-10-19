package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	authmodel "echo-backend/internal/models/auth"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// TierResolver returns the effective tier for a user id (as a string, the
// form used in the JWT "sub" claim). Implementations resolve per request so
// tier changes apply without waiting for token expiry.
type TierResolver func(ctx context.Context, userID string) string

// APIKeyGetter resolves an API key by its SHA-256 hash.
type APIKeyGetter interface {
	GetByHash(ctx context.Context, hash string) (*authmodel.ApiKey, error)
}

// AuthRequired verifies the JWT token from either the Authorization header or
// a cookie, or validates an API key (Bearer sk_...) against the API key store,
// then attaches identity claims and the resolved tier to the request context.
func AuthRequired(secret string, resolveTier TierResolver, apiKeyRepo ...APIKeyGetter) fiber.Handler {
	if resolveTier == nil {
		resolveTier = func(context.Context, string) string { return domainconst.TierFree }
	}
	var repo APIKeyGetter
	if len(apiKeyRepo) > 0 {
		repo = apiKeyRepo[0]
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

		// 1. Try cookie first
		if tryToken(c.Cookies(auth.TokenCookie)) {
			return c.Next()
		}

		// 2. Fallback to Authorization header
		authHeader := c.Get(auth.HeaderAuthorization)
		if strings.HasPrefix(authHeader, auth.BearerPrefix) {
			rawToken := strings.TrimPrefix(authHeader, auth.BearerPrefix)
			if tryToken(rawToken) {
				return c.Next()
			}

			// 3. If JWT parsing fails, attempt API Key lookup if repo is provided
			if repo != nil && rawToken != "" {
				h := sha256.Sum256([]byte(rawToken))
				hashStr := hex.EncodeToString(h[:])

				key, err := repo.GetByHash(c.Context(), hashStr)
				if err == nil && key != nil && key.Status == domainconst.StatusActive {
					c.Locals(locals.UserID, key.UserID)
					c.Locals(locals.UserRole, domainconst.RoleUser)
					c.Locals(locals.UserTier, resolveTier(c.Context(), key.UserID))
					c.Locals(locals.APIKeyID, key.ID)
					c.Locals(locals.APIKeyName, key.Name)
					c.Locals(locals.APIKeyScopes, key.Scopes)
					return c.Next()
				}
			}
		}

		return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingToken)
	}
}
