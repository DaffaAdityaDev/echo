package memory

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
)

type proceduralStoreRequest struct {
	// ID is the procedural memory identifier (required).
	ID string `json:"id" binding:"required" example:"proc_123"`
	// Name is the procedural memory name (required).
	Name string `json:"name" binding:"required" example:"checkout_flow"`
	// Content is the procedural memory content (required).
	Content string `json:"content"`
	// Metadata is optional free-form metadata attached to the entry.
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ProceduralStoreResponse is the response returned when a procedural memory entry is stored.
type ProceduralStoreResponse struct {
	// ID is the generated memory entry ID.
	ID string `json:"id"`
	// Status is always "recorded".
	Status string `json:"status"`
}

// HandleStoreProcedural godoc
// @Summary Store procedural memory
// @Description Stores a procedural memory entry (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body proceduralStoreRequest true "Procedural memory payload"
// @Success 201 {object} ProceduralStoreResponse "Recorded entry"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/internal/memory/procedural/store [post]
func (h *Handler) HandleStoreProcedural(c fiber.Ctx) error {
	var req proceduralStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.ID == "" || req.Name == "" || req.Content == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id, name, and content are required")
	}

	metadataJSON := []byte("{}")
	if req.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(req.Metadata)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid metadata")
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := h.pool.Exec(ctx, `
		INSERT INTO memory_procedural (id, name, content, metadata)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET name = $2, content = $3, metadata = $4, updated_at = NOW()
	`, req.ID, req.Name, req.Content, metadataJSON)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store procedural memory")
	}

	return handlerutil.RespondCreated(c, ProceduralStoreResponse{
		ID:     generateID("mem_pr_"),
		Status: "recorded",
	})
}

type proceduralGetRequest struct {
	// ID is the procedural memory identifier; at least one of ID or Name is required.
	ID string `json:"id,omitempty" example:"proc_123"`
	// Name is the procedural memory name; at least one of ID or Name is required.
	Name string `json:"name,omitempty" example:"checkout_flow"`
}

// ProceduralGetResponse is the response returned when a procedural memory entry is retrieved.
type ProceduralGetResponse struct {
	// ID is the procedural memory identifier.
	ID string `json:"id"`
	// Name is the procedural memory name.
	Name string `json:"name"`
	// Content is the procedural memory content.
	Content string `json:"content"`
	// Metadata is the free-form metadata attached to the entry.
	Metadata interface{} `json:"metadata"`
	// CreatedAt is when the entry was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt is when the entry was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// HandleGetProcedural godoc
// @Summary Get procedural memory
// @Description Retrieves procedural memory entries by ID or name (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body proceduralGetRequest true "Procedural recall payload"
// @Success 200 {object} ProceduralGetResponse "Procedural memory entry"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/internal/memory/procedural/get [post]
func (h *Handler) HandleGetProcedural(c fiber.Ctx) error {
	var req proceduralGetRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.ID == "" && req.Name == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id or name is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var id, name, content string
	var metadataBytes []byte
	var createdAt, updatedAt time.Time

	var err error
	if req.ID != "" {
		err = h.pool.QueryRow(ctx, `
			SELECT id, name, content, metadata, created_at, updated_at
			FROM memory_procedural
			WHERE id = $1
		`, req.ID).Scan(&id, &name, &content, &metadataBytes, &createdAt, &updatedAt)
	} else {
		err = h.pool.QueryRow(ctx, `
			SELECT id, name, content, metadata, created_at, updated_at
			FROM memory_procedural
			WHERE name = $1
		`, req.Name).Scan(&id, &name, &content, &metadataBytes, &createdAt, &updatedAt)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return handlerutil.RespondError(c, fiber.StatusNotFound, "Procedural memory not found")
		}
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get procedural memory")
	}

	var metadata interface{}
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil && len(metadataBytes) > 0 {
		slog.Warn("failed to parse metadata for procedural memory", "component", "memory", "id", id, "err", err)
	}

	return handlerutil.RespondSuccess(c, ProceduralGetResponse{
		ID:        id,
		Name:      name,
		Content:   content,
		Metadata:  metadata,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	})
}
