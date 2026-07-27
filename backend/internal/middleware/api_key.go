package middleware

import (
	"context"
	"crypto/sha256"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/config"
	adminrepo "echo-backend/internal/repository/admin"
	"encoding/hex"
	"strings"

	"github.com/gofiber/fiber/v3"
)

func APIKeyAuthRequired(cfg *cfgmodel.Config, apiKeyRepo *adminrepo.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing API key")
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Missing API key")
		}

		hash := sha256.Sum256([]byte(token))
		hashStr := hex.EncodeToString(hash[:])

		key, err := apiKeyRepo.GetByHash(context.Background(), hashStr)
		if err != nil || key == nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized: Invalid API key")
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
