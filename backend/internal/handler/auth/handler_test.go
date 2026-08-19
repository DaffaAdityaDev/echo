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

func (m *mockAuthService) Login(ctx context.Context, email, password, deviceLabel string) (*authmodel.User, *authsvc.TokenPair, error) {
	args := m.Called(ctx, email, password, deviceLabel)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	return args.Get(0).(*authmodel.User), args.Get(1).(*authsvc.TokenPair), args.Error(2)
}

func (m *mockAuthService) Register(ctx context.Context, email, password, name, deviceLabel string) (*authmodel.User, *authsvc.TokenPair, error) {
	args := m.Called(ctx, email, password, name, deviceLabel)
	if args.Get(0) == nil {
		return nil, nil, args.Error(2)
	}
	return args.Get(0).(*authmodel.User), args.Get(1).(*authsvc.TokenPair), args.Error(2)
}

func (m *mockAuthService) RefreshAccessToken(ctx context.Context, refreshToken, deviceLabel string) (*authsvc.TokenPair, error) {
	args := m.Called(ctx, refreshToken, deviceLabel)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authsvc.TokenPair), args.Error(1)
}

func (m *mockAuthService) RevokeRefreshToken(ctx context.Context, refreshToken string) error {
	args := m.Called(ctx, refreshToken)
	return args.Error(0)
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
			name: "valid JSON payload returns 200 with token pair and auth cookies",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Login", mock.Anything, "jane@example.com", "P@ssw0rd!23", mock.Anything).
					Return(&authmodel.User{ID: 1, Email: "jane@example.com", Name: "Jane Doe"},
						&authsvc.TokenPair{AccessToken: "jwt-token-abc", RefreshToken: "refresh-xyz", ExpiresIn: 900}, nil)
			},
			wantStatus: fiber.StatusOK,
			wantBody: map[string]interface{}{
				"access_token": "jwt-token-abc",
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
				assert.Equal(t, tt.wantBody["access_token"], body["access_token"])
				assert.Equal(t, "refresh-xyz", body["refresh_token"])
				assert.Contains(t, body, "user")
				user := body["user"].(map[string]interface{})
				assert.Equal(t, "jane@example.com", user["email"])

				cookieNames := map[string]bool{}
				for _, c := range resp.Cookies() {
					cookieNames[c.Name] = true
				}
				assert.True(t, cookieNames[authconst.TokenCookie], "access cookie not set")
				assert.True(t, cookieNames[authconst.RefreshCookie], "refresh cookie not set")
			}

			mockSvc.AssertExpectations(t)
		})
	}
}

func TestHandleLoginWrongCredentials(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)
	mockSvc.On("Login", mock.Anything, "jane@example.com", "wrongpass", mock.Anything).Return(nil, nil, authsvc.ErrInvalidCredentials)

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
	mockSvc.AssertNotCalled(t, "Login", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestHandleLoginInternalError(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)
	mockSvc.On("Login", mock.Anything, "jane@example.com", "password123", mock.Anything).Return(nil, nil, errors.New("database down"))

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
			name: "valid payload returns 200 with token pair and auth cookies",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe", mock.Anything).
					Return(&authmodel.User{ID: 1, Email: "jane@example.com", Name: "Jane Doe"},
						&authsvc.TokenPair{AccessToken: "jwt-token-abc", RefreshToken: "refresh-xyz", ExpiresIn: 900}, nil)
			},
			wantStatus: fiber.StatusOK,
			wantToken:  "jwt-token-abc",
		},
		{
			name: "duplicate email returns 409",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe", mock.Anything).
					Return(nil, nil, authsvc.ErrDuplicateEmail)
			},
			wantStatus: fiber.StatusConflict,
		},
		{
			name: "internal error returns 500",
			body: `{"email":"jane@example.com","password":"P@ssw0rd!23","name":"Jane Doe"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("Register", mock.Anything, "jane@example.com", "P@ssw0rd!23", "Jane Doe", mock.Anything).
					Return(nil, nil, errors.New("database down"))
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
				assert.Equal(t, tt.wantToken, body["access_token"])
				cookieNames := map[string]bool{}
				for _, c := range resp.Cookies() {
					cookieNames[c.Name] = true
				}
				assert.True(t, cookieNames[authconst.TokenCookie], "access cookie not set")
				assert.True(t, cookieNames[authconst.RefreshCookie], "refresh cookie not set")
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
	mockSvc.On("RevokeRefreshToken", mock.Anything, "").Return(nil)

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/logout", h.HandleLogout)

	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	cookieNames := map[string]bool{}
	for _, c := range resp.Cookies() {
		cookieNames[c.Name] = true
	}
	assert.True(t, cookieNames[authconst.TokenCookie], "access cookie not cleared")
	assert.True(t, cookieNames[authconst.RefreshCookie], "refresh cookie not cleared")
	mockSvc.AssertExpectations(t)
}

func TestHandleLogoutRevokesRefreshToken(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}
	mockSvc := new(mockAuthService)
	mockSvc.On("RevokeRefreshToken", mock.Anything, "refresh-from-body").Return(nil)

	h := &Handler{Cfg: cfg, AuthSvc: mockSvc}
	app := fiber.New(fiber.Config{ErrorHandler: handlerutil.ErrorHandler})
	app.Post("/logout", h.HandleLogout)

	req := httptest.NewRequest(http.MethodPost, "/logout", strings.NewReader(`{"refresh_token":"refresh-from-body"}`))
	req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
	resp, err := app.Test(req)

	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	mockSvc.AssertExpectations(t)
}

func TestHandleRefresh(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{Environment: "test", JWTSecret: "test-secret"}

	tests := []struct {
		name        string
		cookie      bool
		body        string
		mockSetup   func(*mockAuthService)
		wantStatus  int
		wantRefresh string
	}{
		{
			name:   "refresh from cookie rotates pair",
			cookie: true,
			body:   "",
			mockSetup: func(m *mockAuthService) {
				m.On("RefreshAccessToken", mock.Anything, "refresh-cookie", mock.Anything).
					Return(&authsvc.TokenPair{AccessToken: "new-access", RefreshToken: "new-refresh", ExpiresIn: 900}, nil)
			},
			wantStatus:  fiber.StatusOK,
			wantRefresh: "new-refresh",
		},
		{
			name:   "refresh from body rotates pair",
			cookie: false,
			body:   `{"refresh_token":"refresh-body"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("RefreshAccessToken", mock.Anything, "refresh-body", mock.Anything).
					Return(&authsvc.TokenPair{AccessToken: "new-access", RefreshToken: "new-refresh", ExpiresIn: 900}, nil)
			},
			wantStatus:  fiber.StatusOK,
			wantRefresh: "new-refresh",
		},
		{
			name:   "invalid refresh token returns 401",
			cookie: false,
			body:   `{"refresh_token":"stale"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("RefreshAccessToken", mock.Anything, "stale", mock.Anything).Return(nil, authsvc.ErrInvalidRefreshToken)
			},
			wantStatus: fiber.StatusUnauthorized,
		},
		{
			name:   "revoked refresh token returns 401",
			cookie: false,
			body:   `{"refresh_token":"stolen"}`,
			mockSetup: func(m *mockAuthService) {
				m.On("RefreshAccessToken", mock.Anything, "stolen", mock.Anything).Return(nil, authsvc.ErrRefreshTokenRevoked)
			},
			wantStatus: fiber.StatusUnauthorized,
		},
		{
			name:       "missing refresh token returns 401 without calling service",
			cookie:     false,
			body:       `{}`,
			mockSetup:  func(m *mockAuthService) {},
			wantStatus: fiber.StatusUnauthorized,
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
			app.Post("/refresh", h.HandleRefresh)

			req := httptest.NewRequest(http.MethodPost, "/refresh", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			if tt.cookie {
				req.AddCookie(&http.Cookie{Name: authconst.RefreshCookie, Value: "refresh-cookie"})
			}

			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			if tt.wantStatus == fiber.StatusOK {
				var body map[string]interface{}
				assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
				assert.Equal(t, "new-access", body["access_token"])
				assert.Equal(t, tt.wantRefresh, body["refresh_token"])

				cookieNames := map[string]bool{}
				for _, c := range resp.Cookies() {
					cookieNames[c.Name] = true
				}
				assert.True(t, cookieNames[authconst.TokenCookie], "access cookie not set")
				assert.True(t, cookieNames[authconst.RefreshCookie], "refresh cookie not set")
			}

			mockSvc.AssertExpectations(t)
		})
	}
}
