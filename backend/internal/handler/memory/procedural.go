package memory

import (
	"context"
	"errors"
	"fmt"
	"time"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const proceduralStatusRecorded = "recorded"

// Procedural names are unique per user (idx_memory_procedural_user_name). An
// id already used by another user's row trips the primary key and is reported
// as a 409; reads only ever match the session owner's rows, so orphaned
// NULL-owner rows are never returned.
const (
	queryUpsertProcedural = `
		INSERT INTO memory_procedural (id, user_id, name, content, metadata)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, name) DO UPDATE
		SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, updated_at = NOW()
		RETURNING id
	`
	queryGetProceduralByID = `
		SELECT id, name, content, metadata, created_at, updated_at
		FROM memory_procedural
		WHERE user_id = $1 AND id = $2
	`
	queryGetProceduralByName = `
		SELECT id, name, content, metadata, created_at, updated_at
		FROM memory_procedural
		WHERE user_id = $1 AND name = $2
	`
)

type proceduralStoreRequest struct {
	// SessionID is the session the agent is running; its owner owns the entry.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
	// ID is the procedural memory identifier (required).
	ID string `json:"id" binding:"required" example:"proc_123"`
	// Name is the procedural memory name, unique per user (required).
	Name string `json:"name" binding:"required" example:"checkout_flow"`
	// Content is the procedural memory content (required).
	Content string `json:"content"`
	// Metadata is optional free-form metadata attached to the entry.
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// ProceduralStoreResponse is the response returned when a procedural memory entry is stored.
type ProceduralStoreResponse struct {
	// ID is the stored procedural memory identifier (the existing ID when Name already existed for the user).
	ID string `json:"id"`
	// Status is always "recorded".
	Status string `json:"status"`
}

// HandleStoreProcedural godoc
// @Summary Store procedural memory
// @Description Stores a procedural memory entry owned by the user that owns the session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body proceduralStoreRequest true "Procedural memory payload"
// @Success 201 {object} ProceduralStoreResponse "Recorded entry"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown or deleted session"
// @Failure 409 {object} map[string]string
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

	var storedID string
	err = h.pool.QueryRow(ctx, queryUpsertProcedural, req.ID, userID, req.Name, req.Content, metadataJSON).Scan(&storedID)
	if isUniqueViolation(err) {
		return handlerutil.RespondError(c, fiber.StatusConflict, "Procedural memory id is already used by another name")
	}
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store procedural memory")
	}

	return handlerutil.RespondCreated(c, ProceduralStoreResponse{
		ID:     storedID,
		Status: proceduralStatusRecorded,
	})
}

type proceduralGetRequest struct {
	// SessionID is the session the agent is running; only its owner's entries are returned.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
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
// @Description Retrieves one of the session owner's procedural memory entries by ID or name (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body proceduralGetRequest true "Procedural recall payload"
// @Success 200 {object} ProceduralGetResponse "Procedural memory entry"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown session or entry"
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

	ctx, cancel := context.WithTimeout(context.Background(), memoryRequestTimeout)
	defer cancel()

	userID, err := h.sessionOwner(ctx, req.SessionID)
	if err != nil {
		return respondOwnerError(c, req.SessionID, err)
	}

	entry, err := h.getProcedural(ctx, userID, req)
	if errors.Is(err, pgx.ErrNoRows) {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Procedural memory not found")
	}
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get procedural memory")
	}

	return handlerutil.RespondSuccess(c, entry)
}

// getProcedural looks the entry up by ID when given, otherwise by name, always
// within the owner's rows.
func (h *Handler) getProcedural(ctx context.Context, userID int, req proceduralGetRequest) (ProceduralGetResponse, error) {
	query, key := queryGetProceduralByName, req.Name
	if req.ID != "" {
		query, key = queryGetProceduralByID, req.ID
	}

	var entry ProceduralGetResponse
	var metadataBytes []byte
	err := h.pool.QueryRow(ctx, query, userID, key).
		Scan(&entry.ID, &entry.Name, &entry.Content, &metadataBytes, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return ProceduralGetResponse{}, fmt.Errorf("get procedural memory: %w", err)
	}
	entry.Metadata = decodeMetadata(metadataBytes, entry.ID, msgconst.WarnMemoryParseProcedMeta)
	return entry, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolationCode
}
