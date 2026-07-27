package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models"
	"encoding/hex"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
)

type APIKeyRepo interface {
	Create(ctx context.Context, key *models.ApiKey) error
	List(ctx context.Context) ([]models.ApiKey, error)
	GetByID(ctx context.Context, id string) (*models.ApiKey, error)
	Revoke(ctx context.Context, id string) error
}

type Handler struct {
	Cfg        *models.Config
	APIKeyRepo APIKeyRepo
}

func NewHandler(cfg *models.Config, apiKeyRepo APIKeyRepo) *Handler {
	return &Handler{
		Cfg:        cfg,
		APIKeyRepo: apiKeyRepo,
	}
}

type createAPIKeyRequest struct {
	Name   string   `json:"name" example:"Production Key"`
	Scopes []string `json:"scopes" example:"read,write"`
}

func generateAPIKey() (fullKey, prefix, hash string, err error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", "", "", err
	}
	hexPart := hex.EncodeToString(b)
	fullKey = "sk_" + hexPart
	prefix = "sk_" + hexPart[:8]
	h := sha256.Sum256([]byte(fullKey))
	hash = hex.EncodeToString(h[:])
	return
}

func (h *Handler) HandleListKeys(c fiber.Ctx) error {
	keys, err := h.APIKeyRepo.List(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list keys"})
	}
	return c.JSON(keys)
}

func (h *Handler) HandleCreateKey(c fiber.Ctx) error {
	var req createAPIKeyRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	fullKey, prefix, hash, err := generateAPIKey()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate key"})
	}

	userIDInt, err := handlerutil.GetUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID := strconv.Itoa(userIDInt)

	now := time.Now()
	ak := models.ApiKey{
		ID:        handlerutil.GenerateUUID(),
		KeyHash:   hash,
		Prefix:    prefix,
		Name:      req.Name,
		Scopes:    req.Scopes,
		UserID:    userID,
		Status:    "active",
		CreatedAt: now,
	}

	if err := h.APIKeyRepo.Create(context.Background(), &ak); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to store key"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"key":     fullKey,
		"api_key": ak,
	})
}

func (h *Handler) HandleRevokeKey(c fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	existing, err := h.APIKeyRepo.GetByID(context.Background(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find key"})
	}
	if existing == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Key not found"})
	}

	if err := h.APIKeyRepo.Revoke(context.Background(), id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to revoke key"})
	}

	return c.JSON(fiber.Map{"message": "Key revoked"})
}

func (h *Handler) HandleStats(c fiber.Ctx) error {
	keys, err := h.APIKeyRepo.List(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get stats"})
	}

	total := int64(len(keys))
	active := int64(0)
	for _, k := range keys {
		if k.Status == "active" {
			active++
		}
	}

	return c.JSON(fiber.Map{
		"total_keys":  total,
		"active_keys": active,
	})
}
