package aimodel

import (
	"context"
	"echo-backend/internal/models/ai"
	"echo-backend/internal/models/config"
	"echo-backend/internal/models/user"
	"testing"

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
				Type:    aitype.ProviderOpenAI,
				BaseURL: "https://custom.openai.com/v1",
				APIKey:  "sk-custom-key",
				Model:   "custom-model",
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
			name:     "nil preferences returns error",
			userID:   3,
			modelID:  "gpt-4o",
			prefs:    nil,
			wantErr:  true,
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
				Type:    aitype.ProviderOpenCode,
				BaseURL: "https://opencode.ai/zen/go/v1",
				APIKey:  "sk-key",
				Model:   "",
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

			svc := &Service{
				cfg:         cfg,
				settingsSvc: mockSettings,
				cache:       modelCache{entries: make(map[string]cacheEntry)},
			}

			got, err := svc.ResolveProviderConfig(tt.userID, tt.modelID)
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
