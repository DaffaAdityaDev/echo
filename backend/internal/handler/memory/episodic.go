package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

type episodicStoreRequest struct {
	SessionID string      `json:"session_id"`
	Content   interface{} `json:"content"`
	Metadata  interface{} `json:"metadata,omitempty"`
	TTL       int         `json:"ttl_seconds,omitempty"`
}

// HandleStoreEpisodic godoc
// @Summary Store episodic memory
// @Description Stores an episodic memory entry for a session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body episodicStoreRequest true "Episodic memory payload"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
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

	ctx := context.Background()
	key := fmt.Sprintf("memory:episodic:%s", req.SessionID)

	if err := h.rdb.LPush(ctx, key, data).Err(); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store episodic memory")
	}

	ttl := 24 * time.Hour
	if req.TTL > 0 {
		ttl = time.Duration(req.TTL) * time.Second
	}
	h.rdb.Expire(ctx, key, ttl)

	return handlerutil.RespondCreated(c, fiber.Map{
		"id":     generateID("mem_ep_"),
		"status": "stored",
	})
}

type episodicRecallRequest struct {
	SessionID string `json:"session_id"`
	Limit     int    `json:"limit,omitempty"`
	Offset    int    `json:"offset,omitempty"`
}

// HandleGetEpisodic godoc
// @Summary Recall episodic memory
// @Description Recalls episodic memory entries for a session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Param request body episodicRecallRequest true "Episodic recall payload"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
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

	ctx := context.Background()
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

	return handlerutil.RespondSuccess(c, fiber.Map{
		"session_id": req.SessionID,
		"entries":    messages,
		"total":      total,
	})
}
