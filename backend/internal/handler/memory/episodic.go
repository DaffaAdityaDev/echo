package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type episodicStoreRequest struct {
	// SessionID is the session identifier the entry is stored under.
	SessionID string `json:"session_id" binding:"required" example:"sess_abc123"`
	// Content is the free-form episodic memory content.
	Content interface{} `json:"content" binding:"required"`
	// Metadata is optional free-form metadata attached to the entry.
	Metadata interface{} `json:"metadata,omitempty"`
	// TTL is the optional time-to-live in seconds for the entry list (default 24 hours).
	TTL int `json:"ttl_seconds,omitempty" example:"86400"`
}

// StoreEpisodicResponse is the response returned when an episodic memory entry is stored.
type StoreEpisodicResponse struct {
	// ID is the generated memory entry ID.
	ID string `json:"id"`
	// Status is always "stored".
	Status string `json:"status"`
}

// HandleStoreEpisodic godoc
// @Summary Store episodic memory
// @Description Stores an episodic memory entry for a session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body episodicStoreRequest true "Episodic memory payload"
// @Success 201 {object} StoreEpisodicResponse "Stored entry"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/internal/memory/episodic/store [post]
func (h *Handler) HandleStoreEpisodic(c fiber.Ctx) error {
	var req episodicStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.SessionID == "" || req.Content == nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "session_id and content are required")
	}

	entry := fiber.Map{
		"content":   req.Content,
		"timestamp": time.Now().UTC(),
	}
	if req.Metadata != nil {
		entry["metadata"] = req.Metadata
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to serialize entry")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	key := fmt.Sprintf("memory:episodic:%s", req.SessionID)

	if err := h.rdb.LPush(ctx, key, data).Err(); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store episodic memory")
	}

	ttl := 24 * time.Hour
	if req.TTL > 0 {
		ttl = time.Duration(req.TTL) * time.Second
	}
	if err := h.rdb.Expire(ctx, key, ttl).Err(); err != nil {
		log.Printf("[MEMORY] Failed to set TTL for episodic key %s: %v", key, err)
	}

	return handlerutil.RespondCreated(c, StoreEpisodicResponse{
		ID:     generateID("mem_ep_"),
		Status: "stored",
	})
}

type episodicRecallRequest struct {
	// SessionID is the session identifier to recall entries for.
	SessionID string `json:"session_id" binding:"required" example:"sess_abc123"`
	// Limit is the maximum number of entries to return (default 50).
	Limit int `json:"limit,omitempty" example:"50"`
	// Offset is the number of entries to skip (default 0).
	Offset int `json:"offset,omitempty" example:"0"`
}

// EpisodicRecallResponse is the response returned when episodic memory entries are recalled.
type EpisodicRecallResponse struct {
	// SessionID is the session the entries were recalled for.
	SessionID string `json:"session_id"`
	// Entries are the stored entry contents (free-form JSON, may be strings).
	Entries []interface{} `json:"entries"`
	// Total is the total number of entries stored for the session.
	Total int64 `json:"total"`
}

// HandleGetEpisodic godoc
// @Summary Recall episodic memory
// @Description Recalls episodic memory entries for a session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body episodicRecallRequest true "Episodic recall payload"
// @Success 200 {object} EpisodicRecallResponse "Recalled episodic memory entries"
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/internal/memory/episodic/recall [post]
func (h *Handler) HandleGetEpisodic(c fiber.Ctx) error {
	var req episodicRecallRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.SessionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "session_id is required")
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	key := fmt.Sprintf("memory:episodic:%s", req.SessionID)

	total, err := h.rdb.LLen(ctx, key).Result()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get list length")
	}

	start := int64(req.Offset)
	stop := int64(req.Offset + req.Limit - 1)

	raw, err := h.rdb.LRange(ctx, key, start, stop).Result()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to recall episodic memory")
	}

	messages := make([]interface{}, 0, len(raw))
	for _, item := range raw {
		var parsed interface{}
		if err := json.Unmarshal([]byte(item), &parsed); err != nil {
			messages = append(messages, item)
		} else {
			messages = append(messages, parsed)
		}
	}

	return handlerutil.RespondSuccess(c, EpisodicRecallResponse{
		SessionID: req.SessionID,
		Entries:   messages,
		Total:     total,
	})
}
