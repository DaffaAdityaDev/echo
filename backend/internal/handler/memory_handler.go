package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type MemoryHandler struct {
	rdb  *redis.Client
	pool *pgxpool.Pool
}

func NewMemoryHandler(rdb *redis.Client, pool *pgxpool.Pool) *MemoryHandler {
	return &MemoryHandler{rdb: rdb, pool: pool}
}

func generateID(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

// --- Episodic Memory (Redis) ---

type episodicStoreRequest struct {
	SessionID string      `json:"session_id"`
	Content   interface{} `json:"content"`
	Metadata  interface{} `json:"metadata,omitempty"`
}

func (h *MemoryHandler) HandleStoreEpisodic(c fiber.Ctx) error {
	var req episodicStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.SessionID == "" || req.Content == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "session_id and content are required"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to serialize entry"})
	}

	ctx := context.Background()
	key := fmt.Sprintf("memory:episodic:%s", req.SessionID)

	if err := 		h.rdb.LPush(ctx, key, data).Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to store episodic memory"})
	}

			h.rdb.Expire(ctx, key, 24*time.Hour)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":     generateID("mem_ep_"),
		"status": "stored",
	})
}

type episodicRecallRequest struct {
	SessionID string `json:"session_id"`
	Limit     int    `json:"limit,omitempty"`
	Offset    int    `json:"offset,omitempty"`
}

func (h *MemoryHandler) HandleGetEpisodic(c fiber.Ctx) error {
	var req episodicRecallRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.SessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "session_id is required"})
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}
	if req.Offset < 0 {
		req.Offset = 0
	}

	ctx := context.Background()
	key := fmt.Sprintf("memory:episodic:%s", req.SessionID)

	total, err := 		h.rdb.LLen(ctx, key).Result()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to get list length"})
	}

	start := int64(req.Offset)
	stop := int64(req.Offset + req.Limit - 1)

	raw, err := 		h.rdb.LRange(ctx, key, start, stop).Result()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to recall episodic memory"})
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

	return c.JSON(fiber.Map{
		"session_id": req.SessionID,
		"entries":    messages,
		"total":      total,
	})
}

// --- Semantic Memory (PostgreSQL) ---

type semanticStoreRequest struct {
	ID        string                 `json:"id"`
	Content   string                 `json:"content"`
	Embedding []float64              `json:"embedding,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

func (h *MemoryHandler) HandleStoreSemantic(c fiber.Ctx) error {
	var req semanticStoreRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.ID == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "id and content are required"})
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

	if len(req.Embedding) > 0 {
		vec := formatVector(req.Embedding)
		_, err := 		h.pool.Exec(ctx, `
			INSERT INTO memory_semantic (id, content, embedding, metadata)
			VALUES ($1, $2, $3::vector, $4)
			ON CONFLICT (id) DO UPDATE
			SET content = $2, embedding = $3::vector, metadata = $4
		`, req.ID, req.Content, vec, metadataJSON)
		if err == nil {
			return c.Status(fiber.StatusCreated).JSON(fiber.Map{
				"id":     generateID("mem_sm_"),
				"status": "indexed",
			})
		}
	}

	_, err := 		h.pool.Exec(ctx, `
		INSERT INTO memory_semantic (id, content, metadata)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE
		SET content = $2, metadata = $3
	`, req.ID, req.Content, metadataJSON)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to store semantic memory"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
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

func (h *MemoryHandler) HandleSemanticSearch(c fiber.Ctx) error {
	var req semanticSearchRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.Query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "query is required"})
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	ctx := context.Background()

	var results []fiber.Map

	rows, err := 		h.pool.Query(ctx, `
		SELECT id, content, metadata, created_at
		FROM memory_semantic
		WHERE content ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC
		LIMIT $2
	`, req.Query, req.Limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to search semantic memory"})
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

	return c.JSON(fiber.Map{
		"results": results,
	})
}

// --- Procedural Memory (PostgreSQL) ---

type proceduralStoreRequest struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

func (h *MemoryHandler) HandleStoreProcedural(c fiber.Ctx) error {
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
	_, err := 		h.pool.Exec(ctx, `
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

func (h *MemoryHandler) HandleGetProcedural(c fiber.Ctx) error {
	var req proceduralGetRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "Invalid request"})
	}
	if req.ID == "" && req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "validation_error", "message": "id or name is required"})
	}

	ctx := context.Background()

	var id, name, content string
	var metadataBytes []byte
	var createdAt, updatedAt time.Time

	var err error
	if req.ID != "" {
		err = 		h.pool.QueryRow(ctx, `
			SELECT id, name, content, metadata, created_at, updated_at
			FROM memory_procedural
			WHERE id = $1
		`, req.ID).Scan(&id, &name, &content, &metadataBytes, &createdAt, &updatedAt)
	} else {
		err = 		h.pool.QueryRow(ctx, `
			SELECT id, name, content, metadata, created_at, updated_at
			FROM memory_procedural
			WHERE name = $1
		`, req.Name).Scan(&id, &name, &content, &metadataBytes, &createdAt, &updatedAt)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "not_found", "message": "Procedural memory not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "internal_error", "message": "Failed to get procedural memory"})
	}

	var metadata interface{}
	json.Unmarshal(metadataBytes, &metadata)

	return c.JSON(fiber.Map{
		"id":         id,
		"name":       name,
		"content":    content,
		"metadata":   metadata,
		"created_at": createdAt,
		"updated_at": updatedAt,
	})
}

// --- Helpers ---

func formatVector(v []float64) string {
	parts := make([]string, len(v))
	for i, val := range v {
		parts[i] = fmt.Sprintf("%f", val)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
