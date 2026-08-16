package admin

import (
	"context"
	domainconst "echo-backend/internal/constants/domain"
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

type mockAPIKeyRepo struct {
	mock.Mock
}

func (m *mockAPIKeyRepo) Create(ctx context.Context, key *authmodel.ApiKey) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *mockAPIKeyRepo) List(ctx context.Context) ([]authmodel.ApiKey, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]authmodel.ApiKey), args.Error(1)
}

func (m *mockAPIKeyRepo) GetByID(ctx context.Context, id string) (*authmodel.ApiKey, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authmodel.ApiKey), args.Error(1)
}

func (m *mockAPIKeyRepo) Revoke(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestHandleCreateKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		body       string
		setUserID  string
		mockSetup  func(*mockAPIKeyRepo)
		wantStatus int
		wantKey    bool
	}{
		{
			name:      "admin user creates key returns 201 with sk_ prefix and hash",
			body:      `{"name":"Test Key","scopes":["read","write"]}`,
			setUserID: "1",
			mockSetup: func(m *mockAPIKeyRepo) {
				m.On("Create", mock.Anything, mock.MatchedBy(func(k *authmodel.ApiKey) bool {
					return k.Prefix != "" && k.KeyHash != "" && k.Name == "Test Key" && k.Status == domainconst.StatusActive
				})).Return(nil)
			},
			wantStatus: fiber.StatusCreated,
			wantKey:    true,
		},
		{
			name:       "unauthenticated request returns 401",
			body:       `{"name":"Bad Key","scopes":["read"]}`,
			setUserID:  "",
			mockSetup:  func(m *mockAPIKeyRepo) {},
			wantStatus: fiber.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockRepo := new(mockAPIKeyRepo)
			tt.mockSetup(mockRepo)

			h := &Handler{
				Cfg:        &cfgmodel.Config{},
				APIKeyRepo: mockRepo,
			}

			app := fiber.New()
			app.Post("/admin/api-keys", func(c fiber.Ctx) error {
				if tt.setUserID != "" {
					c.Locals("user_id", tt.setUserID)
				}
				return h.HandleCreateKey(c)
			})

			req := httptest.NewRequest(http.MethodPost, "/admin/api-keys", strings.NewReader(tt.body))
			req.Header.Set(httpxconst.HeaderContentType, httpxconst.ContentTypeJSON)
			resp, err := app.Test(req)

			assert.NoError(t, err)
			assert.Equal(t, tt.wantStatus, resp.StatusCode)

			if tt.wantKey {
				var body map[string]interface{}
				assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

				keyField, ok := body["key"]
				assert.True(t, ok, "response must contain 'key' field")
				keyStr, ok := keyField.(string)
				assert.True(t, ok, "'key' must be a string")
				assert.True(t, strings.HasPrefix(keyStr, "sk_"), "key must start with sk_")

				apiKey, ok := body["api_key"]
				assert.True(t, ok, "response must contain 'api_key' object")
				apiKeyMap, ok := apiKey.(map[string]interface{})
				assert.True(t, ok, "'api_key' must be an object")
				prefix, ok := apiKeyMap["prefix"].(string)
				assert.True(t, ok)
				assert.True(t, strings.HasPrefix(prefix, "sk_"), "prefix must start with sk_")
				assert.NotEmpty(t, apiKeyMap["id"])
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
