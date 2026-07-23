package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"echo-backend/internal/models"
	"echo-backend/internal/repository"
	"encoding/hex"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
)

type AdminHandler struct {
	Cfg        *models.Config
	APIKeyRepo *repository.ApiKeyRepository
}

func NewAdminHandler(cfg *models.Config, apiKeyRepo *repository.ApiKeyRepository) *AdminHandler {
	return &AdminHandler{
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

// @Summary List API keys
// @Description Retrieve all system API keys
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.ApiKey
// @Failure 500 {object} map[string]string "Failed to list keys"
// @Router /api/v1/admin/api-keys [get]
func (h *AdminHandler) HandleListKeys(c fiber.Ctx) error {
	keys, err := h.APIKeyRepo.List(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to list keys"})
	}
	return c.JSON(keys)
}

// @Summary Create API key
// @Description Generate a new API key with specific scopes
// @Tags Admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body createAPIKeyRequest true "API Key creation parameters (name, scopes)"
// @Success 201 {object} map[string]interface{} "Generated full key and record"
// @Failure 400 {object} map[string]string "Invalid request or missing name"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Failed to generate/store key"
// @Router /api/v1/admin/api-keys [post]
func (h *AdminHandler) HandleCreateKey(c fiber.Ctx) error {
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

	userIDInt, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID := strconv.Itoa(userIDInt)

	now := time.Now()
	ak := models.ApiKey{
		ID:        generateUUID(),
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

// @Summary Revoke API key
// @Description Change an API key status to revoked
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "API Key ID"
// @Success 200 {object} map[string]string "Key revoked"
// @Failure 400 {object} map[string]string "Missing key ID"
// @Failure 404 {object} map[string]string "Key not found"
// @Failure 500 {object} map[string]string "Failed to revoke key"
// @Router /api/v1/admin/api-keys/{id} [delete]
func (h *AdminHandler) HandleRevokeKey(c fiber.Ctx) error {
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

// @Summary Get admin API key statistics
// @Description Count total and active API keys in the system
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]int64 "Total and active key counts"
// @Failure 500 {object} map[string]string "Failed to get stats"
// @Router /api/v1/admin/stats [get]
func (h *AdminHandler) HandleStats(c fiber.Ctx) error {
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
