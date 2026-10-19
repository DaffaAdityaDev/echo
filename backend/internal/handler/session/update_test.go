package session

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/locals"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func ownedSession() *chatmodel.Session {
	return &chatmodel.Session{ID: sharedSessionID, UserID: 1, Status: domainconst.StatusActive, Title: "New Chat"}
}

func newTestApp(h *Handler, method, path string, handler fiber.Handler) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Add([]string{method}, path, func(c fiber.Ctx) error {
		c.Locals(locals.UserID, "1")
		return handler(c)
	})
	return app
}

func readErrorBody(t *testing.T, resp *http.Response) map[string]string {
	t.Helper()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var body map[string]string
	require.NoError(t, json.Unmarshal(raw, &body))
	return body
}

func TestHandleGetSession_RejectsNonUUID(t *testing.T) {
	t.Parallel()

	repo := new(mockSessionRepo)
	h := &Handler{Cfg: &cfgmodel.Config{}, SessionRepo: repo}
	app := newTestApp(h, http.MethodGet, "/sessions/:id", h.HandleGetSession)

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/sessions/not-a-uuid", nil))

	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	repo.AssertNotCalled(t, "GetByID", mock.Anything, mock.Anything)
}

func TestHandleGetSession_RepoErrorDoesNotLeakDetails(t *testing.T) {
	t.Parallel()

	repo := new(mockSessionRepo)
	repo.On("GetByID", mock.Anything, sharedSessionID).Return(nil, errors.New("pq: connection refused at 10.0.0.5"))
	h := &Handler{Cfg: &cfgmodel.Config{}, SessionRepo: repo}
	app := newTestApp(h, http.MethodGet, "/sessions/:id", h.HandleGetSession)

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/sessions/"+sharedSessionID, nil))

	require.NoError(t, err)
	assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	assert.Empty(t, readErrorBody(t, resp)[httpxconst.JSONKeyDetails])
}

func TestHandleUpdateSession_WritesOnlyProvidedFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		body      string
		mockSetup func(*mockSessionRepo)
	}{
		{
			name: "title only keeps summary",
			body: `{"title":"Renamed"}`,
			mockSetup: func(m *mockSessionRepo) {
				m.On("UpdateTitle", mock.Anything, sharedSessionID, "Renamed").Return(nil)
			},
		},
		{
			name: "summary only keeps title",
			body: `{"summary":"Updated summary"}`,
			mockSetup: func(m *mockSessionRepo) {
				m.On("UpdateContextSummary", mock.Anything, sharedSessionID, "Updated summary").Return(nil)
			},
		},
		{
			name: "both fields update together",
			body: `{"title":"Renamed","summary":"Updated summary"}`,
			mockSetup: func(m *mockSessionRepo) {
				m.On("UpdateTitleAndSummary", mock.Anything, sharedSessionID, "Renamed", "Updated summary").Return(nil)
			},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := new(mockSessionRepo)
			repo.On("GetByID", mock.Anything, sharedSessionID).Return(ownedSession(), nil)
			tt.mockSetup(repo)
			h := &Handler{Cfg: &cfgmodel.Config{}, SessionRepo: repo}
			app := newTestApp(h, http.MethodPatch, "/sessions/:id", h.HandleUpdateSession)

			req := httptest.NewRequest(http.MethodPatch, "/sessions/"+sharedSessionID, strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			require.NoError(t, err)
			assert.Equal(t, fiber.StatusOK, resp.StatusCode)
			repo.AssertExpectations(t)
		})
	}
}

func newTitleHandler(t *testing.T, providerStatus int, providerBody string) (*Handler, *mockSessionRepo) {
	t.Helper()

	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(providerStatus)
		_, _ = w.Write([]byte(providerBody))
	}))
	t.Cleanup(provider.Close)

	repo := new(mockSessionRepo)
	repo.On("GetByID", mock.Anything, sharedSessionID).Return(ownedSession(), nil)
	repo.On("GetSessionMessages", mock.Anything, sharedSessionID, titleHistoryLimit, 0).
		Return([]*chatmodel.Message{{Role: domainconst.MessageRoleUser, Content: "How do I write a Go HTTP server?"}}, nil)

	models := new(mockModelSvc)
	models.On("ResolveProviderConfig", mock.Anything, 1, "test-model").
		Return(&aitype.ProviderConfig{BaseURL: provider.URL, Model: "test-model"}, nil)

	return &Handler{Cfg: &cfgmodel.Config{DefaultModel: "test-model", AllowPrivateProviderURLs: true}, SessionRepo: repo, ModelSvc: models}, repo
}

func TestHandleGenerateTitle_PersistsTitleOnly(t *testing.T) {
	t.Parallel()

	completion := `{"choices":[{"message":{"content":"{\"title\":\"Go HTTP Server\",\"summary\":\"User asks about Go servers.\"}"}}]}`
	h, repo := newTitleHandler(t, http.StatusOK, completion)
	repo.On("UpdateTitle", mock.Anything, sharedSessionID, "Go HTTP Server").Return(nil)
	app := newTestApp(h, http.MethodPost, "/sessions/:id/generate-title", h.HandleGenerateTitle)

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/sessions/"+sharedSessionID+"/generate-title", nil))

	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	repo.AssertExpectations(t)
	repo.AssertNotCalled(t, "UpdateTitleAndSummary", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	repo.AssertNotCalled(t, "UpdateContextSummary", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandleGenerateTitle_DoesNotEchoProviderError(t *testing.T) {
	t.Parallel()

	const providerSecret = "invalid api key sk-live-123 for org acme"
	h, _ := newTitleHandler(t, http.StatusUnauthorized, providerSecret)
	app := newTestApp(h, http.MethodPost, "/sessions/:id/generate-title", h.HandleGenerateTitle)

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/sessions/"+sharedSessionID+"/generate-title", nil))

	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadGateway, resp.StatusCode)
	body := readErrorBody(t, resp)
	assert.NotContains(t, body[httpxconst.JSONKeyError], providerSecret)
	assert.NotContains(t, body[httpxconst.JSONKeyDetails], providerSecret)
}

func TestHandleGenerateTitle_BlocksPrivateProviderWhenDisallowed(t *testing.T) {
	t.Parallel()

	h, _ := newTitleHandler(t, http.StatusOK, `{"choices":[]}`)
	h.Cfg.AllowPrivateProviderURLs = false
	app := newTestApp(h, http.MethodPost, "/sessions/:id/generate-title", h.HandleGenerateTitle)

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/sessions/"+sharedSessionID+"/generate-title", nil))

	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadGateway, resp.StatusCode)
}
