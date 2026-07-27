package session

import (
	"context"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/chat"
	"echo-backend/internal/models/config"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockSessionRepo struct {
	mock.Mock
}

func (m *mockSessionRepo) CreateSession(ctx context.Context, userID int, title string) (*chatmodel.Session, error) {
	args := m.Called(ctx, userID, title)
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

func (m *mockSessionRepo) ListByUser(ctx context.Context, userID int) ([]*chatmodel.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*chatmodel.Session), args.Error(1)
}

func (m *mockSessionRepo) GetSessionMessages(ctx context.Context, sessionID string) ([]*chatmodel.Message, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*chatmodel.Message), args.Error(1)
}

func (m *mockSessionRepo) UpdateTitleAndSummary(ctx context.Context, sessionID string, title string, summary string) error {
	args := m.Called(ctx, sessionID, title, summary)
	return args.Error(0)
}

func (m *mockSessionRepo) GetSessionTokenCount(ctx context.Context, sessionID string) (int, error) {
	args := m.Called(ctx, sessionID)
	return args.Int(0), args.Error(1)
}

type mockConsolidationSvc struct {
	mock.Mock
}

func (m *mockConsolidationSvc) CheckThreshold(ctx context.Context, sessionID string) (bool, error) {
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

func (m *mockModelSvc) ResolveProviderConfig(userID int, modelID string) (*aitype.ProviderConfig, error) {
	args := m.Called(userID, modelID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*aitype.ProviderConfig), args.Error(1)
}

func TestHandleCreateSession(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		body          string
		setUserID     string
		mockSetup     func(*mockSessionRepo, *mockConsolidationSvc, *mockModelSvc)
		wantStatus    int
	}{
		{
			name:      "authenticated user with valid title returns 201",
			body:      `{"title":"My New Session"}`,
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("CreateSession", mock.Anything, 1, "My New Session").
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
					c.Locals("user_id", tt.setUserID)
				}
				return h.HandleCreateSession(c)
			})

			req := httptest.NewRequest("POST", "/sessions", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestHandleDeleteSession(t *testing.T) {
	t.Parallel()

	sharedSession := &chatmodel.Session{ID: "sess_shared", UserID: 1, Status: "active"}
	otherUserSession := &chatmodel.Session{ID: "sess_other", UserID: 2, Status: "active"}

	tests := []struct {
		name          string
		sessionID     string
		setUserID     string
		mockSetup     func(*mockSessionRepo, *mockConsolidationSvc, *mockModelSvc)
		wantStatus    int
	}{
		{
			name:      "session owned by requesting user returns 200",
			sessionID: "sess_shared",
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("GetByID", mock.Anything, "sess_shared").Return(sharedSession, nil)
				m.On("DeleteSession", mock.Anything, "sess_shared").Return(nil)
			},
			wantStatus: fiber.StatusOK,
		},
		{
			name:      "session owned by different user returns 403",
			sessionID: "sess_other",
			setUserID: "1",
			mockSetup: func(m *mockSessionRepo, _ *mockConsolidationSvc, _ *mockModelSvc) {
				m.On("GetByID", mock.Anything, "sess_other").Return(otherUserSession, nil)
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
					c.Locals("user_id", tt.setUserID)
				}
				return h.HandleDeleteSession(c)
			})

			req := httptest.NewRequest("DELETE", "/sessions/"+tt.sessionID, nil)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)
			mockRepo.AssertExpectations(t)
		})
	}
}
