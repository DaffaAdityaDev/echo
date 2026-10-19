package memory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
)

const semanticStatusIndexed = "indexed"

// The upserts only overwrite a row the same user already owns: when the id
// belongs to another user (or to an orphaned NULL-owner row) the WHERE clause
// suppresses the update, RETURNING yields no row, and the caller gets a 409.
const (
	queryUpsertSemanticWithEmbedding = `
		INSERT INTO memory_semantic (id, user_id, content, embedding, metadata)
		VALUES ($1, $2, $3, $4::vector, $5)
		ON CONFLICT (id) DO UPDATE
		SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
		WHERE memory_semantic.user_id = EXCLUDED.user_id
		RETURNING id
	`
	queryUpsertSemantic = `
		INSERT INTO memory_semantic (id, user_id, content, metadata)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET content = EXCLUDED.content, metadata = EXCLUDED.metadata
		WHERE memory_semantic.user_id = EXCLUDED.user_id
		RETURNING id
	`
	querySearchSemantic = `
		SELECT id, content, metadata, created_at
		FROM memory_semantic
		WHERE user_id = $1 AND content ILIKE '%' || $2 || '%'
		ORDER BY created_at DESC
		LIMIT $3
	`
)

var errMemoryIDOwnedByOther = errors.New("memory id is owned by another user")

type semanticStoreRequest struct {
	// SessionID is the session the agent is running; its owner owns the entry.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
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
	// ID is the stored semantic memory identifier.
	ID string `json:"id"`
	// Status is always "indexed".
	Status string `json:"status"`
}

// HandleStoreSemantic godoc
// @Summary Store semantic memory
// @Description Stores a semantic memory entry with an optional embedding, owned by the user that owns the session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body semanticStoreRequest true "Semantic memory payload"
// @Success 201 {object} SemanticStoreResponse "Indexed entry"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown or deleted session"
// @Failure 409 {object} map[string]string "ID is owned by another user"
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
	metadataJSON, err := marshalMetadata(req.Metadata)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid metadata")
	}

	ctx, cancel := context.WithTimeout(context.Background(), memoryRequestTimeout)
	defer cancel()

	userID, err := h.sessionOwner(ctx, req.SessionID)
	if err != nil {
		return respondOwnerError(c, req.SessionID, err)
	}

	err = h.upsertSemantic(ctx, userID, req, metadataJSON)
	if errors.Is(err, errMemoryIDOwnedByOther) {
		return handlerutil.RespondError(c, fiber.StatusConflict, "Semantic memory id is already used")
	}
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store semantic memory")
	}

	return handlerutil.RespondCreated(c, SemanticStoreResponse{
		ID:     req.ID,
		Status: semanticStatusIndexed,
	})
}

// upsertSemantic stores the entry with its embedding when one is given. The
// vector insert fails when pgvector is unavailable, so any error other than an
// ownership conflict falls back to storing the entry without the embedding.
func (h *Handler) upsertSemantic(ctx context.Context, userID int, req semanticStoreRequest, metadataJSON []byte) error {
	if len(req.Embedding) > 0 {
		err := scanUpsert(h.pool.QueryRow(ctx, queryUpsertSemanticWithEmbedding, req.ID, userID, req.Content, formatVector(req.Embedding), metadataJSON))
		if err == nil || errors.Is(err, errMemoryIDOwnedByOther) {
			return err
		}
		slog.Error(msgconst.ErrMemoryStoreSemanticEmbed, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyID, req.ID, msgconst.KeyErr, err)
	}
	return scanUpsert(h.pool.QueryRow(ctx, queryUpsertSemantic, req.ID, userID, req.Content, metadataJSON))
}

// scanUpsert maps the "no row returned" outcome of an owner-guarded upsert to
// errMemoryIDOwnedByOther.
func scanUpsert(row pgx.Row) error {
	var storedID string
	err := row.Scan(&storedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errMemoryIDOwnedByOther
	}
	if err != nil {
		return fmt.Errorf("upsert memory row: %w", err)
	}
	return nil
}

func marshalMetadata(metadata map[string]interface{}) ([]byte, error) {
	if metadata == nil {
		return []byte("{}"), nil
	}
	data, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal memory metadata: %w", err)
	}
	return data, nil
}

type semanticSearchRequest struct {
	// SessionID is the session the agent is running; only its owner's entries are searched.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
	// Query is the search text (required).
	Query string `json:"query" binding:"required" example:"how to reset password"`
	// Embedding is the optional vector embedding used for the search.
	Embedding []float64 `json:"embedding,omitempty"`
	// Limit is the maximum number of results to return (default 10, capped at 100).
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
// @Description Searches the session owner's semantic memory by query text (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body semanticSearchRequest true "Semantic search payload"
// @Success 200 {object} SemanticSearchResponse "Matching semantic memory entries"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown or deleted session"
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
	req.Limit = clampSemanticSearchLimit(req.Limit)

	ctx, cancel := context.WithTimeout(context.Background(), memoryRequestTimeout)
	defer cancel()

	userID, err := h.sessionOwner(ctx, req.SessionID)
	if err != nil {
		return respondOwnerError(c, req.SessionID, err)
	}

	results, err := h.searchSemantic(ctx, userID, req.Query, req.Limit)
	if err != nil {
		slog.Error(msgconst.ErrMemorySemanticSearch, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to search semantic memory")
	}

	return handlerutil.RespondSuccess(c, SemanticSearchResponse{
		Results: results,
	})
}

func (h *Handler) searchSemantic(ctx context.Context, userID int, query string, limit int) ([]SemanticSearchResult, error) {
	rows, err := h.pool.Query(ctx, querySearchSemantic, userID, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query semantic memory: %w", err)
	}
	defer rows.Close()

	results := []SemanticSearchResult{}
	for rows.Next() {
		var result SemanticSearchResult
		var metadataBytes []byte
		if err := rows.Scan(&result.ID, &result.Content, &metadataBytes, &result.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan semantic memory row: %w", err)
		}
		result.Metadata = decodeMetadata(metadataBytes, result.ID, msgconst.WarnMemoryParseSemanticMeta)
		results = append(results, result)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate semantic memory rows: %w", err)
	}
	return results, nil
}

// decodeMetadata parses stored JSONB metadata, logging (not failing) when a
// row holds unparseable metadata so one bad row cannot break a lookup.
func decodeMetadata(raw []byte, id string, warnMsg string) interface{} {
	if len(raw) == 0 {
		return nil
	}
	var metadata interface{}
	if err := json.Unmarshal(raw, &metadata); err != nil {
		slog.Warn(warnMsg, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyID, id, msgconst.KeyErr, err)
		return nil
	}
	return metadata
}
