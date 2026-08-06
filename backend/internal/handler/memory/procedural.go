package memory

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
)

type proceduralStoreRequest struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// HandleStoreProcedural godoc
// @Summary Store procedural memory
// @Description Stores a procedural memory entry (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body proceduralStoreRequest true "Procedural memory payload"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/internal/memory/procedural/store [post]
func (h *Handler) HandleStoreProcedural(c fiber.Ctx) error {
	var req proceduralStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.ID == "" || req.Name == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "id, name, and content are required"})
	}

	metadataJSON := []byte("{}")
	if req.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(req.Metadata)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid metadata"})
		}
	}

	ctx := context.Background()
	_, err := h.pool.Exec(ctx, `
		INSERT INTO memory_procedural (id, name, content, metadata)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET name = $2, content = $3, metadata = $4, updated_at = NOW()
	`, req.ID, req.Name, req.Content, metadataJSON)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to store procedural memory"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":     generateID("mem_pr_"),
		"status": "recorded",
	})
}

type proceduralGetRequest struct {
	ID   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
}

// HandleGetProcedural godoc
// @Summary Get procedural memory
// @Description Retrieves procedural memory entries by ID or name (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body proceduralGetRequest true "Procedural recall payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/internal/memory/procedural/get [post]
func (h *Handler) HandleGetProcedural(c fiber.Ctx) error {
	var req proceduralGetRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.ID == "" && req.Name == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id or name is required")
	}

	ctx := context.Background()

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
	json.Unmarshal(metadataBytes, &metadata)

	return handlerutil.RespondSuccess(c, fiber.Map{
		"id":         id,
		"name":       name,
		"content":    content,
		"metadata":   metadata,
		"created_at": createdAt,
		"updated_at": updatedAt,
	})
}
