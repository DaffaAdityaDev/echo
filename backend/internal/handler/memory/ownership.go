package memory

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	domainconst "echo-backend/internal/constants/domain"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	chatmodel "echo-backend/internal/models/chat"

	"github.com/gofiber/fiber/v3"
)

// SessionLookup resolves a chat session by ID. It is satisfied by the session
// repository; a nil session with a nil error means the session does not exist.
type SessionLookup interface {
	GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error)
}

var (
	errSessionRequired = errors.New("session_id is required")
	errSessionNotFound = errors.New("session not found")
)

// sessionOwner returns the ID of the user that owns sessionID. Memory ownership
// is never taken from the request body: the agent only names the session it is
// running, and the owner comes from the sessions table, so a prompt-injected
// model cannot read or write another user's memory. Unknown, malformed and
// deleted sessions are all reported as errSessionNotFound.
func (h *Handler) sessionOwner(ctx context.Context, sessionID string) (int, error) {
	if sessionID == "" {
		return 0, errSessionRequired
	}
	if !handlerutil.IsValidUUID(sessionID) {
		return 0, errSessionNotFound
	}

	sess, err := h.sessions.GetByID(ctx, sessionID)
	if err != nil {
		return 0, fmt.Errorf("resolve memory session owner: %w", err)
	}
	if sess == nil || sess.Status == domainconst.StatusDeleted {
		return 0, errSessionNotFound
	}
	return sess.UserID, nil
}

func respondOwnerError(c fiber.Ctx, sessionID string, err error) error {
	switch {
	case errors.Is(err, errSessionRequired):
		return handlerutil.RespondError(c, fiber.StatusBadRequest, errSessionRequired.Error())
	case errors.Is(err, errSessionNotFound):
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
	default:
		slog.Error(msgconst.ErrMemoryResolveOwner, msgconst.ComponentKey, msgconst.ComponentMemory, msgconst.KeySessionID, sessionID, msgconst.KeyErr, err)
		return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to resolve session owner")
	}
}
