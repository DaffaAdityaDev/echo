package memory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

const (
	episodicKeyPrefix          = "memory:episodic"
	episodicIDPrefix           = "mem_ep_"
	episodicStatusStored       = "stored"
	defaultEpisodicTTL         = 24 * time.Hour
	defaultEpisodicRecallLimit = 50
)

// episodicSlotPattern bounds the optional slot name. Slots only ever extend a
// key that already embeds the owner and the (colon-free) session UUID, so a
// slot cannot reach another session's list.
var episodicSlotPattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)

var errInvalidSlot = errors.New("slot must match " + episodicSlotPattern.String())

// episodicKey builds the Redis list key for a session's episodic memory:
// memory:episodic:{userID}:{sessionID}[:{slot}].
func episodicKey(userID int, sessionID, slot string) string {
	key := fmt.Sprintf("%s:%d:%s", episodicKeyPrefix, userID, sessionID)
	if slot == "" {
		return key
	}
	return key + ":" + slot
}

func validateSlot(slot string) error {
	if slot == "" || episodicSlotPattern.MatchString(slot) {
		return nil
	}
	return errInvalidSlot
}

type episodicStoreRequest struct {
	// SessionID is the session the entry is stored under; its owner scopes the entry.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
	// Slot optionally names a separate list inside the session (e.g. "paused:appr_123").
	Slot string `json:"slot,omitempty" example:"paused:appr_123"`
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
// @Description Stores an episodic memory entry for a session, scoped to the user that owns the session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body episodicStoreRequest true "Episodic memory payload"
// @Success 201 {object} StoreEpisodicResponse "Stored entry"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown or deleted session"
// @Failure 500 {object} map[string]string
// @Failure 503 {object} map[string]string
// @Router /api/v1/internal/memory/episodic/store [post]
func (h *Handler) HandleStoreEpisodic(c fiber.Ctx) error {
	if h.rdb == nil {
		return h.respondRedisUnavailable(c)
	}
	var req episodicStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if req.Content == nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "session_id and content are required")
	}
	if err := validateSlot(req.Slot); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}

	ctx, cancel := context.WithTimeout(context.Background(), memoryRequestTimeout)
	defer cancel()

	userID, err := h.sessionOwner(ctx, req.SessionID)
	if err != nil {
		return respondOwnerError(c, req.SessionID, err)
	}

	id, data, err := buildEpisodicEntry(req)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to build episodic entry")
	}

	key := episodicKey(userID, req.SessionID, req.Slot)
	if err := h.rdb.LPush(ctx, key, data).Err(); err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to store episodic memory")
	}
	if err := h.rdb.Expire(ctx, key, episodicTTL(req.TTL)).Err(); err != nil {
		slog.Error(msgconst.ErrMemorySetEpisodicTTL, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeyKey, key, msgconst.KeyErr, err)
	}

	return handlerutil.RespondCreated(c, StoreEpisodicResponse{
		ID:     id,
		Status: episodicStatusStored,
	})
}

func buildEpisodicEntry(req episodicStoreRequest) (string, []byte, error) {
	id, err := generateID(episodicIDPrefix)
	if err != nil {
		return "", nil, err
	}
	entry := fiber.Map{
		"id":        id,
		"content":   req.Content,
		"timestamp": time.Now().UTC(),
	}
	if req.Metadata != nil {
		entry["metadata"] = req.Metadata
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return "", nil, fmt.Errorf("serialize episodic entry: %w", err)
	}
	return id, data, nil
}

func episodicTTL(seconds int) time.Duration {
	if seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	return defaultEpisodicTTL
}

type episodicRecallRequest struct {
	// SessionID is the session to recall entries for; its owner scopes the lookup.
	SessionID string `json:"session_id" binding:"required" example:"6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"`
	// Slot optionally names a separate list inside the session (e.g. "paused:appr_123").
	Slot string `json:"slot,omitempty" example:"paused:appr_123"`
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
// @Description Recalls episodic memory entries for a session, scoped to the user that owns the session (internal)
// @Tags Memory
// @Accept json
// @Produce json
// @Security InternalAuth
// @Param request body episodicRecallRequest true "Episodic recall payload"
// @Success 200 {object} EpisodicRecallResponse "Recalled episodic memory entries"
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string "Unknown or deleted session"
// @Failure 500 {object} map[string]string
// @Failure 503 {object} map[string]string
// @Router /api/v1/internal/memory/episodic/recall [post]
func (h *Handler) HandleGetEpisodic(c fiber.Ctx) error {
	if h.rdb == nil {
		return h.respondRedisUnavailable(c)
	}
	var req episodicRecallRequest
	if err := c.Bind().JSON(&req); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid request")
	}
	if err := validateSlot(req.Slot); err != nil {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, err.Error())
	}
	if req.Limit <= 0 {
		req.Limit = defaultEpisodicRecallLimit
	}
	req.Offset = max(req.Offset, 0)

	ctx, cancel := context.WithTimeout(context.Background(), memoryRequestTimeout)
	defer cancel()

	userID, err := h.sessionOwner(ctx, req.SessionID)
	if err != nil {
		return respondOwnerError(c, req.SessionID, err)
	}
	key := episodicKey(userID, req.SessionID, req.Slot)

	total, err := h.rdb.LLen(ctx, key).Result()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to get list length")
	}
	raw, err := h.rdb.LRange(ctx, key, int64(req.Offset), int64(req.Offset+req.Limit-1)).Result()
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to recall episodic memory")
	}

	return handlerutil.RespondSuccess(c, EpisodicRecallResponse{
		SessionID: req.SessionID,
		Entries:   decodeEpisodicEntries(raw),
		Total:     total,
	})
}

// decodeEpisodicEntries returns each stored entry as parsed JSON, keeping
// entries that are not JSON documents as raw strings.
func decodeEpisodicEntries(raw []string) []interface{} {
	entries := make([]interface{}, 0, len(raw))
	for _, item := range raw {
		var parsed interface{}
		if err := json.Unmarshal([]byte(item), &parsed); err != nil {
			entries = append(entries, item)
			continue
		}
		entries = append(entries, parsed)
	}
	return entries
}
