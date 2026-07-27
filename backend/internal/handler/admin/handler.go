package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"encoding/hex"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
)

type APIKeyRepo interface {
	Create(ctx context.Context, key *authmodel.ApiKey) error
	List(ctx context.Context) ([]authmodel.ApiKey, error)
	GetByID(ctx context.Context, id string) (*authmodel.ApiKey, error)
	Revoke(ctx context.Context, id string) error
}

type Handler struct {
	Cfg        *cfgmodel.Config
	APIKeyRepo APIKeyRepo
}

func NewHandler(cfg *cfgmodel.Config, apiKeyRepo APIKeyRepo) *Handler {
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
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to list keys")
	}
	return handlerutil.RespondSuccess(c, keys)
}

func (h *Handler) HandleCreateKey(c fiber.Ctx) error {
	var req createAPIKeyRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.Name == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "name is required")
	}

	fullKey, prefix, hash, err := generateAPIKey()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to generate key")
	}

	userIDInt, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}
	userID := strconv.Itoa(userIDInt)

	now := time.Now()
	ak := authmodel.ApiKey{
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
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store key")
	}

	return handlerutil.RespondCreated(c, fiber.Map{
		"key":     fullKey,
		"api_key": ak,
	})
}

func (h *Handler) HandleRevokeKey(c fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id is required")
	}

	existing, err := h.APIKeyRepo.GetByID(context.Background(), id)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to find key")
	}
	if existing == nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Key not found")
	}

	if err := h.APIKeyRepo.Revoke(context.Background(), id); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to revoke key")
	}

	return handlerutil.RespondMessage(c, "Key revoked")
}

func (h *Handler) HandleStats(c fiber.Ctx) error {
	keys, err := h.APIKeyRepo.List(context.Background())
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get stats")
	}

	total := int64(len(keys))
	active := int64(0)
	for _, k := range keys {
		if k.Status == "active" {
			active++
		}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{
		"total_keys":  total,
		"active_keys": active,
	})
}
