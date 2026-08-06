package middleware

import (
	"context"
	"crypto/sha256"
	"echo-backend/internal/constants/auth"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"
	adminrepo "echo-backend/internal/repository/admin"
	"encoding/hex"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func AuthOrAPIKeyRequired(cfg *cfgmodel.Config, apiKeyRepo *adminrepo.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		tokenString := c.Cookies(auth.TokenCookie)
		if tokenString != "" {
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err == nil && token.Valid {
				claims := token.Claims.(jwt.MapClaims)
				c.Locals("user_id", claims["sub"])
				role, _ := claims["role"].(string)
				if role != "admin" {
					return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: insufficient role")
				}
				c.Locals("user_role", role)
				return c.Next()
			}
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Invalid token")
		}

		authHeader := c.Get(auth.HeaderAuthorization)
		if !strings.HasPrefix(authHeader, auth.BearerPrefix) {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing token")
		}

		tokenString = strings.TrimPrefix(authHeader, auth.BearerPrefix)
		if tokenString == "" {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing token")
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err == nil && token.Valid {
			claims := token.Claims.(jwt.MapClaims)
			c.Locals("user_id", claims["sub"])
			role, _ := claims["role"].(string)
			if role != "admin" {
				return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: insufficient role")
			}
			c.Locals("user_role", role)
			return c.Next()
		}

		hash := sha256.Sum256([]byte(tokenString))
		hashStr := hex.EncodeToString(hash[:])

		key, err := apiKeyRepo.GetByHash(context.Background(), hashStr)
		if err != nil || key == nil {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Invalid credentials")
		}

		if key.Status != "active" {
			return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: API key is revoked")
		}

		c.Locals("api_key_id", key.ID)
		c.Locals("api_key_name", key.Name)
		c.Locals("api_key_scopes", key.Scopes)
		c.Locals("api_key_user_id", key.UserID)

		return c.Next()
	}
}
