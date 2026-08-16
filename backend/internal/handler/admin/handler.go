package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	domainconst "echo-backend/internal/constants/domain"
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
	Name   string   `json:"name" binding:"required" example:"Production Key"` // Display name for the API key
	Scopes []string `json:"scopes" example:"read,write"`                      // Optional permission scopes
}

// AdminStatsResponse is the payload returned by the stats endpoint.
type AdminStatsResponse struct {
	TotalKeys  int64 `json:"total_keys"`  // Total number of API keys
	ActiveKeys int64 `json:"active_keys"` // Number of active API keys
}

// CreateAPIKeyResponse is the payload returned after creating a new API key.
type CreateAPIKeyResponse struct {
	Key    string            `json:"key"`     // Full secret key shown only once
	APIKey *authmodel.ApiKey `json:"api_key"` // Stored API key record
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

// HandleListKeys godoc
// @Summary List API keys
// @Description Returns all API keys (admin)
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} authmodel.ApiKey "All API keys"
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/api-keys [get]
func (h *Handler) HandleListKeys(c fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	keys, err := h.APIKeyRepo.List(ctx)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to list keys")
	}
	return handlerutil.RespondSuccess(c, keys)
}

// HandleCreateKey godoc
// @Summary Create an API key
// @Description Generates and stores a new API key (admin)
// @Tags Admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body createAPIKeyRequest true "API key payload"
// @Success 201 {object} CreateAPIKeyResponse "New API key"
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/api-keys [post]
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

	id, err := handlerutil.GenerateUUID()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to generate key")
	}

	now := time.Now()
	ak := authmodel.ApiKey{
		ID:        id,
		KeyHash:   hash,
		Prefix:    prefix,
		Name:      req.Name,
		Scopes:    req.Scopes,
		UserID:    userID,
		Status:    domainconst.StatusActive,
		CreatedAt: now,
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := h.APIKeyRepo.Create(ctx, &ak); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store key")
	}

	return handlerutil.RespondCreated(c, CreateAPIKeyResponse{
		Key:    fullKey,
		APIKey: &ak,
	})
}

// HandleRevokeKey godoc
// @Summary Revoke an API key
// @Description Revokes an API key by ID (admin)
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "API key ID"
// @Success 200 {object} map[string]string "Confirmation: {\"status\":\"success\",\"message\":\"Key revoked\"}"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/api-keys/{id} [delete]
func (h *Handler) HandleRevokeKey(c fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id is required")
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	existing, err := h.APIKeyRepo.GetByID(ctx, id)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to find key")
	}
	if existing == nil {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Key not found")
	}

	if err := h.APIKeyRepo.Revoke(ctx, id); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to revoke key")
	}

	return handlerutil.RespondMessage(c, "Key revoked")
}

// HandleStats godoc
// @Summary Get API key statistics
// @Description Returns total and active API key counts (admin)
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} AdminStatsResponse "API key statistics"
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/stats [get]
func (h *Handler) HandleStats(c fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	keys, err := h.APIKeyRepo.List(ctx)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get stats")
	}

	total := int64(len(keys))
	active := int64(0)
	for _, k := range keys {
		if k.Status == domainconst.StatusActive {
			active++
		}
	}

	return handlerutil.RespondSuccess(c, AdminStatsResponse{
		TotalKeys:  total,
		ActiveKeys: active,
	})
}
