package memory

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type semanticStoreRequest struct {
	// ID is the semantic memory identifier (required).
	ID string `json:"id" binding:"required" example:"sem_123"`
	// Content is the semantic memory content (required).
	Content string `json:"content" binding:"required"`
	// Embedding is the optional vector embedding of the content.
	Embedding []float64 `json:"embedding,omitempty"`
	// Metadata is optional free-form metadata attached to the entry.
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// SemanticStoreResponse is the response returned when a semantic memory entry is indexed.
type SemanticStoreResponse struct {
	// ID is the generated memory entry ID.
	ID string `json:"id"`
	// Status is always "indexed".
	Status string `json:"status"`
}

// HandleStoreSemantic godoc
// @Summary Store semantic memory
// @Description Stores a semantic memory entry with an optional embedding (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body semanticStoreRequest true "Semantic memory payload"
// @Success 201 {object} SemanticStoreResponse "Indexed entry"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if len(req.Embedding) > 0 {
		vec := formatVector(req.Embedding)
		_, err := h.pool.Exec(ctx, `
			INSERT INTO memory_semantic (id, content, embedding, metadata)
			VALUES ($1, $2, $3::vector, $4)
			ON CONFLICT (id) DO UPDATE
			SET content = $2, embedding = $3::vector, metadata = $4
		`, req.ID, req.Content, vec, metadataJSON)
		if err == nil {
			return handlerutil.RespondCreated(c, SemanticStoreResponse{
				ID:     generateID("mem_sm_"),
				Status: "indexed",
			})
		}
		// The vector insert can fail when pgvector is unavailable; fall back
		// to storing without the embedding rather than failing the request.
		slog.Error(msgconst.ErrMemoryStoreSemanticEmbed, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyID, req.ID, msgconst.KeyErr, err)
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

	return handlerutil.RespondCreated(c, SemanticStoreResponse{
		ID:     generateID("mem_sm_"),
		Status: "indexed",
	})
}

type semanticSearchRequest struct {
	// Query is the search text (required).
	Query string `json:"query" binding:"required" example:"how to reset password"`
	// Embedding is the optional vector embedding used for the search.
	Embedding []float64 `json:"embedding,omitempty"`
	// Limit is the maximum number of results to return (default 10).
	Limit int `json:"limit,omitempty" example:"10"`
	// Threshold is the optional similarity threshold for the search.
	Threshold float64 `json:"threshold,omitempty" example:"0.5"`
}

// SemanticSearchResult is a single semantic memory entry returned by a search.
type SemanticSearchResult struct {
	// ID is the semantic memory identifier.
	ID string `json:"id"`
	// Content is the semantic memory content.
	Content string `json:"content"`
	// Metadata is the free-form metadata attached to the entry.
	Metadata interface{} `json:"metadata"`
	// CreatedAt is when the entry was created.
	CreatedAt time.Time `json:"created_at"`
}

// SemanticSearchResponse is the response returned by a semantic memory search.
type SemanticSearchResponse struct {
	// Results are the matching semantic memory entries.
	Results []SemanticSearchResult `json:"results"`
}

// HandleSemanticSearch godoc
// @Summary Search semantic memory
// @Description Searches semantic memory by query text (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body semanticSearchRequest true "Semantic search payload"
// @Success 200 {object} SemanticSearchResponse "Search results"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var results []SemanticSearchResult

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
		if err := json.Unmarshal(metadataBytes, &metadata); err != nil && len(metadataBytes) > 0 {
			slog.Warn(msgconst.WarnMemoryParseSemanticMeta, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyID, id, msgconst.KeyErr, err)
		}

		results = append(results, SemanticSearchResult{
			ID:        id,
			Content:   content,
			Metadata:  metadata,
			CreatedAt: createdAt,
		})
	}

	if results == nil {
		results = []SemanticSearchResult{}
	}

	return handlerutil.RespondSuccess(c, SemanticSearchResponse{
		Results: results,
	})
}
