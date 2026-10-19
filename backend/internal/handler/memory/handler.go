package memory

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const (
	defaultSemanticSearchLimit = 10
	maxSemanticSearchLimit     = 100
	pgUniqueViolationCode      = "23505"
	memoryRequestTimeout       = 10 * time.Second
)

// Handler serves the internal memory endpoints. Every read and write is scoped
// to the user that owns the request's session (see sessionOwner).
type Handler struct {
	rdb      *redis.Client
	pool     *pgxpool.Pool
	sessions SessionLookup
}

func NewHandler(rdb *redis.Client, pool *pgxpool.Pool, sessions SessionLookup) *Handler {
	return &Handler{rdb: rdb, pool: pool, sessions: sessions}
}

func (h *Handler) respondRedisUnavailable(c fiber.Ctx) error {
	return handlerutil.RespondError(c, fiber.StatusServiceUnavailable, "Episodic memory store is not configured")
}

func generateID(prefix string) (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate memory id: %w", err)
	}
	return prefix + hex.EncodeToString(b), nil
}

func clampSemanticSearchLimit(limit int) int {
	if limit <= 0 {
		return defaultSemanticSearchLimit
	}
	return min(limit, maxSemanticSearchLimit)
}

func formatVector(v []float64) string {
	parts := make([]string, len(v))
	for i, val := range v {
		parts[i] = fmt.Sprintf("%f", val)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
