package middleware

import (
	"context"
	"crypto/sha256"
	"echo-backend/internal/constants/auth"
	domainconst "echo-backend/internal/constants/domain"
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"
	adminrepo "echo-backend/internal/repository/admin"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func AuthOrAPIKeyRequired(cfg *cfgmodel.Config, apiKeyRepo *adminrepo.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		tokenString := c.Cookies(auth.TokenCookie)
		if tokenString != "" {
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			}, jwt.WithValidMethods([]string{domainconst.SigningAlgHS256}))
			if err == nil && token.Valid {
				claims := token.Claims.(jwt.MapClaims)
				c.Locals(locals.UserID, claims[auth.ClaimSubject])
				role, _ := claims[auth.ClaimRole].(string)
				if role != domainconst.RoleAdmin {
					return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrInsufficientRole)
				}
				c.Locals(locals.UserRole, role)
				return c.Next()
			}
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidToken)
		}

		authHeader := c.Get(auth.HeaderAuthorization)
		if !strings.HasPrefix(authHeader, auth.BearerPrefix) {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingToken)
		}

		tokenString = strings.TrimPrefix(authHeader, auth.BearerPrefix)
		if tokenString == "" {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrMissingToken)
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		}, jwt.WithValidMethods([]string{domainconst.SigningAlgHS256}))
		if err == nil && token.Valid {
			claims := token.Claims.(jwt.MapClaims)
			c.Locals(locals.UserID, claims[auth.ClaimSubject])
			role, _ := claims[auth.ClaimRole].(string)
			if role != domainconst.RoleAdmin {
				return handlerutil.RespondError(c, fiber.StatusForbidden, msgconst.ErrInsufficientRole)
			}
			c.Locals(locals.UserRole, role)
			return c.Next()
		}

		hash := sha256.Sum256([]byte(tokenString))
		hashStr := hex.EncodeToString(hash[:])

		apiKeyCtx, apiKeyCancel := context.WithTimeout(c.Context(), 5*time.Second)
		defer apiKeyCancel()
		key, err := apiKeyRepo.GetByHash(apiKeyCtx, hashStr)
		if err != nil || key == nil {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrInvalidAPICredentials)
		}

		if key.Status != domainconst.StatusActive {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, msgconst.ErrAPIKeyRevoked)
		}

		c.Locals(locals.APIKeyID, key.ID)
		c.Locals(locals.APIKeyName, key.Name)
		c.Locals(locals.APIKeyScopes, key.Scopes)
		c.Locals(locals.APIKeyUserID, key.UserID)

		return c.Next()
	}
}
