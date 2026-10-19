package session

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/locals"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

const (
	sharedSessionID = "3b2f1d6a-7c4e-4a8b-9f10-2e5d7c9a1b34"
	otherSessionID  = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
)

type mockSessionRepo struct {
	mock.Mock
}

func (m *mockSessionRepo) CreateSession(ctx context.Context, userID int, title string, strategyVersion string) (*chatmodel.Session, error) {
	args := m.Called(ctx, userID, title, strategyVersion)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatmodel.Session), args.Error(1)
}

func (m *mockSessionRepo) GetByID(ctx context.Context, sessionID string) (*chatmodel.Session, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*chatmodel.Session), args.Error(1)
}

func (m *mockSessionRepo) DeleteSession(ctx context.Context, sessionID string) error {
	args := m.Called(ctx, sessionID)
	return args.Error(0)
}

func (m *mockSessionRepo) ListByUser(ctx context.Context, userID int, limit int, offset int) ([]*chatmodel.Session, error) {
	args := m.Called(ctx, userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*chatmodel.Session), args.Error(1)
}

func (m *mockSessionRepo) GetSessionMessages(ctx context.Context, sessionID string, limit int, offset int) ([]*chatmodel.Message, error) {
	args := m.Called(ctx, sessionID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*chatmodel.Message), args.Error(1)
}

func (m *mockSessionRepo) UpdateTitle(ctx context.Context, sessionID string, title string) error {
	args := m.Called(ctx, sessionID, title)
	return args.Error(0)
}

func (m *mockSessionRepo) UpdateContextSummary(ctx context.Context, sessionID string, summary string) error {
	args := m.Called(ctx, sessionID, summary)
	return args.Error(0)
}

func (m *mockSessionRepo) UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error {
	args := m.Called(ctx, sessionID, title, summary)
	return args.Error(0)
}

func (m *mockSessionRepo) GetSessionTokenCount(ctx context.Context, sessionID string) (int, error) {
	args := m.Called(ctx, sessionID)
	return args.Int(0), args.Error(1)
}

func (m *mockSessionRepo) CountByUser(ctx context.Context, userID int) (int, error) {
	args := m.Called(ctx, userID)
	return args.Int(0), args.Error(1)
}

func (m *mockSessionRepo) CountMessagesBySession(ctx context.Context, sessionID string) (int, error) {
	args := m.Called(ctx, sessionID)
	return args.Int(0), args.Error(1)
}

type mockConsolidationSvc struct {
	mock.Mock
}

func (m *mockConsolidationSvc) CheckThreshold(ctx context.Context, sessionID string, providerConfig map[string]interface{}) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}

func (m *mockConsolidationSvc) TriggerConsolidation(ctx context.Context, sessionID string, providerConfig map[string]interface{}) error {
	args := m.Called(ctx, sessionID, providerConfig)
	return args.Error(0)
}

type mockModelSvc struct {
	mock.Mock
}

func (m *mockModelSvc) ResolveProviderConfig(ctx context.Context, userID int, modelID string) (*aitype.ProviderConfig, error) {
	args := m.Called(ctx, userID, modelID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*aitype.ProviderConfig), args.Error(1)
}

func TestHandleCreateSession(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		body       string
		setUserID  string
		mockSetup  func(*mockSessionRepo, *mockConsolidationSvc, *mockModelSvc)
		wantStatus int
	}{
		{
			name:      "authenticated user with valid title returns 201",
			body:      `{"title":"My New Session"}`,
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("CreateSession", mock.Anything, 1, "My New Session", "").
					Return(&chatmodel.Session{ID: "sess_abc", UserID: 1, Title: "My New Session"}, nil)
			},
			wantStatus: fiber.StatusCreated,
		},
		{
			name:       "unauthenticated user returns 401",
			body:       `{"title":"Test"}`,
			setUserID:  "",
			mockSetup:  func(_ *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {},
			wantStatus: fiber.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockRepo := new(mockSessionRepo)
			mockCons := new(mockConsolidationSvc)
			mockMod := new(mockModelSvc)
			tt.mockSetup(mockRepo, mockCons, mockMod)

			h := &Handler{
				Cfg:              &cfgmodel.Config{},
				SessionRepo:      mockRepo,
				ConsolidationSvc: mockCons,
				ModelSvc:         mockMod,
			}

			app := fiber.New()
			app.Post("/sessions", func(c fiber.Ctx) error {
				if tt.setUserID != "" {
					c.Locals(locals.UserID, tt.setUserID)
				}
				return h.HandleCreateSession(c)
			})

			req := httptest.NewRequest(http.MethodPost, "/sessions", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestHandleDeleteSession(t *testing.T) {
	t.Parallel()

	sharedSession := &chatmodel.Session{ID: sharedSessionID, UserID: 1, Status: domainconst.StatusActive}
	otherUserSession := &chatmodel.Session{ID: otherSessionID, UserID: 2, Status: domainconst.StatusActive}

	tests := []struct {
		name       string
		sessionID  string
		setUserID  string
		mockSetup  func(*mockSessionRepo, *mockConsolidationSvc, *mockModelSvc)
		wantStatus int
	}{
		{
			name:      "session owned by requesting user returns 200",
			sessionID: sharedSessionID,
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("GetByID", mock.Anything, sharedSessionID).Return(sharedSession, nil)
				m.On("DeleteSession", mock.Anything, sharedSessionID).Return(nil)
			},
			wantStatus: fiber.StatusOK,
		},
		{
			name:      "session owned by different user returns 403",
			sessionID: otherSessionID,
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("GetByID", mock.Anything, otherSessionID).Return(otherUserSession, nil)
			},
			wantStatus: fiber.StatusForbidden,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockRepo := new(mockSessionRepo)
			mockCons := new(mockConsolidationSvc)
			mockMod := new(mockModelSvc)
			tt.mockSetup(mockRepo, mockCons, mockMod)

			h := &Handler{
				Cfg:              &cfgmodel.Config{},
				SessionRepo:      mockRepo,
				ConsolidationSvc: mockCons,
				ModelSvc:         mockMod,
			}

			app := fiber.New()
			app.Delete("/sessions/:id", func(c fiber.Ctx) error {
				if tt.setUserID != "" {
					c.Locals(locals.UserID, tt.setUserID)
				}
				return h.HandleDeleteSession(c)
			})

			req := httptest.NewRequest(http.MethodDelete, "/sessions/"+tt.sessionID, nil)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestHandleGetSessionMessages_ClampsNegativePagination(t *testing.T) {
	t.Parallel()

	sharedSession := &chatmodel.Session{ID: sharedSessionID, UserID: 1, Status: domainconst.StatusActive}

	mockRepo := new(mockSessionRepo)
	mockCons := new(mockConsolidationSvc)
	mockMod := new(mockModelSvc)
	mockRepo.On("GetByID", mock.Anything, sharedSessionID).Return(sharedSession, nil)
	// Negative limit/offset must be clamped to 0 rather than passed to SQL
	// (LIMIT NULLIF(-5,0) is rejected by Postgres and returns a 500).
	mockRepo.On("GetSessionMessages", mock.Anything, sharedSessionID, 0, 0).Return([]*chatmodel.Message{}, nil)
	mockRepo.On("CountMessagesBySession", mock.Anything, sharedSessionID).Return(0, nil)

	h := &Handler{
		Cfg:              &cfgmodel.Config{},
		SessionRepo:      mockRepo,
		ConsolidationSvc: mockCons,
		ModelSvc:         mockMod,
	}

	app := fiber.New()
	app.Get("/sessions/:id/messages", func(c fiber.Ctx) error {
		c.Locals(locals.UserID, "1")
		return h.HandleGetSessionMessages(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/sessions/"+sharedSessionID+"/messages?limit=-5&offset=-3", nil)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	mockRepo.AssertExpectations(t)
}
