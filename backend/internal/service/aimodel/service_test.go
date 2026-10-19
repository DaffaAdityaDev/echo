package aimodel

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	authconst "echo-backend/internal/constants/auth"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockSettingsProvider struct {
	mock.Mock
}

func (m *mockSettingsProvider) GetSettingsInternal(ctx context.Context, userID int) (*usermodel.UserPreferences, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*usermodel.UserPreferences), args.Error(1)
}

func TestResolveProviderConfig(t *testing.T) {
	t.Parallel()

	cfg := &cfgmodel.Config{DefaultModel: "gpt-4o"}

	tests := []struct {
		name     string
		userID   int
		modelID  string
		prefs    *usermodel.UserPreferences
		prefsErr error
		want     *aitype.ProviderConfig
		wantErr  bool
	}{
		{
			name:    "user has custom provider in preferences",
			userID:  1,
			modelID: "custom-model",
			prefs: &usermodel.UserPreferences{
				ProviderType: "openai",
				APIKey:       "sk-custom-key",
				BaseURL:      "https://custom.openai.com/v1",
			},
			want: &aitype.ProviderConfig{
				Type:             aitype.ProviderOpenAI,
				BaseURL:          "https://custom.openai.com/v1",
				APIKey:           "sk-custom-key",
				Model:            "custom-model",
				MaxContextTokens: 128000,
			},
		},
		{
			name:    "no api key and provider not lm studio returns error",
			userID:  2,
			modelID: "claude-opus",
			prefs: &usermodel.UserPreferences{
				ProviderType: "anthropic",
				APIKey:       "",
				BaseURL:      "https://api.anthropic.com",
			},
			wantErr: true,
		},
		{
			name:    "nil preferences returns error",
			userID:  3,
			modelID: "gpt-4o",
			prefs:   nil,
			wantErr: true,
		},
		{
			name:    "empty modelID falls back to system default provider config",
			userID:  4,
			modelID: "",
			prefs: &usermodel.UserPreferences{
				ProviderType: "opencode-go",
				APIKey:       "sk-key",
				BaseURL:      "",
			},
			want: &aitype.ProviderConfig{
				Type:             aitype.ProviderOpenCode,
				BaseURL:          "https://opencode.ai/zen/go/v1",
				APIKey:           "sk-key",
				Model:            "",
				MaxContextTokens: 1_000_000,
			},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mockSettings := new(mockSettingsProvider)
			mockSettings.On("GetSettingsInternal", mock.Anything, tt.userID).
				Return(tt.prefs, tt.prefsErr)

			svc := NewService(cfg, mockSettings)

			got, err := svc.ResolveProviderConfig(context.Background(), tt.userID, tt.modelID)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, got)
			mockSettings.AssertExpectations(t)
		})
	}
}

func newModelsProvider(t *testing.T, status int, calls *atomic.Int32) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(status)
		if status != http.StatusOK {
			_, _ = w.Write([]byte("upstream secret: internal stack trace"))
			return
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"model-for-` + r.Header.Get(authconst.HeaderAuthorization) + `"}]}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func settingsFor(userID int, baseURL, apiKey string) *mockSettingsProvider {
	m := new(mockSettingsProvider)
	m.On("GetSettingsInternal", mock.Anything, userID).Return(&usermodel.UserPreferences{
		ProviderType: "openai",
		APIKey:       apiKey,
		BaseURL:      baseURL,
	}, nil)
	return m
}

type multiUserSettings map[int]*usermodel.UserPreferences

func (m multiUserSettings) GetSettingsInternal(_ context.Context, userID int) (*usermodel.UserPreferences, error) {
	prefs := *m[userID]
	return &prefs, nil
}

func TestGetModels_CacheIsScopedToAPIKey(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	server := newModelsProvider(t, http.StatusOK, &calls)
	settings := multiUserSettings{
		1: {ProviderType: "openai", APIKey: "key-a", BaseURL: server.URL},
		2: {ProviderType: "openai", APIKey: "key-b", BaseURL: server.URL},
	}
	svc := NewService(&cfgmodel.Config{AllowPrivateProviderURLs: true}, settings)

	first, err := svc.GetModels(context.Background(), 1)
	assert.NoError(t, err)
	second, err := svc.GetModels(context.Background(), 2)
	assert.NoError(t, err)
	again, err := svc.GetModels(context.Background(), 1)
	assert.NoError(t, err)

	assert.Equal(t, "model-for-Bearer key-a", first[0].ID)
	assert.Equal(t, "model-for-Bearer key-b", second[0].ID)
	assert.Equal(t, first, again)
	assert.Equal(t, int32(2), calls.Load())
}

func TestGetModels_DoesNotEchoUpstreamBody(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	server := newModelsProvider(t, http.StatusUnauthorized, &calls)
	svc := NewService(&cfgmodel.Config{AllowPrivateProviderURLs: true}, settingsFor(1, server.URL, "key"))

	_, err := svc.GetModels(context.Background(), 1)

	assert.Error(t, err)
	assert.NotContains(t, err.Error(), "upstream secret")
}

func TestGetModels_RefusesPrivateProviderWhenDisallowed(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	server := newModelsProvider(t, http.StatusOK, &calls)
	svc := NewService(&cfgmodel.Config{AllowPrivateProviderURLs: false}, settingsFor(1, server.URL, "key"))

	_, err := svc.GetModels(context.Background(), 1)

	assert.Error(t, err)
	assert.Equal(t, int32(0), calls.Load())
}
