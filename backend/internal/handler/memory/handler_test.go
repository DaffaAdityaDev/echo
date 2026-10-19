package memory

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	chatmodel "echo-backend/internal/models/chat"

	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	ownedSessionID   = "6f1c2a4e-8b7d-4f3a-9c2e-1d5b7a9e0f12"
	deletedSessionID = "0b9a7c3d-2e4f-4a6b-8c1d-3e5f7a9b1c2d"
	unknownSessionID = "11111111-2222-4333-8444-555555555555"
	sessionOwnerID   = 42
)

type fakeSessions struct {
	sessions map[string]*chatmodel.Session
	err      error
	calls    int
}

func (f *fakeSessions) GetByID(_ context.Context, sessionID string) (*chatmodel.Session, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return f.sessions[sessionID], nil
}

func newFakeSessions() *fakeSessions {
	return &fakeSessions{sessions: map[string]*chatmodel.Session{
		ownedSessionID:   {ID: ownedSessionID, UserID: sessionOwnerID, Status: domainconst.StatusActive},
		deletedSessionID: {ID: deletedSessionID, UserID: sessionOwnerID, Status: domainconst.StatusDeleted},
	}}
}

// unreachableRedis is a client that is never dialled by the paths under test:
// they all fail the session-ownership check before touching Redis.
func unreachableRedis() *redis.Client {
	return redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
}

func newMemoryApp(h *Handler) *fiber.App {
	app := fiber.New()
	app.Post("/episodic/store", h.HandleStoreEpisodic)
	app.Post("/episodic/recall", h.HandleGetEpisodic)
	app.Post("/semantic/store", h.HandleStoreSemantic)
	app.Post("/semantic/search", h.HandleSemanticSearch)
	app.Post("/procedural/store", h.HandleStoreProcedural)
	app.Post("/procedural/get", h.HandleGetProcedural)
	return app
}

func postJSON(t *testing.T, app *fiber.App, path, body string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp.StatusCode
}

// memoryRequestBodies returns a valid body for every memory endpoint, bound to sessionID.
func memoryRequestBodies(sessionID string) map[string]string {
	sid := `"session_id":"` + sessionID + `"`
	return map[string]string{
		"/episodic/store":   `{` + sid + `,"content":"x"}`,
		"/episodic/recall":  `{` + sid + `}`,
		"/semantic/store":   `{` + sid + `,"id":"sem_1","content":"x"}`,
		"/semantic/search":  `{` + sid + `,"query":"x"}`,
		"/procedural/store": `{` + sid + `,"id":"proc_1","name":"n","content":"x"}`,
		"/procedural/get":   `{` + sid + `,"name":"n"}`,
	}
}

func TestEpisodicHandlers_ReturnServiceUnavailableWithoutRedis(t *testing.T) {
	app := newMemoryApp(NewHandler(nil, nil, newFakeSessions()))

	for _, path := range []string{"/episodic/store", "/episodic/recall"} {
		assert.Equal(t, fiber.StatusServiceUnavailable, postJSON(t, app, path, memoryRequestBodies(ownedSessionID)[path]), path)
	}
}

func TestMemoryHandlers_RejectUnknownSessions(t *testing.T) {
	for _, sessionID := range []string{unknownSessionID, deletedSessionID, "not-a-uuid"} {
		app := newMemoryApp(NewHandler(unreachableRedis(), nil, newFakeSessions()))
		for path, body := range memoryRequestBodies(sessionID) {
			assert.Equal(t, fiber.StatusNotFound, postJSON(t, app, path, body), "%s %s", path, sessionID)
		}
	}
}

func TestMemoryHandlers_RequireSessionID(t *testing.T) {
	app := newMemoryApp(NewHandler(unreachableRedis(), nil, newFakeSessions()))

	for path, body := range memoryRequestBodies("") {
		assert.Equal(t, fiber.StatusBadRequest, postJSON(t, app, path, body), path)
	}
}

func TestMemoryHandlers_SessionLookupFailureIsServerError(t *testing.T) {
	sessions := newFakeSessions()
	sessions.err = errors.New("db down")
	app := newMemoryApp(NewHandler(unreachableRedis(), nil, sessions))

	for path, body := range memoryRequestBodies(ownedSessionID) {
		assert.Equal(t, fiber.StatusInternalServerError, postJSON(t, app, path, body), path)
	}
}

func TestEpisodicHandlers_RejectInvalidSlot(t *testing.T) {
	sessions := newFakeSessions()
	app := newMemoryApp(NewHandler(unreachableRedis(), nil, sessions))
	body := `{"session_id":"` + ownedSessionID + `","slot":"bad slot/..","content":"x"}`

	assert.Equal(t, fiber.StatusBadRequest, postJSON(t, app, "/episodic/store", body))
	assert.Equal(t, fiber.StatusBadRequest, postJSON(t, app, "/episodic/recall", body))
	assert.Zero(t, sessions.calls, "slot validation must run before the session lookup")
}

func TestSessionOwner(t *testing.T) {
	sessions := newFakeSessions()
	h := NewHandler(nil, nil, sessions)
	ctx := context.Background()

	userID, err := h.sessionOwner(ctx, ownedSessionID)
	require.NoError(t, err)
	assert.Equal(t, sessionOwnerID, userID)

	_, err = h.sessionOwner(ctx, "")
	assert.ErrorIs(t, err, errSessionRequired)

	for _, sessionID := range []string{unknownSessionID, deletedSessionID, "not-a-uuid"} {
		_, err = h.sessionOwner(ctx, sessionID)
		assert.ErrorIs(t, err, errSessionNotFound, sessionID)
	}

	sessions.err = errors.New("db down")
	_, err = h.sessionOwner(ctx, ownedSessionID)
	require.Error(t, err)
	assert.NotErrorIs(t, err, errSessionNotFound)
}

func TestEpisodicKey_ScopesByOwnerSessionAndSlot(t *testing.T) {
	assert.Equal(t, "memory:episodic:42:"+ownedSessionID, episodicKey(sessionOwnerID, ownedSessionID, ""))
	assert.Equal(t, "memory:episodic:42:"+ownedSessionID+":paused:appr_1", episodicKey(sessionOwnerID, ownedSessionID, "paused:appr_1"))
	assert.NotEqual(t, episodicKey(1, ownedSessionID, ""), episodicKey(2, ownedSessionID, ""))
}

func TestValidateSlot(t *testing.T) {
	assert.NoError(t, validateSlot(""))
	assert.NoError(t, validateSlot("paused:appr_0b9a7c3d-2e4f"))
	assert.ErrorIs(t, validateSlot("has space"), errInvalidSlot)
	assert.ErrorIs(t, validateSlot("a/b"), errInvalidSlot)
	assert.ErrorIs(t, validateSlot(strings.Repeat("a", 129)), errInvalidSlot)
}

func TestClampSemanticSearchLimit(t *testing.T) {
	assert.Equal(t, defaultSemanticSearchLimit, clampSemanticSearchLimit(0))
	assert.Equal(t, defaultSemanticSearchLimit, clampSemanticSearchLimit(-5))
	assert.Equal(t, 25, clampSemanticSearchLimit(25))
	assert.Equal(t, maxSemanticSearchLimit, clampSemanticSearchLimit(1_000_000))
}

func TestGenerateID_PrefixesRandomHex(t *testing.T) {
	id, err := generateID(episodicIDPrefix)
	require.NoError(t, err)
	assert.Regexp(t, `^mem_ep_[0-9a-f]{8}$`, id)
}
