package auth

import (
	"context"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockAuthService struct {
	mock.Mock
}

func (m *mockAuthService) Login(ctx context.Context, email, password string) (*authmodel.User, string, error) {
	args := m.Called(ctx, email, password)
	if args.Get(0) == nil {
		return nil, args.String(1), args.Error(2)
	}
	return args.Get(0).(*authmodel.User), args.String(1), args.Error(2)
}

func (m *mockAuthService) Register(ctx context.Context, email, password, name string) (*authmodel.User, string, error) {
	args := m.Called(ctx, email, password, name)
	if args.Get(0) == nil {
		return nil, args.String(1), args.Error(2)
	}
	return args.Get(0).(*authmodel.User), args.String(1), args.Error(2)
}

func (m *mockAuthService) GetUserByID(ctx context.Context, id int) (*authmodel.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authmodel.User), args.Error(1)
}

func TestHandleLogin(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}

	tests := []struct {
		name       string
		body       string
		mockSetup  func(*mockAuthService)
		wantStatus int
		wantBody   map[string]interface{}
	}{
		{
			name: "valid JSON payload returns 200 with token and user",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Login", mock.Anything, "jane@example.com", "P@ssw0rd!23").
					Return(&authmodel.User{ID: 1, Email: "jane@example.com", Name: "Jane Doe"}, "jwt-token-abc", nil)
			},
			wantStatus: fiber.StatusOK,
			wantBody: map[string]interface{}{
				"token": "jwt-token-abc",
			},
		},
		{
			name:       "malformed JSON returns 400",
			body:       `{invalid}`,
			mockSetup:  func(m *mockAuthService) {},
			wantStatus: fiber.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockSvc := new(mockAuthService)
			tt.mockSetup(mockSvc)

			h := &Handler{
				Cfg:     cfg,
				AuthSvc: mockSvc,
			}

			app := fiber.New()
			app.Post("/login", h.HandleLogin)

			req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			if tt.wantStatus == fiber.StatusOK {
				var body map[string]interface{}
				assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
				assert.Equal(t, tt.wantBody["token"], body["token"])
				assert.Contains(t, body, "user")
				user := body["user"].(map[string]interface{})
				assert.Equal(t, "jane@example.com", user["email"])
			}

			mockSvc.AssertExpectations(t)
		})
	}
}
