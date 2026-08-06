package memory

import (
	"context"
	"encoding/json"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type semanticStoreRequest struct {
	ID        string                 `json:"id"`
	Content   string                 `json:"content"`
	Embedding []float64              `json:"embedding,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// HandleStoreSemantic godoc
// @Summary Store semantic memory
// @Description Stores a semantic memory entry with an optional embedding (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body semanticStoreRequest true "Semantic memory payload"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/internal/memory/semantic/store [post]
func (h *Handler) HandleStoreSemantic(c fiber.Ctx) error {
	var req semanticStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.ID == "" || req.Content == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "id and content are required")
	}

	metadataJSON := []byte("{}")
	if req.Metadata != nil {
		var err error
		metadataJSON, err = json.Marshal(req.Metadata)
		if err != nil {
			return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid metadata")
		}
	}

	ctx := context.Background()

	if len(req.Embedding) > 0 {
		vec := formatVector(req.Embedding)
		_, err := h.pool.Exec(ctx, `
			INSERT INTO memory_semantic (id, content, embedding, metadata)
			VALUES ($1, $2, $3::vector, $4)
			ON CONFLICT (id) DO UPDATE
			SET content = $2, embedding = $3::vector, metadata = $4
		`, req.ID, req.Content, vec, metadataJSON)
		if err == nil {
			return handlerutil.RespondCreated(c, fiber.Map{
				"id":     generateID("mem_sm_"),
				"status": "indexed",
			})
		}
	}

	_, err := h.pool.Exec(ctx, `
		INSERT INTO memory_semantic (id, content, metadata)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET content = $2, metadata = $3
	`, req.ID, req.Content, metadataJSON)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store semantic memory")
	}

	return handlerutil.RespondCreated(c, fiber.Map{
		"id":     generateID("mem_sm_"),
		"status": "indexed",
	})
}

type semanticSearchRequest struct {
	Query     string    `json:"query"`
	Embedding []float64 `json:"embedding,omitempty"`
	Limit     int       `json:"limit,omitempty"`
	Threshold float64   `json:"threshold,omitempty"`
}

// HandleSemanticSearch godoc
// @Summary Search semantic memory
// @Description Searches semantic memory by query text (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body semanticSearchRequest true "Semantic search payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Router /api/v1/internal/memory/semantic/search [post]
func (h *Handler) HandleSemanticSearch(c fiber.Ctx) error {
	var req semanticSearchRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.Query == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "query is required")
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	ctx := context.Background()

	var results []fiber.Map

	rows, err := h.pool.Query(ctx, `
		SELECT id, content, metadata, created_at
		FROM memory_semantic
		WHERE content ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC
		LIMIT $2
	`, req.Query, req.Limit)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to search semantic memory")
	}
	defer rows.Close()

	for rows.Next() {
		var id, content string
		var metadataBytes []byte
		var createdAt time.Time

		if err := rows.Scan(&id, &content, &metadataBytes, &createdAt); err != nil {
			continue
		}

		var metadata interface{}
		json.Unmarshal(metadataBytes, &metadata)

		results = append(results, fiber.Map{
			"id":         id,
			"content":    content,
			"metadata":   metadata,
			"created_at": createdAt,
		})
	}

	if results == nil {
		results = []fiber.Map{}
	}

	return handlerutil.RespondSuccess(c, fiber.Map{
		"results": results,
	})
}
