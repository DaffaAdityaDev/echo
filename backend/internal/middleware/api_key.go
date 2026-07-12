package middleware

import (
	"context"
	"crypto/sha256"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"encoding/hex"
	"strings"

	"github.com/gofiber/fiber/v3"
)

func APIKeyAuthRequired(cfg *models.Config, apiKeyRepo *repository.ApiKeyRepository) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: Missing API key",
			})
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: Missing API key",
			})
		}

		hash := sha256.Sum256([]byte(token))
		hashStr := hex.EncodeToString(hash[:])

		key, err := apiKeyRepo.GetByHash(context.Background(), hashStr)
		if err != nil || key == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: Invalid API key",
			})
		}

		if key.Status != "active" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: API key is revoked",
			})
		}

		c.Locals("api_key_id", key.ID)
		c.Locals("api_key_name", key.Name)
		c.Locals("api_key_scopes", key.Scopes)
		c.Locals("api_key_user_id", key.UserID)

		return c.Next()
	}
}
