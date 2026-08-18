package auth

import (
	"context"
	authconst "echo-backend/internal/constants/auth"
	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/locals"
	"echo-backend/internal/handler/handlerutil"
	"echo-backend/internal/models/auth"
	"echo-backend/internal/models/config"
	authsvc "echo-backend/internal/service/auth"
	"encoding/json"
	"errors"
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

			app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
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

func TestHandleLoginWrongCredentials(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)
	mockSvc.On("Login", mock.Anything, "jane@example.com", "wrongpass").Return(nil, "", authsvc.ErrInvalidCredentials)

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/login", h.HandleLogin)

	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"jane@example.com","password":"wrongpass"}`))
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	var body map[string]interface{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "invalid email or password", body[httpxconst.JSONKeyError])
	mockSvc.AssertExpectations(t)
}

func TestHandleLoginValidation(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/login", h.HandleLogin)

	tests := []struct {
		name string
		body string
	}{
		{name: "empty email", body: `{"email":"","password":"password123"}`},
		{name: "malformed email", body: `{"email":"not-an-email","password":"password123"}`},
		{name: "empty password", body: `{"email":"jane@example.com","password":""}`},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
		})
	}
	mockSvc.AssertNotCalled(t, "Login", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandleLoginInternalError(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)
	mockSvc.On("Login", mock.Anything, "jane@example.com", "password123").Return(nil, "", errors.New("database down"))

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/login", h.HandleLogin)

	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"jane@example.com","password":"password123"}`))
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	mockSvc.AssertExpectations(t)
}

func TestHandleRegister(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}

	tests := []struct {
		name       string
		body       string
		mockSetup  func(*mockAuthService)
		wantStatus int
		wantToken  string
	}{
		{
			name: "valid payload returns 200 with token and auth cookie",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe").
					Return(&authmodel.User{ID: 1, Email: "jane@example.com", Name: "Jane Doe"}, "jwt-token-abc", nil)
			},
			wantStatus: fiber.StatusOK,
			wantToken:  "jwt-token-abc",
		},
		{
			name: "duplicate email returns 409",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe").
					Return(nil, "", authsvc.ErrDuplicateEmail)
			},
			wantStatus: fiber.StatusConflict,
		},
		{
			name: "internal error returns 500",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe").
					Return(nil, "", errors.New("database down"))
			},
			wantStatus: fiber.StatusInternalServerError,
		},
		{
			name:       "malformed JSON returns 400",
			body:       `{invalid}`,
			mockSetup:  func(m *mockAuthService) {},
			wantStatus: fiber.StatusBadRequest,
		},
		{
			name:       "short password returns 400",
			body:       `{"email":"jane@example.com","password":"short","name":"Jane Doe"}`,
			mockSetup:  func(m *mockAuthService) {},
			wantStatus: fiber.StatusBadRequest,
		},
		{
			name:       "empty name returns 400",
			body:       `{"email":"jane@example.com","password":"P@ssw0rd!23","name":""}`,
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

			h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
			app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
			app.Post("/register", h.HandleRegister)

			req := httptest.NewRequest(http.MethodPost, "/register", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			if tt.wantStatus == fiber.StatusOK {
				var body map[string]interface{}
				assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
				assert.Equal(t, tt.wantToken, body["token"])
				assert.Contains(t, resp.Header.Get("Set-Cookie"), authconst.TokenCookie)
			}

			mockSvc.AssertExpectations(t)
		})
	}
}

func TestHandleMe(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}

	tests := []struct {
		name       string
		withLocals bool
		mockSetup  func(*mockAuthService)
		wantStatus int
	}{
		{
			name:       "authenticated returns user",
			withLocals: true,
			mockSetup: func(m *mockAuthService) {
				m.On("GetUserByID", mock.Anything, 7).Return(&authmodel.User{ID: 7, Email: "jane@example.com", Name: "Jane Doe"}, nil)
			},
			wantStatus: fiber.StatusOK,
		},
		{
			name:       "missing identity returns 401",
			withLocals: false,
			mockSetup:  func(m *mockAuthService) {},
			wantStatus: fiber.StatusUnauthorized,
		},
		{
			name:       "user not found returns 404",
			withLocals: true,
			mockSetup: func(m *mockAuthService) {
				m.On("GetUserByID", mock.Anything, 7).Return(nil, nil)
			},
			wantStatus: fiber.StatusNotFound,
		},
		{
			name:       "internal error returns 500",
			withLocals: true,
			mockSetup: func(m *mockAuthService) {
				m.On("GetUserByID", mock.Anything, 7).Return(nil, errors.New("database down"))
			},
			wantStatus: fiber.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockSvc := new(mockAuthService)
			tt.mockSetup(mockSvc)

			h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
			app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
			if tt.withLocals {
				app.Get("/me", func(c fiber.Ctx) error {
					c.Locals(locals.UserID, "7")
					return c.Next()
				}, h.HandleMe)
			} else {
				app.Get("/me", h.HandleMe)
			}

			req := httptest.NewRequest(http.MethodGet, "/me", nil)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			mockSvc.AssertExpectations(t)
		})
	}
}

func TestHandleLogout(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/logout", h.HandleLogout)

	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	setCookie := resp.Header.Get("Set-Cookie")
	assert.Contains(t, setCookie, authconst.TokenCookie)
	assert.Contains(t, setCookie, "expires=")
}
